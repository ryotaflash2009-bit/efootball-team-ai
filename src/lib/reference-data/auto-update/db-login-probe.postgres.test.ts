import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { classifyProbeError, probeDatabaseLogin } from "../../../../scripts/lib/db-login-probe.mjs";

/**
 * 自動 Apply の DB 接続の確認（`scripts/lib/db-login-probe.mjs`）を、CI の使い捨て PostgreSQL で確かめる（2026-10-07）。
 * 実 Supabase・Production へは接続しない。このテストが作るロール・schema は一意の名前で、終了時に消す。
 * 場面: 間違ったパスワード・正しいパスワード + select 1・関係が無い・権限が無い（列単位の grant を含む）・TLS の失敗・ネットワークの失敗。
 */
const admin = buildTestOnlyPgConfigFromEnv(process.env);
const suffix = randomBytes(4).toString("hex");
const ROLE = `probe_login_${suffix}`;
const PASSWORD = `pw_${randomBytes(12).toString("hex")}`;
const SCHEMA = `probe_ref_${suffix}`;

let adminClient: Client;
const spec = (tables: Record<string, { select?: boolean; update?: string[]; insert?: string[] }>) => ({ schema: SCHEMA, tables });
const connectAs = (password: string, extra: Record<string, unknown> = {}) => async () => {
  const c = new Client({ host: admin.host, port: admin.port, database: admin.database, user: ROLE, password, connectionTimeoutMillis: 5000, ...extra });
  c.on("error", () => {});
  await c.connect();
  return c;
};

beforeAll(async () => {
  adminClient = new Client(admin);
  await adminClient.connect();
  await adminClient.query(`create role ${ROLE} login password '${PASSWORD}' noinherit`);
  await adminClient.query(`create schema ${SCHEMA}`);
  await adminClient.query(`create table ${SCHEMA}.cards (id int primary key, ovr_max int, secret_note text)`);
  await adminClient.query(`create table ${SCHEMA}.hidden (id int)`);
  await adminClient.query(`grant usage on schema ${SCHEMA} to ${ROLE}`);
  await adminClient.query(`grant select on table ${SCHEMA}.cards to ${ROLE}`);
  // 本番の reference_data_updater と同じく列単位の grant
  await adminClient.query(`grant insert (id, ovr_max) on table ${SCHEMA}.cards to ${ROLE}`);
  await adminClient.query(`grant update (ovr_max) on table ${SCHEMA}.cards to ${ROLE}`);
  await adminClient.query(`alter role ${ROLE} set search_path = ${SCHEMA}`);
});

afterAll(async () => {
  if (!adminClient) return;
  await adminClient.query(`drop schema if exists ${SCHEMA} cascade`);
  await adminClient.query(`drop role if exists ${ROLE}`);
  await adminClient.end();
});

describe("DB の確認（使い捨て PostgreSQL）", () => {
  it("間違ったパスワード → INVALID_PASSWORD（接続の段階）", async () => {
    const r = await probeDatabaseLogin({ connect: connectAs("wrong-password"), expectedRole: ROLE, spec: spec({ cards: { select: true } }) });
    expect(r).toMatchObject({ stage: "connect", classification: "INVALID_PASSWORD", code: "28P01" });
  });

  it("正しいパスワード + select 1 成功 + 列単位の権限あり → LOGIN_OK_AND_PRIVILEGES_OK", async () => {
    const r = await probeDatabaseLogin({
      connect: connectAs(PASSWORD),
      expectedRole: ROLE,
      spec: spec({ cards: { select: true, insert: ["id", "ovr_max"], update: ["ovr_max"] } }),
    });
    expect(r).toMatchObject({ stage: "privileges", classification: "LOGIN_OK_AND_PRIVILEGES_OK", role: ROLE, checked: 4 });
  });

  it("旧い確認（has_table_privilege の UPDATE）は列単位の grant を見落とす（今回の修正の理由）", async () => {
    const c = await connectAs(PASSWORD)();
    try {
      const r = await c.query(`select has_table_privilege(current_user, '${SCHEMA}.cards', 'UPDATE') as t`);
      expect(r.rows[0].t).toBe(false);
    } finally {
      await c.end();
    }
  });

  it("正しいパスワード + 関係が無い → 42P01 にならず AUTHENTICATED_BUT_PROBE_RELATION_MISSING", async () => {
    const r = await probeDatabaseLogin({ connect: connectAs(PASSWORD), expectedRole: ROLE, spec: spec({ no_such_table: { select: true, update: ["x"] } }) });
    expect(r).toMatchObject({ stage: "privileges", classification: "AUTHENTICATED_BUT_PROBE_RELATION_MISSING", relation: `${SCHEMA}.no_such_table` });
    // schema 自体が無い場合も同じ分類（エラーにしない）
    const r2 = await probeDatabaseLogin({ connect: connectAs(PASSWORD), expectedRole: ROLE, spec: { schema: `${SCHEMA}_none`, tables: { cards: { select: true } } } });
    expect(r2.classification).toBe("AUTHENTICATED_BUT_PROBE_RELATION_MISSING");
  });

  it("旧い確認と同じ形の 42P01（public. の無い表）は、関係の名前つきで認証済みに分類される", async () => {
    const c = await connectAs(PASSWORD)();
    try {
      let caught: unknown = null;
      try {
        await c.query("select has_table_privilege(current_user, 'public.world_player_cards', 'UPDATE')");
      } catch (e) {
        caught = e;
      }
      expect(classifyProbeError(caught)).toEqual({ classification: "AUTHENTICATED_BUT_PROBE_RELATION_MISSING", code: "42P01", relation: "public.world_player_cards" });
    } finally {
      await c.end();
    }
  });

  it("正しいパスワード + 権限が無い → AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE（列・表を示す）。42501 も同じ分類", async () => {
    const r = await probeDatabaseLogin({
      connect: connectAs(PASSWORD),
      expectedRole: ROLE,
      spec: spec({ cards: { select: true, update: ["ovr_max", "secret_note"] }, hidden: { select: true } }),
    });
    expect(r.classification).toBe("AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE");
    expect(r.missingPrivileges).toEqual(expect.arrayContaining([`${SCHEMA}.cards.secret_note:UPDATE`, `${SCHEMA}.hidden:SELECT`]));
    expect(r.missingPrivileges).not.toContain(`${SCHEMA}.cards.ovr_max:UPDATE`);
    const c = await connectAs(PASSWORD)();
    try {
      let caught: unknown = null;
      try {
        await c.query(`select * from ${SCHEMA}.hidden`);
      } catch (e) {
        caught = e;
      }
      expect(classifyProbeError(caught)).toMatchObject({ classification: "AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE", code: "42501" });
    } finally {
      await c.end();
    }
  });

  it("別のロールでログイン → AUTHENTICATED_AS_UNEXPECTED_ROLE", async () => {
    const r = await probeDatabaseLogin({ connect: connectAs(PASSWORD), expectedRole: "reference_data_updater", spec: spec({ cards: { select: true } }) });
    expect(r.classification).toBe("AUTHENTICATED_AS_UNEXPECTED_ROLE");
  });

  it("TLS の失敗（TLS 必須で接続・CI の DB は TLS なし）→ TLS_FAILURE", async () => {
    const r = await probeDatabaseLogin({
      connect: connectAs(PASSWORD, { ssl: { rejectUnauthorized: true, ca: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n" } }),
      expectedRole: ROLE,
      spec: spec({ cards: { select: true } }),
    });
    expect(r).toMatchObject({ stage: "connect", classification: "TLS_FAILURE" });
  });

  it("ネットワークの失敗（閉じたポート）→ CONNECTION_FAILURE", async () => {
    const r = await probeDatabaseLogin({
      connect: async () => {
        const c = new Client({ host: "127.0.0.1", port: 1, database: admin.database, user: ROLE, password: PASSWORD, connectionTimeoutMillis: 3000 });
        c.on("error", () => {});
        await c.connect();
        return c;
      },
      expectedRole: ROLE,
      spec: spec({ cards: { select: true } }),
    });
    expect(r).toMatchObject({ stage: "connect", classification: "CONNECTION_FAILURE" });
  });

  it("確認は読み取りだけ（確認の前後で表の行が変わらない）", async () => {
    await adminClient.query(`insert into ${SCHEMA}.cards values (1, 90, 'x') on conflict do nothing`);
    const before = await adminClient.query(`select * from ${SCHEMA}.cards order by id`);
    await probeDatabaseLogin({ connect: connectAs(PASSWORD), expectedRole: ROLE, spec: spec({ cards: { select: true, insert: ["id"], update: ["ovr_max"] } }) });
    const after = await adminClient.query(`select * from ${SCHEMA}.cards order by id`);
    expect(after.rows).toEqual(before.rows);
  });
});
