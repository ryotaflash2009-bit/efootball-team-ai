import { describe, it, expect } from "vitest";
import { buildScheduleGapNotice, shouldThrottleNotification, buildDetectionNotification, REPEAT_NOTIFICATION_WINDOW_MS } from "../../../../scripts/lib/reference-data-notify.mjs";

const T = "2026-10-04T10:17:00.000Z";
const plus = (ms: number) => new Date(Date.parse(T) + ms).toISOString();

describe("毎時の検出の通知: 間隔の確認・同じ通知の繰り返しの抑制", () => {
  it("定期実行の間隔が 130 分を超えたら通知（遅れ・欠落）。手動の実行・前回なしは通知しない", () => {
    expect(buildScheduleGapNotice(T, plus(61 * 60_000), "schedule").notify).toBe(false);
    expect(buildScheduleGapNotice(T, plus(130 * 60_000), "schedule").notify).toBe(false);
    const g = buildScheduleGapNotice(T, plus(185 * 60_000), "schedule");
    expect(g).toMatchObject({ notify: true, kind: "schedule_gap", gapMinutes: 185 });
    expect(g.body).not.toMatch(/token|secret/i);
    expect(buildScheduleGapNotice(T, plus(300 * 60_000), "workflow_dispatch").notify).toBe(false);
    expect(buildScheduleGapNotice("", plus(300 * 60_000), "schedule").notify).toBe(false);
  });

  it("同じ失敗の通知は 6 時間以内なら繰り返さない（update_available は候補の checksum で別に判定するので抑えない）", () => {
    const n = buildDetectionNotification(null, { conclusion: "failure", runId: "9", runUrl: "" });
    if (!n.notify) throw new Error("expected a notification");
    const failed = n;
    expect(failed.kind).toBe("failed");
    const last = { body: `**${failed.title}**\n\n...`, createdAt: T };
    expect(shouldThrottleNotification(failed, last, plus(60 * 60_000))).toBe(true);
    expect(shouldThrottleNotification(failed, last, plus(REPEAT_NOTIFICATION_WINDOW_MS))).toBe(false);
    expect(shouldThrottleNotification(failed, { body: "**other**", createdAt: T }, plus(60_000))).toBe(false);
    expect(shouldThrottleNotification({ kind: "update_available", title: failed.title }, last, plus(60_000))).toBe(false);
    expect(shouldThrottleNotification(failed, null, plus(60_000))).toBe(false);
  });

  it("毎時の検出の軽い回（no_change_light）は通知しない・連続した失敗は通知（初回）する", () => {
    expect(buildDetectionNotification({ overall: "no_change_light" }, { conclusion: "success", runId: "1", runUrl: "" })).toEqual({ notify: false, reason: "no_change_light" });
    expect(buildDetectionNotification({ overall: "no_change_light" }, { conclusion: "failure", runId: "1", runUrl: "" }).notify).toBe(true);
  });
});
