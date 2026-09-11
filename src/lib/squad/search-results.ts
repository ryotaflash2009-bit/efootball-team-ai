import type { WorldPlayerListItem } from "@/lib/world/types";

/**
 * スカッド選手検索結果の並び替え（純関数）。
 * 名前一致 → 対象ポジション一致 → API 順（OVR 高い順で返ってくる）→ World ID で安定。
 * ポジション別 OVR は未確認なので架空の適性評価では並べない。適性データ未収録カードも除外しない。
 *
 * カード表示データ生成（画像解決・ブースターチップ等）は選手比較検索と共通の
 * `@/lib/world/search-card` へ移動。ここからは後方互換のため再エクスポートする。
 */

export { boosterChipsForCard, buildPlayerSearchCardView } from "@/lib/world/search-card";
export type { SearchBoosterChip, PlayerSearchCardView } from "@/lib/world/search-card";

export function sortSearchResults(
  players: WorldPlayerListItem[],
  query: string,
  targetPosition: string | null | undefined,
): WorldPlayerListItem[] {
  const ql = query.trim().toLowerCase();
  const rank = (p: WorldPlayerListItem) => {
    const exact =
      (p.nameJa ?? "").toLowerCase() === ql || (p.nameEn ?? "").toLowerCase() === ql;
    const posMatch = targetPosition != null && p.registeredPosition === targetPosition;
    return (exact ? 0 : 2) + (posMatch ? 0 : 1);
  };
  return players
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((a, b) => a.r - b.r || a.i - b.i || a.p.worldCardId.localeCompare(b.p.worldCardId))
    .map((x) => x.p);
}
