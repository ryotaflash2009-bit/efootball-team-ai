/**
 * 適用済みの記録（docs/production-readiness/reference-data-applied-state.json）の自動の更新（pure・2026-10-11）。
 *
 * 本人の指示「完全自動更新を完成させて」。これまでは、Apply（applied_verified）の後に Claude Code・本人が Evidence の PR で手で
 * 記録を更新していた。記録が古いままだと、毎時の検出が適用済みの候補を「更新あり」と見続け、完全な走査と通知を繰り返す。
 *
 * 入力: 今の記録・Apply の Evidence の artifact の `applied-state.candidate.json`（applied_verified のときだけ作られる）・
 *       検出の要約（World の `maxAppearanceUpdatedAt` は、同じ候補の checksum の検出の `timestamps.max` から取る）。
 * 規則:
 *  - 候補は形を検証し、dataset ごとに「今の記録より新しい appliedAt」のうち最新の 1 件だけを使う。同じ checksum は更新しない。
 *  - World は、同じ checksum の検出の要約から timestamps.max が取れないときは更新しない（推測で埋めない・次の機会に再試行）。
 *  - 件数が減る候補は更新しない（削除は自動の対象外のため、起きていれば異常）。
 */
export const CANDIDATE_SCHEMA = "reference-data-applied-state-candidate/v1";
const DATASETS = ["world_player_cards", "managers"];
const CS12 = /^[0-9a-f]{12}$/;
const RUN = /^[0-9]{1,20}$/;
const ISO_DAY = (iso) => iso.slice(0, 10);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** 候補の形の検証。正しければ { dataset, entry } を返す。 */
export function parseCandidate(c) {
  if (!isObj(c) || c.schema !== CANDIDATE_SCHEMA || !DATASETS.includes(c.dataset) || !isObj(c.entry)) return null;
  const e = c.entry;
  if (!CS12.test(e.sourceChecksum12 ?? "") || !Number.isInteger(e.recordCount) || e.recordCount < 0) return null;
  if (typeof e.appliedAt !== "string" || !Number.isFinite(Date.parse(e.appliedAt)) || !RUN.test(String(e.applyRunId ?? ""))) return null;
  return { dataset: c.dataset, entry: { sourceChecksum12: e.sourceChecksum12, recordCount: e.recordCount, appliedAt: e.appliedAt, applyRunId: String(e.applyRunId) } };
}

/**
 * @param {{ appliedState: any, candidates: unknown[], detections: unknown[] }} p
 * @returns {{ changed: boolean, appliedState: any, updates: { dataset: string, applyRunId: string, evidencePath: string }[], skipped: string[] }}
 */
export function buildAppliedStateUpdate({ appliedState, candidates, detections }) {
  const skipped = [];
  if (!isObj(appliedState) || !isObj(appliedState.datasets)) return { changed: false, appliedState, updates: [], skipped: ["applied_state_invalid"] };
  const next = JSON.parse(JSON.stringify(appliedState));
  const latest = {};
  for (const raw of candidates ?? []) {
    const c = parseCandidate(raw);
    if (!c) {
      skipped.push("candidate_invalid");
      continue;
    }
    const cur = next.datasets[c.dataset];
    if (isObj(cur) && typeof cur.appliedAt === "string" && Date.parse(c.entry.appliedAt) <= Date.parse(cur.appliedAt)) continue;
    if (!latest[c.dataset] || Date.parse(c.entry.appliedAt) > Date.parse(latest[c.dataset].appliedAt)) latest[c.dataset] = c.entry;
  }
  const updates = [];
  for (const dataset of DATASETS) {
    const e = latest[dataset];
    if (!e) continue;
    const cur = next.datasets[dataset] ?? {};
    if (cur.sourceChecksum12 === e.sourceChecksum12) {
      skipped.push(`${dataset}:same_checksum`);
      continue;
    }
    if (Number.isInteger(cur.recordCount) && e.recordCount < cur.recordCount) {
      skipped.push(`${dataset}:record_count_drop`);
      continue;
    }
    const evidencePath = `docs/production-readiness/evidence/${dataset === "world_player_cards" ? "world" : "managers"}-auto-apply-${ISO_DAY(e.appliedAt)}-${e.applyRunId}.json`;
    const entry = { sourceChecksum12: e.sourceChecksum12, recordCount: e.recordCount, appliedAt: e.appliedAt };
    if (dataset === "world_player_cards") {
      const det = (detections ?? []).find((d) => isObj(d) && isObj(d.world) && d.world.sourceChecksum12 === e.sourceChecksum12 && isObj(d.world.timestamps) && typeof d.world.timestamps.max === "string");
      if (!det) {
        skipped.push("world_player_cards:max_timestamp_unknown");
        continue;
      }
      entry.maxAppearanceUpdatedAt = det.world.timestamps.max;
    }
    entry.evidence = evidencePath;
    next.datasets[dataset] = entry;
    updates.push({ dataset, applyRunId: e.applyRunId, evidencePath });
  }
  if (updates.length) {
    const days = updates.map((u) => ISO_DAY(next.datasets[u.dataset].appliedAt)).sort();
    next.updatedAt = days[days.length - 1];
  }
  return { changed: updates.length > 0, appliedState: next, updates, skipped };
}
