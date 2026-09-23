/**
 * reference_data_updater のpasswordをSCRAM-SHA-256 verifierへ変換する、本人PC上だけで使う対話ツール。
 *
 *   node scripts/reference-data-scram-verifier.mjs
 *
 * - passwordは画面に表示しない入力で2回受け取り、ファイル・ログ・環境変数へ書かない。
 * - 出力は `alter role reference_data_updater with password 'SCRAM-SHA-256$...';` の1行だけ。
 *   これを本人がSupabase SQL Editorへ貼る(平文passwordはSQL Editor・履歴に残らない)。
 * - verifierもpasswordのhash相当の秘密情報。チャット・Git・Issueへ貼らない。
 * - Claude Codeはこのツールを実行しない(passwordを扱わないため)。
 */
import { stdin, stdout } from "node:process";
import { buildAlterRolePasswordSql, buildScramSha256Verifier, validatePasswordForScram } from "./lib/scram-verifier.mjs";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error("対話端末で実行してください(passwordをpipeで渡さない)"));
      return;
    }
    stdout.write(prompt);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        stdin.setRawMode(false);
        reject(new Error("中止しました"));
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

try {
  const first = await readHidden("reference_data_updater のpassword(表示されません): ");
  const problem = validatePasswordForScram(first);
  if (problem) throw new Error(problem);
  const second = await readHidden("確認のためもう一度: ");
  if (first !== second) throw new Error("2回の入力が一致しません");
  stdout.write(`\n${buildAlterRolePasswordSql("reference_data_updater", buildScramSha256Verifier(first))}\n\n`);
  stdout.write("↑ この1行だけをSupabase SQL Editorへ貼って実行してください。チャット・Git・Issueへは貼らないでください。\n");
} catch (e) {
  stdout.write(`\n停止: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
