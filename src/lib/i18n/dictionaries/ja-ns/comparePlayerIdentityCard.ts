import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 comparePlayerIdentityCard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const comparePlayerIdentityCard: Dictionary["comparePlayerIdentityCard"] = {
  cardImageAltTemplate: "{name} {cardType} カード画像",
  noEnglishName: "（英語名なし）",
  ovrTooltip: "保存済みのカード全体 OVR（ポジション別ではありません）",
  ovrLineTemplate: "最大 {max} / 基礎 {base}",
  pomChipTooltip: "Power of Many（金色・Game Plan 依存・比較の順位へ自動反映しません）",
  fixedProvisionalTooltip:
    "固定型（推定）: 効果内容は外部照合済み。Power of Many である具体的証拠が無いため固定型と推定して標準値へ暫定適用しています。",
  fixedTooltip: "固定型（標準モードで標準値へ反映）",
  unresolvedTooltip: "発動方式・効果を確認できていない付属ブースター",
  pomChipTemplate: "{nameEn} 最大+{level}",
  fixedChipTemplate: "{nameEn} +{level}",
  provisionalSuffix: "（推定）",
  unresolvedChip: "未解決",
  noAttachedBoosters: "付属ブースターなし",
  pomSelectionLabelTemplate: "Power of Many 指定: {tier}（ユーザー指定・条件反映後値のみ）",
  currentTrainingTemplate: "現在: {label}",
  playerDetailLink: "選手詳細",
  progressionScreenLink: "育成画面",
  };

registerJaNamespace("comparePlayerIdentityCard", comparePlayerIdentityCard);

export default comparePlayerIdentityCard;
