/**
 * ゲームの用語の表示名（能力名・育成カテゴリ・監督の戦術）の言語ごとの表（2026-10-06）。
 *
 * - 日本語・English は従来の定義（`world/stat-labels.ts`・`world/stats.ts`・`managers/tactics.ts`）がそのまま正。
 * - ほかの言語の表は `dictionaries/locales/<code>/game-terms.ts`（登録制・その言語の chunk に入る）。**ゲーム内の各言語の公式の表記とは照合していない**（用語集の状態は REVIEW_REQUIRED）。
 *   公式と書かない。照合できた語から用語集を `approved` にし、この表を直す。
 * - 表に無い言語・語は English の名前（呼び出し側の既存の代わり）。内部の key は変えない。
 * - 表示言語は呼び出し側が渡す（React の context の値）。モジュールの状態は使わない（遅れて hydration される部分の不一致 #418 を防ぐ）。
 */

type Table = Readonly<Record<string, string>>;

/** 言語ごとの表（その言語の辞書の chunk が読み込まれたときに登録される。初回 JS に含めない）。 */
const ABILITY: Record<string, Table> = {};
const GROUP: Record<string, Table> = {};
const TACTIC: Record<string, Table> = {};

export function registerGameTerms(locale: string, terms: { abilities: Table; groups: Table; tactics: Table }): void {
  ABILITY[locale] = terms.abilities;
  GROUP[locale] = terms.groups;
  TACTIC[locale] = terms.tactics;
}




export function localizedAbilityName(statKey: string, locale: string): string | null {
  return ABILITY[locale]?.[statKey] ?? null;
}
export function localizedGroupName(groupId: string, locale: string): string | null {
  return GROUP[locale]?.[groupId] ?? null;
}
export function localizedTacticName(tacticKey: string, locale: string): string | null {
  return TACTIC[locale]?.[tacticKey] ?? null;
}

/** テスト・監査用: 表を持つ言語と語の数。 */
export function gameTermCoverage(): Record<string, { abilities: number; groups: number; tactics: number }> {
  const out: Record<string, { abilities: number; groups: number; tactics: number }> = {};
  for (const l of Object.keys(ABILITY)) out[l] = { abilities: Object.keys(ABILITY[l]).length, groups: Object.keys(GROUP[l] ?? {}).length, tactics: Object.keys(TACTIC[l] ?? {}).length };
  return out;
}
