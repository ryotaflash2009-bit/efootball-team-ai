import { chunkRows, type GuardCheck } from "../real-import-guards";
import { POSTGRES_FINAL_TEST_SCHEMA, POSTGRES_FINAL_TABLES } from "./postgres-final-schema";
import { POSTGRES_TEST_SCHEMA } from "./postgres-staging";

/**
 * Phase 3(promotion検証): 隔離PostgreSQL専用のpromotion SQL組み立て(純関数、実行なし)。
 *
 * **Production用SQLではない。GitHub Actions PostgreSQL service container上の
 * `reference_data_ops_test`(staging)→`reference_data_test`(確定相当)という、
 * このセッション専用の隔離schemaだけを対象にする。**
 *
 * 設計上の制約(タスクの明示的要求どおり):
 *   - schema名・table名・column名は、すべてこのファイル内の固定定数からのみ選択する
 *     (呼び出し側の外部入力から動的にidentifierを組み立てない)。
 *   - `SELECT *`は使わない。列を必ず明示する。
 *   - 生成するSQLはパラメータ化(`$1,$2,...`)のみで、値をSQL文字列へ直接埋め込まない。
 *   - INSERT/UPDATE(UPSERT)以外の物理削除(DELETE/TRUNCATE)・DDL(DROP/ALTER)・
 *     権限変更(GRANT)・動的SQL(EXECUTE/DO)は一切生成しない。
 */

export const PROMOTION_STAGING_SCHEMA = POSTGRES_TEST_SCHEMA; // "reference_data_ops_test"
export const PROMOTION_FINAL_SCHEMA = POSTGRES_FINAL_TEST_SCHEMA; // "reference_data_test"

export interface PromotionTableSpec {
  /** reference_data_ops_test配下のstagingテーブル名(fields_jsonをそのまま保持)。 */
  sourceTable: string;
  /** reference_data_test配下の確定相当テーブル名(実カラム構造)。 */
  targetTable: string;
  /** 対象テーブルの主キー列(UPSERTのON CONFLICT対象)。 */
  primaryKey: string;
  /** 対象テーブルの全列(主キーを含む、fields_jsonから展開する順序と一致させる)。SELECT *禁止のため必ず明示する。 */
  columns: readonly string[];
  /** jsonb型の列(パラメータ化時にJSON.stringifyが必要。node-postgresはjsのobject/arrayを自動でjsonb化しない)。 */
  jsonbColumns: readonly string[];
}

/**
 * 1行分のfields(列名→値)を、`columns`の順序に沿ったパラメータ配列へ変換する。
 * jsonbColumnsに含まれる列はJSON.stringifyし、それ以外(text[]列を含む)はそのまま渡す
 * (text[]はnode-postgresがJS配列をPostgreSQL配列へ正しく変換するため、文字列化しない)。
 */
export function mapFieldsToParams(spec: PromotionTableSpec, fields: Readonly<Record<string, unknown>>, updatedAt: string): unknown[] {
  return spec.columns.map((col) => {
    if (col === "updated_at") return updatedAt;
    const value = fields[col];
    if (value !== null && value !== undefined && spec.jsonbColumns.includes(col)) {
      return JSON.stringify(value);
    }
    return value ?? null;
  });
}

/**
 * shadow comparison・checksum計算専用: 行を「比較可能な正規形」へ変換する(書込み時の
 * `mapFieldsToParams`とは別物、DBへは一切送らない)。
 *
 * 隔離PostgreSQL用の`createPostgresQueryClient`(`postgres-adapter.ts`)は、既存の
 * Phase 2(単一fields_json列)向けに、readback結果のうちnull/Date以外のobject値を
 * 一律JSON.stringifyする設計になっている。これはjsonb列(objectとして読み戻る)には
 * 正しく働くが、text[]列(node-postgresが配列として読み戻す値)も同じくJSON文字列化して
 * しまう。一方、書込み時の`mapFieldsToParams`はtext[]列をネイティブ配列のまま渡す
 * (PostgreSQLのtext[]パラメータとして正しく解釈させるため、JSON文字列化するとPR以前に
 * 実際に発生した"malformed array literal"障害を再発させる)。
 *
 * この非対称性(書込み時は配列のまま・実readback時はJSON文字列)を、比較専用のこの関数で
 * 吸収する: jsonb列・配列値の列はいずれも比較対象としてJSON.stringifyし、既に文字列に
 * なっている値(実readback経由)はそのまま扱う。合成fakeクライアント(常にネイティブ配列を
 * そのまま返す)と実PostgreSQL(配列をJSON文字列化して返す)の両方で、同じ入力データに対して
 * 同一の正規形になることを`promotion-sql.test.ts`で確認している。
 */
export function canonicalizeFieldsForComparison(
  spec: PromotionTableSpec,
  fields: Readonly<Record<string, unknown>>,
  updatedAtOverride?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of spec.columns) {
    if (col === "updated_at" && updatedAtOverride !== undefined) {
      out[col] = updatedAtOverride;
      continue;
    }
    const value = fields[col] ?? null;
    if (value === null || typeof value === "string") {
      out[col] = value;
      continue;
    }
    if (spec.jsonbColumns.includes(col) || Array.isArray(value)) {
      out[col] = JSON.stringify(value);
      continue;
    }
    out[col] = value;
  }
  return out;
}

/**
 * promotionが対象にできる唯一の3組(source→target)。この配列に無い組み合わせは
 * `checkAllowedPromotionPair`で拒否する。promotionOrderは外部キー依存の順(親→子)。
 */
export const PROMOTION_TABLE_SPECS: readonly PromotionTableSpec[] = [
  {
    sourceTable: "staging_world_player_cards",
    targetTable: "world_player_cards",
    primaryKey: "world_card_id",
    columns: [
      "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality", "region",
      "league", "team", "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style",
      "playing_style_def", "preferred_foot", "age", "height", "weight", "image_url", "mobile_image_url",
      "boost1", "boost2", "stats", "skills", "ai_styles", "appearance", "efhub_card_id", "efhub_conflicts",
      "name_sort_key", "source", "source_url", "fetched_at", "dataset_version", "updated_at",
    ],
    jsonbColumns: ["stats", "appearance", "efhub_conflicts"],
  },
  {
    sourceTable: "staging_managers",
    targetTable: "managers",
    primaryKey: "internal_manager_id",
    columns: [
      "internal_manager_id", "source", "source_manager_id", "name_en", "name_ja", "team_name", "nationality",
      "age", "released_at", "possession_game", "quick_counter", "long_ball_counter", "out_wide", "long_ball",
      "overload", "manager_rating", "coaching_affinity", "formation", "has_booster", "has_link_up_play",
      "booster_confirmation", "boosters", "link_up_plays", "name_sort_key", "source_url", "fetched_at",
      "dataset_version", "updated_at",
    ],
    jsonbColumns: ["boosters", "link_up_plays"],
  },
  {
    sourceTable: "staging_player_card_analysis",
    targetTable: "player_card_analysis",
    primaryKey: "world_card_id",
    columns: [
      "world_card_id", "weak_foot_usage", "weak_foot_accuracy", "form", "condition_value", "injury_resistance",
      "player_model", "positions", "com_skills", "player_skills", "efhub_name_en", "source", "source_url",
      "fetched_at", "dataset_version", "updated_at",
    ],
    jsonbColumns: ["player_model", "positions"],
  },
];

/** `world_player_cards`→`player_card_analysis`の外部キー依存を満たす昇格順(親を先に)。 */
export const PROMOTION_ORDER: readonly string[] = POSTGRES_FINAL_TABLES as unknown as readonly string[];

/** 対象のsource/targetテーブルが許可リストに存在する組み合わせであることを確認する。 */
export function checkAllowedPromotionPair(sourceTable: string, targetTable: string): GuardCheck {
  const found = PROMOTION_TABLE_SPECS.find((s) => s.sourceTable === sourceTable && s.targetTable === targetTable);
  if (!found) {
    return { ok: false, reason: `許可されていないpromotion対象の組み合わせ: ${sourceTable} -> ${targetTable}` };
  }
  return { ok: true };
}

/** promotion順序が期待順(親テーブル→子テーブル)と完全一致することを確認する。 */
export function checkPromotionOrderValid(order: readonly string[]): GuardCheck {
  const expected = PROMOTION_ORDER;
  if (order.length !== expected.length || order.some((t, i) => t !== expected[i])) {
    return { ok: false, reason: `promotion順序が期待値と一致しない(期待: ${expected.join(" -> ")}, 実際: ${order.join(" -> ")})` };
  }
  return { ok: true };
}

function getSpec(targetTable: string): PromotionTableSpec {
  const spec = PROMOTION_TABLE_SPECS.find((s) => s.targetTable === targetTable);
  if (!spec) throw new Error(`promotion-sql: 許可されていないtargetTable: ${targetTable}`);
  return spec;
}

/**
 * `INSERT ... ON CONFLICT (pk) DO UPDATE SET ...`形式のパラメータ化SQLを組み立てる。
 * 列名はすべて`PROMOTION_TABLE_SPECS`の固定定数から取得し、外部入力からは一切生成しない。
 */
export function buildPromotionUpsertSql(targetTable: string, rowCount: number): string {
  const spec = getSpec(targetTable);
  if (rowCount <= 0) throw new Error("buildPromotionUpsertSql: rowCountは1以上である必要がある");
  const qualified = `${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`;
  const valueRows: string[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const placeholders = spec.columns.map(() => "?");
    valueRows.push(`(${placeholders.join(", ")})`);
  }
  const updateSet = spec.columns
    .filter((c) => c !== spec.primaryKey)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return [
    `insert into ${qualified} (${spec.columns.join(", ")})`,
    `values ${valueRows.join(", ")}`,
    `on conflict (${spec.primaryKey}) do update set ${updateSet}`,
  ].join("\n");
}

/** 対象テーブルの全行を主キー・全列明示で読み戻すSQL(SELECT *は使わない)。 */
export function buildPromotionReadbackSql(targetTable: string): string {
  const spec = getSpec(targetTable);
  const qualified = `${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`;
  return `select ${spec.columns.join(", ")} from ${qualified} order by ${spec.primaryKey}`;
}

/** 指定した主キー集合だけを明示的に読み戻すSQL(before snapshot作成前の現状確認用)。 */
export function buildPromotionSelectByIdsSql(targetTable: string, idCount: number): string {
  const spec = getSpec(targetTable);
  const qualified = `${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`;
  const placeholders = Array.from({ length: idCount }, () => "?").join(", ");
  return `select ${spec.columns.join(", ")} from ${qualified} where ${spec.primaryKey} in (${placeholders})`;
}

/** 対象テーブルの現在行数を数えるSQL(row count確認用、SELECT *不使用)。 */
export function buildPromotionCountSql(targetTable: string): string {
  const spec = getSpec(targetTable);
  const qualified = `${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`;
  return `select count(*)::int as row_count from ${qualified}`;
}

/** source_metadataの更新SQL(確定テーブル側の「最新1件」を書き換える、物理削除なし)。 */
export function buildSourceMetadataUpsertSql(): string {
  const qualified = `${PROMOTION_FINAL_SCHEMA}.source_metadata`;
  return [
    `insert into ${qualified} (table_name, last_job_id, last_applied_at, source, schema_version)`,
    `values (?, ?, ?, ?, ?)`,
    `on conflict (table_name) do update set`,
    `  last_job_id = excluded.last_job_id,`,
    `  last_applied_at = excluded.last_applied_at,`,
    `  source = excluded.source,`,
    `  schema_version = excluded.schema_version`,
  ].join("\n");
}

/**
 * 主キー指定の明示DELETE(promotionのUPSERT経路には一切登場しない、rollback専用)。
 * このjobが新規追加した行だけをrollbackで削除するために使う(タスクの明示的許可事項)。
 * TRUNCATE・条件無しDELETEは一切生成しない。
 */
export function buildPromotionDeleteByIdSql(targetTable: string): string {
  const spec = getSpec(targetTable);
  const qualified = `${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`;
  return `delete from ${qualified} where ${spec.primaryKey} = ?`;
}

/** source_metadata行の明示DELETE(rollback専用、昇格前にその行が存在しなかった場合の復元用)。 */
export function buildSourceMetadataDeleteSql(): string {
  const qualified = `${PROMOTION_FINAL_SCHEMA}.source_metadata`;
  return `delete from ${qualified} where table_name = ?`;
}

/** source_metadataの現在行(確定テーブル側)を読み取るSQL(明示rollbackで復元するための事前保存用)。 */
export function buildSourceMetadataSelectSql(): string {
  const qualified = `${PROMOTION_FINAL_SCHEMA}.source_metadata`;
  return `select table_name, last_job_id, last_applied_at, source, schema_version from ${qualified} where table_name = ?`;
}

/** rowCountぶんのUPSERTパラメータへ分割する(1文あたりの行数上限、real-import-guards.tsのchunkRowsを再利用)。 */
export function chunkForPromotion<T>(rows: readonly T[], size: number): T[][] {
  return chunkRows(rows, size);
}

export function getPromotionTableSpec(targetTable: string): PromotionTableSpec {
  return getSpec(targetTable);
}
