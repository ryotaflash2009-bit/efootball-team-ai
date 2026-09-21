import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPostgresQueryClient, buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildProductionLikeSchemaDdlForIsolatedTesting, buildBackupIsolatedSchemaDdl, BACKUP_RESTORE_TEST_SCHEMA, PRODUCTION_REFERENCE_DATA_SCHEMA } from "./backup-schema";
import { runGuardedCleanup } from "./postgres-test-lifecycle";
import { runProductionBackup } from "./run-production-backup";
import { FakeR2Client } from "./backup-r2-client";
import type { QueryClient } from "./apply-orchestrator";

/**
 * `runProductionBackup`のうち、実PostgreSQLに対する読み出し(dump)・隔離Restore検証
 * (TRUNCATE/INSERT/transaction/読み戻しchecksum一致)の部分だけを、実際のPostgreSQLに
 * 対して検証する統合試験。R2 uploadは`FakeR2Client`(実ネットワーク通信なし)、
 * 暗号化は`age`の代わりにこのファイル専用のfakeスクリプト(単純なファイル操作だけを行う)を
 * 使う(このjobがage未インストールでも実行できるようにするため。ageのCLI呼び出し境界自体は
 * `backup-age-cli-encryptor.test.ts`が別途、fakeで検証済み)。
 *
 * **このファイルは通常の`npx vitest run`には含まれない**(`vitest.config.ts`の除外設定と
 * `vitest.postgres.config.ts`のinclude設定、既存の`*.postgres.test.ts`群と同じ規約)。
 * 実行するには: npx vitest run --config vitest.postgres.config.ts
 *
 * 接続先は`PHASE2_TEST_PG_*`環境変数(localhost限定、ホワイトリストDB名限定)だけから読む。
 * 実Supabase・実Production reference_dataへは一切接続しない。この試験が作成する
 * "reference_data"という名前のschemaは、あくまでこの隔離CI Postgres内だけの構造再現であり、
 * 実Productionの`reference_data`とは無関係(接続先が完全に別のデータベースインスタンス)。
 *
 * このセッションではローカルWindows環境にPostgreSQLが存在しないため、このファイルは
 * ローカルでは一度も実行できていない(GitHub Actions上での実行結果は別途確認が必要、
 * 既存の`*.postgres.test.ts`群と同じ、誠実に開示する限界)。
 */

const RECIPIENT = "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const config = buildTestOnlyPgConfigFromEnv(process.env);

let adminClient: Client;
let adminClientConnected = false;
let prodSchemaReady = false;
let restoreSchemaReady = false;
let scratchDir: string;
let fakeAgeSuccessPath: string;

beforeAll(async () => {
  scratchDir = mkdtempSync(join(tmpdir(), "run-production-backup-postgres-test-"));
  fakeAgeSuccessPath = join(scratchDir, "fake-age-success.mjs");
  writeFileSync(
    fakeAgeSuccessPath,
    `import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const recipient = args[args.indexOf("-r") + 1];
const outPath = args[args.indexOf("-o") + 1];
const inPath = args[args.length - 1];
const plaintext = readFileSync(inPath);
writeFileSync(outPath, Buffer.concat([Buffer.from("FAKE_AGE:" + recipient + ":"), plaintext]));
`,
  );

  adminClient = new Client(config);
  await adminClient.connect();
  adminClientConnected = true;
  await adminClient.query(buildProductionLikeSchemaDdlForIsolatedTesting());
  prodSchemaReady = true;
  await adminClient.query(buildBackupIsolatedSchemaDdl(BACKUP_RESTORE_TEST_SCHEMA));
  restoreSchemaReady = true;
});

async function cleanupSchemas(): Promise<void> {
  if (!adminClientConnected) return;
  await runGuardedCleanup([
    {
      ready: prodSchemaReady,
      run: () =>
        adminClient
          .query(`truncate table
        ${PRODUCTION_REFERENCE_DATA_SCHEMA}.player_card_analysis,
        ${PRODUCTION_REFERENCE_DATA_SCHEMA}.world_player_cards,
        ${PRODUCTION_REFERENCE_DATA_SCHEMA}.managers,
        ${PRODUCTION_REFERENCE_DATA_SCHEMA}.import_batches
        cascade`)
          .then(() => undefined),
    },
    {
      ready: restoreSchemaReady,
      run: () =>
        adminClient
          .query(`truncate table
        ${BACKUP_RESTORE_TEST_SCHEMA}.player_card_analysis,
        ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards,
        ${BACKUP_RESTORE_TEST_SCHEMA}.managers,
        ${BACKUP_RESTORE_TEST_SCHEMA}.import_batches
        cascade`)
          .then(() => undefined),
    },
  ]);
}

afterAll(async () => {
  await cleanupSchemas();
  if (adminClientConnected) await adminClient.end();
  rmSync(scratchDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await cleanupSchemas();
});

const SEED_NOW_ISO = "2020-01-01T00:00:00.000Z";
const SCHEMA_VERSION = "run-production-backup-postgres-test-v1";

/** "reference_data"という名前の(実Productionとは別の、この隔離DB内だけの)schemaへ、テスト専用の生SQLで直接投入する。 */
async function seedProductionLikeRows(client: Client): Promise<void> {
  await client.query(
    `insert into ${PRODUCTION_REFERENCE_DATA_SCHEMA}.world_player_cards
      (world_card_id, name_en, stats, skills, ai_styles, appearance, efhub_conflicts, source, dataset_version, fetched_at, created_at, updated_at)
     values
      ('1', 'Player One', $1, $2, $3, null, $4, 'efootball-world.com', 'v1', $5, $5, $5),
      ('2', 'Player Two', $1, $2, $3, null, $4, 'efootball-world.com', 'v1', $5, $5, $5)`,
    [JSON.stringify({ ovr: 90 }), ["Long Range Drive"], [], JSON.stringify([]), SEED_NOW_ISO],
  );
  await client.query(
    `insert into ${PRODUCTION_REFERENCE_DATA_SCHEMA}.managers
      (internal_manager_id, source, source_manager_id, name_en, boosters, link_up_plays, dataset_version, fetched_at, created_at, updated_at)
     values
      (1, 'amine250/efootball-managers', '1', 'Manager One', $1, $1, 'v1', $2, $2, $2)`,
    [JSON.stringify([]), SEED_NOW_ISO],
  );
  await client.query(
    `insert into ${PRODUCTION_REFERENCE_DATA_SCHEMA}.player_card_analysis
      (world_card_id, player_model, positions, com_skills, player_skills, source, dataset_version, fetched_at, created_at, updated_at)
     values
      ('1', $1, $2, $3, $3, 'efhub', 'v1', $4, $4, $4)`,
    [JSON.stringify({}), JSON.stringify([]), [], SEED_NOW_ISO],
  );
  await client.query(
    `insert into ${PRODUCTION_REFERENCE_DATA_SCHEMA}.import_batches
      (batch_id, dataset_version, target_table, source, source_row_count, inserted_row_count, payload_hash, status, created_at)
     values
      (gen_random_uuid(), 'v1', 'world_player_cards', 'efootball-world.com', 2, 2, $1, 'verified', $2)`,
    ["0".repeat(64), SEED_NOW_ISO],
  );
}

async function getPostgresMajorVersion(client: Client): Promise<number> {
  const result = await client.query("select current_setting('server_version_num') as v");
  return Math.floor(parseInt(String(result.rows[0].v), 10) / 10000);
}

describe("runProductionBackup(実PostgreSQL、reference_data相当schema1つ + 隔離Restore検証schema1つ、R2/ageはfake)", () => {
  it("正常系: 実PostgreSQLからexportし、隔離Restore検証に成功し、FakeR2Clientへuploadされる", async () => {
    await seedProductionLikeRows(adminClient);
    const pgMajor = await getPostgresMajorVersion(adminClient);
    const prodClient: QueryClient = createPostgresQueryClient(adminClient);
    const verifyClient: QueryClient = createPostgresQueryClient(adminClient);
    const r2Client = new FakeR2Client();

    const result = await runProductionBackup({
      prodClient,
      verifyClient,
      r2Client,
      ageRecipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeSuccessPath],
      jobId: "postgres-test-prod-backup-1",
      now: new Date(),
      schemaVersion: SCHEMA_VERSION,
      postgresMajorVersion: pgMajor,
      applicationCommitSha: "0".repeat(40),
      category: "daily",
    });

    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect(result.summary.storageVerified).toBe(true);
    expect(result.summary.restoreVerified).toBe(true);
    expect((result.summary.rowCounts as Record<string, number>).world_player_cards).toBe(2);
    expect(r2Client.putCalls).toBe(2);

    // 隔離Restore検証schemaに、実際に2行がRestoreされている(実PostgreSQLへの書込みを確認)。
    const restored = await adminClient.query(`select world_card_id, name_en from ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards order by world_card_id`);
    expect(restored.rows.map((r) => r.name_en)).toEqual(["Player One", "Player Two"]);

    // 実Production相当schema自体は、export(SELECT)しか行っておらず、行データは変更されていない。
    const untouched = await adminClient.query(`select count(*) as c from ${PRODUCTION_REFERENCE_DATA_SCHEMA}.world_player_cards`);
    expect(Number(untouched.rows[0].c)).toBe(2);
  }, 20000);

  it("0件のテーブルでも(空データセットでも)正常にexport・検証・uploadまで成功する", async () => {
    const pgMajor = await getPostgresMajorVersion(adminClient);
    const prodClient: QueryClient = createPostgresQueryClient(adminClient);
    const verifyClient: QueryClient = createPostgresQueryClient(adminClient);
    const r2Client = new FakeR2Client();

    const result = await runProductionBackup({
      prodClient,
      verifyClient,
      r2Client,
      ageRecipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeSuccessPath],
      jobId: "postgres-test-prod-backup-empty",
      now: new Date(),
      schemaVersion: SCHEMA_VERSION,
      postgresMajorVersion: pgMajor,
      applicationCommitSha: "0".repeat(40),
      category: "daily",
    });

    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect((result.summary.rowCounts as Record<string, number>).world_player_cards).toBe(0);
  }, 20000);

  it("category=pre-applyの場合、実PostgreSQLからのexport・隔離Restore検証を経てもretentionDays/expiresAtはnullのまま(初回Production Backup相当)", async () => {
    await seedProductionLikeRows(adminClient);
    const pgMajor = await getPostgresMajorVersion(adminClient);
    const prodClient: QueryClient = createPostgresQueryClient(adminClient);
    const verifyClient: QueryClient = createPostgresQueryClient(adminClient);
    const r2Client = new FakeR2Client();

    const result = await runProductionBackup({
      prodClient,
      verifyClient,
      r2Client,
      ageRecipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeSuccessPath],
      jobId: "postgres-test-prod-backup-pre-apply",
      now: new Date(),
      schemaVersion: SCHEMA_VERSION,
      postgresMajorVersion: pgMajor,
      applicationCommitSha: "0".repeat(40),
      category: "pre-apply",
    });

    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect((result.summary.objectKey as string).startsWith("pre-apply/")).toBe(true);
    expect(result.summary.retentionCategory).toBe("production-pre-apply");
    expect(result.summary.retentionDays).toBeNull();
    expect(result.summary.expiresAt).toBeNull();
  }, 20000);
});
