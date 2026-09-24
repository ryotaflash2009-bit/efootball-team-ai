import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { APPLIED_STATE_FILE, parseAppliedState, runDetection } from "./update-detection";
import { decideDetectionRun } from "./update-schedule";
import { WORLD_LIMITS } from "./stage4-world";
import { DETECTION_APPROVAL_TOKEN, createUpstreamHttpTransport } from "./upstream-http-transport";

/**
 * 定期検出のCLI(`reference-data-update-detection.yml`から実行)。Secret・Environment・Productionを使わない。
 *
 *   REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED=true node scripts/run-update-detection-entry.mjs
 *
 * 有効化の変数が"true"でなければupstreamへ1件も送らずに停止する。要約(件数・checksum先頭12文字・判定)だけを出力する。
 */

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
  const r = await runDetection({ transport, fetchedAt, sleep: realSleep, applied });
  const log = transport.log;
  const upstream = {
    requests: log.length,
    worldRequests: log.filter((l) => l.sourceId === "efootball-world").length,
    managersRequests: log.filter((l) => l.sourceId === "managers-json").length,
    non200: log.filter((l) => l.status !== 200).length,
    totalBytes: log.reduce((a, l) => a + l.bytes, 0),
  };
  if (!r.ok) {
    out({ ok: false, phase: "detection", reasons: [`${r.failure.table}:${r.failure.stage}:${r.failure.code}`], fetchedAt, upstream });
    return 1;
  }
  out({
    ok: true,
    phase: "detection",
    fetchedAt,
    upstream,
    world: r.world,
    managers: r.managers,
    productionAccess: 0,
    automaticApply: false,
    nextStep: "update_available/attention_required → owner runs the approval-gated plan (docs/production-readiness/stage4-world-rehearsal-runbook.md)",
  });
  return 0;
}
