import { selectBestXi } from "./select";
import type { BestXiCandidate, BestXiSelectedSlot, BestXiSelectionResult, BestXiUnavailableCard } from "./types";
import type { ImpactCard } from "@/lib/new-cards/team-impact";

/**
 * AI ベスト11 に「新しいカードを入れたら」（2026-10-17）。
 *
 * - 新しいカード（最近追加・暫定）を「持っている」と仮定して、同じ規則（`selectBestXi`）で選び直し、先発が変わる枠だけを出す。
 * - 詳細の取得（1 枚ずつ）を増やしすぎないよう、フォーメーションの枠の登録ポジションごとに OVR の高い新しいカードを perPosition 枚まで。
 * - 仮定だけ（My Team・保存ビルドは変えない・保存しない）。新しいカードは保存ビルドが無いので、育成なしの能力値で比べる。
 */
export function pickNewCardIdsForFormation(params: {
  newCards: readonly ImpactCard[];
  slotPositions: readonly string[];
  ownedIds: ReadonlySet<string>;
  perPosition?: number;
}): string[] {
  const per = params.perPosition ?? 3;
  const positions = new Set(params.slotPositions);
  const ovr = (c: ImpactCard) => c.ovrMax ?? c.ovrBase ?? -1;
  const byPos = new Map<string, ImpactCard[]>();
  for (const c of params.newCards) {
    if (!c.registeredPosition || !positions.has(c.registeredPosition) || params.ownedIds.has(c.worldCardId)) continue;
    const list = byPos.get(c.registeredPosition) ?? [];
    list.push(c);
    byPos.set(c.registeredPosition, list);
  }
  const out: string[] = [];
  for (const pos of [...positions].sort()) {
    const list = (byPos.get(pos) ?? []).sort((a, b) => ovr(b) - ovr(a) || a.worldCardId.localeCompare(b.worldCardId));
    for (const c of list.slice(0, per)) if (!out.includes(c.worldCardId)) out.push(c.worldCardId);
  }
  return out;
}

export interface BestXiNewCardChange {
  slotId: string;
  position: string;
  before: BestXiSelectedSlot | null;
  after: BestXiSelectedSlot;
}

/** 新しいカードを足して選び直し、先発に新しいカードが入る枠を返す（枠の順）。 */
export function bestXiWithNewCards(params: {
  formationId: string;
  baseResult: BestXiSelectionResult;
  baseCandidates: readonly BestXiCandidate[];
  newCandidates: readonly BestXiCandidate[];
  unavailableCards: readonly BestXiUnavailableCard[];
}): { result: BestXiSelectionResult; changes: BestXiNewCardChange[] } {
  const newIds = new Set(params.newCandidates.map((c) => c.worldCardId));
  const result = selectBestXi({
    formationId: params.formationId,
    candidates: [...params.baseCandidates, ...params.newCandidates],
    unavailableCards: [...params.unavailableCards],
    generatedAt: params.baseResult.generatedAt,
  });
  const beforeBySlot = new Map(params.baseResult.slots.map((s) => [s.slotId, s]));
  const changes: BestXiNewCardChange[] = [];
  for (const s of result.slots) {
    if (!newIds.has(s.candidate.worldCardId)) continue;
    changes.push({ slotId: s.slotId, position: s.position, before: beforeBySlot.get(s.slotId) ?? null, after: s });
  }
  return { result, changes };
}
