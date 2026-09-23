import { chunkRows, sanitizeErrorMessage, type GuardCheck } from "../real-import-guards";
import { BACKUP_TARGET_TABLES } from "./backup-target";
import { SUPPORTED_BACKUP_FORMAT_VERSIONS, assertBackupFormatVersion, getBackupTableSpec } from "./backup-schema";
import { buildBackupDumpSelectSql, buildBackupRestoreInsertSql, buildBackupTruncateAllRestoreTargetsSql, mapBackupFieldsToParams, toPortableBackupRow } from "./backup-sql";
import { BACKUP_RESTORE_TEST_SCHEMA } from "./backup-schema";
import {
  computeBackupTableChecksum,
  computeBackupTotalChecksum,
  computeSourceMetadataChecksum,
  deriveSourceDatasetPairs,
  type BackupSourceMetadataEntry,
} from "./backup-checksum";
import { markManifestRestoreVerified, markManifestFailed, type BackupManifest } from "./backup-manifest";
import type { BackupArtifact, BackupPayload } from "./backup-orchestrator";
import type { BackupEncryptor } from "./backup-encryptor";
import type { QueryClient } from "./apply-orchestrator";
import { evaluateBackupContentPolicy, type BackupContentPolicy } from "./backup-content-policy";

/**
 * Backup検証済み(`manifest.restoreVerified === true`)と主張してよいのは、実際に
 * 「別の空の隔離schemaへRestoreし、Restore後checksumが一致した」ことを確認した場合だけ。
 * Backupを取得しただけ(暗号化・アップロードまで成功しただけ)ではverifiedにしない
 * ([[reference-data-production-backup-design.md]]のBackup gate要件と対応する)。
 *
 * Restore先は常に固定の`BACKUP_RESTORE_TEST_SCHEMA`(source用schemaとは別のschema)。
 * 復号→整合性の全検証(改ざん検出含む)を、Restore先schemaへ一切書き込む前に完了させる
 * ことで、破損・改ざんされたBackupが隔離schemaへ部分的にでも書き込まれることを防ぐ。
 */

const INSERT_ORDER: readonly string[] = ["world_player_cards", "managers", "import_batches", "player_card_analysis"];

export interface RestoreInput {
  artifact: BackupArtifact;
  decryptor: BackupEncryptor;
  expectedSchemaVersion: string;
  expectedPostgresMajorVersion: number;
  now: Date;
  /**
   * 指定された場合、manifestのrowCountsがこの内容妥当性policyを満たさなければ、復号・
   * 書込みより前にblockedにする(空データ同士の一致だけでrestoreVerified=trueにしない)。
   * Production Backupの隔離Restore検証では必ず指定する。
   */
  contentPolicy?: BackupContentPolicy;
}

export interface RestoreResult {
  ok: boolean;
  reasons: string[];
  restoredCounts: Record<string, number> | null;
  restoreVerified: boolean;
  manifest: BackupManifest | null;
}

/** Restore実行前の事前ゲート(復号・書込みのいずれも行う前に、manifestの内容だけで判定する)。 */
export function evaluateRestorePreflightGates(input: RestoreInput): GuardCheck[] {
  const manifest = input.artifact.manifest;
  return [
    manifest.encrypted ? { ok: true } : { ok: false, reason: "manifestがencrypted=falseのBackupはRestore対象にできない(平文Backup)" },
    manifest.backupStatus === "encrypted"
      ? { ok: true }
      : { ok: false, reason: `Restore可能なbackupStatusではない(現在: ${manifest.backupStatus}、期待: encrypted)` },
    manifest.schemaVersion === input.expectedSchemaVersion
      ? { ok: true }
      : { ok: false, reason: `manifestのschemaVersion(${manifest.schemaVersion})が期待値(${input.expectedSchemaVersion})と一致しない` },
    manifest.postgresMajorVersion === input.expectedPostgresMajorVersion
      ? { ok: true }
      : {
          ok: false,
          reason: `manifestのPostgreSQL major version(${manifest.postgresMajorVersion})がRestore先(${input.expectedPostgresMajorVersion})と一致しない`,
        },
    (SUPPORTED_BACKUP_FORMAT_VERSIONS as readonly string[]).includes(manifest.backupVersion)
      ? { ok: true }
      : { ok: false, reason: "manifestのbackupVersionが未対応の形式" },
    [...manifest.tableAllowlist].sort().join(",") === [...BACKUP_TARGET_TABLES].sort().join(",")
      ? { ok: true }
      : { ok: false, reason: "manifestのtable allowlistが現在の許可リストと一致しない" },
    ...(input.contentPolicy ? evaluateBackupContentPolicy(manifest.rowCounts, input.contentPolicy) : []),
  ];
}

export async function restoreReferenceDataBackup(client: QueryClient, input: RestoreInput): Promise<RestoreResult> {
  const preChecks = evaluateRestorePreflightGates(input);
  const failed = preChecks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { ok: false, reasons: failed.map((c) => c.reason ?? "理由不明"), restoredCounts: null, restoreVerified: false, manifest: null };
  }

  const manifest = input.artifact.manifest;
  // 形式の版ごとの列集合で検証・復元する(旧形式"1"のBackupも、その列集合のまま再一致を確認する)。
  const formatVersion = assertBackupFormatVersion(manifest.backupVersion);

  let payload: BackupPayload;
  try {
    const plaintext = await input.decryptor.decrypt(input.artifact.encryptedPayload);
    payload = JSON.parse(plaintext.toString("utf8")) as BackupPayload;
  } catch (err) {
    return {
      ok: false,
      reasons: [`復号または解析に失敗(改ざん・不完全なファイル・誤った鍵の可能性): ${sanitizeErrorMessage(err instanceof Error ? err.message : String(err))}`],
      restoredCounts: null,
      restoreVerified: false,
      manifest: markManifestFailed(manifest),
    };
  }

  // manifestとpayloadのテーブル集合が一致することを、書込み前に確認する(欠落・想定外テーブルの検出)。
  const payloadTables = Object.keys(payload.tables).sort();
  const manifestTables = [...manifest.tableAllowlist].sort();
  if (payloadTables.length !== manifestTables.length || payloadTables.some((t, i) => t !== manifestTables[i])) {
    return {
      ok: false,
      reasons: [`Backup本体のテーブル集合がmanifestと一致しない(manifest: ${manifestTables.join(",")} / 実体: ${payloadTables.join(",")})`],
      restoredCounts: null,
      restoreVerified: false,
      manifest: markManifestFailed(manifest),
    };
  }

  // 書込み前に、Backup前checksumとの完全一致を確認する(1件でも異なれば不合格、この時点ではRestore先へ一切書き込んでいない)。
  const recomputedTableChecksums: Record<string, string> = {};
  const sourceMetaEntries: BackupSourceMetadataEntry[] = [];
  for (const table of manifestTables) {
    const rows = payload.tables[table] ?? [];
    const spec = getBackupTableSpec(table, formatVersion);
    const withIds = rows.map((r) => ({ id: String(r[spec.primaryKey]), fields: r }));
    recomputedTableChecksums[table] = computeBackupTableChecksum(withIds);
    sourceMetaEntries.push({ tableName: table, sourceDatasetPairs: deriveSourceDatasetPairs(rows) });

    if (rows.length !== manifest.rowCounts[table]) {
      return {
        ok: false,
        reasons: [`${table}の件数がmanifestと一致しない(manifest: ${manifest.rowCounts[table]}, 実体: ${rows.length})`],
        restoredCounts: null,
        restoreVerified: false,
        manifest: markManifestFailed(manifest),
      };
    }
    if (recomputedTableChecksums[table] !== manifest.tableChecksums[table]) {
      return {
        ok: false,
        reasons: [`${table}のchecksumがmanifestと一致しない(改ざんまたは破損の疑い)`],
        restoredCounts: null,
        restoreVerified: false,
        manifest: markManifestFailed(manifest),
      };
    }
  }
  const recomputedTotal = computeBackupTotalChecksum(recomputedTableChecksums);
  if (recomputedTotal !== manifest.totalChecksum) {
    return {
      ok: false,
      reasons: ["total checksumがmanifestと一致しない(改ざんまたは破損の疑い)"],
      restoredCounts: null,
      restoreVerified: false,
      manifest: markManifestFailed(manifest),
    };
  }
  const recomputedSourceMeta = computeSourceMetadataChecksum(sourceMetaEntries);
  if (recomputedSourceMeta !== manifest.sourceMetadataChecksum) {
    return {
      ok: false,
      reasons: ["source metadata checksumがmanifestと一致しない(改ざんまたは破損の疑い)"],
      restoredCounts: null,
      restoreVerified: false,
      manifest: markManifestFailed(manifest),
    };
  }

  // ここまで全検証に合格した場合だけ、隔離Restore先schemaへ書き込む。
  try {
    await client.query("begin");
    await client.query(buildBackupTruncateAllRestoreTargetsSql());
    const restoredCounts: Record<string, number> = {};
    for (const table of INSERT_ORDER) {
      const spec = getBackupTableSpec(table, formatVersion);
      const rows = payload.tables[table] ?? [];
      restoredCounts[table] = rows.length;
      if (rows.length === 0) continue;
      for (const chunk of chunkRows(rows, 500)) {
        const sql = buildBackupRestoreInsertSql(table, chunk.length, formatVersion);
        const params = chunk.flatMap((r) => mapBackupFieldsToParams(spec, r));
        await client.query(sql, params);
      }
    }
    await client.query("commit");

    // Restore後checksum: 別の空schemaへ実際に書き込んだ結果を読み戻し、Backup前と再一致することを確認する。
    for (const table of manifestTables) {
      const spec = getBackupTableSpec(table, formatVersion);
      const readback = await client.query(buildBackupDumpSelectSql(BACKUP_RESTORE_TEST_SCHEMA, table, formatVersion));
      if (!readback || !Array.isArray(readback.rows)) {
        throw new Error(`${table}のRestore後読み戻し結果にrows配列が無い(想定外のresult shape)`);
      }
      const rows = readback.rows.map((r) => toPortableBackupRow(spec, r));
      if (rows.length !== manifest.rowCounts[table]) {
        return {
          ok: false,
          reasons: [`${table}のRestore後の行数がmanifestと一致しない(manifest: ${manifest.rowCounts[table]}, 読み戻し: ${rows.length})`],
          restoredCounts,
          restoreVerified: false,
          manifest: markManifestFailed(manifest),
        };
      }
      const withIds = rows.map((r) => ({ id: String(r[spec.primaryKey]), fields: r }));
      const afterChecksum = computeBackupTableChecksum(withIds);
      if (afterChecksum !== manifest.tableChecksums[table]) {
        return {
          ok: false,
          reasons: [`${table}のRestore後checksumがBackup前と一致しない(書込み経路の不具合の可能性)`],
          restoredCounts,
          restoreVerified: false,
          manifest: markManifestFailed(manifest),
        };
      }
    }

    return { ok: true, reasons: [], restoredCounts, restoreVerified: true, manifest: markManifestRestoreVerified(manifest) };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    return {
      ok: false,
      reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))],
      restoredCounts: null,
      restoreVerified: false,
      manifest: markManifestFailed(manifest),
    };
  }
}
