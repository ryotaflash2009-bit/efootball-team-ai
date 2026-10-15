/**
 * 公式のお知らせを「新しいデータが出た合図」として使う（2026-10-15・本人の承認）。
 *
 * - 読むのは eFootball 公式サイトのお知らせの一覧（https://www.konami.com/efootball/ja/topic/news/list）だけ。6 時間に 1 回・1 回の GET。
 *   robots.txt で禁止されていないこと、サイトの利用を禁じる条件が無いことを確認済み（docs/production-readiness/official-news-signal.md）。
 * - ページに埋め込まれた `newsData` の JSON から、番号・掲載日時・分類・題名を読む。題名は判定にだけ使い、保存・転載はしない。
 * - 合図: データに関わるお知らせ（アップデート・LiveUpdate・スペシャル選手リスト・新アイテム など）の最新の掲載から
 *   OFFICIAL_AHEAD_GRACE_MS がたっても、TeamAIXI に反映済みの最も新しいカード（applied-state の maxAppearanceUpdatedAt）が
 *   その掲載より古ければ知らせる。自動では何もしない。
 */

export const OFFICIAL_NEWS_URL = "https://www.konami.com/efootball/ja/topic/news/list";
export const OFFICIAL_AHEAD_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
/** データ（選手・能力値）に関わるお知らせの題名（部分一致）。 */
export const DATA_RELATED_TITLE = /LiveUpdate|ライブアップデート|アップデート配信|スペシャル選手リスト|選手リスト|新アイテム|新選手|POTW|Show Time|登場/;

/**
 * お知らせの一覧の HTML から `newsData: [...]` を取り出す。形が違えば null（推測しない）。
 * @param {string} html
 * @returns {{ id: number; at: string; category: number; dataRelated: boolean }[] | null}
 */
export function parseOfficialNews(html) {
  if (typeof html !== "string") return null;
  const k = html.indexOf("newsData: [");
  if (k < 0) return null;
  const start = html.indexOf("[", k);
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  let arr;
  try {
    arr = JSON.parse(html.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const n of arr) {
    if (!n || typeof n.id !== "number" || typeof n.beginDate !== "string" || typeof n.title !== "string") continue;
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(n.beginDate);
    if (!m) continue;
    // 日本語のページの掲載日時は日本時間（JST・UTC+9）
    const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], +m[6])).toISOString();
    out.push({ id: n.id, at, category: typeof n.category === "number" ? n.category : -1, dataRelated: DATA_RELATED_TITLE.test(n.title) });
  }
  return out;
}

/**
 * @param {{ items: { id: number; at: string; dataRelated: boolean }[] | null; appliedLatestCardAt: string | null | undefined; now: string }} input
 */
export function buildOfficialAheadNotice({ items, appliedLatestCardAt, now }) {
  if (!items) return { notify: false, reason: "unparsable" };
  const related = items.filter((x) => x.dataRelated).sort((a, b) => b.at.localeCompare(a.at));
  const latest = related[0];
  if (!latest) return { notify: false, reason: "no_data_related_news" };
  const applied = Date.parse(String(appliedLatestCardAt ?? ""));
  if (!Number.isFinite(applied)) return { notify: false, reason: "no_applied_state" };
  const posted = Date.parse(latest.at);
  const n = Date.parse(now);
  if (applied >= posted) return { notify: false, reason: "source_caught_up", latestId: latest.id };
  if (n - posted < OFFICIAL_AHEAD_GRACE_MS) return { notify: false, reason: "within_grace", latestId: latest.id };
  const days = Math.floor((n - posted) / 86_400_000);
  return {
    notify: true,
    kind: "official_ahead",
    title: "公式のお知らせに対して参照データが遅れています / Reference data is behind the official news",
    body: [
      `公式サイトのデータに関わるお知らせ（https://www.konami.com/efootball/ja/topic/news/${latest.id}・掲載 ${latest.at.slice(0, 10)}・${days} 日前）より後のカードが、TeamAIXI にまだ反映されていません。`,
      `TeamAIXI に反映済みの最も新しいカード: ${String(appliedLatestCardAt).slice(0, 10)}。`,
      "",
      "次: 取得元（eFootball World）の更新を待つ。長く続く場合は取得元の扱いを本人が判断する。自動では何も適用しません。",
      "",
      "この通知は自動作成です（公式のお知らせの番号と日付だけを使用・1 日に 1 回まで）。",
    ].join("\n"),
    days,
    latestId: latest.id,
  };
}

/** 反映待ちのお知らせとみなす期間（掲載から 48 時間）。この間は検出を早めに起動する。 */
export const OFFICIAL_PENDING_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * まだ TeamAIXI に反映されていない、直近 48 時間のデータに関わるお知らせがあるか（2026-10-15・「とにかく最新に」）。
 * あれば検出を早めに起動する（取得元が追いついた時点ですぐ反映するため）。
 * @param {{ items: { id: number; at: string; dataRelated: boolean }[] | null; appliedLatestCardAt: string | null | undefined; now: string }} input
 */
export function hasPendingOfficialNews({ items, appliedLatestCardAt, now }) {
  if (!items) return false;
  const applied = Date.parse(String(appliedLatestCardAt ?? ""));
  const n = Date.parse(now);
  if (!Number.isFinite(applied) || !Number.isFinite(n)) return false;
  return items.some((x) => x.dataRelated && Date.parse(x.at) > applied && n - Date.parse(x.at) >= 0 && n - Date.parse(x.at) <= OFFICIAL_PENDING_WINDOW_MS);
}
