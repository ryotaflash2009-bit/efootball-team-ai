import type { PrimaryGoalId } from "@/lib/progression/build-intent-analysis";
import type { BuildIntentClarification, BuildIntentClarificationOption, BuildIntentClarificationPatch } from "@/lib/ai/build-intent-extractor";

/**
 * サッカー用途・役割表現(例:「クロスゲーム」)から生成する候補確認の、言語非依存なテンプレート定義。
 *
 * - 完成文はここに置かない(ja/en辞書のキーを指すコードだけを保持する)。
 * - 候補が適用する値(patch)は、既存の許可済み列挙値だけを使う
 *   (build-intent-extractor.ts の validateBuildIntentExtraction が最終的に再検証する)。
 * - 能力値・育成ポイント・OVR・勝率・順位に相当するフィールドはそもそも型に存在しない。
 */

export interface ClarificationTemplateOption {
  id: string;
  labelCode: string;
  descriptionCode: string;
  patch: BuildIntentClarificationPatch;
  confidence: "high" | "medium" | "low";
}

export interface ClarificationTemplate {
  /** どの用途表現に対する確認かを表す種別(役割ルール側から参照する)。 */
  templateId: "cross-role" | "cross-receive-focus";
  questionCode: string;
  reasonCode: string;
  /** 「どれにも当てはまらない」以外の候補(決定的な順序)。 */
  options: ClarificationTemplateOption[];
  /** この確認が既に解決済みとみなせる場合にスキップするための判定対象領域。 */
  relevantGroupIds: string[];
}

const CROSS_ROLE_TEMPLATE: ClarificationTemplate = {
  templateId: "cross-role",
  questionCode: "clarificationCrossRoleQuestion",
  reasonCode: "clarificationCrossRoleReason",
  relevantGroupIds: ["passing", "aerialStrength", "shooting"],
  options: [
    {
      id: "cross-supply",
      labelCode: "clarificationCrossSupplyLabel",
      descriptionCode: "clarificationCrossSupplyDescription",
      patch: { primaryGoal: "passing" as PrimaryGoalId, priorityGroups: ["passing"] },
      confidence: "medium",
    },
    {
      id: "cross-receive",
      labelCode: "clarificationCrossReceiveLabel",
      descriptionCode: "clarificationCrossReceiveDescription",
      patch: { priorityGroups: ["aerialStrength", "shooting"] },
      confidence: "medium",
    },
    {
      id: "cross-wide-attack",
      labelCode: "clarificationCrossWideAttackLabel",
      descriptionCode: "clarificationCrossWideAttackDescription",
      patch: { primaryGoal: "passing" as PrimaryGoalId, priorityGroups: ["passing"] },
      confidence: "low",
    },
  ],
};

const CROSS_RECEIVE_FOCUS_TEMPLATE: ClarificationTemplate = {
  templateId: "cross-receive-focus",
  questionCode: "clarificationCrossReceiveFocusQuestion",
  reasonCode: "clarificationCrossReceiveFocusReason",
  relevantGroupIds: ["aerialStrength", "shooting"],
  options: [
    {
      id: "cross-receive-aerial",
      labelCode: "clarificationCrossReceiveAerialLabel",
      descriptionCode: "clarificationCrossReceiveAerialDescription",
      patch: { primaryGoal: "aerial" as PrimaryGoalId, priorityGroups: ["aerialStrength"] },
      confidence: "medium",
    },
    {
      id: "cross-receive-shooting",
      labelCode: "clarificationCrossReceiveShootingLabel",
      descriptionCode: "clarificationCrossReceiveShootingDescription",
      patch: { primaryGoal: "scoring" as PrimaryGoalId, priorityGroups: ["shooting"] },
      confidence: "medium",
    },
    {
      id: "cross-receive-both",
      labelCode: "clarificationCrossReceiveBothLabel",
      descriptionCode: "clarificationCrossReceiveBothDescription",
      patch: { priorityGroups: ["aerialStrength", "shooting"] },
      confidence: "medium",
    },
  ],
};

export const CLARIFICATION_TEMPLATES: Record<ClarificationTemplate["templateId"], ClarificationTemplate> = {
  "cross-role": CROSS_ROLE_TEMPLATE,
  "cross-receive-focus": CROSS_RECEIVE_FOCUS_TEMPLATE,
};

const MAX_SOURCE_TEXT_LENGTH = 100;

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * テンプレートから実際の BuildIntentClarification を組み立てる(「どれにも当てはまらない」を必ず末尾へ追加)。
 * id はこの抽出結果内で一意になるよう、呼び出し側が決定的な値(出現順など)を渡す。
 */
export function buildClarificationFromTemplate(templateId: ClarificationTemplate["templateId"], id: string, sourceText: string): BuildIntentClarification {
  const template = CLARIFICATION_TEMPLATES[templateId];
  const evidence = clip(sourceText, MAX_SOURCE_TEXT_LENGTH);
  const options: BuildIntentClarificationOption[] = [
    ...template.options.map((o) => ({
      id: o.id,
      labelCode: o.labelCode,
      descriptionCode: o.descriptionCode,
      patch: o.patch,
      confidence: o.confidence,
      evidence,
    })),
    {
      id: "none",
      labelCode: "clarificationNoneOptionLabel",
      descriptionCode: "clarificationNoneOptionDescription",
      patch: {},
      confidence: "low",
      evidence: "",
    },
  ];
  return {
    id,
    sourceText: evidence,
    questionCode: template.questionCode,
    reasonCode: template.reasonCode,
    options,
  };
}

export function getClarificationTemplateRelevantGroupIds(templateId: ClarificationTemplate["templateId"]): string[] {
  return CLARIFICATION_TEMPLATES[templateId].relevantGroupIds;
}
