import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProductionBackup } from "./run-production-backup";
import { getBackupTableSpec, PRODUCTION_REFERENCE_DATA_SCHEMA } from "./backup-schema";
import { FakeR2Client } from "./backup-r2-client";
import type { QueryClient, QueryResult } from "./apply-orchestrator";

/**
 * `runProductionBackup`の全体オーケストレーション(export→検証専用artifact抽出→
 * 隔離Restore検証→本番manifestへのrestoreVerified反映→R2 upload)を、fakeだけで
 * end-to-endに検証する。実PostgreSQL・実R2・実ageバイナリのいずれにも依存しない
 * (実PostgreSQLでの検証は`run-production-backup.postgres.test.ts`が別途担当する)。
 */

const RECIPIENT = "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

let scratchDir: string;
let fakeAgeSuccessPath: string;
let fakeAgeFailurePath: string;

beforeAll(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "run-production-backup-test-"));
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
  fakeAgeFailurePath = join(scratchDir, "fake-age-failure.mjs");
  writeFileSync(fakeAgeFailurePath, `process.stderr.write("fake age failure\\n"); process.exit(1);\n`);
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

function toRawDbValue(v: unknown): unknown {
  return v !== null && v !== undefined && typeof v === "object" ? JSON.stringify(v) : v ?? null;
}

/** Production `reference_data`を模したfake read-only client。 */
class FakeProductionClient implements QueryClient {
  sourceRows: Record<string, Record<string, unknown>[]> = {
    world_player_cards: [], managers: [], player_card_analysis: [], import_batches: [],
  };
  queryCount = 0;

  seed(table: string, fields: Record<string, unknown>): void {
    const spec = getBackupTableSpec(table);
    const raw: Record<string, unknown> = {};
    for (const col of spec.columns) raw[col] = toRawDbValue(fields[col] ?? null);
    this.sourceRows[table].push(raw);
  }

  async query(sql: string): Promise<QueryResult> {
    this.queryCount += 1;
    const m = sql.match(new RegExp(`^select .* from ${PRODUCTION_REFERENCE_DATA_SCHEMA}\\.(\\w+) `));
    if (!m) throw new Error(`予期しないSQL(実schema想定): ${sql}`);
    return { rows: this.sourceRows[m[1]] };
  }
}

/** このjob専用の隔離検証schemaを模したfake writable client(schema DDL・truncate・insert・selectをサポート)。 */
class FakeVerifyClient implements QueryClient {
  restoreRows: Record<string, Record<string, unknown>[]> = {
    world_player_cards: [], managers: [], player_card_analysis: [], import_batches: [],
  };

  async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
    const trimmed = sql.trim();
    const lower = trimmed.toLowerCase();
    if (/^create schema/i.test(trimmed) || /^create table/i.test(trimmed) || lower.startsWith("comment on")) return { rows: [] };
    if (lower === "begin" || lower === "commit" || lower === "rollback") return { rows: [] };

    if (/^truncate table\b/i.test(trimmed)) {
      const tables = [...trimmed.matchAll(/reference_data_backup_restore_test\.(\w+)/gi)].map((m) => m[1]);
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
    if (selectMatch) return { rows: this.restoreRows[selectMatch[1]] };

    throw new Error(`予期しないSQL(検証schema想定): ${trimmed}`);
  }
}

function seedOneOfEach(client: FakeProductionClient): void {
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

function baseInput(overrides: Partial<Parameters<typeof runProductionBackup>[0]> = {}) {
  const prodClient = new FakeProductionClient();
  seedOneOfEach(prodClient);
  return {
    prodClient,
    verifyClient: new FakeVerifyClient(),
    r2Client: new FakeR2Client(),
    ageRecipient: RECIPIENT,
    ageCommand: [process.execPath, fakeAgeSuccessPath],
    jobId: "prod-job-1",
    now: new Date("2026-09-21T00:00:00.000Z"),
    schemaVersion: "2026-09-20",
    postgresMajorVersion: 16,
    applicationCommitSha: "0".repeat(40),
    retentionCategory: "production-standard" as const,
    retentionDays: 8,
    prefix: "daily/" as const,
    ...overrides,
  };
}

describe("runProductionBackup(fakeだけを使用、実Postgres・実R2・実ageはいずれも使わない)", () => {
  it("正常系: export→隔離Restore検証→R2 uploadまで成功し、restoreVerified=trueで保存される", async () => {
    const input = baseInput();
    const result = await runProductionBackup(input);

    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect(result.summary.storageVerified).toBe(true);
    expect(result.summary.restoreVerified).toBe(true);
    expect((input.r2Client as FakeR2Client).putCalls).toBe(2); // 暗号化payload + manifest
    expect((input.prodClient as FakeProductionClient).queryCount).toBe(8); // 4テーブル x 2回(本番+検証)抽出

    // uploadされたmanifestのrowCountsが実データと一致する。
    const objectKey = result.summary.objectKey as string;
    expect(objectKey.startsWith("daily/")).toBe(true);
    expect(objectKey.endsWith(".age")).toBe(true);
  });

  it("secretや復号鍵はsummaryへ一切出力されない", async () => {
    const result = await runProductionBackup(baseInput());
    const serialized = JSON.stringify(result.summary);
    expect(serialized).not.toContain(RECIPIENT);
    expect(serialized).not.toMatch(/AGE-SECRET-KEY/i);
    expect(serialized).not.toMatch(/postgres:\/\//i);
  });

  it("age実行が失敗する場合(実age未インストール・recipient不正等を模す)、exportフェーズでblockedになりR2へは一切書き込まない", async () => {
    const input = baseInput({ ageCommand: [process.execPath, fakeAgeFailurePath] });
    const result = await runProductionBackup(input);
    expect(result.ok).toBe(false);
    expect((input.r2Client as FakeR2Client).putCalls).toBe(0);
  });

  it("2回目の抽出(検証用)でtotalChecksumが異なる場合(抽出window中の書込みを模す)、blockedになりuploadしない", async () => {
    let callCount = 0;
    const prodClient = new FakeProductionClient();
    seedOneOfEach(prodClient);
    const originalQuery = prodClient.query.bind(prodClient);
    prodClient.query = async (sql: string) => {
      callCount += 1;
      // 5回目以降(2回目の抽出、world_player_cardsから)は行が1件増えたように見せる。
      if (callCount === 5) {
        prodClient.seed("world_player_cards", {
          world_card_id: "2", name_en: "Player Two", stats: {}, skills: [],
          source: "efootball-world.com", dataset_version: "v1", fetched_at: "2026-01-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
        });
      }
      return originalQuery(sql);
    };
    const result = await runProductionBackup(baseInput({ prodClient }));
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/totalChecksum/);
    expect((baseInput().r2Client as FakeR2Client).putCalls).toBe(0);
  });

  it("実行結果のobjectKeyは指定したprefixから始まる(weekly/等を指定できる)", async () => {
    const result = await runProductionBackup(baseInput({ prefix: "weekly/" as const }));
    expect(result.ok).toBe(true);
    expect((result.summary.objectKey as string).startsWith("weekly/")).toBe(true);
  });
});
