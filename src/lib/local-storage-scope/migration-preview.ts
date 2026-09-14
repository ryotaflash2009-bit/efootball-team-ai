import type { DataKind } from "./types";
import { extractScopedItems, countRawEntries, scopedItemsContentEqual, type ScopedItem } from "./adapters";

/**
 * 移行プレビュー(読み取り専用・書き込みは一切行わない)。
 *
 * 採用方式: 「不足分だけ追加」(Section 11)。同じIDで内容が同じものは「重複」として
 * スキップ、同じIDで内容が異なるものは「競合」として自動解決せず件数だけ報告する
 * (実行時も、ユーザーの選択なしに上書きしない)。
 */
export type MigrationItemStatus = "add" | "duplicate" | "conflict";

export interface MigrationPreviewItem {
  id: string;
  status: MigrationItemStatus;
}

export interface MigrationPreview {
  kind: DataKind;
  legacyCount: number;
  targetCount: number;
  addCount: number;
  duplicateCount: number;
  conflictCount: number;
  invalidCount: number;
  resultCountIfApplied: number;
  items: MigrationPreviewItem[];
}

export function previewMigration(kind: DataKind, legacyRaw: unknown, targetRaw: unknown): MigrationPreview {
  const legacyItems = extractScopedItems(kind, legacyRaw);
  const targetItems = extractScopedItems(kind, targetRaw);
  const targetById = new Map<string, ScopedItem>(targetItems.map((i) => [i.id, i]));

  let addCount = 0;
  let duplicateCount = 0;
  let conflictCount = 0;
  const items: MigrationPreviewItem[] = [];

  for (const item of legacyItems) {
    const existing = targetById.get(item.id);
    if (!existing) {
      addCount += 1;
      items.push({ id: item.id, status: "add" });
    } else if (scopedItemsContentEqual(kind, item, existing)) {
      duplicateCount += 1;
      items.push({ id: item.id, status: "duplicate" });
    } else {
      conflictCount += 1;
      items.push({ id: item.id, status: "conflict" });
    }
  }

  const invalidCount = Math.max(0, countRawEntries(kind, legacyRaw) - legacyItems.length);

  return {
    kind,
    legacyCount: legacyItems.length,
    targetCount: targetItems.length,
    addCount,
    duplicateCount,
    conflictCount,
    invalidCount,
    resultCountIfApplied: targetItems.length + addCount,
    items,
  };
}
