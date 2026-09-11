import { describe, it, expect } from "vitest";
import { evaluateSlotSuitability, isEligibleForSlot, suitabilityTierRank } from "./eligibility";

describe("evaluateSlotSuitability", () => {
  it("登録ポジションとスロットが一致すれば exact", () => {
    expect(evaluateSlotSuitability("CB", "CB").tier).toBe("exact");
  });

  it("同系統(DF)だが異なるポジションなら related", () => {
    expect(evaluateSlotSuitability("CB", "LB").tier).toBe("related");
  });

  it("役割が全く異なる(DF登録→FWスロット)場合は unresolved(除外はしない)", () => {
    expect(evaluateSlotSuitability("CB", "CF").tier).toBe("unresolved");
  });

  it("GK登録をフィールドスロットへ配置しようとすると excluded", () => {
    expect(evaluateSlotSuitability("GK", "CF").tier).toBe("excluded");
  });

  it("フィールド登録をGKスロットへ配置しようとすると excluded", () => {
    expect(evaluateSlotSuitability("CB", "GK").tier).toBe("excluded");
  });

  it("登録ポジションが不明でも excluded にはしない(未確認として unresolved)", () => {
    expect(evaluateSlotSuitability(null, "CF").tier).toBe("unresolved");
  });
});

describe("isEligibleForSlot", () => {
  it("excluded以外は適格", () => {
    expect(isEligibleForSlot("CB", "CB")).toBe(true);
    expect(isEligibleForSlot("CB", "LB")).toBe(true);
    expect(isEligibleForSlot(null, "CF")).toBe(true);
  });

  it("GK⇔フィールド不一致は不適格", () => {
    expect(isEligibleForSlot("GK", "CF")).toBe(false);
    expect(isEligibleForSlot("CF", "GK")).toBe(false);
  });
});

describe("suitabilityTierRank", () => {
  it("exact < related < unresolved < excluded の順で小さい", () => {
    expect(suitabilityTierRank("exact")).toBeLessThan(suitabilityTierRank("related"));
    expect(suitabilityTierRank("related")).toBeLessThan(suitabilityTierRank("unresolved"));
    expect(suitabilityTierRank("unresolved")).toBeLessThan(suitabilityTierRank("excluded"));
  });
});
