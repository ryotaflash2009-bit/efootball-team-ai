/**
 * eFootball World データの内部型。
 * SQLite の行（snake_case）は mappers.ts で以下の camelCase へ変換する。
 */

/** 並べ替えキー（許可リスト。SQL へ直接渡さず queries.ts の対応表で変換する） */
export type WorldSortKey =
  | "ovr_max_desc"
  | "ovr_max_asc"
  | "ovr_base_desc"
  | "ovr_base_asc"
  | "name"
  | "updated_desc";

/** 一覧・カード表示に使う要約情報 */
export interface WorldPlayerListItem {
  worldCardId: string;
  nameEn: string | null;
  nameJa: string | null;
  cardType: string | null;
  registeredPosition: string | null;
  ovrBase: number | null;
  ovrMax: number | null;
  maximumLevel: number | null;
  cardRating: string | null;
  playingStyle: string | null;
  playingStyleDefensive: string | null;
  nationality: string | null;
  region: string | null;
  league: string | null;
  team: string | null;
  preferredFoot: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  boost1: number | null;
  boost2: number | null;
  appearanceUpdatedAt: string | null;
  /** SQLite 保存値（ブラウザの <img> には渡さない。表示は既存 eFHUB プロキシ or プレースホルダー） */
  imageUrlCandidate: string | null;
  mobileImageUrlCandidate: string | null;
  /** 高信頼リンク（source_record_links）がある場合のみ true */
  hasEfhubLink: boolean;
  /** 高信頼リンク先の eFHUB カード ID（数字文字列）。なければ null */
  efhubCardId: string | null;
}

/** 能力値 1 項目 */
export interface WorldStatValue {
  key: string;
  nameEn: string;
  group: WorldStatGroup;
  value: number | null;
}

export type WorldStatGroup = "offense" | "defense" | "gk" | "physical";

/** appearance の各メトリクスの順位（world_player_appearances.ranks_json 由来・KONAMI World の全件ランキング） */
export interface WorldMetricRank {
  /** 値の大きい順の順位（1 = 最大）。 */
  rank: number;
  /** 母数。 */
  total: number;
  /** 「上位 N%（値の大きい順）」。 */
  topPercent: number;
}

/** appearance（体格・当たり判定など） */
export interface WorldAppearance {
  position: string | null;
  legCoverageRadius: number | null;
  armCoverageRadius: number | null;
  torsoCollision: number | null;
  jumpingHeight: number | null;
  dribbleHeight: number | null;
  legLength: number | null;
  /**
   * world_player_appearances.ranks_json をパースしたもの。
   * キー = メトリクス名（legCoverageRadius / armCoverageRadius / torsoCollision / jumpingHeight / dribbleHeight / legLength）。
   * 各値に overall（全 13,009 中）と position（同ポジション中）の順位。無ければ null。
   */
  ranks: Record<string, { overall: WorldMetricRank | null; position: WorldMetricRank | null }> | null;
  updatedAt: string | null;
}

/** 選手詳細 */
export interface WorldPlayerDetail extends WorldPlayerListItem {
  stats: WorldStatValue[];
  playerSkills: string[];
  aiStyles: string[];
  appearance: WorldAppearance | null;
  /** 取得元 */
  source: string;
  sourceUrl: string;
  fetchedAt: string | null;
  /** 紐付いた eFHUB 値との差異（data_conflicts）。自動上書きしない・参考表示のみ */
  efhubConflicts: WorldEfhubConflict[];
}

export interface WorldEfhubConflict {
  fieldName: string;
  efhubValue: string | null;
  worldValue: string | null;
}

/** 一覧クエリの入力（検証後） */
export interface WorldListQuery {
  page: number;
  pageSize: number;
  query: string;
  sort: WorldSortKey;
  position: string | null;
  cardType: string | null;
  playingStyle: string | null;
  playingStyleDefensive: string | null;
  minOvr: number | null;
  maxOvr: number | null;
  hasBooster: boolean | null;
}

/** 一覧クエリの結果 */
export interface WorldListResult {
  players: WorldPlayerListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  appliedFilters: Record<string, string | number | boolean>;
}

/** フィルタ UI 用の選択肢 */
export interface WorldFacets {
  positions: string[];
  cardTypes: string[];
  playingStyles: string[];
  playingStyleDefensives: string[];
}

/** データソースのメタ情報 */
export interface WorldSourceMeta {
  source: string;
  sourceUrl: string;
  totalCount: number;
  syncFinishedAt: string | null;
  syncStatus: string | null;
}
