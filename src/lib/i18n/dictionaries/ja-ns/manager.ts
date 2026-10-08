import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 manager（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const manager: Dictionary["manager"] = {
  squadWideHeading: "監督（スカッド全体）",
  confirmedBoostersAppliedPrefix: "確認済みブースターを ",
  confirmedBoostersAppliedSuffix: " 人へ適用中",
  selectManagerTitle: "スカッドの監督を選択",
  none: "監督なし（managerBoosterDelta = 0）",
  noneDescription: "監督を選ぶと、確認済みブースターが対象能力へ適用されます。",
  selectFromList: "監督一覧から選択",
  change: "変更",
  clear: "解除",
  confirmedBoosterActive: "確認済みブースターを適用中",
  unconfirmedBoosterNotice: "この監督のブースター効果は未確認のため適用していません（表示のみ）。",
  linkUpPlayAvailable: "Link-Up Play あり（条件の照合のみ・効果は未反映）",
  applicationOrderUnconfirmed: "適用順序（育成前 / 育成後）は未確認です。",
  viewManagerDetail: "監督詳細を見る",
  bestAt: "得意",
  };

registerJaNamespace("manager", manager);

export default manager;
