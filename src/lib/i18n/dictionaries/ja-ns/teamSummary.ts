import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 teamSummary（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const teamSummary: Dictionary["teamSummary"] = {
  heading: "チームサマリー",
  calcNote:
    "平均・合計は単純計算です。eFootball の公式チームパワー・カテゴリ重みとは異なります（暫定・非公式）。",
  boosterModeNote:
    "ブースター適用モード: 標準。カード付属の効果を外部2ソースで照合したブースターと監督補正のみ集計に反映（KONAMI 公式未確認）。発動方式が固定型と推定のもの（Power of Many である具体的証拠がないため暫定適用）を含みます。金色の可変ブースター（Game Plan の同一リーグ人数で効果量が変化・現状のスカッドでは自動評価不可）のユーザー指定値・効果検証中・未解決の付属ブースターと手動試算は含めません。",
  startingBenchLabel: "先発 / ベンチ",
  avgBaseOvrLabel: "平均 基礎OVR",
  avgDisplayedOvrLabel: "平均 推定OVR（公式の計算式ではない）",
  sharedSkillCountLabel: "共通スキル数",
  managerBoostedLabel: "監督ブースター適用",
  unresolvedCompatibilityLabel: "適性未確認",
  possibleMismatchLabel: "不適性の可能性",
  warningsLabel: "警告",
  peopleSuffix: " 人",
  countSuffix: " 件",
  positionBreakdownHeading: "ポジション構成",
  categoryAveragesHeading: "カテゴリ平均（単純平均・非公式）",
  sharedSkillsHeading: "先発全員が持つスキル",
  conditionalToggleLabel: "条件付き試算サマリー（手動指定による試算）",
  conditionalNote:
    "一部の選手に金色・可変ブースターの適用段階がユーザー手動指定されています。この試算はユーザーが自身の Game Plan を確認して指定した段階に基づくもので、アプリが編成人数を自動検証した値ではありません。通常のチームサマリー（上）には含めていません。",
  conditionalAvgDisplayedOvrLabel: "平均 表示OVR（条件反映後・試算）",
  conditionalCategoryLabelSuffix: "（条件反映後）",
  conditionalValueTemplate: "{value}（標準 {std}）",
  };

registerJaNamespace("teamSummary", teamSummary);

export default teamSummary;
