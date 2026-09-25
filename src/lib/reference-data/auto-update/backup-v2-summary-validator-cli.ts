import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { validateBackupV2Summary } from "./backup-v2-summary-validator";

/**
 * Stage 3以降: 本人がダウンロードしたBackup要約artifactを検証するCLI(ネットワーク・DB・Secretを使わない)。
 *
 *   npx tsc -p tsconfig.backup-summary-validation.json
 *   node scripts/validate-backup-v2-summary-entry.mjs ./data/<folder>/reference-data-backup-summary.json \
 *     --expected-counts=world_player_cards:13297,managers:67,player_card_analysis:19,import_batches:10
 *
 * 行数は、そのBackupを取った時点のProductionの件数(直前のplan・applied-stateの値)と照合する。
 * `--expected-counts`を省略した場合は行数を照合せず、出力の`rowCountsCompared: false`で明示する
 * (以前の既定はRun #7の件数で、Stage 4・World更新後の正しい件数を不一致として扱っていた。2026-09-25修正)。
 * 読み取るのは、作業フォルダ配下の`*.json`ファイル1つだけ(64KiB以下)。
 */

const MAX_BYTES = 64 * 1024;
const TABLES = ["world_player_cards", "managers", "player_card_analysis", "import_batches"] as const;

export function resolveSummaryPath(arg: string | undefined, cwd: string): string {
  if (!arg || !/\.json$/.test(arg) || /[\r\n\0]/.test(arg)) throw new Error("summary_path_invalid");
  const abs = path.resolve(cwd, arg);
  const rel = path.relative(cwd, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("summary_path_outside_workspace");
  return abs;
}

/** `--expected-counts=table:n,...`(4 tableちょうど、0以上の整数)。 */
export function parseExpectedCounts(arg: string | undefined): Record<string, number> | null {
  if (arg === undefined) return null;
  const m = /^--expected-counts=(.+)$/.exec(arg);
  if (!m) throw new Error("summary_expected_counts_invalid");
  const out: Record<string, number> = {};
  for (const part of m[1].split(",")) {
    const [t, n] = part.split(":");
    if (!(TABLES as readonly string[]).includes(t) || !/^\d{1,9}$/.test(n ?? "") || t in out) throw new Error("summary_expected_counts_invalid");
    out[t] = Number(n);
  }
  if (Object.keys(out).length !== TABLES.length) throw new Error("summary_expected_counts_invalid");
  return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  let out: unknown;
  try {
    const p = resolveSummaryPath(argv[0], process.cwd());
    const expected = parseExpectedCounts(argv[1]);
    if (statSync(p).size > MAX_BYTES) throw new Error("summary_too_large");
    out = { ...validateBackupV2Summary(readFileSync(p, "utf8"), { baselineRowCounts: expected }), rowCountsCompared: expected !== null };
  } catch (err) {
    const code = err instanceof Error && /^summary_[a-z_]+$/.test(err.message) ? err.message : "summary_read_failed";
    out = { ok: false, verdict: "BACKUP_V2_INVALID", problems: [code], facts: {} };
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exitCode = (out as { ok: boolean }).ok ? 0 : 1;
}
