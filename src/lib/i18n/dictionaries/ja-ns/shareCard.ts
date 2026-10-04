import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 shareCard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const shareCard: Dictionary["shareCard"] = {
  optionsSummary: "比率を選ぶ・プレビュー",
  ratioLabel: "画像の比率",
  ratio34: "縦 3:4（標準）",
  ratio11: "正方形 1:1",
  ratio916: "縦長 9:16（ストーリー）",
  ratio169: "横長 16:9",
  previewLoading: "プレビューを作っています…",
  previewAltTemplate: "スカッド診断カードのプレビュー（{ratio}）",
  shareButton: "共有",
  shareTitle: "スカッド診断",
  shared: "共有しました。",
  privacyNote: "画像にはスカッド名・フォーメーション・評価だけを載せます（URL・ID・アカウントの情報は載せません）。スカッド名に個人情報を入れないでください。",
  };

registerJaNamespace("shareCard", shareCard);

export default shareCard;
