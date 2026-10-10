/**
 * 検出の watchdog の判定（pure・2026-10-10 の準備・**まだどの workflow からも使っていない**）。
 *
 * 案 D（`docs/production-readiness/hourly-detection-decision-package.md`）: GitHub の中の別の schedule が
 * 「最後に成功した検出からの時間」を読み、上限を超えていたら `GITHUB_TOKEN` で検出の workflow_dispatch（confirm "detect"）を 1 回だけ起こす。
 * 有効にするのは本人の承認の後（schedule の追加＝cron の変更のため）。このファイルは判定だけで、通信も起動もしない。
 */

/** 最後に成功した検出からこの時間を超えたら起動する（完全な走査の間隔 6 時間 + schedule の遅れの余裕）。 */
export const WATCHDOG_STALE_MS = 6 * 60 * 60 * 1000 + 30 * 60 * 1000;

/**
 * @typedef {{ id: number, event: string, createdAt: string, status: string, conclusion: string | null }} DetectionRun
 * @param {{ now: string, runs: DetectionRun[], enabled: boolean, staleMs?: number }} p
 *   runs: 検出の workflow の run の一覧（`gh run list --workflow reference-data-update-detection.yml` 相当・順不同）
 * @returns {{ dispatch: boolean, reason: string, lastSuccessAt: string | null, ageMinutes: number | null }}
 */
export function decideWatchdogDispatch({ now, runs, enabled, staleMs = WATCHDOG_STALE_MS }) {
  const t = Date.parse(now);
  if (!enabled) return { dispatch: false, reason: "disabled", lastSuccessAt: null, ageMinutes: null };
  if (!Number.isFinite(t)) return { dispatch: false, reason: "invalid_now", lastSuccessAt: null, ageMinutes: null };
  const valid = (runs ?? []).filter((r) => r && Number.isFinite(Date.parse(r.createdAt)) && Date.parse(r.createdAt) <= t);
  // 実行中・待機中の検出があれば起動しない（concurrency で待たせるだけになり、二重の走査になる）。
  if (valid.some((r) => r.status !== "completed")) return { dispatch: false, reason: "detection_in_progress", lastSuccessAt: null, ageMinutes: null };
  const success = valid.filter((r) => r.conclusion === "success").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const last = success[0] ?? null;
  const ageMs = last ? t - Date.parse(last.createdAt) : null;
  const ageMinutes = ageMs === null ? null : Math.round(ageMs / 60000);
  const lastSuccessAt = last ? new Date(Date.parse(last.createdAt)).toISOString() : null;
  // 直近の失敗は検出の側の問題（上流・設定）。watchdog で繰り返し起動せず、既存の失敗の通知に任せる。
  const newest = [...valid].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  // skip は検出の変数（REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED）が "true" でない＝本人が止めている。起動しない。
  if (newest && newest.conclusion === "skipped") return { dispatch: false, reason: "detection_disabled", lastSuccessAt, ageMinutes };
  if (newest && newest.conclusion !== "success") return { dispatch: false, reason: "latest_detection_failed", lastSuccessAt, ageMinutes };
  // 同じ欠落への繰り返しの起動は、起動した検出が実行中（detection_in_progress）→ 成功（fresh）／失敗（latest_detection_failed）で止まる。
  if (!last) return { dispatch: true, reason: "no_successful_detection", lastSuccessAt, ageMinutes };
  if (ageMs > staleMs) return { dispatch: true, reason: "stale", lastSuccessAt, ageMinutes };
  return { dispatch: false, reason: "fresh", lastSuccessAt, ageMinutes };
}
