import { describe, it, expect } from "vitest";
import { createReferenceDataBackup } from "./backup-orchestrator";
import { restoreReferenceDataBackup, evaluateRestorePreflightGates } from "./backup-restore";
import { getBackupTableSpec, BACKUP_SOURCE_TEST_SCHEMA } from "./backup-schema";
import { markManifestFailed } from "./backup-manifest";
import { FakeEncryptor, NodeAesGcmEncryptor, generateEphemeralTestKey, type BackupEncryptor } from "./backup-encryptor";
import type { BackupArtifact } from "./backup-orchestrator";
import type { QueryClient, QueryResult } from "./apply-orchestrator";

function toRawDbValue(v: unknown): unknown {
  return v !== null && v !== undefined && typeof v === "object" ? JSON.stringify(v) : v ?? null;
}

class FakeSourceClient implements QueryClient {
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
    const m = sql.match(/reference_data_backup_source_test\.(\w+)/);
    if (!m) throw new Error(`予期しないSQL: ${sql}`);
    return { rows: this.sourceRows[m[1]] };
  }
}

/** Restore先(隔離schema)を模したfake client。truncate/insert/select-by-orderだけをサポートする。 */
class FakeRestoreClient implements QueryClient {
  restoreRows: Record<string, Record<string, unknown>[]> = {
    world_player_cards: [], managers: [], player_card_analysis: [], import_batches: [],
  };
  failOn: RegExp | null = null;
  calls: string[] = [];

  async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
    const trimmed = sql.trim();
    const lower = trimmed.toLowerCase();
    this.calls.push(lower.split(/\s+/)[0]);
    if (this.failOn && this.failOn.test(trimmed)) throw new Error(`fault-injected: ${trimmed.slice(0, 60)}`);
    if (lower === "begin" || lower === "commit" || lower === "rollback") return { rows: [] };

    if (/^truncate table\b/i.test(trimmed)) {
      // 実装はRestore先4テーブルすべてを単一のTRUNCATE文でまとめて空にする(外部キー制約回避)。
      // fake clientでも、カンマ区切りで列挙された全テーブルを空にする。
      const tables = [...trimmed.matchAll(/reference_data_backup_restore_test\.(\w+)/gi)].map((m) => m[1]);
      if (tables.length === 0) throw new Error(`予期しないTRUNCATE文: ${trimmed}`);
      for (const t of tables) this.restoreRows[t] = [];
      return { rows: [] };
    }

    const insertMatch = trimmed.match(/^insert into reference_data_backup_restore_test\.(\w+)\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const columns = insertMatch[2].split(",").map((c) => c.trim());
      const rowCount = params.length / columns.length;
      for (let r = 0; r < rowCount; r += 1) {
        const row: Record<string, unknown> = {};
        columns.forEach((col, i) => (row[col] = params[r * columns.length + i]));
        this.restoreRows[table].push(row);
      }
      return { rows: [] };
    }

    const selectMatch = trimmed.match(/^select .+ from reference_data_backup_restore_test\.(\w+)/i);
    if (selectMatch) {
      return { rows: this.restoreRows[selectMatch[1]] };
    }

    throw new Error(`予期しないSQL: ${trimmed}`);
  }
}

function seedOneOfEach(client: FakeSourceClient): void {
  client.seed("world_player_cards", {
    world_card_id: "1", name_en: "Player One", stats: { ovr: 90 }, skills: ["Skill A"],
    source: "efootball-world.com", dataset_version: "v1", fetched_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  });
  client.seed("managers", {
    internal_manager_id: 1, source: "amine250/efootball-managers", source_manager_id: "1", name_en: "Manager One",
    dataset_version: "v1", fetched_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  });
  client.seed("player_card_analysis", {
    world_card_id: "1", source: "efhub", dataset_version: "v1", fetched_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  });
  client.seed("import_batches", {
    batch_id: "b1", dataset_version: "v1", target_table: "world_player_cards", source: "efootball-world.com",
    source_row_count: 1, inserted_row_count: 1, payload_hash: "0".repeat(64), status: "verified",
    created_at: "2026-01-01T00:00:00.000Z",
  });
}

const SCHEMA_VERSION = "2026-09-20";
const PG_MAJOR = 16;

async function buildValidArtifact(encryptor: BackupEncryptor): Promise<BackupArtifact> {
  const source = new FakeSourceClient();
  seedOneOfEach(source);
  const result = await createReferenceDataBackup(source, {
    jobId: "job-1",
    schemaVersion: SCHEMA_VERSION,
    applicationCommitSha: "0".repeat(40),
    now: new Date("2026-09-20T00:00:00.000Z"),
    postgresMajorVersion: PG_MAJOR,
    retentionCategory: "isolated-test-ephemeral",
    retentionDays: 7,
    encryptor,
    sourceSchema: BACKUP_SOURCE_TEST_SCHEMA,
  });
  if (!result.ok || !result.artifact) throw new Error("テスト前提のBackup生成に失敗した");
  return result.artifact;
}

describe("evaluateRestorePreflightGates", () => {
  it("encrypted=falseのmanifestは拒否する", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const tampered = { ...artifact, manifest: { ...artifact.manifest, encrypted: false } };
    const checks = evaluateRestorePreflightGates({
      artifact: tampered, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("schemaVersion不一致を検出する", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const checks = evaluateRestorePreflightGates({
      artifact, decryptor: new FakeEncryptor(), expectedSchemaVersion: "different-version",
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("PostgreSQL major version不一致を検出し、安全に停止できる", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const checks = evaluateRestorePreflightGates({
      artifact, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: 17, now: new Date(),
    });
    expect(checks.some((c) => !c.ok)).toBe(true);
  });
});

describe("restoreReferenceDataBackup", () => {
  it("正常系: Restore成功し、restoreVerified=trueとなり、Restore後checksumが一致する", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date("2026-09-20T01:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    expect(result.restoreVerified).toBe(true);
    expect(result.manifest!.restoreVerified).toBe(true);
    expect(result.restoredCounts!.world_player_cards).toBe(1);
    expect(restoreClient.restoreRows.world_player_cards[0].name_en).toBe("Player One");
  });

  it("NodeAesGcmEncryptorでも正しい鍵ならRestoreに成功する", async () => {
    const key = generateEphemeralTestKey();
    const artifact = await buildValidArtifact(new NodeAesGcmEncryptor(key));
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor: new NodeAesGcmEncryptor(key), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(true);
    expect(result.restoreVerified).toBe(true);
  });

  it("誤った鍵での復号は拒否し、Restore先へは一切書き込まない(wrong key拒否)", async () => {
    const artifact = await buildValidArtifact(new NodeAesGcmEncryptor(generateEphemeralTestKey()));
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor: new NodeAesGcmEncryptor(generateEphemeralTestKey()), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(result.restoreVerified).toBe(false);
    expect(restoreClient.calls).toEqual([]);
  });

  it("改ざんされた暗号化ファイルの復号は拒否する(暗号化ファイル改ざん時拒否)", async () => {
    const key = generateEphemeralTestKey();
    const artifact = await buildValidArtifact(new NodeAesGcmEncryptor(key));
    const tamperedPayload = Buffer.from(artifact.encryptedPayload);
    tamperedPayload[tamperedPayload.length - 1] ^= 0xff;
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: { ...artifact, encryptedPayload: tamperedPayload },
      decryptor: new NodeAesGcmEncryptor(key), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(restoreClient.calls).toEqual([]);
  });

  it("不完全なdump(暗号文が短すぎる)は拒否する(incomplete dump拒否)", async () => {
    const key = generateEphemeralTestKey();
    const artifact = await buildValidArtifact(new NodeAesGcmEncryptor(key));
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: { ...artifact, encryptedPayload: Buffer.from("short") },
      decryptor: new NodeAesGcmEncryptor(key), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("manifestのchecksum改ざん(値だけ書き換え)を検出する(checksum不一致時拒否)", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const tampered = { ...artifact, manifest: { ...artifact.manifest, tableChecksums: { ...artifact.manifest.tableChecksums, managers: "tampered" } } };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: tampered, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("checksum"))).toBe(true);
    expect(restoreClient.calls).toEqual([]);
  });

  it("manifestのtotalChecksum改ざんを検出する", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const tampered = { ...artifact, manifest: { ...artifact.manifest, totalChecksum: "tampered" } };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: tampered, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("manifestのsourceMetadataChecksum改ざんを検出する", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const tampered = { ...artifact, manifest: { ...artifact.manifest, sourceMetadataChecksum: "tampered" } };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: tampered, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("manifestの件数改ざんを検出する(row count mismatch)", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const tampered = { ...artifact, manifest: { ...artifact.manifest, rowCounts: { ...artifact.manifest.rowCounts, managers: 999 } } };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: tampered, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("Backup本体からテーブルが1つ欠落している場合を検出する(missing table時拒否)", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    // 復号後のpayloadを直接改ざんすることはできないため、FakeEncryptorをラップして
    // 復号結果からテーブルを1つ間引く不正なdecryptorで再現する。
    const decryptor: BackupEncryptor = {
      algorithmId: "tamper-missing-table",
      encrypt: async (p) => p,
      decrypt: async (c) => {
        const inner = new FakeEncryptor();
        const decrypted = await inner.decrypt(c);
        const payload = JSON.parse(decrypted.toString("utf8"));
        delete payload.tables.managers;
        return Buffer.from(JSON.stringify(payload), "utf8");
      },
    };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor, expectedSchemaVersion: SCHEMA_VERSION, expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("テーブル集合"))).toBe(true);
  });

  it("Backup本体に想定外のテーブルが混入している場合を検出する(unexpected table時拒否)", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const decryptor: BackupEncryptor = {
      algorithmId: "tamper-unexpected-table",
      encrypt: async (p) => p,
      decrypt: async (c) => {
        const inner = new FakeEncryptor();
        const decrypted = await inner.decrypt(c);
        const payload = JSON.parse(decrypted.toString("utf8"));
        payload.tables.my_team_snapshots = [{ id: "x" }];
        return Buffer.from(JSON.stringify(payload), "utf8");
      },
    };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor, expectedSchemaVersion: SCHEMA_VERSION, expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("schemaVersion不一致は書込み前にblockedとなる(evaluateRestorePreflightGatesと連動)", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor: new FakeEncryptor(), expectedSchemaVersion: "wrong-version",
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(restoreClient.calls).toEqual([]);
  });

  it("PostgreSQL major version不一致は安全に停止し、Restore先へ一切書き込まない", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: 17, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(restoreClient.calls).toEqual([]);
  });

  it("Restore中の書込み失敗時はrollbackし、restoreVerified=falseとなる", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const restoreClient = new FakeRestoreClient();
    restoreClient.failOn = /^insert into reference_data_backup_restore_test\.managers/i;
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.ok).toBe(false);
    expect(result.restoreVerified).toBe(false);
    expect(restoreClient.calls).toContain("rollback");
  });

  it("Restore失敗時、manifestはbackupStatus=failedとなる(Production apply-ready判定と連動)", async () => {
    const artifact = await buildValidArtifact(new FakeEncryptor());
    const tampered = { ...artifact, manifest: { ...artifact.manifest, totalChecksum: "tampered" } };
    const restoreClient = new FakeRestoreClient();
    const result = await restoreReferenceDataBackup(restoreClient, {
      artifact: tampered, decryptor: new FakeEncryptor(), expectedSchemaVersion: SCHEMA_VERSION,
      expectedPostgresMajorVersion: PG_MAJOR, now: new Date(),
    });
    expect(result.manifest!.backupStatus).toBe("failed");
    expect(result.manifest).toEqual(markManifestFailed(tampered.manifest));
  });
});
