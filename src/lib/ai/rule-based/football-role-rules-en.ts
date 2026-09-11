import type { FootballRoleRuleEntry } from "./football-role-rules-ja";

/**
 * English equivalent of football-role-rules-ja.ts. See that file for the design rationale.
 * All phrases are matched against already-lowercased text (the parser lowercases English input).
 */

export const FOOTBALL_ROLE_RULES_EN: FootballRoleRuleEntry[] = [
  // --- Cross-focused play: could mean supplying, receiving, or wide-attack overall ---
  { phrase: "cross-focused play", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "cross focused play", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "crossing winger", outcome: { kind: "clarification", templateId: "cross-role" } },
  { phrase: "cross-heavy play", outcome: { kind: "clarification", templateId: "cross-role" } },

  // --- Supply side is unambiguous (the verb clearly means delivering the cross) ---
  { phrase: "deliver crosses", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "supply crosses", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "cross from wide", outcome: { kind: "direct-goal", goal: "passing" } },

  // --- Receiving side is unambiguous, but aerial vs. shooting focus still needs confirmation ---
  { phrase: "score from crosses", outcome: { kind: "clarification", templateId: "cross-receive-focus" } },
  { phrase: "attack crosses", outcome: { kind: "clarification", templateId: "cross-receive-focus" } },

  // --- A few clearly single-sense role phrases from the broader football vocabulary ---
  { phrase: "create chances", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "playmaker", outcome: { kind: "direct-goal", goal: "passing" } },
  { phrase: "carry the ball", outcome: { kind: "direct-goal", goal: "dribbling" } },
  { phrase: "beat defenders", outcome: { kind: "direct-goal", goal: "dribbling" } },
  { phrase: "keep possession", outcome: { kind: "direct-goal", goal: "possession" } },
  { phrase: "do not lose the ball", outcome: { kind: "direct-goal", goal: "possession" } },
];
