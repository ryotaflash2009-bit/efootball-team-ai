import { describe, it, expect } from "vitest";
import { RULE_REGISTRY } from "./rule-registry";
import { RULE_TEXT_EN, UNSUPPORTED_RULES_EN, ruleText } from "./rule-registry-en";

const JA = /[぀-ヿ一-龯＀-￯]/;

describe("rule-registry-en", () => {
  it("has a non-empty English entry without Japanese for every RULE_REGISTRY ruleId", () => {
    for (const r of RULE_REGISTRY) {
      const en = RULE_TEXT_EN[r.ruleId];
      expect(en, r.ruleId).toBeDefined();
      expect(en.ruleName.trim(), r.ruleId).not.toBe("");
      expect(en.description.trim(), r.ruleId).not.toBe("");
      expect(JA.test(en.ruleName), r.ruleId).toBe(false);
      expect(JA.test(en.description), r.ruleId).toBe(false);
    }
  });

  it("has no stale English entries", () => {
    const ids = new Set(RULE_REGISTRY.map((r) => r.ruleId));
    for (const id of Object.keys(RULE_TEXT_EN)) expect(ids.has(id), id).toBe(true);
  });

  it("ruleText returns the Japanese fields for ja and the English overlay for en", () => {
    for (const r of RULE_REGISTRY) {
      expect(ruleText(r, "ja")).toEqual({ ruleName: r.ruleName, description: r.description });
      expect(ruleText(r, "en")).toEqual(RULE_TEXT_EN[r.ruleId]);
    }
  });

  it("unsupported-rule translations contain no Japanese", () => {
    for (const v of Object.values(UNSUPPORTED_RULES_EN)) expect(JA.test(v), v).toBe(false);
  });
});
