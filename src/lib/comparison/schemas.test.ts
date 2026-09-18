import { describe, it, expect } from "vitest";
import { parseComparisonState, serializeComparisonState, comparisonHref } from "./schemas";
import type { ComparisonState } from "./types";

describe("parseComparisonState", () => {
  it("ids を最大4・重複除去・不正IDを除外", () => {
    const s = parseComparisonState({ ids: "89138556575063,89138556575063,abc,88041460996837,1,2,3" });
    expect(s.ids).toEqual(["89138556575063", "88041460996837", "1", "2"]);
  });
  it("空・null は空配列", () => {
    expect(parseComparisonState({}).ids).toEqual([]);
    expect(parseComparisonState({ ids: null }).ids).toEqual([]);
  });
  it("b（育成方針）を ids と同順で解釈・不正は none", () => {
    const s = parseComparisonState({ ids: "1,2,3", b: "attack,zzz,gk" });
    expect(s.buildModes).toEqual(["attack", "none", "gk"]);
  });
  it("m（監督ID）を正整数のみ・それ以外 null", () => {
    const s = parseComparisonState({ ids: "1,2,3", m: "42,,abc" });
    expect(s.managerIds).toEqual([42, null, null]);
  });
  it("buildModes/managerIds は ids 長に揃う", () => {
    const s = parseComparisonState({ ids: "1,2", b: "attack", m: "42" });
    expect(s.buildModes).toHaveLength(2);
    expect(s.managerIds).toHaveLength(2);
    expect(s.buildModes[1]).toBe("none");
    expect(s.managerIds[1]).toBeNull();
  });
  it("tp（Total Package 段階）を ids と同順で解釈・不正は none", () => {
    const s = parseComparisonState({ ids: "1,2,3,4", tp: "1,3,9,x" });
    expect(s.conditionalTiers).toEqual(["league_1_13", "league_20_plus", "none", "none"]);
  });
  it("tp 未指定は全 none・ids 長に揃う", () => {
    const s = parseComparisonState({ ids: "1,2" });
    expect(s.conditionalTiers).toEqual(["none", "none"]);
  });
  it("tp に 4 以上・負数・小数を渡しても none（大きな上昇値を作らない）", () => {
    const s = parseComparisonState({ ids: "1,2,3", tp: "4,-1,2.5" });
    expect(s.conditionalTiers).toEqual(["none", "none", "none"]);
  });
  it("al（手動育成配分）を ids と同順で解釈・空区分は null", () => {
    const s = parseComparisonState({ ids: "1,2,3", al: "shooting~5.passing~3__defending~2" });
    expect(s.allocations).toEqual([{ shooting: 5, passing: 3 }, null, { defending: 2 }]);
  });
  it("al の未知 groupId / 非整数 / 範囲外は無視", () => {
    const s = parseComparisonState({ ids: "1", al: "nope~5.shooting~2.passing~-1.dribbling~x.dexterity~999" });
    expect(s.allocations).toEqual([{ shooting: 2 }]);
  });
  it("al 未指定は全 null・ids 長に揃う", () => {
    const s = parseComparisonState({ ids: "1,2" });
    expect(s.allocations).toEqual([null, null]);
  });
});

describe("serializeComparisonState / comparisonHref", () => {
  it("ids のみ", () => {
    expect(serializeComparisonState({ ids: ["1", "2"], buildModes: ["none", "none"], managerIds: [null, null] })).toBe("ids=1%2C2");
  });
  it("b/m はデフォルトなら省略", () => {
    const q = serializeComparisonState({ ids: ["1", "2"], buildModes: ["attack", "none"], managerIds: [null, 42] });
    expect(q).toContain("ids=1%2C2");
    expect(q).toContain("b=attack%2C");
    expect(q).toContain("m=%2C42");
  });
  it("空状態は空文字 → /compare", () => {
    expect(comparisonHref({ ids: [], buildModes: [], managerIds: [] })).toBe("/compare");
  });
  it("tp はデフォルト（全 none）なら省略", () => {
    const q = serializeComparisonState({ ids: ["1", "2"], buildModes: ["none", "none"], managerIds: [null, null], conditionalTiers: ["none", "none"] });
    expect(q).toBe("ids=1%2C2");
  });
  it("tp を含む round-trip（数字エンコード・自動判定ではない）", () => {
    const state: ComparisonState = {
      ids: ["89138556575063", "88041460996837"],
      buildModes: ["attack", "gk"],
      managerIds: [42, null],
      conditionalTiers: ["league_20_plus", "none"],
    };
    const q = serializeComparisonState(state);
    expect(q).toContain("tp=3%2C");
    const parsed = parseComparisonState(Object.fromEntries(new URLSearchParams(q)));
    expect(parsed.conditionalTiers).toEqual(["league_20_plus", "none"]);
  });
  it("round-trip", () => {
    const state: ComparisonState = {
      ids: ["89138556575063", "88041460996837"],
      buildModes: ["attack", "gk"],
      managerIds: [42, null],
    };
    const parsed = parseComparisonState(Object.fromEntries(new URLSearchParams(serializeComparisonState(state))));
    expect(parsed.ids).toEqual(state.ids);
    expect(parsed.buildModes).toEqual(["attack", "gk"]);
    expect(parsed.managerIds).toEqual([42, null]);
  });
  it("al を含む round-trip（手動配分・空区分保持）", () => {
    const state: ComparisonState = {
      ids: ["1", "2", "3"],
      buildModes: ["none", "none", "none"],
      managerIds: [null, null, null],
      allocations: [{ shooting: 5, dribbling: 2 }, null, { defending: 3 }],
    };
    const q = serializeComparisonState(state);
    expect(q).toContain("al=");
    const parsed = parseComparisonState(Object.fromEntries(new URLSearchParams(q)));
    expect(parsed.allocations).toEqual([{ dribbling: 2, shooting: 5 }, null, { defending: 3 }]);
  });
  it("al は全 null なら省略", () => {
    const q = serializeComparisonState({ ids: ["1", "2"], buildModes: ["none", "none"], managerIds: [null, null], allocations: [null, null] });
    expect(q).toBe("ids=1%2C2");
  });

  it("URL共有の入力安全性: HTML/scriptらしき文字列がidsに混じっても、数字IDの正規表現外として除外される(XSS反射なし)", () => {
    const s = parseComparisonState({ ids: "1,<script>alert(1)</script>,2,javascript:alert(1)" });
    expect(s.ids).toEqual(["1", "2"]);
  });

  it("URL共有の入力安全性: 極端に長いidsパラメータを渡しても例外を投げず、最大件数(COMPARISON_MAX)に切り詰める", () => {
    const huge = Array.from({ length: 10000 }, (_, i) => String(i + 1)).join(",");
    expect(() => parseComparisonState({ ids: huge })).not.toThrow();
    const s = parseComparisonState({ ids: huge });
    expect(s.ids.length).toBeLessThanOrEqual(4);
  });

  it("URL共有の入力安全性: b/m/tpに不正な形式の値を渡してもnone/nullへフォールバックする", () => {
    const s = parseComparisonState({
      ids: "1,2",
      b: "<img src=x onerror=alert(1)>,attack",
      m: "not-a-number,-5",
      tp: "999,-1",
    });
    expect(s.buildModes).toEqual(["none", "attack"]);
    expect(s.managerIds).toEqual([null, null]);
    expect(s.conditionalTiers).toEqual(["none", "none"]);
  });
});
