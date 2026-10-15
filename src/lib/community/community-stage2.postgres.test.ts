import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * コミュニティ 第 2 段階（ライバル・総合点の履歴・2026-10-14）を、公開 ID・第 1 段階の上に使い捨ての PostgreSQL へ適用して確かめる。
 */
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const PROFILES = read("create-public-profiles-schema.sql");
const STAGE1 = read("create-community-stage1-schema.sql");
const APPLY = read("create-community-stage2-rivals.sql");
const ROLLBACK = read("rollback-community-stage2-rivals.sql");
const ROLLBACK1 = read("rollback-community-stage1-schema.sql");
const ROLLBACK0 = read("rollback-public-profiles-schema.sql");

const ME = "c2000000-0000-4000-8000-000000000001";
const F1 = "c2000000-0000-4000-8000-000000000002";
const F2 = "c2000000-0000-4000-8000-000000000003";
const NF = "c2000000-0000-4000-8000-000000000004"; // 友達ではない
const USERS = [ME, F1, F2, NF];
const created = { anon: false, authenticated: false, authSchema: false, authUid: false };
let admin: Client;
let connected = false;

type Row = Record<string, unknown>;
type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
async function as<T>(uid: string, fn: (q: Q) => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    await admin.query("set local role authenticated");
    await admin.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const out = await fn((sql, params) => admin.query(sql, params as unknown[]) as never);
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
const call = (uid: string, fn: string, args: unknown[] = []) => as(uid, async (q) => (await q(`select * from public.${fn}(${args.map((_, i) => `$${i + 1}`).join(", ")})`, args)).rows);
const scalar = async (uid: string, fn: string, args: unknown[] = []) => Object.values((await call(uid, fn, args))[0])[0];
const summary = (overall: number, r = "squad-diagnosis/2026-09-06.v1") => JSON.stringify({ v: 1, k: "sd", r, d: "2026-10-14", o: [overall, "B"], c: {}, s: null, w: null });

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
  await admin.query(`insert into auth.users (id) values ${USERS.map((_, i) => `($${i + 1})`).join(", ")} on conflict do nothing`, USERS);
  await admin.query(PROFILES);
  await admin.query(STAGE1);
  await admin.query(APPLY);
  await admin.query(APPLY); // 冪等
  for (const [u, id] of [[ME, "me_r"], [F1, "friend_one"], [F2, "friend_two"], [NF, "stranger_x"]] as const) {
    await as(u, (q) => q("select public.community_save_my_profile($1, $2, 'link')", [id, `name ${id}`]));
  }
  for (const [u, id] of [[F1, "me_r"], [F2, "me_r"]] as const) await call(u, "community_request_friend", [id]);
  await call(ME, "community_respond_friend", ["friend_one", true]);
  await call(ME, "community_respond_friend", ["friend_two", true]);
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  await admin.query(ROLLBACK).catch(() => undefined);
  await admin.query(ROLLBACK1).catch(() => undefined);
  await admin.query(ROLLBACK0).catch(() => undefined);
  if (created.authSchema) await admin.query("drop schema if exists auth cascade");
  else {
    await admin.query(`delete from auth.users where id in (${USERS.map((_, i) => `$${i + 1}`).join(", ")})`, USERS).catch(() => undefined);
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

describe("コミュニティ 第 2 段階（ライバル・成長）", () => {
  it("表は直接読めない。内部の関数は呼べない", async () => {
    for (const t of ["rivals", "rival_settings", "comparison_history"]) expect(await codeOf(as(ME, (q) => q(`select * from public.${t}`)))).toBe("42501");
    expect(await codeOf(call(ME, "community_growth", [ME, 7]))).toBe("42501");
  });

  it("オプトイン: 自分が使っていない・相手が使っていない・友達でない相手は追加できない", async () => {
    expect(await codeOf(call(ME, "community_add_rival", ["friend_one"]))).toBe("P0020");
    expect(await scalar(ME, "community_set_rival_opt_in", [true])).toBe("opted_in");
    expect(await codeOf(call(ME, "community_add_rival", ["friend_one"]))).toBe("P0021");
    await call(F1, "community_set_rival_opt_in", [true]);
    await call(NF, "community_set_rival_opt_in", [true]);
    expect(await codeOf(call(ME, "community_add_rival", ["stranger_x"]))).toBe("P0010");
    expect(await scalar(ME, "community_add_rival", ["friend_one"])).toBe("added");
    expect(await scalar(ME, "community_add_rival", ["friend_one"])).toBe("already");
    const list = await call(ME, "community_list_rivals");
    expect(list.map((r) => [r.public_id, r.is_self])).toEqual([["me_r", true], ["friend_one", false]]);
  });

  it("5 人まで", async () => {
    // 架空の 4 行を足して 5 人にする（制約の確認のため auth.users に一時の利用者を作る）
    const extra = ["c2000000-0000-4000-8000-0000000000a1", "c2000000-0000-4000-8000-0000000000a2", "c2000000-0000-4000-8000-0000000000a3", "c2000000-0000-4000-8000-0000000000a4"];
    await admin.query(`insert into auth.users (id) values ${extra.map((_, i) => `($${i + 1})`).join(", ")}`, extra);
    for (const e of extra) await admin.query("insert into public.rivals (user_id, rival_id) values ($1, $2)", [ME, e]);
    await call(F2, "community_set_rival_opt_in", [true]);
    expect(await codeOf(call(ME, "community_add_rival", ["friend_two"]))).toBe("P0022");
    await admin.query(`delete from auth.users where id in (${extra.map((_, i) => `$${i + 1}`).join(", ")})`, extra);
    expect(await scalar(ME, "community_add_rival", ["friend_two"])).toBe("added");
  });

  it("成長: 同じ規則の版の点だけ・期間の中の最も古い点との差", async () => {
    await call(F1, "community_set_comparison", [summary(60)]);
    await call(F1, "community_set_comparison", [summary(66)]);
    await admin.query("update public.comparison_history set recorded_at = now() - interval '20 days' where user_id = $1 and overall = 60", [F1]);
    await call(F1, "community_set_comparison", [summary(50, "squad-diagnosis/2026-01-01.v1")]);
    await admin.query("update public.comparison_history set recorded_at = now() - interval '10 days' where user_id = $1 and overall = 50", [F1]);
    const row = (await call(ME, "community_list_rivals")).find((r) => r.public_id === "friend_one")!;
    expect(row).toMatchObject({ overall: 50, growth_week: null, growth_month: 6 }); // 最新の点（66・今日）と、同じ版の最も古い点（60・20 日前）。別の版の 50 は数えない
  });

  it("相手がやめる・友達の解除・ブロックで外れる。自分がやめると一覧は自分だけ", async () => {
    await call(F2, "community_set_rival_opt_in", [false]);
    expect((await call(ME, "community_list_rivals")).map((r) => r.public_id)).toEqual(["me_r", "friend_one"]);
    await call(F1, "community_remove_friend", ["me_r"]);
    expect((await call(ME, "community_list_rivals")).map((r) => r.public_id)).toEqual(["me_r"]);
    expect(Number((await admin.query("select count(*) as n from public.rivals where user_id = $1", [ME])).rows[0].n)).toBe(0);
    expect(await scalar(ME, "community_set_rival_opt_in", [false])).toBe("opted_out");
    expect((await call(ME, "community_list_rivals"))[0]).toMatchObject({ public_id: "me_r", opted_in: false });
  });

  it("履歴は 1 人 100 件まで", async () => {
    for (let i = 0; i < 105; i++) await call(NF, "community_set_comparison", [summary(40 + (i % 10))]);
    expect(Number((await admin.query("select count(*) as n from public.comparison_history where user_id = $1", [NF])).rows[0].n)).toBe(100);
  });

  it("戻すと表が消え、比較の保存は第 1 段階の形で動く。再適用できる", async () => {
    await admin.query(ROLLBACK);
    expect((await admin.query("select to_regclass('public.rivals') as r")).rows[0].r).toBeNull();
    expect(await scalar(NF, "community_set_comparison", [summary(70)])).toBe("saved");
    await admin.query(APPLY);
    expect((await admin.query("select to_regclass('public.rivals') as r")).rows[0].r).not.toBeNull();
  });
});
