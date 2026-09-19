/**
 * 参照データ自動更新基盤(Phase 1: dry-run専用)の共有型。
 *
 * このディレクトリ配下はすべて純関数であり、ネットワーク接続・DB接続・ファイル書込みを
 * 一切含まない。実際の外部取得・Supabaseへの書込みは別レイヤー(未実装、将来のPhase 2)の責務。
 */

/** 取得結果に付随する出典メタデータ。秘密情報(APIキー・トークン・接続文字列)を含めないこと。 */
export interface SourceMeta {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string | null;
  contentLength: number | null;
}

/** 1件のレコード(取得直後・変換後いずれも可)。idは主キー相当の文字列表現。 */
export interface StagingRecord {
  id: string;
  fields: Readonly<Record<string, unknown>>;
}

/** 1テーブル分の取得結果(ステージング領域相当、まだ本テーブルへは反映していない状態)。 */
export interface StagingDataset {
  table: string;
  sourceMeta: SourceMeta;
  records: readonly StagingRecord[];
}

/** 前回反映済み状態のスナップショット(比較対象)。フィールド全体ではなくchecksumだけを保持する軽量表現。 */
export interface PreviousSnapshotRecord {
  id: string;
  checksum: string;
}

export interface PreviousSnapshot {
  table: string;
  records: readonly PreviousSnapshotRecord[];
}
