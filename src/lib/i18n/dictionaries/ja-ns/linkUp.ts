import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 linkUp（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const linkUp: Dictionary["linkUp"] = {
  notice: "発動条件の照合のみ対応。ゲーム内効果は追加検証中です。",
  noManagerNote: "監督を選択すると Link-Up Play の条件を照合します。",
  noDataNote: "この監督に Link-Up Play のデータはありません。",
  statusMet: "条件達成",
  statusPartial: "一部達成",
  statusUnmet: "未達成",
  statusIndeterminate: "判定不能",
  noStyleSpecified: "（プレースタイル指定なし）",
  noConditionData: "条件データなし",
  matchingStartersLabel: "合致する先発: ",
  noneLabel: "なし",
  selectAriaTemplate: "{name} の {role} を選択",
  noManualSelection: "（手動選択なし）",
  selectedPrefix: "選択中: ",
  satisfiesYes: "条件を満たします",
  satisfiesNo: "条件を満たしません",
  };

registerJaNamespace("linkUp", linkUp);

export default linkUp;
