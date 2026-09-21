import { sanitizeErrorMessage } from "../real-import-guards";
import type { QueryClient } from "./apply-orchestrator";
import { createReferenceDataBackup, type CreateBackupInput } from "./backup-orchestrator";
import { restoreReferenceDataBackup } from "./backup-restore";
import { NodeAesGcmEncryptor, generateEphemeralTestKey, type BackupEncryptor } from "./backup-encryptor";
import { AgeCliEncryptor } from "./backup-age-cli-encryptor";
import type { R2Client } from "./backup-r2-client";
import { putEncryptedBackup, computeSha256Hex, type PutEncryptedBackupResult } from "./backup-r2-adapter";
import type { BackupObjectPrefix } from "./backup-r2-target";
import { markManifestRestoreVerified, type BackupManifest } from "./backup-manifest";
import { PRODUCTION_REFERENCE_DATA_SCHEMA, BACKUP_RESTORE_TEST_SCHEMA, buildBackupIsolatedSchemaDdl } from "./backup-schema";

/**
 * Production reference-data Backupの実行オーケストレーション(design-onlyから実行可能へ)。
 *
 * このファイルはGitHub Actions runner上で、`reference-data-production-backup.yml`の
 * job(`production-backup-approval` Environment承認後、6 Secretすべて設定済みの場合)
 * だけから呼び出される想定。**このセッションでは一度も実行していない**(Production未接続、
 * R2未接続)。
 *
 * ## `restoreVerified`をどう安全に成立させるか(このファイルの核心的な設計判断)
 *
 * `evaluatePutEncryptedBackupGates`(既存、`backup-r2-adapter.ts`)は
 * `manifest.restoreVerified === true`をuploadの必須条件にしている。しかし、実際に
 * アップロードする暗号化payloadは本人のage**秘密鍵**でしか復号できず、その秘密鍵は
 * 本人のPCだけにあり、GitHub Actionsには一切渡らない。したがって「今まさにアップロード
 * しようとしているこの暗号化ファイルそのもの」を、このjobの中で実際に復号して
 * Restore検証することは構造的に不可能であり、これを試みるべきでもない
 * (可能にするには秘密鍵をCIへ渡す必要があり、設計そのものを破壊する)。
 *
 * 代わりに、このファイルは**同じ抽出データ(同一checksum)を、使い捨ての
 * ephemeral鍵で別途暗号化した「検証専用artifact」を作り、それを実際に
 * 別の隔離PostgreSQL(このjob専用のservice container、Productionではない)へ
 * Restoreして、Restore後checksumが一致することを確認する**。この検証専用artifactは
 * どこへもアップロードせず、ephemeral鍵はjobの実行中しかメモリ上に存在しない
 * (GitHub Secretsへ保存しない、ログへ出力しない)。実際にuploadする本番artifactは、
 * 最初から最後まで本人の実age recipientだけで暗号化されたまま変更しない。
 *
 * 検証artifactの抽出は、本番artifactの抽出とは**別のSELECT**になる(read-only role・
 * 同一のProduction接続を再利用する)。2回の抽出結果のtotalChecksumが一致することを
 * 事前に確認してから検証へ進むため、抽出window中にProduction側でデータが変わった
 * 場合は、安全側(検証不一致としてblocked)に倒れる。
 */

export interface RunProductionBackupInput {
  /** Production `reference_data`への読み出し専用接続(read-only role)。 */
  prodClient: QueryClient;
  /** このjob専用の隔離PostgreSQL(service container)への接続。Restore検証の書込み先。Productionではない。 */
  verifyClient: QueryClient;
  r2Client: R2Client;
  /** age公開鍵(recipient)。Secretから取得した値をそのまま渡す(このファイルは値を検証しない、AgeCliEncryptorが検証する)。 */
  ageRecipient: string;
  /** 実行するコマンド。既定は["age"](実バイナリ)。テストではfakeスクリプトを注入する。 */
  ageCommand?: string[];
  jobId: string;
  now: Date;
  schemaVersion: string;
  postgresMajorVersion: number;
  applicationCommitSha: string;
  retentionCategory: BackupManifest["retentionCategory"];
  retentionDays: number;
  prefix: BackupObjectPrefix;
}

export interface RunProductionBackupResult {
  ok: boolean;
  reasons: string[];
  /** secretを含まない、監査用summary(ログ・PR・チャットへそのまま出力してよい)。 */
  summary: Readonly<Record<string, unknown>>;
}

function utcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function runProductionBackup(input: RunProductionBackupInput): Promise<RunProductionBackupResult> {
  const baseInput: Omit<CreateBackupInput, "encryptor"> = {
    jobId: input.jobId,
    schemaVersion: input.schemaVersion,
    applicationCommitSha: input.applicationCommitSha,
    now: input.now,
    postgresMajorVersion: input.postgresMajorVersion,
    retentionCategory: input.retentionCategory,
    retentionDays: input.retentionDays,
    sourceSchema: PRODUCTION_REFERENCE_DATA_SCHEMA,
  };

  // 1. 本番artifact: 実age recipientで暗号化する(これが最終的にR2へuploadされる)。
  const realEncryptor: BackupEncryptor = new AgeCliEncryptor({ recipient: input.ageRecipient, ageCommand: input.ageCommand });
  const realResult = await createReferenceDataBackup(input.prodClient, { ...baseInput, encryptor: realEncryptor });
  if (!realResult.ok || !realResult.artifact) {
    return { ok: false, reasons: realResult.reasons, summary: { phase: "export", ok: false, reasons: realResult.reasons } };
  }

  // 2. 検証専用artifact: 使い捨てephemeral鍵で別途暗号化する(uploadしない、jobの外へ一切出さない)。
  const ephemeralKey = generateEphemeralTestKey();
  const verifyEncryptor: BackupEncryptor = new NodeAesGcmEncryptor(ephemeralKey);
  const verifyResult = await createReferenceDataBackup(input.prodClient, { ...baseInput, encryptor: verifyEncryptor });
  if (!verifyResult.ok || !verifyResult.artifact) {
    return { ok: false, reasons: verifyResult.reasons, summary: { phase: "export-for-verification", ok: false, reasons: verifyResult.reasons } };
  }

  // 3. 2回の抽出が同一データであることを確認する(抽出window中の書込みを検出する安全側の設計)。
  if (realResult.artifact.manifest.totalChecksum !== verifyResult.artifact.manifest.totalChecksum) {
    return {
      ok: false,
      reasons: ["本番artifactと検証artifactのtotalChecksumが一致しない(抽出window中にProduction側でデータが変わった可能性、安全側でblocked)"],
      summary: { phase: "checksum-consistency", ok: false },
    };
  }

  // 4. 検証専用artifactだけを、このjob専用の隔離PostgreSQLへ実際にRestoreする。
  try {
    await input.verifyClient.query(buildBackupIsolatedSchemaDdl(BACKUP_RESTORE_TEST_SCHEMA));
  } catch (err) {
    return {
      ok: false,
      reasons: [`隔離Restore検証schemaの準備に失敗した: ${sanitizeErrorMessage(err instanceof Error ? err.message : String(err))}`],
      summary: { phase: "verify-schema-setup", ok: false },
    };
  }

  const restoreResult = await restoreReferenceDataBackup(input.verifyClient, {
    artifact: verifyResult.artifact,
    decryptor: verifyEncryptor,
    expectedSchemaVersion: input.schemaVersion,
    expectedPostgresMajorVersion: input.postgresMajorVersion,
    now: input.now,
  });
  if (!restoreResult.ok || !restoreResult.restoreVerified) {
    return {
      ok: false,
      reasons: restoreResult.reasons.length > 0 ? restoreResult.reasons : ["隔離Restore検証に失敗した(restoreVerified=false)"],
      summary: { phase: "isolated-restore-verification", ok: false, reasons: restoreResult.reasons },
    };
  }

  // 5. 隔離Restore検証に成功した場合だけ、本番artifact(実recipientで暗号化済み)のmanifestへ
  //    restoreVerified=trueを反映する。暗号化payload自体(encryptedPayload)は一切変更しない。
  const verifiedManifest = markManifestRestoreVerified(realResult.artifact.manifest);
  const localEncryptedChecksum = computeSha256Hex(realResult.artifact.encryptedPayload);

  // 6. upload前ゲート評価→R2 upload→upload後checksum検証(すべて既存のbackup-r2-adapter.tsを再利用)。
  const putResult: PutEncryptedBackupResult = await putEncryptedBackup(input.r2Client, {
    manifest: verifiedManifest,
    encryptedPayload: realResult.artifact.encryptedPayload,
    localEncryptedChecksum,
    prefix: input.prefix,
    jobId: input.jobId,
    utcDate: utcDateString(input.now),
  });

  const summary = {
    phase: "upload",
    ok: putResult.ok,
    storageVerified: putResult.storageVerified,
    objectKey: putResult.objectKey,
    manifestKey: putResult.manifestKey,
    jobId: input.jobId,
    prefix: input.prefix,
    rowCounts: verifiedManifest.rowCounts,
    totalChecksum: verifiedManifest.totalChecksum,
    restoreVerified: verifiedManifest.restoreVerified,
    encryptionAlgorithm: verifiedManifest.encryptionAlgorithm,
  } as const;

  if (!putResult.ok) {
    return { ok: false, reasons: putResult.reasons, summary: { ...summary, reasons: putResult.reasons } };
  }
  return { ok: true, reasons: [], summary };
}
