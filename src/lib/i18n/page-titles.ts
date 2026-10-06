import type { Dictionary } from "./dictionaries/ja";

/**
 * 画面のタブの題名（2026-10-07）。サーバーの metadata は日本語の固定のため、日本語以外の表示言語では辞書の題名に置き換える。
 * - 核の名前空間（nav）だけで決まる画面は `PageTitleSync`（layout）が `coreTitleFor` で設定する。
 * - それ以外の画面は、その画面の view が自分の名前空間の `pageTitle` を `usePageTitle` に渡す
 *   （名前空間の import の規則を守り、layout の JS を増やさない）。
 * - 日本語の表示は変えない。選手・監督の詳細（名前を含む題名）はサーバーの題名のまま。
 */
export const BRAND = "TeamAIXI";

/** 「<題名> | TeamAIXI」の形にそろえる（すでに付いていればそのまま）。空なら null。 */
export function formatPageTitle(label: string | null | undefined): string | null {
  if (!label || !label.trim()) return null;
  return label === BRAND || /\|\s*TeamAIXI\s*$/.test(label) ? label : `${label} | ${BRAND}`;
}

type Nav = Pick<Dictionary, "nav">;
type T = <N extends keyof Nav>(ns: N, key: keyof Nav[N]) => string;

/** 核の名前空間（nav）だけで題名が決まる画面。それ以外は null（view が設定する）。 */
export function coreTitleFor(pathname: string, t: T): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return BRAND;
  if (p === "/players") return formatPageTitle(t("nav", "players"));
  if (p === "/managers") return formatPageTitle(t("nav", "managers"));
  if (p === "/compare") return formatPageTitle(t("nav", "compare"));
  if (/^\/squads\/(?!compare$|templates$)[^/]+$/.test(p)) return formatPageTitle(t("nav", "squads"));
  return null;
}
