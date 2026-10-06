import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * F-053 公開 ID・プロフィールの migration の提案（docs/production-readiness/sql/create-public-profiles-schema.sql）を、
 * CI の使い捨て PostgreSQL に適用して確かめる（実 Supabase・Production へは接続しない）。
 * `auth.uid()`・`auth.users`・anon / authenticated の役割は、無い場合だけ最小の代役を作り、終了時に自分で作ったものだけ消す。
 */
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const APPLY = readFileSync(path.join(SQL_DIR, "create-public-profiles-schema.sql"), "utf8");
const ROLLBACK = readFileSync(path.join(SQL_DIR, "rollback-public-profiles-schema.sql"), "utf8");

const A = "a1111111-1111-4111-8111-111111111111";
const B = "b2222222-2222-4222-8222-222222222222";
const C = "c3333333-3333-4333-8333-333333333333";

let admin: Client;
let connected = false;
const created = { anon: false, authenticated: false, authSchema: false, authUid: false };

type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
async function as<T>(client: Client, uid: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const out = await fn((sql, params) => client.query(sql, params as unknown[]));
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? "error";
  }
}
const claim = (uid: string, id: string, visibility = "public") => as(admin, uid, (q) => q("insert into public.public_profiles (public_id, display_name, visibility) values ($1, $2, $3)", [id, `name ${id}`, visibility]));

beforeAll(async () => {
  admin = new Client(buildTestOnlyPgConfigFromEnv(process.env));
  await admin.connect();
  connected = true;
  for (const role of ["anon", "authenticated"] as const) {
    const e = await admin.query("select to_regrole($1) is not null as e", [role]);
    if (!e.rows[0].e) {
      await admin.query(`create role ${role} nologin noinherit`);
      created[role] = true;
    }
  }
  const auth = await admin.query("select exists (select 1 from pg_namespace where nspname = 'auth') as e");
  if (!auth.rows[0].e) {
    await admin.query("create schema auth");
    await admin.query("create table auth.users (id uuid primary key, email text)");
    created.authSchema = true;
  }
  const uid = await admin.query("select to_regprocedure('auth.uid()') is not null as e");
  if (!uid.rows[0].e) {
    await admin.query("create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
    created.authUid = true;
  }
  await admin.query("grant usage on schema auth to anon, authenticated");
  await admin.query("grant execute on function auth.uid() to anon, authenticated");
  await admin.query("grant usage on schema public to anon, authenticated");
  await admin.query("insert into auth.users (id) values ($1), ($2), ($3) on conflict do nothing", [A, B, C]);
  await admin.query(APPLY);
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  await admin.query(ROLLBACK).catch(() => undefined);
  if (created.authSchema) await admin.query("drop schema if exists auth cascade");
  else {
    await admin.query("delete from auth.users where id in ($1, $2, $3)", [A, B, C]).catch(() => undefined);
    if (created.authUid) await admin.query("drop function if exists auth.uid()");
  }
  for (const role of ["anon", "authenticated"] as const) {
    if (created[role]) {
      await admin.query(`drop owned by ${role}`);
      await admin.query(`drop role ${role}`);
    }
  }
  await admin.end();
}, 60_000);

describe("F-053 公開 ID（使い捨て PostgreSQL・実際の RLS と制約）", () => {
  it("形式・予約語・正規化されていない ID を DB でも拒否する", async () => {
    expect(await codeOf(claim(A, "Taro_01"))).toBe("23514"); // 大文字（正規化はアプリ・DB は小文字だけ）
    expect(await codeOf(claim(A, "ab"))).toBe("23514");
    expect(await codeOf(claim(A, "taro__01"))).toBe("23514");
    expect(await codeOf(claim(A, "taro_"))).toBe("23514");
    expect(await codeOf(claim(A, "admin"))).toBe("P0001");
    expect(await codeOf(claim(A, "taro_01"))).toBe("ok");
  });

  it("同時の登録: 同じ ID は 1 人だけ（もう 1 人は一意の違反）", async () => {
    const other = new Client(buildTestOnlyPgConfigFromEnv(process.env));
    await other.connect();
    try {
      await other.query("begin");
      await other.query("set local role authenticated");
      await other.query("select set_config('request.jwt.claim.sub', $1, true)", [B]);
      await other.query("insert into public.public_profiles (public_id, display_name, visibility) values ('race_id', 'B', 'public')");
      // B の transaction が未確定のまま、C が同じ ID を登録しようとする → B の確定を待ち、一意の違反になる
      const cTry = codeOf(as(admin, C, (q) => q("insert into public.public_profiles (public_id, display_name, visibility) values ('race_id', 'C', 'public')")));
      await new Promise((r) => setTimeout(r, 300));
      await other.query("commit");
      expect(await cTry).toBe("23505");
    } finally {
      await other.end();
    }
  });

  it("anon は表も検索も使えない（列挙の防止）", async () => {
    expect(await codeOf(as(admin, null, (q) => q("select public_id from public.public_profiles")))).toBe("42501");
    expect(await codeOf(as(admin, null, (q) => q("select * from public.search_public_profiles('tar')")))).toBe("42501");
  });

  it("他人の user_id（内部の UUID）は読めない・公開の ID と表示名は読める", async () => {
    expect(await codeOf(as(admin, C, (q) => q("select user_id from public.public_profiles")))).toBe("42501");
    const rows = await as(admin, C, (q) => q("select public_id, display_name from public.public_profiles where public_id = 'taro_01'"));
    expect(rows.rows).toHaveLength(1);
  });

  it("非公開・ブロック（どちらの向きでも）は見えない・検索にも出ない", async () => {
    await as(admin, C, (q) => q("update public.public_profiles set visibility = 'private' where true"));
    const fromA = await as(admin, A, (q) => q("select public_id from public.public_profiles where public_id = 'race_id'"));
    expect(fromA.rows).toHaveLength(1); // B の race_id は公開
    // B が A をブロック → A から B は見えない（A は B のブロックの行を読めないが、関係は効く）
    await as(admin, B, (q) => q("insert into public.user_blocks (blocked_id) values ($1)", [A]));
    const afterBlock = await as(admin, A, (q) => q("select public_id from public.public_profiles where public_id = 'race_id'"));
    expect(afterBlock.rows).toHaveLength(0);
    const search = await as(admin, A, (q) => q("select public_id from public.search_public_profiles('rac')"));
    expect(search.rows).toHaveLength(0);
    const ownBlocks = await as(admin, A, (q) => q("select * from public.user_blocks"));
    expect(ownBlocks.rows).toHaveLength(0); // 相手のブロックの行そのものは見えない
  });

  it("検索: 2 文字以下は 0 件・前方一致・最大 20 件・% や _ を特別扱いしない", async () => {
    const two = await as(admin, C, (q) => q("select * from public.search_public_profiles('ta')"));
    expect(two.rows).toHaveLength(0);
    const pct = await as(admin, C, (q) => q("select * from public.search_public_profiles('%%%')"));
    expect(pct.rows).toHaveLength(0);
    const hit = await as(admin, C, (q) => q("select public_id from public.search_public_profiles('taro')"));
    expect(hit.rows.map((r) => r.public_id)).toEqual(["taro_01"]);
  });

  it("変更は 30 日に 1 回・手放した ID は 90 日間ほかの人が使えない", async () => {
    expect(await codeOf(as(admin, A, (q) => q("update public.public_profiles set public_id = 'taro_02' where true")))).toBe("P0002");
    await admin.query("update public.public_profiles set public_id_changed_at = now() - interval '31 days' where user_id = $1", [A]);
    expect(await codeOf(as(admin, A, (q) => q("update public.public_profiles set public_id = 'taro_02' where true")))).toBe("ok");
    expect(await codeOf(claim(C, "taro_01"))).not.toBe("ok"); // C はすでに行がある（主キー）
    await admin.query("delete from public.public_profiles where user_id = $1", [C]);
    expect(await codeOf(claim(C, "taro_01"))).toBe("P0003"); // A が手放してから 90 日以内
  });

  it("退会（soft delete）で ID を手放す・本人以外は 90 日使えない・行は見えなくなる", async () => {
    await as(admin, B, (q) => q("update public.public_profiles set deleted_at = now() where true"));
    const seen = await as(admin, C, (q) => q("select public_id from public.public_profiles where public_id = 'race_id'"));
    expect(seen.rows).toHaveLength(0);
    expect(await codeOf(claim(C, "race_id"))).toBe("P0003");
  });

  it("他人の行は更新できない（RLS）", async () => {
    const r = await as(admin, C, (q) => q("update public.public_profiles set display_name = 'x' where public_id = 'taro_02'"));
    expect(r.rowCount).toBe(0);
  });

  it("戻し（rollback）で作ったものが全部消え、もう一度適用できる", async () => {
    await admin.query(ROLLBACK);
    const left = await admin.query("select to_regclass('public.public_profiles') as t, to_regclass('public.user_blocks') as b, to_regprocedure('public.search_public_profiles(text)') as f");
    expect(left.rows[0]).toEqual({ t: null, b: null, f: null });
    await admin.query(APPLY);
    const again = await admin.query("select to_regclass('public.public_profiles') is not null as t");
    expect(again.rows[0].t).toBe(true);
  });
});
