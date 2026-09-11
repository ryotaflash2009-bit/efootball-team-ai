import { describe, it, expect } from "vitest";
import {
  CONDITIONAL_BOOSTER_RULES_VERSION,
  TOTAL_PACKAGE_TIERS,
  calculateConditionalBoosterDeltas,
  describeConditionalSelection,
  isManualConditionalBooster,
  levelForConditionalSelection,
  levelForRegisteredPlayers,
  parseTotalPackageSelection,
  tierForSelection,
  validateConditionalBoosterSelection,
} from "./conditional-boosters";
import { getBoosterDef } from "./booster-catalog";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";

describe("conditional-boosters: 段階とレベル", () => {
  it("rulesVersion は conditional-booster/2026-08-28.v2（未来日付なし）", () => {
    expect(CONDITIONAL_BOOSTER_RULES_VERSION).toBe("conditional-booster/2026-08-28.v2");
  });
  it("TOTAL_PACKAGE_TIERS: none→0 / league_1_13→1 / league_14_19→2 / league_20_plus→3", () => {
    expect(TOTAL_PACKAGE_TIERS.map((t) => [t.selection, t.level])).toEqual([
      ["none", 0],
      ["league_1_13", 1],
      ["league_14_19", 2],
      ["league_20_plus", 3],
    ]);
  });
  it("levelForConditionalSelection", () => {
    expect(levelForConditionalSelection("none")).toBe(0);
    expect(levelForConditionalSelection("league_1_13")).toBe(1);
    expect(levelForConditionalSelection("league_14_19")).toBe(2);
    expect(levelForConditionalSelection("league_20_plus")).toBe(3);
  });
});

describe("parseTotalPackageSelection: 入力検証（不正は none）", () => {
  it("正しい列挙値はそのまま", () => {
    for (const s of ["none", "league_1_13", "league_14_19", "league_20_plus"] as const) {
      expect(parseTotalPackageSelection(s)).toBe(s);
    }
  });
  it("数値 0..3 は対応する段階へ", () => {
    expect(parseTotalPackageSelection(0)).toBe("none");
    expect(parseTotalPackageSelection(1)).toBe("league_1_13");
    expect(parseTotalPackageSelection(2)).toBe("league_14_19");
    expect(parseTotalPackageSelection(3)).toBe("league_20_plus");
  });
  it("不正値は none", () => {
    for (const bad of ["", "league_99", "garbage", -1, 4, 1.5, NaN, Infinity, -Infinity, null, undefined, {}, [], true, "3人"]) {
      expect(parseTotalPackageSelection(bad as unknown)).toBe("none");
    }
  });
});

describe("levelForRegisteredPlayers（将来の Game Plan 自動対応用・純関数）", () => {
  it("0人→0 / 1〜13→1 / 14〜19→2 / 20以上→3", () => {
    expect(levelForRegisteredPlayers(0)).toBe(0);
    expect(levelForRegisteredPlayers(1)).toBe(1);
    expect(levelForRegisteredPlayers(13)).toBe(1);
    expect(levelForRegisteredPlayers(14)).toBe(2);
    expect(levelForRegisteredPlayers(19)).toBe(2);
    expect(levelForRegisteredPlayers(20)).toBe(3);
    expect(levelForRegisteredPlayers(50)).toBe(3);
  });
  it("不正入力（負数・小数・NaN・Infinity・文字列・巨大数）は 0 または境界内", () => {
    for (const bad of [-1, -100, 1.5, 13.9, NaN, Infinity, -Infinity, "10", null, undefined, {}]) {
      expect(levelForRegisteredPlayers(bad as unknown)).toBe(0);
    }
    expect(levelForRegisteredPlayers(1e9)).toBe(3); // 巨大でも整数正なら 3 止まり
  });
});

describe("isManualConditionalBooster", () => {
  it("total-package は手動条件対象", () => {
    expect(isManualConditionalBooster("total-package")).toBe(true);
  });
  it("通常ブースター・不正キーは対象外", () => {
    expect(isManualConditionalBooster("shooting")).toBe(false);
    expect(isManualConditionalBooster("single-speed")).toBe(false);
    expect(isManualConditionalBooster("nope")).toBe(false);
    expect(isManualConditionalBooster(null)).toBe(false);
    expect(isManualConditionalBooster(undefined)).toBe(false);
  });
});

describe("validateConditionalBoosterSelection", () => {
  it("有効なカタログキー + 有効な段階のみ残す（none/不正キーは捨てる）", () => {
    const out = validateConditionalBoosterSelection([
      { boosterKey: "total-package", selection: "league_14_19" },
      { boosterKey: "total-package", selection: "none" },
      { boosterKey: "ball-protection", selection: "league_20_plus" }, // v2: 名称付きも許可（per-card 判定は解決層）
      { boosterKey: "nope!!", selection: "league_20_plus" }, // 不正キー → 捨てる
      { boosterKey: "total-package", selection: "garbage" }, // garbage → none → 捨てる
      "not-an-object",
      null,
    ]);
    expect(out).toEqual([{ boosterKey: "ball-protection", selection: "league_20_plus" }]);
  });
  it("最後の有効な段階を採用", () => {
    const out = validateConditionalBoosterSelection([
      { boosterKey: "total-package", selection: "league_1_13" },
      { boosterKey: "total-package", selection: "league_20_plus" },
    ]);
    expect(out).toEqual([{ boosterKey: "total-package", selection: "league_20_plus" }]);
  });
  it("配列でない入力は空", () => {
    expect(validateConditionalBoosterSelection(null)).toEqual([]);
    expect(validateConditionalBoosterSelection("x")).toEqual([]);
    expect(validateConditionalBoosterSelection({})).toEqual([]);
  });
});

describe("calculateConditionalBoosterDeltas", () => {
  const tp = getBoosterDef("total-package")!;
  it("段階 → 全26能力へ +段階値", () => {
    for (const [sel, lvl] of [
      ["league_1_13", 1],
      ["league_14_19", 2],
      ["league_20_plus", 3],
    ] as const) {
      const d = calculateConditionalBoosterDeltas("total-package", sel);
      expect(Object.keys(d)).toHaveLength(26);
      for (const k of tp.affectedStats) expect(d[k]).toBe(lvl);
      for (const k of Object.keys(d)) expect(WORLD_STAT_KEYS).toContain(k);
    }
  });
  it("none / 不正段階は空", () => {
    expect(calculateConditionalBoosterDeltas("total-package", "none")).toEqual({});
    expect(calculateConditionalBoosterDeltas("total-package", "garbage")).toEqual({});
    expect(calculateConditionalBoosterDeltas("total-package", 4)).toEqual({});
    expect(calculateConditionalBoosterDeltas("total-package", -1)).toEqual({});
  });
  it("v2: 任意の効果名の対象能力へ +段階値（4能力型・許可値 0〜3 以外は生成しない）", () => {
    const bp = getBoosterDef("ball-protection")!; // ballControl / tightPossession / balance / physicalContact
    const d = calculateConditionalBoosterDeltas("ball-protection", "league_14_19");
    expect(Object.keys(d).sort()).toEqual([...bp.affectedStats].sort());
    for (const k of bp.affectedStats) expect(d[k]).toBe(2);
    // 全26能力へは広げない
    expect(d.speed).toBeUndefined();
    expect(d.finishing).toBeUndefined();
  });
  it("無効な def / none / 不正段階は空", () => {
    expect(calculateConditionalBoosterDeltas(null, "league_20_plus")).toEqual({});
    expect(calculateConditionalBoosterDeltas("nope", "league_20_plus")).toEqual({});
    expect(calculateConditionalBoosterDeltas("ball-protection", "garbage")).toEqual({});
    expect(calculateConditionalBoosterDeltas("ball-protection", 4)).toEqual({});
    expect(calculateConditionalBoosterDeltas(tp, "league_20_plus").speed).toBe(3);
  });
});

describe("describeConditionalSelection / tierForSelection", () => {
  it("選択後の説明文", () => {
    expect(describeConditionalSelection("league_14_19")).toContain("ユーザー指定条件");
    expect(describeConditionalSelection("league_14_19")).toContain("14〜19");
    expect(describeConditionalSelection("none")).toBe("");
    expect(describeConditionalSelection("garbage")).toBe("");
  });
  it("tierForSelection は不正でも none の tier", () => {
    expect(tierForSelection("garbage").selection).toBe("none");
    expect(tierForSelection("league_20_plus").level).toBe(3);
  });
});
