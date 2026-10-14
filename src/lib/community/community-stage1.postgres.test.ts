import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "../reference-data/auto-update/postgres-adapter";

/**
 * コミュニティ 第 1 段階（docs/production-readiness/sql/create-community-stage1-schema.sql・2026-10-14）を、
 * 公開 ID の migration の上に CI の使い捨て PostgreSQL へ適用して確かめる（実 Supabase・Production へは接続しない）。
 * auth スキーマ・auth.uid()・anon / authenticated は、無い場合だけ作り、終了時に自分で作ったものだけ消す。
 */
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql");
const PROFILES = readFileSync(path.join(SQL_DIR, "create-public-profiles-schema.sql"), "utf8");
const PROFILES_ROLLBACK = readFileSync(path.join(SQL_DIR, "rollback-public-profiles-schema.sql"), "utf8");
const APPLY = readFileSync(path.join(SQL_DIR, "create-community-stage1-schema.sql"), "utf8");
const ROLLBACK = readFileSync(path.join(SQL_DIR, "rollback-community-stage1-schema.sql"), "utf8");

const PUB = "c1000000-0000-4000-8000-000000000001"; // 全体公開
const LNK = "c1000000-0000-4000-8000-000000000002"; // URL 限定
const FRN = "c1000000-0000-4000-8000-000000000003"; // 友達だけ
const PRV = "c1000000-0000-4000-8000-000000000004"; // 非公開
const ME = "c1000000-0000-4000-8000-000000000005"; // 操作する人
const NOP = "c1000000-0000-4000-8000-000000000006"; // プロフィールなし
const USERS = [PUB, LNK, FRN, PRV, ME, NOP];
const created = { anon: false, authenticated: false, authSchema: false, authUid: false };
let admin: Client;
let connected = false;

type Row = Record<string, unknown>;
type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Row[]; rowCount: number | null }>;
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
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? "error";
  }
}
const call = async (uid: string | null, fn: string, args: unknown[] = []): Promise<Row[]> =>
  as(uid, async (q) => (await q(`select * from public.${fn}(${args.map((_, i) => `$${i + 1}`).join(", ")})`, args)).rows);
const scalar = async (uid: string, fn: string, args: unknown[] = []): Promise<unknown> => Object.values((await call(uid, fn, args))[0])[0];
const profile = async (uid: string, id: string) => (await call(uid, "community_get_profile", [id]))[0] ?? null;
const SUMMARY = { v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: "2026-10-14", o: [70, "B"], c: {}, s: null, w: null };

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
  await admin.query(APPLY);
  // 2 回目の適用でも壊れない（冪等）
  await admin.query(APPLY);
  const claim = (u: string, id: string, v: string) => as(u, (q) => q("insert into public.public_profiles (public_id, display_name, visibility) values ($1, $2, $3)", [id, `name ${id}`, v]));
  await claim(PUB, "pub_user", "public");
  await claim(LNK, "lnk_user", "link");
  await claim(FRN, "frn_user", "friends");
  await claim(PRV, "prv_user", "private");
  await claim(ME, "me_user", "private");
}, 60_000);

afterAll(async () => {
  if (!connected) return;
  await admin.query(ROLLBACK).catch(() => undefined);
  await admin.query(PROFILES_ROLLBACK).catch(() => undefined);
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

describe("コミュニティ 第 1 段階（使い捨て PostgreSQL・実際の RLS と関数）", () => {
  it("anon は関数も表も使えない。authenticated も表を直接は読めない（関数だけ）", async () => {
    expect(await codeOf(call(null, "community_get_profile", ["pub_user"]))).toBe("42501");
    expect(await codeOf(call(null, "community_search", ["pub"]))).toBe("42501");
    for (const t of ["friendships", "user_mutes", "user_blocks", "community_reports", "community_rate_events", "comparison_summaries", "community_report_queue"]) {
      expect(await codeOf(as(ME, (q) => q(`select * from public.${t}`)))).toBe("42501");
    }
    expect(await codeOf(call(ME, "community_uid_of", ["pub_user"]))).toBe("42501");
    expect(await codeOf(call(ME, "community_moderate_report", [1, "dismissed", "x", false]))).toBe("42501");
  });

  it("本人のプロフィール: 作成・変更・規則の違反（予約語・形式・重複・30 日）", async () => {
    expect(await call(NOP, "community_my_profile")).toEqual([]);
    expect(await codeOf(call(NOP, "community_save_my_profile", ["admin", "x", "private"]))).toBe("P0001");
    expect(await codeOf(call(NOP, "community_save_my_profile", ["a b", "x", "private"]))).toBe("23514");
    expect(await codeOf(call(NOP, "community_save_my_profile", ["pub_user", "x", "private"]))).toBe("23505");
    expect(await codeOf(call(NOP, "community_save_my_profile", ["nop_user", "x", "everyone"]))).toBe("23514");
    expect(await scalar(NOP, "community_save_my_profile", [" NOP_User ", " 名前 ", "private"])).toBe("created");
    expect((await call(NOP, "community_my_profile"))[0]).toMatchObject({ public_id: "nop_user", display_name: "名前", visibility: "private", restricted: false });
    expect(await scalar(NOP, "community_save_my_profile", ["nop_user", "新しい名前", "friends"])).toBe("updated");
    expect(await codeOf(call(NOP, "community_save_my_profile", ["nop_user2", "新しい名前", "friends"]))).toBe("P0002"); // 30 日に 1 回
    expect((await call(NOP, "community_my_profile"))[0]).toMatchObject({ public_id: "nop_user", display_name: "新しい名前", visibility: "friends" });
    await as(NOP, (q) => q("update public.public_profiles set visibility = 'private'"));
  });

  it("F-054 公開範囲: 全体公開・URL 限定は見える、友達だけ・非公開は見えない。検索は全体公開だけ", async () => {
    expect((await profile(ME, "pub_user"))?.display_name).toBe("name pub_user");
    expect((await profile(ME, "LNK_user "))?.display_name).toBe("name lnk_user"); // 正規化（小文字・前後の空白）
    expect(await profile(ME, "frn_user")).toBeNull();
    expect(await profile(ME, "prv_user")).toBeNull();
    expect(await profile(ME, "nobody_here")).toBeNull();
    const self = await profile(ME, "me_user");
    expect(self).toMatchObject({ is_self: true, relation: "self", visibility: "private" });
    // 他人の公開範囲は返さない
    expect((await profile(ME, "pub_user"))?.visibility).toBeNull();
    expect((await call(ME, "community_search", ["pub"])).map((r) => r.public_id)).toEqual(["pub_user"]);
    expect(await call(ME, "community_search", ["lnk"])).toEqual([]);
    expect(await call(ME, "community_search", ["pu"])).toEqual([]); // 3 文字未満
    expect(await call(ME, "community_search", ["p%_"])).toEqual([]); // 記号は検索しない
    // 直接の select でも、他人の行は全体公開だけ・user_id は読めない
    expect((await as(ME, (q) => q("select public_id from public.public_profiles order by public_id"))).rows.map((r) => r.public_id)).toEqual(["me_user", "pub_user"]);
    expect(await codeOf(as(ME, (q) => q("select user_id from public.public_profiles")))).toBe("42501");
  });

  it("F-055 友達: 非公開のままでは申請できない → 公開範囲を変えると申請・承認・一覧・解除ができる", async () => {
    expect(await codeOf(call(ME, "community_request_friend", ["pub_user"]))).toBe("P0013");
    expect(await codeOf(call(NOP, "community_request_friend", ["pub_user"]))).toBe("P0013");
    await as(ME, (q) => q("update public.public_profiles set visibility = 'link'"));
    // 見えない相手（友達だけ・非公開・存在しない）は同じ失敗
    expect(await codeOf(call(ME, "community_request_friend", ["frn_user"]))).toBe("P0010");
    expect(await codeOf(call(ME, "community_request_friend", ["prv_user"]))).toBe("P0010");
    expect(await codeOf(call(ME, "community_request_friend", ["nobody_here"]))).toBe("P0010");
    expect(await codeOf(call(ME, "community_request_friend", ["me_user"]))).toBe("P0010");
    expect(await scalar(ME, "community_request_friend", ["pub_user"])).toBe("requested");
    expect(await scalar(ME, "community_request_friend", ["pub_user"])).toBe("already_requested");
    expect((await profile(ME, "pub_user"))?.relation).toBe("pending_outgoing");
    expect(await call(PUB, "community_list_friends")).toEqual([expect.objectContaining({ public_id: "me_user", state: "pending_incoming" })]);
    // 申請された側は承認できる。申請した側は自分の申請を承認できない
    expect(await scalar(ME, "community_respond_friend", ["pub_user", true])).toBe("not_found");
    expect(await scalar(PUB, "community_respond_friend", ["me_user", true])).toBe("accepted");
    expect((await call(ME, "community_list_friends")).map((r) => [r.public_id, r.state])).toEqual([["pub_user", "friends"]]);
    expect(await scalar(ME, "community_request_friend", ["pub_user"])).toBe("already_friends");
    // 友達だけの相手: 相手から申請が来れば相手のプロフィールが見え、こちらからの申請は承認になる
    expect(await scalar(FRN, "community_request_friend", ["me_user"])).toBe("requested");
    expect((await profile(ME, "frn_user"))?.relation).toBe("pending_incoming");
    expect(await scalar(ME, "community_request_friend", ["frn_user"])).toBe("accepted");
    expect((await profile(ME, "frn_user"))?.relation).toBe("friends");
    // 拒否・取り消し・解除
    expect(await scalar(LNK, "community_request_friend", ["me_user"])).toBe("requested");
    expect(await scalar(LNK, "community_remove_friend", ["me_user"])).toBe("removed"); // 取り消し
    expect(await scalar(LNK, "community_request_friend", ["me_user"])).toBe("requested");
    expect(await scalar(ME, "community_remove_friend", ["lnk_user"])).toBe("none"); // 来た申請は「拒否」で扱う
    expect(await scalar(ME, "community_respond_friend", ["lnk_user", false])).toBe("rejected");
    expect(await scalar(ME, "community_remove_friend", ["frn_user"])).toBe("removed");
    expect(await profile(ME, "frn_user")).toBeNull(); // 友達でなくなれば友達だけの相手は見えない
  });

  it("F-062 比較: 友達だけが要約を読める。形の違う要約は保存しない", async () => {
    expect(await codeOf(call(PUB, "community_set_comparison", [JSON.stringify({ k: "x" })]))).toBe("22023");
    expect(await codeOf(call(PUB, "community_set_comparison", [JSON.stringify({ ...SUMMARY, big: "x".repeat(3000) })]))).toBe("22023");
    expect(await scalar(PUB, "community_set_comparison", [JSON.stringify(SUMMARY)])).toBe("saved");
    expect((await profile(ME, "pub_user"))?.has_comparison).toBe(true);
    expect((await call(ME, "community_get_comparison", ["pub_user"]))[0]?.summary).toMatchObject({ k: "sd", o: [70, "B"] });
    expect(await call(LNK, "community_get_comparison", ["pub_user"])).toEqual([]); // 友達ではない
    expect((await call(PUB, "community_get_comparison", ["pub_user"])).length).toBe(1); // 本人
    expect(await scalar(PUB, "community_clear_comparison")).toBe("cleared");
    expect(await call(ME, "community_get_comparison", ["pub_user"])).toEqual([]);
    await call(PUB, "community_set_comparison", [JSON.stringify(SUMMARY)]);
  });

  it("F-056 ブロック: 友達の関係が消え、相手からは存在しないのと同じ。ブロックした側は解除できる", async () => {
    expect(await scalar(PUB, "community_block", ["me_user"])).toBe("blocked");
    expect(await scalar(PUB, "community_block", ["me_user"])).toBe("already_blocked");
    expect(await call(ME, "community_list_friends")).toEqual([]);
    expect(await profile(ME, "pub_user")).toBeNull();
    expect(await call(ME, "community_search", ["pub"])).toEqual([]);
    expect(await call(ME, "community_get_comparison", ["pub_user"])).toEqual([]);
    expect(await codeOf(call(ME, "community_request_friend", ["pub_user"]))).toBe("P0010");
    expect(await profile(PUB, "me_user")).toMatchObject({ relation: "blocked", blocked_by_me: true, display_name: null });
    expect((await call(PUB, "community_list_safety")).map((r) => [r.kind, r.public_id])).toEqual([["block", "me_user"]]);
    expect(await scalar(PUB, "community_unblock", ["me_user"])).toBe("unblocked");
    expect((await profile(ME, "pub_user"))?.relation).toBe("none");
  });

  it("F-056 ミュート: ミュートした相手の申請と検索の結果を自分にだけ隠す", async () => {
    expect(await scalar(ME, "community_mute", ["lnk_user"])).toBe("muted");
    expect(await scalar(LNK, "community_request_friend", ["me_user"])).toBe("requested");
    expect(await call(ME, "community_list_friends")).toEqual([]);
    expect((await profile(ME, "lnk_user"))?.muted_by_me).toBe(true);
    expect(await scalar(ME, "community_mute", ["pub_user"])).toBe("muted");
    expect(await call(ME, "community_search", ["pub"])).toEqual([]);
    expect(await scalar(ME, "community_unmute", ["pub_user"])).toBe("unmuted");
    expect(await scalar(ME, "community_unmute", ["lnk_user"])).toBe("unmuted");
    expect((await call(ME, "community_list_friends")).map((r) => r.state)).toEqual(["pending_incoming"]);
    await call(ME, "community_respond_friend", ["lnk_user", false]);
  });

  it("F-056 通報: 自分は不可・同じ相手の未解決は 1 件・本人の一覧・取り下げ・運営者の対応と制限", async () => {
    expect(await codeOf(call(ME, "community_report", ["me_user", "spam", ""]))).toBe("P0014");
    expect(await codeOf(call(ME, "community_report", ["nobody_here", "spam", ""]))).toBe("P0010");
    expect(await codeOf(call(ME, "community_report", ["pub_user", "bad_reason", ""]))).toBe("23514");
    expect(await codeOf(call(ME, "community_report", ["pub_user", "other", "x".repeat(501)]))).toBe("22001");
    expect(await scalar(ME, "community_report", ["pub_user", "harassment", "  詳しい内容  "])).toBe("reported");
    expect(await scalar(ME, "community_report", ["pub_user", "spam", ""])).toBe("duplicate");
    // 見えない相手（非公開）も、ID を知っていれば通報できる
    expect(await scalar(ME, "community_report", ["prv_user", "impersonation", ""])).toBe("reported");
    const mine = await call(ME, "community_list_my_reports");
    expect(mine.map((r) => [r.target_public_id, r.status])).toEqual(expect.arrayContaining([["pub_user", "open"], ["prv_user", "open"]]));
    expect(Object.keys(mine[0]).sort()).toEqual(["created_at", "id", "reason", "status", "target_public_id"]);
    const prvReport = mine.find((r) => r.target_public_id === "prv_user")!;
    expect(await scalar(ME, "community_withdraw_report", [prvReport.id])).toBe("withdrawn");
    expect(await scalar(PUB, "community_withdraw_report", [mine.find((r) => r.target_public_id === "pub_user")!.id])).toBe("none"); // 他人の通報
    // 運営者（postgres）: 確認の列 → 対応して制限
    const queue = (await admin.query("select * from public.community_report_queue")).rows;
    expect(queue.map((r) => r.target_public_id)).toEqual(["pub_user"]);
    expect(queue[0].note).toBe("詳しい内容");
    expect((await admin.query("select public.community_moderate_report($1, 'actioned', 'test', true) as s", [queue[0].id])).rows[0].s).toBe("actioned");
    expect(await profile(ME, "pub_user")).toBeNull();
    expect(await call(ME, "community_search", ["pub"])).toEqual([]);
    // 制限中の本人は公開範囲を戻せても他人から見えず、申請もできない。制限は外せない（列の権限なし）
    await as(PUB, (q) => q("update public.public_profiles set visibility = 'public'"));
    expect(await profile(ME, "pub_user")).toBeNull();
    expect(await codeOf(call(PUB, "community_request_friend", ["me_user"]))).toBe("P0013");
    expect(await codeOf(as(PUB, (q) => q("update public.public_profiles set restricted_at = null")))).toBe("42501");
    expect(await codeOf(call(PUB, "community_save_my_profile", ["pub_user", "name pub_user", "public"]))).toBe("P0016");
    expect((await call(PUB, "community_my_profile"))[0]?.restricted).toBe(true);
    expect((await admin.query("select public.community_lift_restriction('pub_user') as s")).rows[0].s).toBe("lifted");
    expect((await profile(ME, "pub_user"))?.display_name).toBe("name pub_user");
    // 保持期間: 解決から 1 年を過ぎたものだけ消す
    await admin.query("update public.community_reports set reviewed_at = now() - interval '400 days' where target_public_id = 'pub_user'");
    expect(Number((await admin.query("select public.community_purge_old_reports() as n")).rows[0].n)).toBe(1);
    expect((await call(ME, "community_list_my_reports")).map((r) => r.target_public_id)).toEqual(["prv_user"]);
  });

  it("1 日の上限: 友達の申請 20・通報 20・ブロック 100", async () => {
    await admin.query("insert into public.community_rate_events (user_id, action) select $1, 'friend_request' from generate_series(1, 20)", [LNK]);
    expect(await codeOf(call(LNK, "community_request_friend", ["pub_user"]))).toBe("P0011");
    await admin.query("insert into public.community_rate_events (user_id, action) select $1, 'report' from generate_series(1, 20)", [LNK]);
    expect(await codeOf(call(LNK, "community_report", ["pub_user", "spam", ""]))).toBe("P0011");
    await admin.query("insert into public.community_rate_events (user_id, action) select $1, 'block' from generate_series(1, 100)", [LNK]);
    expect(await codeOf(call(LNK, "community_block", ["pub_user"]))).toBe("P0011");
    // 古い記録は数えない（2 日より前は消える）
    await admin.query("update public.community_rate_events set created_at = now() - interval '3 days' where user_id = $1", [LNK]);
    expect(await scalar(LNK, "community_request_friend", ["pub_user"])).toBe("requested");
    expect(Number((await admin.query("select count(*) as n from public.community_rate_events where user_id = $1", [LNK])).rows[0].n)).toBe(1);
  });

  it("退会（auth.users の削除）で本人の関係は消え、通報は人の ID を外して残る", async () => {
    await call(ME, "community_report", ["lnk_user", "spam", ""]);
    await admin.query("delete from public.public_profiles where user_id = $1", [LNK]);
    await admin.query("delete from auth.users where id = $1", [LNK]);
    expect(Number((await admin.query("select count(*) as n from public.friendships where requester_id = $1 or addressee_id = $1", [LNK])).rows[0].n)).toBe(0);
    const r = (await admin.query("select target_user_id, target_public_id from public.community_reports where target_public_id = 'lnk_user'")).rows[0];
    expect(r).toEqual({ target_user_id: null, target_public_id: "lnk_user" });
  });

  it("戻すと新しい表・関数が消え、公開 ID は残る（link / friends は private に）", async () => {
    await admin.query(ROLLBACK);
    for (const t of ["friendships", "user_mutes", "community_reports", "community_rate_events", "comparison_summaries"]) {
      expect((await admin.query("select to_regclass($1) as r", [`public.${t}`])).rows[0].r).toBeNull();
    }
    expect((await admin.query("select to_regprocedure('public.community_get_profile(text)') as r")).rows[0].r).toBeNull();
    expect((await admin.query("select visibility from public.public_profiles where public_id = 'frn_user'")).rows[0].visibility).toBe("private");
    await admin.query(APPLY); // 再適用できる
    expect((await admin.query("select to_regclass('public.friendships') as r")).rows[0].r).not.toBeNull();
  });
});
