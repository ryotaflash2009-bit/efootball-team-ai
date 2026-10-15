import { describe, it, expect } from "vitest";
import { buildScheduleGapNotice, shouldThrottleNotification, buildDetectionNotification, REPEAT_NOTIFICATION_WINDOW_MS } from "../../../../scripts/lib/reference-data-notify.mjs";

const T = "2026-10-04T10:17:00.000Z";
const plus = (ms: number) => new Date(Date.parse(T) + ms).toISOString();

describe("毎時の検出の通知: 間隔の確認・同じ通知の繰り返しの抑制", () => {
  it("検出の間隔が 600 分を超えたら通知（schedule と watchdog の両方の遅れ・欠落）。手動の実行・前回なしは通知しない", () => {
    expect(buildScheduleGapNotice(T, plus(61 * 60_000), "schedule").notify).toBe(false);
    expect(buildScheduleGapNotice(T, plus(600 * 60_000), "schedule").notify).toBe(false);
    const g = buildScheduleGapNotice(T, plus(615 * 60_000), "schedule");
    expect(g).toMatchObject({ notify: true, kind: "schedule_gap", gapMinutes: 615 });
    expect(g.body).toContain("基準: 600 分");
    expect(g.body).not.toMatch(/token|secret/i);
    expect(buildScheduleGapNotice(T, plus(700 * 60_000), "workflow_dispatch").notify).toBe(false);
    expect(buildScheduleGapNotice("", plus(700 * 60_000), "schedule").notify).toBe(false);
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

describe("取得元の鮮度の知らせ（2026-10-15）", () => {
  it("World の全件の確認で、最も新しいカードが 7 日より古ければ知らせる・新しければ・軽い回（timestamps なし）では知らせない", async () => {
    const { buildSourceFreshnessNotice } = await import("../../../../scripts/lib/reference-data-notify.mjs");
    const summary = (max: string) => ({ world: { timestamps: { max } } });
    expect(buildSourceFreshnessNotice(summary("2026-10-08T17:01:43.390Z"), "2026-10-15T06:00:00Z").notify).toBe(false);
    const n = buildSourceFreshnessNotice(summary("2026-10-08T17:01:43.390Z"), "2026-10-16T00:00:00Z");
    expect(n).toMatchObject({ notify: true, kind: "source_stale", days: 7 });
    expect(n.body).toContain("2026-10-08");
    expect(buildSourceFreshnessNotice({ world: { decision: "not_scanned" } }, "2026-10-20T00:00:00Z").notify).toBe(false);
    expect(buildSourceFreshnessNotice(null, "2026-10-20T00:00:00Z").notify).toBe(false);
  });

  it("同じ知らせは 1 日に 1 回まで（6 時間ではなく 24 時間）", async () => {
    const { buildSourceFreshnessNotice } = await import("../../../../scripts/lib/reference-data-notify.mjs");
    const n = buildSourceFreshnessNotice({ world: { timestamps: { max: "2026-10-01T00:00:00Z" } } }, "2026-10-16T00:00:00Z") as { kind: string; title: string };
    const last = { body: `**${n.title}**\n\n...`, createdAt: "2026-10-15T12:00:00Z" };
    expect(shouldThrottleNotification(n, last, "2026-10-16T00:00:00Z")).toBe(true); // 12 時間後
    expect(shouldThrottleNotification(n, last, "2026-10-16T13:00:00Z")).toBe(false); // 25 時間後
  });
});
