import type { WorldListQuery, WorldSortKey } from "./types";

/**
 * SQL 断片の組み立て。ユーザー入力は必ずバインドパラメーター（?）で渡し、
 * 文字列連結しない。並べ替えは許可リスト経由でのみ ORDER BY に変換する。
 */

type SqlParam = string | number;

/** 一覧・詳細で共通に使う world_player_cards の列（camelCase へは mappers.ts で変換） */
export const CARD_COLUMNS = `
  c.world_card_id, c.name_en, c.name_ja, c.card_type, c.registered_position,
  c.nationality, c.region, c.league, c.team, c.ovr_base, c.ovr_max, c.maximum_level,
  c.card_rating, c.playing_style, c.playing_style_def, c.preferred_foot,
  c.age, c.height, c.weight, c.image_url, c.mobile_image_url, c.boost1, c.boost2,
  c.appearance_updated_at, c.source, c.source_url, c.fetched_at,
  le.source_card_id AS efhub_card_id
`.trim();

/**
 * world_player_cards c に、高信頼リンク先の eFHUB カード ID を LEFT JOIN する。
 * source_record_links: (source, source_card_id) が主キー、internal_card_id で両ソースを束ねる。
 */
export const CARD_FROM = `
  FROM world_player_cards c
  LEFT JOIN source_record_links lw
    ON lw.source = 'world' AND lw.source_card_id = c.world_card_id
  LEFT JOIN source_record_links le
    ON le.source = 'efhub' AND le.internal_card_id = lw.internal_card_id
`.trim();

/** LIKE 用のワイルドカードをエスケープ（ESCAPE '\\' と併用） */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** WorldListQuery → WHERE 句とパラメーター */
export function buildWhere(q: WorldListQuery): { sql: string; params: SqlParam[] } {
  const clauses: string[] = [];
  const params: SqlParam[] = [];

  if (q.query) {
    const like = `%${escapeLike(q.query.toLowerCase())}%`;
    // 部分一致（名前）または完全一致（World ID / eFHUB ID）
    clauses.push(
      `(LOWER(c.name_en) LIKE ? ESCAPE '\\' OR LOWER(c.name_ja) LIKE ? ESCAPE '\\' OR c.world_card_id = ? OR le.source_card_id = ?)`,
    );
    params.push(like, like, q.query, q.query);
  }
  if (q.position) {
    clauses.push("c.registered_position = ?");
    params.push(q.position);
  }
  if (q.cardType) {
    clauses.push("c.card_type = ?");
    params.push(q.cardType);
  }
  if (q.playingStyle) {
    clauses.push("c.playing_style = ?");
    params.push(q.playingStyle);
  }
  if (q.playingStyleDefensive) {
    clauses.push("c.playing_style_def = ?");
    params.push(q.playingStyleDefensive);
  }
  if (q.minOvr != null) {
    clauses.push("c.ovr_max >= ?");
    params.push(q.minOvr);
  }
  if (q.maxOvr != null) {
    clauses.push("c.ovr_max <= ?");
    params.push(q.maxOvr);
  }
  if (q.hasBooster === true) {
    clauses.push("(COALESCE(c.boost1, 0) <> 0 OR COALESCE(c.boost2, 0) <> 0)");
  } else if (q.hasBooster === false) {
    clauses.push("COALESCE(c.boost1, 0) = 0 AND COALESCE(c.boost2, 0) = 0");
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

/** 許可済み並べ替えキー → ORDER BY 句（固定文字列のみ。ユーザー入力を含めない） */
const ORDER_BY: Record<WorldSortKey, string> = {
  ovr_max_desc: "c.ovr_max DESC, c.ovr_base DESC, c.world_card_id ASC",
  ovr_max_asc: "c.ovr_max ASC, c.ovr_base ASC, c.world_card_id ASC",
  ovr_base_desc: "c.ovr_base DESC, c.ovr_max DESC, c.world_card_id ASC",
  ovr_base_asc: "c.ovr_base ASC, c.ovr_max ASC, c.world_card_id ASC",
  name: "c.name_en COLLATE NOCASE ASC, c.world_card_id ASC",
  updated_desc: "c.appearance_updated_at DESC, c.world_card_id ASC",
};

export function orderByClause(sort: WorldSortKey): string {
  return `ORDER BY ${ORDER_BY[sort] ?? ORDER_BY.ovr_max_desc}`;
}
