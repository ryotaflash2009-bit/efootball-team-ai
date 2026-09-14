/**
 * 選手名検索用の軽量索引(`player_index_entries`由来)。
 *
 * `static-search-index-design.md`で決定した方針を実装する純関数群:
 * - 索引はサーバー内でのみ保持し、クライアントへは検索結果(絞り込み後の一部)のみを返す。
 * - 最小検索文字数のゲーティング・結果件数上限・offsetページングをここで一元管理し、
 *   将来APIルートへ統合する際にも同じ挙動を再利用できるようにする。
 */

export const MIN_QUERY_LENGTH = 2;
export const MAX_RESULTS = 100;

export interface PlayerIndexSourceRow {
  efhub_card_id: string;
  name_en: string | null;
  name_ja: string | null;
  ovr_max_candidate: number | null;
  is_anomalous: number | boolean;
}

export interface PlayerIndexEntry {
  id: string;
  nameEn: string;
  nameJa: string | null;
  ovrMaxCandidate: number | null;
}

export interface SearchIndex {
  datasetVersion: string;
  entries: PlayerIndexEntry[];
}

export interface SearchOptions {
  offset?: number;
  limit?: number;
}

export interface SearchResult {
  query: string;
  datasetVersion: string;
  total: number;
  offset: number;
  limit: number;
  items: PlayerIndexEntry[];
  guidance?: string;
}

/** SQLite由来の生行から、クライアント非公開のサーバー内索引を構築する。異常値扱いの行は除外する。 */
export function buildSearchIndex(rows: readonly PlayerIndexSourceRow[], datasetVersion: string): SearchIndex {
  const entries = rows
    .filter((row) => !row.is_anomalous)
    .map((row) => ({
      id: row.efhub_card_id,
      nameEn: row.name_en ?? "",
      nameJa: row.name_ja,
      ovrMaxCandidate: row.ovr_max_candidate,
    }));
  return { datasetVersion, entries };
}

function normalize(value: string): string {
  return value.toLowerCase();
}

/**
 * 索引を検索する。最小検索文字数未満のクエリはガイダンス付きの空結果を返し、
 * 全件スキャン相当の無意味な処理を避ける。
 */
export function searchIndex(index: SearchIndex, rawQuery: string, options: SearchOptions = {}): SearchResult {
  const query = rawQuery.trim();
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(MAX_RESULTS, Math.max(1, options.limit ?? MAX_RESULTS));

  if (query.length < MIN_QUERY_LENGTH) {
    return {
      query,
      datasetVersion: index.datasetVersion,
      total: 0,
      offset,
      limit,
      items: [],
      guidance: `検索には${MIN_QUERY_LENGTH}文字以上入力してください`,
    };
  }

  const needle = normalize(query);
  const matched = index.entries.filter((entry) => {
    const en = normalize(entry.nameEn);
    const ja = entry.nameJa ? normalize(entry.nameJa) : "";
    return en.includes(needle) || ja.includes(needle);
  });

  const page = matched.slice(offset, offset + limit);

  return {
    query,
    datasetVersion: index.datasetVersion,
    total: matched.length,
    offset,
    limit,
    items: page,
  };
}
