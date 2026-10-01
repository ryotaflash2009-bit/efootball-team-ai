#!/usr/bin/env node
/**
 * Production apply workflow の最後に always() で動き、機械可読 Evidence を書く（Secret は渡されない）。
 *
 * 入力: EVIDENCE_MODE・EVIDENCE_DATASET・EVIDENCE_WORK_DIR（$RUNNER_TEMP/stage4）・EVIDENCE_SUMMARY_PATH・EVIDENCE_OUT_DIR
 *       と GitHub の既定の環境変数（GITHUB_RUN_ID など）・STAGE4_APPROVED_BY（apply の承認者）。
 * 出力: EVIDENCE_OUT_DIR/evidence.json と、applied_verified のときだけ applied-state.candidate.json。
 * Evidence を作れなくても job の結果は変えない（警告だけ出す）。apply の成否は前の step が決める。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildApplyEvidence } from "./lib/reference-data-evidence.mjs";

const MAX_BYTES = 64 * 1024 * 1024;
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** dir 直下のファイルだけ（再帰しない）。 */
function hashDir(base, sub) {
  const dir = path.join(base, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(path.join(dir, n)).isFile() && statSync(path.join(dir, n)).size <= MAX_BYTES)
    .sort()
    .map((n) => ({ path: `${sub}/${n}`, sha256: sha256(path.join(dir, n)) }));
}

function readJson(p) {
  try {
    if (!p || !existsSync(p) || statSync(p).size > MAX_BYTES) return undefined;
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

function main(env) {
  const work = env.EVIDENCE_WORK_DIR ?? "";
  const outDir = env.EVIDENCE_OUT_DIR ?? "";
  if (!work || !outDir) throw new Error("evidence_paths_missing");
  const dataset = env.EVIDENCE_DATASET === "world" ? "world" : "managers";
  const inputs = ["plan", "backup", "dry-run", "apply"].flatMap((d) => hashDir(work, d)).concat(
    readdirSync(work).filter((n) => /^facts-[a-z-]+\.json$|^plan-runs\.json$/.test(n)).sort().map((n) => ({ path: n, sha256: sha256(path.join(work, n)) })),
  );
  const outputs = hashDir(work, "out");
  const summaryPath = env.EVIDENCE_SUMMARY_PATH ?? "";
  if (summaryPath && existsSync(summaryPath)) outputs.push({ path: "reference-data-apply-summary.json", sha256: sha256(summaryPath) });
  const { evidence, candidate } = buildApplyEvidence({
    env,
    summary: readJson(summaryPath),
    inputs,
    outputs,
    applyResult: readJson(path.join(work, "out", `stage4-${dataset}-apply-result.json`)),
    bundle: readJson(path.join(work, "plan", `stage4-${dataset}-bundle.json`)),
    now: new Date().toISOString(),
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  if (candidate) writeFileSync(path.join(outDir, "applied-state.candidate.json"), `${JSON.stringify(candidate, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  const lines = [
    "### Evidence",
    `- outcome: \`${evidence.outcome}\` / mode: \`${evidence.mode}\` / dataset: \`${evidence.dataset}\``,
    `- run: ${evidence.runId} (attempt ${evidence.runAttempt}) / commit: ${evidence.commitSha?.slice(0, 12) ?? "-"} / actor: ${evidence.actor ?? "-"} / approver: ${evidence.approvedBy ?? "-"}`,
    `- inputs: ${evidence.inputs.length} files / outputs: ${evidence.outputs.length} files`,
    `- applied-state candidate: ${candidate ? `${candidate.dataset} ${candidate.entry.sourceChecksum12} (${candidate.entry.recordCount})` : "none"}`,
  ];
  console.log(lines.join("\n"));
  if (env.GITHUB_STEP_SUMMARY) writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
}

try {
  main(process.env);
} catch (err) {
  console.log(`::warning::evidence not written (${err instanceof Error ? err.message.slice(0, 80) : "unknown"})`);
}
