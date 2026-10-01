/**
 * 自動進行（orchestrator）と Production apply の結果の通知（GitHub Issue）。reference-data-pipeline-notify.yml から実行する。
 *
 * 入力（環境変数）: NOTIFY_SOURCE（orchestrator | apply）・CONCLUSION・RUN_ID・RUN_URL・RUN_TITLE・
 *                   APPROVAL_PATH（orchestrator の要約）・EVIDENCE_PATH（apply の Evidence）。読めないファイルは無いものとして扱う。
 * - 検出の通知と同じラベルの未解決の Issue へコメントし、無ければ作る（重複して作らない）。
 * - 使うのは GITHUB_TOKEN（gh CLI の GH_TOKEN）だけ。追加の Secret・Production 接続なし。
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildPipelineNotification, NOTIFY_LABEL } from "./lib/reference-data-notify.mjs";

const readJson = (p) => {
  try {
    return p && existsSync(p) && statSync(p).size < 1024 * 1024 ? JSON.parse(readFileSync(p, "utf8")) : null;
  } catch {
    return null;
  }
};
const env = process.env;
const n = buildPipelineNotification({
  source: env.NOTIFY_SOURCE,
  conclusion: env.CONCLUSION,
  runId: env.RUN_ID,
  runUrl: env.RUN_URL,
  title: env.RUN_TITLE,
  approval: readJson(env.APPROVAL_PATH),
  evidence: readJson(env.EVIDENCE_PATH),
});
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
