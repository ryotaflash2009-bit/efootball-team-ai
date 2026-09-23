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

  it("paramsが空の場合、複数文をまとめたDDL文字列でも(rowsがundefinedを返すfakeでも)クラッシュしない(2026-09-21修正の回帰テスト)", async () => {
    class FakeDdlPgClient implements MinimalPgClient {
      calls: Array<{ sql: string; paramsGiven: boolean }> = [];
      async query(sql: string, params?: unknown[]) {
        this.calls.push({ sql, paramsGiven: params !== undefined });
        if (/^set search_path/i.test(sql)) return { rows: [] };
        // 実PostgreSQL統合試験で実際に観測した不具合を再現する: 複数文を
        // まとめたDDLをparameterized protocol(第2引数あり)で渡すと
        // rowsがundefinedになるfakeの挙動。
        if (params !== undefined) return { rows: undefined as unknown as Array<Record<string, unknown>> };
        return { rows: [] };
      }
    }
    const fake = new FakeDdlPgClient();
    const client = createPostgresQueryClient(fake);
    const multiStatementDdl = "create schema if not exists x;\ncreate table if not exists x.a (id text);\ncreate table if not exists x.b (id text);";
    await expect(client.query(multiStatementDdl)).resolves.toEqual({ rows: [] });
    const ddlCall = fake.calls.find((c) => /^create schema/i.test(c.sql));
    expect(ddlCall?.paramsGiven).toBe(false); // paramsを渡していない(simple query protocolのまま)ことを確認
  });

  it("driverが複数文の結果を配列で返す場合(最後の結果を採用する)", async () => {
    class FakeMultiResultPgClient implements MinimalPgClient {
      async query(sql: string) {
        if (/^set search_path/i.test(sql)) return { rows: [] };
        // 一部driver/versionではsimple protocolでの複数文実行結果が、単一objectではなく
        // 文ごとの結果を並べた配列として返る可能性がある(このセッションでは実際には
        // 未検証)。この形でも安全に扱えることを確認する。
        return [{ rows: [] }, { rows: [] }, { rows: [{ id: "last" }] }] as unknown as { rows: Array<Record<string, unknown>> };
      }
    }
    const fake = new FakeMultiResultPgClient();
    const client = createPostgresQueryClient(fake);
    const result = await client.query("create schema if not exists x; create table if not exists x.a (id text); select id from x.a;");
    expect(result.rows).toEqual([{ id: "last" }]);
  });

  it("jsonb列(objectとして返る)をJSON文字列へ正規化する(SQLite adapterとの契約を揃える)", async () => {
    const fake = new FakePgClient();
    const client = createPostgresQueryClient(fake);
    const result = await client.query("select record_id as id, fields_json from target_records");
    expect(typeof result.rows[0].fields_json).toBe("string");
    expect(JSON.parse(result.rows[0].fields_json as string)).toEqual({ nameEn: "A", ovrMax: 80 });
  });
});

describe("createPostgresQueryClient: 読み出し文の結果shape異常を空配列へ変換しない(workflow Run #6の回帰テスト、2026-09-23)", () => {
  function fakeReturning(result: unknown): MinimalPgClient & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      async query(sql: string) {
        calls.push(sql);
        if (/^set search_path/i.test(sql)) return { rows: [] };
        return result as { rows: Array<Record<string, unknown>> };
      },
    };
  }

  it("select結果がundefinedなら例外", async () => {
    await expect(createPostgresQueryClient(fakeReturning(undefined)).query("select id from reference_data.managers")).rejects.toThrow(/rows配列/);
  });

  it("select結果にrowsが無い・rowsが配列でないなら例外", async () => {
    await expect(createPostgresQueryClient(fakeReturning({})).query("select 1")).rejects.toThrow(/rows配列/);
    await expect(createPostgresQueryClient(fakeReturning({ rows: null })).query("select 1")).rejects.toThrow(/rows配列/);
    await expect(createPostgresQueryClient(fakeReturning({ rows: "x" })).query("with a as (select 1) select * from a")).rejects.toThrow(/rows配列/);
  });

  it("select結果が複数文の結果配列(想定外のshape)なら例外(最後の要素を黙って採用しない)", async () => {
    await expect(createPostgresQueryClient(fakeReturning([{ rows: [] }, { rows: [] }])).query("select 1")).rejects.toThrow(/複数文/);
  });

  it("正常なselect結果の0行は、そのまま0行として返す(0行自体はここでは拒否しない、内容妥当性は別ゲートが判定する)", async () => {
    await expect(createPostgresQueryClient(fakeReturning({ rows: [] })).query("select 1")).resolves.toEqual({ rows: [] });
  });

  it("SQLエラー(permission denied等)はそのまま例外として伝播し、空配列にならない", async () => {
    const failing: MinimalPgClient = {
      async query(sql: string) {
        if (/^set search_path/i.test(sql)) return { rows: [] };
        throw new Error("permission denied for table managers");
      },
    };
    await expect(createPostgresQueryClient(failing).query("select id from reference_data.managers")).rejects.toThrow(/permission denied/);
  });

  it("setTestSearchPath: falseの場合、Production接続へテスト用search_pathを一切設定しない", async () => {
    const fake = fakeReturning({ rows: [] });
    await createPostgresQueryClient(fake, { setTestSearchPath: false }).query("select 1");
    expect(fake.calls.some((c) => /search_path/i.test(c))).toBe(false);
  });
});
