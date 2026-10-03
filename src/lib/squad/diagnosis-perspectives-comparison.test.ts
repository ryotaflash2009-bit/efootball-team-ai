import { describe, it, expect } from "vitest";
import { buildDiagnosisPerspectives, type PerspectivePlayer, type PerspectiveResult } from "./diagnosis-perspectives";

/**
 * F-045 の計算式の候補の比較（2026-10-03）。同じ事実（A）でも、暫定の点数化（B）がどこで差を出すか・出さないかを、
 * 合成のスカッドで確かめる。結果は docs/product/f045-candidate-comparison.md にまとめた（重み・総合式は本人の判断）。
 */
const stats = (atk: number, def: number, aer = 70, gk = 40) => ({
  offensiveAwareness: atk, finishing: atk, heading: aer, setPieceTaking: atk, curl: atk,
  defensiveAwareness: def, tackling: def, aggression: def, defensiveEngagement: def,
  jumping: aer, physicalContact: aer, gkAwareness: gk, gkCatching: gk, gkParrying: gk, gkReflexes: gk, gkReach: gk,
});
let n = 0;
const p = (o: Partial<PerspectivePlayer>): PerspectivePlayer => ({ key: `k${n++}`, name: `P${n}`, slot: "starter", position: "CMF", role: "MF", x: 50, playingStyle: null, compatibility: "exact", heightCm: 182, strongFoot: "right", stats: stats(70, 70), ...o });
const xi = (left: Partial<PerspectivePlayer>, right: Partial<PerspectivePlayer>, cf: Partial<PerspectivePlayer> = {}): PerspectivePlayer[] => [
  p({ position: "GK", role: "GK", stats: stats(30, 30, 50, 80) }),
  p({ position: "LB", role: "DF", x: 10, ...left }), p({ position: "CB", role: "DF", x: 40 }), p({ position: "CB", role: "DF", x: 60 }), p({ position: "RB", role: "DF", x: 90, ...right }),
  p({ position: "DMF", role: "MF" }), p({ position: "CMF", role: "MF", x: 35 }), p({ position: "CMF", role: "MF", x: 65 }),
  p({ position: "LWF", role: "FW", x: 12, ...left }), p({ position: "CF", role: "FW", ...cf }), p({ position: "RWF", role: "FW", x: 88, ...right }),
];
const f = (r: PerspectiveResult[], id: string, formula: string) => r.find((x) => x.id === id)!.formulas.find((y) => y.id === formula)!.value;

describe("F-045 計算式の候補の比較", () => {
  it("左右バランス: 人数（A）が同じでも、片側だけ能力が低いと B だけが差を出す", () => {
    const even = buildDiagnosisPerspectives({ players: xi({}, {}), managerTactics: null });
    const weakLeft = buildDiagnosisPerspectives({ players: xi({ stats: stats(50, 50) }, {}), managerTactics: null });
    expect(f(even, "sideBalance", "A")).toBe(0);
    expect(f(weakLeft, "sideBalance", "A")).toBe(0);
    expect(f(even, "sideBalance", "B")).toBe(0);
    expect(f(weakLeft, "sideBalance", "B")).toBe(18); // 左: 攻撃 (50×4+heading 70)/5=54・守備 50 → 52。右: 70。差 18
  });

  it("控えの厚み: ライン数（A）が同じでも、控えの質は B だけが区別する", () => {
    const bench = (v: number) => ["GK", "DF", "MF", "FW"].map((r) => p({ slot: "bench", role: r as PerspectivePlayer["role"], position: r === "GK" ? "GK" : r === "DF" ? "CB" : r === "MF" ? "CMF" : "CF", x: null, stats: stats(v, v) }));
    const strong = buildDiagnosisPerspectives({ players: [...xi({}, {}), ...bench(70)], managerTactics: null });
    const weak = buildDiagnosisPerspectives({ players: [...xi({}, {}), ...bench(55)], managerTactics: null });
    expect(f(strong, "squadDepth", "A")).toBe(4);
    expect(f(weak, "squadDepth", "A")).toBe(4);
    expect(f(strong, "squadDepth", "B")!).toBeGreaterThan(f(weak, "squadDepth", "B")!);
  });

  it("空中戦: CB・CF が弱いと、ポジションの重み付き（B）は単純平均（A）より厳しく出る", () => {
    const weakCf = buildDiagnosisPerspectives({ players: xi({}, {}, { stats: stats(70, 70, 50) }), managerTactics: null });
    expect(f(weakCf, "aerialFootPosition", "B")!).toBeLessThan(f(weakCf, "aerialFootPosition", "A")!);
  });

  it("身長の補正（B）は、全員の身長が分かるときだけ値を出し、A との差は身長の段階だけ", () => {
    const tall = buildDiagnosisPerspectives({ players: xi({ heightCm: 191 }, { heightCm: 191 }), managerTactics: null });
    expect(f(tall, "aerialHeight", "B")! - f(tall, "aerialHeight", "A")!).toBeCloseTo(1.8, 5); // 191cm ×4 → +3、182cm ×6 → +1 の平均 (12+6)/10
    const unknown = buildDiagnosisPerspectives({ players: xi({ heightCm: null }, {}), managerTactics: null });
    expect(f(unknown, "aerialHeight", "B")).toBeNull();
  });
});
