import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * My Team のクラウド保存の RLS の A/B の分離（2026-10-11・Google ログインの公開のゲート `prodRlsIsolationAB` の補強）。
 *
 * 本番と同じ SQL（docs/production-readiness/sql/create-my-team-cloud-schema.sql と、本番に適用済みの
 * optimize-auth-rls-initplan.sql の my_team_snapshots の 4 ポリシー）を CI の使い捨て PostgreSQL に適用し、
 * user A（Google）と user B が互いの行を読む・書く・消すことができないことを確かめる（実 Supabase・Production へは接続しない）。
 * auth スキーマ・auth.uid()・anon / authenticated は、無い場合だけ作り、終了時に自分で作ったものだけ消す。
 */
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const SCHEMA = readFileSync(path.join(SQL_DIR, "create-my-team-cloud-schema.sql"), "utf8");
// 本番の現在の形（initplan の最適化の後）: my_team_snapshots の alter policy だけを取り出す
const OPTIMIZED = [...readFileSync(path.join(SQL_DIR, "optimize-auth-rls-initplan.sql"), "utf8").matchAll(/alter policy my_team_snapshots_\w+[\s\S]*?;/g)].map((m) => m[0]);

const A = "a3333333-3333-4333-8333-3333333333aa";
const B = "b4444444-4444-4444-8444-4444444444bb";
const HASH = "0".repeat(64);
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
const team = (n: number) => JSON.stringify({ items: Array.from({ length: n }, (_, i) => ({ worldCardId: String(1000 + i) })) });
const save = (uid: string, n: number, userId: string = uid) =>
  as(uid, (q) =>
    q(
      "insert into public.my_team_snapshots (user_id, schema_version, team_data, item_count, payload_hash, client_updated_at) values ($1, 'v1', $2::jsonb, $3, $4, now()) on conflict (user_id) do update set team_data = excluded.team_data, item_count = excluded.item_count returning user_id",
      [userId, team(n), n, HASH],
    ),
  );

beforeAll(async () => {
  admin = new Client(buildTestOnlyPgConfigFromEnv(process.env));
  await admin.connect();
  connected = true;
  tableExisted = (await admin.query("select to_regclass('public.my_team_snapshots') is not null as e")).rows[0].e;
  if (tableExisted) return; // 他のテストが作った代役の表とは混ぜない（本物の定義で確かめられないため、下のテストで止める）
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
  await admin.query(SCHEMA);
  for (const stmt of OPTIMIZED) await admin.query(stmt);
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  if (!tableExisted) {
    await admin.query("drop table if exists public.my_team_snapshots cascade").catch(() => undefined);
    await admin.query("drop function if exists public.my_team_snapshots_guard()").catch(() => undefined);
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

describe("My Team のクラウド保存の RLS の A/B の分離（本番と同じ SQL・使い捨ての PostgreSQL）", () => {
  it("前提: 本物の定義を適用した（他のテストの代役の表ではない）・最適化の後の 4 ポリシー", () => {
    expect(tableExisted).toBe(false);
    expect(OPTIMIZED).toHaveLength(4);
  });

  it("A と B はそれぞれ自分の行だけを読める（相手の行は 0 件）", async () => {
    await save(A, 3);
    await save(B, 5);
    const aRows = await as(A, (q) => q("select user_id, item_count from public.my_team_snapshots"));
    const bRows = await as(B, (q) => q("select user_id, item_count from public.my_team_snapshots"));
    expect(aRows.rows).toEqual([{ user_id: A, item_count: 3 }]);
    expect(bRows.rows).toEqual([{ user_id: B, item_count: 5 }]);
    const aReadsB = await as(A, (q) => q("select count(*)::int as n from public.my_team_snapshots where user_id = $1", [B]));
    expect(aReadsB.rows[0].n).toBe(0);
  });

  it("A は B の行を書き換え・消せない（0 件）・B の user_id で挿入できない（WITH CHECK）", async () => {
    const upd = await as(A, (q) => q("update public.my_team_snapshots set item_count = 0, team_data = '{\"items\":[]}'::jsonb where user_id = $1", [B]));
    expect(upd.rowCount).toBe(0);
    const delB = await as(A, (q) => q("delete from public.my_team_snapshots where user_id = $1", [B]));
    expect(delB.rowCount).toBe(0);
    expect(await messageOf(save(A, 1, B))).toMatch(/row-level security|violates/);
    const b = await admin.query("select item_count from public.my_team_snapshots where user_id = $1", [B]);
    expect(b.rows).toEqual([{ item_count: 5 }]);
  });

  it("自分の行の user_id を相手に付け替えられない・未ログイン（anon）は何も読めず書けない", async () => {
    expect(await messageOf(as(A, (q) => q("update public.my_team_snapshots set user_id = $1 where user_id = $2", [B, A])))).not.toBe("ok");
    expect(await messageOf(as(null, (q) => q("select * from public.my_team_snapshots")))).toMatch(/permission denied/);
    expect(await messageOf(save(null as unknown as string, 1, A))).not.toBe("ok");
    const a = await admin.query("select item_count from public.my_team_snapshots where user_id = $1", [A]);
    expect(a.rows).toEqual([{ item_count: 3 }]);
  });
});
