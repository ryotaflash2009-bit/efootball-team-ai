import { personKeyOf } from "@/lib/world/person-identity";
import { comparableOvr, type ImpactCard } from "./team-impact";

/**
 * スカッドの枠ごとの新しいカードの提案（2026-10-17）: 枠のポジションと同じ登録ポジションの新しいカードのうち、
 * 今の選手より OVR が高いもの（空いている枠は最も高いもの）を 1 枚ずつ出す。スカッドに既にいるカードは提案しない。
 */
export interface SquadSlotForSuggestion {
  slotId: string;
  position: string;
  current: ImpactCard | null;
}
export interface SquadSuggestion {
  slotId: string;
  position: string;
  current: ImpactCard | null;
  suggestion: ImpactCard;
  basis: "max" | "base";
  newOvr: number;
  currentOvr: number | null;
  /** 今の選手との差（空いている枠は null）。 */
  delta: number | null;
}

const ovrOf = (c: ImpactCard) => (typeof c.ovrMax === "number" ? c.ovrMax : typeof c.ovrBase === "number" ? c.ovrBase : null);

export function squadNewCardSuggestions(slots: readonly SquadSlotForSuggestion[], newCards: readonly ImpactCard[], inSquad: ReadonlySet<string>): SquadSuggestion[] {
  // 枠×カードの候補をすべて作り、良い順に「枠も選手も 1 回ずつ」で割り当てる（同じカード・同じ選手の別カードを 2 つの枠に出さない）
  const candidates: SquadSuggestion[] = [];
  for (const slot of slots) {
    for (const card of newCards) {
      if (card.registeredPosition !== slot.position || inSquad.has(card.worldCardId)) continue;
      if (slot.current) {
        const c = comparableOvr(card, slot.current);
        if (c.a == null || c.b == null || c.a <= c.b) continue;
        candidates.push({ slotId: slot.slotId, position: slot.position, current: slot.current, suggestion: card, basis: c.basis, newOvr: c.a, currentOvr: c.b, delta: c.a - c.b });
      } else {
        const o = ovrOf(card);
        if (o == null) continue;
        candidates.push({ slotId: slot.slotId, position: slot.position, current: null, suggestion: card, basis: typeof card.ovrMax === "number" ? "max" : "base", newOvr: o, currentOvr: null, delta: null });
      }
    }
  }
  // 空いている枠を先に、次に差の大きい順
  candidates.sort((a, b) => (a.delta == null ? -1 : 0) - (b.delta == null ? -1 : 0) || (b.delta ?? 0) - (a.delta ?? 0) || b.newOvr - a.newOvr || a.suggestion.worldCardId.localeCompare(b.suggestion.worldCardId));
  // スカッドにいる選手（の別のカード）は出さない。ただし、その枠の今の選手の別のカードへの入れ替えは良い
  const squadPersons = new Map<string, number>();
  for (const id of inSquad) {
    const k = personKeyOf(id);
    if (k) squadPersons.set(k, (squadPersons.get(k) ?? 0) + 1);
  }
  const filledSlots = new Set<string>();
  const usedPersons = new Set<string>();
  const out: SquadSuggestion[] = [];
  for (const x of candidates) {
    if (filledSlots.has(x.slotId)) continue;
    const k = personKeyOf(x.suggestion.worldCardId) ?? x.suggestion.worldCardId;
    if (usedPersons.has(k)) continue;
    const ownSlotPerson = x.current ? personKeyOf(x.current.worldCardId) : null;
    const inSquadCount = squadPersons.get(k) ?? 0;
    if (inSquadCount > (ownSlotPerson === k ? 1 : 0)) continue;
    filledSlots.add(x.slotId);
    usedPersons.add(k);
    out.push(x);
  }
  return out;
}
