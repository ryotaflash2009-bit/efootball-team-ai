import type { SquadDiagnosisCategoryId, SquadDiagnosisTier } from "@/lib/squad/squad-diagnosis";

/**
 * F-072 スカッド診断のスタイル称号・バッジ（ルールベース・決定的・版つき・説明できる）。
 *
 * - 入力は診断のカテゴリの点数と段階だけ（共有 URL の sd1 の `c` と同じ情報。URL の契約は変えない）。
 * - 閾値は診断の段階（DIAGNOSIS_TIER_THRESHOLDS）をそのまま使う: 称号・バッジとも段階 A 以上。
 * - 称号 = 条件を満たすカテゴリのうち点数が最も高いもの（同点は定義順）。バッジ = 残りを点数順に最大4つ。
 * - スカッドの完成度（squadCompleteness）はスタイルではないため対象外。
 */
export const DIAGNOSIS_TITLE_RULES_VERSION = "diagnosis-titles/2026-09-27.v1";

export const DIAGNOSIS_TITLE_CATEGORIES = [
  "counterAttack",
  "passBuildUp",
  "dribblePossession",
  "pressResistance",
  "speed",
  "aerial",
  "attack",
  "defense",
] as const satisfies readonly SquadDiagnosisCategoryId[];

export type DiagnosisTitleCategory = (typeof DIAGNOSIS_TITLE_CATEGORIES)[number];

const QUALIFYING: readonly SquadDiagnosisTier[] = ["S", "A"];
export const MAX_DIAGNOSIS_BADGES = 4;

export interface DiagnosisTitle {
  categoryId: DiagnosisTitleCategory;
  score: number;
  tier: SquadDiagnosisTier;
}

export interface DiagnosisTitleResult {
  rulesVersion: string;
  primary: DiagnosisTitle | null;
  badges: DiagnosisTitle[];
}

export function evaluateDiagnosisTitles(
  categories: Partial<Record<string, readonly [number | null, SquadDiagnosisTier | null] | { score: number | null; tier: SquadDiagnosisTier | null }>>,
): DiagnosisTitleResult {
  const qualified: (DiagnosisTitle & { order: number })[] = [];
  DIAGNOSIS_TITLE_CATEGORIES.forEach((id, order) => {
    const c = categories[id];
    if (!c) return;
    const [score, tier] = Array.isArray(c) ? c : [(c as { score: number | null }).score, (c as { tier: SquadDiagnosisTier | null }).tier];
    if (typeof score !== "number" || !Number.isFinite(score) || !tier || !QUALIFYING.includes(tier)) return;
    qualified.push({ categoryId: id, score, tier, order });
  });
  qualified.sort((a, b) => b.score - a.score || a.order - b.order);
  const strip = ({ categoryId, score, tier }: DiagnosisTitle) => ({ categoryId, score, tier });
  const [primary, ...rest] = qualified;
  return { rulesVersion: DIAGNOSIS_TITLE_RULES_VERSION, primary: primary ? strip(primary) : null, badges: rest.slice(0, MAX_DIAGNOSIS_BADGES).map(strip) };
}
