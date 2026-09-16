import {
  qualifiedTable,
  buildBulkUpdateSql,
  chunkRows,
  checkExactCounts,
  checkIdempotencyGuard,
  checkAllIdsValid,
  decideCommitOrRollback,
  type GuardCheck,
} from "./real-import-guards";
// 相対パスでimportする(素のnode実行では"@/"パスエイリアスが解決できないため。
// ts-extension-resolve-hook.mjsは相対import/絶対importだけを対象にしている)。
import { WORLD_CARD_ID_RE } from "../world/schemas";
import { MANAGER_ID_RE } from "../managers/schemas";

/**
 * 既存reference_dataテーブル(world_player_cards 13,009件・managers 66件)への
 * 詳細フィールド追加を、単一トランザクションでのUPDATEとして実行するオーケストレーター。
 *
 * 既存の`real-import-orchestrator.ts`(INSERT専用、初回投入=空テーブル前提)とは別物。
 * このオーケストレーターは:
 *   - 対象テーブルが「空であること」ではなく「既に想定件数(13,009/66)であること」を
 *     事前確認する(空テーブルなら中止する。既存の初回投入が未実施のまま
 *     この差分投入だけを誤って先に実行することを防ぐ)。
 *   - 新しい行を追加しない(INSERT/DELETEを一切発行しない)。既存行の追加列だけをUPDATEする。
 *   - `client`はテストダブルに差し替え可能な最小インターフェースのみ要求する
 *     (real-import-orchestrator.tsと同じ設計方針)。
 */
export interface QueryResult {
  rows: Array<Record<string, unknown>>;
}

export interface QueryClient {
  query(sql: string, params?: readonly unknown[]): Promise<QueryResult>;
}

export interface WorldDetailUpdateRow {
  world_card_id: string;
  efhub_card_id: string | null;
  ai_styles: readonly string[];
  appearance: unknown | null;
  efhub_conflicts: readonly unknown[];
}

export interface ManagerDetailUpdateRow {
  internal_manager_id: number;
  boosters: readonly unknown[];
  link_up_plays: readonly unknown[];
}

export interface DetailExtensionInput {
  worldUpdates: readonly WorldDetailUpdateRow[];
  managerUpdates: readonly ManagerDetailUpdateRow[];
  worldBatchId: string;
  managerBatchId: string;
  datasetVersions: { world: string; managers: string };
  payloadHashes: { world: string; managers: string };
  chunkSize?: number;
  /** 事前確認する既存件数(既定: 実運用値13,009/66)。テストでは小規模フィクスチャの件数を渡す。 */
  expectedWorldCount?: number;
  expectedManagerCount?: number;
}

export interface DetailExtensionResult {
  decision: "commit" | "rollback";
  reasons: string[];
}

const WORLD_UPDATE_COLUMNS = ["efhub_card_id", "ai_styles", "appearance", "efhub_conflicts"] as const;
// world_card_id(主キー)の"text"キャストも必須(buildBulkUpdateSqlが要求する)。
// world_player_cardsの主キーは元々textのため実害は無かったが、明示しないとPostgreSQLの
// 型推論(VALUES句をtext相当とみなす)に依存することになり、他テーブルでの実障害
// (managers.internal_manager_idがintegerなのにtext推論され"operator does not exist"で失敗)
// と同種のリスクを抱えたままになるため、ここでも明示する。
const WORLD_UPDATE_CASTS = {
  world_card_id: "text",
  efhub_card_id: "text",
  ai_styles: "text[]",
  appearance: "jsonb",
  efhub_conflicts: "jsonb",
} as const;
const MANAGER_UPDATE_COLUMNS = ["boosters", "link_up_plays"] as const;
// internal_manager_id(主キー)はPostgreSQL側でinteger型。この明示キャストが無かったために
// 実際に"operator does not exist: integer = text"でROLLBACKした(本orchestrator導入の直接原因)。
const MANAGER_UPDATE_CASTS = { internal_manager_id: "integer", boosters: "jsonb", link_up_plays: "jsonb" } as const;

function serializeForCast(value: unknown, cast: string): unknown {
  if (value === null || value === undefined) return null;
  if (cast === "jsonb") return JSON.stringify(value);
  return value; // text[]・textはそのままpgのシリアライズに任せる(既存オーケストレーターと同じ方針)
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

async function selectCount(client: QueryClient, table: string, where?: string): Promise<number> {
  const sql = `select count(*)::int as count from ${qualifiedTable(table)}${where ? ` where ${where}` : ""}`;
  const result = await client.query(sql);
  return Number(result.rows[0]?.count ?? 0);
}

async function updateRowsChunked<T extends object>(
  client: QueryClient,
  table: string,
  pkColumn: string,
  columns: readonly string[],
  casts: Readonly<Record<string, string>>,
  rows: readonly T[],
  chunkSize: number,
): Promise<void> {
  for (const chunk of chunkRows(rows, chunkSize)) {
    const sql = buildBulkUpdateSql(table, pkColumn, columns as string[], casts as never, chunk.length);
    const allColumns = [pkColumn, ...columns];
    const params = chunk.flatMap((row) => {
      const r = row as Record<string, unknown>;
      return allColumns.map((c) => serializeForCast(r[c], casts[c] ?? "none"));
    });
    await client.query(sql, params);
  }
}

export async function runDetailExtensionImport(client: QueryClient, input: DetailExtensionInput): Promise<DetailExtensionResult> {
  const chunkSize = input.chunkSize ?? 2000;
  const expectedWorldCount = input.expectedWorldCount ?? 13009;
  const expectedManagerCount = input.expectedManagerCount ?? 66;
  const checks: GuardCheck[] = [];

  await client.query("begin");
  try {
    // 1: 事前確認(初回投入とは逆に、「既に想定件数であること」を求める)
    const worldCountBefore = await selectCount(client, "world_player_cards");
    const managerCountBefore = await selectCount(client, "managers");
    checks.push(checkExactCounts({ world_player_cards: worldCountBefore }, { world_player_cards: expectedWorldCount }));
    checks.push(checkExactCounts({ managers: managerCountBefore }, { managers: expectedManagerCount }));

    // 冪等性ガード(同一batch_id/dataset_versionの再実行を拒否)
    const existingBatchesResult = await client.query(`select batch_id, dataset_version from ${qualifiedTable("import_batches")}`);
    const existingBatchIds = new Set(existingBatchesResult.rows.map((r) => String(r.batch_id)));
    const existingDatasetVersions = new Set(existingBatchesResult.rows.map((r) => String(r.dataset_version)));
    checks.push(checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.worldBatchId, datasetVersion: input.datasetVersions.world }));
    checks.push(checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.managerBatchId, datasetVersion: input.datasetVersions.managers }));

    // 更新対象IDの形式検証(不正なIDでのUPDATE実行を未然に防ぐ)。
    checks.push(checkAllIdsValid(input.worldUpdates.map((r) => r.world_card_id), WORLD_CARD_ID_RE, "world_card_id"));
    checks.push(checkAllIdsValid(input.managerUpdates.map((r) => String(r.internal_manager_id)), MANAGER_ID_RE, "internal_manager_id"));

    if (decideCommitOrRollback(checks).decision === "rollback") {
      const early = decideCommitOrRollback(checks);
      await client.query("rollback");
      return early;
    }

    // 2: world_player_cards の詳細列をUPDATE
    await insertBatchPending(client, {
      batchId: input.worldBatchId,
      datasetVersion: input.datasetVersions.world,
      targetTable: "world_player_cards",
      source: "data/efootball.db#source_record_links+world_player_ai_styles+world_player_appearances+data_conflicts",
      sourceRowCount: input.worldUpdates.length,
      payloadHash: input.payloadHashes.world,
    });
    await updateRowsChunked(client, "world_player_cards", "world_card_id", WORLD_UPDATE_COLUMNS as unknown as string[], WORLD_UPDATE_CASTS, input.worldUpdates, chunkSize);

    // 行数が変化していないこと(INSERT/DELETEが起きていないこと)を確認
    const worldCountAfter = await selectCount(client, "world_player_cards");
    checks.push(checkExactCounts({ world_player_cards: worldCountAfter }, { world_player_cards: worldCountBefore }));

    // 自己整合性確認: 「非null/非空を意図した行数」とDB側の実測が一致するか
    const expectedEfhubLinked = input.worldUpdates.filter((r) => r.efhub_card_id != null).length;
    const actualEfhubLinked = await selectCount(client, "world_player_cards", "efhub_card_id is not null");
    checks.push(checkExactCounts({ efhub_linked: actualEfhubLinked }, { efhub_linked: expectedEfhubLinked }));

    // 3: managers の詳細列をUPDATE
    await insertBatchPending(client, {
      batchId: input.managerBatchId,
      datasetVersion: input.datasetVersions.managers,
      targetTable: "managers",
      source: "data/efootball.db#manager_boosters+manager_link_up_plays+manager_link_up_conditions",
      sourceRowCount: input.managerUpdates.length,
      payloadHash: input.payloadHashes.managers,
    });
    await updateRowsChunked(client, "managers", "internal_manager_id", MANAGER_UPDATE_COLUMNS as unknown as string[], MANAGER_UPDATE_CASTS, input.managerUpdates, chunkSize);

    const managerCountAfter = await selectCount(client, "managers");
    checks.push(checkExactCounts({ managers: managerCountAfter }, { managers: managerCountBefore }));

    const expectedBoosted = input.managerUpdates.filter((r) => r.boosters.length > 0).length;
    const actualBoosted = await selectCount(client, "managers", "boosters <> '[]'::jsonb");
    checks.push(checkExactCounts({ boosted: actualBoosted }, { boosted: expectedBoosted }));

    const finalDecision = decideCommitOrRollback(checks);
    if (finalDecision.decision === "commit") {
      await markBatchVerified(client, input.worldBatchId, input.worldUpdates.length);
      await markBatchVerified(client, input.managerBatchId, input.managerUpdates.length);
      await client.query("commit");
    } else {
      await client.query("rollback");
    }
    return finalDecision;
  } catch (err) {
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
