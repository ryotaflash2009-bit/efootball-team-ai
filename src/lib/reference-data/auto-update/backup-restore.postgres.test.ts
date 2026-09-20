import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import { createPostgresQueryClient, buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildBackupIsolatedSchemaDdl, BACKUP_SOURCE_TEST_SCHEMA, BACKUP_RESTORE_TEST_SCHEMA, getBackupTableSpec } from "./backup-schema";
import { runGuardedCleanup } from "./postgres-test-lifecycle";
import { createReferenceDataBackup } from "./backup-orchestrator";
import { restoreReferenceDataBackup } from "./backup-restore";
import { NodeAesGcmEncryptor, generateEphemeralTestKey } from "./backup-encryptor";
import type { QueryClient } from "./apply-orchestrator";

/**
 * Backup(合成full-table dump)→暗号化→復号→別の空隔離schemaへのRestore→Restore後checksum一致、
 * を実際のPostgreSQLに対して検証する統合試験(Phase 4: Backup/Restore検証)。
 *
 * **このファイルは通常の`npx vitest run`には含まれない**(`vitest.config.ts`の除外設定、
 * `promotion-orchestrator.postgres.test.ts`と同じ規約)。実行するには:
 *   npx vitest run --config vitest.postgres.config.ts
 *
 * 接続先は`PHASE2_TEST_PG_*`環境変数(localhost限定、ホワイトリストDB名限定、
 * `assertSafeTestConnectionTarget`で強制)だけから読む。実Supabase・実Production
 * reference_dataへは一切接続しない。対象は`reference_data_backup_source_test`
 * (合成source)・`reference_data_backup_restore_test`(空のRestore先)という、
 * このセッション専用の隔離schema2つのみ。
 *
 * 使用する鍵は`generateEphemeralTestKey()`が返す使い捨てテスト鍵だけであり、
 * Production用の鍵・パスフレーズはこのファイルのどこにも生成・使用しない。
 *
 * このセッションではローカルWindows環境にPostgreSQLが存在しないため、このファイルは
 * ローカルでは一度も実行できていない(GitHub Actions上での実行結果は別途確認が必要)。
 */
const config = buildTestOnlyPgConfigFromEnv(process.env);

let adminClient: Client;
let adminClientConnected = false;
let sourceSchemaReady = false;
let restoreSchemaReady = false;

beforeAll(async () => {
  adminClient = new Client(config);
  await adminClient.connect();
  adminClientConnected = true;
  await adminClient.query(buildBackupIsolatedSchemaDdl(BACKUP_SOURCE_TEST_SCHEMA));
  sourceSchemaReady = true;
  await adminClient.query(buildBackupIsolatedSchemaDdl(BACKUP_RESTORE_TEST_SCHEMA));
  restoreSchemaReady = true;
});

async function cleanupSchemas(): Promise<void> {
  if (!adminClientConnected) return;
  await runGuardedCleanup([
    {
      ready: sourceSchemaReady,
      run: () =>
        adminClient
          .query(`truncate table
        ${BACKUP_SOURCE_TEST_SCHEMA}.player_card_analysis,
        ${BACKUP_SOURCE_TEST_SCHEMA}.world_player_cards,
        ${BACKUP_SOURCE_TEST_SCHEMA}.managers,
        ${BACKUP_SOURCE_TEST_SCHEMA}.import_batches
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
  if (adminClientConnected) {
    await adminClient.end();
  }
});

beforeEach(async () => {
  await cleanupSchemas();
});

const SEED_NOW_ISO = "2020-01-01T00:00:00.000Z";
const SCHEMA_VERSION = "backup-restore-postgres-test-v1";

/** 合成source schemaへ、テスト専用の生SQLで直接投入する(Backup側の実装は読み出し専用であるべきで、書込みヘルパーを持たせない)。 */
async function seedSourceRows(client: Client): Promise<void> {
  await client.query(
    `insert into ${BACKUP_SOURCE_TEST_SCHEMA}.world_player_cards
      (world_card_id, name_en, stats, skills, ai_styles, appearance, efhub_conflicts, source, dataset_version, fetched_at, created_at, updated_at)
     values
      ('1', 'Player One', $1, $2, $3, null, $4, 'efootball-world.com', 'v1', $5, $5, $5),
      ('2', 'Player Two', $1, $2, $3, null, $4, 'efootball-world.com', 'v1', $5, $5, $5)`,
    [JSON.stringify({ ovr: 90 }), ["Long Range Drive"], [], JSON.stringify([]), SEED_NOW_ISO],
  );
  await client.query(
    `insert into ${BACKUP_SOURCE_TEST_SCHEMA}.managers
      (internal_manager_id, source, source_manager_id, name_en, boosters, link_up_plays, dataset_version, fetched_at, created_at, updated_at)
     values
      (1, 'amine250/efootball-managers', '1', 'Manager One', $1, $1, 'v1', $2, $2, $2)`,
    [JSON.stringify([]), SEED_NOW_ISO],
  );
  await client.query(
    `insert into ${BACKUP_SOURCE_TEST_SCHEMA}.player_card_analysis
      (world_card_id, player_model, positions, com_skills, player_skills, source, dataset_version, fetched_at, created_at, updated_at)
     values
      ('1', $1, $2, $3, $3, 'efhub', 'v1', $4, $4, $4)`,
    [JSON.stringify({}), JSON.stringify([]), [], SEED_NOW_ISO],
  );
  await client.query(
    `insert into ${BACKUP_SOURCE_TEST_SCHEMA}.import_batches
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

describe("Backup -> 暗号化 -> 復号 -> Restore(実PostgreSQL、隔離schema2つ)", () => {
  it("正常系: 合成データのBackupを作成し、別の空schemaへRestoreし、Restore後checksumが一致する", async () => {
    await seedSourceRows(adminClient);
    const pgMajor = await getPostgresMajorVersion(adminClient);
    const queryClient: QueryClient = createPostgresQueryClient(adminClient);
    const key = generateEphemeralTestKey();
    const encryptor = new NodeAesGcmEncryptor(key);

    const backupResult = await createReferenceDataBackup(queryClient, {
      jobId: "postgres-test-backup-1",
      schemaVersion: SCHEMA_VERSION,
      applicationCommitSha: "0".repeat(40),
      now: new Date(),
      postgresMajorVersion: pgMajor,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 1,
      encryptor,
    });
    // result.reasonsはsanitizeErrorMessage済み(接続情報・SQL全文・parameter値を含まない)。
    expect(backupResult.ok, `createReferenceDataBackup reasons: ${JSON.stringify(backupResult.reasons)}`).toBe(true);
    expect(backupResult.artifact!.manifest.rowCounts.world_player_cards).toBe(2);
    expect(backupResult.artifact!.manifest.rowCounts.managers).toBe(1);
    expect(backupResult.artifact!.manifest.encrypted).toBe(true);

    // 平文dumpはこの時点でJSプロセスメモリ上にしか存在せず、ディスクへは一切書き出していない
    // (暗号化前平文の削除に相当: そもそも永続化しない設計)。
    const plaintextLike = backupResult.artifact!.encryptedPayload.toString("utf8");
    expect(plaintextLike).not.toContain("Player One");

    const restoreResult = await restoreReferenceDataBackup(queryClient, {
      artifact: backupResult.artifact!,
      decryptor: encryptor,
      expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: pgMajor,
      now: new Date(),
    });
    // result.reasonsはsanitizeErrorMessage済み(接続情報・SQL全文・parameter値を含まない、
    // テーブル名・件数・failed phase相当の短い文言だけを含む)。CIログでのみ役立つ診断情報。
    expect(restoreResult.ok, `restoreReferenceDataBackup reasons: ${JSON.stringify(restoreResult.reasons)}`).toBe(true);
    expect(restoreResult.restoreVerified).toBe(true);
    expect(restoreResult.restoredCounts!.world_player_cards).toBe(2);
    expect(restoreResult.manifest!.restoreVerified).toBe(true);

    const restoreSpec = getBackupTableSpec("world_player_cards");
    const restored = await adminClient.query(
      `select ${restoreSpec.columns.join(", ")} from ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards order by world_card_id`,
    );
    expect(restored.rows.map((r) => r.name_en)).toEqual(["Player One", "Player Two"]);
  }, 20000);

  it("誤った鍵での復号は実PostgreSQL上でも拒否され、Restore先schemaは空のまま", async () => {
    await seedSourceRows(adminClient);
    const pgMajor = await getPostgresMajorVersion(adminClient);
    const queryClient: QueryClient = createPostgresQueryClient(adminClient);
    const encryptor = new NodeAesGcmEncryptor(generateEphemeralTestKey());

    const backupResult = await createReferenceDataBackup(queryClient, {
      jobId: "postgres-test-backup-wrong-key",
      schemaVersion: SCHEMA_VERSION,
      applicationCommitSha: "0".repeat(40),
      now: new Date(),
      postgresMajorVersion: pgMajor,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 1,
      encryptor,
    });
    expect(backupResult.ok, `createReferenceDataBackup reasons: ${JSON.stringify(backupResult.reasons)}`).toBe(true);

    const wrongDecryptor = new NodeAesGcmEncryptor(generateEphemeralTestKey());
    const restoreResult = await restoreReferenceDataBackup(queryClient, {
      artifact: backupResult.artifact!,
      decryptor: wrongDecryptor,
      expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: pgMajor,
      now: new Date(),
    });
    expect(restoreResult.ok).toBe(false);
    expect(restoreResult.restoreVerified).toBe(false);

    const count = await adminClient.query(`select count(*) as c from ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards`);
    expect(Number(count.rows[0].c)).toBe(0);
  }, 20000);

  it("manifestのchecksum改ざんは実PostgreSQL上でも書込み前に拒否される", async () => {
    await seedSourceRows(adminClient);
    const pgMajor = await getPostgresMajorVersion(adminClient);
    const queryClient: QueryClient = createPostgresQueryClient(adminClient);
    const encryptor = new NodeAesGcmEncryptor(generateEphemeralTestKey());

    const backupResult = await createReferenceDataBackup(queryClient, {
      jobId: "postgres-test-backup-tampered",
      schemaVersion: SCHEMA_VERSION,
      applicationCommitSha: "0".repeat(40),
      now: new Date(),
      postgresMajorVersion: pgMajor,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 1,
      encryptor,
    });
    expect(backupResult.ok, `createReferenceDataBackup reasons: ${JSON.stringify(backupResult.reasons)}`).toBe(true);
    const tampered = {
      ...backupResult.artifact!,
      manifest: { ...backupResult.artifact!.manifest, tableChecksums: { ...backupResult.artifact!.manifest.tableChecksums, managers: "tampered" } },
    };

    const restoreResult = await restoreReferenceDataBackup(queryClient, {
      artifact: tampered,
      decryptor: encryptor,
      expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: pgMajor,
      now: new Date(),
    });
    expect(restoreResult.ok).toBe(false);

    const count = await adminClient.query(`select count(*) as c from ${BACKUP_RESTORE_TEST_SCHEMA}.managers`);
    expect(Number(count.rows[0].c)).toBe(0);
  }, 20000);
});
