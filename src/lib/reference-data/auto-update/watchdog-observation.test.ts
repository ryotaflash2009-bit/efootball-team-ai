import { describe, it, expect } from "vitest";
import { evaluateWatchdogObservation, parseWatchdogDecision } from "../../../../scripts/lib/watchdog-observation.mjs";

const SINCE = "2026-10-11T00:00:00Z";
const UNTIL = "2026-10-13T23:59:59Z";
const run = (id: number, createdAt: string, extra: Record<string, unknown> = {}) => ({ id, event: "schedule", createdAt, conclusion: "success", ...extra });

describe("watchdog の観測の判定（2026-10-13 の締め）", () => {
  it("GO: watchdog の run があり・成功した検出の間隔が 600 分以下・失敗なし", () => {
    const r = evaluateWatchdogObservation({
      since: SINCE,
      until: UNTIL,
      watchdogRuns: [run(1, "2026-10-11T00:43:00Z"), run(2, "2026-10-11T03:43:00Z")],
      detectionRuns: [run(10, "2026-10-11T00:20:00Z"), run(11, "2026-10-11T06:00:00Z"), run(12, "2026-10-11T07:00:00Z", { event: "workflow_dispatch", actor: "github-actions[bot]" })],
      decisions: { "1": { dispatch: false, reason: "fresh" }, "2": { dispatch: true, reason: "stale" } },
    });
    expect(r).toMatchObject({ verdict: "GO", watchdogRuns: 2, dispatches: 1, dispatchedDetections: 1, maxGapMinutes: 340, reasons: { fresh: 1, stale: 1 } });
  });

  it("NO_GO: 1 日に 4 回以上の起動・起動した検出の失敗・判定が読めない run", () => {
    const many = [0, 3, 6, 9].map((h, i) => run(i + 1, `2026-10-11T${String(h).padStart(2, "0")}:43:00Z`));
    const r = evaluateWatchdogObservation({
      since: SINCE,
      until: UNTIL,
      watchdogRuns: [...many, run(9, "2026-10-12T00:43:00Z")],
      detectionRuns: [run(20, "2026-10-11T01:00:00Z", { event: "workflow_dispatch", actor: "github-actions[bot]", conclusion: "failure" })],
      decisions: Object.fromEntries(many.map((m) => [String(m.id), { dispatch: true, reason: "stale" }])),
    });
    expect(r.verdict).toBe("NO_GO");
    expect(r.reasonsNoGo.join(" ")).toMatch(/over 3\/day/);
    expect(r.reasonsNoGo.join(" ")).toMatch(/dispatched detection\(s\) failed/);
    expect(r.reasonsNoGo.join(" ")).toMatch(/without a readable decision/);
  });

  it("データ不足・間隔が長いときは REVIEW（GO にしない）・本人の手動の検出は watchdog の起動に数えない", () => {
    expect(evaluateWatchdogObservation({ since: SINCE, until: UNTIL, watchdogRuns: [], detectionRuns: [], decisions: {} }).verdict).toBe("INSUFFICIENT_DATA");
    const r = evaluateWatchdogObservation({
      since: SINCE,
      until: UNTIL,
      watchdogRuns: [run(1, "2026-10-11T00:43:00Z")],
      detectionRuns: [run(10, "2026-10-11T00:00:00Z"), run(11, "2026-10-11T12:00:00Z", { event: "workflow_dispatch", actor: "ryotaflash2009-bit" })],
      decisions: { "1": { dispatch: false, reason: "fresh" } },
    });
    expect(r).toMatchObject({ verdict: "REVIEW", maxGapMinutes: 720, dispatchedDetections: 0 });
  });

  it("ログから判定の JSON の行を読む", () => {
    const log = 'watchdog\tDecide and dispatch\t2026-10-10T14:41:37.5637513Z {"dispatch":false,"reason":"fresh","lastSuccessAt":"2026-10-10T13:37:48.000Z","ageMinutes":64}';
    expect(parseWatchdogDecision(log)).toEqual({ dispatch: false, reason: "fresh" });
    expect(parseWatchdogDecision("nothing")).toBeNull();
  });
});
