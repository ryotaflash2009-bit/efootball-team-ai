import { evaluateCompatibility } from "@/lib/squad/position";
import type { BestXiSuitability, BestXiSuitabilityTier } from "./types";

/**
 * スロットへの適合度を既存の `evaluateCompatibility`(src/lib/squad/position.ts)だけで判定する。
 *
 * このプロジェクトのWorldデータは副ポジション適性を確認できていないため、
 * 断言できるのは「登録ポジションと一致(exact)」と「GK⇔フィールドの不一致(gkMismatch)」だけ。
 * それ以外は、同系統(DF/MF/FW)内かどうかで related / unresolved の2段階に分ける
 * (これは evaluateCompatibility が既に区別している既存の分類であり、新しい細分化ではない)。
 * 架空の数値ペナルティは追加しない。あくまで既存の4区分をそのまま優先順位へ写像するだけ。
 */
export function evaluateSlotSuitability(
  registeredPosition: string | null,
  slotPosition: string,
): BestXiSuitability {
  const compatibility = evaluateCompatibility(registeredPosition, slotPosition);
  const tier: BestXiSuitabilityTier =
    compatibility.status === "exact"
      ? "exact"
      : compatibility.status === "related"
        ? "related"
        : compatibility.status === "gkMismatch"
          ? "excluded"
          : "unresolved";
  return { tier, compatibilityStatus: compatibility.status };
}

/**
 * 「このスロットを検討対象にしてよいか」(表示・選外理由の生成対象にしてよいか)。
 * GK⇔フィールドの不一致(gkMismatch)だけを確実な除外条件として扱う。
 * 自動選出してよいかどうかは別途 `isBestXiAutoSelectableForSlot` で判定する
 * (「検討対象になり得る」ことと「自動配置してよい」ことは別の基準)。
 */
export function isEligibleForSlot(registeredPosition: string | null, slotPosition: string): boolean {
  return evaluateSlotSuitability(registeredPosition, slotPosition).tier !== "excluded";
}

/**
 * AIベスト11の自動選出でスロットへ配置してよいか。
 *
 * - exact(登録ポジションと一致): 自動選出可能。
 * - related(evaluateCompatibilityが確認済みとして返す同系統): 自動選出可能。
 *   ここでいう「確認済み」とは、既存の evaluateCompatibility 自体が返す区分であり、
 *   この関数が新たに関係を推測・拡張することはない。
 * - unresolved(系統が異なる、または登録ポジション自体が不明): 自動選出しない。
 *   ポジション別推定OVRを計算できることと、そのポジションへ配置してよいことは別の基準であるため、
 *   推定評価の有無に関わらず、unresolvedは常に自動選出の対象外とする。
 * - gkMismatch(excluded): 自動選出しない。
 */
export function isBestXiAutoSelectableForSlot(tier: BestXiSuitabilityTier): boolean {
  return tier === "exact" || tier === "related";
}

/** tierの優先順位(小さいほど優先)。同点時の並びに使う。 */
export function suitabilityTierRank(tier: BestXiSuitabilityTier): number {
  switch (tier) {
    case "exact":
      return 0;
    case "related":
      return 1;
    case "unresolved":
      return 2;
    default:
      return 3;
  }
}
