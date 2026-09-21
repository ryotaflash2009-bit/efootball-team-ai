import { describe, it, expect } from "vitest";
import { createReferenceDataBackup, evaluateBackupPreflightGates, dumpBackupTables } from "./backup-orchestrator";
import { getBackupTableSpec, BACKUP_SOURCE_TEST_SCHEMA, PRODUCTION_REFERENCE_DATA_SCHEMA } from "./backup-schema";
import { FakeEncryptor, NodeAesGcmEncryptor, generateEphemeralTestKey } from "./backup-encryptor";
import type { QueryClient, QueryResult } from "./apply-orchestrator";

/** `normalizeRow`(実PostgreSQL adapter)の挙動(null以外のobject/arrayは一律JSON文字列化)を模倣する。 */
function toRawDbValue(v: unknown): unknown {
  return v !== null && v !== undefined && typeof v === "object" ? JSON.stringify(v) : v ?? null;
}

class FakeSourceClient implements QueryClient {
  sourceRows: Record<string, Record<string, unknown>[]> = {
    world_player_cards: [],
    managers: [],
    player_card_analysis: [],
    import_batches: [],
  };

  seed(table: string, fields: Record<string, unknown>): void {
    const spec = getBackupTableSpec(table);
    const raw: Record<string, unknown> = {};
    for (const col of spec.columns) raw[col] = toRawDbValue(fields[col] ?? null);
    this.sourceRows[table].push(raw);
  }

  async query(sql: string): Promise<QueryResult> {
    const m = sql.match(/reference_data_backup_source_test\.(\w+)/);
    if (!m) throw new Error(`予期しないSQL: ${sql}`);
    const table = m[1];
    return { rows: this.sourceRows[table] };
  }
}

function seedOneOfEach(client: FakeSourceClient): void {
  client.seed("world_player_cards", {
    world_card_id: "1", name_en: "Player One", stats: { ovr: 90 }, skills: ["Skill A"], ai_styles: [],
    appearance: null, efhub_conflicts: [], source: "efootball-world.com", dataset_version: "v1",
    fetched_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  });
  client.seed("managers", {
    internal_manager_id: 1, source: "amine250/efootball-managers", source_manager_id: "1", name_en: "Manager One",
    boosters: [], link_up_plays: [], dataset_version: "v1", fetched_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  });
  client.seed("player_card_analysis", {
    world_card_id: "1", player_model: {}, positions: [], com_skills: [], player_skills: [],
    source: "efhub", dataset_version: "v1", fetched_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  });
  client.seed("import_batches", {
    batch_id: "b1", dataset_version: "v1", target_table: "world_player_cards", source: "efootball-world.com",
    source_row_count: 1, inserted_row_count: 1, payload_hash: "0".repeat(64), status: "verified",
    created_at: "2026-01-01T00:00:00.000Z",
  });
}

describe("evaluateBackupPreflightGates", () => {
  it("全項目満たしていれば全合格", () => {
    const checks = evaluateBackupPreflightGates({ postgresMajorVersion: 16, retentionDays: 7, encryptor: new FakeEncryptor() });
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("postgresMajorVersionが0以下なら不合格", () => {
    const checks = evaluateBackupPreflightGates({ postgresMajorVersion: 0, retentionDays: 7, encryptor: new FakeEncryptor() });
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("retentionDaysが0以下なら不合格", () => {
    const checks = evaluateBackupPreflightGates({ postgresMajorVersion: 16, retentionDays: 0, encryptor: new FakeEncryptor() });
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("encryptorが未指定(null)なら不合格", () => {
    const checks = evaluateBackupPreflightGates({ postgresMajorVersion: 16, retentionDays: 7, encryptor: null as never });
    expect(checks.some((c) => !c.ok)).toBe(true);
  });
});

describe("dumpBackupTables", () => {
  it("4テーブルすべてを、jsonb/text[]列がネイティブ値へ復元された状態で取得する", async () => {
    const client = new FakeSourceClient();
    seedOneOfEach(client);
    const dumps = await dumpBackupTables(client, BACKUP_SOURCE_TEST_SCHEMA);
    expect(dumps.map((d) => d.table).sort()).toEqual(
      ["world_player_cards", "managers", "player_card_analysis", "import_batches"].sort(),
    );
    const wpc = dumps.find((d) => d.table === "world_player_cards")!;
    expect(wpc.rows[0].stats).toEqual({ ovr: 90 });
    expect(wpc.rows[0].skills).toEqual(["Skill A"]);
    expect(wpc.rowCount).toBe(1);
  });

  it("0件のテーブルはrowCount=0、checksumは空集合固有の値になる", async () => {
    const client = new FakeSourceClient();
    const dumps = await dumpBackupTables(client, BACKUP_SOURCE_TEST_SCHEMA);
    for (const d of dumps) {
      expect(d.rowCount).toBe(0);
    }
  });
});

describe("createReferenceDataBackup", () => {
  it("正常系: manifest生成・暗号化まで成功し、restoreVerifiedはまだfalse", async () => {
    const client = new FakeSourceClient();
    seedOneOfEach(client);
    const result = await createReferenceDataBackup(client, {
      jobId: "job-1",
      schemaVersion: "2026-09-20",
      applicationCommitSha: "0".repeat(40),
      now: new Date("2026-09-20T00:00:00.000Z"),
      postgresMajorVersion: 16,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 7,
      encryptor: new FakeEncryptor(),
      sourceSchema: BACKUP_SOURCE_TEST_SCHEMA,
    });
    expect(result.ok).toBe(true);
    expect(result.artifact).not.toBeNull();
    expect(result.artifact!.manifest.encrypted).toBe(true);
    expect(result.artifact!.manifest.restoreVerified).toBe(false);
    expect(result.artifact!.manifest.rowCounts.world_player_cards).toBe(1);
    expect(result.artifact!.encryptedPayload.length).toBeGreaterThan(0);
  });

  it("manifestに秘密情報らしき値が混入していないことを確認する", async () => {
    const client = new FakeSourceClient();
    seedOneOfEach(client);
    const result = await createReferenceDataBackup(client, {
      jobId: "job-1",
      schemaVersion: "2026-09-20",
      applicationCommitSha: "0".repeat(40),
      now: new Date("2026-09-20T00:00:00.000Z"),
      postgresMajorVersion: 16,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 7,
      encryptor: new FakeEncryptor(),
      sourceSchema: BACKUP_SOURCE_TEST_SCHEMA,
    });
    const json = JSON.stringify(result.artifact!.manifest);
    expect(json).not.toMatch(/postgres:\/\//i);
    expect(json).not.toMatch(/supabase\.co/i);
    expect(json).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("事前ゲート不合格なら接続前preflight段階で拒否され、DBへは一切問い合わせない", async () => {
    const client = new FakeSourceClient();
    seedOneOfEach(client);
    const result = await createReferenceDataBackup(client, {
      jobId: "job-1",
      schemaVersion: "2026-09-20",
      applicationCommitSha: "0".repeat(40),
      now: new Date("2026-09-20T00:00:00.000Z"),
      postgresMajorVersion: 0,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 7,
      encryptor: new FakeEncryptor(),
      sourceSchema: BACKUP_SOURCE_TEST_SCHEMA,
    });
    expect(result.ok).toBe(false);
    expect(result.artifact).toBeNull();
  });

  it("実際に暗号化されており、平文のままではない(NodeAesGcmEncryptor)", async () => {
    const client = new FakeSourceClient();
    seedOneOfEach(client);
    const key = generateEphemeralTestKey();
    const result = await createReferenceDataBackup(client, {
      jobId: "job-1",
      schemaVersion: "2026-09-20",
      applicationCommitSha: "0".repeat(40),
      now: new Date("2026-09-20T00:00:00.000Z"),
      postgresMajorVersion: 16,
      retentionCategory: "isolated-test-ephemeral",
      retentionDays: 7,
      encryptor: new NodeAesGcmEncryptor(key),
      sourceSchema: BACKUP_SOURCE_TEST_SCHEMA,
    });
    expect(result.ok).toBe(true);
    const plaintextLike = result.artifact!.encryptedPayload.toString("utf8");
    expect(plaintextLike).not.toContain("Player One");
  });
});

describe("createReferenceDataBackup(実Production reference_data schemaからの読み出し、2026-09-21追記)", () => {
  class FakeProductionSourceClient implements QueryClient {
    sourceRows: Record<string, Record<string, unknown>[]> = {
      world_player_cards: [], managers: [], player_card_analysis: [], import_batches: [],
    };
    seed(table: string, fields: Record<string, unknown>): void {
      const spec = getBackupTableSpec(table);
      const raw: Record<string, unknown> = {};
      for (const col of spec.columns) raw[col] = toRawDbValue(fields[col] ?? null);
      this.sourceRows[table].push(raw);
    }
    async query(sql: string): Promise<QueryResult> {
      // 実schema名(reference_data)だけを対象にする、隔離検証用schemaとは別のfake実装。
      const m = sql.match(/^select .* from reference_data\.(\w+) /);
      if (!m) throw new Error(`予期しないSQL(実schema想定): ${sql}`);
      return { rows: this.sourceRows[m[1]] };
    }
  }

  it("sourceSchemaにPRODUCTION_REFERENCE_DATA_SCHEMAを渡すと、reference_data.*から読み出す", async () => {
    const client = new FakeProductionSourceClient();
    client.seed("world_player_cards", {
      world_card_id: "1", name_en: "Player One", stats: { ovr: 90 }, skills: [], ai_styles: [],
      appearance: null, efhub_conflicts: [], source: "efootball-world.com", dataset_version: "v1",
      fetched_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    });
    const result = await createReferenceDataBackup(client, {
      jobId: "job-prod-1",
      schemaVersion: "2026-09-20",
      applicationCommitSha: "0".repeat(40),
      now: new Date("2026-09-20T00:00:00.000Z"),
      postgresMajorVersion: 16,
      retentionCategory: "production-standard",
      retentionDays: 7,
      encryptor: new FakeEncryptor(),
      sourceSchema: PRODUCTION_REFERENCE_DATA_SCHEMA,
    });
    expect(result.ok).toBe(true);
    expect(result.artifact!.manifest.rowCounts.world_player_cards).toBe(1);
  });
});
