import { describe, it, expect } from "vitest";
import { costForNextLevel, cumulativeCost, maxLevelForBudget } from "./point-cost";
import { COST_BLOCK_SIZE, COST_BLOCK_SIZE_V3 } from "./constants";
import { CURRENT_COST_RULE_ID, LEGACY_COST_RULE_ID, getRuleset, isCurrentCostRule, resolveCostRuleId } from "./progression-rules";
import { calculateBuild } from "./engine";
import { MESSI_BIGTIME } from "./fixtures";
import { savedBuildSchema } from "./build-storage";
import { EXPORTED_SAVED_BUILD_KEYS, buildExport } from "./build-export";
import { parseImportText, validateImportBuilds } from "./build-import";
import { adjustGroupLevel, summarizeGroupPoints } from "./group-allocation";
import { groupSliderModel, levelForKey, unreachableInfo, PAGE_STEP } from "./ability-direct-editor";

/**
 * 育成ポイントのコストの規則 v3（2026-10-08）: 1〜4 段階 1pt、5〜8 段階 2pt、9〜12 段階 3pt … 4 段階ごとに +1。
 * 既存のビルド（costRuleId なし）は旧規則（5 段階ごと）のまま計算し、黙って変えない。
 */
describe("コストの規則 v3（4 段階ごと）", () => {
  const cur = getRuleset(CURRENT_COST_RULE_ID);
  const old = getRuleset(LEGACY_COST_RULE_ID);

  it("段階の境界: 0→1 / 3→4 は 1pt、4→5 は 2pt、7→8 は 2pt、8→9 は 3pt", () => {
    expect(COST_BLOCK_SIZE_V3).toBe(4);
    expect([0, 1, 2, 3].map((l) => cur.costForNextLevel(l))).toEqual([1, 1, 1, 1]);
    expect([4, 5, 6, 7].map((l) => cur.costForNextLevel(l))).toEqual([2, 2, 2, 2]);
    expect([8, 11, 12].map((l) => cur.costForNextLevel(l))).toEqual([3, 3, 4]);
  });

  it("累積: Lv4 = 4pt・Lv8 = 12pt・Lv10 = 18pt（旧規則は Lv10 = 15pt）", () => {
    expect(cur.cumulativeCost(4)).toBe(4);
    expect(cur.cumulativeCost(8)).toBe(12);
    expect(cur.cumulativeCost(10)).toBe(18);
    expect(old.cumulativeCost(10)).toBe(15);
  });

  it("予算で届く最大レベル: 予算ちょうど・1pt 不足", () => {
    expect(cur.maxLevelForBudget(12)).toBe(8);
    expect(cur.maxLevelForBudget(11)).toBe(7);
    expect(cur.maxLevelForBudget(0)).toBe(0);
  });

  it("旧規則は今までと同じ（5 段階ごと）・既定の関数の値も変えない", () => {
    expect(COST_BLOCK_SIZE).toBe(5);
    expect([0, 4, 5, 9, 10].map((l) => old.costForNextLevel(l))).toEqual([1, 1, 2, 2, 3]);
    expect(costForNextLevel(4)).toBe(1);
    expect(cumulativeCost(10)).toBe(15);
    expect(maxLevelForBudget(15)).toBe(10);
  });

  it("保存された規則の ID: 無い・不明 → 旧規則、現行 → 現行", () => {
    expect(resolveCostRuleId(undefined)).toBe(LEGACY_COST_RULE_ID);
    expect(resolveCostRuleId("nope")).toBe(LEGACY_COST_RULE_ID);
    expect(resolveCostRuleId(CURRENT_COST_RULE_ID)).toBe(CURRENT_COST_RULE_ID);
    expect(isCurrentCostRule(null)).toBe(false);
    expect(isCurrentCostRule(CURRENT_COST_RULE_ID)).toBe(true);
  });
});

describe("計算: ポイントだけが規則で変わり、能力値は変わらない", () => {
  const allocation = { shooting: 10 };
  const legacy = calculateBuild({ card: MESSI_BIGTIME, allocation });
  const current = calculateBuild({ card: MESSI_BIGTIME, allocation, costRuleId: CURRENT_COST_RULE_ID });

  it("既定（costRuleId なし）は旧規則のまま（既存のビルドを黙って変えない）", () => {
    expect(legacy.costRuleId).toBe(LEGACY_COST_RULE_ID);
    expect(legacy.points.usedPoints).toBe(15);
  });
  it("現行の規則では同じ配分で 18pt", () => {
    expect(current.costRuleId).toBe(CURRENT_COST_RULE_ID);
    expect(current.points.usedPoints).toBe(18);
    expect(current.points.remainingPoints).toBe(legacy.points.remainingPoints - 3);
  });
  it("能力値・OVR は規則に依存しない", () => {
    expect(current.stats.map((s) => [s.key, s.finalValue])).toEqual(legacy.stats.map((s) => [s.key, s.finalValue]));
    expect(current.rating.estimatedOvr).toBe(legacy.rating.estimatedOvr);
  });
});

describe("保存の形（後方互換）", () => {
  const base = {
    buildId: "b_abcdefgh12345678",
    worldCardId: "88045755960770",
    buildName: "A",
    progressionAllocation: { shooting: 4 },
    selectedPlayerBooster: null,
    calculatedStats: { finishing: 90 },
    calculatedOvr: 90,
    calculationMode: "provisional",
    rulesVersion: "progression/2026-08-28.v2",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    schemaVersion: 1,
  };
  it("costRuleId の無い旧データはそのまま読める（移行不要）", () => {
    const r = savedBuildSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.costRuleId).toBeUndefined();
  });
  it("現行の規則は保持・不明な値は無し（旧規則）として読む", () => {
    const ok = savedBuildSchema.safeParse({ ...base, costRuleId: CURRENT_COST_RULE_ID });
    expect(ok.success && ok.data.costRuleId).toBe(CURRENT_COST_RULE_ID);
    const bad = savedBuildSchema.safeParse({ ...base, costRuleId: "evil" });
    expect(bad.success).toBe(true);
    expect(bad.success && bad.data.costRuleId).toBeUndefined();
  });
  it("書き出しのキーに含まれる（書き出し → 読み込みで規則が失われない）", () => {
    expect(EXPORTED_SAVED_BUILD_KEYS).toContain("costRuleId");
  });
});

describe("能力値スライダー: Page Up / Down と届かない範囲", () => {
  const card = { ...MESSI_BIGTIME, maximumLevel: 3 }; // ポイント総数 4
  const model = groupSliderModel({}, card, "shooting", CURRENT_COST_RULE_ID);

  it("Page Up は 4 段階・到達可能上限で止まる／Page Down は 0 で止まる", () => {
    expect(PAGE_STEP).toBe(4);
    expect(levelForKey("PageUp", model)).toBe(Math.min(4, model.reachableMax));
    expect(levelForKey("PageDown", model)).toBe(0);
  });
  it("ポイントで制限されると、上限まで足りないポイントを返す（負数にしない）", () => {
    expect(model.reachableMax).toBe(4);
    expect(model.limitedByPoints).toBe(true);
    const info = unreachableInfo(model, CURRENT_COST_RULE_ID);
    expect(info.limitedByPoints).toBe(true);
    expect(info.shortfall).toBe(getRuleset(CURRENT_COST_RULE_ID).cumulativeCost(model.absoluteMax) - 4);
    const full = groupSliderModel({}, { ...MESSI_BIGTIME, maximumLevel: 60 }, "shooting", CURRENT_COST_RULE_ID);
    expect(unreachableInfo(full, CURRENT_COST_RULE_ID)).toEqual({ limitedByPoints: false, shortfall: 0 });
  });
});

describe("境界の fixture（追加・2026-10-09）", () => {
  const cur = CURRENT_COST_RULE_ID;

  it("最大レベル: カテゴリの上限で止まる（それ以上は上げない）", () => {
    const card = { ...MESSI_BIGTIME, maximumLevel: 60 };
    const m = groupSliderModel({}, card, "shooting", cur);
    const atMax = adjustGroupLevel({}, card, "shooting", m.absoluteMax + 10, cur);
    expect(atMax.shooting).toBe(m.absoluteMax);
    expect(groupSliderModel(atMax, card, "shooting", cur).atCategoryMax).toBe(true);
    expect(groupSliderModel(atMax, card, "shooting", cur).nextCost).toBeNull();
  });

  it("ポイント不足: 残りポイントで届く最大で止まり、残りは負にならない", () => {
    const card = { ...MESSI_BIGTIME, maximumLevel: 4 }; // 6pt
    const r = adjustGroupLevel({}, card, "shooting", 50, cur);
    // 6pt では 1+1+1+1（Lv4）+ 2（Lv5）= 6 → Lv5
    expect(r.shooting).toBe(5);
    expect(summarizeGroupPoints(r, card, cur).remainingPoints).toBe(0);
    const legacy = adjustGroupLevel({}, card, "shooting", 50, LEGACY_COST_RULE_ID);
    expect(legacy.shooting).toBe(5); // 旧規則でも 1×5 = 5pt → Lv5（残り 1pt では Lv6 の 2pt に届かない）
  });

  it("書き出し → 読み込みでコストの規則が失われない（現行の規則・旧規則のビルドの両方）", () => {
    const now = "2026-10-09T00:00:00.000Z";
    const mk = (id: string, costRuleId?: string) => ({
      buildId: id, worldCardId: "88045755960770", buildName: id, progressionAllocation: { shooting: 6 }, selectedPlayerBooster: null,
      calculatedStats: {}, calculatedOvr: null, calculationMode: "provisional", rulesVersion: "progression/2026-08-28.v2",
      createdAt: now, updatedAt: now, schemaVersion: 1, ...(costRuleId ? { costRuleId } : {}),
    });
    const exp = buildExport({ rawBuilds: [mk("cur", cur), mk("legacy")], exportedAt: now });
    if (!exp.ok) throw new Error(exp.reason);
    const parsed = parseImportText(exp.json);
    if (!parsed.ok) throw new Error(parsed.code);
    const { valid, invalid } = validateImportBuilds(parsed.rawBuilds);
    expect(invalid).toEqual([]);
    expect(valid.find((b) => b.buildId === "cur")?.costRuleId).toBe(cur);
    expect(valid.find((b) => b.buildId === "legacy")?.costRuleId).toBeUndefined();
  });
});

describe("自動配分は使うコストの規則の範囲に収まる（2026-10-09 の不具合の回帰）", () => {
  it("現行の規則で、総ポイントを超えない（以前は版の文字列で旧規則の残りを数えていた）", async () => {
    const { autoAllocate } = await import("./auto-allocate");
    const { usedPoints } = await import("./group-allocation");
    const { CURRENT_COST_RULE_ID, LEGACY_COST_RULE_ID } = await import("./progression-rules");
    const { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK } = await import("./fixtures");
    for (const card of [{ ...MESSI_BIGTIME, maximumLevel: 34 }, CANNAVARO_EPIC, NEUER_GK]) {
      for (const profile of ["attack", "defense", "balance", "gk"] as const) {
        for (const rule of [CURRENT_COST_RULE_ID, LEGACY_COST_RULE_ID]) {
          const r = autoAllocate(card, profile, rule);
          expect(usedPoints(r.allocation, rule)).toBeLessThanOrEqual(r.totalPoints);
          expect(r.usedPoints).toBe(usedPoints(r.allocation, rule));
          expect(r.remainingPoints).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
