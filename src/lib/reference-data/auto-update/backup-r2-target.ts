import type { GuardCheck } from "../real-import-guards";

/**
 * Cloudflare R2(Backup保管先)向けの、object prefix allowlistとobject key組み立て。
 *
 * Bucket名自体はこのモジュール(コード)には一切含めない。実Bucket名は
 * `REFERENCE_DATA_BACKUP_R2_BUCKET` Secretからのみ渡される想定で、このファイルは
 * その値を検証するだけで、直書きしない([[reference-data-production-backup-r2-adapter.md]]参照)。
 */

export const BACKUP_OBJECT_PREFIXES = ["daily/", "weekly/", "monthly/", "pre-apply/"] as const;
export type BackupObjectPrefix = (typeof BACKUP_OBJECT_PREFIXES)[number];

/** retention自動削除の対象外(R2側にlifecycle ruleを設定しない)prefix。 */
export const NO_AUTO_DELETE_PREFIXES: readonly BackupObjectPrefix[] = ["pre-apply/"];

export function checkObjectPrefixAllowed(prefix: string): GuardCheck {
  if (!(BACKUP_OBJECT_PREFIXES as readonly string[]).includes(prefix)) {
    return { ok: false, reason: `許可されていないobject prefix: ${prefix}` };
  }
  return { ok: true };
}

const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]{1,128}$/;
const UTC_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** jobId・dataset checksum短縮値などのkey構成要素が、安全な文字集合だけで構成されていることを確認する。 */
export function checkSafeKeySegment(segment: string, label: string): GuardCheck {
  if (segment.includes("..") || segment.includes("/") || segment.includes("\\")) {
    return { ok: false, reason: `${label}にpath traversalらしき文字列が含まれている: ${segment}` };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(segment)) {
    return { ok: false, reason: `${label}に制御文字が含まれている` };
  }
  if (!SAFE_SEGMENT_RE.test(segment)) {
    return { ok: false, reason: `${label}が許可された文字集合(英数字・ハイフン・アンダースコア)以外を含む、または空/長すぎる: ${label}=${segment}` };
  }
  return { ok: true };
}

export interface BuildObjectKeyInput {
  prefix: BackupObjectPrefix;
  utcDate: string; // YYYY-MM-DD
  jobId: string;
  datasetChecksumShort: string;
}

/**
 * 決定的で秘密情報を含まないobject keyを組み立てる。
 * 形式: `<prefix><utcDate>/<jobId>/<datasetChecksumShort>`
 * (呼び出し側が`.age`/`.manifest.json`拡張子を付与する)。
 *
 * email・Project ID・database名・username・接続文字列・source URL・user IDは
 * この関数の入力にもそもそも含まれない設計(呼び出し元がjobId・checksum
 * 短縮値以外を渡せない型シグネチャにしている)。
 */
export function buildBackupObjectKeyBase(input: BuildObjectKeyInput): string {
  const prefixCheck = checkObjectPrefixAllowed(input.prefix);
  if (!prefixCheck.ok) throw new Error(prefixCheck.reason);

  if (!UTC_DATE_RE.test(input.utcDate)) {
    throw new Error(`utcDateはYYYY-MM-DD形式である必要がある: ${input.utcDate}`);
  }

  const jobIdCheck = checkSafeKeySegment(input.jobId, "jobId");
  if (!jobIdCheck.ok) throw new Error(jobIdCheck.reason);

  const checksumCheck = checkSafeKeySegment(input.datasetChecksumShort, "datasetChecksumShort");
  if (!checksumCheck.ok) throw new Error(checksumCheck.reason);

  return `${input.prefix}${input.utcDate}/${input.jobId}/${input.datasetChecksumShort}`;
}

export function buildEncryptedPayloadKey(input: BuildObjectKeyInput): string {
  return `${buildBackupObjectKeyBase(input)}.age`;
}

export function buildManifestKey(input: BuildObjectKeyInput): string {
  return `${buildBackupObjectKeyBase(input)}.manifest.json`;
}

/** object keyが許可prefixのいずれかで始まっており、かつ空prefix・絶対パス・URLでないことを確認する。 */
export function checkObjectKeyWellFormed(key: string): GuardCheck {
  if (key.length === 0) return { ok: false, reason: "object keyが空" };
  if (key.startsWith("/")) return { ok: false, reason: "object keyが絶対パス形式(先頭/)" };
  if (/^[a-z]+:\/\//i.test(key)) return { ok: false, reason: "object keyがURL形式" };
  if (key.includes("..")) return { ok: false, reason: "object keyにpath traversalらしき文字列(..)が含まれている" };
  if (/\/\//.test(key)) return { ok: false, reason: "object keyに重複区切り(//)が含まれている" };
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(key)) return { ok: false, reason: "object keyに制御文字が含まれている" };
  const matchedPrefix = BACKUP_OBJECT_PREFIXES.find((p) => key.startsWith(p));
  if (!matchedPrefix) return { ok: false, reason: `object keyが許可prefixのいずれでも始まっていない: ${key}` };
  return { ok: true };
}
