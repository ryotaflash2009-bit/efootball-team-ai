import { sanitizeErrorMessage, type GuardCheck } from "../real-import-guards";
import { BACKUP_TARGET_TABLES, checkBackupTargetSetExact } from "./backup-target";
import { BACKUP_SOURCE_TEST_SCHEMA, getBackupTableSpec } from "./backup-schema";
import { buildBackupDumpSelectSql, toPortableBackupRow } from "./backup-sql";
import { computeBackupTableChecksum, computeBackupTotalChecksum, computeSourceMetadataChecksum, deriveSourceDatasetPairs, type BackupSourceMetadataEntry } from "./backup-checksum";
import { buildBackupManifest, markManifestEncrypted, assertManifestHasNoSecrets, type BackupManifest } from "./backup-manifest";
import type { BackupEncryptor } from "./backup-encryptor";
import type { QueryClient } from "./apply-orchestrator";

/**
 * Production書込み(Promotion apply)前の、参照データ4テーブル専用のfull-table Backup。
 *
 * 既存の`promotion_before_snapshots`(行単位のbefore snapshot、特定job・特定行だけを正確に
 * 戻すためのもの、[[reference-data-backup-decision.md]]で確定済み)とは別物であり、
 * 「テーブル全体の取得時点の複製」を目的とする、より粗い粒度の安全網である。両者は
 * 排他ではなく併用する(このファイルは全体Backup側だけを担当する)。
 *
 * `client`は`QueryClient`(`apply-orchestrator.ts`と同一、`pg`/`node:sqlite`いずれとも互換の
 * 最小interface)だけに依存し、実Supabase/実Productionへの接続コードは含まない。
 * このセッションで実際に読み書きするのは、隔離PostgreSQL専用の
 * `${BACKUP_SOURCE_TEST_SCHEMA}`だけである(実`reference_data`ではない)。
 */

export interface BackupTableDump {
  table: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  checksum: string;
}

export interface CreateBackupInput {
  jobId: string;
  schemaVersion: string;
  applicationCommitSha: string;
  now: Date;
  postgresMajorVersion: number;
  retentionCategory: BackupManifest["retentionCategory"];
  retentionDays: number;
  encryptor: BackupEncryptor;
  backupVersion?: string;
}

export interface BackupPayload {
  jobId: string;
  createdAt: string;
  tables: Readonly<Record<string, readonly Record<string, unknown>[]>>;
}

export interface BackupArtifact {
  manifest: BackupManifest;
  encryptedPayload: Buffer;
}

export interface CreateBackupResult {
  ok: boolean;
  reasons: string[];
  artifact: BackupArtifact | null;
}

/** Backup実行前の事前ゲート(接続前に純関数だけで判定する)。 */
export function evaluateBackupPreflightGates(input: Pick<CreateBackupInput, "postgresMajorVersion" | "retentionDays" | "encryptor">): GuardCheck[] {
  return [
    checkBackupTargetSetExact([...BACKUP_TARGET_TABLES]),
    Number.isInteger(input.postgresMajorVersion) && input.postgresMajorVersion > 0
      ? { ok: true }
      : { ok: false, reason: "PostgreSQL major versionが不明、またはBackupを続行できない値" },
    input.retentionDays > 0 ? { ok: true } : { ok: false, reason: "retentionDaysは1以上である必要がある" },
    input.encryptor ? { ok: true } : { ok: false, reason: "encryptorが指定されていない(平文Backupは許可しない)" },
  ];
}

/** 対象4テーブルを、隔離schema(`BACKUP_SOURCE_TEST_SCHEMA`)から順に読み出す(SELECT *は使わない)。 */
export async function dumpBackupTables(client: QueryClient): Promise<BackupTableDump[]> {
  const dumps: BackupTableDump[] = [];
  for (const table of BACKUP_TARGET_TABLES) {
    const spec = getBackupTableSpec(table);
    const sql = buildBackupDumpSelectSql(BACKUP_SOURCE_TEST_SCHEMA, table);
    const result = await client.query(sql);
    const rows = result.rows.map((r) => toPortableBackupRow(spec, r));
    const withIds = rows.map((r) => ({ id: String(r[spec.primaryKey]), fields: r }));
    const checksum = computeBackupTableChecksum(withIds);
    dumps.push({ table, rows, rowCount: rows.length, checksum });
  }
  return dumps;
}

export async function createReferenceDataBackup(client: QueryClient, input: CreateBackupInput): Promise<CreateBackupResult> {
  const preChecks = evaluateBackupPreflightGates(input);
  const failed = preChecks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { ok: false, reasons: failed.map((c) => c.reason ?? "理由不明"), artifact: null };
  }

  try {
    const dumps = await dumpBackupTables(client);

    const rowCounts: Record<string, number> = {};
    const tableChecksums: Record<string, string> = {};
    const tables: Record<string, Record<string, unknown>[]> = {};
    const sourceMetaEntries: BackupSourceMetadataEntry[] = [];
    for (const d of dumps) {
      rowCounts[d.table] = d.rowCount;
      tableChecksums[d.table] = d.checksum;
      tables[d.table] = d.rows;
      sourceMetaEntries.push({ tableName: d.table, sourceDatasetPairs: deriveSourceDatasetPairs(d.rows) });
    }
    const totalChecksum = computeBackupTotalChecksum(tableChecksums);
    const sourceMetadataChecksum = computeSourceMetadataChecksum(sourceMetaEntries);

    const nowIso = input.now.toISOString();
    const expiresAt = new Date(input.now.getTime() + input.retentionDays * 24 * 60 * 60 * 1000).toISOString();

    let manifest = buildBackupManifest({
      backupVersion: input.backupVersion ?? "1",
      schemaVersion: input.schemaVersion,
      jobId: input.jobId,
      createdAt: nowIso,
      postgresMajorVersion: input.postgresMajorVersion,
      tableAllowlist: [...BACKUP_TARGET_TABLES],
      rowCounts,
      tableChecksums,
      totalChecksum,
      sourceMetadataChecksum,
      compression: "none",
      encryptionAlgorithm: input.encryptor.algorithmId,
      retentionCategory: input.retentionCategory,
      expiresAt,
      applicationCommitSha: input.applicationCommitSha,
    });

    const secretCheck = assertManifestHasNoSecrets(manifest as unknown as Record<string, unknown>);
    if (!secretCheck.ok) {
      return { ok: false, reasons: [secretCheck.reason ?? "manifestに秘密情報の疑いがある値が含まれている"], artifact: null };
    }

    const payload: BackupPayload = { jobId: input.jobId, createdAt: nowIso, tables };
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const encryptedPayload = await input.encryptor.encrypt(plaintext);
    manifest = markManifestEncrypted(manifest);

    return { ok: true, reasons: [], artifact: { manifest, encryptedPayload } };
  } catch (err) {
    return { ok: false, reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))], artifact: null };
  }
}
