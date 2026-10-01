import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * F-084 段階 2 の migration 提案（docs/production-readiness/sql/create-photo-posts-stage2-schema.sql）を、
 * CI の使い捨て PostgreSQL に適用し、本人の分離を実際の RLS で確かめる。
 *
 * - Supabase の `auth.uid()`・`storage.buckets`・`storage.objects`・`storage.foldername()` は最小の代役を作る
 *   （無い場合だけ作り、終了時に自分で作ったものだけ消す）。実 Supabase・Production へは接続しない。
 * - 通常の `npx vitest run` には含まれない（vitest.postgres.config.ts でだけ実行）。ローカルには PostgreSQL が無い。
 */

const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const APPLY = readFileSync(path.join(SQL_DIR, "create-photo-posts-stage2-schema.sql"), "utf8");
const ROLLBACK = readFileSync(path.join(SQL_DIR, "rollback-photo-posts-stage2-schema.sql"), "utf8");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const hex = (c: string) => c.repeat(32);
const objectName = (uid: string, c: string) => `${uid}/${hex(c)}.jpg`;

let admin: Client;
let connected = false;
const created = { anon: false, authenticated: false, authSchema: false, authUid: false, storageSchema: false };

/** 1 つの transaction の中で、指定した利用者（null は未認証 = anon）として実行する。 */
async function as<T>(uid: string | null, fn: (q: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>) => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    await admin.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await admin.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const out = await fn((sql, params) => admin.query(sql, params as unknown[]));
    await admin.query("commit");
    return out;
  } catch (e) {
    await admin.query("rollback");
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
  await admin.query("insert into auth.users (id) values ($1), ($2), ($3) on conflict do nothing", [A, B, C]);

  const storage = await admin.query("select exists (select 1 from pg_namespace where nspname = 'storage') as e");
  if (!storage.rows[0].e) {
    await admin.query("create schema storage");
    await admin.query("create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[])");
    await admin.query("create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid(), unique (bucket_id, name))");
    await admin.query("create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$");
    await admin.query("alter table storage.objects enable row level security");
    await admin.query("grant usage on schema storage to anon, authenticated");
    await admin.query("grant select, insert, update, delete on storage.objects to anon, authenticated");
    await admin.query("grant execute on function storage.foldername(text) to anon, authenticated");
    created.storageSchema = true;
  }
  await admin.query(APPLY);
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  await admin.query(ROLLBACK).catch(() => undefined);
  if (created.storageSchema) await admin.query("drop schema if exists storage cascade");
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

const insertPost = (q: Parameters<Parameters<typeof as>[1]>[0], extra: Record<string, unknown> = {}) => {
  const row = { body: "test", category: "squad", purpose: "show", ...extra };
  const cols = Object.keys(row);
  return q(`insert into public.photo_posts (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id, user_id`, Object.values(row));
};

describe("photo_posts 段階 2: 本人の分離（使い捨て PostgreSQL・実際の RLS）", () => {
  let postA = "";

  it("本人は作成でき、user_id は auth.uid() になる", async () => {
    const r = await as(A, (q) => insertPost(q, { image_path: objectName(A, "a"), image_bytes: 1000, image_mime: "image/jpeg" }));
    expect(r.rows[0].user_id).toBe(A);
    postA = String(r.rows[0].id);
    expect(await as(A, (q) => q("select id from public.photo_posts"))).toMatchObject({ rowCount: 1 });
  });

  it("他人は読めず、更新・削除しても 0 行。未認証は権限が無い", async () => {
    expect(await as(B, (q) => q("select id from public.photo_posts"))).toMatchObject({ rowCount: 0 });
    expect(await as(B, (q) => q("update public.photo_posts set body = 'x' where id = $1", [postA]))).toMatchObject({ rowCount: 0 });
    expect(await as(B, (q) => q("delete from public.photo_posts where id = $1", [postA]))).toMatchObject({ rowCount: 0 });
    expect(await codeOf(as(null, (q) => q("select id from public.photo_posts")))).toBe("42501");
    expect(await as(A, (q) => q("select body from public.photo_posts where id = $1", [postA]))).toMatchObject({ rows: [{ body: "test" }] });
  });

  it("他人の user_id での作成・所有者の付け替え・他人のフォルダーの画像を拒否する", async () => {
    expect(await codeOf(as(C, (q) => insertPost(q, { user_id: B })))).toBe("42501");
    expect(await codeOf(as(A, (q) => q("update public.photo_posts set user_id = $1 where id = $2", [B, postA])))).not.toBe("ok");
    expect(await codeOf(as(C, (q) => insertPost(q, { image_path: objectName(B, "b"), image_bytes: 10, image_mime: "image/jpeg" })))).toBe("23514");
  });

  it("段階 2 では公開範囲 private・コメント無効以外を拒否する", async () => {
    for (const v of ["link", "friends", "public"]) expect(await codeOf(as(C, (q) => insertPost(q, { visibility: v })))).toBe("23514");
    expect(await codeOf(as(C, (q) => insertPost(q, { allow_comments: true })))).toBe("23514");
  });

  it("連投を拒否する（30 秒に 1 件）", async () => {
    expect(await codeOf(as(A, (q) => insertPost(q)))).toBe("P0001");
  });

  it("Storage: 本人のフォルダーだけ置け・読める。他人は読めず、他人のフォルダーへ置けず、消せない。上書きできない", async () => {
    expect(await codeOf(as(A, (q) => q("insert into storage.objects (bucket_id, name) values ('photo-posts', $1)", [objectName(A, "a")])))).toBe("ok");
    expect(await as(A, (q) => q("select name from storage.objects where bucket_id = 'photo-posts'"))).toMatchObject({ rowCount: 1 });
    expect(await as(B, (q) => q("select name from storage.objects where bucket_id = 'photo-posts'"))).toMatchObject({ rowCount: 0 });
    expect(await as(null, (q) => q("select name from storage.objects where bucket_id = 'photo-posts'"))).toMatchObject({ rowCount: 0 });
    expect(await codeOf(as(B, (q) => q("insert into storage.objects (bucket_id, name) values ('photo-posts', $1)", [objectName(A, "c")])))).toBe("42501");
    expect(await codeOf(as(A, (q) => q("insert into storage.objects (bucket_id, name) values ('photo-posts', $1)", [`${A}/guessable.jpg`])))).toBe("42501");
    expect(await as(B, (q) => q("delete from storage.objects where bucket_id = 'photo-posts'"))).toMatchObject({ rowCount: 0 });
    expect(await as(A, (q) => q("update storage.objects set name = $1 where bucket_id = 'photo-posts'", [objectName(A, "d")]))).toMatchObject({ rowCount: 0 });
    const bucket = await admin.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'photo-posts'");
    expect(bucket.rows[0]).toEqual({ public: false, file_size_limit: "5242880", allowed_mime_types: ["image/jpeg", "image/webp"] });
  });

  it("削除: 本人が消すと行は無くなり、監査ログには本文・画像を残さず、利用者は監査ログを読めない", async () => {
    expect(await as(A, (q) => q("delete from public.photo_posts where id = $1", [postA]))).toMatchObject({ rowCount: 1 });
    expect(await as(A, (q) => q("select id from public.photo_posts where id = $1", [postA]))).toMatchObject({ rowCount: 0 });
    expect(await as(A, (q) => q("delete from storage.objects where bucket_id = 'photo-posts' and name = $1", [objectName(A, "a")]))).toMatchObject({ rowCount: 1 });
    const audit = await admin.query("select action from public.photo_post_audit where post_id = $1 order by id", [postA]);
    expect(audit.rows.map((r) => r.action)).toEqual(["created", "deleted"]);
    expect(await codeOf(as(A, (q) => q("select * from public.photo_post_audit")))).toBe("42501");
  });
});
