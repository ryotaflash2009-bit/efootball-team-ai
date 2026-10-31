import { personKeyOf } from "@/lib/world/person-identity";

export interface BenchCard {
  worldCardId: string;
  registeredPosition: string | null;
  ovrMax: number | null;
  ovrBase: number | null;
}

export interface BenchSuggestion<T extends BenchCard> {
  position: string;
  card: T;
}

/**
 * 控えの候補（純関数・2026-11-01）。先発のポジションのうち、控えに同じ登録ポジションのカードがいないものについて、
 * 所持のカード（スカッドにいない・スカッドにいる選手の別のカードでない）から最大 OVR の最も高いものを 1 枚ずつ出す。
 * 同じカード・同じ選手を 2 つのポジションに出さない。ポジションは先発の並びの順。
 */
export function benchSuggestions<T extends BenchCard>(params: {
  starterPositions: readonly string[];
  benchPositions: readonly (string | null)[];
  inSquad: ReadonlySet<string>;
  owned: readonly T[];
  limit?: number;
}): BenchSuggestion<T>[] {
  const { starterPositions, benchPositions, inSquad, owned, limit = 7 } = params;
  const covered = new Set(benchPositions.filter((p): p is string => !!p));
  const usedPersons = new Set([...inSquad].map((id) => personKeyOf(id) ?? id));
  const ovr = (c: BenchCard) => c.ovrMax ?? c.ovrBase ?? -1;
  const out: BenchSuggestion<T>[] = [];
  const seenPositions = new Set<string>();
  for (const position of starterPositions) {
    if (!position || covered.has(position) || seenPositions.has(position)) continue;
    seenPositions.add(position);
    let best: T | null = null;
    for (const c of owned) {
      if (c.registeredPosition !== position || inSquad.has(c.worldCardId)) continue;
      if (usedPersons.has(personKeyOf(c.worldCardId) ?? c.worldCardId)) continue;
      if (!best || ovr(c) > ovr(best) || (ovr(c) === ovr(best) && c.worldCardId.localeCompare(best.worldCardId) < 0)) best = c;
    }
    if (best) {
      out.push({ position, card: best });
      usedPersons.add(personKeyOf(best.worldCardId) ?? best.worldCardId);
    }
    if (out.length >= limit) break;
  }
  return out;
}
