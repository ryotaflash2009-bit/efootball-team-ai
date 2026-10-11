import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * 保存スカッドのクラウド保存の提案（docs/production-readiness/sql/create-squads-cloud-schema.sql・2026-10-11・未適用）を
 * CI の使い捨て PostgreSQL に適用し、A/B の分離・制約・ロールバックを確かめる（実 Supabase・Production へは接続しない）。
 * auth スキーマ・auth.uid()・anon / authenticated は、無い場合だけ作り、終了時に自分で作ったものだけ消す。
 */
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const APPLY = readFileSync(path.join(SQL_DIR, "create-squads-cloud-schema.sql"), "utf8");
const ROLLBACK = readFileSync(path.join(SQL_DIR, "rollback-squads-cloud-schema.sql"), "utf8");

const A = "a7777777-7777-4777-8777-7777777777aa";
const B = "b8888888-8888-4888-8888-8888888888bb";
const HASH = "a".repeat(64);
const created = { anon: false, authenticated: false, authSchema: false, authUid: false };
let admin: Client;
let connected = false;
let tableExisted = false;

type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
async function as<T>(uid: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    await admin.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await admin.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const out = await fn((sql, params) => admin.query(sql, params as unknown[]) as never);
    await admin.query("commit");
    return out;
  } catch (e) {
    await admin.query("rollback");
    throw e;
  }
}
async function messageOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { message?: string }).message ?? "error";
  }
}
const builds = (n: number) => JSON.stringify({ items: Array.from({ length: n }, (_, i) => ({ squadId: `sq_${i}`, squadName: `S${i}` })) });
const save = (uid: string | null, n: number, userId: string | null = uid, itemCount = n) =>
  as(uid, (q) =>
    q(
      "insert into public.saved_squads_snapshots (user_id, schema_version, squads_data, item_count, payload_hash, client_updated_at) values ($1, 'squads-cloud/v1', $2::jsonb, $3, $4, now()) on conflict (user_id) do update set squads_data = excluded.squads_data, item_count = excluded.item_count returning user_id",
      [userId, builds(n), itemCount, HASH],
    ),
  );

beforeAll(async () => {
  admin = new Client(buildTestOnlyPgConfigFromEnv(process.env));
  await admin.connect();
  connected = true;
  tableExisted = (await admin.query("select to_regclass('public.saved_squads_snapshots') is not null as e")).rows[0].e;
  if (tableExisted) return;
  for (const role of ["anon", "authenticated"] as const) {
    if (!(await admin.query("select to_regrole($1) is not null as e", [role])).rows[0].e) {
      await admin.query(`create role ${role} nologin noinherit`);
      created[role] = true;
    }
  }
  if (!(await admin.query("select exists (select 1 from pg_namespace where nspname = 'auth') as e")).rows[0].e) {
    await admin.query("create schema auth");
    await admin.query("create table auth.users (id uuid primary key, email text)");
    created.authSchema = true;
  }
  if (!(await admin.query("select to_regprocedure('auth.uid()') is not null as e")).rows[0].e) {
    await admin.query("create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
    created.authUid = true;
  }
  await admin.query("grant usage on schema auth to anon, authenticated");
  await admin.query("grant execute on function auth.uid() to anon, authenticated");
  await admin.query("grant usage on schema public to anon, authenticated");
  await admin.query("insert into auth.users (id) values ($1), ($2) on conflict do nothing", [A, B]);
  await admin.query(APPLY);
  await admin.query(APPLY); // 冪等（2 回目もエラーにならない）
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  if (!tableExisted) {
    await admin.query(ROLLBACK).catch(() => undefined);
    if (created.authSchema) await admin.query("drop schema if exists auth cascade");
    else {
      await admin.query("delete from auth.users where id in ($1, $2)", [A, B]).catch(() => undefined);
      if (created.authUid) await admin.query("drop function if exists auth.uid()");
    }
    for (const role of ["anon", "authenticated"] as const) {
      if (created[role]) {
        await admin.query(`drop owned by ${role}`);
        await admin.query(`drop role ${role}`);
      }
    }
  }
  await admin.end();
});

describe("保存スカッドのクラウド保存の SQL（提案・使い捨ての PostgreSQL）", () => {
  it("前提: 自分で適用した（既存の表とは混ぜない）・ポリシーは authenticated の 4 つ・anon には権限なし", async () => {
    expect(tableExisted).toBe(false);
    const pol = await admin.query("select policyname, roles::text as roles from pg_policies where tablename = 'saved_squads_snapshots' order by policyname");
    expect(pol.rows.map((r) => r.policyname)).toEqual([
      "saved_squads_snapshots_delete_own",
      "saved_squads_snapshots_insert_own",
      "saved_squads_snapshots_select_own",
      "saved_squads_snapshots_update_own",
    ]);
    expect(pol.rows.every((r) => r.roles === "{authenticated}")).toBe(true);
    const anonPriv = await admin.query("select has_table_privilege('anon', 'public.saved_squads_snapshots', 'select') as s");
    expect(anonPriv.rows[0].s).toBe(false);
  });

  it("A と B はそれぞれ自分の行だけを読める（相手の行は 0 件）", async () => {
    await save(A, 3);
    await save(B, 5);
    const a = await as(A, (q) => q("select user_id, item_count from public.saved_squads_snapshots"));
    const b = await as(B, (q) => q("select user_id, item_count from public.saved_squads_snapshots"));
    expect(a.rows).toEqual([{ user_id: A, item_count: 3 }]);
    expect(b.rows).toEqual([{ user_id: B, item_count: 5 }]);
  });

  it("A は B の行を更新・削除できない（0 件）・B の user_id で保存できない・user_id の付け替えもできない", async () => {
    expect((await as(A, (q) => q("update public.saved_squads_snapshots set item_count = 0, squads_data = '{\"items\":[]}'::jsonb where user_id = $1", [B]))).rowCount).toBe(0);
    expect((await as(A, (q) => q("delete from public.saved_squads_snapshots where user_id = $1", [B]))).rowCount).toBe(0);
    expect(await messageOf(save(A, 1, B))).toMatch(/row-level security|violates/);
    expect(await messageOf(as(A, (q) => q("update public.saved_squads_snapshots set user_id = $1 where user_id = $2", [B, A])))).not.toBe("ok");
    const rows = await admin.query("select user_id, item_count from public.saved_squads_snapshots order by item_count");
    expect(rows.rows).toEqual([{ user_id: A, item_count: 3 }, { user_id: B, item_count: 5 }]);
  });

  it("未ログイン（anon）は読めず書けない・件数の不一致と上限超えは拒否", async () => {
    expect(await messageOf(as(null, (q) => q("select * from public.saved_squads_snapshots")))).toMatch(/permission denied/);
    expect(await messageOf(save(null, 1, A))).not.toBe("ok");
    expect(await messageOf(save(A, 2, A, 3))).toMatch(/item_count_matches/);
    expect(await messageOf(save(A, 201))).toMatch(/item_count_range|payload_size/);
  });

  it("ロールバックで表と関数が消え、もう一度適用できる", async () => {
    await admin.query(ROLLBACK);
    expect((await admin.query("select to_regclass('public.saved_squads_snapshots') is null as gone")).rows[0].gone).toBe(true);
    expect((await admin.query("select to_regprocedure('public.saved_squads_snapshots_guard()') is null as gone")).rows[0].gone).toBe(true);
    await admin.query(APPLY);
    expect((await admin.query("select to_regclass('public.saved_squads_snapshots') is not null as back")).rows[0].back).toBe(true);
  });
});
