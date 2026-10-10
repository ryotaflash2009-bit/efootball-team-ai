/**
 * 毎時の検出の観測レポート（読み取りだけ）。GitHub CLI（gh・ログイン済み）で公開の run の一覧・要約・通知を読む。
 *
 *   node scripts/observe-hourly-detection.mjs
 *   SINCE=2026-10-06T00:00:00Z UNTIL=2026-10-13T23:59:59Z REPORT_PATH=./docs/production-readiness/evidence/hourly-detection-observation-2026-10-13.json node scripts/observe-hourly-detection.mjs
 *
 * - 書き込みは REPORT_PATH（ワークスペース内）と、要約の一時の展開先 data/work/tmp-observe-*（Git の対象外）だけ。workflow の起動・変数・Secret・cron には触れない。
 * - 要約（reference-data-detection-summary）は保持期間 7 日。取れない run は request・bytes・軽い/完全を null のままにする。
 * - 判定と集計は scripts/lib/hourly-schedule-observation.mjs（pure・テストあり）。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observeSchedule } from "./lib/hourly-schedule-observation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = "reference-data-update-detection.yml";
const GAP_TITLE = "Hourly detection schedule gap";
const NOTIFY_ISSUE = process.env.NOTIFY_ISSUE ?? "112";
const SINCE = process.env.SINCE ?? "2026-10-06T00:00:00Z";
const UNTIL = process.env.UNTIL ?? new Date().toISOString();
const GH = process.env.GH_PATH ?? (process.platform === "win32" && existsSync("C:\\Program Files\\GitHub CLI\\gh.exe") ? "C:\\Program Files\\GitHub CLI\\gh.exe" : "gh");

const gh = (args) => execFileSync(GH, args, { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).trim();

const runs = JSON.parse(
  gh(["run", "list", "--workflow", WORKFLOW, "--limit", "400", "--json", "databaseId,event,createdAt,startedAt,updatedAt,status,conclusion"]),
).map((r) => ({ id: r.databaseId, event: r.event, createdAt: r.createdAt, startedAt: r.startedAt, updatedAt: r.updatedAt, status: r.status, conclusion: r.conclusion }));

const since = Date.parse(SINCE);
const until = Date.parse(UNTIL);
const summaries = {};
if (process.env.SKIP_SUMMARIES !== "1") {
  // 要約の artifact はワークスペースの中（Git の対象外の data/work）へ落とす（2026-10-11: OS の一時フォルダ＝ワークスペースの外を使わない）。
  mkdirSync(path.join(ROOT, "data", "work"), { recursive: true });
  const tmp = mkdtempSync(path.join(ROOT, "data", "work", "tmp-observe-"));
  for (const r of runs) {
    const t = Date.parse(r.createdAt);
    if (t < since || t > until || r.status !== "completed") continue;
    const dir = path.join(tmp, String(r.id));
    try {
      gh(["run", "download", String(r.id), "-n", "reference-data-detection-summary", "-D", dir]);
      summaries[String(r.id)] = JSON.parse(readFileSync(path.join(dir, "reference-data-detection-summary.json"), "utf8"));
    } catch {
      // 保持期間切れ・要約なし → 推測しない
    }
  }
}

let gapNotices = [];
try {
  const comments = JSON.parse(gh(["issue", "view", NOTIFY_ISSUE, "--json", "comments"])).comments ?? [];
  gapNotices = comments.filter((c) => String(c.body ?? "").includes(GAP_TITLE)).map((c) => ({ at: c.createdAt }));
} catch {
  gapNotices = [];
}

let workflowState = null;
try {
  const repo = gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  workflowState = gh(["api", `repos/${repo}/actions/workflows/${WORKFLOW}`, "--jq", ".state"]) || null;
} catch {
  workflowState = null;
}

const result = { schema: "hourly-detection-observation/v1", generatedAt: new Date().toISOString(), cron: "17 * * * *", ...observeSchedule({ since: SINCE, until: UNTIL, runs, summaries, gapNotices, workflowState }) };

if (process.env.REPORT_PATH) {
  const out = path.resolve(ROOT, process.env.REPORT_PATH);
  if (!out.startsWith(ROOT + path.sep)) throw new Error("REPORT_PATH must be inside the workspace");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
}

const { slots, ...head } = result;
console.log(JSON.stringify(head, null, 2));
for (const s of slots) {
  console.log(
    s.status === "missing"
      ? `${s.slot}  MISSING`
      : `${s.slot}  ${s.status.padEnd(7)} run ${s.runId}  +${s.delayMinutes} min  ${s.durationSeconds ?? "?"} s  ${s.mode ?? "?"}  ${s.outcome ?? "?"}  req ${s.requests ?? "?"}  bytes ${s.bytes ?? "?"}`,
  );
}
