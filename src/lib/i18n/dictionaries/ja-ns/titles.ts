import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 titles（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const titles: Dictionary["titles"] = {
  primaryLabel: "称号",
  badgesLabel: "バッジ",
  none: "条件を満たす称号はありません。",
  whySummary: "理由を見る",
  rulesVersionTemplate: "規則 {version}",
  playerExplanationTemplate: "育成前の基礎能力値の位置（{scope}の中）から、決まった規則で表示しています。称号は規則の能力がすべて上位5%以内、バッジは上位10%以内のときです。",
  diagnosisExplanation: "診断のカテゴリの段階（A 以上）から、決まった規則で表示しています。称号は点数が最も高いカテゴリです。",
  diagnosisReasonTemplate: "{category} {score}点（{tier}）",
  rulePace: "快速",
  ruleFinishing: "決定力",
  ruleDribbling: "ドリブル",
  rulePassing: "配球",
  ruleSetPieces: "プレースキック",
  ruleAerial: "空中戦",
  ruleBallWinning: "ボール奪取",
  rulePhysicality: "フィジカル",
  ruleStamina: "運動量",
  ruleShotStopping: "シュートストップ",
  ruleHandling: "キャッチ・リーチ",
  ruleGkAwareness: "GK感覚",
  dgCounterAttack: "カウンター型",
  dgPassBuildUp: "ビルドアップ型",
  dgDribblePossession: "ポゼッション型",
  dgPressResistance: "プレス耐性型",
  dgSpeed: "スピード型",
  dgAerial: "空中戦型",
  dgAttack: "攻撃型",
  dgDefense: "堅守型",
  };

registerJaNamespace("titles", titles);

export default titles;
