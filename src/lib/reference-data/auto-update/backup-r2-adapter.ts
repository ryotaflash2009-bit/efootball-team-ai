import { createHash } from "node:crypto";
import { evaluateBackupContentPolicy, PRODUCTION_BACKUP_CONTENT_POLICY } from "./backup-content-policy";
import type { GuardCheck } from "../real-import-guards";
import type { R2Client } from "./backup-r2-client";
import { BACKUP_OBJECT_PREFIXES, NO_AUTO_DELETE_PREFIXES, buildEncryptedPayloadKey, buildManifestKey, checkObjectPrefixAllowed, checkObjectKeyWellFormed, type BackupObjectPrefix } from "./backup-r2-target";
import { assertManifestHasNoSecrets, type BackupManifest } from "./backup-manifest";
import { BACKUP_TARGET_TABLES } from "./backup-target";

/**
 * Cloudflare R2(Backup保管先)向けのStorage adapter。
 *
 * Production runtimeからは一切参照しない設計(`src/app`/`src/components`から
 * importしない、API endpoint・Route Handler・Server Action・UI導線を作らない)。
 * このセッションでは実R2への接続コードを一切実装しない(`R2Client`は
 * interfaceのみ、実装は将来の別作業)。
 *
 * checksumのmetadata key名(`sha256`)を固定し、ETagだけを完全性の唯一の根拠に
 * しない設計にしている(ETagはS3/R2実装依存でmulti-part uploadの場合など
 * 単純なMD5にならないことがあるため、アプリ側で計算したsha256を必ず
 * 独立した検証根拠として保持する)。
 */

const CHECKSUM_METADATA_KEY = "sha256";

export function computeSha256Hex(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export interface PutEncryptedBackupInput {
  manifest: BackupManifest;
  encryptedPayload: Buffer;
  /** 呼び出し側(Backup orchestrator)が暗号化直後に計算した、暗号化済みpayloadのsha256。 */
  localEncryptedChecksum: string;
  prefix: BackupObjectPrefix;
  jobId: string;
  utcDate: string;
}

export interface PutEncryptedBackupResult {
  ok: boolean;
  reasons: string[];
  objectKey: string | null;
  manifestKey: string | null;
  storageVerified: boolean;
}

/** upload前に純関数だけで判定できるゲート(manifest内容・prefix・checksum形式)。 */
export function evaluatePutEncryptedBackupGates(input: PutEncryptedBackupInput): GuardCheck[] {
  const checks: GuardCheck[] = [];

  checks.push(
    input.manifest.encrypted ? { ok: true } : { ok: false, reason: "manifest.encryptedがfalse(平文Backupのupload禁止)" },
  );
  checks.push(
    input.manifest.restoreVerified
      ? { ok: true }
      : { ok: false, reason: "manifest.restoreVerifiedがfalse(Restore未検証のBackupはR2へuploadしない)" },
  );
  checks.push(
    input.manifest.backupStatus === "restore_verified"
      ? { ok: true }
      : { ok: false, reason: `manifest.backupStatusがrestore_verifiedではない(現在: ${input.manifest.backupStatus})` },
  );
  // 暗号化・Restore検証・checksumの成功は内容の正しさを保証しない(workflow Run #6の
  // 空Backup)。R2へ保存するBackupは、呼び出し側の指定に依らず常にProductionの
  // 内容妥当性policyを満たす必要がある(このゲートは弱められない)。
  checks.push(...evaluateBackupContentPolicy(input.manifest.rowCounts, PRODUCTION_BACKUP_CONTENT_POLICY));

  const allowlist = [...BACKUP_TARGET_TABLES].sort();
  const declared = [...input.manifest.tableAllowlist].sort();
  checks.push(
    allowlist.length === declared.length && allowlist.every((t, i) => t === declared[i])
      ? { ok: true }
      : { ok: false, reason: "manifestのtable allowlistが現在の許可リストと一致しない" },
  );

  const secretCheck = assertManifestHasNoSecrets(input.manifest as unknown as Record<string, unknown>);
  checks.push(secretCheck.ok ? { ok: true } : { ok: false, reason: `manifestに秘密情報の疑いがある値が含まれている: ${secretCheck.reason}` });

  checks.push(checkObjectPrefixAllowed(input.prefix));

  checks.push(
    /^[0-9a-f]{64}$/i.test(input.localEncryptedChecksum)
      ? { ok: true }
      : { ok: false, reason: "localEncryptedChecksumがsha256 hex形式ではない" },
  );

  checks.push(
    input.encryptedPayload.length > 0 ? { ok: true } : { ok: false, reason: "encryptedPayloadが空(平文相当・不正な入力の疑い)" },
  );

  // 呼び出し側が計算したchecksumが、実際のpayloadと一致することを、upload前に確認する
  // (呼び出し側の計算ミス・古い値の使い回しを検出する)。
  const actualChecksum = computeSha256Hex(input.encryptedPayload);
  checks.push(
    actualChecksum === input.localEncryptedChecksum.toLowerCase()
      ? { ok: true }
      : { ok: false, reason: "localEncryptedChecksumが実際のencryptedPayloadのsha256と一致しない" },
  );

  return checks;
}

/**
 * 暗号化済みBackup(および、その秘密情報を含まないmanifest)をR2へuploadする。
 *
 * 手順: 事前ゲート → 対象keyに既存objectが無いことを確認(上書き・重複拒否) →
 * upload(checksumをmetadataへ埋め込む) → HEADで読み戻し、size・metadata上のchecksumが
 * 一致することを確認 → 一致しなければstorageVerified=falseのまま返す
 * (自動削除・再upload・上書きは一切行わない)。
 */
export async function putEncryptedBackup(client: R2Client, input: PutEncryptedBackupInput): Promise<PutEncryptedBackupResult> {
  const preChecks = evaluatePutEncryptedBackupGates(input);
  const failed = preChecks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { ok: false, reasons: failed.map((c) => c.reason ?? "理由不明"), objectKey: null, manifestKey: null, storageVerified: false };
  }

  const keyInput = { prefix: input.prefix, utcDate: input.utcDate, jobId: input.jobId, datasetChecksumShort: input.localEncryptedChecksum.slice(0, 12) };
  let objectKey: string;
  let manifestKey: string;
  try {
    objectKey = buildEncryptedPayloadKey(keyInput);
    manifestKey = buildManifestKey(keyInput);
  } catch (err) {
    return { ok: false, reasons: [err instanceof Error ? err.message : String(err)], objectKey: null, manifestKey: null, storageVerified: false };
  }

  const keyCheck = checkObjectKeyWellFormed(objectKey);
  if (!keyCheck.ok) {
    return { ok: false, reasons: [keyCheck.reason ?? "object keyが不正"], objectKey: null, manifestKey: null, storageVerified: false };
  }

  // 重複・上書き拒否: 対象keyに既にobjectが存在する場合は、内容を確認せず即座に拒否する
  // (同一checksumのBackupを再uploadする状況は正常系では発生しない設計のため)。
  const existing = await client.headObject(objectKey);
  if (existing !== null) {
    return { ok: false, reasons: [`object keyは既に存在する(重複・上書き拒否): ${objectKey}`], objectKey: null, manifestKey: null, storageVerified: false };
  }
  const existingManifest = await client.headObject(manifestKey);
  if (existingManifest !== null) {
    return { ok: false, reasons: [`manifest keyは既に存在する(重複・上書き拒否): ${manifestKey}`], objectKey: null, manifestKey: null, storageVerified: false };
  }

  await client.putObject({
    key: objectKey,
    body: input.encryptedPayload,
    metadata: { [CHECKSUM_METADATA_KEY]: input.localEncryptedChecksum, jobId: input.jobId },
  });

  const manifestJson = Buffer.from(JSON.stringify(input.manifest), "utf8");
  const manifestChecksum = computeSha256Hex(manifestJson);
  await client.putObject({
    key: manifestKey,
    body: manifestJson,
    metadata: { [CHECKSUM_METADATA_KEY]: manifestChecksum, jobId: input.jobId },
  });

  // upload後の確認: ETagだけに頼らず、サイズとmetadata上のchecksumを独立して確認する。
  const verifyResult = await verifyRemoteChecksum(client, objectKey, input.localEncryptedChecksum, input.encryptedPayload.length);
  if (!verifyResult.ok) {
    return { ok: false, reasons: verifyResult.reasons, objectKey, manifestKey, storageVerified: false };
  }

  return { ok: true, reasons: [], objectKey, manifestKey, storageVerified: true };
}

export interface VerifyRemoteChecksumResult {
  ok: boolean;
  reasons: string[];
}

/** upload済みobjectのHEAD結果から、サイズとchecksum metadataの両方を独立して確認する(ETag単独に依存しない)。 */
export async function verifyRemoteChecksum(
  client: R2Client,
  objectKey: string,
  expectedChecksum: string,
  expectedSize: number,
): Promise<VerifyRemoteChecksumResult> {
  const head = await client.headObject(objectKey);
  if (head === null) {
    return { ok: false, reasons: [`object keyが見つからない: ${objectKey}`] };
  }
  const reasons: string[] = [];
  if (head.size !== expectedSize) {
    reasons.push(`remote object sizeが一致しない(expected: ${expectedSize}, actual: ${head.size})`);
  }
  const remoteChecksum = head.metadata[CHECKSUM_METADATA_KEY];
  if (remoteChecksum !== expectedChecksum) {
    reasons.push("remote checksum metadataが一致しない");
  }
  return { ok: reasons.length === 0, reasons };
}

export interface HeadEncryptedBackupResult {
  exists: boolean;
  size: number | null;
  checksum: string | null;
}

/** sanitizeされたHEAD結果だけを返す(生のmetadataを丸ごと露出しない)。 */
export async function headEncryptedBackup(client: R2Client, objectKey: string): Promise<HeadEncryptedBackupResult> {
  const keyCheck = checkObjectKeyWellFormed(objectKey);
  if (!keyCheck.ok) throw new Error(keyCheck.reason);
  const head = await client.headObject(objectKey);
  if (head === null) return { exists: false, size: null, checksum: null };
  return { exists: true, size: head.size, checksum: head.metadata[CHECKSUM_METADATA_KEY] ?? null };
}

export interface GetEncryptedBackupResult {
  ok: boolean;
  reasons: string[];
  payload: Buffer | null;
}

/**
 * 隔離Restore試験専用のダウンロード。ダウンロード直後にchecksumを再計算し、
 * 期待値と一致しない限り呼び出し元へpayloadを一切返さない(改ざん・破損の
 * まま復号を試みることを防ぐ)。
 */
export async function getEncryptedBackupForIsolatedRestore(
  client: R2Client,
  objectKey: string,
  expectedChecksum: string,
): Promise<GetEncryptedBackupResult> {
  const keyCheck = checkObjectKeyWellFormed(objectKey);
  if (!keyCheck.ok) return { ok: false, reasons: [keyCheck.reason ?? "object keyが不正"], payload: null };

  const body = await client.getObject(objectKey);
  if (body === null) return { ok: false, reasons: [`object keyが見つからない: ${objectKey}`], payload: null };

  const actualChecksum = computeSha256Hex(body);
  if (actualChecksum !== expectedChecksum.toLowerCase()) {
    return { ok: false, reasons: ["ダウンロードしたpayloadのchecksumが期待値と一致しない(改ざん・破損の疑い)"], payload: null };
  }
  return { ok: true, reasons: [], payload: body };
}

export interface BackupManifestListEntry {
  manifestKey: string;
  manifest: BackupManifest;
}

/** 対象prefix配下のmanifest(.manifest.json)一覧を取得する。暗号化payload自体は取得しない。 */
export async function listBackupManifests(client: R2Client, prefix: BackupObjectPrefix): Promise<BackupManifestListEntry[]> {
  const prefixCheck = checkObjectPrefixAllowed(prefix);
  if (!prefixCheck.ok) throw new Error(prefixCheck.reason);

  const summaries = await client.listObjects(prefix);
  const manifestSummaries = summaries.filter((s) => s.key.endsWith(".manifest.json"));
  const entries: BackupManifestListEntry[] = [];
  for (const s of manifestSummaries) {
    const body = await client.getObject(s.key);
    if (body === null) continue;
    try {
      const manifest = JSON.parse(body.toString("utf8")) as BackupManifest;
      entries.push({ manifestKey: s.key, manifest });
    } catch {
      // 破損したmanifestはリストから除外する(一覧取得自体を失敗させない)。
      continue;
    }
  }
  return entries;
}

export interface DeleteExpiredBackupInput {
  objectKey: string;
  manifestKey: string;
  manifest: BackupManifest;
  now: Date;
}

export interface DeleteExpiredBackupResult {
  ok: boolean;
  reasons: string[];
}

/**
 * 期限切れBackupの手動削除(R2側のLifecycle Ruleが自動処理する日常運用とは別の、
 * 例外的な手動削除専用)。`pre-apply/`(自動削除しない方針のprefix)と、
 * `expiresAt`が未到来のobjectは拒否する。
 */
export async function deleteExpiredBackup(client: R2Client, input: DeleteExpiredBackupInput): Promise<DeleteExpiredBackupResult> {
  const prefixCheck = BACKUP_OBJECT_PREFIXES.find((p) => input.objectKey.startsWith(p));
  if (!prefixCheck) {
    return { ok: false, reasons: [`許可されていないprefixのobjectは削除できない: ${input.objectKey}`] };
  }
  if ((NO_AUTO_DELETE_PREFIXES as readonly string[]).includes(prefixCheck)) {
    return { ok: false, reasons: [`${prefixCheck}は自動削除対象外のprefixのため、この関数では削除できない`] };
  }
  // manifest.expiresAtがnull(例: pre-apply)の場合、`new Date(null)`はUnix epoch(1970年)を
  // 返してしまい、誤って「とっくに期限切れ」と判定される恐れがあるため、nullを明示的に
  // 「削除対象外」として拒否する(上のprefix判定で通常は先に拒否されるが、直接呼び出された
  // 場合の多層防御として、0や過去の日付への読み替えは一切行わない)。
  if (input.manifest.expiresAt === null) {
    return { ok: false, reasons: ["manifest.expiresAtがnull(自動削除対象外のBackup)、この関数では削除できない"] };
  }
  const expiresAt = new Date(input.manifest.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > input.now.getTime()) {
    return { ok: false, reasons: ["manifest.expiresAtが未到来(期限切れではない)、削除を拒否する"] };
  }
  await client.deleteObject(input.objectKey);
  await client.deleteObject(input.manifestKey);
  return { ok: true, reasons: [] };
}
