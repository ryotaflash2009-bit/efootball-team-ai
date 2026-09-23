import { writeFileSync } from "node:fs";
import { Client } from "pg";
import { buildProductionPgClientConfig } from "./backup-db-connection";
import { runUpdaterPreflight } from "./production-apply-preflight";
import { APPLY_SECRET_NAMES } from "./update-contract";
import { sanitizeErrorMessage } from "../real-import-guards";

/**
 * `reference-data-production-apply.yml`から実行されるCLI(Stage 2時点ではpreflight modeだけ)。
 *
 *   REFERENCE_DATA_APPLY_MODE=preflight node scripts/run-production-apply-entry.mjs
 *
 * - preflight: reference_data_updaterとしてTLS(CA固定)で接続し、`begin read only`の中で
 *   runUpdaterPreflightを実行してrollbackする。行データは読まず、書き込みもしない。
 * - apply: Stage 4(初回Production更新リハーサル)の別承認まで実装しない。指定されたら接続前に拒否する。
 * - 必須Secretが無ければ接続を試みずに停止する。出力・要約artifactにSecret値を含めない。
 */

export const APPLY_MODES = ["preflight"] as const;

export function readApplySecrets(env: Readonly<Record<string, string | undefined>>): Record<(typeof APPLY_SECRET_NAMES)[number], string> {
  const missing = APPLY_SECRET_NAMES.filter((n) => !env[n]);
  if (missing.length > 0) throw new Error(`必須環境変数が不足している(blocked): ${missing.join(", ")}`);
  const out = {} as Record<(typeof APPLY_SECRET_NAMES)[number], string>;
  for (const n of APPLY_SECRET_NAMES) out[n] = env[n] as string;
  return out;
}

function writeSummary(path: string | undefined, summary: Record<string, unknown>, secretValues: readonly string[]): void {
  if (!path) return;
  if (!/\.json$/.test(path) || /[\r\n\0]/.test(path)) throw new Error("要約の出力先が不正(blocked)");
  const text = `${JSON.stringify(summary, null, 2)}\n`;
  for (const v of secretValues) {
    if (v.trim().length < 8) continue;
    const probes = [v, ...v.split(/\r?\n/).filter((l) => l.trim().length >= 16)];
    if (probes.some((p) => text.includes(p))) throw new Error("要約にSecret値が含まれているため書き出さない(blocked)");
  }
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

export async function main(): Promise<void> {
  const env = process.env;
  let exitCode = 1;
  let client: Client | null = null;
  let secrets: Record<string, string> = {};
  let summary: Record<string, unknown> = { ok: false, phase: "start" };
  try {
    const mode = env.REFERENCE_DATA_APPLY_MODE ?? "";
    if (!(APPLY_MODES as readonly string[]).includes(mode)) {
      throw new Error("REFERENCE_DATA_APPLY_MODEはpreflightだけ許可(applyはStage 4の別承認まで無効、blocked)");
    }
    secrets = readApplySecrets(env);
    const config = buildProductionPgClientConfig(secrets.REFERENCE_DATA_APPLY_DB_URL, secrets.REFERENCE_DATA_APPLY_DB_CA_CERT);
    client = new Client(config);
    await client.connect();
    await client.query("begin read only");
    try {
      const result = await runUpdaterPreflight(client);
      summary = { ok: result.ok, phase: "preflight", mode, problems: result.problems, facts: result.facts, checkedAt: new Date().toISOString() };
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
    exitCode = summary.ok === true ? 0 : 1;
  } catch (err) {
    summary = { ok: false, phase: summary.phase === "start" ? "setup" : summary.phase, reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))] };
    exitCode = 1;
  } finally {
    await client?.end().catch(() => undefined);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  try {
    writeSummary(env.REFERENCE_DATA_APPLY_SUMMARY_PATH, summary, Object.values(secrets));
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ ok: false, reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))] })}\n`);
    exitCode = 1;
  }
  process.exitCode = exitCode;
}
