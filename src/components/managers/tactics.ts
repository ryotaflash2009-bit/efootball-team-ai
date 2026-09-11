import type { TacticalProficiencies } from "@/lib/managers/types";

/** 戦術適性6項目のメタ情報（略称・英名・和名）。略称だけを出さず説明を添える。 */
export const TACTICS: { key: keyof TacticalProficiencies; abbr: string; en: string; ja: string }[] = [
  { key: "possessionGame", abbr: "PG", en: "Possession Game", ja: "ポゼッション" },
  { key: "quickCounter", abbr: "QC", en: "Quick Counter", ja: "ショートカウンター" },
  { key: "longBallCounter", abbr: "LBC", en: "Long Ball Counter", ja: "ロングカウンター" },
  { key: "outWide", abbr: "OW", en: "Out Wide", ja: "サイドアタック" },
  { key: "longBall", abbr: "LB", en: "Long Ball", ja: "ロングボール" },
  { key: "overload", abbr: "O", en: "Overload", ja: "オーバーロード" },
];

export type TacticTier = "elite" | "high" | "mid" | "low" | "poor" | "none";

export function tacticTier(v: number | null): TacticTier {
  if (v == null) return "none";
  if (v >= 90) return "elite";
  if (v >= 80) return "high";
  if (v >= 70) return "mid";
  if (v >= 60) return "low";
  return "poor";
}

export const TACTIC_BAR: Record<TacticTier, string> = {
  elite: "bg-cyan-400",
  high: "bg-lime-400",
  mid: "bg-amber-400",
  low: "bg-orange-400",
  poor: "bg-red-400",
  none: "bg-border",
};
export const TACTIC_TEXT: Record<TacticTier, string> = {
  elite: "text-cyan-300",
  high: "text-lime-300",
  mid: "text-amber-300",
  low: "text-orange-300",
  poor: "text-red-300",
  none: "text-text-muted",
};

/** 最も高い戦術適性を返す（同値なら定義順で最初）。 */
export function topTactic(p: TacticalProficiencies): { abbr: string; en: string; ja: string; value: number } | null {
  let best: { abbr: string; en: string; ja: string; value: number } | null = null;
  for (const t of TACTICS) {
    const v = p[t.key];
    if (v == null) continue;
    if (!best || v > best.value) best = { abbr: t.abbr, en: t.en, ja: t.ja, value: v };
  }
  return best;
}

export function managerInitials(nameEn: string): string {
  const parts = nameEn.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
