import { DATA_KINDS, type DataKind } from "./types";
import { getLegacyStorageKey } from "./keys";
import { readRawJson } from "./storage-access";
import { extractScopedItems } from "./adapters";

/**
 * アカウント分離前の「レガシー共通領域」の検出(件数だけ・内容は一切表示・移動・削除しない)。
 * ログイン時・ページ表示時に自動的にどこかへコピーする処理は、この関数からは一切呼ばれない
 * (呼び出し側も含め、読み取り専用)。
 */
export interface LegacyDataSummary {
  kind: DataKind;
  hasData: boolean;
  itemCount: number;
}

export function detectLegacyDataForKind(kind: DataKind): LegacyDataSummary {
  const raw = readRawJson(getLegacyStorageKey(kind));
  const items = extractScopedItems(kind, raw);
  return { kind, hasData: items.length > 0, itemCount: items.length };
}

export function detectAllLegacyData(): Record<DataKind, LegacyDataSummary> {
  const out = {} as Record<DataKind, LegacyDataSummary>;
  for (const kind of DATA_KINDS) {
    out[kind] = detectLegacyDataForKind(kind);
  }
  return out;
}

export function hasAnyLegacyData(summary: Record<DataKind, LegacyDataSummary>): boolean {
  return DATA_KINDS.some((k) => summary[k].hasData);
}
