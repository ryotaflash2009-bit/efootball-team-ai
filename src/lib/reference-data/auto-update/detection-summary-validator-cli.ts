import { readFileSync, statSync } from "node:fs";
import { resolveSummaryPath } from "./backup-v2-summary-validator-cli";
import { DETECTION_SUMMARY_MAX_BYTES, validateDetectionSummary } from "./detection-summary-validator";
import { APPLIED_STATE_FILE, parseAppliedState } from "./update-detection";

/**
 * 本人またはClaude Codeがダウンロードした検出要約artifactを検証するCLI(ネットワーク・DB・Secretを使わない)。
 *
 *   npx tsc -p tsconfig.update-detection.json
 *   node scripts/validate-detection-summary-entry.mjs ./data/<folder>/reference-data-detection-summary.json
 *
 * 比較の基準はリポジトリのapplied-state記録。読み取るのは作業フォルダ配下の`*.json`ファイル1つとapplied-stateだけ。
 */
export function main(argv: readonly string[] = process.argv.slice(2)): void {
  let out: unknown;
  try {
    const p = resolveSummaryPath(argv[0], process.cwd());
    if (statSync(p).size > DETECTION_SUMMARY_MAX_BYTES) throw new Error("summary_too_large");
    const applied = parseAppliedState(readFileSync(resolveSummaryPath(APPLIED_STATE_FILE, process.cwd()), "utf8"));
    out = validateDetectionSummary(readFileSync(p, "utf8"), applied);
  } catch (err) {
    const code = err instanceof Error && /^(summary|applied_state)_[a-z_]+$/.test(err.message) ? err.message : "summary_read_failed";
    out = { ok: false, verdict: "DETECTION_SUMMARY_INVALID", problems: [code], facts: {} };
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exitCode = (out as { ok: boolean }).ok ? 0 : 1;
}
