import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { APPLIED_STATE_FILE, parseAppliedState, runDetection, type DetectionResult } from "./update-detection";
import { decideDetectionRun, decideDetectionTrigger } from "./update-schedule";
import { WORLD_LIMITS } from "./stage4-world";
import { DETECTION_APPROVAL_TOKEN, createUpstreamHttpTransport, type UpstreamRequestLogEntry } from "./upstream-http-transport";
import { WORLD_STAT_KEYS } from "./source-world";
import { buildDistributionArtifact, type DistributionSourceRow } from "../../percentiles/generate";
import { checkDistributionArtifact, type DistributionArtifact } from "../../percentiles/artifact";

/**
 * F-071: 完全な World の行から、基礎能力値の分布の候補（非秘密の集計値だけ）を書き出す。
 * 検出の結果には影響させない（失敗しても検出は続ける）。main へ入れるのは Production Apply 後の Evidence の PR。
 */
export function buildDistributionCandidate(rows: readonly unknown[], sourceChecksum12: string, generatedAt: string): DistributionArtifact | null {
  try {
    const artifact = buildDistributionArtifact(rows as readonly DistributionSourceRow[], WORLD_STAT_KEYS, {
      sourceChecksum12,
      generatedAt,
      datasetVersion: `world_player_cards@${sourceChecksum12}`,
    });
    // 候補自体の形だけを確かめる（applied-state との一致は main へ入れるときに確かめる）。
    const check = checkDistributionArtifact(artifact, { sourceChecksum12, recordCount: rows.length });
    return check.verdict === "DISTRIBUTION_ARTIFACT_VALID" ? artifact : null;
  } catch {
    return null;
  }
}

export function writeDistributionCandidate(rows: readonly unknown[], sourceChecksum12: string, filePath: string, generatedAt: string): "written" | "invalid" | "skipped" {
  if (!/\.json$/.test(filePath) || /[\r\n\0]/.test(filePath)) return "skipped";
  const artifact = buildDistributionCandidate(rows, sourceChecksum12, generatedAt);
  if (!artifact) return "invalid";
  try {
    writeFileSync(filePath, `${JSON.stringify(artifact)}\n`, "utf8");
    return "written";
  } catch {
    return "invalid";
  }
}

/**
 * 定期検出のCLI(`reference-data-update-detection.yml`から実行)。Secret・Environment・Productionを使わない。
 *
 *   REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED=true node scripts/run-update-detection-entry.mjs
 *
 * 有効化の変数が"true"でなければupstreamへ1件も送らずに停止する。GitHub Actions上では、起動元が
 * schedule、または確認入力"detect"付きのworkflow_dispatchでなければ同じく停止する。
 * 要約(件数・checksum先頭12文字・判定・安全項目)だけを出力し、upstreamの本文は保存しない。
 * 終了コード: no_change・update_available → 0、attention_required・取得停止 → 1(jobを赤にして本人へ通知する)。
 */

export const DETECTION_SUMMARY_SCHEMA = "reference-data-detection-summary/v2";

/** 検出は何も自動実行しない(要約に明示し、validatorで確認する)。 */
export const DETECTION_SAFETY = Object.freeze({
  productionAccess: 0,
  secretsUsed: 0,
  automaticPlan: false,
  automaticBackup: false,
  automaticApply: false,
  automaticRollback: false,
  automaticRestore: false,
  appliedStateUpdated: false,
  rawPayloadStored: false,
});

export type OverallDecision = "no_change" | "update_available" | "attention_required" | "fetch_stopped";

export function summarizeUpstream(log: readonly UpstreamRequestLogEntry[], challengeStop: boolean) {
  return {
    requests: log.length,
    worldRequests: log.filter((l) => l.sourceId === "efootball-world").length,
    managersRequests: log.filter((l) => l.sourceId === "managers-json").length,
    non200: log.filter((l) => l.status !== 200).length,
    http403: log.filter((l) => l.status === 403).length,
    http429: log.filter((l) => l.status === 429).length,
    challenge: challengeStop ? 1 : 0,
    totalBytes: log.reduce((a, l) => a + l.bytes, 0),
  };
}

/** 要約本体(pure)。 */
export function buildDetectionSummary(input: { trigger: string; fetchedAt: string; result: DetectionResult; log: readonly UpstreamRequestLogEntry[] }): Record<string, unknown> {
  const r = input.result;
  const upstream = summarizeUpstream(input.log, !r.ok && r.failure.code === "captcha");
  const base = { schema: DETECTION_SUMMARY_SCHEMA, phase: "detection", trigger: input.trigger, fetchedAt: input.fetchedAt, upstream };
  if (!r.ok) {
    const overall: OverallDecision = r.attention ? "attention_required" : "fetch_stopped";
    return { ...base, ok: false, overall, reasons: [`${r.failure.table}:${r.failure.stage}:${r.failure.code}`], safety: DETECTION_SAFETY, productionAccess: 0, automaticApply: false };
  }
  const decisions = [r.world.decision, r.managers.decision];
  const overall: OverallDecision = decisions.includes("attention_required") ? "attention_required" : decisions.includes("update_available") ? "update_available" : "no_change";
  return {
    ...base,
    ok: true,
    overall,
    world: r.world,
    managers: r.managers,
    safety: DETECTION_SAFETY,
    productionAccess: 0,
    automaticApply: false,
    nextStep: "update_available/attention_required → owner reviews and runs the approval-gated plan (docs/production-readiness/stage4-world-rehearsal-runbook.md); nothing is applied automatically",
  };
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function main(env: Readonly<Record<string, string | undefined>> = process.env): Promise<number> {
  const out = (o: Record<string, unknown>) => {
    const text = `${JSON.stringify({ ...o, checkedAt: new Date().toISOString() }, null, 2)}\n`;
    process.stdout.write(text);
    const p = env.REFERENCE_DATA_DETECTION_SUMMARY_PATH;
    if (p && /\.json$/.test(p) && !/[\r\n\0]/.test(p)) writeFileSync(p, text, "utf8");
  };
  const gate = decideDetectionRun({ stage: "detection", enableVariable: env.REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED, realNetworkApproved: true });
  if (!gate.run) {
    out({ ok: false, phase: "gate", reasons: [gate.reason], upstreamRequests: 0 });
    return 1;
  }
  const trigger = env.GITHUB_ACTIONS === "true" ? (env.GITHUB_EVENT_NAME ?? "") : "local";
  if (env.GITHUB_ACTIONS === "true") {
    const t = decideDetectionTrigger({ eventName: env.GITHUB_EVENT_NAME, confirm: env.REFERENCE_DATA_DETECTION_CONFIRM });
    if (!t.run) {
      out({ ok: false, phase: "gate", reasons: [t.reason], upstreamRequests: 0 });
      return 1;
    }
  }
  let applied;
  try {
    applied = parseAppliedState(readFileSync(path.join(process.cwd(), APPLIED_STATE_FILE), "utf8"));
  } catch (err) {
    out({ ok: false, phase: "applied_state", reasons: [err instanceof Error && /^applied_state_/.test(err.message) ? err.message : "applied_state_unreadable"], upstreamRequests: 0 });
    return 1;
  }
  const transport = createUpstreamHttpTransport({
    approval: DETECTION_APPROVAL_TOKEN,
    maxRequests: { "efootball-world": WORLD_LIMITS.maxRequests, "managers-json": 1 },
    maxTotalBytes: WORLD_LIMITS.maxTotalBytes,
  });
  const fetchedAt = new Date().toISOString();
  const distributionPath = env.REFERENCE_DATA_DISTRIBUTION_PATH;
  let distribution: "written" | "invalid" | "skipped" = "skipped";
  const result = await runDetection({
    transport,
    fetchedAt,
    sleep: realSleep,
    applied,
    onWorldRows: distributionPath ? (rows, checksum12) => (distribution = writeDistributionCandidate(rows, checksum12, distributionPath, fetchedAt)) : undefined,
  });
  process.stderr.write(`world base distribution candidate: ${distribution}\n`);
  const summary = buildDetectionSummary({ trigger, fetchedAt, result, log: transport.log });
  out(summary);
  return summary.overall === "no_change" || summary.overall === "update_available" ? 0 : 1;
}
