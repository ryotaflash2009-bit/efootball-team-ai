import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 worldPlayerSearchCard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const worldPlayerSearchCard: Dictionary["worldPlayerSearchCard"] = {
  disabledAriaTemplate: "{name}（{identity}）は{reason}",
  enabledAriaTemplate: "{name}（{identity}）を{action}",
  cannotAddFallback: "追加できません",
  ovrTooltip: "保存済みのカード全体 OVR（ポジション別ではありません）",
  noEnglishName: "（英語名なし）",
  maxOvrLabel: "最大 {value}",
  levelCapLabel: "Lv上限 {value}",
  noTeamInfo: "チーム / 国籍 情報なし",
  pomTooltip: "Power of Many（金色・Game Plan 依存・どのモードでも標準値へ自動適用しません）",
  fixedProvisionalTooltip:
    "固定型（推定）: 効果内容は外部照合済み。Power of Many である具体的証拠が無いため固定型と推定して標準値へ暫定適用しています。",
  fixedTooltip: "固定型（青色・標準モードで標準値へ適用）",
  unresolvedTooltip: "発動方式・効果を確認できていない付属ブースター（標準値へ加算しません）",
  pomChipTemplate: "Power of Many {nameEn} 最大+{level}",
  fixedProvisionalChipTemplate: "{nameEn} +{level}（固定型推定）",
  fixedChipTemplate: "{nameEn} +{level}（固定型）",
  unresolvedChip: "未解決ブースター",
  noAttachedBoosters: "付属ブースターなし",
  detailLink: "詳細",
  detailNewTabSuffix: "（新規タブ）",
  unknownCardType: "カードタイプ不明",
  unknownPosition: "ポジション不明",
  maxOvrTemplate: "最大OVR {value}",
  noOvrInfoLabel: "OVR 情報なし",
  cardImageAltTemplate: "{name} {cardType} カード画像",
  };

registerJaNamespace("worldPlayerSearchCard", worldPlayerSearchCard);

export default worldPlayerSearchCard;
