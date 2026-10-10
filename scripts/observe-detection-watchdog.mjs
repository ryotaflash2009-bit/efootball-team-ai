/**
 * 検出の watchdog の観測（読み取りだけ・2026-10-11）。GitHub CLI（gh・ログイン済み）で run の一覧とログを読む。
 *
 *   SINCE=2026-10-10T15:00:00Z UNTIL=2026-10-13T23:59:59Z node scripts/observe-detection-watchdog.mjs
 *   ... REPORT_PATH=./docs/production-readiness/evidence/detection-watchdog-observation-2026-10-13.json node scripts/observe-detection-watchdog.mjs
 *
 * - workflow の起動・変数・Secret・cron には触れない。書き込みは REPORT_PATH（ワークスペースの中）だけ。
 * - 判定は scripts/lib/watchdog-observation.mjs（pure・テストあり）。終了コード: NO_GO なら 1。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateWatchdogObservation, parseWatchdogDecision } from "./lib/watchdog-observation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SINCE = process.env.SINCE ?? "2026-10-10T15:00:00Z";
const UNTIL = process.env.UNTIL ?? new Date().toISOString();
const GH = process.env.GH_PATH ?? (process.platform === "win32" && existsSync("C:\\Program Files\\GitHub CLI\\gh.exe") ? "C:\\Program Files\\GitHub CLI\\gh.exe" : "gh");
const gh = (args) => execFileSync(GH, args, { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).trim();
const list = (wf) =>
  JSON.parse(gh(["run", "list", "--workflow", wf, "--limit", "200", "--json", "databaseId,event,createdAt,status,conclusion"])).map((r) => ({
    id: r.databaseId,
    event: r.event,
    createdAt: r.createdAt,
    conclusion: r.status === "completed" ? r.conclusion : null,
  }));

const watchdogRuns = list("reference-data-detection-watchdog.yml");
const detectionRuns = list("reference-data-update-detection.yml");
// workflow_dispatch の検出だけ、起動した人（github-actions[bot] か本人か）を読む
for (const r of detectionRuns) {
  if (r.event !== "workflow_dispatch") continue;
  try {
    r.actor = JSON.parse(gh(["api", `repos/{owner}/{repo}/actions/runs/${r.id}`, "--jq", "{a: .triggering_actor.login}"])).a;
  } catch {
    r.actor = null;
  }
}
const decisions = {};
const a = Date.parse(SINCE);
const b = Date.parse(UNTIL);
for (const r of watchdogRuns) {
  const t = Date.parse(r.createdAt);
  if (!(t >= a && t <= b) || r.conclusion !== "success") continue;
  try {
    decisions[String(r.id)] = parseWatchdogDecision(gh(["run", "view", String(r.id), "--log"]));
  } catch {
    decisions[String(r.id)] = null;
  }
}
const result = evaluateWatchdogObservation({ since: SINCE, until: UNTIL, watchdogRuns, detectionRuns, decisions });
console.log(JSON.stringify(result, null, 2));
if (process.env.REPORT_PATH) {
  const out = path.resolve(ROOT, process.env.REPORT_PATH);
  if (!out.startsWith(ROOT + path.sep)) throw new Error("REPORT_PATH must be inside the workspace");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: "detection-watchdog-observation/v1", generatedAt: new Date().toISOString(), window: { since: SINCE, until: UNTIL }, ...result }, null, 2) + "\n");
  console.log(`report: ${path.relative(ROOT, out)}`);
}
process.exitCode = result.verdict === "NO_GO" ? 1 : 0;
