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
import { buildDetectionNotification, NOTIFY_LABEL } from "./lib/reference-data-notify.mjs";

const [summaryPath, conclusion, runId, runUrl] = process.argv.slice(2);
let summary = null;
try {
  if (summaryPath && summaryPath !== "-") summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch {
  summary = null;
}
const n = buildDetectionNotification(summary, { conclusion, runId, runUrl });
if (!n.notify) {
  console.log(`no notification (${n.reason})`);
  process.exit(0);
}
const gh = (args) => execFileSync("gh", args, { encoding: "utf8" }).trim();
gh(["label", "create", NOTIFY_LABEL, "--color", "0E8A16", "--description", "Reference data update detection", "--force"]);
const open = JSON.parse(gh(["issue", "list", "--label", NOTIFY_LABEL, "--state", "open", "--json", "number", "--limit", "1"]));
if (open.length > 0) {
  gh(["issue", "comment", String(open[0].number), "--body", `**${n.title}**\n\n${n.body}`]);
  console.log(`commented on #${open[0].number}`);
} else {
  const url = gh(["issue", "create", "--title", n.title, "--body", n.body, "--label", NOTIFY_LABEL]);
  console.log(`created ${url}`);
}
