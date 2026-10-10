import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * 利用者自身によるアカウントの削除の提案（docs/production-readiness/sql/create-account-deletion.sql）を CI の使い捨て PostgreSQL に
 * 適用して確かめる（実 Supabase・Production へは接続しない）。auth.uid()・auth.jwt()・auth.users・auth.identities・anon / authenticated と、
 * 本人の行を持つ表（my_team_snapshots・rls_probe_records の最小の代役）は、無い場合だけ作り、終了時に自分で作ったものだけ消す。
 */
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const APPLY = readFileSync(path.join(SQL_DIR, "create-account-deletion.sql"), "utf8");
const ROLLBACK = readFileSync(path.join(SQL_DIR, "rollback-account-deletion.sql"), "utf8");

const A = "a1111111-1111-4111-8111-1111111111aa";
const B = "b2222222-2222-4222-8222-2222222222bb";

let admin: Client;
let connected = false;
const created = { anon: false, authenticated: false, authSchema: false, authUid: false, authJwt: false, identities: false, snapshots: false, probes: false };

const now = () => Math.floor(Date.now() / 1000);
type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
async function as<T>(uid: string | null, amrTimestamp: number | null, fn: (q: Q) => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    await admin.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await admin.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const claims = uid ? { sub: uid, amr: amrTimestamp === null ? [] : [{ method: "oauth", timestamp: amrTimestamp }] } : {};
    await admin.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const out = await fn((sql, params) => admin.query(sql, params as unknown[]));
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
const del = (uid: string | null, amr: number | null, confirm = "DELETE") => as(uid, amr, (q) => q("select public.delete_my_account($1) as r", [confirm]));
async function seed() {
  await admin.query("insert into auth.users (id) values ($1), ($2) on conflict do nothing", [A, B]);
  await admin.query("insert into auth.identities (user_id, provider) values ($1, 'google'), ($2, 'email') on conflict do nothing", [A, B]);
  await admin.query("delete from public.my_team_snapshots where user_id in ($1, $2)", [A, B]);
  await admin.query("delete from public.rls_probe_records where user_id in ($1, $2)", [A, B]);
  await admin.query("insert into public.my_team_snapshots (user_id) values ($1), ($1), ($2)", [A, B]);
  await admin.query("insert into public.rls_probe_records (user_id) values ($1), ($2)", [A, B]);
}
const countOf = async (table: string, uid: string) => Number((await admin.query(`select count(*)::int as n from ${table} where ${table === "auth.users" ? "id" : "user_id"} = $1`, [uid])).rows[0].n);

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
  if (!(await admin.query("select to_regclass('auth.identities') is not null as e")).rows[0].e) {
    await admin.query("create table auth.identities (user_id uuid not null references auth.users (id) on delete cascade, provider text not null, primary key (user_id, provider))");
    created.identities = true;
  }
  if (!(await admin.query("select to_regprocedure('auth.uid()') is not null as e")).rows[0].e) {
    await admin.query("create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
    created.authUid = true;
  }
  if (!(await admin.query("select to_regprocedure('auth.jwt()') is not null as e")).rows[0].e) {
    await admin.query("create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$");
    created.authJwt = true;
  }
  await admin.query("grant usage on schema auth to anon, authenticated");
  await admin.query("grant execute on function auth.uid() to anon, authenticated");
  await admin.query("grant execute on function auth.jwt() to anon, authenticated");
  await admin.query("grant usage on schema public to anon, authenticated");
  if (!(await admin.query("select to_regclass('public.my_team_snapshots') is not null as e")).rows[0].e) {
    await admin.query("create table public.my_team_snapshots (id bigint generated always as identity primary key, user_id uuid not null references auth.users (id) on delete cascade)");
    created.snapshots = true;
  }
  if (!(await admin.query("select to_regclass('public.rls_probe_records') is not null as e")).rows[0].e) {
    await admin.query("create table public.rls_probe_records (id bigint generated always as identity primary key, user_id uuid not null references auth.users (id) on delete cascade)");
    created.probes = true;
  }
  await admin.query(APPLY);
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  await admin.query(ROLLBACK).catch(() => undefined);
  await admin.query("drop table if exists public.account_deletion_audit").catch(() => undefined);
  if (created.snapshots) await admin.query("drop table if exists public.my_team_snapshots");
  if (created.probes) await admin.query("drop table if exists public.rls_probe_records");
  if (created.authSchema) await admin.query("drop schema if exists auth cascade");
  else {
    await admin.query("delete from auth.users where id in ($1, $2)", [A, B]).catch(() => undefined);
    if (created.identities) await admin.query("drop table if exists auth.identities");
    if (created.authUid) await admin.query("drop function if exists auth.uid()");
    if (created.authJwt) await admin.query("drop function if exists auth.jwt()");
  }
  for (const role of ["anon", "authenticated"] as const) {
    if (created[role]) {
      await admin.query(`drop owned by ${role}`);
      await admin.query(`drop role ${role}`);
    }
  }
  await admin.end();
});

describe("delete_my_account（提案の SQL・使い捨ての PostgreSQL）", () => {
  it("本人だけを消す: 本人の行と auth.users が消え、他人（B）は残る・監査は仮名のハッシュと件数だけ", async () => {
    await seed();
    const r = await del(A, now() - 30);
    expect(r.rows[0].r).toMatchObject({ deleted: true, counts: { my_team_snapshots: 2, rls_probe_records: 1 } });
    expect(await countOf("auth.users", A)).toBe(0);
    expect(await countOf("public.my_team_snapshots", A)).toBe(0);
    expect(await countOf("public.my_team_snapshots", B)).toBe(1);
    expect(await countOf("public.rls_probe_records", B)).toBe(1);
    expect(await countOf("auth.users", B)).toBe(1);
    const audit = (await admin.query("select * from public.account_deletion_audit order by id desc limit 1")).rows[0];
    expect(audit.subject_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(audit)).not.toContain(A);
    expect(audit.providers).toEqual(["google"]);
  });

  it("冪等: 同じ本人の 2 回目（再送・二重の実行）は alreadyDeleted で成功・監査は増えない", async () => {
    await seed();
    await del(A, now());
    const before = Number((await admin.query("select count(*)::int as n from public.account_deletion_audit")).rows[0].n);
    expect((await del(A, now())).rows[0].r).toMatchObject({ deleted: true, alreadyDeleted: true });
    expect(Number((await admin.query("select count(*)::int as n from public.account_deletion_audit")).rows[0].n)).toBe(before);
  });

  it("再認証: amr の最新が 10 分より古い・無いときは拒否し、何も消さない", async () => {
    await seed();
    expect(await messageOf(del(A, now() - 3600))).toBe("reauthentication_required");
    expect(await messageOf(del(A, null))).toBe("reauthentication_required");
    expect(await countOf("auth.users", A)).toBe(1);
    expect(await countOf("public.my_team_snapshots", A)).toBe(2);
  });

  it("確認の文字列が違う・未ログイン（anon は実行できない）は拒否", async () => {
    await seed();
    expect(await messageOf(del(A, now(), "delete"))).toBe("confirmation_required");
    expect(await messageOf(del(null, now()))).toMatch(/permission denied/);
    expect(await countOf("auth.users", A)).toBe(1);
  });

  it("利用者は監査の表を読めない・他人の行を直接消せない（関数は引数で対象を受け取らない）", async () => {
    await seed();
    expect(await messageOf(as(B, now(), (q) => q("select * from public.account_deletion_audit")))).toMatch(/permission denied/);
    const sig = (await admin.query("select pg_get_function_identity_arguments('public.delete_my_account(text)'::regprocedure) as a")).rows[0].a;
    expect(sig).toBe("confirm text");
  });

  it("課金の接続点: 有効な契約があれば拒否し、何も消さない（表が無いときは影響なし）", async () => {
    await seed();
    await admin.query("create table public.billing_subscriptions (user_id uuid not null, status text not null)");
    try {
      await admin.query("insert into public.billing_subscriptions values ($1, 'active')", [A]);
      expect(await messageOf(del(A, now()))).toBe("billing_active");
      expect(await countOf("auth.users", A)).toBe(1);
      await admin.query("update public.billing_subscriptions set status = 'canceled' where user_id = $1", [A]);
      expect((await del(A, now())).rows[0].r).toMatchObject({ deleted: true });
    } finally {
      await admin.query("drop table if exists public.billing_subscriptions");
    }
  });

  it("途中で失敗したら何も消えない（1 つのトランザクション）", async () => {
    await seed();
    await admin.query(
      "create function public.efta_test_fail() returns trigger language plpgsql as $$ begin raise exception 'forced_failure'; end $$",
    );
    await admin.query("create trigger efta_test_fail before insert on public.account_deletion_audit for each row execute function public.efta_test_fail()");
    try {
      expect(await messageOf(del(A, now()))).toBe("forced_failure");
      expect(await countOf("auth.users", A)).toBe(1);
      expect(await countOf("public.my_team_snapshots", A)).toBe(2);
    } finally {
      await admin.query("drop trigger if exists efta_test_fail on public.account_deletion_audit");
      await admin.query("drop function if exists public.efta_test_fail()");
    }
  });

  it("関数は SECURITY DEFINER・search_path 固定・anon に実行の権限なし", async () => {
    const f = (await admin.query("select prosecdef, proconfig from pg_proc where oid = 'public.delete_my_account(text)'::regprocedure")).rows[0];
    expect(f.prosecdef).toBe(true);
    expect(f.proconfig).toEqual(['search_path=""']);
    const anon = (await admin.query("select has_function_privilege('anon', 'public.delete_my_account(text)', 'execute') as e")).rows[0].e;
    expect(anon).toBe(false);
  });
});
