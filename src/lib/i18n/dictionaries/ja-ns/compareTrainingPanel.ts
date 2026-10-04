import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 compareTrainingPanel（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const compareTrainingPanel: Dictionary["compareTrainingPanel"] = {
  cannotProgressNote: "このカードは育成できません（能力値は基礎値のまま）。",
  autoAllocatedAnnounceTemplate: "{name}: {mode}の配分を適用しました。",
  resetButton: "リセット",
  resetAnnounceTemplate: "{name}: 育成をリセットしました。",
  saveThisBuildButton: "この育成を保存",
  autoAllocateNote:
    "自動育成は「配分方針」のヒューリスティックです。ゲーム内の自動配分・OVR 最大化とは異なります。適用後もスライダーで調整できます。",
  usedPointsLabel: "使用 {value}pt",
  remainingPointsLabel: "残り {value}pt",
  overAllocatedLabel: "配分超過",
  totalPointsLabel: "合計 {value}pt",
  gkHeading: "GK育成 3 項目",
  gkLevelLabelTemplate: "配分 Lv {level}",
  gkExpandedSuffix: "（GK・初期展開）",
  gkCollapsedSuffix: "（非GK・初期折りたたみ）",
  definitionNote: "カテゴリの対象能力・段階コスト・上限は選手詳細の育成画面と同一の定義です。同じ配分なら 26 能力値も一致します。",
  manualSuffix: "（手動）",
  embeddedHeadingTemplate: "{name} の育成",
  collapsedHeading: "育成を調整",
  };

registerJaNamespace("compareTrainingPanel", compareTrainingPanel);

export default compareTrainingPanel;
