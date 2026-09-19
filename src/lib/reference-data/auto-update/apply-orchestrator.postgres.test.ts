import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { applyUpdateJob, type QueryClient } from "./apply-orchestrator";
import { createPostgresQueryClient, buildTestOnlyPgConfigFromEnv, type MinimalPgClient } from "./postgres-adapter";
import { POSTGRES_STAGING_SCHEMA_DDL, POSTGRES_TEST_SCHEMA } from "./postgres-staging";
import { buildRollbackPlan, executeRollback } from "./rollback";
import { createPendingJob } from "./job";
import { computeDiffChecksum, type ApprovalArtifact } from "./approval";
import { generateUpdatePlan } from "./plan";
import { computeRecordChecksum } from "./diff";
import type { PreviousSnapshot, StagingDataset } from "./types";

/**
 * `applyUpdateJob`/`executeRollback`/`pg_try_advisory_xact_lock`を、実際のPostgreSQLへ
 * 対して実行する統合試験。
 *
 * **このファイルは通常の`npx vitest run`には含まれない**(`vitest.config.ts`で除外している)。
 * 実行するには、PostgreSQLへ接続可能な環境で明示的に次を実行すること:
 *   npx vitest run --config vitest.postgres.config.ts
 *
 * 接続先は`PHASE2_TEST_PG_*`環境変数(localhost限定、ホワイトリストDB名限定、
 * `postgres-adapter.ts`の`assertSafeTestConnectionTarget`で強制)だけから読む。
 * 実Supabase・実Productionへは一切接続しない。GitHub ActionsのPostgreSQL
 * service container(ジョブ限定、ジョブ終了後に破棄)での実行を想定している。
 */
const config = buildTestOnlyPgConfigFromEnv(process.env);

let adminClient: Client;

beforeAll(async () => {
  adminClient = new Client(config);
  await adminClient.connect();
  await adminClient.query(POSTGRES_STAGING_SCHEMA_DDL);
});

afterAll(async () => {
  // テストで作成した行だけを消す(schema自体は次回実行のために残してもよいが、
  // クリーンな状態で終わるためテーブル内容を空にする)。
  await adminClient.query(`truncate table
    ${POSTGRES_TEST_SCHEMA}.target_records,
    ${POSTGRES_TEST_SCHEMA}.applied_checksums,
    ${POSTGRES_TEST_SCHEMA}.audit_events,
    ${POSTGRES_TEST_SCHEMA}.rollback_jobs,
    ${POSTGRES_TEST_SCHEMA}.before_snapshots,
    ${POSTGRES_TEST_SCHEMA}.staging_records,
    ${POSTGRES_TEST_SCHEMA}.source_metadata_test
    cascade`);
  await adminClient.query(`truncate table ${POSTGRES_TEST_SCHEMA}.update_jobs cascade`);
  await adminClient.end();
});

beforeEach(async () => {
  await adminClient.query(`truncate table
    ${POSTGRES_TEST_SCHEMA}.target_records,
    ${POSTGRES_TEST_SCHEMA}.applied_checksums,
    ${POSTGRES_TEST_SCHEMA}.audit_events
    cascade`);
  await adminClient.query(`truncate table ${POSTGRES_TEST_SCHEMA}.update_jobs cascade`);
});

function buildScenario(jobId: string, datasetChecksum: string) {
  const staging: StagingDataset = {
    table: "world_player_cards",
    sourceMeta: {
      source: "efootball-world.com",
      sourceUrl: "https://efootball-world.com/x",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      httpStatus: 200,
      contentType: "application/json",
      contentLength: 10,
    },
    records: [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 80 } }],
  };
  const previous: PreviousSnapshot = {
    table: staging.table,
    records: [{ id: "wc-1", checksum: computeRecordChecksum({ nameEn: "A", ovrMax: 79 }) }],
  };
  const schemaConfig = { idPattern: /^wc-\d+$/, requiredFields: ["nameEn"], knownFields: ["nameEn", "ovrMax"] };
  const plan = generateUpdatePlan({
    staging,
    previous,
    schemaConfig,
    diffThresholds: { maxDecreaseRatio: 0.05, maxIncreaseRatio: 1, maxRemovedCount: 9999 },
  });
  const job = createPendingJob({
    jobId,
    table: staging.table,
    source: staging.sourceMeta.source,
    schemaVersion: "v1",
    datasetChecksum,
    previousChecksum: null,
    expectedTables: [staging.table],
    fetchedTables: [staging.table],
  });
  const approval: ApprovalArtifact = {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    diffChecksum: computeDiffChecksum(plan.diff),
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: `${jobId}-nonce`,
    expiresAt: "2099-01-01T00:00:00.000Z",
    expectedCounts: { added: plan.diff.addedCount, updated: plan.diff.updatedCount, removedCandidate: plan.diff.removedCount },
  };
  return { staging, plan, job, approval };
}

async function insertJobRow(client: Client, job: ReturnType<typeof buildScenario>["job"]) {
  await client.query(
    `insert into ${POSTGRES_TEST_SCHEMA}.update_jobs
     (job_id, table_name, source, schema_version, dataset_checksum, previous_checksum, status, expected_tables, fetched_tables)
     values ($1, $2, $3, $4, $5, $6, 'running', $7, $8)`,
    [job.jobId, job.table, job.source, job.schemaVersion, job.datasetChecksum, job.previousChecksum, JSON.stringify(job.expectedTables), JSON.stringify(job.fetchedTables)],
  );
}

describe("applyUpdateJob(実PostgreSQL、GitHub Actions service container)", () => {
  it("正常系: BEGIN/UPSERT/COMMITが実行され、実際にtarget_recordsへ反映される", async () => {
    const scenario = buildScenario("pg-job-1", "pg-checksum-1");
    await insertJobRow(adminClient, scenario.job);
    const client = createPostgresQueryClient(adminClient as unknown as MinimalPgClient);

    const result = await applyUpdateJob(client, {
      job: scenario.job,
      plan: scenario.plan,
      approval: scenario.approval,
      stagingRecords: scenario.staging.records,
      appliedChecksumHistory: new Set(),
      previousJobStatus: "idle",
      lockAcquired: true,
      now: new Date("2026-01-01T12:00:00.000Z"),
    });

    expect(result.decision).toBe("commit");
    const row = await adminClient.query(`select fields_json from ${POSTGRES_TEST_SCHEMA}.target_records where record_id = 'wc-1'`);
    expect(row.rows[0].fields_json).toEqual({ nameEn: "A", ovrMax: 80 });
    const jobRow = await adminClient.query(`select status from ${POSTGRES_TEST_SCHEMA}.update_jobs where job_id = $1`, [scenario.job.jobId]);
    expect(jobRow.rows[0].status).toBe("completed");
  });

  it("トランザクション途中の失敗はROLLBACKし、一部だけcommitされない(実PostgreSQLで確認)", async () => {
    const scenario = buildScenario("pg-job-2", "pg-checksum-2");
    await insertJobRow(adminClient, scenario.job);
    const realClient = createPostgresQueryClient(adminClient as unknown as MinimalPgClient);

    const flakyClient: QueryClient = {
      async query(sql, params) {
        if (/^select record_id/i.test(sql)) {
          throw new Error("synthetic mid-transaction failure (simulated read-back error)");
        }
        return realClient.query(sql, params);
      },
    };

    const result = await applyUpdateJob(flakyClient, {
      job: scenario.job,
      plan: scenario.plan,
      approval: scenario.approval,
      stagingRecords: scenario.staging.records,
      appliedChecksumHistory: new Set(),
      previousJobStatus: "idle",
      lockAcquired: true,
      now: new Date("2026-01-01T12:00:00.000Z"),
    });

    expect(result.decision).toBe("rollback");
    const row = await adminClient.query(`select 1 from ${POSTGRES_TEST_SCHEMA}.target_records where record_id = 'wc-1'`);
    expect(row.rows.length).toBe(0);
    const jobRow = await adminClient.query(`select status from ${POSTGRES_TEST_SCHEMA}.update_jobs where job_id = $1`, [scenario.job.jobId]);
    expect(jobRow.rows[0].status).toBe("running");
  });
});

describe("executeRollback(実PostgreSQL): 成功適用後の明示rollback", () => {
  it("新規追加行はrollbackで削除され、無関係な既存行は変更されない", async () => {
    const scenario = buildScenario("pg-job-3", "pg-checksum-3");
    await insertJobRow(adminClient, scenario.job);
    const client = createPostgresQueryClient(adminClient as unknown as MinimalPgClient);

    await adminClient.query(`insert into ${POSTGRES_TEST_SCHEMA}.target_records (record_id, fields_json) values ('wc-0', $1)`, [
      JSON.stringify({ nameEn: "Existing", ovrMax: 70 }),
    ]);

    const applyResult = await applyUpdateJob(client, {
      job: scenario.job,
      plan: scenario.plan,
      approval: scenario.approval,
      stagingRecords: scenario.staging.records,
      appliedChecksumHistory: new Set(),
      previousJobStatus: "idle",
      lockAcquired: true,
      now: new Date("2026-01-01T12:00:00.000Z"),
    });
    expect(applyResult.decision).toBe("commit");

    const rollbackPlan = buildRollbackPlan(scenario.job.jobId, [], ["wc-1"]);
    const rollbackResult = await executeRollback(client, rollbackPlan, new Date("2026-01-02T00:00:00.000Z"));

    expect(rollbackResult.ok).toBe(true);
    const wc1 = await adminClient.query(`select 1 from ${POSTGRES_TEST_SCHEMA}.target_records where record_id = 'wc-1'`);
    expect(wc1.rows.length).toBe(0);
    const wc0 = await adminClient.query(`select fields_json from ${POSTGRES_TEST_SCHEMA}.target_records where record_id = 'wc-0'`);
    expect(wc0.rows[0].fields_json).toEqual({ nameEn: "Existing", ovrMax: 70 });
    const jobRow = await adminClient.query(`select status from ${POSTGRES_TEST_SCHEMA}.update_jobs where job_id = $1`, [scenario.job.jobId]);
    expect(jobRow.rows[0].status).toBe("rolled_back");
    const applied = await adminClient.query(`select 1 from ${POSTGRES_TEST_SCHEMA}.applied_checksums where dataset_checksum = $1`, [scenario.job.datasetChecksum]);
    expect(applied.rows.length).toBe(0);
  });
});

describe("pg_try_advisory_xact_lock(実PostgreSQL、2つの独立connection)", () => {
  let connA: Client;
  let connB: Client;

  beforeAll(async () => {
    connA = new Client(config);
    connB = new Client(config);
    await connA.connect();
    await connB.connect();
  });

  afterAll(async () => {
    await connA.end();
    await connB.end();
  });

  it("同一keyへの取得は片方だけ成功し、待機せず即座にfalseが返る", async () => {
    const lockKey = 424242n;
    await connA.query("begin");
    const first = await connA.query("select pg_try_advisory_xact_lock($1) as locked", [lockKey]);
    expect(first.rows[0].locked).toBe(true);

    const second = await connB.query("select pg_try_advisory_xact_lock($1) as locked", [lockKey]);
    expect(second.rows[0].locked).toBe(false); // 別connectionでは即座に失敗(待機しない)

    await connA.query("commit"); // トランザクション終了で自動解放される
  });

  it("トランザクション終了(COMMIT)後は同一keyを再取得できる", async () => {
    const lockKey = 555555n;
    await connA.query("begin");
    await connA.query("select pg_try_advisory_xact_lock($1)", [lockKey]);
    await connA.query("commit");

    await connB.query("begin");
    const reacquired = await connB.query("select pg_try_advisory_xact_lock($1) as locked", [lockKey]);
    expect(reacquired.rows[0].locked).toBe(true);
    await connB.query("commit");
  });

  it("トランザクション終了(ROLLBACK)後も同一keyを再取得できる", async () => {
    const lockKey = 666666n;
    await connA.query("begin");
    await connA.query("select pg_try_advisory_xact_lock($1)", [lockKey]);
    await connA.query("rollback");

    await connB.query("begin");
    const reacquired = await connB.query("select pg_try_advisory_xact_lock($1) as locked", [lockKey]);
    expect(reacquired.rows[0].locked).toBe(true);
    await connB.query("rollback");
  });

  it("別keyは競合せず両方取得できる", async () => {
    await connA.query("begin");
    await connB.query("begin");
    const a = await connA.query("select pg_try_advisory_xact_lock($1) as locked", [777777n]);
    const b = await connB.query("select pg_try_advisory_xact_lock($1) as locked", [888888n]);
    expect(a.rows[0].locked).toBe(true);
    expect(b.rows[0].locked).toBe(true);
    await connA.query("commit");
    await connB.query("commit");
  });
});
