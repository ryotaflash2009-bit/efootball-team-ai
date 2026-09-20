import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { executePromotion, type PromotionExecutionInput } from "./promotion-orchestrator";
import { executePromotionRollback, type PromotionRollbackApproval } from "./promotion-rollback";
import { createPostgresQueryClient, buildTestOnlyPgConfigFromEnv, type MinimalPgClient } from "./postgres-adapter";
import { POSTGRES_STAGING_SCHEMA_DDL, POSTGRES_TEST_SCHEMA } from "./postgres-staging";
import { POSTGRES_FINAL_SCHEMA_DDL, POSTGRES_FINAL_TEST_SCHEMA } from "./postgres-final-schema";
import { runGuardedCleanup } from "./postgres-test-lifecycle";
import { buildPromotionPlan } from "./promotion";
import { getPromotionTableSpec, mapFieldsToParams, canonicalizeFieldsForComparison } from "./promotion-sql";
import { createPendingJob } from "./job";
import { computeDiffChecksum, type ApprovalArtifact } from "./approval";
import { computeDiff, computeRecordChecksum } from "./diff";
import type { PreviousSnapshot, SourceMeta, StagingRecord } from "./types";
import type { QueryClient } from "./apply-orchestrator";

/**
 * `executePromotion`/`executePromotionRollback`/`pg_try_advisory_xact_lock`を、実際の
 * PostgreSQLへ対して実行する統合試験(Phase 3: promotion検証)。
 *
 * **このファイルは通常の`npx vitest run`には含まれない**(`vitest.config.ts`で
 * `**\/*.postgres.test.ts`を除外している)。実行するには、PostgreSQLへ接続可能な環境で
 * 明示的に次を実行すること:
 *   npx vitest run --config vitest.postgres.config.ts
 *
 * 接続先は`PHASE2_TEST_PG_*`環境変数(localhost限定、ホワイトリストDB名限定、
 * `postgres-adapter.ts`の`assertSafeTestConnectionTarget`で強制)だけから読む。
 * 実Supabase・実Production reference_data/reference_data_opsへは一切接続しない。
 * 対象は`reference_data_ops_test`(staging)・`reference_data_test`(確定相当)という
 * このセッション専用の隔離schemaのみ。GitHub ActionsのPostgreSQL service container
 * (ジョブ限定、ジョブ終了後に破棄)での実行を想定している。
 *
 * このセッションではローカルWindows環境にPostgreSQLが存在しないため、このファイルは
 * ローカルでは一度も実行できていない(GitHub Actions上での実行結果は別途確認が必要)。
 */
const config = buildTestOnlyPgConfigFromEnv(process.env);

let adminClient: Client;
/** adminClient.connect()が成功したか。beforeAll途中失敗時、afterAllが未接続clientをend()しないためのガード。 */
let adminClientConnected = false;
/** staging schema(reference_data_ops_test)のDDLが成功したか。beforeAll途中失敗時、afterAll/beforeEachが存在しないschemaへ触れないためのガード。 */
let stagingSchemaReady = false;
/** final schema(reference_data_test)のDDLが成功したか。同上。 */
let finalSchemaReady = false;

beforeAll(async () => {
  adminClient = new Client(config);
  await adminClient.connect();
  adminClientConnected = true;
  await adminClient.query(POSTGRES_STAGING_SCHEMA_DDL);
  stagingSchemaReady = true;
  await adminClient.query(POSTGRES_FINAL_SCHEMA_DDL);
  finalSchemaReady = true;
});

/**
 * 存在確認済みのschemaだけをtruncateする(`runGuardedCleanup`、`postgres-test-lifecycle.test.ts`で
 * 検証済み)。beforeAllが途中失敗した場合(例: 複数の*.postgres.test.tsファイル間での
 * CREATE SCHEMA競合、23505)、まだ作成されていないschemaへのtruncateを試みて二次エラー
 * (3F000)を発生させ、本来のsetupエラーを覆い隠すことを防ぐ。
 */
async function cleanupSchemas(): Promise<void> {
  if (!adminClientConnected) return;
  await runGuardedCleanup([
    {
      ready: finalSchemaReady,
      run: () =>
        adminClient.query(`truncate table
      ${POSTGRES_FINAL_TEST_SCHEMA}.player_card_analysis,
      ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards,
      ${POSTGRES_FINAL_TEST_SCHEMA}.managers,
      ${POSTGRES_FINAL_TEST_SCHEMA}.source_metadata
      cascade`).then(() => undefined),
    },
    {
      ready: stagingSchemaReady,
      run: async () => {
        await adminClient.query(`truncate table
      ${POSTGRES_TEST_SCHEMA}.promotion_before_snapshots,
      ${POSTGRES_TEST_SCHEMA}.promotion_source_metadata_before,
      ${POSTGRES_TEST_SCHEMA}.applied_checksums,
      ${POSTGRES_TEST_SCHEMA}.audit_events,
      ${POSTGRES_TEST_SCHEMA}.rollback_jobs,
      ${POSTGRES_TEST_SCHEMA}.source_metadata_test
      cascade`);
        await adminClient.query(`truncate table ${POSTGRES_TEST_SCHEMA}.update_jobs cascade`);
      },
    },
  ]);
}

afterAll(async () => {
  await cleanupSchemas();
  if (adminClientConnected) {
    await adminClient.end();
  }
});

beforeEach(async () => {
  await cleanupSchemas();
});

const sourceMeta: SourceMeta = {
  source: "efootball-world.com",
  sourceUrl: "https://efootball-world.com/x",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  httpStatus: 200,
  contentType: "application/json",
  contentLength: 10,
};

function wc(id: string, nameEn: string, ovrMax: number): StagingRecord {
  const spec = getPromotionTableSpec("world_player_cards");
  const fields: Record<string, unknown> = {};
  for (const col of spec.columns) fields[col] = null;
  Object.assign(fields, {
    world_card_id: id,
    name_en: nameEn,
    ovr_max: ovrMax,
    stats: { offensiveAwareness: 80 },
    skills: ["Long Range Drive"],
    ai_styles: [],
    efhub_conflicts: [],
    source: "efootball-world.com",
    fetched_at: "2026-01-01T00:00:00.000Z",
    dataset_version: "v1",
  });
  delete fields.updated_at;
  return { id, fields };
}

/** 実際のINSERT/UPDATEパラメータの形(text[]列はネイティブ配列のまま)。書込み専用。 */
function normalizeForWrite(targetTable: string, record: StagingRecord, nowIso: string): StagingRecord {
  const spec = getPromotionTableSpec(targetTable);
  const params = mapFieldsToParams(spec, record.fields, nowIso);
  const fields: Record<string, unknown> = {};
  spec.columns.forEach((col, idx) => {
    fields[col] = params[idx];
  });
  return { id: record.id, fields };
}

/**
 * shadow comparison/checksum比較専用の正規形(jsonb列・配列列はいずれもJSON文字列化)。
 * orchestrator内部の`canonicalizeFieldsForComparison`と完全に同じ変換を適用し、
 * PromotionPlanのbeforeChecksum/expectedAfterChecksumを、orchestratorが実PostgreSQL
 * readback(text[]列もJSON文字列化する既存adapterの仕様)に対して独自に計算する値と
 * 一致させる。書込み専用の`normalizeForWrite`とは別物。
 */
function normalizeForComparison(targetTable: string, record: StagingRecord, updatedAtOverride?: string): StagingRecord {
  const spec = getPromotionTableSpec(targetTable);
  return { id: record.id, fields: canonicalizeFieldsForComparison(spec, record.fields, updatedAtOverride) };
}

/**
 * `existingBeforeRecords`(promotion対象外のwc-3/wc-4を含む)が実際にDBへ投入される際の
 * `updated_at`。seed時に`normalizeForWrite`/`seedWorldPlayerCard`へ渡すnowIsoと必ず同じ値を
 * 使うこと(そうしないと、promotionが触れない行のupdated_atについて、テスト側の期待値と
 * 実際の読み戻し結果が食い違い、shadow comparisonが偽陽性で失敗する)。
 */
const SEED_NOW_ISO = "2020-01-01T00:00:00.000Z";

async function insertJobRow(client: Client, jobId: string, table: string, datasetChecksum: string) {
  await client.query(
    `insert into ${POSTGRES_TEST_SCHEMA}.update_jobs
     (job_id, table_name, source, schema_version, dataset_checksum, previous_checksum, status, expected_tables, fetched_tables)
     values ($1, $2, $3, $4, $5, $6, 'running', $7, $8)`,
    [jobId, table, sourceMeta.source, "v1", datasetChecksum, null, JSON.stringify([table]), JSON.stringify([table])],
  );
}

async function seedWorldPlayerCard(client: Client, record: StagingRecord, nowIso: string) {
  const normalized = normalizeForWrite("world_player_cards", record, nowIso);
  const spec = getPromotionTableSpec("world_player_cards");
  const cols = spec.columns.join(", ");
  const placeholders = spec.columns.map((_, i) => `$${i + 1}`).join(", ");
  const values = spec.columns.map((c) => normalized.fields[c]);
  await client.query(
    `insert into ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards (${cols}) values (${placeholders})`,
    values,
  );
}

function buildScenario(jobId: string, datasetChecksum: string, nowIso: string) {
  const added = [wc("wc-2", "New Player", 75)];
  const updated = [wc("wc-1", "Updated Player", 81)];
  const unchangedIds = ["wc-3"];
  const removedCandidateIds = ["wc-4"];
  // 生のfixture値(未正規化)を保持する。SEED_NOW_ISOと同じupdated_atを明示することで、
  // 実際にseedWorldPlayerCardで書き込まれる値(updated_at=SEED_NOW_ISO)と一致させる
  // (promotionが触れないwc-3/wc-4は、shadow comparison時もこの値のままである必要がある)。
  const existingBeforeRecords: StagingRecord[] = [
    { id: "wc-1", fields: { ...wc("wc-1", "Old Player", 79).fields, updated_at: SEED_NOW_ISO } },
    { id: "wc-3", fields: { ...wc("wc-3", "Unchanged Player", 70).fields, updated_at: SEED_NOW_ISO } },
    { id: "wc-4", fields: { ...wc("wc-4", "Removed Candidate", 60).fields, updated_at: SEED_NOW_ISO } },
  ];

  const previous: PreviousSnapshot = {
    table: "world_player_cards",
    records: existingBeforeRecords.map((r) => ({ id: r.id, checksum: computeRecordChecksum(r.fields) })),
  };
  const candidateRecords = [...added, ...updated, ...unchangedIds.map((id) => existingBeforeRecords.find((r) => r.id === id)!)];
  const diff = computeDiff(previous, candidateRecords);

  const job = createPendingJob({
    jobId,
    table: "world_player_cards",
    source: sourceMeta.source,
    schemaVersion: "v1",
    datasetChecksum,
    previousChecksum: null,
    expectedTables: ["world_player_cards"],
    fetchedTables: ["world_player_cards"],
  });

  const approval: ApprovalArtifact = {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    diffChecksum: computeDiffChecksum(diff),
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: `${jobId}-nonce`,
    expiresAt: "2099-01-01T00:00:00.000Z",
    expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, removedCandidate: diff.removedCount },
  };

  const beforeRecordsForPlan = existingBeforeRecords
    .filter((r) => updated.map((u) => u.id).includes(r.id))
    .map((r) => normalizeForComparison("world_player_cards", r));
  const expectedAfterRecords = [
    ...added.map((r) => normalizeForComparison("world_player_cards", r, nowIso)),
    ...updated.map((r) => normalizeForComparison("world_player_cards", r, nowIso)),
    ...unchangedIds.map((id) => normalizeForComparison("world_player_cards", existingBeforeRecords.find((r) => r.id === id)!)),
    ...removedCandidateIds.map((id) => normalizeForComparison("world_player_cards", existingBeforeRecords.find((r) => r.id === id)!)),
  ];

  const plan = buildPromotionPlan({
    jobId,
    schemaVersion: "v1",
    sourceIdentifier: sourceMeta.source,
    sourceTable: "staging_world_player_cards",
    targetTable: "world_player_cards",
    datasetChecksum,
    diffChecksum: approval.diffChecksum,
    beforeRecords: beforeRecordsForPlan,
    expectedAfterRecords,
    expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, unchanged: diff.unchangedCount, removedCandidate: diff.removedCount },
    approval,
    generatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  const input: PromotionExecutionInput = {
    job,
    plan,
    approval,
    diff,
    diffThresholds: { maxDecreaseRatio: 0.5, maxIncreaseRatio: 1, maxRemovedCount: 999 },
    added,
    updated,
    unchangedIds,
    removedCandidateIds,
    existingBeforeRecords,
    expectedBeforeRowCount: existingBeforeRecords.length,
    currentStagingChecksum: datasetChecksum,
    previousJobStatus: "idle",
    appliedChecksumHistory: new Set(),
    maxRemovedCandidateCount: 999,
    bypassFlagsDetected: [],
    sourceMeta,
    now: new Date(nowIso),
  };

  return { job, plan, approval, input, existingBeforeRecords };
}

describe("executePromotion(実PostgreSQL、GitHub Actions service container)", () => {
  it("正常系: added/updated/unchanged/removedCandidateを含む昇格がcommitし、実際に反映される", async () => {
    const nowIso = "2026-01-01T12:00:00.000Z";
    const scenario = buildScenario("pg-promo-1", "pg-promo-checksum-1", nowIso);
    await insertJobRow(adminClient, scenario.job.jobId, "world_player_cards", scenario.job.datasetChecksum);
    for (const r of scenario.existingBeforeRecords) {
      await seedWorldPlayerCard(adminClient, r, SEED_NOW_ISO);
    }
    const client = createPostgresQueryClient(adminClient as unknown as MinimalPgClient);

    const result = await executePromotion(client, scenario.input);
    // result.reasonsはsanitizeErrorMessage済み(接続情報・SQL全文・parameter値を含まない)。
    // decisionがrollbackの場合、CIログだけから原因が分かるようassertion messageへ含める。
    expect(result.decision, `executePromotion rollback reasons: ${JSON.stringify(result.reasons)}`).toBe("commit");
    expect(result.addedCount).toBe(1);
    expect(result.updatedCount).toBe(1);

    const added = await adminClient.query(
      `select name_en from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-2'`,
    );
    expect(added.rows[0].name_en).toBe("New Player");
    const updated = await adminClient.query(
      `select name_en from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-1'`,
    );
    expect(updated.rows[0].name_en).toBe("Updated Player");
    const removedCandidate = await adminClient.query(
      `select name_en from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-4'`,
    );
    expect(removedCandidate.rows[0].name_en).toBe("Removed Candidate"); // 物理削除されていない

    const jobRow = await adminClient.query(`select status from ${POSTGRES_TEST_SCHEMA}.update_jobs where job_id = $1`, [scenario.job.jobId]);
    expect(jobRow.rows[0].status).toBe("completed");
  });

  it("トランザクション途中の失敗はROLLBACKし、一部だけcommitされない(実PostgreSQLで確認)", async () => {
    const nowIso = "2026-01-01T12:00:00.000Z";
    const scenario = buildScenario("pg-promo-2", "pg-promo-checksum-2", nowIso);
    await insertJobRow(adminClient, scenario.job.jobId, "world_player_cards", scenario.job.datasetChecksum);
    for (const r of scenario.existingBeforeRecords) {
      await seedWorldPlayerCard(adminClient, r, SEED_NOW_ISO);
    }
    const realClient = createPostgresQueryClient(adminClient as unknown as MinimalPgClient);

    const flakyClient: QueryClient = {
      async query(sql, params) {
        if (/^insert into promotion_before_snapshots/i.test(sql.trim())) {
          throw new Error("synthetic mid-transaction failure (simulated snapshot write error)");
        }
        return realClient.query(sql, params);
      },
    };

    const result = await executePromotion(flakyClient, scenario.input);
    expect(result.decision).toBe("rollback");

    const added = await adminClient.query(`select 1 from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-2'`);
    expect(added.rows.length).toBe(0);
    const updated = await adminClient.query(
      `select name_en from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-1'`,
    );
    expect(updated.rows[0].name_en).toBe("Old Player"); // updateも巻き戻っている
    const jobRow = await adminClient.query(`select status from ${POSTGRES_TEST_SCHEMA}.update_jobs where job_id = $1`, [scenario.job.jobId]);
    expect(jobRow.rows[0].status).toBe("running"); // completedへは進んでいない
  });
});

describe("executePromotionRollback(実PostgreSQL): 成功したpromotion後の明示rollback", () => {
  it("追加行は削除、更新行はbefore状態へ復元。unrelated rowは不変。二重rollbackは拒否", async () => {
    const nowIso = "2026-01-01T12:00:00.000Z";
    const scenario = buildScenario("pg-promo-3", "pg-promo-checksum-3", nowIso);
    await insertJobRow(adminClient, scenario.job.jobId, "world_player_cards", scenario.job.datasetChecksum);
    for (const r of scenario.existingBeforeRecords) {
      await seedWorldPlayerCard(adminClient, r, SEED_NOW_ISO);
    }
    const client = createPostgresQueryClient(adminClient as unknown as MinimalPgClient);

    const applyResult = await executePromotion(client, scenario.input);
    expect(applyResult.decision, `executePromotion rollback reasons: ${JSON.stringify(applyResult.reasons)}`).toBe("commit");

    const completedJob = { ...scenario.job, status: "completed" as const };
    const rollbackApproval: PromotionRollbackApproval = {
      rollbackPlanId: scenario.plan.rollbackPlanId,
      targetJobId: scenario.job.jobId,
      appliedChecksum: scenario.job.datasetChecksum,
      approvedBy: "uesugi",
      nonce: "pg-rollback-nonce-1",
      approvedAt: "2026-01-02T00:00:00.000Z",
    };

    const rollbackResult = await executePromotionRollback(client, {
      approval: rollbackApproval,
      plan: scenario.plan,
      job: completedJob,
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(rollbackResult.ok).toBe(true);
    expect(rollbackResult.removedCount).toBe(1);
    expect(rollbackResult.restoredCount).toBe(1);

    const added = await adminClient.query(`select 1 from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-2'`);
    expect(added.rows.length).toBe(0);
    const updated = await adminClient.query(
      `select name_en, ovr_max from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-1'`,
    );
    expect(updated.rows[0].name_en).toBe("Old Player");
    expect(updated.rows[0].ovr_max).toBe(79);
    const unrelated = await adminClient.query(
      `select name_en from ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards where world_card_id = 'wc-3'`,
    );
    expect(unrelated.rows[0].name_en).toBe("Unchanged Player");

    const jobRow = await adminClient.query(`select status from ${POSTGRES_TEST_SCHEMA}.update_jobs where job_id = $1`, [scenario.job.jobId]);
    expect(jobRow.rows[0].status).toBe("rolled_back");

    // 二重rollback: DB側のunique indexでも拒否される
    const secondRollback = await executePromotionRollback(client, {
      approval: { ...rollbackApproval, nonce: "pg-rollback-nonce-2" },
      plan: scenario.plan,
      job: { ...completedJob, status: "rolled_back" },
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: true,
      now: new Date("2026-01-03T00:00:00.000Z"),
    });
    expect(secondRollback.ok).toBe(false);
  });
});
