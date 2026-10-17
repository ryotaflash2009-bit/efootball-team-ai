import { describe, it, expect } from "vitest";
import { packCheck } from "./pack-check";
import { newCardTeamImpact } from "./team-impact";
import type { ImpactCard } from "./team-impact";

const P = (person: number, v: number) => String(v * 1048576 + person);
const c = (id: string, pos: string | null, base: number | null, max: number | null): ImpactCard => ({ worldCardId: id, nameJa: null, nameEn: id, registeredPosition: pos, ovrBase: base, ovrMax: max });

describe("パックの診断（F-092 の自前の版・2026-10-17）", () => {
  it("同じポジションの所持の最高と比べる（強化・強化にならない・持っていないポジション）", () => {
    const owned = [c(P(1, 1), "CF", 85, 100), c(P(2, 1), "CF", 88, 104), c(P(3, 1), "CB", 80, 95)];
    const pack = [c(P(10, 1), "CF", 89, 106), c(P(11, 1), "CB", 78, 93), c(P(12, 1), "GK", 82, 99)];
    const { results, summary } = packCheck(pack, owned);
    expect(results.map((r) => [r.card.worldCardId, r.verdict, r.delta, r.bestOwned?.worldCardId ?? null])).toEqual([
      [P(10, 1), "upgrade", 2, P(2, 1)],
      [P(12, 1), "new_position", null, null],
      [P(11, 1), "no_upgrade", -2, P(3, 1)],
    ]);
    expect(summary).toEqual({ total: 3, upgrades: 1, newPositions: 1, alreadyOwned: 0, samePlayer: 0, bestDelta: 2 });
  });

  it("同じカードの所持は already_owned。同じ選手の別のカードは目印だけで、強ければ強化として数える", () => {
    const owned = [c(P(1, 1), "CF", 85, 100)];
    const pack = [c(P(1, 1), "CF", 85, 100), c(P(1, 2), "CF", 90, 105)];
    const { results, summary } = packCheck(pack, owned);
    expect(results.map((r) => [r.card.worldCardId, r.verdict, r.samePlayerOwned?.worldCardId ?? null])).toEqual([
      [P(1, 2), "upgrade", P(1, 1)],
      [P(1, 1), "already_owned", null],
    ]);
    expect(summary.alreadyOwned).toBe(1);
    expect(summary.samePlayer).toBe(1);
  });

  it("最大 OVR の無い暫定のカードは基本の OVR どうし。同じカードを 2 回選んでも 1 回だけ数える", () => {
    const { results, summary } = packCheck([c(P(5, 1), "RB", 83, null), c(P(5, 1), "RB", 83, null)], [c(P(6, 1), "RB", 80, 99)]);
    expect(results.map((r) => [r.verdict, r.basis, r.delta])).toEqual([["upgrade", "base", 3]]);
    expect(summary.total).toBe(1);
  });

  it("所持が空なら全部「持っていないポジション」・ポジションか OVR が無いものは unknown", () => {
    const { results } = packCheck([c(P(7, 1), "LB", 80, 96), c(P(8, 1), null, 80, 96)], []);
    expect(results.map((r) => r.verdict)).toEqual(["new_position", "unknown"]);
  });

  it("所持の最も強いカードはそれぞれの強さ（最大、無ければ基本）で選ぶ・新しいカードの一覧と同じ判定（2026-10-18）", () => {
    const card = c(P(20, 1), "CB", 80, 100);
    const owned = [c(P(21, 1), "CB", 88, 98), c(P(22, 1), "CB", 85, null)];
    const r = packCheck([card], owned).results[0];
    expect([r.verdict, r.bestOwned?.worldCardId, r.basis, r.delta]).toEqual(["upgrade", P(21, 1), "max", 2]);
    const impact = newCardTeamImpact([card], owned)[0];
    expect([impact.bestOwned?.worldCardId, impact.delta]).toEqual([P(21, 1), 2]);
  });

  it("持っていないポジションの OVR は最大 OVR（無ければ基本）", () => {
    const r = packCheck([c(P(30, 1), "GK", 80, 99)], []).results[0];
    expect([r.verdict, r.newOvr, r.basis]).toEqual(["new_position", 99, "max"]);
  });
});
