/**
 * 検出の watchdog の観測の判定（pure・2026-10-11）。2026-10-13 の締めの GO / NO-GO（hourly-detection-decision-package.md §7）。
 *
 * 入力は GitHub の run の一覧（読み取りだけ）と、watchdog の各 run の判定（ログの JSON の行）。
 * GO: watchdog の run が作られている・成功した検出どうしの最大の間隔が 600 分以下・失敗 0。
 * NO-GO: watchdog が検出を 1 日（UTC）に 4 回以上起動・watchdog の起動の直後（同じ日）の検出が失敗・watchdog 自体の失敗・判定が読めない run がある。
 * データ不足: 観測の期間に watchdog の run が無い／期間が 24 時間より短い。
 */
export const MAX_GAP_MINUTES = 600;
export const MAX_DISPATCHES_PER_DAY = 3;

/**
 * @param {{
 *   since: string, until: string,
 *   watchdogRuns: { id: number, event: string, createdAt: string, conclusion: string | null }[],
 *   detectionRuns: { id: number, event: string, createdAt: string, conclusion: string | null, actor?: string | null }[],
 *   decisions: Record<string, { dispatch: boolean, reason: string } | null>,
 * }} p
 */
export function evaluateWatchdogObservation({ since, until, watchdogRuns, detectionRuns, decisions }) {
  const a = Date.parse(since);
  const b = Date.parse(until);
  const inWindow = (r) => {
    const t = Date.parse(r.createdAt);
    return Number.isFinite(t) && t >= a && t <= b;
  };
  const wd = watchdogRuns.filter(inWindow).sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
  const det = detectionRuns.filter(inWindow).sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
  const reasons = {};
  let dispatches = 0;
  let unreadable = 0;
  const dispatchDays = {};
  for (const r of wd) {
    const d = decisions[String(r.id)] ?? null;
    if (!d) {
      if (r.conclusion === "success") unreadable += 1;
      continue;
    }
    reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
    if (d.dispatch) {
      dispatches += 1;
      const day = r.createdAt.slice(0, 10);
      dispatchDays[day] = (dispatchDays[day] ?? 0) + 1;
    }
  }
  const watchdogFailures = wd.filter((r) => r.conclusion && !["success", "skipped"].includes(r.conclusion)).length;
  // watchdog が起動した検出: workflow_dispatch で github-actions[bot] が起こしたもの
  const dispatched = det.filter((r) => r.event === "workflow_dispatch" && (r.actor ?? "") === "github-actions[bot]");
  const dispatchedFailures = dispatched.filter((r) => r.conclusion && r.conclusion !== "success").length;
  const successes = det.filter((r) => r.conclusion === "success").map((r) => Date.parse(r.createdAt));
  let maxGapMinutes = null;
  for (let i = 1; i < successes.length; i++) {
    const g = Math.round((successes[i] - successes[i - 1]) / 60000);
    if (maxGapMinutes === null || g > maxGapMinutes) maxGapMinutes = g;
  }
  const tooManyDays = Object.entries(dispatchDays).filter(([, n]) => n > MAX_DISPATCHES_PER_DAY).map(([d]) => d);

  const reasonsNoGo = [];
  if (tooManyDays.length) reasonsNoGo.push(`dispatches over ${MAX_DISPATCHES_PER_DAY}/day on ${tooManyDays.join(",")}`);
  if (dispatchedFailures > 0) reasonsNoGo.push(`${dispatchedFailures} watchdog-dispatched detection(s) failed`);
  if (watchdogFailures > 0) reasonsNoGo.push(`${watchdogFailures} watchdog run(s) failed`);
  if (unreadable > 0) reasonsNoGo.push(`${unreadable} watchdog run(s) without a readable decision`);

  let verdict;
  if (reasonsNoGo.length) verdict = "NO_GO";
  else if (wd.length === 0 || b - a < 24 * 3600 * 1000) verdict = "INSUFFICIENT_DATA";
  else if (maxGapMinutes !== null && maxGapMinutes > MAX_GAP_MINUTES) verdict = "REVIEW";
  else verdict = "GO";

  return {
    verdict,
    reasonsNoGo,
    watchdogRuns: wd.length,
    watchdogFailures,
    reasons,
    dispatches,
    dispatchedDetections: dispatched.length,
    dispatchedFailures,
    detectionRuns: det.length,
    detectionSuccesses: successes.length,
    maxGapMinutes,
  };
}

/** watchdog の run のログから判定の JSON の行（`{"dispatch":…,"reason":…}`）を取り出す。無ければ null。 */
export function parseWatchdogDecision(log) {
  for (const line of String(log ?? "").split("\n")) {
    const m = /\{"dispatch":(true|false),"reason":"([a-z_]+)"[^\n]*\}/.exec(line);
    if (m) return { dispatch: m[1] === "true", reason: m[2] };
  }
  return null;
}
