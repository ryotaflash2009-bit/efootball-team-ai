import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 buildUsage（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const buildUsage: Dictionary["buildUsage"] = {
  heading: "ビルド使用状況",
  viewDetail: "詳細を見る",
  setCountLabel: "設定済み",
  unsetCountLabel: "未設定",
  missingCountLabel: "削除済み参照",
  peopleSuffix: " 人",
  footerTemplate: "先発 {starter} / ベンチ {bench}。スカッド用ビルドは My Team の選択中／お気に入りビルドとは別です。",
  modalTitle: "ビルド使用状況（このスカッド）",
  modalIntro:
    "現在のスカッドの各枠のスカッド用保存ビルド（savedBuildId）の状況です。ここでは確認と各枠の「保存ビルドを選ぶ」への移動だけを行います。一括適用・一括解除・自動補完はしません。表示しただけではスカッドは保存されません。",
  statTotal: "総登録人数",
  statStarter: "先発",
  statBench: "ベンチ",
  statSet: "ビルド設定済み",
  statUnset: "未設定",
  statMissing: "削除済み参照",
  statCurrentRules: "現行規則ビルド",
  statLegacyRules: "旧規則ビルド",
  statUnknownRules: "規則不明ビルド",
  statPom: "Power of Many 指定あり",
  statExperimental: "実験的試算あり",
  filterAll: "全員",
  filterSet: "設定済み",
  filterUnset: "未設定",
  filterMissing: "削除済み参照",
  filterStarter: "先発",
  filterBench: "ベンチ",
  searchPlaceholder: "選手名・ビルド名で検索",
  searchAriaLabel: "ビルド使用状況を検索",
  emptyList: "条件に一致する枠がありません。",
  areaStarter: "先発",
  areaBench: "ベンチ",
  buildUnset: "スカッド用ビルド: 未設定",
  buildMissingTemplate: "スカッド用ビルド: 見つかりません（削除済み・buildId {id}）",
  buildSetPrefix: "スカッド用ビルド: ",
  pomSuffix: "・Power of Many 指定あり",
  experimentalSuffix: "・実験的試算あり",
  chooseBuildButton: "保存ビルドを選ぶ",
  manageInMyBuilds: "My Builds で管理",
  closeButton: "閉じる",
  ruleCurrentLabel: "現行規則",
  ruleLegacyLabel: "旧規則",
  ruleUnknownLabel: "規則不明",
  };

registerJaNamespace("buildUsage", buildUsage);

export default buildUsage;
