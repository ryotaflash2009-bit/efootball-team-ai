import type { BestXiCandidate, BestXiUnavailableCard } from "./types";

/**
 * AIベストイレブンの「縛り」（国籍・リーグ・チーム）— 2026-10-11。
 *
 * - 自分の My Team のカードだけで「日本代表だけ」「J1 リーグだけ」「同じクラブだけ」のベストイレブンを作る。
 * - 値は World の表記のまま（選手詳細 API の nationality / league / team）。完全一致で比べる。
 * - 選択肢は、自分のカードに実際にある値だけ（カードの枚数つき・多い順）。
 * - 所属が分からないカード（選手詳細を読めなかった等）は、縛りがあるときは候補にしない（推測で入れない）。
 * - 縛りの無いとき（null）は入力をそのまま返す（今までの選考と同じ）。
 */
export type BestXiAffiliationKind = "nationality" | "league" | "team";
export const BEST_XI_AFFILIATION_KINDS: readonly BestXiAffiliationKind[] = ["nationality", "league", "team"];

export interface BestXiAffiliation {
  nationality: string | null;
  league: string | null;
  team: string | null;
}

export interface BestXiAffiliationFilter {
  kind: BestXiAffiliationKind;
  value: string;
}

export interface BestXiAffiliationOption {
  kind: BestXiAffiliationKind;
  value: string;
  /** その値を持つ自分のカードの枚数（worldCardId の重複なし） */
  cardCount: number;
}

/** select の値（"kind:value"）との相互変換。不正な値は null（縛りなし）。 */
export function encodeAffiliationFilter(f: BestXiAffiliationFilter | null): string {
  return f ? `${f.kind}:${f.value}` : "";
}

export function decodeAffiliationFilter(raw: string): BestXiAffiliationFilter | null {
  const i = raw.indexOf(":");
  if (i <= 0) return null;
  const kind = raw.slice(0, i) as BestXiAffiliationKind;
  const value = raw.slice(i + 1);
  if (!BEST_XI_AFFILIATION_KINDS.includes(kind) || value.trim() === "") return null;
  return { kind, value };
}

/** 自分のカードにある値だけの選択肢（種類ごとに、枚数の多い順・同数は名前順）。 */
export function affiliationOptions(
  worldCardIds: readonly string[],
  affiliations: ReadonlyMap<string, BestXiAffiliation>,
): Record<BestXiAffiliationKind, BestXiAffiliationOption[]> {
  const out = { nationality: [], league: [], team: [] } as Record<BestXiAffiliationKind, BestXiAffiliationOption[]>;
  const ids = [...new Set(worldCardIds)];
  for (const kind of BEST_XI_AFFILIATION_KINDS) {
    const counts = new Map<string, number>();
    for (const id of ids) {
      const v = affiliations.get(id)?.[kind];
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    out[kind] = [...counts]
      .map(([value, cardCount]) => ({ kind, value, cardCount }))
      .sort((a, b) => b.cardCount - a.cardCount || a.value.localeCompare(b.value));
  }
  return out;
}

function matches(id: string, affiliations: ReadonlyMap<string, BestXiAffiliation>, f: BestXiAffiliationFilter): boolean {
  return affiliations.get(id)?.[f.kind] === f.value;
}

/** 縛りに合う候補・候補にできなかったカードだけに絞る（縛りなしならそのまま）。 */
export function applyAffiliationFilter(
  input: { candidates: BestXiCandidate[]; unavailableCards: BestXiUnavailableCard[] },
  affiliations: ReadonlyMap<string, BestXiAffiliation>,
  filter: BestXiAffiliationFilter | null,
): { candidates: BestXiCandidate[]; unavailableCards: BestXiUnavailableCard[] } {
  if (!filter) return input;
  return {
    candidates: input.candidates.filter((c) => matches(c.worldCardId, affiliations, filter)),
    unavailableCards: input.unavailableCards.filter((u) => matches(u.worldCardId, affiliations, filter)),
  };
}
