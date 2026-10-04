import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 managerCard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const managerCard: Dictionary["managerCard"] = {
  bestTacticLabel: "得意戦術",
  };

registerJaNamespace("managerCard", managerCard);

export default managerCard;
