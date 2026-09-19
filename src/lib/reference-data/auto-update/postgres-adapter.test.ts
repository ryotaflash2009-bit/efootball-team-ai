import { describe, it, expect } from "vitest";
import {
  assertSafeTestConnectionTarget,
  buildTestOnlyPgConfigFromEnv,
  createPostgresQueryClient,
  type MinimalPgClient,
} from "./postgres-adapter";

/**
 * 接続安全性の検証とプレースホルダー変換ロジックは、実PostgreSQLへ一切接続せずに
 * 検証できる(フェイクの`MinimalPgClient`だけを使う)。通常の`npx vitest run`で
 * 常に実行される(PostgreSQL未インストールの環境でも成功する)。
 */
describe("assertSafeTestConnectionTarget", () => {
  const base = { host: "localhost", port: 5432, user: "u", password: "p", database: "phase2_test_db" };

  it("localhost + ホワイトリストDB名は許可", () => {
    expect(() => assertSafeTestConnectionTarget(base)).not.toThrow();
  });

  it("127.0.0.1も許可", () => {
    expect(() => assertSafeTestConnectionTarget({ ...base, host: "127.0.0.1" })).not.toThrow();
  });

  it("localhost/127.0.0.1以外のホストは拒否", () => {
    expect(() => assertSafeTestConnectionTarget({ ...base, host: "example.com" })).toThrow();
  });

  it("Supabaseホスト名は拒否", () => {
    expect(() => assertSafeTestConnectionTarget({ ...base, host: "db.abcxyz.supabase.co" })).toThrow();
  });

  it("Supabaseという語を含むデータベース名は拒否", () => {
    expect(() => assertSafeTestConnectionTarget({ ...base, database: "supabase_prod" })).toThrow();
  });

  it("ホワイトリスト外のデータベース名は拒否", () => {
    expect(() => assertSafeTestConnectionTarget({ ...base, database: "production" })).toThrow();
  });
});

describe("buildTestOnlyPgConfigFromEnv", () => {
  it("必須環境変数が揃っていれば設定を組み立てる", () => {
    const config = buildTestOnlyPgConfigFromEnv({
      PHASE2_TEST_PG_HOST: "localhost",
      PHASE2_TEST_PG_PORT: "55432",
      PHASE2_TEST_PG_USER: "phase2_test_user",
      PHASE2_TEST_PG_PASSWORD: "test-password",
      PHASE2_TEST_PG_DATABASE: "phase2_test_db",
    });
    expect(config).toEqual({ host: "localhost", port: 55432, user: "phase2_test_user", password: "test-password", database: "phase2_test_db" });
  });

  it("PHASE2_TEST_PG_USERが無ければ拒否", () => {
    expect(() =>
      buildTestOnlyPgConfigFromEnv({ PHASE2_TEST_PG_PASSWORD: "x", PHASE2_TEST_PG_DATABASE: "phase2_test_db" }),
    ).toThrow();
  });

  it("既存のSupabase/Production環境変数は一切参照しない(未設定でもエラーにならず、無関係な値を混入させない)", () => {
    const config = buildTestOnlyPgConfigFromEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://should-not-be-read.supabase.co",
      PHASE2_TEST_PG_USER: "phase2_test_user",
      PHASE2_TEST_PG_PASSWORD: "test-password",
      PHASE2_TEST_PG_DATABASE: "phase2_test_db",
    });
    expect(config.host).toBe("localhost");
    expect(JSON.stringify(config)).not.toMatch(/supabase/i);
  });

  it("Supabaseホスト名を明示的に渡すとassertSafeTestConnectionTarget側で拒否される", () => {
    expect(() =>
      buildTestOnlyPgConfigFromEnv({
        PHASE2_TEST_PG_HOST: "db.abcxyz.supabase.co",
        PHASE2_TEST_PG_USER: "u",
        PHASE2_TEST_PG_PASSWORD: "p",
        PHASE2_TEST_PG_DATABASE: "phase2_test_db",
      }),
    ).toThrow();
  });
});

describe("createPostgresQueryClient", () => {
  class FakePgClient implements MinimalPgClient {
    calls: Array<{ sql: string; params?: unknown[] }> = [];
    async query(sql: string, params?: unknown[]) {
      this.calls.push({ sql, params });
      if (/^set search_path/i.test(sql)) return { rows: [] };
      if (/^select/i.test(sql)) {
        return { rows: [{ id: "wc-1", fields_json: { nameEn: "A", ovrMax: 80 } }] }; // jsonbは自動パースされ、objectとして返る想定
      }
      return { rows: [] };
    }
  }

  it("?プレースホルダーを$1,$2,...へ変換する", async () => {
    const fake = new FakePgClient();
    const client = createPostgresQueryClient(fake);
    await client.query("insert into target_records (record_id, fields_json) values (?, ?)", ["wc-1", "{}"]);
    const insertCall = fake.calls.find((c) => /^insert/i.test(c.sql));
    expect(insertCall?.sql).toBe("insert into target_records (record_id, fields_json) values ($1, $2)");
  });

  it("初回query時にsearch_pathを一度だけ設定する", async () => {
    const fake = new FakePgClient();
    const client = createPostgresQueryClient(fake);
    await client.query("select 1");
    await client.query("select 2");
    expect(fake.calls.filter((c) => /^set search_path/i.test(c.sql)).length).toBe(1);
  });

  it("begin/commit/rollbackはそのまま渡す(プレースホルダー変換の対象にしない)", async () => {
    const fake = new FakePgClient();
    const client = createPostgresQueryClient(fake);
    await client.query("begin");
    await client.query("commit");
    expect(fake.calls.some((c) => c.sql === "begin")).toBe(true);
    expect(fake.calls.some((c) => c.sql === "commit")).toBe(true);
  });

  it("jsonb列(objectとして返る)をJSON文字列へ正規化する(SQLite adapterとの契約を揃える)", async () => {
    const fake = new FakePgClient();
    const client = createPostgresQueryClient(fake);
    const result = await client.query("select record_id as id, fields_json from target_records");
    expect(typeof result.rows[0].fields_json).toBe("string");
    expect(JSON.parse(result.rows[0].fields_json as string)).toEqual({ nameEn: "A", ovrMax: 80 });
  });
});
