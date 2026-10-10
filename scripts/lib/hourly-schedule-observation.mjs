/**
 * 毎時の検出（cron "17 * * * *"）の観測（pure）。2026-10-06〜10-13 の観測契約は
 * docs/production-readiness/hourly-detection-observation.md を参照。
 *
 * - 予定の枠（毎時 17 分・UTC）と schedule の run を突き合わせ、遅れ・欠落・連続の欠落・最大の間隔を数える。
 * - run は「作成時刻以前で最も新しい枠」に割り当てる（遅れは 0〜59 分）。同じ枠に 2 件以上なら 2 件目以降は extra。
 * - 外部の起動（外部 Cron）を再検討する条件（本人の決定 2026-10-06）を評価する。判定するだけで、何も変更しない。
 */

export const SLOT_MINUTE = 17;
export const HOUR_MS = 60 * 60 * 1000;
/** 観測の指標「更新の検出の遅れ」の基準（130 分＝毎時 + 遅れの余裕）。通知の基準（600 分・reference-data-notify.mjs）とは別。 */
export const GAP_NOTICE_MS = 130 * 60 * 1000;
/** 再検討の条件: 6 時間以上 Detection がない。 */
export const RECONSIDER_GAP_MS = 6 * HOUR_MS;
/** 再検討の条件: 予定の run の約半数以上が欠落。 */
export const RECONSIDER_MISSING_RATIO = 0.5;
/** 再検討の条件: 更新の検出の遅れが 2 回以上。 */
export const RECONSIDER_DELAYED_DETECTIONS = 2;

/** since 以降・until 以前の予定の枠（毎時 SLOT_MINUTE 分・UTC）。 */
export function expectedSlots(since, until, minute = SLOT_MINUTE) {
  const a = Date.parse(since);
  const b = Date.parse(until);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
  const first = new Date(a);
  first.setUTCMinutes(minute, 0, 0);
  let t = first.getTime();
  if (t < a) t += HOUR_MS;
  const out = [];
  for (; t <= b; t += HOUR_MS) out.push(new Date(t).toISOString());
  return out;
}

/** 作成時刻以前で最も新しい枠（毎時 SLOT_MINUTE 分）。 */
export function slotFor(createdAt, minute = SLOT_MINUTE) {
  const c = Date.parse(createdAt);
  if (!Number.isFinite(c)) return null;
  const d = new Date(c);
  d.setUTCMinutes(minute, 0, 0);
  let t = d.getTime();
  if (t > c) t -= HOUR_MS;
  return new Date(t).toISOString();
}

const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * 検出の要約（reference-data-detection-summary）から、軽い回・完全な回・結果・request・bytes を取り出す。
 * 要約が無い（保持期間 7 日を過ぎた等）ときは null を返す（推測しない）。
 */
export function classifySummary(summary) {
  if (!summary || typeof summary !== "object") return null;
  // 軽い回の要約は mode: "light"。完全な回（毎時の完全な回・手動）はそれ以外。
  const mode = summary.mode === "light" ? "light" : "full";
  const overall = String(summary.overall ?? "");
  // no_change_light は「Managers は変化なし・World は全件を比較していない（軽い確認の信号が変わっていない）」で、
  // World の変化なしを意味しない（update-detection-light.ts）。no_change と分けて数える。
  const outcome =
    overall === "no_change"
      ? "no_change"
      : overall === "no_change_light"
        ? "light_no_signal_change"
        : overall === "update_available"
        ? "change_detected"
        : overall === ""
          ? "unknown"
          : "failure";
  const up = summary.upstream ?? {};
  return {
    mode,
    outcome,
    overall,
    worldScan: summary.worldScan ?? null,
    requests: Number.isInteger(up.requests) ? up.requests : null,
    bytes: Number.isInteger(up.totalBytes) ? up.totalBytes : null,
  };
}

/**
 * 観測の集計。
 * runs: [{ id, event, createdAt, startedAt?, updatedAt?, status?, conclusion? }]（detection workflow の run）
 * summaries: { [runId]: summary JSON }（任意）
 * gapNotices: [{ at }]（#112 の「間隔があきました」の通知・任意）
 * workflowState: "active" など（任意）
 *
 * @param {{ since: string, until: string, runs: Array<Record<string, any>>, summaries?: Record<string, any>, gapNotices?: Array<{ at: string }>, workflowState?: string | null }} input
 */
export function observeSchedule({ since, until, runs, summaries = {}, gapNotices = [], workflowState = null }) {
  const slots = expectedSlots(since, until);
  const a = Date.parse(since);
  const b = Date.parse(until);
  const inWindow = (r) => {
    const t = Date.parse(r.createdAt);
    return Number.isFinite(t) && t >= a && t <= b;
  };
  const scheduled = runs.filter((r) => r.event === "schedule" && inWindow(r)).sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
  const manual = runs.filter((r) => r.event !== "schedule" && inWindow(r));

  const bySlot = new Map();
  const extra = [];
  for (const r of scheduled) {
    const s = slotFor(r.createdAt);
    if (bySlot.has(s)) extra.push(r);
    else bySlot.set(s, r);
  }

  const slotRows = slots.map((slot) => {
    const r = bySlot.get(slot) ?? null;
    if (!r) return { slot, status: "missing" };
    const started = r.startedAt ?? r.createdAt;
    const summary = classifySummary(summaries[String(r.id)]);
    const durationMs = r.updatedAt ? Date.parse(r.updatedAt) - Date.parse(started) : null;
    const status = r.conclusion === "skipped" ? "skip" : r.conclusion === "cancelled" ? "cancelled" : r.conclusion === "success" ? "ran" : r.conclusion ? "failure" : "running";
    return {
      slot,
      status,
      runId: r.id,
      createdAt: r.createdAt,
      startedAt: started,
      delayMinutes: Math.round((Date.parse(r.createdAt) - Date.parse(slot)) / 60000),
      durationSeconds: Number.isFinite(durationMs) ? Math.round(durationMs / 1000) : null,
      conclusion: r.conclusion ?? null,
      ...(summary ? { mode: summary.mode, outcome: summary.outcome, worldScan: summary.worldScan, requests: summary.requests, bytes: summary.bytes } : {}),
    };
  });

  // 欠落・連続の欠落
  let consecutive = 0;
  let maxConsecutiveMissing = 0;
  for (const row of slotRows) {
    consecutive = row.status === "missing" ? consecutive + 1 : 0;
    maxConsecutiveMissing = Math.max(maxConsecutiveMissing, consecutive);
  }
  const missing = slotRows.filter((r) => r.status === "missing").length;

  // 成功した検出（schedule と手動の両方）の間隔
  const successes = runs
    .filter((r) => r.conclusion === "success")
    .map((r) => Date.parse(r.createdAt))
    .filter(Number.isFinite)
    .sort((x, y) => x - y);
  const windowed = successes.filter((t) => t <= b);
  let maxGapMs = 0;
  let maxGapEndsAt = null;
  let prev = windowed.filter((t) => t < a).pop() ?? a;
  for (const t of windowed.filter((t) => t >= a)) {
    if (t - prev > maxGapMs) {
      maxGapMs = t - prev;
      maxGapEndsAt = new Date(t).toISOString();
    }
    prev = t;
  }
  const lastSuccess = windowed.length ? windowed[windowed.length - 1] : null;
  const openGapMs = lastSuccess === null ? b - a : b - lastSuccess;
  if (openGapMs > maxGapMs) {
    maxGapMs = openGapMs;
    maxGapEndsAt = null; // まだ続いている
  }

  // 同時実行（前の run が終わる前に次の run が作られた）
  let overlaps = 0;
  const all = runs.filter(inWindow).sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
  for (let i = 1; i < all.length; i++) {
    const end = Date.parse(all[i - 1].updatedAt ?? "");
    if (Number.isFinite(end) && Date.parse(all[i].createdAt) < end) overlaps++;
  }

  const ran = slotRows.filter((r) => r.status !== "missing");
  const delays = ran.map((r) => r.delayMinutes);
  const count = (pred) => ran.filter(pred).length;
  const sum = (key) => (ran.some((r) => Number.isInteger(r[key])) ? ran.reduce((acc, r) => acc + (Number.isInteger(r[key]) ? r[key] : 0), 0) : null);

  // 更新の検出の遅れ: update_available を検出した run の直前の成功した検出から 130 分を超えていた回数
  let delayedDetections = 0;
  for (const r of ran.filter((x) => x.outcome === "change_detected")) {
    const t = Date.parse(r.createdAt);
    const before = successes.filter((s) => s < t).pop();
    if (before !== undefined && t - before > GAP_NOTICE_MS) delayedDetections++;
  }

  const expected = slots.length;
  const missingRatio = expected ? missing / expected : 0;
  const reconsider = {
    gapAtLeast6h: maxGapMs >= RECONSIDER_GAP_MS,
    missingAboutHalfOrMore: expected >= 24 && missingRatio >= RECONSIDER_MISSING_RATIO,
    delayedDetectionsTwiceOrMore: delayedDetections >= RECONSIDER_DELAYED_DETECTIONS,
    scheduleDisabled: workflowState !== null && workflowState !== "active",
  };

  return {
    window: { since: new Date(a).toISOString(), until: new Date(b).toISOString() },
    expected,
    actual: ran.length,
    extraRuns: extra.length,
    manualRuns: manual.length,
    missing,
    missingRatio: Number(missingRatio.toFixed(3)),
    maxConsecutiveMissing,
    maxGapMinutes: Math.round(maxGapMs / 60000),
    maxGapEndsAt,
    lastSuccessfulDetection: lastSuccess === null ? null : new Date(lastSuccess).toISOString(),
    delayMinutes: { median: median(delays), max: delays.length ? Math.max(...delays) : null },
    light: count((r) => r.mode === "light"),
    fullScan: count((r) => r.mode === "full"),
    noChange: count((r) => r.outcome === "no_change"),
    lightNoSignalChange: count((r) => r.outcome === "light_no_signal_change"),
    changeDetected: count((r) => r.outcome === "change_detected"),
    failure: count((r) => r.status === "failure" || r.outcome === "failure"),
    skip: count((r) => r.status === "skip"),
    cancelled: count((r) => r.status === "cancelled"),
    concurrencyOverlaps: overlaps,
    requests: sum("requests"),
    downloadedBytes: sum("bytes"),
    durationSeconds: { median: median(ran.map((r) => r.durationSeconds).filter(Number.isInteger)), total: sum("durationSeconds") },
    gapNotices: gapNotices.filter((n) => {
      const t = Date.parse(n.at);
      return t >= a && t <= b;
    }).length,
    delayedDetections,
    workflowState,
    reconsider,
    reconsiderExternalTrigger: Object.values(reconsider).some(Boolean),
    slots: slotRows,
  };
}
