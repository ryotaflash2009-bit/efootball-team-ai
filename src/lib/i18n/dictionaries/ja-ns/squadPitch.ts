import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 squadPitch（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const squadPitch: Dictionary["squadPitch"] = {
  compatExactTitle: "登録ポジションと一致",
  compatRelatedTitle: "適性未確認（近いポジション）",
  compatUnresolvedTitle: "適性未確認",
  compatMismatchTitle: "不適性の可能性",
  compatEmptyTitle: "未配置",
  snapLabelTemplate: "スナップ: {types}",
  freePlacementLabel: "自由配置",
  guideHorizontalLabel: "同ライン",
  guideCenterLabel: "中央",
  guideSymmetryLabel: "左右対称",
  moveTargetPrefix: "移動先候補 — ",
  moveSourcePrefix: "移動中 — ",
  occupiedSlotAriaTemplate: "{position}: {name}（{compat}）",
  moveTargetSwapSuffix: "・選ぶと入れ替え",
  emptySlotAriaTemplate: "{position}: 空きスロット。",
  moveTargetMoveHereLabel: "選ぶとここへ移動",
  addPlayerLabel: "選手を追加",
  };

registerJaNamespace("squadPitch", squadPitch);

export default squadPitch;
