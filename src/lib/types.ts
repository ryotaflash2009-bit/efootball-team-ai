/**
 * アプリ内部で使う型定義。
 * 外部データ（eFHUB の短縮キー i/e/j/o）は取得時にこの形へ正規化する。
 */

/** 一覧・カード表示に使う選手の要約情報 */
export interface PlayerSummary {
  /** eFHUB の選手ID。数値の精度劣化を避けるため文字列で保持する。 */
  id: string;
  /** 日本語名 */
  nameJa: string;
  /** 英語名 */
  nameEn: string;
  /** OVR（総合能力値） */
  ovr: number;
}

/** 選手詳細（今回の動作版では要約と同じ項目のみ） */
export type PlayerDetail = PlayerSummary;

/** データの取得元・鮮度を表すメタ情報 */
export interface DataMeta {
  /** データソース名（例: "eFHUB"） */
  source: string;
  /** 取得元URL */
  sourceUrl: string;
  /** HTTPメソッド（例: "GET"） */
  method: string;
  /** 取得日時（ISO 8601 文字列） */
  fetchedAt: string;
  /** 受信した配列の総件数 */
  totalReceived: number;
  /** 実際に保存した件数（最大100） */
  savedCount: number;
  /** 補足メモ */
  note?: string;
}

/** 並べ替えの種類 */
export type SortKey = "ovr_desc" | "ovr_asc" | "name";

/** 一覧取得の結果 */
export interface PlayersResult {
  players: PlayerSummary[];
  meta: DataMeta | null;
}
