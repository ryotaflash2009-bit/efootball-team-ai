import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 tactical（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const tactical: Dictionary["tactical"] = {
  sectionHeading: "配置構造・戦術監査",
  scopeDescription:
    "現在の配置ポジション、フォーメーション座標、確認済み診断カテゴリにもとづく構造分析です。プレースタイルの発動可否、選手固有AI、実際の試合中の挙動は判定していません。",
  placementCountLabel: "配置",
  placementCountUnit: "人",
  severityHigh: "重要度: 高",
  severityMedium: "重要度: 中",
  severityLow: "重要度: 低",
  severityInfo: "参考情報",
  confidenceHigh: "信頼度: 高",
  confidenceMedium: "信頼度: 中",
  confidenceLow: "信頼度: 低",
  confidenceInsufficient: "信頼度: データ不足",
  coverageInsufficient: "配置不足",
  coverageLimited: "配置一部のみ",
  coveragePartial: "配置ほぼ完了",
  coverageFull: "配置完了",
  potentialRiskPrefix: "想定されるリスク",
  limitationsPrefix: "分析上の制限",
  };

registerJaNamespace("tactical", tactical);

export default tactical;
