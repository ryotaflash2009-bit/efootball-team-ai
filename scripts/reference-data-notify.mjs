/**
 * 参照データ更新検出の通知（GitHub Issue）。reference-data-update-notify.yml から実行する。
 *
 *   node scripts/reference-data-notify.mjs <summary.json | -> <conclusion> <runId> <runUrl>
 *
 * - 同じラベルの未解決の Issue があればコメントを追加し、無ければ作る（重複して作らない）。
 * - 使うのは GITHUB_TOKEN（gh CLI の GH_TOKEN）だけ。追加の Secret・Production 接続なし。
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildDetectionNotification, buildScheduleGapNotice, shouldThrottleNotification, NOTIFY_LABEL } from "./lib/reference-data-notify.mjs";

const [summaryPath, conclusion, runId, runUrl] = process.argv.slice(2);
let summary = null;
try {
  if (summaryPath && summaryPath !== "-") summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch {
  summary = null;
}
const gh = (args) => execFileSync("gh", args, { encoding: "utf8" }).trim();
const now = new Date().toISOString();
// 毎時の検出: 定期実行の間隔（GitHub の schedule の遅れ・欠落）を確認する。値は run の開始時刻だけ（非秘密）。
const gap = buildScheduleGapNotice(process.env.PREV_DETECTION_RUN_AT, process.env.THIS_DETECTION_RUN_AT, process.env.DETECTION_EVENT ?? "");
const notices = [buildDetectionNotification(summary, { conclusion, runId, runUrl }), gap].filter((x) => x.notify);
if (notices.length === 0) {
  console.log("no notification");
  process.exit(0);
}
gh(["label", "create", NOTIFY_LABEL, "--color", "0E8A16", "--description", "Reference data update detection", "--force"]);
for (const n of notices) {
  const open = JSON.parse(gh(["issue", "list", "--label", NOTIFY_LABEL, "--state", "open", "--json", "number", "--limit", "1"]));
  if (open.length > 0) {
    const comments = JSON.parse(gh(["issue", "view", String(open[0].number), "--json", "comments"])).comments ?? [];
    const last = comments.length ? comments[comments.length - 1] : null;
    if (shouldThrottleNotification(n, last && { body: last.body, createdAt: last.createdAt }, now)) {
      console.log(`throttled (${n.kind}): same notification within 6 hours on #${open[0].number}`);
      continue;
    }
    gh(["issue", "comment", String(open[0].number), "--body", `**${n.title}**\n\n${n.body}`]);
    console.log(`commented on #${open[0].number}`);
  } else {
    const url = gh(["issue", "create", "--title", n.title, "--body", n.body, "--label", NOTIFY_LABEL]);
    console.log(`created ${url}`);
  }
}
