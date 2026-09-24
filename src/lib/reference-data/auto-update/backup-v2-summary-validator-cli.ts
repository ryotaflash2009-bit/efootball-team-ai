import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { validateBackupV2Summary } from "./backup-v2-summary-validator";

/**
 * Stage 3: 本人がダウンロードしたBackup要約artifactを検証するCLI(ネットワーク・DB・Secretを使わない)。
 *
 *   npx tsc -p tsconfig.backup-summary-validation.json
 *   node scripts/validate-backup-v2-summary-entry.mjs ./data/<folder>/reference-data-backup-summary.json
 *
 * 読み取るのは、作業フォルダ配下の`*.json`ファイル1つだけ(64KiB以下)。
 */

const MAX_BYTES = 64 * 1024;

export function resolveSummaryPath(arg: string | undefined, cwd: string): string {
  if (!arg || !/\.json$/.test(arg) || /[\r\n\0]/.test(arg)) throw new Error("summary_path_invalid");
  const abs = path.resolve(cwd, arg);
  const rel = path.relative(cwd, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("summary_path_outside_workspace");
  return abs;
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  let out: unknown;
  try {
    const p = resolveSummaryPath(argv[0], process.cwd());
    if (statSync(p).size > MAX_BYTES) throw new Error("summary_too_large");
    out = validateBackupV2Summary(readFileSync(p, "utf8"));
  } catch (err) {
    const code = err instanceof Error && /^summary_[a-z_]+$/.test(err.message) ? err.message : "summary_read_failed";
    out = { ok: false, verdict: "BACKUP_V2_INVALID", problems: [code], facts: {} };
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exitCode = (out as { ok: boolean }).ok ? 0 : 1;
}
