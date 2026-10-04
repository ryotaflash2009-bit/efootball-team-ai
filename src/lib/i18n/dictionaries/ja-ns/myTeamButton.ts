import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 myTeamButton（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const myTeamButton: Dictionary["myTeamButton"] = {
  registeredAria: "My Team に登録済み",
  registeredLabel: "My Team 登録済み",
  openInMyTeamLink: "My Team で開く",
  addButton: "My Team に追加",
  unavailableNote: "このブラウザでは保存できません",
  };

registerJaNamespace("myTeamButton", myTeamButton);

export default myTeamButton;
