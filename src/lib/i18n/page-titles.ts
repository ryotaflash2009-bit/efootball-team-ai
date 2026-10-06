import type { Dictionary } from "./dictionaries/ja";

/**
 * 画面のタブの題名（2026-10-07）。サーバーの metadata は日本語の固定のため、日本語以外の表示言語では、
 * 経路に合わせて辞書の題名に置き換える（`PageTitleSync`）。日本語の表示は変えない。
 * 選手・監督の詳細など、名前を含む題名の画面はサーバーの題名のまま（null）。
 */
type T = <N extends keyof Dictionary>(ns: N, key: keyof Dictionary[N]) => string;

const BRAND = "TeamAIXI";

export function pageTitleFor(pathname: string, t: T): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  const label = ((): string | null => {
    switch (p) {
      case "/":
        return BRAND;
      case "/players":
        return t("nav", "players");
      case "/managers":
        return t("nav", "managers");
      case "/compare":
        return t("nav", "compare");
      case "/squads":
        return t("squadList", "pageTitle");
      case "/squads/templates":
        return t("squadTemplatesBoard", "pageTitle");
      case "/squads/compare":
        return t("squadCompareBoard", "pageTitle");
      case "/best-xi":
        return t("bestXi", "pageTitle");
      case "/my-team":
        return t("myTeam", "pageTitle");
      case "/my-builds":
        return t("myBuildsView", "pageTitle");
      case "/build-inventory":
        return t("buildInventoryView", "pageTitle");
      case "/favorites":
        return t("favoritesView", "pageTitle");
      case "/diagnosis-history":
        return t("diagnosisHistory", "pageTitle");
      case "/data-management":
        return t("dataManagement", "pageTitle");
      case "/about":
        return t("about", "pageTitle");
      case "/terms":
        return t("terms", "pageTitle");
      case "/privacy":
        return t("privacy", "pageTitle");
      case "/disclaimer":
        return t("disclaimer", "pageTitle");
      case "/support":
        return t("support", "pageTitle");
      case "/boosters":
        return t("boosterList", "pageTitle");
      case "/share/diagnosis":
        return t("diagnosisShare", "pageTitle");
      case "/share/compare":
        return t("diagnosisCompare", "pageTitle");
      default:
        if (/^\/squads\/[^/]+$/.test(p)) return t("nav", "squads");
        return null;
    }
  })();
  if (!label || !label.trim()) return null;
  return label === BRAND || /\|\s*TeamAIXI\s*$/.test(label) ? label : `${label} | ${BRAND}`;
}
