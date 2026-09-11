import type { PrimaryGoalId } from "@/lib/progression/build-intent-analysis";

/**
 * サッカー・eFootballで一般的に使われる短い役割表現・口語表現の日本語対応表。
 *
 * - 「クロスゲーム」のように、能力領域を直接指していない用途・戦い方の表現を対象にする。
 * - eFootball固有の非公開仕様(プレースタイル発動条件・選手固有AI挙動)は一切断定しない。
 * - 各表現は次のいずれかへ分類する(安全性を最優先し、無理に1つへ決めない):
 *   1. direct-goal: 表現の役割自体は一意なので、主目的(primaryGoal)だけを直接設定してよい
 *      (どの能力領域を伸ばすかまでは確定しない。「クロスを供給したい」だけで
 *      クイックネスや脚力を勝手に確定しない、という要件に対応する)。
 *   2. clarification: 複数の妥当な解釈があるため、ユーザー確認(候補提示)が必要。
 *      relevantGroupIds のいずれかが、この役割表現とは別の理由(明示的な優先度表現など)で
 *      既に解決済みの場合は、確認せず直接扱う(冗長な確認を出さない)。
 * - ここに含めなかった表現(例: 「リンクマン」「デコイ役」等のプレースタイル的役割)は、
 *   意図的に対象外としている(安全に変換できないため)。
 */

export type FootballRoleOutcome = { kind: "direct-goal"; goal: PrimaryGoalId } | { kind: "clarification"; templateId: "cross-role" | "cross-receive-focus" };

export interface FootballRoleRuleEntry {
  phrase: string;
  outcome: FootballRoleOutcome;
}

export const FOOTBALL_ROLE_RULES_JA: FootballRoleRuleEntry[] = [
  // --- クロス中心のサイド攻撃(供給/受け手/サイド攻撃全体のいずれもあり得るため要確認) ---
  { phrase: "クロス中心のサイド攻撃をしたい", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロス中心のサイド攻撃", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロスゲームしたい", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロスゲーしたい", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロスゲーム", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロスゲー", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロス主体", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロス中心", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "クロス向け", outcome: { kind: "clarification", templateId: "cross-role" } },

  // --- 供給側であることが表現から一意に読み取れるもの(「上げる/供給する」という動作が明確) ---
  { phrase: "サイドからクロスを供給したい", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "サイドから供給したい", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "クロスを供給したい", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "クロス供給", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "クロスを上げたい", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "クロス上げたい", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "クロス上げ", outcome: { kind: "direct-goal", goal: "passing" } },

  // --- 受け手側であることは一意だが、空中戦とシュートのどちらを主目的にするかは要確認 ---
  { phrase: "クロスに合わせて得点したい", outcome: { kind: "clarification", templateId: "cross-receive-focus" } },
  { phrase: "クロスに合わせたい", outcome: { kind: "clarification", templateId: "cross-receive-focus" } },
];
