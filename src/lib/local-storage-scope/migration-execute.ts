import type { DataKind } from "./types";
import { getSafeLocalStorage } from "./storage-access";
import { extractScopedItems, encodeScopedItems } from "./adapters";
import { previewMigration } from "./migration-preview";
import { createBackup, persistBackup, rollbackToBackup, type StorageBackup } from "./backup";

/**
 * 移行の実行(データ種別ごとに独立、Section 10のB方式)。
 *
 * 手順: (1)レガシー領域・対象(アカウント)領域の両方をバックアップ →
 * (2)「不足分だけ追加」を対象領域へ書き込み → (3)再読込して検証 →
 * (4)検証に失敗したら対象領域をバックアップから復元(ロールバック)。
 *
 * レガシーキーは常に読み取るだけで、一切書き換えない(削除・上書き・空化しない)。
 * 競合(同じIDで内容が異なる)は自動解決せず、対象へは書き込まない
 * (件数として報告するだけで、ユーザーの追加の選択なしに上書きしない)。
 */
export interface MigrationExecutionResult {
  ok: boolean;
  kind: DataKind;
  addedCount: number;
  duplicateCount: number;
  conflictCount: number;
  invalidCount: number;
  rolledBack: boolean;
  errorReason: "BACKUP_FAILED" | "WRITE_FAILED" | "VERIFICATION_FAILED" | "STORAGE_UNAVAILABLE" | null;
}

function safeParse(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function failure(
  kind: DataKind,
  errorReason: NonNullable<MigrationExecutionResult["errorReason"]>,
  extra: Partial<MigrationExecutionResult> = {},
): MigrationExecutionResult {
  return {
    ok: false,
    kind,
    addedCount: 0,
    duplicateCount: 0,
    conflictCount: 0,
    invalidCount: 0,
    rolledBack: false,
    errorReason,
    ...extra,
  };
}

export async function executeMigrationForKind(
  kind: DataKind,
  legacyStorageKey: string,
  targetStorageKey: string,
): Promise<MigrationExecutionResult> {
  const ls = getSafeLocalStorage();
  if (!ls) return failure(kind, "STORAGE_UNAVAILABLE");

  let legacyRawString: string | null;
  let targetRawStringBefore: string | null;
  try {
    legacyRawString = ls.getItem(legacyStorageKey);
    targetRawStringBefore = ls.getItem(targetStorageKey);
  } catch {
    return failure(kind, "STORAGE_UNAVAILABLE");
  }

  // 1. バックアップ(成功を確認できるまで移行を開始しない)。
  const legacyBackup = await createBackup(kind, "legacy", legacyRawString);
  const accountBackup: StorageBackup = await createBackup(kind, "account", targetRawStringBefore);
  const legacyBackupOk = persistBackup(legacyBackup);
  const accountBackupOk = persistBackup(accountBackup);
  if (!legacyBackupOk || !accountBackupOk) {
    return failure(kind, "BACKUP_FAILED");
  }

  // 2. プレビューと同じロジックで「追加分」だけを計算する。
  const legacyRaw = safeParse(legacyRawString);
  const targetRaw = safeParse(targetRawStringBefore);
  const preview = previewMigration(kind, legacyRaw, targetRaw);
  const legacyItems = extractScopedItems(kind, legacyRaw);
  const targetItems = extractScopedItems(kind, targetRaw);
  const addIds = new Set(preview.items.filter((i) => i.status === "add").map((i) => i.id));
  const toAdd = legacyItems.filter((i) => addIds.has(i.id));
  const nextItems = [...targetItems, ...toAdd];

  // 3. 書き込み(対象=アカウント領域だけ。レガシーキーには一切触れない)。
  const nowIso = new Date().toISOString();
  const encoded = encodeScopedItems(kind, nextItems, nowIso);
  try {
    ls.setItem(targetStorageKey, encoded);
  } catch {
    return failure(kind, "WRITE_FAILED", { duplicateCount: preview.duplicateCount, conflictCount: preview.conflictCount, invalidCount: preview.invalidCount });
  }

  // 4. 再読込検証。書き込んだはずの全IDが実際に読み戻せることを確認する。
  let afterRawString: string | null;
  try {
    afterRawString = ls.getItem(targetStorageKey);
  } catch {
    afterRawString = null;
  }
  const afterItems = extractScopedItems(kind, safeParse(afterRawString));
  const expectedIds = new Set(nextItems.map((i) => i.id));
  const afterIds = new Set(afterItems.map((i) => i.id));
  const verified = expectedIds.size === afterIds.size && [...expectedIds].every((id) => afterIds.has(id));

  if (!verified) {
    const rb = await rollbackToBackup(accountBackup, targetStorageKey);
    return failure(kind, "VERIFICATION_FAILED", {
      duplicateCount: preview.duplicateCount,
      conflictCount: preview.conflictCount,
      invalidCount: preview.invalidCount,
      rolledBack: rb.ok,
    });
  }

  return {
    ok: true,
    kind,
    addedCount: toAdd.length,
    duplicateCount: preview.duplicateCount,
    conflictCount: preview.conflictCount,
    invalidCount: preview.invalidCount,
    rolledBack: false,
    errorReason: null,
  };
}
