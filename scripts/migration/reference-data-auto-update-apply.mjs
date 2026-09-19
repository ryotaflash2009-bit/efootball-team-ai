/**
 * 参照データ自動更新 Phase 2: 承認済み更新候補の適用CLI(ローカル合成環境専用)。
 *
 *   適用:
 *     node scripts/migration/reference-data-auto-update-apply.mjs \
 *       --sqlite-db <ローカル一時SQLiteファイル> \
 *       --staging <取得結果JSON> --previous <前回スナップショットJSON> --schema <スキーマ設定JSON> \
 *       --job <ジョブメタデータJSON> --approval <承認artifact JSON>
 *
 *   明示rollback(成功適用後の取り消し):
 *     node scripts/migration/reference-data-auto-update-apply.mjs \
 *       --sqlite-db <同じファイル> --rollback-plan <rollback plan JSON>
 *
 * **重要な制約(構造的にProductionへ接続できない設計)**:
 *   - `--sqlite-db`は必須であり、このCLIが開くDBは常にローカルファイルシステム上の
 *     SQLiteファイルだけである。Supabase/Postgresへの接続コード自体をこのファイルに
 *     含めていない(接続文字列・APIキーを読み取る処理が存在しない)。
 *   - `--production` / `--force` / `--skip-validation` / `--no-lock` / `--no-rollback` /
 *     `--execute` / `--yes` はいずれも存在しない(指定すると即座に拒否して終了する)。
 *   - 承認artifact(`--approval`)のchecksum・期限・期待件数が現在のデータと完全一致しない
 *     限り、適用処理(BEGIN)へは到達しない。
 *   - 対象テーブルは`real-import-guards.ts`の許可リスト(参照データ専用)に無い場合、
 *     構造的に拒否される(`auth.users`・`my_team_snapshots`・`rls_probe_records`等は
 *     対象にできない)。
 */
import { promises as fs } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "..", "lib", "ts-extension-resolve-hook.mjs")));

const { generateUpdatePlan } = await import("../../src/lib/reference-data/auto-update/plan.ts");
const { createPendingJob } = await import("../../src/lib/reference-data/auto-update/job.ts");
const { computeDiffChecksum } = await import("../../src/lib/reference-data/auto-update/approval.ts");
const { applyUpdateJob } = await import("../../src/lib/reference-data/auto-update/apply-orchestrator.ts");
const { executeRollback, buildRollbackPlan } = await import("../../src/lib/reference-data/auto-update/rollback.ts");
const { createSqliteQueryClient } = await import("../../src/lib/reference-data/auto-update/sqlite-adapter.ts");
const { SQLITE_STAGING_SCHEMA_DDL } = await import("../../src/lib/reference-data/auto-update/staging.ts");
const { buildAuditLogEntry } = await import("../../src/lib/reference-data/auto-update/audit-log.ts");

const FORBIDDEN_FLAGS = ["--production", "--force", "--skip-validation", "--no-lock", "--no-rollback", "--execute", "--yes"];

function readArg(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name}に値が指定されていない`);
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function lockKeyFor(table) {
  return `reference_data_update:${table}`;
}

function tryAcquireLock(db, key, holder, at) {
  db.prepare("insert or ignore into advisory_locks (lock_key, locked_by, locked_at) values (?, null, null)").run(key);
  const result = db.prepare("update advisory_locks set locked_by = ?, locked_at = ? where lock_key = ? and locked_by is null").run(holder, at, key);
  return result.changes > 0;
}

function releaseLock(db, key) {
  db.prepare("update advisory_locks set locked_by = null, locked_at = null where lock_key = ?").run(key);
}

async function runApply(argv, db) {
  const stagingPath = readArg(argv, "--staging", null);
  const previousPath = readArg(argv, "--previous", null);
  const schemaPath = readArg(argv, "--schema", null);
  const jobPath = readArg(argv, "--job", null);
  const approvalPath = readArg(argv, "--approval", null);
  if (!stagingPath || !previousPath || !schemaPath || !jobPath || !approvalPath) {
    throw new Error("--staging / --previous / --schema / --job / --approval をすべて指定すること");
  }

  const staging = await readJson(stagingPath);
  const previous = await readJson(previousPath);
  const rawSchema = await readJson(schemaPath);
  const rawJob = await readJson(jobPath);
  const approval = await readJson(approvalPath);
  const schemaConfig = {
    idPattern: new RegExp(rawSchema.idPattern),
    requiredFields: rawSchema.requiredFields ?? [],
    numericRanges: rawSchema.numericRanges ?? [],
    knownFields: rawSchema.knownFields ?? [],
  };
  const maxDecreaseRatio = Number(readArg(argv, "--max-decrease-ratio", "0.05"));
  const maxIncreaseRatio = Number(readArg(argv, "--max-increase-ratio", "0.1"));
  const maxRemovedCount = Number(readArg(argv, "--max-removed-count", "9999999"));

  const plan = generateUpdatePlan({
    staging,
    previous,
    schemaConfig,
    diffThresholds: { maxDecreaseRatio, maxIncreaseRatio, maxRemovedCount },
  });

  const job = createPendingJob({
    jobId: rawJob.jobId,
    table: rawJob.table,
    source: staging.sourceMeta?.source ?? rawJob.source,
    schemaVersion: rawJob.schemaVersion,
    datasetChecksum: rawJob.datasetChecksum,
    previousChecksum: rawJob.previousChecksum ?? null,
    expectedTables: rawJob.expectedTables ?? [rawJob.table],
    fetchedTables: rawJob.fetchedTables ?? [rawJob.table],
  });

  const now = new Date();
  const lockKey = lockKeyFor(job.table);
  const lockAcquired = tryAcquireLock(db, lockKey, job.jobId, now.toISOString());

  const runningJobRow = db
    .prepare("select 1 from update_jobs where table_name = ? and status = 'running' and job_id != ?")
    .get(job.table, job.jobId);
  const previousJobStatus = runningJobRow ? "running" : "idle";

  const appliedRows = db.prepare("select dataset_checksum from applied_checksums").all();
  const appliedChecksumHistory = new Set(appliedRows.map((r) => r.dataset_checksum));

  db.prepare(
    `insert into update_jobs (job_id, table_name, source, schema_version, dataset_checksum, previous_checksum, status, started_at, expected_tables, fetched_tables)
     values (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)
     on conflict(job_id) do update set status = 'running', started_at = excluded.started_at`,
  ).run(
    job.jobId,
    job.table,
    job.source,
    job.schemaVersion,
    job.datasetChecksum,
    job.previousChecksum,
    now.toISOString(),
    JSON.stringify(job.expectedTables),
    JSON.stringify(job.fetchedTables),
  );

  console.log("=== 参照データ自動更新 Phase 2 apply(ローカル合成SQLiteのみ、Production未接続) ===");
  console.log(`対象テーブル: ${job.table} / jobId: ${job.jobId}`);
  console.log(`lock取得: ${lockAcquired ? "成功" : "失敗"}`);

  let result;
  try {
    const client = createSqliteQueryClient(db);
    result = await applyUpdateJob(client, {
      job,
      plan,
      approval,
      stagingRecords: staging.records,
      appliedChecksumHistory,
      previousJobStatus,
      lockAcquired,
      now,
    });
  } finally {
    releaseLock(db, lockKey);
  }

  if (result.decision !== "commit") {
    db.prepare("update update_jobs set status = 'failed', completed_at = ? where job_id = ?").run(now.toISOString(), job.jobId);
  }

  const auditEntry = buildAuditLogEntry(plan, staging.sourceMeta, now.toISOString());
  console.log("\n--- 判定 ---");
  console.log(`decision: ${result.decision}`);
  if (result.reasons.length > 0) {
    console.log("理由:");
    for (const r of result.reasons) console.log(`  - ${r}`);
  }
  console.log(`appliedCount: ${result.appliedCount ?? 0}(diffChecksum: ${computeDiffChecksum(plan.diff).slice(0, 12)}…)`);
  console.log("\n--- 監査ログエントリー(JSON) ---");
  console.log(JSON.stringify({ ...auditEntry, jobId: job.jobId, applyDecision: result.decision }, null, 2));

  if (result.decision !== "commit") process.exitCode = 1;
}

async function runRollback(argv, db) {
  const rollbackPlanPath = readArg(argv, "--rollback-plan", null);
  if (!rollbackPlanPath) throw new Error("--rollback-plan を指定すること");
  const raw = await readJson(rollbackPlanPath);
  const plan = buildRollbackPlan(raw.jobId, raw.beforeSnapshot ?? [], raw.addedIds ?? []);

  console.log("=== 参照データ自動更新 Phase 2 rollback(ローカル合成SQLiteのみ、Production未接続) ===");
  console.log(`対象jobId: ${plan.jobId} / 復元対象: ${plan.beforeSnapshot.length}件 / 削除対象(新規追加分): ${plan.addedIds.length}件`);

  const client = createSqliteQueryClient(db);
  const result = await executeRollback(client, plan, new Date());

  console.log("\n--- 結果 ---");
  console.log(`ok: ${result.ok}`);
  console.log(`restoredCount: ${result.restoredCount} / removedCount: ${result.removedCount}`);
  if (result.reasons.length > 0) {
    console.log("理由:");
    for (const r of result.reasons) console.log(`  - ${r}`);
  }
  if (!result.ok) process.exitCode = 1;
}

async function main() {
  const argv = process.argv.slice(2);

  const forbidden = FORBIDDEN_FLAGS.find((f) => argv.includes(f));
  if (forbidden) {
    throw new Error(`${forbidden}は存在しない(このCLIには実装していない、Production適用・強制適用・検証スキップ・ロック省略・rollback省略はいずれも不可)`);
  }

  const sqliteDbPath = readArg(argv, "--sqlite-db", null);
  if (!sqliteDbPath) {
    throw new Error("--sqlite-db(ローカル一時SQLiteファイルへのパス)を指定すること。Productionへは一切接続できない設計であり、このCLIにSupabase接続コードは含まれていない。");
  }
  if (!path.isAbsolute(sqliteDbPath) && !sqliteDbPath.startsWith(".")) {
    // 相対パスも許容するが、明示的に何らかのパスであることを要求する(誤って空文字列等を渡さないため)。
  }

  const db = new DatabaseSync(sqliteDbPath);
  db.exec(SQLITE_STAGING_SCHEMA_DDL);

  try {
    if (argv.includes("--rollback-plan")) {
      await runRollback(argv, db);
    } else {
      await runApply(argv, db);
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
