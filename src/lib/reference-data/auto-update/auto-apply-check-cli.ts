import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluateAutoApplyFromArtifacts } from "./auto-apply-from-artifacts";
import { AUTO_APPLY_POLICY } from "./auto-apply-policy-config";

/**
 * 自動の Apply job（route=automatic）の中で、書き込みの資格情報を使う step の前に実行する再確認。
 *
 * - kill switch（Repository variable 3 つ）がすべて "true" でなければ止める（次の run から書き込みを止められる）。
 * - Plan・Backup・Dry run の要約 artifact と、bind された run の事実から、orchestrator と同じ判定をやり直す。
 * - AUTO_APPLY_ELIGIBLE 以外は exit 1（後続の書き込みの step へ進まない）。Secret・Production には触れない。
 */
type Env = Readonly<Record<string, string | undefined>>;
const MAX = 8 * 1024 * 1024;
const RUN = /^[0-9]{1,20}$/;
const SHA40 = /^[0-9a-f]{40}$/;

function read(p: string): string {
  if (!existsSync(p) || statSync(p).size > MAX) throw new Error(`input_missing:${path.basename(p)}`);
  return readFileSync(p, "utf8");
}

export function checkKillSwitches(env: Env, dataset: string): string[] {
  const k = AUTO_APPLY_POLICY.killSwitches;
  const problems: string[] = [];
  if (env.AUTO_APPLY_ENABLED !== "true") problems.push(`kill_switch_off:${k.all}`);
  if (dataset === "world" && env.AUTO_APPLY_WORLD_ENABLED !== "true") problems.push(`kill_switch_off:${k.world}`);
  if (dataset === "managers" && env.AUTO_APPLY_MANAGERS_ENABLED !== "true") problems.push(`kill_switch_off:${k.managers}`);
  return problems;
}

/** 適用済みの sourceChecksum12（リポジトリの applied-state）。読めなければ null（判定は orchestrator 側の確認に任せない: null は「適用済みでない」だけを意味する）。 */
function appliedChecksum12(root: string, dataset: string): string | null {
  try {
    const s = JSON.parse(readFileSync(path.join(root, "docs", "production-readiness", "reference-data-applied-state.json"), "utf8")) as { datasets?: Record<string, { sourceChecksum12?: string }> };
    const v = s.datasets?.[dataset === "world" ? "world_player_cards" : "managers"]?.sourceChecksum12;
    return typeof v === "string" && /^[0-9a-f]{12}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function runAutoApplyCheck(env: Env, now: Date): { ok: boolean; result: Record<string, unknown> } {
  const dataset = env.REFERENCE_DATA_APPLY_DATASET === "world" ? "world" : env.REFERENCE_DATA_APPLY_DATASET === "managers" ? "managers" : null;
  if (env.REFERENCE_DATA_APPLY_ROUTE !== "automatic" || env.REFERENCE_DATA_APPLY_MODE !== "apply" || !dataset) {
    return { ok: false, result: { decision: "INVALID_INPUT", reasonCodes: ["route_mode_dataset_invalid"] } };
  }
  const killed = checkKillSwitches(env, dataset);
  if (killed.length) return { ok: false, result: { decision: "AUTO_APPLY_BLOCKED", reasonCodes: killed } };
  const dir = env.STAGE4_WORK_DIR ?? "";
  const sha = env.GITHUB_SHA ?? "";
  const main = env.CURRENT_MAIN_SHA ?? "";
  const backupRunId = env.STAGE4_BACKUP_RUN_ID ?? "";
  const dryRunRunId = env.STAGE4_DRY_RUN_RUN_ID ?? "";
  if (!path.isAbsolute(dir) || !SHA40.test(sha) || !SHA40.test(main) || !RUN.test(backupRunId) || !RUN.test(dryRunRunId)) {
    return { ok: false, result: { decision: "INVALID_INPUT", reasonCodes: ["inputs_invalid"] } };
  }
  try {
    const backupFacts = JSON.parse(read(path.join(dir, "facts-backup.json"))) as { updatedAt?: unknown; conclusion?: unknown };
    if (backupFacts.conclusion !== "success" || typeof backupFacts.updatedAt !== "string") return { ok: false, result: { decision: "AUTO_APPLY_BLOCKED", reasonCodes: ["backup_run_not_successful"] } };
    const planText = read(path.join(dir, "autocheck", "plan", "reference-data-apply-summary.json"));
    const r = evaluateAutoApplyFromArtifacts({
      dataset,
      bindingSha: sha,
      currentMainSha: main,
      // 候補の新しさ（検出との一致）は orchestrator が確かめる。ここでは Plan の source を基準にする。
      detectionChecksum12: (() => {
        try {
          const p = JSON.parse(planText) as { facts?: { plan?: { sourceChecksum?: string } } };
          return typeof p.facts?.plan?.sourceChecksum === "string" ? p.facts.plan.sourceChecksum.slice(0, 12) : null;
        } catch {
          return null;
        }
      })(),
      appliedChecksum12: appliedChecksum12(env.GITHUB_WORKSPACE ?? process.cwd(), dataset),
      planSummaryText: planText,
      backupSummaryText: read(path.join(dir, "backup", "reference-data-backup-summary.json")),
      backupRunId,
      backupCompletedAt: backupFacts.updatedAt,
      dryRunSummaryText: read(path.join(dir, "autocheck", "dry-run", "reference-data-apply-summary.json")),
      dryRunRunId,
      now: now.toISOString(),
    });
    return { ok: r.decision === "AUTO_APPLY_ELIGIBLE", result: r as unknown as Record<string, unknown> };
  } catch (e) {
    const code = e instanceof Error && /^input_missing:[\w.-]+$/.test(e.message) ? e.message : "check_failed";
    return { ok: false, result: { decision: "AUTO_APPLY_BLOCKED", reasonCodes: [code] } };
  }
}

export function main(env: Env = process.env): number {
  const { ok, result } = runAutoApplyCheck(env, new Date());
  const text = `${JSON.stringify(result, null, 2)}\n`;
  process.stdout.write(text);
  const out = env.AUTO_APPLY_CHECK_PATH;
  if (out && path.isAbsolute(out)) writeFileSync(out, text, { encoding: "utf8", mode: 0o600 });
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `### Auto-apply re-check\n\n- decision: \`${String(result.decision)}\`\n- reasons: ${(result.reasonCodes as string[] | undefined)?.join(", ") || "none"}\n`);
  return ok ? 0 : 1;
}
