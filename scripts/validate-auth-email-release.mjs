/**
 * 認証メール公開前の Release Validator（CLI）。外部アクセスなし・ファイルの読み取りだけ。
 *
 *   node scripts/validate-auth-email-release.mjs docs/production-readiness/auth-email-release-checklist.json
 *
 * 入力は公開してよいメタデータと、本人が確認した結果（true/false）だけ。Secret は書かない（書かれていたら BLOCKED）。
 * READY でも新規登録は自動では開かない（account-availability.ts の Gate を PR で変える）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAuthEmailRelease } from "./lib/auth-email-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
if (!arg) {
  console.log(JSON.stringify({ verdict: "AUTH_EMAIL_RELEASE_BLOCKED", problems: ["input_path_missing"] }));
  process.exit(1);
}
const file = path.resolve(ROOT, arg);
if (!file.startsWith(ROOT + path.sep)) {
  console.log(JSON.stringify({ verdict: "AUTH_EMAIL_RELEASE_BLOCKED", problems: ["input_outside_repository"] }));
  process.exit(1);
}
let input;
try {
  input = JSON.parse(readFileSync(file, "utf8"));
} catch {
  console.log(JSON.stringify({ verdict: "AUTH_EMAIL_RELEASE_BLOCKED", problems: ["input_not_json"] }));
  process.exit(1);
}
const result = evaluateAuthEmailRelease(input);
console.log(JSON.stringify(result, null, 2));
process.exit(result.verdict === "AUTH_EMAIL_RELEASE_READY" ? 0 : 1);
