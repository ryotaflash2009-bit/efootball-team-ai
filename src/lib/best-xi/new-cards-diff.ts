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

export interface BestXiNewCardEntry {
  slotId: string;
  position: string;
  after: BestXiSelectedSlot;
}

/**
 * 新しいカードを足して選び直す（2026-10-18: 比べる前の先発もいまの候補から選び直す＝古い結果と比べない）。
 * 枠の入れ替え（最適化で他の選手が別の枠へ動く）があるため、枠ごとの「前→後」ではなく、
 * 先発に入る新しいカード（その枠）と、先発から外れる選手を分けて返す。
 */
export function bestXiWithNewCards(params: {
  formationId: string;
  baseCandidates: readonly BestXiCandidate[];
  newCandidates: readonly BestXiCandidate[];
  unavailableCards: readonly BestXiUnavailableCard[];
  generatedAt: string;
}): { before: BestXiSelectionResult; result: BestXiSelectionResult; entering: BestXiNewCardEntry[]; leaving: BestXiCandidate[] } {
  const newIds = new Set(params.newCandidates.map((c) => c.worldCardId));
  const before = selectBestXi({ formationId: params.formationId, candidates: [...params.baseCandidates], unavailableCards: [...params.unavailableCards], generatedAt: params.generatedAt });
  const result = selectBestXi({
    formationId: params.formationId,
    candidates: [...params.baseCandidates, ...params.newCandidates],
    unavailableCards: [...params.unavailableCards],
    generatedAt: params.generatedAt,
  });
  const entering = result.slots.filter((s) => newIds.has(s.candidate.worldCardId)).map((s) => ({ slotId: s.slotId, position: s.position, after: s }));
  const afterIds = new Set(result.slots.map((s) => s.candidate.worldCardId));
  const leaving = before.slots.filter((s) => !afterIds.has(s.candidate.worldCardId)).map((s) => s.candidate);
  return { before, result, entering, leaving };
}
