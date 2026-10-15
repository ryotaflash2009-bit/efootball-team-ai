/**
 * 公式のお知らせの合図（2026-10-15）。reference-data-official-news-signal.yml から 6 時間に 1 回実行する。
 *
 *   node scripts/official-news-signal.mjs            （GitHub Actions: GH_TOKEN で Issue にコメント）
 *   node scripts/official-news-signal.mjs --dry-run  （外部へ 1 回 GET し、判定だけを表示する）
 *
 * - 外部へのアクセスは公式のお知らせの一覧への GET 1 回だけ（20 秒で打ち切り・リトライなし）。
 * - 比べる相手は main の applied-state（TeamAIXI に反映済みの最も新しいカード）。Production・Secret には触れない。
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { OFFICIAL_NEWS_URL, parseOfficialNews, buildOfficialAheadNotice, hasPendingOfficialNews } from "./lib/official-news-signal.mjs";
import { decideWatchdogDispatch } from "./lib/detection-watchdog.mjs";
import { shouldThrottleNotification, NOTIFY_LABEL } from "./lib/reference-data-notify.mjs";

const dryRun = process.argv.includes("--dry-run");
const now = new Date().toISOString();
const applied = JSON.parse(readFileSync("docs/production-readiness/reference-data-applied-state.json", "utf8"));
const appliedLatestCardAt = applied?.datasets?.world_player_cards?.maxAppearanceUpdatedAt ?? null;

let html = null;
try {
  const res = await fetch(OFFICIAL_NEWS_URL, {
    headers: { "user-agent": "TeamAIXI-official-news-signal/1.0 (+https://efootball-team-ai.vercel.app)" },
    signal: AbortSignal.timeout(20_000),
  });
  html = res.ok ? await res.text() : null;
  console.log(`fetch: ${res.status}`);
} catch (e) {
  console.log(`fetch failed: ${e?.name ?? "error"}`);
}
const items = parseOfficialNews(html);
const notice = buildOfficialAheadNotice({ items, appliedLatestCardAt, now });
console.log(JSON.stringify({ parsed: items ? items.length : null, dataRelated: items ? items.filter((x) => x.dataRelated).length : null, appliedLatestCardAt, decision: notice.notify ? "notify" : notice.reason, latestId: notice.latestId ?? null }));
const gh = (args) => execFileSync("gh", args, { encoding: "utf8" }).trim();

// 反映待ちの新しいお知らせ（直近 48 時間）があれば、前回の成功から 60 分を超えているときだけ検出を起動する（取得元が追いつき次第すぐ反映）。
const pending = hasPendingOfficialNews({ items, appliedLatestCardAt, now });
console.log(JSON.stringify({ pendingOfficialNews: pending }));
if (pending && !dryRun && process.env.DETECTION_ENABLED === "true") {
  const runs = JSON.parse(gh(["run", "list", "--workflow", "reference-data-update-detection.yml", "--limit", "30", "--json", "databaseId,event,createdAt,status,conclusion"])).map((r) => ({ id: r.databaseId, event: r.event, createdAt: r.createdAt, status: r.status, conclusion: r.conclusion }));
  const d = decideWatchdogDispatch({ now, runs, enabled: true, staleMs: 60 * 60 * 1000 });
  console.log(JSON.stringify({ dispatchDecision: d.reason }));
  if (d.dispatch) {
    gh(["workflow", "run", "reference-data-update-detection.yml", "--ref", "main", "-f", "confirm=detect"]);
    console.log("dispatched detection");
  }
}

if (!notice.notify || dryRun) process.exit(0);

gh(["label", "create", NOTIFY_LABEL, "--color", "0E8A16", "--description", "Reference data update detection", "--force"]);
const open = JSON.parse(gh(["issue", "list", "--label", NOTIFY_LABEL, "--state", "open", "--json", "number", "--limit", "1"]));
if (open.length > 0) {
  const comments = JSON.parse(gh(["issue", "view", String(open[0].number), "--json", "comments"])).comments ?? [];
  const last = comments.length ? comments[comments.length - 1] : null;
  if (shouldThrottleNotification(notice, last && { body: last.body, createdAt: last.createdAt }, now)) {
    console.log(`throttled: same notification within 24 hours on #${open[0].number}`);
    process.exit(0);
  }
  gh(["issue", "comment", String(open[0].number), "--body", `**${notice.title}**\n\n${notice.body}`]);
  console.log(`commented on #${open[0].number}`);
} else {
  console.log(`created ${gh(["issue", "create", "--title", notice.title, "--body", notice.body, "--label", NOTIFY_LABEL])}`);
}
