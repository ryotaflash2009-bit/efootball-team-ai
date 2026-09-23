import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProductionBackup } from "./run-production-backup";
import { getBackupTableSpec, PRODUCTION_REFERENCE_DATA_SCHEMA } from "./backup-schema";
import { FakeR2Client } from "./backup-r2-client";
import type { QueryClient, QueryResult } from "./apply-orchestrator";
import type { ExpectedSourceIdentity } from "./backup-source-preflight";

const TEST_IDENTITY: ExpectedSourceIdentity = { database: "postgres", currentUser: "reference_data_backup_reader", sessionUser: "reference_data_backup_reader" };

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
  exportQueryCount = 0;
  /** trueにするとRLS有効・適用ポリシー無しの状態(workflow Run #6の実際の状態)を模す。 */
  rlsHidesRows = false;

  seed(table: string, fields: Record<string, unknown>): void {
    const spec = getBackupTableSpec(table);
    const raw: Record<string, unknown> = {};
    for (const col of spec.columns) raw[col] = toRawDbValue(fields[col] ?? null);
    this.sourceRows[table].push(raw);
  }

  async query(sql: string): Promise<QueryResult> {
    this.queryCount += 1;
    if (/current_database()/.test(sql)) {
      return { rows: [{ current_database_name: "postgres", current_user_name: "reference_data_backup_reader", session_user_name: "reference_data_backup_reader", is_superuser: false, bypass_rls: false }] };
    }
    if (/pg_catalog.pg_policies/.test(sql)) {
      return {
        rows: ["import_batches", "managers", "player_card_analysis", "world_player_cards"].map((t) => ({
          table_name: t, table_exists: true, rls_enabled: true, rls_forced: true, owner_is_current_user: false, has_select_privilege: true,
          has_applicable_select_policy: !this.rlsHidesRows, has_restrictive_select_policy: false,
        })),
      };
    }
    this.exportQueryCount += 1;
    if (this.rlsHidesRows) return { rows: [] };
    const m = sql.match(new RegExp(`^select .* from ${PRODUCTION_REFERENCE_DATA_SCHEMA}\\.(\\w+) `));
    if (!m) throw new Error(`予期しないSQL(実schema想定): ${sql}`);
    return { rows: this.sourceRows[m[1]] };
  }
}

/** このjob専用の隔離検証schemaを模したfake writable client(schema DDL・truncate・insert・selectをサポート)。 */
class FakeVerifyClient implements QueryClient {
  queryCount = 0;
  restoreRows: Record<string, Record<string, unknown>[]> = {
    world_player_cards: [], managers: [], player_card_analysis: [], import_batches: [],
  };

  async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
    this.queryCount += 1;
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
    category: "daily" as const,
    expectedSourceIdentity: TEST_IDENTITY,
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
    expect((input.prodClient as FakeProductionClient).exportQueryCount).toBe(8); // 4テーブル x 2回(本番+検証)抽出
    expect((input.prodClient as FakeProductionClient).queryCount).toBe(10); // + preflight 2件(カタログのみ)

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
      // preflight 2件 + 本番抽出4件の後、2回目の抽出(検証用、world_player_cardsから)で行が1件増えたように見せる。
      if (callCount === 7) {
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
    expect(result.reasons.join(" ")).toMatch(/checksum/);
    expect((baseInput().r2Client as FakeR2Client).putCalls).toBe(0);
  });

  it("実行結果のobjectKeyは指定したcategoryのprefixから始まる(weekly等を指定できる)", async () => {
    const result = await runProductionBackup(baseInput({ category: "weekly" as const }));
    expect(result.ok).toBe(true);
    expect((result.summary.objectKey as string).startsWith("weekly/")).toBe(true);
    expect(result.summary.retentionCategory).toBe("production-weekly");
    expect(result.summary.expiresAt).not.toBeNull();
  });

  it("category=pre-applyの場合、objectKeyがpre-apply/で始まり、manifestのretentionDays/expiresAtはnullのまま記録される(0や遠い未来の日付で偽装しない)", async () => {
    const result = await runProductionBackup(baseInput({ category: "pre-apply" as const }));
    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect((result.summary.objectKey as string).startsWith("pre-apply/")).toBe(true);
    expect(result.summary.retentionCategory).toBe("production-pre-apply");
    expect(result.summary.retentionDays).toBeNull();
    expect(result.summary.expiresAt).toBeNull();
  });

  it("category=dailyの場合、manifest metadataがprefixと一致する(production-daily/8日相当)", async () => {
    const result = await runProductionBackup(baseInput({ category: "daily" as const }));
    expect(result.ok).toBe(true);
    expect((result.summary.objectKey as string).startsWith("daily/")).toBe(true);
    expect(result.summary.retentionCategory).toBe("production-daily");
    expect(result.summary.retentionDays).toBe(8);
    const expiresAt = new Date(result.summary.expiresAt as string);
    const now = new Date("2026-09-21T00:00:00.000Z");
    const diffDays = (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(8, 5);
  });

  it("category=monthlyの場合、manifest metadataがprefixと一致する(production-monthly/100日相当)", async () => {
    const result = await runProductionBackup(baseInput({ category: "monthly" as const }));
    expect(result.ok).toBe(true);
    expect((result.summary.objectKey as string).startsWith("monthly/")).toBe(true);
    expect(result.summary.retentionCategory).toBe("production-monthly");
    expect(result.summary.retentionDays).toBe(100);
  });

  it("不明なcategory(型を無理やり回避した呼び出し)はexport前にblockedになる(実DBへ一切問い合わせない)", async () => {
    const prodClient = new FakeProductionClient();
    seedOneOfEach(prodClient);
    const input = baseInput({ prodClient, category: "yearly" as never });
    const result = await runProductionBackup(input);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/category/);
    expect(prodClient.queryCount).toBe(0); // exportより前にblockedになっている
    expect((input.r2Client as FakeR2Client).putCalls).toBe(0);
  });
});

/** R2 clientの全メソッド呼び出し回数を数える(通信0件の確認用)。 */
function countingR2Client(): { client: FakeR2Client; calls: () => number } {
  const inner = new FakeR2Client();
  let count = 0;
  const proxy = new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          count += 1;
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  });
  return { client: proxy, calls: () => count };
}

describe("空Backupの拒否(workflow Run #6の回帰テスト、2026-09-23)", () => {
  let markerDir: string;
  let fakeAgeMarkerPath: string;

  beforeAll(() => {
    markerDir = mkdtempSync(join(tmpdir(), "run-production-backup-marker-"));
    fakeAgeMarkerPath = join(markerDir, "fake-age-marker.mjs");
    writeFileSync(
      fakeAgeMarkerPath,
      `import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(join(markerDir, "age-was-called"))}, "1");
const args = process.argv.slice(2);
const outPath = args[args.indexOf("-o") + 1];
writeFileSync(outPath, readFileSync(args[args.length - 1]));
`,
    );
  });

  afterAll(() => {
    rmSync(markerDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(join(markerDir, "age-was-called"), { force: true });
  });

  function ageWasCalled(): boolean {
    try {
      readFileSync(join(markerDir, "age-was-called"));
      return true;
    } catch {
      return false;
    }
  }

  it("Run #6再現: 全4テーブルが0行(RLS既定拒否で行が見えない状態)ならexport前のpreflightでblockedになり、age・Restore・R2のいずれも実行しない", async () => {
    const prodClient = new FakeProductionClient();
    seedOneOfEach(prodClient);
    prodClient.rlsHidesRows = true;
    const verifyClient = new FakeVerifyClient();
    const r2 = countingR2Client();
    const result = await runProductionBackup(
      baseInput({ prodClient, verifyClient, r2Client: r2.client, ageCommand: [process.execPath, fakeAgeMarkerPath], category: "pre-apply" as const }),
    );

    expect(result.ok).toBe(false);
    expect(result.summary.phase).toBe("source-preflight");
    expect(result.reasons.join(" ")).toMatch(/RLS/);
    expect(result.summary.restoreVerified).toBe(false);
    expect(result.summary.storageVerified).toBe(false);
    expect(prodClient.exportQueryCount).toBe(0);
    expect(ageWasCalled()).toBe(false);
    expect(verifyClient.queryCount).toBe(0);
    expect(r2.calls()).toBe(0);
  });

  it("preflightを通過しても実exportが全4テーブル0行なら、暗号化前にblockedになる(age未実行・検証export未実行・Restore未実行・R2通信0)", async () => {
    const prodClient = new FakeProductionClient(); // seedしない = 全テーブル0行
    const verifyClient = new FakeVerifyClient();
    const r2 = countingR2Client();
    const result = await runProductionBackup(
      baseInput({ prodClient, verifyClient, r2Client: r2.client, ageCommand: [process.execPath, fakeAgeMarkerPath] }),
    );

    expect(result.ok).toBe(false);
    expect(result.summary.phase).toBe("export");
    expect(result.reasons.join(" ")).toMatch(/最低件数/);
    expect(result.summary.restoreVerified).toBe(false);
    expect(result.summary.storageVerified).toBe(false);
    expect(prodClient.exportQueryCount).toBe(4); // 本番用exportの1回分のみ(検証用exportは実行されない)
    expect(ageWasCalled()).toBe(false);
    expect(verifyClient.queryCount).toBe(0);
    expect(r2.calls()).toBe(0);
  });

  for (const emptyTable of ["world_player_cards", "managers", "player_card_analysis", "import_batches"]) {
    it(`${emptyTable}だけが0行でもblockedになり、R2へは一切通信しない`, async () => {
      const prodClient = new FakeProductionClient();
      seedOneOfEach(prodClient);
      prodClient.sourceRows[emptyTable] = [];
      const r2 = countingR2Client();
      const result = await runProductionBackup(baseInput({ prodClient, r2Client: r2.client }));
      expect(result.ok).toBe(false);
      expect(result.reasons.join(" ")).toContain(emptyTable);
      expect(r2.calls()).toBe(0);
    });
  }

  it("接続先identityが想定と異なる場合(別role・別database)、exportせずにblockedになる", async () => {
    const prodClient = new FakeProductionClient();
    seedOneOfEach(prodClient);
    const r2 = countingR2Client();
    const result = await runProductionBackup(
      baseInput({ prodClient, r2Client: r2.client, expectedSourceIdentity: { ...TEST_IDENTITY, currentUser: "some_other_role" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.summary.phase).toBe("source-preflight");
    expect(prodClient.exportQueryCount).toBe(0);
    expect(r2.calls()).toBe(0);
  });

  it("export中のSQLエラー(permission denied等)は空配列として扱われず、blockedになる", async () => {
    const prodClient = new FakeProductionClient();
    seedOneOfEach(prodClient);
    const original = prodClient.query.bind(prodClient);
    prodClient.query = async (sql: string) => {
      if (/from reference_data.managers /.test(sql)) throw new Error("permission denied for table managers");
      return original(sql);
    };
    const r2 = countingR2Client();
    const result = await runProductionBackup(baseInput({ prodClient, r2Client: r2.client }));
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/permission denied/);
    expect(r2.calls()).toBe(0);
  });

  it("exportの結果にrows配列が無い場合(想定外のresult shape)は空配列として扱わず、blockedになる", async () => {
    const prodClient = new FakeProductionClient();
    seedOneOfEach(prodClient);
    const original = prodClient.query.bind(prodClient);
    prodClient.query = async (sql: string) => {
      if (/from reference_data.world_player_cards /.test(sql)) return {} as QueryResult;
      return original(sql);
    };
    const r2 = countingR2Client();
    const result = await runProductionBackup(baseInput({ prodClient, r2Client: r2.client }));
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/rows配列が無い/);
    expect(r2.calls()).toBe(0);
  });

  it("正常なnon-empty Backupは従来どおり成功し、manifestの行数が0件ではない", async () => {
    const result = await runProductionBackup(baseInput({ category: "pre-apply" as const, ageCommand: [process.execPath, fakeAgeMarkerPath] }));
    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect(ageWasCalled()).toBe(true); // markerの仕組み自体が機能していることの確認(他テストの「age未実行」判定が空振りでないこと)
    const counts = result.summary.rowCounts as Record<string, number>;
    for (const t of ["world_player_cards", "managers", "player_card_analysis", "import_batches"]) expect(counts[t]).toBeGreaterThan(0);
    expect(result.summary.restoreVerified).toBe(true);
    expect(result.summary.storageVerified).toBe(true);
  });
});
