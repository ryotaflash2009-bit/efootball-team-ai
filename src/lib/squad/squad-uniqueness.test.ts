import { describe, expect, it } from "vitest";
import type { PerspectivePlayer } from "./diagnosis-perspectives";
import { evaluateSquadUniqueness, SQUAD_UNIQUENESS_VERSION, SYNTHETIC_FORMATION_PRIOR } from "./squad-uniqueness";

const stats = (atk: number, def: number, other = 70) => ({
  offensiveAwareness: atk, finishing: atk, heading: other, setPieceTaking: atk, curl: atk,
  defensiveAwareness: def, tackling: def, aggression: def, defensiveEngagement: def,
  ballControl: other, dribbling: other, tightPossession: other, lowPass: other, loftedPass: other,
  speed: other, acceleration: other, kickingPower: other, jumping: other, physicalContact: other, balance: other, stamina: other,
  gkAwareness: 40, gkCatching: 40, gkParrying: 40, gkReflexes: 40, gkReach: 40,
});
let n = 0;
const p = (o: Partial<PerspectivePlayer>): PerspectivePlayer => ({ key: `k${n++}`, name: "P", slot: "starter", position: "CMF", role: "MF", x: 50, playingStyle: "boxToBox", compatibility: "exact", heightCm: null, strongFoot: null, stats: stats(70, 70), ...o });
const xi = (o: (i: number) => Partial<PerspectivePlayer> = () => ({})) =>
  ["GK", "CB", "CB", "LB", "RB", "DMF", "CMF", "CMF", "LWF", "CF", "RWF"].map((pos, i) => p({ position: pos, role: pos === "GK" ? "GK" : i < 5 ? "DF" : i < 8 ? "MF" : "FW", ...o(i) }));
const STYLES = ["goalkeeper", "buildUp", "destroyer", "fullbackFinisher", "offensiveFullback", "anchorMan", "orchestrator", "boxToBox", "prolificWinger", "goalPoacher", "roamingFlank"];

describe("スカッドの独自性（候補）", () => {
  it("版・要素・計算しない要素（人気の統計）を明示する", () => {
    const r = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi(), managerTactics: null } });
    expect(r.version).toBe(SQUAD_UNIQUENESS_VERSION);
    expect(r.components.map((c) => c.id)).toEqual(["formation", "playstyleDiversity", "unconventionalPlacement", "profileSpecialization", "rarePlayerCombination", "managerRarity"]);
    expect(r.components.find((c) => c.id === "rarePlayerCombination")!.score).toBeNull();
    expect(r.limitations.join(" ")).toMatch(/synthetic prior/);
  });

  it("フォーメーション: 合成の事前分布で、よく使われる形ほど低い（4-3-3 は 0・5-3-2 は高い）", () => {
    const common = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi(), managerTactics: null } });
    const rare = evaluateSquadUniqueness({ formationId: "5-3-2", perspective: { players: xi(), managerTactics: null } });
    expect(common.components[0].score).toBe(0);
    expect(rare.components[0].score!).toBeGreaterThan(70);
    expect(Object.values(SYNTHETIC_FORMATION_PRIOR).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("プレースタイル: 全員違えば 100・全員同じなら 0", () => {
    const diverse = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi((i) => ({ playingStyle: STYLES[i] })), managerTactics: null } });
    const same = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi(() => ({ playingStyle: "boxToBox" })), managerTactics: null } });
    expect(diverse.components[1].score).toBe(100);
    expect(same.components[1].score).toBe(0);
  });

  it("配置: 本職以外の先発が多いほど高い（4 人以上で 100）", () => {
    const off = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi((i) => ({ compatibility: i >= 7 ? "related" : "exact" })), managerTactics: null } });
    expect(off.components[2].score).toBe(100);
    const none = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi(), managerTactics: null } });
    expect(none.components[2].score).toBe(0);
  });

  it("能力の構成: 偏ったスカッドほど高い・均等なら 0", () => {
    const flat = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi(() => ({ stats: stats(70, 70) })), managerTactics: null } });
    const skewed = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: xi(() => ({ stats: stats(95, 45) })), managerTactics: null } });
    expect(flat.components[3].score).toBe(0);
    expect(skewed.components[3].score!).toBeGreaterThan(50);
  });

  it("データ不足では計算しない（null・理由つき）・候補点は 2 要素以上のときだけ", () => {
    const r = evaluateSquadUniqueness({ formationId: "unknown", perspective: { players: [], managerTactics: null } });
    expect(r.candidateScore).toBeNull();
    expect(r.components.every((c) => c.score === null)).toBe(true);
    expect(r.limitations.length).toBeGreaterThan(2);
  });

  it("計算できた要素が 1 つだけなら、最も独自・最も一般的を示さない", () => {
    const r = evaluateSquadUniqueness({ formationId: "4-3-3", perspective: { players: [], managerTactics: null } });
    expect(r.components.filter((c) => c.score !== null)).toHaveLength(1);
    expect(r.mostUnique).toBeNull();
    expect(r.mostCommon).toBeNull();
  });

  it("決定的: 同じ入力は同じ結果・並び順に依存しない・同点は決まった順", () => {
    const players = xi((i) => ({ playingStyle: STYLES[i % 4] }));
    const a = evaluateSquadUniqueness({ formationId: "4-4-2", perspective: { players, managerTactics: null } });
    const b = evaluateSquadUniqueness({ formationId: "4-4-2", perspective: { players: [...players].reverse(), managerTactics: null } });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.mostUnique).not.toBeNull();
    expect(a.mostCommon).not.toBeNull();
  });
});
