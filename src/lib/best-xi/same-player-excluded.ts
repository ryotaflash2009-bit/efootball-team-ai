import { personKeyOf } from "@/lib/world/person-identity";
import type { BestXiCandidate } from "./types";

/**
 * AI ベスト11 で「同じ選手の別のカードを使ったため選ばなかったカード」（2026-10-11）。
 * 先発・控えに選んだカードと人物のキーが同じで、自身は選ばれていない候補（使える状態のもの）を、カードごとに 1 件。
 * 選考の結果は変えない（説明のためだけ）。
 */
export function samePlayerExcluded(candidates: readonly BestXiCandidate[], usedWorldCardIds: readonly string[]): BestXiCandidate[] {
  const used = new Set(usedWorldCardIds);
  const usedKeys = new Set(usedWorldCardIds.map((id) => personKeyOf(id)).filter((k): k is string => !!k));
  const seen = new Set<string>();
  const out: BestXiCandidate[] = [];
  for (const c of candidates) {
    if (c.abilityStatus !== "available" || used.has(c.worldCardId) || seen.has(c.worldCardId)) continue;
    const key = personKeyOf(c.worldCardId);
    if (!key || !usedKeys.has(key)) continue;
    seen.add(c.worldCardId);
    out.push(c);
  }
  return out;
}
