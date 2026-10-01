/**
 * F-071: 定期検出の候補（world-base-distribution.candidate.json）を、applied-state と照合してから
 * src/lib/percentiles/data/world-base-distribution.json へ置く（Apply 後の Evidence PR・変化なし時の PR で使う）。
 *
 *   gh run download <detection run id> --name world-base-distribution-candidate --dir data/work/<dir>
 *   node scripts/import-world-distribution.mjs data/work/<dir>/world-base-distribution.candidate.json
 *
 * - DISTRIBUTION_ARTIFACT_VALID のときだけ書き込む（STALE / INVALID / INCOMPLETE なら何もしない・終了コード 1）。
 * - 入力はリポジトリ内のファイルだけ。外部アクセスなし。applied-state は先に更新しておくこと（Apply 後の場合）。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
const fail = (reason) => {
  console.log(JSON.stringify({ imported: false, reason }));
  process.exit(1);
};
if (!arg) fail("candidate_path_missing");
const candidatePath = path.resolve(ROOT, arg);
if (!candidatePath.startsWith(ROOT + path.sep)) fail("candidate_outside_repository");
if (!existsSync(candidatePath)) fail("candidate_not_found");

// 検証は検出と同じコード（tsc でコンパイル済みのもの）を使う。
execFileSync(process.execPath, [path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(ROOT, "tsconfig.update-detection.json")], { stdio: "inherit" });
writeFileSync(path.join(ROOT, "dist-update-detection", "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
const { checkDistributionArtifact, appliedWorldStateFrom } = await import(new URL("../dist-update-detection/percentiles/artifact.js", import.meta.url).href);

let candidate;
try {
  candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
} catch {
  fail("candidate_not_json");
}
const applied = JSON.parse(readFileSync(path.join(ROOT, "docs", "production-readiness", "reference-data-applied-state.json"), "utf8"));
const check = checkDistributionArtifact(candidate, appliedWorldStateFrom(applied));
if (check.verdict !== "DISTRIBUTION_ARTIFACT_VALID") {
  console.log(JSON.stringify({ imported: false, verdict: check.verdict, problems: check.problems }));
  process.exit(1);
}
const target = path.join(ROOT, "src", "lib", "percentiles", "data", "world-base-distribution.json");
writeFileSync(target, `${JSON.stringify(candidate)}\n`, "utf8");
console.log(JSON.stringify({ imported: true, verdict: check.verdict, binding: candidate.binding, generatedAt: candidate.generatedAt, target: path.relative(ROOT, target) }));
