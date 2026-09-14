import {
  EXPECTED_COUNTS,
  qualifiedTable,
  buildUpsertSql,
  chunkRows,
  checkAllTablesEmpty,
  checkExactCounts,
  checkPrimaryKeySetMatches,
  checkIdempotencyGuard,
  decideCommitOrRollback,
  type GuardCheck,
} from "./real-import-guards";
import type { WorldPlayerCardPgRow, ManagerPgRow, PlayerCardAnalysisPgRow } from "./migration-transform";

/**
 * 実Supabaseへの単一トランザクションでの初回投入オーケストレーション。
 *
 * `client`は`pg.Client`と互換の最小インターフェース(`query(sql, params)`)だけを要求するため、
 * テストではテストダブル(スクリプト化されたモック)を渡してネットワーク接続なしに全ロジックを検証できる。
 * 実行時(`scripts/migration/pg-real-import.mjs`)は本物の`pg.Client`をそのまま渡す。
 */
export interface QueryResult {
  rows: Array<Record<string, unknown>>;
}

export interface QueryClient {
  query(sql: string, params?: readonly unknown[]): Promise<QueryResult>;
}

export interface RealImportInput {
  worldRows: readonly WorldPlayerCardPgRow[];
  managerRows: readonly ManagerPgRow[];
  analysisRows: readonly PlayerCardAnalysisPgRow[];
  worldBatchId: string;
  managersBatchId: string;
  analysisBatchId: string;
  datasetVersions: { world: string; managers: string; analysis: string };
  payloadHashes: { world: string; managers: string; analysis: string };
  chunkSize?: number;
  now?: Date;
  /** 期待件数。省略時は実運用の確定値(13,009/66/19)を使う。テストでは小規模フィクスチャの件数を渡す。 */
  expectedCounts?: { world_player_cards: number; managers: number; player_card_analysis: number };
}

export interface RealImportResult {
  decision: "commit" | "rollback";
  reasons: string[];
  counts: { world: number; managers: number; analysis: number };
}

/**
 * カラム名に対応するPostgreSQL側の型。
 * - "scalar": text/integer/boolean/timestamptz等。JSの値をそのままpgへ渡す
 *   (nullや配列でないプリミティブは、pgの標準シリアライズに任せてよい)。
 * - "jsonb": JSON値(オブジェクトでも配列でも)を格納する列。**必ず自前でJSON.stringifyする**。
 *   pgはネイティブ配列と区別できないため、jsonb列に渡すJS配列(例: positions)を
 *   自前でstringifyせずに渡すと、pgが誤って"{...}"形式のPostgres配列リテラルとして
 *   シリアライズしてしまい、jsonb列としては壊れた値になる。
 * - "array": text[]/integer[]等のネイティブPostgres配列列。**JS配列をそのまま渡す**
 *   (pgが自動的に正しい"{...}"配列リテラル形式へシリアライズする)。
 *   ここをJSON.stringifyしてしまうと、Postgresへは`["a","b"]`という
 *   JSON形式の**文字列1個**として渡ってしまい、text[]としては解釈できず
 *   "malformed array literal"エラーになる(実際に発生した不具合の原因)。
 */
type ColumnType = "scalar" | "jsonb" | "array";

const WORLD_COLUMNS = [
  "world_card_id",
  "name_en",
  "name_ja",
  "card_type",
  "registered_position",
  "nationality",
  "region",
  "league",
  "team",
  "ovr_base",
  "ovr_max",
  "maximum_level",
  "card_rating",
  "playing_style",
  "playing_style_def",
  "preferred_foot",
  "age",
  "height",
  "weight",
  "image_url",
  "mobile_image_url",
  "boost1",
  "boost2",
  "stats",
  "skills",
  "source",
  "source_url",
  "appearance_updated_at",
  "fetched_at",
  "dataset_version",
  "import_batch_id",
] as const;

const WORLD_COLUMN_TYPES: Partial<Record<(typeof WORLD_COLUMNS)[number], ColumnType>> = {
  stats: "jsonb",
  skills: "array",
};

const MANAGER_COLUMNS = [
  "internal_manager_id",
  "source",
  "source_manager_id",
  "name_en",
  "name_ja",
  "team_name",
  "nationality",
  "age",
  "released_at",
  "possession_game",
  "quick_counter",
  "long_ball_counter",
  "out_wide",
  "long_ball",
  "overload",
  "manager_rating",
  "coaching_affinity",
  "formation",
  "has_booster",
  "has_link_up_play",
  "booster_confirmation",
  "source_url",
  "fetched_at",
  "dataset_version",
  "import_batch_id",
] as const;

const MANAGER_COLUMN_TYPES: Partial<Record<(typeof MANAGER_COLUMNS)[number], ColumnType>> = {};

const ANALYSIS_COLUMNS = [
  "world_card_id",
  "weak_foot_usage",
  "weak_foot_accuracy",
  "form",
  "condition_value",
  "injury_resistance",
  "player_model",
  "positions",
  "com_skills",
  "player_skills",
  "source",
  "fetched_at",
  "dataset_version",
  "import_batch_id",
] as const;

const ANALYSIS_COLUMN_TYPES: Partial<Record<(typeof ANALYSIS_COLUMNS)[number], ColumnType>> = {
  player_model: "jsonb",
  // positionsはJSON配列(オブジェクトの配列)をjsonb列へ格納するため、必ずJSON.stringifyする。
  // com_skills/player_skillsはtext[]のネイティブ配列のため、JS配列のまま渡す。
  positions: "jsonb",
  com_skills: "array",
  player_skills: "array",
};

function serializeValueForColumn(value: unknown, columnType: ColumnType | undefined): unknown {
  if (value === null || value === undefined) return null;
  if (columnType === "jsonb") return JSON.stringify(value);
  // "array"はもちろん、型指定が無いスカラーもJS側の値をそのままpgへ渡す
  // (pgが数値・文字列・真偽値・JS配列それぞれを正しくシリアライズする)。
  return value;
}

function rowToParams<T>(row: T, columns: readonly string[], columnTypes: Partial<Record<string, ColumnType>>): unknown[] {
  const record = row as unknown as Record<string, unknown>;
  return columns.map((c) => serializeValueForColumn(record[c], columnTypes[c]));
}

async function insertBatchPending(client: QueryClient, params: {
  batchId: string;
  datasetVersion: string;
  targetTable: string;
  source: string;
  sourceRowCount: number;
  payloadHash: string;
}): Promise<void> {
  await client.query(
    `insert into ${qualifiedTable("import_batches")} (batch_id, dataset_version, target_table, source, source_row_count, payload_hash, status) values ($1, $2, $3, $4, $5, $6, 'pending')`,
    [params.batchId, params.datasetVersion, params.targetTable, params.source, params.sourceRowCount, params.payloadHash],
  );
}

async function markBatchVerified(client: QueryClient, batchId: string, insertedRowCount: number): Promise<void> {
  await client.query(
    `update ${qualifiedTable("import_batches")} set status = 'verified', verified_at = now(), inserted_row_count = $2 where batch_id = $1`,
    [batchId, insertedRowCount],
  );
}

async function insertRowsChunked<T>(
  client: QueryClient,
  table: string,
  columns: readonly string[],
  columnTypes: Partial<Record<string, ColumnType>>,
  conflictColumn: string,
  rows: readonly T[],
  chunkSize: number,
): Promise<void> {
  // サブバッチは意図的に直列実行する(同一client上でのquery並行実行はpgが非推奨としており、
  // 単一コネクションでは安全でもない。大量投入の性能最適化は正確性確認後の別タスクとする)。
  for (const chunk of chunkRows(rows, chunkSize)) {
    const sql = buildUpsertSql(table, columns as string[], chunk.length, conflictColumn);
    const params = chunk.flatMap((row) => rowToParams(row, columns, columnTypes));
    await client.query(sql, params);
  }
}

async function selectCount(client: QueryClient, table: string): Promise<number> {
  const result = await client.query(`select count(*)::int as count from ${qualifiedTable(table)}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function selectAllIds(client: QueryClient, table: string, idColumn: string): Promise<string[]> {
  const result = await client.query(`select ${idColumn} as id from ${qualifiedTable(table)}`);
  return result.rows.map((r) => String(r.id));
}

export async function runRealImport(client: QueryClient, input: RealImportInput): Promise<RealImportResult> {
  const chunkSize = input.chunkSize ?? 2000;
  const expectedCounts = input.expectedCounts ?? EXPECTED_COUNTS;
  const checks: GuardCheck[] = [];
  const counts = { world: 0, managers: 0, analysis: 0 };

  await client.query("begin");
  try {
    // 1〜2: 空テーブル再確認
    // 単一のclientに対してquery()を並行実行しない(pgが非推奨としている挙動であり、
    // 単一コネクションでは安全でもない)。順番にawaitする。
    const worldCount0 = await selectCount(client, "world_player_cards");
    const managersCount0 = await selectCount(client, "managers");
    const analysisCount0 = await selectCount(client, "player_card_analysis");
    const batchesCount0 = await selectCount(client, "import_batches");
    checks.push(
      checkAllTablesEmpty({
        world_player_cards: worldCount0,
        managers: managersCount0,
        player_card_analysis: analysisCount0,
        import_batches: batchesCount0,
      }),
    );

    // 冪等性ガード(既存batch_id/dataset_versionとの衝突確認)
    const existingBatchesResult = await client.query(`select batch_id, dataset_version from ${qualifiedTable("import_batches")}`);
    const existingBatchIds = new Set(existingBatchesResult.rows.map((r) => String(r.batch_id)));
    const existingDatasetVersions = new Set(existingBatchesResult.rows.map((r) => String(r.dataset_version)));
    checks.push(checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.worldBatchId, datasetVersion: input.datasetVersions.world }));
    checks.push(checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.managersBatchId, datasetVersion: input.datasetVersions.managers }));
    checks.push(checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.analysisBatchId, datasetVersion: input.datasetVersions.analysis }));

    if (decideCommitOrRollback(checks).decision === "rollback") {
      await client.query("rollback");
      return { ...decideCommitOrRollback(checks), counts };
    }

    // 3〜5: world_player_cards
    await insertBatchPending(client, {
      batchId: input.worldBatchId,
      datasetVersion: input.datasetVersions.world,
      targetTable: "world_player_cards",
      source: "data/efootball.db#world_player_cards",
      sourceRowCount: input.worldRows.length,
      payloadHash: input.payloadHashes.world,
    });
    await insertRowsChunked(client, "world_player_cards", WORLD_COLUMNS, WORLD_COLUMN_TYPES, "world_card_id", input.worldRows, chunkSize);
    counts.world = await selectCount(client, "world_player_cards");
    checks.push(checkExactCounts({ world_player_cards: counts.world }, { world_player_cards: expectedCounts.world_player_cards }));
    const worldIdsInDb = await selectAllIds(client, "world_player_cards", "world_card_id");
    checks.push(
      checkPrimaryKeySetMatches(
        worldIdsInDb,
        input.worldRows.map((r) => r.world_card_id),
        "world_player_cards",
      ),
    );

    // 6〜7: managers
    await insertBatchPending(client, {
      batchId: input.managersBatchId,
      datasetVersion: input.datasetVersions.managers,
      targetTable: "managers",
      source: "data/efootball.db#managers",
      sourceRowCount: input.managerRows.length,
      payloadHash: input.payloadHashes.managers,
    });
    await insertRowsChunked(client, "managers", MANAGER_COLUMNS, MANAGER_COLUMN_TYPES, "internal_manager_id", input.managerRows, chunkSize);
    counts.managers = await selectCount(client, "managers");
    checks.push(checkExactCounts({ managers: counts.managers }, { managers: expectedCounts.managers }));

    // 8: player_card_analysis(world_player_cardsへの外部キーがあるため必ず最後。
    // 孤立参照があればDB側のFK制約違反で例外が飛び、catchでROLLBACKされる)
    await insertBatchPending(client, {
      batchId: input.analysisBatchId,
      datasetVersion: input.datasetVersions.analysis,
      targetTable: "player_card_analysis",
      source: "data/efootball.db#player_cards",
      sourceRowCount: input.analysisRows.length,
      payloadHash: input.payloadHashes.analysis,
    });
    await insertRowsChunked(client, "player_card_analysis", ANALYSIS_COLUMNS, ANALYSIS_COLUMN_TYPES, "world_card_id", input.analysisRows, chunkSize);
    counts.analysis = await selectCount(client, "player_card_analysis");
    checks.push(checkExactCounts({ player_card_analysis: counts.analysis }, { player_card_analysis: expectedCounts.player_card_analysis }));

    // 9〜11: 最終集計判定
    const finalDecision = decideCommitOrRollback(checks);

    if (finalDecision.decision === "commit") {
      // 12: verifiedへ更新してからCOMMIT
      await markBatchVerified(client, input.worldBatchId, counts.world);
      await markBatchVerified(client, input.managersBatchId, counts.managers);
      await markBatchVerified(client, input.analysisBatchId, counts.analysis);
      await client.query("commit");
    } else {
      await client.query("rollback");
    }

    return { ...finalDecision, counts };
  } catch (err) {
    // ROLLBACK自体の失敗は元エラーと区別する(元エラーを握りつぶさない)。
    try {
      await client.query("rollback");
    } catch (rollbackErr) {
      const rollbackErrMessage = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      const originalErrMessage = err instanceof Error ? err.message : String(err);
      const combined = new Error(`ROLLBACKにも失敗した(元エラー: ${originalErrMessage} / ROLLBACKエラー: ${rollbackErrMessage})`);
      if (err instanceof Error) combined.cause = err;
      throw combined;
    }
    throw err;
  }
}
