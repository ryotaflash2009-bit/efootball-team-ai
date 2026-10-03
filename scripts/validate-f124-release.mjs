/**
 * F-124 を終えてよいかの確認（CLI・ファイルの読み取りだけ・外部アクセスなし）。
 *
 *   node scripts/validate-f124-release.mjs docs/production-readiness/f124-release-checklist.json
 *
 * READY でも何も開かない（家族・友人への試用・新規登録・コミュニティの公開は本人の判断）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateF124 } from "./lib/f124-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
const file = arg ? path.resolve(ROOT, arg) : "";
if (!arg || !file.startsWith(ROOT + path.sep)) {
  console.log(JSON.stringify({ verdict: "F124_BLOCKED", problems: [arg ? "input_outside_repository" : "input_path_missing"] }));
  process.exit(1);
}
let input;
try {
  input = JSON.parse(readFileSync(file, "utf8"));
} catch {
  console.log(JSON.stringify({ verdict: "F124_BLOCKED", problems: ["input_not_json"] }));
  process.exit(1);
}
const r = evaluateF124(input);
console.log(JSON.stringify(r, null, 2));
process.exit(r.verdict === "F124_READY_FOR_OWNER_DECISION" ? 0 : 1);
