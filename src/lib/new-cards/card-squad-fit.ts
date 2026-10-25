import { squadNewCardSuggestions, type SquadSlotForSuggestion, type SquadSuggestion } from "./squad-suggestions";
import type { ImpactCard } from "./team-impact";

export interface SquadFitInput {
  squadId: string;
  squadName: string;
  slots: readonly SquadSlotForSuggestion[];
  inSquad: ReadonlySet<string>;
}

export type SquadFit = SquadSuggestion & { squadId: string; squadName: string };

/**
 * 1 枚のカードで強くなる保存スカッド（純関数・2026-10-26）。スカッドごとに新しいカードの欄と同じ規則
 * （`squadNewCardSuggestions`: 同じ登録ポジション・今の選手より OVR が高い・同じ選手はスカッドに 1 枚）で当て、
 * 当てられたスカッドだけを返す。並びは差の大きい順 → 空いている枠 → スカッド名。
 */
export function squadsStrengthenedByCard(card: ImpactCard, squads: readonly SquadFitInput[]): SquadFit[] {
  const out: SquadFit[] = [];
  for (const sq of squads) {
    const hit = squadNewCardSuggestions(sq.slots, [card], sq.inSquad)[0];
    if (hit) out.push({ ...hit, squadId: sq.squadId, squadName: sq.squadName });
  }
  return out.sort(
    (a, b) => (b.delta ?? -1) - (a.delta ?? -1) || a.squadName.localeCompare(b.squadName) || a.squadId.localeCompare(b.squadId),
  );
}
