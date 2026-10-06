import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 boosterList（2026-10-07・ブースター一覧の画面だけが読み込む）。 */
const boosterList: Dictionary["boosterList"] = {
  pageTitle: "ブースター一覧 | TeamAIXI",
  pageDescriptionMeta: "選手ブースターの対象能力・最大の上昇量・効果の証拠の段階の一覧です。",
  heading: "ブースター一覧",
  intro: "選手ブースターごとに、上がる能力と最大の上昇量、効果をどこまで確かめられているかを示します（新しい判定はしていません）。",
  nameNote: "ブースターの名前はデータ元の英語の表記です。",
  searchLabel: "名前で探す",
  searchPlaceholder: "例: Ball-carrying",
  abilityFilterLabel: "能力で絞り込み",
  abilityFilterAll: "すべての能力",
  countTemplate: "{count} 種類",
  empty: "該当するブースターがありません。",
  maxLevelTemplate: "最大 +{level}",
  conditionalBadge: "発動条件あり",
  conditionNotEvaluable: "現在のデータでは発動条件を判定できないため、どの計算でも最終値に加えません。",
  categoryStandard: "標準",
  categorySpecial: "特殊",
  categorySingle: "単体",
  evidence_game_client_verified: "ゲーム内で確認",
  evidence_screenshot_verified: "画面の記録で確認",
  evidence_external_cross_verified: "外部データの照合で確認",
  evidence_effect_provisional: "暫定",
  evidence_conditional_unverified: "条件つき（未確認）",
  evidenceNote_game_client_verified: "KONAMI のゲームの画面で変化量を直接確かめたもの。",
  evidenceNote_screenshot_verified: "外部のビルドツールの画面の記録で、対象と上昇量を確かめたもの（ゲームの画面での確認ではありません）。",
  evidenceNote_external_cross_verified: "外部の 2 つのデータの照合で一致し、別のカードでも反例がないもの（KONAMI の公式の計算結果ではありません）。",
  evidenceNote_effect_provisional: "1 つのデータだけ、または確かめた例が足りないもの。",
  evidenceNote_conditional_unverified: "発動条件があり、通常の最終値に自動で加えられないもの。",
  entryLink: "ブースター一覧",
  versionTemplate: "データの版: {version}",
};

registerJaNamespace("boosterList", boosterList);

export default boosterList;
