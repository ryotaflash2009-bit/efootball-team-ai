import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 managerDetail（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const managerDetail: Dictionary["managerDetail"] = {
  unavailableTitle: "監督データが利用できません",
  backToList: "マネージャー一覧へ戻る",
  releaseBadgeTemplate: "リリース {date}",
  unknown: "不明",
  sourceBadgeTemplate: "ソース {id}",
  bestTactic: "得意戦術",
  proficiencyTitle: "戦術適性",
  proficiencyHint: "数値・バー・順位。色だけに依存しません",
  boosterTitle: "監督ブースター",
  boosterConfirmed: "複数ソースで確認済み",
  boosterUnconfirmed: "効果未確認",
  boosterUnconditional: "無条件",
  boosterKeyUnmapped: "・キー未変換",
  boosterNone: "この監督に能力値ブースターはありません。",
  boosterNote: "確認済みブースターのみ育成・比較・スカッドの能力値へ適用します。適用順序（育成前 / 後）は未確認です。",
  linkUpHint: "発動条件は検証中・能力値へは適用しません",
  centerPieceLabel: "Center Piece 条件",
  keyManLabel: "Key Man 条件",
  linkUpNone: "この監督に Link-Up Play はありません。",
  notInSourceTitle: "ソース非収録（追加調査中）",
  notInSourceValue: "追加調査中",
  labelAge: "年齢",
  labelNationality: "国籍",
  labelTeam: "チーム",
  labelRating: "監督レーティング",
  labelFormation: "フォーメーション",
  dataSourceTemplate: "データ提供: {source} / 取得日時: {fetchedAt}",
  openSource: "出典を開く",
  };

registerJaNamespace("managerDetail", managerDetail);

export default managerDetail;
