import { describe, expect, it } from "vitest";
import { calculateBuild } from "./engine";
import { CURRENT_COST_RULE_ID } from "./progression-rules";
import { cumulativeCost } from "./point-cost";
import { COST_BLOCK_SIZE_V3 } from "./constants";
import { adjustGroupLevel, maxUsefulLevelForGroup, normalizeGroupAllocation } from "./group-allocation";
import { groupSliderModel } from "./ability-direct-editor";
import { savedBuildSchema } from "./build-storage";
import { buildExport } from "./build-export";
import { parseImportText, validateImportBuilds } from "./build-import";
import { parseAllocations, serializeAllocations } from "@/lib/comparison/allocation-url";
import { MESSI_BIGTIME } from "./fixtures";

/**
 * 本人のゲームの画面の確認（2026-10-10）: 育成カテゴリのレベルに一律の上限 25 は無い。
 * 最大レベルと使えるポイントが足りる選手なら 26 以上にできる。計算・入力・保存・書き出し/読み込み・共有の URL のどこにも 25 の上限が無いことを確かめる。
 */
const card = { ...MESSI_BIGTIME, maximumLevel: 77, baseStats: { ...MESSI_BIGTIME.baseStats, finishing: 50, setPieceTaking: 50, curl: 50 } };
const LV = 30;

describe("育成カテゴリのレベル 26 以上（一律の上限 25 は無い）", () => {
  it("ポイントが足りる選手は 30 まで上げられる（計算・スライダー・+1 の操作）", () => {
    expect(cumulativeCost(LV, COST_BLOCK_SIZE_V3)).toBeLessThanOrEqual((card.maximumLevel - 1) * 2);
    expect(maxUsefulLevelForGroup(card, "shooting")).toBeGreaterThanOrEqual(LV);
    const alloc = adjustGroupLevel({}, card, "shooting", LV, CURRENT_COST_RULE_ID);
    expect(alloc.shooting).toBe(LV);
    const r = calculateBuild({ card, allocation: alloc, costRuleId: CURRENT_COST_RULE_ID });
    expect(r.points.overAllocated).toBe(false);
    expect(r.stats.find((s) => s.key === "finishing")!.progressionDelta).toBe(LV);
    expect(groupSliderModel(alloc, card, "shooting", CURRENT_COST_RULE_ID).absoluteMax).toBeGreaterThan(25);
    expect(normalizeGroupAllocation({ shooting: LV }, card).allocation.shooting).toBe(LV);
  });
  it("保存・書き出し → 読み込み・共有の URL で 30 が保たれる", () => {
    const now = "2026-10-10T00:00:00.000Z";
    const b = { buildId: "lv30", worldCardId: card.worldCardId, buildName: "lv30", progressionAllocation: { shooting: LV }, selectedPlayerBooster: null, calculatedStats: {}, calculatedOvr: null, calculationMode: "provisional", rulesVersion: "progression/2026-08-28.v2", costRuleId: CURRENT_COST_RULE_ID, createdAt: now, updatedAt: now, schemaVersion: 1 };
    const s = savedBuildSchema.safeParse(b);
    expect(s.success && s.data.progressionAllocation.shooting).toBe(LV);
    const exp = buildExport({ rawBuilds: [b], exportedAt: now });
    if (!exp.ok) throw new Error(exp.reason);
    const parsed = parseImportText(exp.json);
    if (!parsed.ok) throw new Error(parsed.code);
    expect(validateImportBuilds(parsed.rawBuilds).valid[0].progressionAllocation.shooting).toBe(LV);
    expect(parseAllocations(serializeAllocations([{ shooting: LV }]), 1)[0]).toEqual({ shooting: LV });
  });
  it("ポイントが足りない選手は、ポイントで止まる（上限 25 で止めるのではない）", () => {
    const small = { ...card, maximumLevel: 34 }; // 66pt → 現行の規則で 1 カテゴリは最大 23
    const alloc = adjustGroupLevel({}, small, "shooting", LV, CURRENT_COST_RULE_ID);
    expect(cumulativeCost(alloc.shooting, COST_BLOCK_SIZE_V3)).toBeLessThanOrEqual(66);
    expect(cumulativeCost(alloc.shooting + 1, COST_BLOCK_SIZE_V3)).toBeGreaterThan(66);
  });
});
