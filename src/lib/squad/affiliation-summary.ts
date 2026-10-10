/**
 * スカッドの先発の所属の内訳（国籍・リーグ・チーム）— 2026-10-11。
 *
 * - 「日本代表で揃える」「同じクラブで揃える」等のチーム作りの目安。ゲームの補正（連携等）の計算ではない。
 * - 値は World の表記のまま（選手詳細 API）。同じ値の人数を数え、2 人以上の値だけを多い順に返す（最大 3 件）。
 * - 所属が分からない選手（読み込み中・失敗）は数えず、unknown に数える（推測しない）。
 */
export type SquadAffiliationKind = "nationality" | "league" | "team";
export const SQUAD_AFFILIATION_KINDS: readonly SquadAffiliationKind[] = ["nationality", "league", "team"];

export interface SquadAffiliationSource {
  nationality?: string | null;
  league?: string | null;
  team?: string | null;
}

export interface SquadAffiliationSummary {
  /** 数えた先発の人数（所属が分かった人数） */
  known: number;
  /** 所属が分からなかった先発の人数 */
  unknown: number;
  groups: Record<SquadAffiliationKind, { value: string; count: number }[]>;
}

export const SQUAD_AFFILIATION_TOP = 3;

export function squadAffiliationSummary(starters: readonly (SquadAffiliationSource | null)[]): SquadAffiliationSummary {
  const known = starters.filter((s): s is SquadAffiliationSource => s != null);
  const groups = {} as SquadAffiliationSummary["groups"];
  for (const kind of SQUAD_AFFILIATION_KINDS) {
    const counts = new Map<string, number>();
    for (const s of known) {
      const v = s[kind];
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    groups[kind] = [...counts]
      .filter(([, count]) => count >= 2)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, SQUAD_AFFILIATION_TOP);
  }
  return { known: known.length, unknown: starters.length - known.length, groups };
}
