import type { Locale } from "@/lib/i18n/locale";
import type { RuleRecord } from "./rule-registry";

/**
 * RULE_REGISTRY の表示用英語訳（ruleName / description のみ）。キーは ruleId。
 * rule-registry.ts 本体（日本語の証拠台帳）は変更しない。
 */
export const RULE_TEXT_EN: Record<string, { ruleName: string; description: string }> = {
  "points.per-level": {
    ruleName: "Progression points per level-up",
    description: "Each player level gained grants 2 progression points.",
  },
  "points.total": {
    ruleName: "Total progression points at max level",
    description: "Total points when raised to max level are (max level - 1) x 2.",
  },
  "stat.cap.base": {
    ruleName: "Base stat cap",
    description: "Level 1 base stats are capped at 99.",
  },
  "stat.cap.final": {
    ruleName: "Final stat cap (including progression, boosters and manager bonuses)",
    description:
      "Base + progression stops at 99; player boosters and manager boosters add on top and can exceed 99 (per KONAMI v3.00; same as eFHUB). No cap on the final value.",
  },
  "progression.grouped": {
    ruleName: "Progression is per group",
    description:
      "Progression points are allocated to about 10 groups (categories); one allocation raises several related stats at once.",
  },
  "group.shooting.stats": {
    ruleName: "Stats affected by the Shooting group",
    description: "Shooting raises Finishing / Set Piece Taking (Place Kicking) / Curl.",
  },
  "group.other.stats": {
    ruleName: "Stats affected by groups other than Shooting",
    description:
      "The stats affected by Passing / Dribbling / Dexterity / Lower Body Strength / Aerial Strength / Defending / GK1-3 (eFHUB reference; Jumping belongs to both Aerial Strength and GK 1).",
  },
  "cost.staged": {
    ruleName: "Staged progression point cost",
    description:
      "Raising a category to level L costs ceil(L/4) points (levels 1-4: 1pt, 5-8: 2pt, 9-12: 3pt ...). Builds saved before 2026-10-08 keep the old rule (every 5 levels) until you recalculate.",
  },
  "progression.per-level-gain": {
    ruleName: "Stat gain per group allocation level",
    description:
      "Allocating one level to a group gives +1 to each stat in that group (base + progression stops at 99).",
  },
  "progression.eligibility": {
    ruleName: "Cards that cannot be progressed",
    description: "TRENDING cards (POTW, etc.) and cards whose max level is 1 cannot be progressed.",
  },
  "ovr.calc": {
    ruleName: "OVR calculation",
    description: "OVR is a summary of stats weighted by the registered position.",
  },
  "booster.effect": {
    ruleName: "Player booster effect",
    description:
      "A booster has a name and level N and adds +N to its fixed target stats. It is added after progression (after base + progression is capped at 99) and can exceed 99.",
  },
  "manager.correction": {
    ruleName: "Manager correction",
    description:
      "Manager boosters add +1 to their target stats, after progression, and can exceed 99. Team-playstyle proficiency corrections are not calculated.",
  },
};

/**
 * engine.ts の UNSUPPORTED_RULES（日本語固定文）の英語訳。キーは日本語原文。
 * engine.ts が変わった場合は未訳の文が残るため、テストで照合する。
 */
export const UNSUPPORTED_RULES_EN: Record<string, string> = {
  "公式のOVR計算式・ポジション別OVRの正確な重み": "The official OVR formula and exact per-position OVR weights",
  "Max Level Stats（最大レベル時の各能力値）の内訳": "Breakdown of Max Level Stats (each stat at max level)",
  "段階コストの9段階/13段階以降の正確な値（外挿・confirmed ではない）":
    "Exact staged costs from level 9 / level 13 onward (extrapolated; not confirmed)",
};

/** 規則の表示名・説明（言語別）。英語訳が無い規則は日本語へフォールバックする。 */
export function ruleText(rule: RuleRecord, locale: Locale): { ruleName: string; description: string } {
  if (locale === "ja") return { ruleName: rule.ruleName, description: rule.description };
  return RULE_TEXT_EN[rule.ruleId] ?? { ruleName: rule.ruleName, description: rule.description };
}
