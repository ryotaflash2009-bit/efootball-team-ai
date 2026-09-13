import type { DataKind } from "./types";
import { getSafeLocalStorage, readRawJson } from "./storage-access";

/**
 * 移行実行前のバックアップ・失敗時のロールバック。
 *
 * 方式(Section 12): (A)メモリ内バックアップ + (B)localStorage内の一時バックアップキー、
 * の組み合わせを採用する。(C)JSONダウンロードは移行センターUI側で任意提供する
 * (このモジュール自体はヘッドレスに保つ)。
 *
 * バックアップに含めるのは対象キーの生JSON文字列と整合性ハッシュだけ。
 * メールアドレス・ユーザーUUID・Token・Cookie・Project URL・Publishable key・
 * クラウドデータ・対象外のlocalStorage項目は一切含めない。
 */

export const STORAGE_BACKUP_VERSION = "local-storage-scope-backup/2026-09-13.v1";

export type BackupRole = "legacy" | "account";

export interface StorageBackup {
  version: string;
  createdAt: string;
  kind: DataKind;
  role: BackupRole;
  /** バックアップ対象キーの生JSON文字列。キーが未設定だった場合はnull。 */
  payload: string | null;
  /** payload(nullの場合は空文字列扱い)のSHA-256(小文字16進)。 */
  payloadHash: string;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function backupStorageKey(kind: DataKind, role: BackupRole): string {
  return `efootball-team-ai:local-storage-scope:backup:${role}:${kind}:v1`;
}

function isStorageBackup(v: unknown): v is StorageBackup {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.version === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.kind === "string" &&
    (r.role === "legacy" || r.role === "account") &&
    (r.payload === null || typeof r.payload === "string") &&
    typeof r.payloadHash === "string"
  );
}

/** 対象キーの現在値からバックアップ(メモリ内オブジェクト)を作成する。書き込みは行わない。 */
export async function createBackup(kind: DataKind, role: BackupRole, currentRawString: string | null): Promise<StorageBackup> {
  const hash = await sha256Hex(currentRawString ?? "");
  return {
    version: STORAGE_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    kind,
    role,
    payload: currentRawString,
    payloadHash: hash,
  };
}

/** バックアップをlocalStorageの一時キーへ保存する(ブラウザーを閉じても復旧できるように)。 */
export function persistBackup(backup: StorageBackup): boolean {
  const ls = getSafeLocalStorage();
  if (!ls) return false;
  try {
    ls.setItem(backupStorageKey(backup.kind, backup.role), JSON.stringify(backup));
    return true;
  } catch {
    return false;
  }
}

/** 一時バックアップキーから読み戻す。壊れている/未知バージョンはnull(復元不能扱い)。 */
export function readPersistedBackup(kind: DataKind, role: BackupRole): StorageBackup | null {
  const raw = readRawJson(backupStorageKey(kind, role));
  if (!isStorageBackup(raw)) return null;
  if (raw.version !== STORAGE_BACKUP_VERSION) return null;
  return raw;
}

export function clearPersistedBackup(kind: DataKind, role: BackupRole): void {
  const ls = getSafeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(backupStorageKey(kind, role));
  } catch {
    /* noop */
  }
}

/** バックアップの整合性ハッシュを再計算して検証する。 */
export async function verifyBackup(backup: StorageBackup): Promise<boolean> {
  const hash = await sha256Hex(backup.payload ?? "");
  return hash === backup.payloadHash;
}

export interface RollbackResult {
  ok: boolean;
  /** バックアップ自体の整合性ハッシュが検証できたか。falseの場合、ロールバックは実行していない。 */
  verified: boolean;
}

/**
 * バックアップの内容を、実際のストレージキーへ書き戻す(ロールバック)。
 * 検証に失敗した場合、書き戻しは一切実行しない(壊れたバックアップで上書きしない)。
 * 書き戻し後、再読込して実際に復元できたかも確認する。
 */
export async function rollbackToBackup(backup: StorageBackup, actualStorageKey: string): Promise<RollbackResult> {
  const verified = await verifyBackup(backup);
  if (!verified) return { ok: false, verified: false };

  const ls = getSafeLocalStorage();
  if (!ls) return { ok: false, verified: true };

  try {
    if (backup.payload == null) {
      ls.removeItem(actualStorageKey);
    } else {
      ls.setItem(actualStorageKey, backup.payload);
    }
  } catch {
    return { ok: false, verified: true };
  }

  let after: string | null;
  try {
    after = ls.getItem(actualStorageKey);
  } catch {
    return { ok: false, verified: true };
  }
  const restored = (after ?? null) === (backup.payload ?? null);
  return { ok: restored, verified: true };
}
