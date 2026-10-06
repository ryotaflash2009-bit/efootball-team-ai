import { describe, expect, it } from "vitest";
import { buildDiagnosisPerspectives, PERSPECTIVES_RULES_VERSION, type PerspectivePlayer, type PerspectiveResult } from "./diagnosis-perspectives";

/**
 * F-045 の正式な採用の判断の材料（2026-10-07）: 端のケース・極端なスカッド・決定性・データ不足の扱い。
 * 採用前の暫定の観点は、総合点・順位・パーセンタイル・称号・共有カードへ混ぜない（別のテストで確認済み）。
 */
const stats = (v: number, gk = 40) => ({
  offensiveAwareness: v, finishing: v, heading: v, setPieceTaking: v, curl: v,
  defensiveAwareness: v, tackling: v, aggression: v, defensiveEngagement: v,
  jumping: v, physicalContact: v, gkAwareness: gk, gkCatching: gk, gkParrying: gk, gkReflexes: gk, gkReach: gk,
});
let n = 0;
const p = (o: Partial<PerspectivePlayer>): PerspectivePlayer => ({ key: `k${n++}`, name: `P${n}`, slot: "starter", position: "CMF", role: "MF", x: 50, playingStyle: null, compatibility: "exact", heightCm: 180, strongFoot: "right", stats: stats(70), ...o });
const XI = (): PerspectivePlayer[] => [
  p({ position: "GK", role: "GK", stats: stats(30, 80) }),
  p({ position: "LB", role: "DF", x: 10 }), p({ position: "CB", role: "DF", x: 40 }), p({ position: "CB", role: "DF", x: 60 }), p({ position: "RB", role: "DF", x: 90 }),
  p({ position: "DMF", role: "MF" }), p({ position: "CMF", role: "MF", x: 35 }), p({ position: "CMF", role: "MF", x: 65 }),
  p({ position: "LWF", role: "FW", x: 12 }), p({ position: "CF", role: "FW" }), p({ position: "RWF", role: "FW", x: 88 }),
];
const byId = (r: PerspectiveResult[]) => Object.fromEntries(r.map((x) => [x.id, x]));
const finite = (v: number | null) => v === null || Number.isFinite(v);

describe("F-045 端のケース・極端なスカッド", () => {
  it("空のスカッド: 例外なし・8 観点すべて・値は null か有限・信頼度は低い", () => {
    const r = buildDiagnosisPerspectives({ players: [], managerTactics: null });
    expect(r).toHaveLength(8);
    for (const x of r) {
      expect(x.status).toBe("provisional");
      expect(x.purpose).toBe("comparison-only");
      expect(x.rulesVersion).toBe(PERSPECTIVES_RULES_VERSION);
      for (const f of x.formulas) expect(finite(f.value), `${x.id}.${f.id}`).toBe(true);
    }
  });

  it("カードの能力が全員不明（未解決）: 能力を使う式は null・事実の式は数えられる", () => {
    const r = byId(buildDiagnosisPerspectives({ players: XI().map((x) => ({ ...x, stats: null })), managerTactics: null }));
    expect(r.gkCategory.formulas.find((f) => f.id === "A")!.value).toBeNull();
    expect(r.aerialHeight.formulas.find((f) => f.id === "A")!.value).toBeNull();
    expect(r.formationFit.formulas.find((f) => f.id === "A")!.value).toBe(11);
  });

  it("GK がいない: GK の観点はデータ不足（null）で、他の観点は計算する", () => {
    const r = byId(buildDiagnosisPerspectives({ players: XI().slice(1), managerTactics: null }));
    expect(r.gkCategory.formulas.find((f) => f.id === "A")!.value).toBeNull();
    expect(r.gkCategory.missingData.length + (r.gkCategory.confidence === "insufficient" ? 1 : 0)).toBeGreaterThan(0);
    expect(r.sideBalance.formulas.find((f) => f.id === "A")!.value).toBe(0);
  });

  it("全員が同じプレースタイル: 重複は 1 種類（数え方が爆発しない）", () => {
    const r = byId(buildDiagnosisPerspectives({ players: XI().map((x) => ({ ...x, playingStyle: "goalPoacher" })), managerTactics: null }));
    expect(r.roleOverlap.formulas.find((f) => f.id === "A")!.value).toBe(1);
  });

  it("能力が極端（0 と 99）でも範囲の外の値・NaN を出さない", () => {
    for (const v of [0, 40, 99]) {
      const r = buildDiagnosisPerspectives({ players: XI().map((x) => ({ ...x, stats: stats(v, v) })), managerTactics: { possessionGame: 99, quickCounter: 0 } });
      for (const x of r) for (const f of x.formulas) expect(finite(f.value), `${v} ${x.id}.${f.id}`).toBe(true);
    }
  });

  it("全員が適性外: 本職の人数 0・重み付きは 0", () => {
    const r = byId(buildDiagnosisPerspectives({ players: XI().map((x) => ({ ...x, compatibility: "unresolved" as const })), managerTactics: null }));
    expect(r.formationFit.formulas.find((f) => f.id === "A")!.value).toBe(0);
  });

  it("身長が一部だけ不明: 身長の補正（B）は計算しない（全員分かるときだけ）", () => {
    const players = XI();
    players[3] = { ...players[3], heightCm: null };
    const r = byId(buildDiagnosisPerspectives({ players, managerTactics: null }));
    expect(r.aerialHeight.formulas.find((f) => f.id === "B")!.value).toBeNull();
  });
});

describe("F-045 決定性", () => {
  it("同じ入力は同じ結果（2 回の計算が完全に一致）", () => {
    const players = XI();
    const a = buildDiagnosisPerspectives({ players, managerTactics: { possessionGame: 80 } });
    const b = buildDiagnosisPerspectives({ players, managerTactics: { possessionGame: 80 } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("選手の並び順に依存しない（数値の式）", () => {
    const players = XI();
    const a = buildDiagnosisPerspectives({ players, managerTactics: null });
    const b = buildDiagnosisPerspectives({ players: [...players].reverse(), managerTactics: null });
    const values = (r: PerspectiveResult[]) => r.map((x) => x.formulas.map((f) => f.value));
    expect(values(b)).toEqual(values(a));
  });

  it("入力を書き換えない", () => {
    const players = XI();
    const before = JSON.stringify(players);
    buildDiagnosisPerspectives({ players, managerTactics: { possessionGame: 70 } });
    expect(JSON.stringify(players)).toBe(before);
  });
});
