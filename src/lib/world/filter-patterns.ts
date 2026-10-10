/**
 * 選手一覧の絞り込みの値の形（2026-10-11）。zod を読み込まずに使えるよう schemas.ts から分けた
 * （選手の詳細の画面から「この国籍の選手」等のリンクを作るときに、一覧が受け付ける値だけをリンクにするため）。
 * schemas.ts の検証と同じ定義を使う（片方だけ変えない）。
 */
export const FILTER_TOKEN_RE = /^[A-Za-z0-9 .&\-]+$/;
export const FILTER_TOKEN_MAX = 40;
export const NATIONALITY_RE = /^[\p{L} .,'&\-]+$/u;
export const NATIONALITY_MAX = 40;
/** リーグ・チーム */
export const AFFILIATION_RE = /^[\p{L}\p{N} .,'’&\-/()]+$/u;
export const AFFILIATION_MAX = 60;

export type ListFilterParam = "nationality" | "league" | "team" | "playingStyle" | "playingStyleDef";

const RULES: Record<ListFilterParam, { re: RegExp; max: number }> = {
  nationality: { re: NATIONALITY_RE, max: NATIONALITY_MAX },
  league: { re: AFFILIATION_RE, max: AFFILIATION_MAX },
  team: { re: AFFILIATION_RE, max: AFFILIATION_MAX },
  playingStyle: { re: FILTER_TOKEN_RE, max: FILTER_TOKEN_MAX },
  playingStyleDef: { re: FILTER_TOKEN_RE, max: FILTER_TOKEN_MAX },
};

/**
 * 選手一覧をその値で絞り込むリンク（/players?<param>=<value>）。一覧が受け付けない値（前後の空白・長すぎる・
 * 許さない文字）なら null（絞り込まれない一覧へのリンクで誤解させない）。
 */
export function playersFilterHref(param: ListFilterParam, value: string | null | undefined): string | null {
  if (typeof value !== "string" || value === "" || value !== value.trim()) return null;
  const rule = RULES[param];
  if (value.length > rule.max || !rule.re.test(value)) return null;
  return `/players?${new URLSearchParams({ [param]: value }).toString()}`;
}
