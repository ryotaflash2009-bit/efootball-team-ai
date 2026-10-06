import { describe, it, expect } from "vitest";
import { expectedSlots, slotFor, classifySummary, observeSchedule } from "../../../../scripts/lib/hourly-schedule-observation.mjs";
import { buildScheduleGapNotice } from "../../../../scripts/lib/reference-data-notify.mjs";
import { decideWorldScan, nextWorldLightState, markRepeatCandidate, parseCandidateState, WORLD_FULL_SCAN_INTERVAL_MS } from "./update-detection-light";

const run = (id: number, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  event: "schedule",
  createdAt,
  updatedAt: new Date(Date.parse(createdAt) + 30_000).toISOString(),
  status: "completed",
  conclusion: "success",
  ...extra,
});

describe("毎時の検出の観測: 予定の枠と実際の run", () => {
  it("予定の枠は毎時 17 分（UTC）。範囲の両端を含む", () => {
    expect(expectedSlots("2026-10-06T00:00:00Z", "2026-10-06T03:17:00Z")).toEqual([
      "2026-10-06T00:17:00.000Z",
      "2026-10-06T01:17:00.000Z",
      "2026-10-06T02:17:00.000Z",
      "2026-10-06T03:17:00.000Z",
    ]);
    expect(expectedSlots("2026-10-06T00:20:00Z", "2026-10-06T01:00:00Z")).toEqual([]);
    expect(expectedSlots("bad", "2026-10-06T01:00:00Z")).toEqual([]);
  });

  it("run は作成時刻以前で最も新しい枠に入る（遅れは 0〜59 分）", () => {
    expect(slotFor("2026-10-06T02:56:37Z")).toBe("2026-10-06T02:17:00.000Z");
    expect(slotFor("2026-10-06T03:10:00Z")).toBe("2026-10-06T02:17:00.000Z");
    expect(slotFor("2026-10-06T03:17:00Z")).toBe("2026-10-06T03:17:00.000Z");
  });

  it("遅れ・欠落・連続の欠落・最大の間隔・同じ枠の 2 件目を数える", () => {
    const o = observeSchedule({
      since: "2026-10-06T00:00:00Z",
      until: "2026-10-06T06:30:00Z",
      runs: [run(1, "2026-10-06T00:20:00Z"), run(2, "2026-10-06T00:50:00Z"), run(3, "2026-10-06T04:40:00Z"), run(4, "2026-10-06T05:30:00Z", { event: "workflow_dispatch" })],
    });
    expect(o.expected).toBe(7);
    expect(o.actual).toBe(2);
    expect(o.extraRuns).toBe(1);
    expect(o.manualRuns).toBe(1);
    expect(o.missing).toBe(5);
    expect(o.maxConsecutiveMissing).toBe(3); // 01:17, 02:17, 03:17
    expect(o.delayMinutes).toEqual({ median: 13, max: 23 });
    // 成功した検出の間隔: 00:50 → 04:40 = 230 分（手動の run も検出として数える）
    expect(o.maxGapMinutes).toBe(230);
    expect(o.lastSuccessfulDetection).toBe("2026-10-06T05:30:00.000Z");
  });

  it("範囲の最後で続いている間隔も最大の間隔に含める（maxGapEndsAt は null）", () => {
    const o = observeSchedule({ since: "2026-10-06T00:00:00Z", until: "2026-10-06T08:00:00Z", runs: [run(1, "2026-10-06T00:20:00Z")] });
    expect(o.maxGapMinutes).toBe(460);
    expect(o.maxGapEndsAt).toBeNull();
    expect(o.reconsider.gapAtLeast6h).toBe(true);
  });

  it("要約から軽い回・完全な回・結果・request・bytes を取る。no_change_light は World の変化なしとは数えない", () => {
    expect(classifySummary({ mode: "light", overall: "no_change_light", upstream: { requests: 2, totalBytes: 100 } })).toMatchObject({ mode: "light", outcome: "light_no_signal_change", requests: 2, bytes: 100 });
    expect(classifySummary({ mode: "full", worldScan: "full_scan_due", overall: "no_change", upstream: { requests: 448, totalBytes: 9 } })).toMatchObject({ mode: "full", outcome: "no_change", worldScan: "full_scan_due" });
    expect(classifySummary({ overall: "update_available", upstream: {} })).toMatchObject({ mode: "full", outcome: "change_detected", requests: null, bytes: null });
    expect(classifySummary({ overall: "attention_required" })).toMatchObject({ outcome: "failure" });
    expect(classifySummary(null)).toBeNull();
  });

  it("失敗・skip・取り消し・同時実行を数える", () => {
    const o = observeSchedule({
      since: "2026-10-06T00:00:00Z",
      until: "2026-10-06T03:30:00Z",
      runs: [
        run(1, "2026-10-06T00:20:00Z", { conclusion: "failure", updatedAt: "2026-10-06T01:30:00Z" }),
        run(2, "2026-10-06T01:20:00Z", { conclusion: "skipped" }),
        run(3, "2026-10-06T02:20:00Z", { conclusion: "cancelled" }),
        run(4, "2026-10-06T03:20:00Z"),
      ],
    });
    expect(o.failure).toBe(1);
    expect(o.skip).toBe(1);
    expect(o.cancelled).toBe(1);
    expect(o.concurrencyOverlaps).toBe(1); // 2 は 1 が終わる前に作られた
  });

  it("外部 Cron の再検討の条件: 6 時間の空白・半数以上の欠落・検出の遅れ 2 回・schedule の無効化", () => {
    // 3 時間ごとに 1 件（0, 3, ..., 21 時）: 空白は 3 時間・24 枠中 16 枠が欠落
    const runs = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => run(100 + h, `2026-10-06T${String(h).padStart(2, "0")}:20:00Z`));
    const ok = observeSchedule({ since: "2026-10-06T00:00:00Z", until: "2026-10-06T23:59:00Z", runs, workflowState: "active" });
    expect(ok.expected).toBe(24);
    expect(ok.missing).toBe(16);
    expect(ok.reconsider.gapAtLeast6h).toBe(false);
    expect(ok.reconsider.missingAboutHalfOrMore).toBe(true);
    expect(ok.reconsider.scheduleDisabled).toBe(false);

    const delayed = observeSchedule({
      since: "2026-10-06T00:00:00Z",
      until: "2026-10-06T12:00:00Z",
      runs: [run(1, "2026-10-06T00:20:00Z"), run(2, "2026-10-06T03:20:00Z"), run(3, "2026-10-06T06:20:00Z")],
      summaries: { "2": { overall: "update_available" }, "3": { overall: "update_available" } },
      workflowState: "disabled_inactivity",
    });
    expect(delayed.delayedDetections).toBe(2);
    expect(delayed.reconsider.delayedDetectionsTwiceOrMore).toBe(true);
    expect(delayed.reconsider.scheduleDisabled).toBe(true);
    expect(delayed.reconsiderExternalTrigger).toBe(true);
  });

  it("130 分の通知の基準は変えていない", () => {
    const t = "2026-10-06T00:17:00.000Z";
    const at = (m: number) => new Date(Date.parse(t) + m * 60_000).toISOString();
    expect(buildScheduleGapNotice(t, at(130), "schedule").notify).toBe(false);
    expect(buildScheduleGapNotice(t, at(131), "schedule").notify).toBe(true);
  });
});

describe("schedule が欠落しても、次の run で更新を取りこぼさない（契約）", () => {
  const signal = { totalCount: 13372, totalPages: 558, page1ContentHash: "a".repeat(16) };
  const state = (fullAt: string) => JSON.stringify(nextWorldLightState({ signal, fullAt, outcome: "complete", worldChecksum12: "079f9eaf92a0" }));

  it("何枠欠落しても、前回の完全な検出から 6 時間たっていれば次の run は完全な検出をする", () => {
    const last = "2026-10-05T07:00:00.000Z";
    const after = (h: number) => new Date(Date.parse(last) + h * 3_600_000).toISOString();
    expect(decideWorldScan({ signal, stateText: state(last), now: after(5.9), trigger: "schedule" })).toEqual({ scan: "light", reason: "world_signal_unchanged" });
    expect(decideWorldScan({ signal, stateText: state(last), now: after(6), trigger: "schedule" })).toEqual({ scan: "full", reason: "full_scan_due" });
    expect(decideWorldScan({ signal, stateText: state(last), now: after(9), trigger: "schedule" })).toEqual({ scan: "full", reason: "full_scan_due" });
    expect(WORLD_FULL_SCAN_INTERVAL_MS).toBe(6 * 3_600_000);
  });

  it("欠落の間に World の信号が変われば、6 時間を待たずに完全な検出をする", () => {
    const changed = { ...signal, totalCount: signal.totalCount + 1 };
    expect(decideWorldScan({ signal: changed, stateText: state("2026-10-05T07:00:00.000Z"), now: "2026-10-05T08:00:00.000Z", trigger: "schedule" })).toEqual({
      scan: "full",
      reason: "world_signal_changed",
    });
  });

  it("状態が失われても（cache の期限切れ等）、次の run は完全な検出をする", () => {
    expect(decideWorldScan({ signal, stateText: null, now: "2026-10-06T00:00:00.000Z", trigger: "schedule" })).toEqual({ scan: "full", reason: "no_previous_state" });
    expect(decideWorldScan({ signal, stateText: "{broken", now: "2026-10-06T00:00:00.000Z", trigger: "schedule" })).toEqual({ scan: "full", reason: "invalid_state" });
  });

  it("適用されていない更新は、同じ checksum でも 24 時間後に再び Pipeline へ渡る（欠落の後でも消えない）", () => {
    const first = markRepeatCandidate({ state: parseCandidateState(null), dataset: "world", checksum12: "079f9eaf92a0", now: "2026-10-05T07:26:00.000Z" });
    expect(first.repeat).toBe(false);
    expect(markRepeatCandidate({ state: first.state, dataset: "world", checksum12: "079f9eaf92a0", now: "2026-10-05T22:36:00.000Z" }).repeat).toBe(true);
    expect(markRepeatCandidate({ state: first.state, dataset: "world", checksum12: "079f9eaf92a0", now: "2026-10-06T07:26:00.000Z" }).repeat).toBe(false);
    // 別の checksum（新しい変更）はすぐに渡る
    expect(markRepeatCandidate({ state: first.state, dataset: "world", checksum12: "0123456789ab", now: "2026-10-05T08:00:00.000Z" }).repeat).toBe(false);
  });
});
