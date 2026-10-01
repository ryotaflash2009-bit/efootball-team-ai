import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDiagnosisPerspectives, lineRoleOfPosition, provisionalHeightBonus, statMean, toPerspectiveInput, PERSPECTIVES_RULES_VERSION, type PerspectivePlayer } from "./diagnosis-perspectives";

const stats = (v: number, gk = 40): Record<string, number> => ({
  offensiveAwareness: v, finishing: v, heading: v, setPieceTaking: v, curl: v,
  defensiveAwareness: v, tackling: v, aggression: v, defensiveEngagement: v,
  jumping: v, physicalContact: v,
  gkAwareness: gk, gkCatching: gk, gkParrying: gk, gkReflexes: gk, gkReach: gk,
});
let n = 0;
const p = (over: Partial<PerspectivePlayer>): PerspectivePlayer => ({
  key: `k${n++}`, name: `P${n}`, slot: "starter", position: "CMF", role: "MF", x: 50, playingStyle: "boxToBox",
  compatibility: "exact", heightCm: 180, strongFoot: "right", stats: stats(70), ...over,
});

const XI: PerspectivePlayer[] = [
  p({ position: "GK", role: "GK", x: 50, playingStyle: null, stats: stats(40, 80) }),
  p({ position: "LB", role: "DF", x: 10, playingStyle: "attackingFullBack" }),
  p({ position: "CB", role: "DF", x: 40, playingStyle: "buildUp", heightCm: 176 }),
  p({ position: "CB", role: "DF", x: 60, playingStyle: "buildUp", heightCm: 191 }),
  p({ position: "RB", role: "DF", x: 90, playingStyle: "defensiveFullBack" }),
  p({ position: "DMF", role: "MF", x: 50, playingStyle: "anchorMan" }),
  p({ position: "CMF", role: "MF", x: 35, playingStyle: "boxToBox" }),
  p({ position: "CMF", role: "MF", x: 65, playingStyle: "orchestrator", compatibility: "related" }),
  p({ position: "LWF", role: "FW", x: 12, playingStyle: "prolificWinger" }),
  p({ position: "CF", role: "FW", x: 50, playingStyle: "goalPoacher", compatibility: "unresolved" }),
  p({ position: "RWF", role: "FW", x: 88, playingStyle: "prolificWinger" }),
];
const BENCH = [p({ slot: "bench", position: "GK", role: "GK", x: null, playingStyle: null, stats: stats(40, 75) }), p({ slot: "bench", position: "CB", role: "DF", x: null, stats: stats(65) })];
const byId = (r: ReturnType<typeof buildDiagnosisPerspectives>, id: string) => r.find((x) => x.id === id)!;

describe("F-045 診断の追加観点（暫定 / 比較検証用）", () => {
  const r = buildDiagnosisPerspectives({ players: [...XI, ...BENCH], managerTactics: { possessionGame: 88, quickCounter: 70, longBallCounter: null } });

  it("8 観点を独立に返し、総合点を作らない。すべて暫定・比較検証用で規則の版を持つ", () => {
    expect(r.map((x) => x.id)).toEqual(["squadDepth", "sideBalance", "roleOverlap", "managerFit", "formationFit", "gkCategory", "aerialHeight", "aerialFootPosition"]);
    for (const x of r) {
      expect(x).toMatchObject({ status: "provisional", purpose: "comparison-only", rulesVersion: PERSPECTIVES_RULES_VERSION });
      expect(x.formulas.length).toBeGreaterThanOrEqual(2);
      expect(new Set(x.formulas.map((f) => f.id)).size).toBe(x.formulas.length);
    }
    expect(Object.keys(r[0])).not.toContain("total");
  });

  it("控えの厚み: 控えのいないラインを原因に挙げ、加えたときの変化を示す", () => {
    const d = byId(r, "squadDepth");
    expect(d.formulas[0]).toMatchObject({ id: "A", value: 2, kind: "fact" });
    expect(d.causes.map((c) => c.name)).toEqual(["MF", "FW"]);
    expect(d.improvements[0]).toContain("3/4");
    expect(d.formulas[1].value).toBe(-2.5);
  });

  it("左右バランス: 人数の差は事実、能力差は暫定", () => {
    const s = byId(r, "sideBalance");
    expect(s.facts[0]).toBe("左サイド 2 人・右サイド 2 人（中央 6 人）");
    expect(s.formulas[0]).toMatchObject({ value: 0, kind: "fact" });
    expect(s.formulas[1]).toMatchObject({ value: 0, kind: "provisional" });
    expect(s.causes).toEqual([]);
  });

  it("役割の重複: 先発と控えを分けて数え、basic は数えない", () => {
    const o = byId(r, "roleOverlap");
    expect(o.formulas[0].value).toBe(2); // buildUp, prolificWinger
    expect(o.formulas[1].value).toBe(3); // + boxToBox (bench)
    expect(o.causes).toHaveLength(4);
  });

  it("監督適合: 最も高い戦術の暫定の対応表で数え、公式の補正量は計算しない", () => {
    const m = byId(r, "managerFit");
    expect(m.facts[0]).toContain("possessionGame（88）");
    expect(m.formulas[0].value).toBe(3); // buildUp x2 + orchestrator
    expect(m.formulas[1].value).toBeNull();
    expect(m.missingData).toContain("戦術ごとの公式の補正量（未確認）");
    expect(m.confidence).toBe("low");
    const none = byId(buildDiagnosisPerspectives({ players: XI, managerTactics: null }), "managerFit");
    expect(none.confidence).toBe("insufficient");
    expect(none.formulas.every((f) => f.value === null)).toBe(true);
  });

  it("フォーメーション適合・GK・空中戦", () => {
    const f = byId(r, "formationFit");
    expect(f.formulas[0].value).toBe(9);
    expect(f.formulas[1].value).toBe(86.4);
    expect(f.causes.map((c) => c.position)).toEqual(["CF"]);
    const g = byId(r, "gkCategory");
    expect(g.formulas[0].value).toBe(80);
    expect(g.missingData[0]).toContain("F-071");
    const a = byId(r, "aerialHeight");
    expect(a.formulas[0].value).toBe(70);
    expect(a.formulas[1].value).toBe(71.1); // 70 + (180cm ×8 → +1 ×8、176cm → 0、191cm → +3) / 10 人
    expect(a.causes.map((c) => c.detail)).toEqual(["CB で身長 176cm"]);
    expect(a.confidence).toBe("low");
    const fp = byId(r, "aerialFootPosition");
    expect(fp.formulas.find((x) => x.id === "C")?.value).toBeNull();
    expect(fp.formulas[0].value).toBe(70);
  });

  it("データが無いときは推測で埋めない", () => {
    const empty = buildDiagnosisPerspectives({ players: XI.map((x) => ({ ...x, stats: null, heightCm: null, x: null, playingStyle: null })), managerTactics: null });
    expect(byId(empty, "sideBalance").confidence).toBe("insufficient");
    expect(byId(empty, "gkCategory").formulas[0].value).toBeNull();
    expect(byId(empty, "aerialHeight").formulas[1].value).toBeNull();
    expect(byId(empty, "squadDepth").confidence).toBe("insufficient");
    expect(provisionalHeightBonus(null)).toBeNull();
    expect(statMean(null, ["heading"])).toBeNull();
  });

  it("公式の点数・順位・パーセンタイル・公開統計の計算から参照されない", () => {
    const root = path.resolve(__dirname, "..", "..");
    for (const f of ["lib/squad/squad-diagnosis.ts", "lib/squad/squad-diagnosis-share.ts", "lib/squad/squad-diagnosis-card.ts"]) {
      expect(readFileSync(path.join(root, f), "utf8"), f).not.toContain("diagnosis-perspectives");
    }
  });
});

describe("toPerspectiveInput（既存の診断入力からの変換）", () => {
  it("先発は配置の x・正規化したプレースタイル、ベンチは登録ポジションのラインを使い、身長・利き足は null", () => {
    const st = [{ key: "s1", nameJa: "A", nameEn: null, registeredPosition: "CB", assignedPosition: "CB", role: "DF" as const, compatibilityStatus: "exact" as const, stats: [{ key: "heading", finalValue: 80 }] }];
    const bn = [{ key: "b1", nameJa: null, nameEn: "B", registeredPosition: "AMF", assignedPosition: null, role: null, compatibilityStatus: null, stats: null }];
    const input = toPerspectiveInput({ starters: st, bench: bn, placements: [{ slotId: "s1", x: 30, playingStyle: "Build Up", filled: true }], managerTactics: null });
    expect(input.players[0]).toMatchObject({ slot: "starter", x: 30, playingStyle: "buildUp", heightCm: null, strongFoot: null, stats: { heading: 80 } });
    expect(input.players[1]).toMatchObject({ slot: "bench", name: "B", role: "MF", position: "AMF", stats: null });
    expect(lineRoleOfPosition("SS")).toBe("FW");
    expect(lineRoleOfPosition("??")).toBeNull();
  });
});

describe("toPerspectiveInput（ベンチのプレースタイル）", () => {
  it("ベンチは subId ごとのプレースタイルを正規化して使う", () => {
    const bn = [{ key: "sub0", nameJa: "C", nameEn: null, registeredPosition: "CB", assignedPosition: null, role: null, compatibilityStatus: null, stats: null }];
    const input = toPerspectiveInput({ starters: [], bench: bn, placements: [], managerTactics: null, benchPlayingStyles: new Map([["sub0", "Build Up"]]) });
    expect(input.players[0].playingStyle).toBe("buildUp");
  });
});
