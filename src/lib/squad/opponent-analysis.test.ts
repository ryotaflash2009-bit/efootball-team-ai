import { describe, expect, it } from "vitest";
import { analyzeOpponent, type OpponentInput } from "./opponent-analysis";

const base: OpponentInput = { formationId: "4-3-3", keyPlayers: [], style: { possession: false, pressing: false, counter: false }, mine: { pace: 75, aerial: 70, defense: 72, pressResistance: 75 } };

describe("相手の分析（ローカル・規則）", () => {
  it("相手の FW が速いと裏への脅威・最終ラインを下げる提案", () => {
    const r = analyzeOpponent({ ...base, keyPlayers: [{ line: "FW", side: "right", pace: 95, aerial: 60, technique: 85 }] });
    expect(r.threats[0]).toMatchObject({ id: "pace_in_behind", level: 3 });
    expect(r.adjustments).toContain("deeper_defensive_line");
    expect(r.strongSide).toBe("right");
    expect(r.adjustments).toContain("protect_weak_side");
  });

  it("空中戦・中盤の技術・プレス・カウンターの判定", () => {
    const r = analyzeOpponent({ ...base, keyPlayers: [{ line: "FW", side: "center", pace: 60, aerial: 90, technique: 60 }, { line: "MF", side: "center", pace: 70, aerial: 60, technique: 85 }], style: { possession: true, pressing: true, counter: true }, mine: { ...base.mine, pressResistance: 60 } });
    expect(r.threats.map((t) => t.id).sort()).toEqual(["aerial_threat", "counter_risk", "pressing_threat", "technical_midfield"]);
    expect(r.adjustments).toEqual(["extra_holding_midfielder", "keep_rest_defense", "quick_release_passing", "tall_center_backs"]);
  });

  it("入力が無ければ脅威なし・決定的・主な選手は 5 人まで", () => {
    expect(analyzeOpponent(base)).toEqual({ version: expect.any(String), strongSide: null, weakSide: null, threats: [], adjustments: [] });
    const many = Array.from({ length: 8 }, (_, i) => ({ line: "FW" as const, side: "left" as const, pace: i < 5 ? 60 : 99, aerial: 60, technique: 60 }));
    expect(analyzeOpponent({ ...base, keyPlayers: many }).threats).toEqual([]);
    const input = { ...base, keyPlayers: [{ line: "FW" as const, side: "left" as const, pace: 90, aerial: 80, technique: 80 }] };
    expect(analyzeOpponent(input)).toEqual(analyzeOpponent(input));
  });
});
