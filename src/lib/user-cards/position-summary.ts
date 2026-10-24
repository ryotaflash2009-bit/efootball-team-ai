import { POSITION_ORDER } from "@/lib/tier/own-tier";
import { bestOwnedAt, comparableOvr, ownStrength, type ImpactCard } from "@/lib/new-cards/team-impact";

export interface PositionSummaryRow {
  position: string;
  /** そのポジションで所持しているカードの枚数。 */
  count: number;
  /** 所持の最も強いカード（無ければ null）。 */
  best: ImpactCard | null;
  bestOvr: number | null;
  /** 所持の最も強いカードより強い新しいカードの枚数（無いポジションは、そのポジションの新しいカードの枚数）。 */
  upgrades: number;
}

/**
 * My Team のポジション別のまとめ（2026-10-25）。13 のポジションの順に、枚数・最も強いカード・新しいカードでの強化の枚数を出す。
 * 強さの比べ方は新しいカードの一覧・パック診断と同じ（bestOwnedAt と comparableOvr）。
 */
export function positionSummary(owned: readonly ImpactCard[], newCards: readonly ImpactCard[] = []): PositionSummaryRow[] {
  return POSITION_ORDER.map((position) => {
    const mine = owned.filter((c) => c.registeredPosition === position);
    const probe: ImpactCard = { worldCardId: "", nameJa: null, nameEn: null, registeredPosition: position, ovrBase: null, ovrMax: null };
    const best = bestOwnedAt(probe, mine);
    const ownedIds = new Set(mine.map((c) => c.worldCardId));
    const candidates = newCards.filter((c) => c.registeredPosition === position && !ownedIds.has(c.worldCardId));
    const upgrades = best
      ? candidates.filter((c) => {
          const x = comparableOvr(c, best);
          return x.a != null && x.b != null && x.a > x.b;
        }).length
      : candidates.length;
    return { position, count: mine.length, best, bestOvr: best ? ownStrength(best) : null, upgrades };
  });
}
