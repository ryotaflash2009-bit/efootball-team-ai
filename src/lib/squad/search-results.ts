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

/**
 * 検索語の入力前に出す「My Team の所持カード」の並び（純関数・2026-10-26）。
 * 対象ポジション一致 → 最大 OVR の高い順 → World ID で安定。最大 limit 枚。
 */
export function ownedCardsForSlot(
  owned: readonly WorldPlayerListItem[],
  targetPosition: string | null | undefined,
  limit = 30,
): WorldPlayerListItem[] {
  const ovr = (p: WorldPlayerListItem) => p.ovrMax ?? p.ovrBase ?? -1;
  const pos = (p: WorldPlayerListItem) => (targetPosition != null && p.registeredPosition === targetPosition ? 0 : 1);
  return [...owned]
    .sort((a, b) => pos(a) - pos(b) || ovr(b) - ovr(a) || a.worldCardId.localeCompare(b.worldCardId))
    .slice(0, Math.max(0, limit));
}
