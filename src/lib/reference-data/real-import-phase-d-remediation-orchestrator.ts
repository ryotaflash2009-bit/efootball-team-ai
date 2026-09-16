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
import { WORLD_CARD_ID_RE } from "../world/schemas";
import { MANAGER_ID_RE } from "../managers/schemas";

/**
 * Phase Dのシャドー比較で確認された2件の差分を修正するための、既存reference_data
 * テーブルへの追加列UPDATEを、単一トランザクションで実行するオーケストレーター。
 *
 * `real-import-orchestrator.ts`(初回投入、INSERT専用)・
 * `real-import-detail-extension-orchestrator.ts`(既存の不足フィールド追加、
 * 既に実行・COMMIT済み)のいずれとも別物。今回はさらに別の2種類の追加列を対象にする:
 *   1. world_player_cards.name_sort_key / managers.name_sort_key
 *      (SQLiteのCOLLATE NOCASEと同じ並び順を再現するための事前計算済みソートキー)
 *   2. player_card_analysis.efhub_name_en
 *      (レガシーeFHUB由来の分析表示専用名。world_player_cards.name_enとは別物として保持する)
 *
 * 既存の`real-import-detail-extension-orchestrator.ts`と同じ安全設計を踏襲する:
 *   - 対象3テーブルとも「既に想定件数(13,009/66/19)であること」を事前確認する
 *     (初回投入・detail-extension投入が未実施のまま、この修正だけを先行実行することを防ぐ)。
 *   - 新しい行を追加しない(INSERT/DELETEは一切発行しない)。既存行の追加列だけをUPDATEする。
 *   - 主キー列の型キャストは常に明示する(buildBulkUpdateSqlが強制する)。
 *   - 更新対象IDの形式を事前検証する(checkAllIdsValid)。
 */
export interface QueryResult {
  rows: Array<Record<string, unknown>>;
}

export interface QueryClient {
  query(sql: string, params?: readonly unknown[]): Promise<QueryResult>;
}

export interface WorldNameSortKeyRow {
  world_card_id: string;
  name_sort_key: string;
}

export interface ManagerNameSortKeyRow {
  internal_manager_id: number;
  name_sort_key: string;
}

export interface AnalysisNameRow {
  world_card_id: string;
  efhub_name_en: string;
}

export interface PhaseDRemediationInput {
  worldNameSortKeyUpdates: readonly WorldNameSortKeyRow[];
  managerNameSortKeyUpdates: readonly ManagerNameSortKeyRow[];
  analysisNameUpdates: readonly AnalysisNameRow[];
  worldBatchId: string;
  managerBatchId: string;
  analysisBatchId: string;
  datasetVersions: { world: string; managers: string; analysis: string };
  payloadHashes: { world: string; managers: string; analysis: string };
  chunkSize?: number;
  /** 事前確認する既存件数(既定: 実運用値13,009/66/19)。テストでは小規模フィクスチャの件数を渡す。 */
  expectedWorldCount?: number;
  expectedManagerCount?: number;
  expectedAnalysisCount?: number;
}

export interface PhaseDRemediationResult {
  decision: "commit" | "rollback";
  reasons: string[];
}

const WORLD_UPDATE_COLUMNS = ["name_sort_key"] as const;
const WORLD_UPDATE_CASTS = { world_card_id: "text", name_sort_key: "text" } as const;
const MANAGER_UPDATE_COLUMNS = ["name_sort_key"] as const;
const MANAGER_UPDATE_CASTS = { internal_manager_id: "integer", name_sort_key: "text" } as const;
const ANALYSIS_UPDATE_COLUMNS = ["efhub_name_en"] as const;
const ANALYSIS_UPDATE_CASTS = { world_card_id: "text", efhub_name_en: "text" } as const;

async function insertBatchPending(
  client: QueryClient,
  params: { batchId: string; datasetVersion: string; targetTable: string; source: string; sourceRowCount: number; payloadHash: string },
): Promise<void> {
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
      return allColumns.map((c) => r[c] ?? null);
    });
    await client.query(sql, params);
  }
}

export async function runPhaseDRemediationImport(client: QueryClient, input: PhaseDRemediationInput): Promise<PhaseDRemediationResult> {
  const chunkSize = input.chunkSize ?? 2000;
  const expectedWorldCount = input.expectedWorldCount ?? 13009;
  const expectedManagerCount = input.expectedManagerCount ?? 66;
  const expectedAnalysisCount = input.expectedAnalysisCount ?? 19;
  const checks: GuardCheck[] = [];

  await client.query("begin");
  try {
    // 1: 事前確認(既に想定件数であること。初回投入・detail-extension投入が未実施のまま
    // この修正だけを先行実行することを防ぐ)
    const worldCountBefore = await selectCount(client, "world_player_cards");
    const managerCountBefore = await selectCount(client, "managers");
    const analysisCountBefore = await selectCount(client, "player_card_analysis");
    checks.push(checkExactCounts({ world_player_cards: worldCountBefore }, { world_player_cards: expectedWorldCount }));
    checks.push(checkExactCounts({ managers: managerCountBefore }, { managers: expectedManagerCount }));
    checks.push(checkExactCounts({ player_card_analysis: analysisCountBefore }, { player_card_analysis: expectedAnalysisCount }));

    // 冪等性ガード(同一batch_id/dataset_versionの再実行を拒否)
    const existingBatchesResult = await client.query(`select batch_id, dataset_version from ${qualifiedTable("import_batches")}`);
    const existingBatchIds = new Set(existingBatchesResult.rows.map((r) => String(r.batch_id)));
    const existingDatasetVersions = new Set(existingBatchesResult.rows.map((r) => String(r.dataset_version)));
    checks.push(checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.worldBatchId, datasetVersion: input.datasetVersions.world }));
    checks.push(
      checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.managerBatchId, datasetVersion: input.datasetVersions.managers }),
    );
    checks.push(
      checkIdempotencyGuard(existingBatchIds, existingDatasetVersions, { batchId: input.analysisBatchId, datasetVersion: input.datasetVersions.analysis }),
    );

    // 更新対象IDの形式検証(不正なIDでのUPDATE実行を未然に防ぐ)
    checks.push(checkAllIdsValid(input.worldNameSortKeyUpdates.map((r) => r.world_card_id), WORLD_CARD_ID_RE, "world_card_id(world_player_cards)"));
    checks.push(
      checkAllIdsValid(input.managerNameSortKeyUpdates.map((r) => String(r.internal_manager_id)), MANAGER_ID_RE, "internal_manager_id(managers)"),
    );
    checks.push(checkAllIdsValid(input.analysisNameUpdates.map((r) => r.world_card_id), WORLD_CARD_ID_RE, "world_card_id(player_card_analysis)"));

    if (decideCommitOrRollback(checks).decision === "rollback") {
      const early = decideCommitOrRollback(checks);
      await client.query("rollback");
      return early;
    }

    // 2: world_player_cards.name_sort_key をUPDATE
    await insertBatchPending(client, {
      batchId: input.worldBatchId,
      datasetVersion: input.datasetVersions.world,
      targetTable: "world_player_cards",
      source: "src/lib/reference-data/name-sort-key.ts#computeNameSortKey(world_player_cards.name_en)",
      sourceRowCount: input.worldNameSortKeyUpdates.length,
      payloadHash: input.payloadHashes.world,
    });
    await updateRowsChunked(
      client,
      "world_player_cards",
      "world_card_id",
      WORLD_UPDATE_COLUMNS as unknown as string[],
      WORLD_UPDATE_CASTS,
      input.worldNameSortKeyUpdates,
      chunkSize,
    );
    const worldCountAfter = await selectCount(client, "world_player_cards");
    checks.push(checkExactCounts({ world_player_cards: worldCountAfter }, { world_player_cards: worldCountBefore }));
    const worldKeySetCount = await selectCount(client, "world_player_cards", "name_sort_key is not null");
    checks.push(
      checkExactCounts(
        { world_name_sort_key_set: worldKeySetCount },
        { world_name_sort_key_set: input.worldNameSortKeyUpdates.filter((r) => r.name_sort_key != null).length },
      ),
    );

    // 3: managers.name_sort_key をUPDATE
    await insertBatchPending(client, {
      batchId: input.managerBatchId,
      datasetVersion: input.datasetVersions.managers,
      targetTable: "managers",
      source: "src/lib/reference-data/name-sort-key.ts#computeNameSortKey(managers.name_en)",
      sourceRowCount: input.managerNameSortKeyUpdates.length,
      payloadHash: input.payloadHashes.managers,
    });
    await updateRowsChunked(
      client,
      "managers",
      "internal_manager_id",
      MANAGER_UPDATE_COLUMNS as unknown as string[],
      MANAGER_UPDATE_CASTS,
      input.managerNameSortKeyUpdates,
      chunkSize,
    );
    const managerCountAfter = await selectCount(client, "managers");
    checks.push(checkExactCounts({ managers: managerCountAfter }, { managers: managerCountBefore }));
    const managerKeySetCount = await selectCount(client, "managers", "name_sort_key is not null");
    checks.push(
      checkExactCounts(
        { manager_name_sort_key_set: managerKeySetCount },
        { manager_name_sort_key_set: input.managerNameSortKeyUpdates.filter((r) => r.name_sort_key != null).length },
      ),
    );

    // 4: player_card_analysis.efhub_name_en をUPDATE
    await insertBatchPending(client, {
      batchId: input.analysisBatchId,
      datasetVersion: input.datasetVersions.analysis,
      targetTable: "player_card_analysis",
      source: "data/efootball.db#player_cards.name_en",
      sourceRowCount: input.analysisNameUpdates.length,
      payloadHash: input.payloadHashes.analysis,
    });
    await updateRowsChunked(
      client,
      "player_card_analysis",
      "world_card_id",
      ANALYSIS_UPDATE_COLUMNS as unknown as string[],
      ANALYSIS_UPDATE_CASTS,
      input.analysisNameUpdates,
      chunkSize,
    );
    const analysisCountAfter = await selectCount(client, "player_card_analysis");
    checks.push(checkExactCounts({ player_card_analysis: analysisCountAfter }, { player_card_analysis: analysisCountBefore }));
    const analysisNameSetCount = await selectCount(client, "player_card_analysis", "efhub_name_en is not null");
    checks.push(
      checkExactCounts(
        { analysis_efhub_name_en_set: analysisNameSetCount },
        { analysis_efhub_name_en_set: input.analysisNameUpdates.filter((r) => r.efhub_name_en != null).length },
      ),
    );

    const finalDecision = decideCommitOrRollback(checks);
    if (finalDecision.decision === "commit") {
      await markBatchVerified(client, input.worldBatchId, input.worldNameSortKeyUpdates.length);
      await markBatchVerified(client, input.managerBatchId, input.managerNameSortKeyUpdates.length);
      await markBatchVerified(client, input.analysisBatchId, input.analysisNameUpdates.length);
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
