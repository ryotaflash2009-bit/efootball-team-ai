import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveAttachedBooster } from "@/lib/progression/booster-resolution";
import type { UserCardFilterState } from "@/components/user-cards/UserCardFilters";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Locale } from "@/lib/i18n/locale";

/** カードに Power of Many の付属ブースターがあるか（fixed 版とは区別）。 */
export function cardHasPowerOfMany(card: WorldPlayerListItem): boolean {
  return [
    resolveAttachedBooster("world", 1, card.boost1),
    resolveAttachedBooster("world", 2, card.boost2),
  ].some((r) => r?.activation === "power_of_many");
}

export function cardHasBooster(card: WorldPlayerListItem): boolean {
  return (card.boost1 ?? 0) !== 0 || (card.boost2 ?? 0) !== 0;
}

export interface UserCardRow {
  worldCardId: string;
  addedAt: string;
  card: WorldPlayerListItem | null;
  /** My Team のときのみ。 */
  inMyTeam?: boolean;
  ownershipStatus?: string;
  /** 保存スカッドで使っている（My Team だけ・2026-10-31）。 */
  squadUsed?: boolean;
}

/**
 * 純関数: フィルター状態に応じて行を絞り込み・並び替える。
 * locale を渡すと「名前順」は画面に出す名前（ja は日本語名）で並べる（2026-10-25。省略時は従来どおり英語名）。
 */
export function filterAndSortUserCards(rows: UserCardRow[], state: UserCardFilterState, locale?: Locale): UserCardRow[] {
  const q = state.q.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const c = row.card;
    if (q) {
      const hay = [
        c?.nameEn ?? "",
        c?.nameJa ?? "",
        c?.team ?? "",
        c?.nationality ?? "",
        row.worldCardId,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.position && c?.registeredPosition !== state.position) return false;
    if (state.cardType && c?.cardType !== state.cardType) return false;
    if (state.booster === "has" && (!c || !cardHasBooster(c))) return false;
    if (state.booster === "pom" && (!c || !cardHasPowerOfMany(c))) return false;
    if (state.squadUse === "used" && !row.squadUsed) return false;
    if (state.squadUse === "unused" && row.squadUsed) return false;

    if (state.ownership) {
      if (state.ownership === "in_team" && !row.inMyTeam) return false;
      if (state.ownership === "not_in_team" && row.inMyTeam) return false;
      if (
        ["owned", "wanted", "released", "unknown"].includes(state.ownership) &&
        row.ownershipStatus !== state.ownership
      )
        return false;
    }
    return true;
  });

  const ovr = (c: WorldPlayerListItem | null) => c?.ovrMax ?? c?.ovrBase ?? -1;
  const sorted = [...filtered];
  switch (state.sort) {
    case "added_asc":
      sorted.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
      break;
    case "ovr_desc":
      sorted.sort((a, b) => ovr(b.card) - ovr(a.card));
      break;
    case "ovr_asc":
      sorted.sort((a, b) => ovr(a.card) - ovr(b.card));
      break;
    case "name": {
      const nameOf = (r: UserCardRow) =>
        locale ? resolvePlayerDisplayName(r.card ?? {}, locale, r.worldCardId) : (r.card?.nameEn ?? r.worldCardId);
      sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale));
      break;
    }
    case "position":
      sorted.sort((a, b) =>
        (a.card?.registeredPosition ?? "zzz").localeCompare(b.card?.registeredPosition ?? "zzz"),
      );
      break;
    case "added_desc":
    default:
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
  return sorted;
}

/** 解決済みカードから絞り込み用の選択肢（重複なし・ソート済み）。 */
export function facetsFromRows(rows: UserCardRow[]): { positions: string[]; cardTypes: string[] } {
  const pos = new Set<string>();
  const types = new Set<string>();
  for (const r of rows) {
    if (r.card?.registeredPosition) pos.add(r.card.registeredPosition);
    if (r.card?.cardType) types.add(r.card.cardType);
  }
  return {
    positions: [...pos].sort(),
    cardTypes: [...types].sort(),
  };
}
