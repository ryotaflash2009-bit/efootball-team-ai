import { personKeyOf } from "@/lib/world/person-identity";

export interface OwnedCandidate {
  worldCardId: string;
  registeredPosition: string | null;
  ovrMax: number | null;
  ovrBase: number | null;
}

/**
 * 比べるカードと同じ登録ポジションで、所持のうち最大 OVR が最も高いカード（純関数・2026-11-01）。
 * 比べるカードそのもの・同じ選手の別のカードは除く。同じ OVR は World ID の順。無ければ null。
 */
export function bestOwnedForPosition<T extends OwnedCandidate>(base: { worldCardId: string; registeredPosition: string | null }, owned: readonly T[]): T | null {
  if (!base.registeredPosition) return null;
  const basePerson = personKeyOf(base.worldCardId) ?? base.worldCardId;
  const ovr = (c: OwnedCandidate) => c.ovrMax ?? c.ovrBase ?? -1;
  let best: T | null = null;
  for (const c of owned) {
    if (c.registeredPosition !== base.registeredPosition || c.worldCardId === base.worldCardId) continue;
    if ((personKeyOf(c.worldCardId) ?? c.worldCardId) === basePerson) continue;
    if (!best || ovr(c) > ovr(best) || (ovr(c) === ovr(best) && c.worldCardId.localeCompare(best.worldCardId) < 0)) best = c;
  }
  return best;
}
