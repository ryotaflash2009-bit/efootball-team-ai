import { describe, it, expect } from "vitest";
import { decideProvisionalDispatch, decideWatchdogDispatch, PROVISIONAL_STALE_MS, WATCHDOG_STALE_MS } from "../../../../scripts/lib/detection-watchdog.mjs";

const NOW = "2026-10-13T12:00:00Z";
const ago = (min: number) => new Date(Date.parse(NOW) - min * 60000).toISOString();
const run = (id: number, min: number, extra: Record<string, unknown> = {}) => ({
  id,
  event: "schedule",
  createdAt: ago(min),
  status: "completed",
  conclusion: "success",
  ...extra,
});

describe("検出の watchdog（案 D・準備だけ）", () => {
  it("無効なら何もしない（既定）", () => {
    expect(decideWatchdogDispatch({ now: NOW, runs: [run(1, 600)], enabled: false })).toMatchObject({ dispatch: false, reason: "disabled" });
  });
  it("最後の成功が 6 時間 30 分以内なら起動しない・超えたら 1 回起動する", () => {
    expect(decideWatchdogDispatch({ now: NOW, runs: [run(1, 380)], enabled: true })).toMatchObject({ dispatch: false, reason: "fresh", ageMinutes: 380 });
    expect(decideWatchdogDispatch({ now: NOW, runs: [run(1, 400), run(2, 900)], enabled: true })).toMatchObject({ dispatch: true, reason: "stale", ageMinutes: 400 });
    expect(WATCHDOG_STALE_MS).toBe(390 * 60000);
  });
  it("実行中・待機中の検出があれば起動しない（二重の走査を防ぐ）", () => {
    const r = decideWatchdogDispatch({ now: NOW, runs: [run(1, 600), run(2, 5, { status: "in_progress", conclusion: null })], enabled: true });
    expect(r).toMatchObject({ dispatch: false, reason: "detection_in_progress" });
  });
  it("直近の検出が失敗なら起動しない（失敗の通知に任せる）・skip（変数で停止中）も起動しない", () => {
    expect(decideWatchdogDispatch({ now: NOW, runs: [run(1, 900), run(2, 420, { conclusion: "failure" })], enabled: true }).reason).toBe("latest_detection_failed");
    expect(decideWatchdogDispatch({ now: NOW, runs: [run(1, 900), run(2, 420, { conclusion: "skipped" })], enabled: true }).reason).toBe("detection_disabled");
  });
  it("起動した検出の結果で止まる: 取り消し・失敗なら再起動しない・成功なら fresh", () => {
    const runs = [run(1, 700), run(2, 60, { event: "workflow_dispatch", conclusion: "cancelled" })];
    expect(decideWatchdogDispatch({ now: NOW, runs, enabled: true }).reason).toBe("latest_detection_failed");
    const runs2 = [run(1, 700), run(2, 60, { event: "workflow_dispatch" })];
    expect(decideWatchdogDispatch({ now: NOW, runs: runs2, enabled: true })).toMatchObject({ dispatch: false, reason: "fresh" });
  });
  it("成功の記録が無ければ起動する・未来の時刻と壊れた値は無視する", () => {
    expect(decideWatchdogDispatch({ now: NOW, runs: [], enabled: true }).reason).toBe("no_successful_detection");
    expect(decideWatchdogDispatch({ now: NOW, runs: [run(1, -30), { ...run(2, 10), createdAt: "bad" }], enabled: true }).reason).toBe("no_successful_detection");
    expect(decideWatchdogDispatch({ now: "bad", runs: [], enabled: true }).reason).toBe("invalid_now");
  });
});

describe("暫定のカードの同期の watchdog（2026-10-25）", () => {
  const stale = PROVISIONAL_STALE_MS / 60000 + 1;
  it("最後に始まってから 2 時間を超えたら起動（直近が失敗でも）", () => {
    expect(decideProvisionalDispatch({ now: NOW, runs: [run(1, stale)] })).toMatchObject({ dispatch: true, reason: "stale" });
    expect(decideProvisionalDispatch({ now: NOW, runs: [run(1, stale, { conclusion: "failure" })] })).toMatchObject({ dispatch: true, reason: "stale" });
    expect(decideProvisionalDispatch({ now: NOW, runs: [] })).toMatchObject({ dispatch: true, reason: "no_sync_run" });
  });
  it("2 時間以内・実行中・止めている（skipped）なら起動しない", () => {
    expect(decideProvisionalDispatch({ now: NOW, runs: [run(1, stale), run(2, 30, { conclusion: "failure" })] })).toMatchObject({ dispatch: false, reason: "fresh" });
    expect(decideProvisionalDispatch({ now: NOW, runs: [run(1, stale), run(2, 1, { status: "in_progress", conclusion: null })] })).toMatchObject({ dispatch: false, reason: "sync_in_progress" });
    expect(decideProvisionalDispatch({ now: NOW, runs: [run(1, stale, { conclusion: "skipped" })] })).toMatchObject({ dispatch: false, reason: "sync_disabled" });
    expect(decideProvisionalDispatch({ now: "x", runs: [] })).toMatchObject({ dispatch: false, reason: "invalid_now" });
  });
});
