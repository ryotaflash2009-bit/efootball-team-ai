import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyUpdateJob, type QueryClient } from "./apply-orchestrator";
import { createSqliteQueryClient } from "./sqlite-adapter";
import { SQLITE_STAGING_SCHEMA_DDL } from "./staging";
import { buildRollbackPlan, executeRollback } from "./rollback";
import { createPendingJob } from "./job";
import { computeDiffChecksum, type ApprovalArtifact } from "./approval";
import { generateUpdatePlan } from "./plan";
import { computeRecordChecksum } from "./diff";
import type { PreviousSnapshot, StagingDataset } from "./types";

/**
 * `applyUpdateJob`/`executeRollback`を、実際のローカル一時SQLiteファイル(node:sqlite、
 * ネイティブのBEGIN/COMMIT/ROLLBACKを持つ本物のトランザクションエンジン)に対して実行し、
 * 「一部だけcommitされることがない」「rollback後に元の状態へ正確に戻る」ことを実地で証明する。
 *
 * 実Supabase・実Postgres・実ネットワークへは一切接続しない(常にローカルの一時ファイルのみ)。
 * テスト終了後、一時ディレクトリごと削除する。
 */
let tmpDir: string;
let dbPath: string;
let db: DatabaseSync;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "efb-auto-update-phase2-"));
  dbPath = path.join(tmpDir, "phase2-test.sqlite");
  db = new DatabaseSync(dbPath);
  db.exec(SQLITE_STAGING_SCHEMA_DDL);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

function buildScenario() {
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
    jobId: "job-sqlite-1",
    table: staging.table,
    source: staging.sourceMeta.source,
    schemaVersion: "v1",
    datasetChecksum: "checksum-sqlite-1",
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
    nonce: "nonce-sqlite-1",
    expiresAt: "2026-01-02T00:00:00.000Z",
    expectedCounts: { added: plan.diff.addedCount, updated: plan.diff.updatedCount, removedCandidate: plan.diff.removedCount },
  };
  return { staging, plan, job, approval };
}

function insertJobRow(scenario: ReturnType<typeof buildScenario>) {
  db.prepare(
    `insert into update_jobs (job_id, table_name, source, schema_version, dataset_checksum, previous_checksum, status, expected_tables, fetched_tables)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    scenario.job.jobId,
    scenario.job.table,
    scenario.job.source,
    scenario.job.schemaVersion,
    scenario.job.datasetChecksum,
    scenario.job.previousChecksum,
    "running",
    JSON.stringify(scenario.job.expectedTables),
    JSON.stringify(scenario.job.fetchedTables),
  );
}

describe("applyUpdateJob(実SQLite、実トランザクション)", () => {
  it("正常系: BEGIN/UPSERT/COMMITが実行され、実際にtarget_recordsへ反映される", async () => {
    const scenario = buildScenario();
    insertJobRow(scenario);
    const client = createSqliteQueryClient(db);

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
    const row = db.prepare("select fields_json from target_records where record_id = ?").get("wc-1") as { fields_json: string } | undefined;
    expect(row && JSON.parse(row.fields_json)).toEqual({ nameEn: "A", ovrMax: 80 });
    const jobRow = db.prepare("select status from update_jobs where job_id = ?").get(scenario.job.jobId) as { status: string };
    expect(jobRow.status).toBe("completed");
    const appliedRow = db.prepare("select 1 from applied_checksums where dataset_checksum = ?").get(scenario.job.datasetChecksum);
    expect(appliedRow).toBeTruthy();
  });

  it("トランザクション途中の失敗はROLLBACKし、一部だけcommitされない(実DBで確認)", async () => {
    const scenario = buildScenario();
    insertJobRow(scenario);
    const realClient = createSqliteQueryClient(db);

    let insertCount = 0;
    const flakyClient: QueryClient = {
      async query(sql, params) {
        if (/^insert into target_records/i.test(sql)) {
          insertCount += 1;
          if (insertCount === 1) {
            // 1件目のINSERT自体は実行するが、その直後に呼ばれるSELECT(読み戻し)で
            // 意図的に失敗させ、コミット前に例外を発生させる(実際の障害を模した合成テスト)。
            await realClient.query(sql, params);
            return { rows: [] };
          }
        }
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
    // 実DBを直接見て、INSERTした行が残っていないことを確認する(トランザクション全体がROLLBACKされた証拠)。
    const row = db.prepare("select 1 from target_records where record_id = ?").get("wc-1");
    expect(row).toBeUndefined();
    const jobRow = db.prepare("select status from update_jobs where job_id = ?").get(scenario.job.jobId) as { status: string };
    expect(jobRow.status).toBe("running"); // completedへ更新されていない(一部だけcommitされていない)
    const appliedRow = db.prepare("select 1 from applied_checksums where dataset_checksum = ?").get(scenario.job.datasetChecksum);
    expect(appliedRow).toBeUndefined();
  });

  it("事前ゲート失敗(承認なし相当)ではBEGINにすら到達せず、DBは一切変更されない", async () => {
    const scenario = buildScenario();
    insertJobRow(scenario);
    const client = createSqliteQueryClient(db);
    const badApproval = { ...scenario.approval, nonce: "" };

    const result = await applyUpdateJob(client, {
      job: scenario.job,
      plan: scenario.plan,
      approval: badApproval,
      stagingRecords: scenario.staging.records,
      appliedChecksumHistory: new Set(),
      previousJobStatus: "idle",
      lockAcquired: true,
      now: new Date("2026-01-01T12:00:00.000Z"),
    });

    expect(result.decision).toBe("rollback");
    const row = db.prepare("select 1 from target_records where record_id = ?").get("wc-1");
    expect(row).toBeUndefined();
  });
});

describe("executeRollback(実SQLite): 成功適用後の明示rollbackで元状態へ戻る", () => {
  it("適用前に存在しなかった行はrollbackで削除され、既存行は元の値へ復元される", async () => {
    const scenario = buildScenario();
    insertJobRow(scenario);
    const client = createSqliteQueryClient(db);

    // 適用前の状態: wc-0という既存行があり、今回wc-1が新規追加されるシナリオ。
    db.prepare("insert into target_records (record_id, fields_json) values (?, ?)").run(
      "wc-0",
      JSON.stringify({ nameEn: "Existing", ovrMax: 70 }),
    );

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

    // 適用後、wc-0(既存)・wc-1(新規)の両方が存在することを確認。
    expect(db.prepare("select 1 from target_records where record_id = 'wc-0'").get()).toBeTruthy();
    expect(db.prepare("select 1 from target_records where record_id = 'wc-1'").get()).toBeTruthy();

    // 明示rollback: wc-1は新規追加だったので削除、beforeSnapshotは空(wc-1は元々存在しなかった)。
    const rollbackPlan = buildRollbackPlan(scenario.job.jobId, [], ["wc-1"]);
    const rollbackResult = await executeRollback(client, rollbackPlan, new Date("2026-01-02T00:00:00.000Z"));

    expect(rollbackResult.ok).toBe(true);
    expect(db.prepare("select 1 from target_records where record_id = 'wc-1'").get()).toBeUndefined();
    // wc-0(このジョブと無関係の既存行)はrollbackの影響を受けない。
    const wc0 = db.prepare("select fields_json from target_records where record_id = 'wc-0'").get() as { fields_json: string };
    expect(JSON.parse(wc0.fields_json)).toEqual({ nameEn: "Existing", ovrMax: 70 });

    const jobRow = db.prepare("select status from update_jobs where job_id = ?").get(scenario.job.jobId) as { status: string };
    expect(jobRow.status).toBe("rolled_back");
    const appliedRow = db.prepare("select 1 from applied_checksums where dataset_checksum = ?").get(scenario.job.datasetChecksum);
    expect(appliedRow).toBeUndefined();
  });

  it("更新された既存行はrollbackでbefore-snapshotの値へ正確に復元される", async () => {
    const scenario = buildScenario();
    insertJobRow(scenario);
    const client = createSqliteQueryClient(db);

    // 適用前: wc-1が既にovrMax=79で存在(このジョブが80へ更新する対象)。
    db.prepare("insert into target_records (record_id, fields_json) values (?, ?)").run(
      "wc-1",
      JSON.stringify({ nameEn: "A", ovrMax: 79 }),
    );

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
    const afterApply = db.prepare("select fields_json from target_records where record_id = 'wc-1'").get() as { fields_json: string };
    expect(JSON.parse(afterApply.fields_json)).toEqual({ nameEn: "A", ovrMax: 80 });

    // 明示rollback: beforeSnapshotに元の値(ovrMax:79)を渡す。新規追加はないのでaddedIdsは空。
    const rollbackPlan = buildRollbackPlan(scenario.job.jobId, [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 79 } }], []);
    const rollbackResult = await executeRollback(client, rollbackPlan, new Date("2026-01-02T00:00:00.000Z"));

    expect(rollbackResult.ok).toBe(true);
    const afterRollback = db.prepare("select fields_json from target_records where record_id = 'wc-1'").get() as { fields_json: string };
    expect(JSON.parse(afterRollback.fields_json)).toEqual({ nameEn: "A", ovrMax: 79 });
  });
});

describe("advisory lockの合成SQLite実証(Production設計: pg_try_advisory_xact_lockのローカル模擬)", () => {
  it("未取得のlockは取得でき、取得済みのlockへの二重取得は失敗する", () => {
    db.prepare("insert into advisory_locks (lock_key, locked_by, locked_at) values (?, null, null)").run("reference_data_update");

    const acquire = (holder: string) =>
      db
        .prepare("update advisory_locks set locked_by = ?, locked_at = ? where lock_key = ? and locked_by is null")
        .run(holder, "2026-01-01T00:00:00.000Z", "reference_data_update");

    const first = acquire("job-a");
    expect(first.changes).toBe(1); // 取得成功

    const second = acquire("job-b");
    expect(second.changes).toBe(0); // 取得済みのため失敗(待機しない、即座に0件)

    // 解放後は再取得できる。
    db.prepare("update advisory_locks set locked_by = null, locked_at = null where lock_key = ?").run("reference_data_update");
    const third = acquire("job-b");
    expect(third.changes).toBe(1);
  });
});
