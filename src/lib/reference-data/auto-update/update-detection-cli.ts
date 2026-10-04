import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { APPLIED_STATE_FILE, parseAppliedState, runDetection, runManagersDetection, type DatasetDetection, type DetectionResult } from "./update-detection";
import { decideWorldScan, fetchWorldLightSignal, markRepeatCandidate, nextWorldLightState, parseCandidateState, type WorldLightSignal, type WorldScanDecision } from "./update-detection-light";
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

/** 毎時の検出の軽い回（World は全件取得しない）の要約の schema。完全な回の v2 とは別に検証する。 */
export const DETECTION_LIGHT_SUMMARY_SCHEMA = "reference-data-detection-summary/light-v1";
/** 軽い回の総合判定。World は全件を比べていないため "no_change" とは書かない。 */
export type LightOverallDecision = "no_change_light" | "update_available" | "attention_required" | "fetch_stopped";

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
export function buildDetectionSummary(input: { trigger: string; fetchedAt: string; result: DetectionResult; log: readonly UpstreamRequestLogEntry[]; worldScanReason?: string }): Record<string, unknown> {
  const r = input.result;
  const upstream = summarizeUpstream(input.log, !r.ok && r.failure.code === "captcha");
  // worldScan: 毎時の検出で、World の軽い確認（1 request）の後に完全な検出を行った理由（手動では manual_trigger）。
  const base = { schema: DETECTION_SUMMARY_SCHEMA, phase: "detection", trigger: input.trigger, fetchedAt: input.fetchedAt, upstream, ...(input.worldScanReason ? { mode: "full", worldScan: input.worldScanReason } : {}) };
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

/**
 * 軽い回の要約（pure）。Managers は完全に比べた結果、World は軽い確認の信号だけ（decision は "not_scanned"）。
 * Orchestrator は update_available の dataset だけを処理するため、World を誤って進めることはない。
 */
export function buildLightDetectionSummary(input: {
  trigger: string;
  fetchedAt: string;
  managers: { ok: true; managers: DatasetDetection } | { ok: false; failure: { table: string; stage: string; code: string }; attention: boolean };
  world: { signal: WorldLightSignal; decision: WorldScanDecision; lastFullAt: string | null };
  log: readonly UpstreamRequestLogEntry[];
}): Record<string, unknown> {
  const upstream = summarizeUpstream(input.log, false);
  const base = { schema: DETECTION_LIGHT_SUMMARY_SCHEMA, phase: "detection", mode: "light", trigger: input.trigger, fetchedAt: input.fetchedAt, upstream };
  const world = {
    decision: "not_scanned",
    reason: input.world.decision.reason,
    totalCount: input.world.signal.totalCount,
    totalPages: input.world.signal.totalPages,
    lastFullAt: input.world.lastFullAt,
  };
  const m = input.managers;
  if (!m.ok) {
    const overall: LightOverallDecision = m.attention ? "attention_required" : "fetch_stopped";
    return { ...base, ok: false, overall, world, reasons: [`${m.failure.table}:${m.failure.stage}:${m.failure.code}`], safety: DETECTION_SAFETY, productionAccess: 0, automaticApply: false };
  }
  const overall: LightOverallDecision =
    m.managers.decision === "attention_required" ? "attention_required" : m.managers.decision === "update_available" ? "update_available" : "no_change_light";
  return {
    ...base,
    ok: true,
    overall,
    world,
    managers: m.managers,
    safety: DETECTION_SAFETY,
    productionAccess: 0,
    automaticApply: false,
    nextStep: "light run: managers fully compared; world not fully scanned (next full scan when the world signal changes or within 6 hours)",
  };
}

function readText(p: string | undefined): string | null {
  try {
    return p && existsSync(p) ? readFileSync(p, "utf8") : null;
  } catch {
    return null;
  }
}

function writeState(p: string | undefined, state: unknown): void {
  if (!p || !/\.json$/.test(p) || /[\r\n\0]/.test(p)) return;
  try {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(state)}\n`, "utf8");
  } catch {
    /* 状態を保存できなくても、次の回が完全な検出になるだけ（fail-safe） */
  }
}

/**
 * update_available の dataset に、24 時間以内に同じ checksum を報告済みなら repeatCandidate: true を付ける（Orchestrator はその dataset を処理しない）。
 * 状態（candidates）は summary と同じ cache に保存する。読めない・無い場合は repeat なし（Pipeline へ渡す側に倒す）。
 */
export function applyRepeatMarking(summary: Record<string, unknown>, stateText: string | null, now: string): { summary: Record<string, unknown>; stateJson: unknown } {
  let state = parseCandidateState(stateText);
  const out: Record<string, unknown> = { ...summary };
  for (const ds of ["world", "managers"] as const) {
    const d = out[ds] as Record<string, unknown> | undefined;
    if (!d || d.decision !== "update_available" || typeof d.sourceChecksum12 !== "string") continue;
    const r = markRepeatCandidate({ state, dataset: ds, checksum12: d.sourceChecksum12, now });
    state = r.state;
    out[ds] = { ...d, repeatCandidate: r.repeat };
  }
  return { summary: out, stateJson: state };
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
  // 毎時の検出（schedule）: World の軽い確認（1 request）で、完全な検出が必要かを決める。手動の実行は常に完全な検出。
  const statePath = env.REFERENCE_DATA_DETECTION_STATE_PATH;
  const candidatesPath = env.REFERENCE_DATA_DETECTION_CANDIDATES_PATH;
  const prevStateText = readText(statePath);
  const light = await fetchWorldLightSignal(transport, { sleep: realSleep });
  const scan: WorldScanDecision | null = light.ok ? decideWorldScan({ signal: light.signal, stateText: prevStateText, now: fetchedAt, trigger }) : null;
  if (light.ok && scan && scan.scan === "light") {
    const managers = await runManagersDetection({ transport, fetchedAt, sleep: realSleep, applied });
    let lastFullAt: string | null = null;
    try {
      lastFullAt = prevStateText ? (JSON.parse(prevStateText) as { lastFullAt?: string }).lastFullAt ?? null : null;
    } catch {
      lastFullAt = null;
    }
    const marked = applyRepeatMarking(
      buildLightDetectionSummary({ trigger, fetchedAt, managers, world: { signal: light.signal, decision: scan, lastFullAt }, log: transport.log }),
      readText(candidatesPath),
      fetchedAt,
    );
    const lightSummary = marked.summary;
    writeState(candidatesPath, marked.stateJson);
    out(lightSummary);
    // 状態は変えない（前回の完全な検出の時点の信号と時刻を保つ）。cache の新しい key へ同じ内容を保存する。
    if (prevStateText) writeState(statePath, JSON.parse(prevStateText));
    return lightSummary.overall === "no_change_light" || lightSummary.overall === "update_available" ? 0 : 1;
  }
  process.stderr.write(`world scan: full (${scan ? scan.reason : light.ok ? "unknown" : light.code})\n`);
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
  const markedFull = applyRepeatMarking(
    buildDetectionSummary({ trigger, fetchedAt, result, log: transport.log, worldScanReason: light.ok && scan ? scan.reason : "world_signal_unavailable" }),
    readText(candidatesPath),
    fetchedAt,
  );
  const summary = markedFull.summary;
  writeState(candidatesPath, markedFull.stateJson);
  out(summary);
  if (light.ok) {
    const complete = result.ok;
    writeState(statePath, nextWorldLightState({ signal: light.signal, fullAt: fetchedAt, outcome: complete ? "complete" : "failed", worldChecksum12: result.ok ? result.world.sourceChecksum12 : null }));
  }
  return summary.overall === "no_change" || summary.overall === "update_available" ? 0 : 1;
}
