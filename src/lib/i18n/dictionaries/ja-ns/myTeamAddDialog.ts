import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 myTeamAddDialog（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const myTeamAddDialog: Dictionary["myTeamAddDialog"] = {
  editTitle: "My Team の記録を編集",
  addTitle: "My Team に追加",
  saveFailedFallback: "保存できませんでした",
  introAddTemplate:
    "{playerName}（ID {worldCardId}）を My Team に追加します。My Team は実際に保有しているカードの管理用です。お気に入りとは独立していて、ここへの追加でお気に入りには追加されません。",
  introEditTemplate:
    "{playerName}（ID {worldCardId}）の My Team 記録を編集します。My Team は実際に保有しているカードの管理用です。お気に入りとは独立しています。",
  ownershipLabel: "所有状態",
  usageLabel: "使用状態（任意）",
  usageNote: "使用状態はスカッド配置の事実とは別です。「主力」にしても自動でスカッドへ配置しません。",
  noteLabelTemplate: "メモ（任意・{max} 文字まで）",
  notePlaceholder: "例: ST起用予定 / 対人で強い / 次に育成を調整",
  noteCountTemplate: "{count} / {max}",
  cancelButton: "キャンセル",
  saveButton: "保存",
  addButton: "My Team に追加",
  };

registerJaNamespace("myTeamAddDialog", myTeamAddDialog);

export default myTeamAddDialog;
