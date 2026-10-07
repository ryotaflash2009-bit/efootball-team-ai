import { getFormation } from "@/lib/squad/formations";
import { MAX_SUBSTITUTES } from "@/lib/squad/types";
import { compareRankTuples, computeRankTuple, type BestXiRankTuple } from "./rank";
import type { BestXiCandidate, BestXiSelectionResult } from "./types";

/**
 * AI ベスト11 の控え（2026-10-07）。先発の選考（`selectBestXi`）は変えず、その後に決定的な規則で控えを選ぶ。
 * 純関数・Math.random 不使用・現在時刻に依存しない。
 *
 * 1. 先発に入ったカードは使わない。同じカードは 1 回だけ（ビルドが複数あれば、そのカードで最も良い候補）。
 * 2. 控えの GK（フォーメーションに GK があり、本職の GK が残っていれば 1 人）。
 * 3. ポジションの穴埋め: フォーメーションの各ポジション（表示順・重複なし）ごとに、本職（exact）で最も良い 1 人。
 * 4. 残りの枠: 先発のどれかのポジションに自動で選べる（exact / related）候補を、最も良いポジションでの評価の順に。
 * 比較は先発と同じ `compareRankTuples`（本職 → ポジション別評価 → 能力 → 安定の順）。合成の点数は作らない。
 */
export type BestXiBenchReason = "backupGoalkeeper" | "positionCover" | "bestRemaining";

export interface BestXiBenchEntry {
  candidate: BestXiCandidate;
  /** 控えとして備えるポジション（その候補が最も良いポジション）。 */
  position: string;
  positionRating: number | null;
  reason: BestXiBenchReason;
}

export interface BestXiBenchResult {
  entries: BestXiBenchEntry[];
  /** 本職の控えがいないポジション（フォーメーションの表示順）。 */
  uncoveredPositions: string[];
  maxSize: number;
}

interface Scored {
  candidate: BestXiCandidate;
  position: string;
  tuple: BestXiRankTuple;
  exact: boolean;
}

export function selectBestXiBench(params: {
  formationId: string;
  candidates: BestXiCandidate[];
  selection: Pick<BestXiSelectionResult, "slots">;
  maxSize?: number;
}): BestXiBenchResult {
  const maxSize = Math.max(0, Math.min(params.maxSize ?? MAX_SUBSTITUTES, MAX_SUBSTITUTES));
  const formation = getFormation(params.formationId);
  const positions: string[] = [];
  for (const s of [...formation.slots].sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (!positions.includes(s.position)) positions.push(s.position);
  }
  const usedCards = new Set(params.selection.slots.map((s) => s.candidate.worldCardId));

  // カードごと・ポジションごとに、そのカードで最も良い候補（ビルド）を 1 つ残す。
  const bestByCardPosition = new Map<string, Scored>();
  for (const candidate of params.candidates) {
    if (usedCards.has(candidate.worldCardId) || candidate.abilityStatus !== "available") continue;
    for (const position of positions) {
      const { tuple, suitability } = computeRankTuple(candidate, position);
      if (!tuple.eligible) continue;
      const key = `${candidate.worldCardId}\u0000${position}`;
      const prev = bestByCardPosition.get(key);
      if (!prev || compareRankTuples(tuple, prev.tuple) < 0) {
        bestByCardPosition.set(key, { candidate, position, tuple, exact: suitability.tier === "exact" });
      }
    }
  }
  const all = [...bestByCardPosition.values()];
  const taken = new Set<string>();
  const entries: BestXiBenchEntry[] = [];
  const add = (s: Scored, reason: BestXiBenchReason) => {
    taken.add(s.candidate.worldCardId);
    entries.push({ candidate: s.candidate, position: s.position, positionRating: s.tuple.positionRating, reason });
  };
  const bestFor = (pred: (s: Scored) => boolean): Scored | null => {
    let best: Scored | null = null;
    for (const s of all) {
      if (taken.has(s.candidate.worldCardId) || !pred(s)) continue;
      if (!best || compareRankTuples(s.tuple, best.tuple) < 0) best = s;
    }
    return best;
  };

  const uncoveredPositions: string[] = [];
  // 2. 控えの GK
  if (positions.includes("GK") && entries.length < maxSize) {
    const gk = bestFor((s) => s.position === "GK" && s.exact);
    if (gk) add(gk, "backupGoalkeeper");
    else uncoveredPositions.push("GK");
  }
  // 3. ポジションの穴埋め（本職だけ）
  for (const position of positions) {
    if (position === "GK") continue;
    if (entries.length >= maxSize) break;
    const s = bestFor((x) => x.position === position && x.exact);
    if (s) add(s, "positionCover");
    else uncoveredPositions.push(position);
  }
  // 4. 残りの枠: 各カードの最も良いポジションでの評価の順（GK の 2 人目以降は入れない）。
  while (entries.length < maxSize) {
    const s = bestFor((x) => x.position !== "GK" && bestPositionOf(x.candidate.worldCardId) === x);
    if (!s) break;
    add(s, "bestRemaining");
  }
  return { entries, uncoveredPositions, maxSize };

  function bestPositionOf(worldCardId: string): Scored | null {
    let best: Scored | null = null;
    for (const s of all) {
      if (s.candidate.worldCardId !== worldCardId || s.position === "GK") continue;
      if (!best || compareRankTuples(s.tuple, best.tuple) < 0) best = s;
    }
    return best;
  }
}
