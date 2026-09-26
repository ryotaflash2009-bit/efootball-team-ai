import { writeFileSync } from "node:fs";
import { Client, type ClientConfig } from "pg";
import { buildProductionPgClientConfig } from "./backup-db-connection";
import { runUpdaterPreflight, safeErrorCode } from "./production-apply-preflight";
import { APPLY_SECRET_NAMES, BACKUP_SECRET_NAMES, PLAN_READ_SECRET_NAMES } from "./update-contract";
import { runStage4Mode } from "./stage4-managers-cli";
import { runWorldMode } from "./stage4-world-cli";
import type { Stage4Mode } from "./stage4-managers";

/**
 * `reference-data-production-apply.yml`から実行されるCLI。
 *
 *   REFERENCE_DATA_APPLY_MODE=<mode> node scripts/run-production-apply-entry.mjs
 *
 * - preflight: reference_data_updaterとしてTLS(CA固定)で接続し、`begin read only`の中で
 *   runUpdaterPreflightを実行してrollbackする。行データは読まず、書き込みもしない。
 * - plan / dry-run / apply / verify: Stage 4のProduction更新リハーサル。REFERENCE_DATA_APPLY_DATASET=managers(既定、
 *   stage4-managers-cli.ts) | world(stage4-world-cli.ts)。書き込みはapplyだけ(全binding・前提条件を満たした場合に1 transaction)。
 * - 上記以外のmodeは接続前に拒否する。
 * - 必須Secretが無ければ接続を試みずに停止する。modeごとに使うcredentialは1種類だけ(承認1回化):
 *   plan = 読み取り専用のPLAN_READ、dry-run = なし(Productionへ接続しない)、preflight/apply/verify = APPLY。
 *   modeに合わないcredentialを受け取った場合も接続前に停止する(workflowの設定誤りに対する二重防御)。
 * - 出力・要約artifactには、段階(phase)と安全なreason code(SQLSTATE・Node.jsのerror code)だけを残し、
 *   エラー本文・URL・SQL・Secret値を含めない。
 */

export const APPLY_MODES = ["preflight", "plan", "dry-run", "apply", "verify"] as const;

export type PreflightPhase = "mode" | "secrets" | "config" | "connect" | "preflight" | Stage4Mode;

export interface PreflightSummary {
  readonly ok: boolean;
  readonly phase: PreflightPhase;
  readonly reasons: readonly string[];
  readonly facts?: Readonly<Record<string, unknown>>;
  readonly checkedAt: string;
}

/** modeごとに必要なSecret名(dry-runは空=Productionへ接続しない)。 */
export function secretNamesForMode(mode: string): readonly string[] {
  if (mode === "plan") return PLAN_READ_SECRET_NAMES;
  if (mode === "dry-run") return [];
  return APPLY_SECRET_NAMES;
}

/** modeに渡してはいけないcredentialが環境にあれば、その名前を返す。 */
export function forbiddenCredentialsForMode(mode: string, env: Readonly<Record<string, string | undefined>>): string[] {
  const forbidden =
    mode === "dry-run" ? [...APPLY_SECRET_NAMES, ...PLAN_READ_SECRET_NAMES, ...BACKUP_SECRET_NAMES]
    : mode === "plan" ? [...APPLY_SECRET_NAMES, ...BACKUP_SECRET_NAMES]
    : [...PLAN_READ_SECRET_NAMES, ...BACKUP_SECRET_NAMES];
  return forbidden.filter((n) => !!env[n]);
}

export function readApplySecrets(env: Readonly<Record<string, string | undefined>>): Record<(typeof APPLY_SECRET_NAMES)[number], string> {
  const missing = APPLY_SECRET_NAMES.filter((n) => !env[n]);
  if (missing.length > 0) throw new Error(`必須環境変数が不足している(blocked): ${missing.join(", ")}`);
  const out = {} as Record<(typeof APPLY_SECRET_NAMES)[number], string>;
  for (const n of APPLY_SECRET_NAMES) out[n] = env[n] as string;
  return out;
}

/** 接続前に判定する(apply等の未許可modeはここで止まり、Secret・DBへ触れない)。 */
export function checkApplyMode(mode: string | undefined): boolean {
  return (APPLY_MODES as readonly string[]).includes(mode ?? "");
}

const summary = (ok: boolean, phase: PreflightPhase, reasons: readonly string[], facts?: Readonly<Record<string, unknown>>): PreflightSummary => ({
  ok,
  phase,
  reasons,
  ...(facts ? { facts } : {}),
  checkedAt: new Date().toISOString(),
});

/** 接続設定を受け取り、接続 → read-only preflight → rollback を行う(テストでは使い捨てDBの設定を渡す)。 */
export async function runPreflightWithConfig(config: ClientConfig, schema = "reference_data"): Promise<PreflightSummary> {
  const client = new Client(config);
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined);
    return summary(false, "connect", [`connect_failed:${safeErrorCode(err)}`]);
  }
  try {
    await client.query("begin read only");
    try {
      const r = await runUpdaterPreflight(client, schema);
      return summary(r.ok, "preflight", r.problems, r.facts);
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
  } catch (err) {
    return summary(false, "preflight", [`preflight_failed:${safeErrorCode(err)}`]);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function writeSummary(path: string | undefined, s: PreflightSummary, secretValues: readonly string[]): void {
  if (!path) return;
  if (!/\.json$/.test(path) || /[\r\n\0]/.test(path)) throw new Error("summary_path_invalid");
  const text = `${JSON.stringify(s, null, 2)}\n`;
  for (const v of secretValues) {
    if (v.trim().length < 8) continue;
    const probes = [v, ...v.split(/\r?\n/).filter((l) => l.trim().length >= 16)];
    if (probes.some((p) => text.includes(p))) throw new Error("summary_contains_secret");
  }
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

export async function main(): Promise<void> {
  const env = process.env;
  let secrets: Record<string, string> = {};
  let result: PreflightSummary | undefined;
  const mode = env.REFERENCE_DATA_APPLY_MODE ?? "";
  if (!checkApplyMode(mode)) {
    result = summary(false, "mode", ["mode_not_allowed"]);
  } else {
    const unexpected = forbiddenCredentialsForMode(mode, env);
    const names = secretNamesForMode(mode);
    const missing = names.filter((n) => !env[n]);
    if (unexpected.length > 0) {
      // 名前だけを出す(値は出さない)。
      result = summary(false, "secrets", [`credential_not_allowed_for_mode(blocked): ${unexpected.join(", ")}`]);
    } else if (missing.length > 0) {
      // 不足したSecretの「名前」だけを出す(値は存在しない)。
      result = summary(false, "secrets", [`必須環境変数が不足している(blocked): ${missing.join(", ")}`]);
    } else {
      for (const n of names) secrets[n] = env[n] as string;
      let config: ClientConfig | null = null;
      if (names.length === 2) {
        try {
          config = buildProductionPgClientConfig(secrets[names[0]], secrets[names[1]]);
        } catch {
          result = summary(false, "config", ["config_invalid"]);
        }
      }
      if (!result) {
        const m = mode as (typeof APPLY_MODES)[number];
        if (m === "preflight") result = await runPreflightWithConfig(config as ClientConfig);
        else {
          // dataset: managers(既定) | world。それ以外は接続せずに停止する。dry-runはconfig=null(接続しない)。
          const dataset = env.REFERENCE_DATA_APPLY_DATASET ?? "managers";
          const o =
            dataset === "world" ? await runWorldMode(m, env, config)
            : dataset === "managers" ? await runStage4Mode(m, env, config)
            : { ok: false, reasons: ["dataset_not_allowed"], facts: {} };
          result = summary(o.ok, m, o.reasons, o.facts);
        }
      }
    }
  }
  let exitCode = result!.ok ? 0 : 1;
  process.stdout.write(`${JSON.stringify(result!, null, 2)}\n`);
  try {
    writeSummary(env.REFERENCE_DATA_APPLY_SUMMARY_PATH, result!, Object.values(secrets));
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ ok: false, reasons: [err instanceof Error && /^summary_/.test(err.message) ? err.message : "summary_write_failed"] })}\n`);
    exitCode = 1;
  }
  process.exitCode = exitCode;
}
