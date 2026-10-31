/**
 * 開発用: ローカルのサッカー AI（127.0.0.1:7870 の /player_form・データは ESPN）の「現実の今季成績」を
 * 選手の詳細に参考として出すための検証（純関数・2026-10-31）。診断・Tier・AI ベスト11 などの計算には使わない。
 *
 * 2026-10-31 の確認（22 人）でわかったこと:
 * - 数値は独立した情報源と一致（Haaland 9 得点・Mbappé 11 得点 2 アシスト・Salah 8 得点 3 アシストなど）。
 * - 名前だけで探すため、別人が返ることがある（Roberto Carlos → Roberto Carlos Castro・Ronaldinho → 別の米国の選手・
 *   Pedro → João Pedro・Danilo → Danilo Santos）。引退した選手は成績が空。
 * - ESPN の見出しが未来の年になることがある（Messi・Son の「2027 MLS Stats」。表の行は 2026 MLS）。
 * そのため、名前の完全一致（アクセント・大文字小文字を無視）と国籍の一致（別名の対応つき）の両方を満たし、
 * 成績の項目があるときだけ出す。見出しの年が未来なら年を出さず、前のシーズンなら注意を出す。
 */

export interface RealForm {
  name: string;
  position: string | null;
  team: string | null;
  nationality: string | null;
  season: string | null;
  stats: [string, string][];
  source: string;
  fetchedAt: string;
}

/** API の応答を検証する（形が違う・ok でない・成績が空なら null）。 */
export function parseRealForm(json: unknown): RealForm | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (j.ok !== true || typeof j.name !== "string" || !j.name.trim()) return null;
  const raw = j.season_stats;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const stats = Object.entries(raw as Record<string, unknown>)
    .filter((e): e is [string, string | number] => typeof e[1] === "string" || typeof e[1] === "number")
    .map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 30)] as [string, string]);
  if (stats.length === 0) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
  const fetchedAt = str(j.fetched_at);
  if (!fetchedAt || Number.isNaN(Date.parse(fetchedAt))) return null;
  return {
    name: j.name.trim().slice(0, 80),
    position: str(j.position),
    team: str(j.team),
    nationality: str(j.nationality),
    season: str(j.season),
    stats: stats.slice(0, 12),
    source: str(j.source) ?? "ESPN",
    fetchedAt,
  };
}

const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** 国籍の別名（World の表記 → ESPN の表記に寄せる）。 */
const NATIONALITY_ALIASES: Record<string, string> = {
  "korea republic": "south korea",
  "republic of korea": "south korea",
  "korea dpr": "north korea",
  usa: "united states",
  "united states of america": "united states",
  "ir iran": "iran",
  "china pr": "china",
  "cote d ivoire": "ivory coast",
  turkiye: "turkey",
  czechia: "czech republic",
  "republic of ireland": "ireland",
  "bosnia herzegovina": "bosnia and herzegovina",
  "cabo verde": "cape verde",
  "dr congo": "congo dr",
  "congo dr": "congo dr",
};
const normNationality = (s: string) => {
  const n = normName(s);
  return NATIONALITY_ALIASES[n] ?? n;
};

/** 返ってきた選手がこのカードの選手か（名前の完全一致・国籍の一致の両方）。 */
export function realFormMatchesCard(form: RealForm, card: { nameEn: string | null; nationality: string | null }): boolean {
  if (!card.nameEn || !card.nationality || !form.nationality) return false;
  return normName(form.name) === normName(card.nameEn) && normNationality(form.nationality) === normNationality(card.nationality);
}

export interface SeasonView {
  /** 表示する見出し（年が未来なら年を除いたもの）。 */
  label: string | null;
  /** ESPN の見出しの年が今より先だったので年を省いた。 */
  futureYearRemoved: boolean;
  /** 前のシーズンの成績の可能性（今のシーズンの成績がまだ無いなど）。 */
  stale: boolean;
}

/**
 * シーズンの見出し（例「2026-27 Premier League Stats」「2026 MLS Stats」）を確かめる。
 * - 2 年にまたがる見出しは、7 月以降はその年に始まるシーズン、6 月までは前の年に始まるシーズンが今のシーズン。
 * - 1 年の見出し（MLS など）は、その年が今のシーズン。
 */
export function viewSeason(label: string | null, now: Date): SeasonView {
  if (!label) return { label: null, futureYearRemoved: false, stale: true };
  const text = label.replace(/\s*Stats\s*$/i, "").trim();
  if (!text) return { label: null, futureYearRemoved: false, stale: true };
  const year = now.getUTCFullYear();
  const split = /^(\d{4})-(\d{2}|\d{4})\s*(.*)$/.exec(text);
  if (split) {
    const start = Number(split[1]);
    const currentStart = now.getUTCMonth() >= 6 ? year : year - 1;
    if (start > currentStart) return { label: split[3] || null, futureYearRemoved: true, stale: false };
    return { label: text, futureYearRemoved: false, stale: start < currentStart };
  }
  const single = /^(\d{4})\s*(.*)$/.exec(text);
  if (single) {
    const y = Number(single[1]);
    if (y > year) return { label: single[2] || null, futureYearRemoved: true, stale: false };
    return { label: text, futureYearRemoved: false, stale: y < year };
  }
  return { label: text, futureYearRemoved: false, stale: false };
}
