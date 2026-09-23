/**
 * 自動更新 Phase E: dry run用の隔離schema DDLを、リポジトリ内の実DDLファイルの本文から組み立てる純関数。
 *
 * 対象はimport_batches・world_player_cards・managersの3 tableと、それらへのalter table文
 * (detail extension・name_sort_key extension)だけ。schema名は隔離用の命名規則に合うものだけを許可し、
 * Productionの`reference_data`・`public`・`auth`等へは絶対に向けない。
 * ファイルの読み込みは呼び出し側が行う(このmoduleはI/Oをしない)。
 */

export const ISOLATED_SCHEMA_NAME_RE = /^reference_data_([a-z0-9]+_)*(test|dry_run)$/;
const RESERVED_SCHEMAS = new Set(["reference_data", "reference_data_ops", "public", "auth", "storage", "extensions", "pg_catalog", "information_schema"]);
const DRY_RUN_TABLES = ["import_batches", "world_player_cards", "managers"] as const;

export function assertIsolatedSchemaName(schema: string): string {
  if (RESERVED_SCHEMAS.has(schema) || !ISOLATED_SCHEMA_NAME_RE.test(schema)) {
    throw new Error("隔離schema名ではない(reference_data_*_test / reference_data_*_dry_run だけ許可、blocked)");
  }
  return schema;
}

export interface RepositoryReferenceSql {
  /** docs/production-readiness/sql/create-reference-data-schema.sql */
  readonly base: string;
  /** docs/production-readiness/sql/extend-reference-data-detail-schema.sql */
  readonly detailExtension: string;
  /** docs/production-readiness/sql/extend-name-sort-key-schema.sql */
  readonly nameSortKeyExtension: string;
  /**
   * docs/production-readiness/sql/extend-player-card-analysis-name-schema.sql。
   * 指定した場合だけplayer_card_analysisも作る(Production metadataの照合検証用。dry run・applyでは使わない)。
   */
  readonly analysisNameExtension?: string;
}

export const REPOSITORY_REFERENCE_SQL_FILES = Object.freeze({
  base: "create-reference-data-schema.sql",
  detailExtension: "extend-reference-data-detail-schema.sql",
  nameSortKeyExtension: "extend-name-sort-key-schema.sql",
  analysisNameExtension: "extend-player-card-analysis-name-schema.sql",
} as const);

/** 隔離schemaを作るDDL(create schema + 3 table + alter table)。 */
export function buildIsolatedReferenceSchemaDdl(schema: string, sql: RepositoryReferenceSql): string {
  assertIsolatedSchemaName(schema);
  const statements: string[] = [`create schema ${schema};`];
  for (const t of DRY_RUN_TABLES) {
    const m = sql.base.match(new RegExp(`create table if not exists reference_data\\.${t} \\([\\s\\S]*?\\n\\);`));
    if (!m) throw new Error(`実DDLに${t}のcreate table文が見つからない(blocked)`);
    statements.push(m[0]);
  }
  const ext = `${sql.detailExtension}\n${sql.nameSortKeyExtension}`;
  let alters = 0;
  for (const m of ext.matchAll(/alter table reference_data\.(world_player_cards|managers)\b[\s\S]*?;/g)) {
    statements.push(m[0]);
    alters++;
  }
  if (alters === 0) throw new Error("実DDLのextension alter文が見つからない(blocked)");
  if (sql.analysisNameExtension !== undefined) {
    const m = sql.base.match(/create table if not exists reference_data\.player_card_analysis \([\s\S]*?\n\);/);
    const a = sql.analysisNameExtension.match(/alter table reference_data\.player_card_analysis\s+add column if not exists efhub_name_en text;/);
    if (!m || !a) throw new Error("実DDLにplayer_card_analysisの定義が見つからない(blocked)");
    statements.push(m[0], a[0]);
  }
  const ddl = statements.join("\n").replace(/reference_data\./g, `${schema}.`);
  if (/\b(grant|revoke|drop\s+table|truncate|delete\s+from|create\s+role|alter\s+role|policy)\b/i.test(ddl)) {
    throw new Error("隔離DDLに権限・削除系の文が含まれている(blocked)");
  }
  return ddl;
}
