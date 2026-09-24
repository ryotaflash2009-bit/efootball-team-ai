import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FORBIDDEN_SCHEMA_USAGE, FORBIDDEN_TABLE_SCHEMAS, runUpdaterPreflight, safeErrorCode, type PreflightClient } from "./production-apply-preflight";
import { UPDATER_COLUMN_GRANTS, UPDATER_ROLE_NAME, type UpdaterTable } from "./updater-role";
import { checkApplyMode } from "./production-apply-cli";

/**
 * preflightの判定を、catalog照会の結果を返すfake clientで確かめる(DB接続なし)。
 * 実際のPostgreSQLでの確認は stage2-production-setup.postgres.test.ts。
 */

const SCHEMA = "reference_data";
const TABLES = Object.keys(UPDATER_COLUMN_GRANTS) as UpdaterTable[];

interface FakeState {
  role: Record<string, unknown>;
  tableGrants: string[];
  columnGrants: Array<{ table_name: string; p: string; column_name: string }>;
  tables: Array<{ name: string; rls: boolean; forced: boolean; owned: boolean }>;
  schemaUsage: string[];
  sensitive: string[];
  lock: boolean;
  fail?: { step: RegExp; error: unknown };
}

function normalState(): FakeState {
  return {
    role: {
      u: UPDATER_ROLE_NAME, bypass: false, super: false, inherit: false,
      statement_timeout: "2min", lock_timeout: "5s", idle_in_transaction_session_timeout: "1min", read_only: "on",
    },
    tableGrants: TABLES.map((t) => `${SCHEMA}.${t}:SELECT`).sort(),
    columnGrants: TABLES.flatMap((t) => (["insert", "update"] as const).flatMap((p) => UPDATER_COLUMN_GRANTS[t][p].map((c) => ({ table_name: t, p, column_name: c })))),
    tables: [...TABLES, "player_card_analysis"].map((name) => ({ name, rls: true, forced: true, owned: false })),
    schemaUsage: [],
    sensitive: [],
    lock: true,
  };
}

function fakeClient(s: FakeState, log: string[] = []): PreflightClient {
  return {
    async query(sql: string) {
      log.push(sql);
      if (s.fail && s.fail.step.test(sql)) throw s.fail.error;
      if (/from pg_catalog\.pg_roles/.test(sql)) return { rows: [s.role] };
      if (/role_table_grants/.test(sql)) return { rows: s.tableGrants.map((g) => ({ g })) };
      if (/column_privileges/.test(sql)) return { rows: s.columnGrants };
      if (/relforcerowsecurity/.test(sql)) return { rows: s.tables };
      if (/has_schema_privilege/.test(sql)) return { rows: s.schemaUsage.map((name) => ({ name })) };
      if (/has_table_privilege/.test(sql)) return { rows: s.sensitive.map((name) => ({ name })) };
      if (/pg_try_advisory_xact_lock/.test(sql)) return { rows: [{ ok: s.lock }] };
      throw new Error("unexpected query in fake");
    },
  };
}

const pgError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("updater preflight: 利用者・認証データからの分離", () => {
  it("auth USAGEなし・auth.users権限なし・利用者data権限なしの正常状態は成功", async () => {
    const r = await runUpdaterPreflight(fakeClient(normalState()));
    expect(r).toMatchObject({ ok: true, problems: [] });
    expect(r.facts).toMatchObject({ sensitiveSchemaUsageCount: 0, sensitiveTableAccessCount: 0 });
  });

  it("auth USAGE・auth.users・利用者data・player_card_analysisへの権限があればfail", async () => {
    const cases: Array<[Partial<FakeState>, string]> = [
      [{ schemaUsage: ["auth"] }, "sensitive_schema_usage:auth"],
      [{ schemaUsage: ["reference_data_ops"] }, "sensitive_schema_usage:reference_data_ops"],
      [{ sensitive: ["auth.users"] }, "sensitive_access:auth.users"],
      [{ sensitive: ["public.my_team_snapshots"] }, "sensitive_access:public.my_team_snapshots"],
      [{ sensitive: ["reference_data.player_card_analysis"] }, "sensitive_access:reference_data.player_card_analysis"],
    ];
    for (const [patch, problem] of cases) {
      const r = await runUpdaterPreflight(fakeClient({ ...normalState(), ...patch }));
      expect(r.ok).toBe(false);
      expect(r.problems).toContain(problem);
    }
  });

  it("auth・利用者dataを名前解決せず、catalog+OID指定の権限関数で確認する(行データを読まない)", async () => {
    const log: string[] = [];
    await runUpdaterPreflight(fakeClient(normalState(), log));
    const all = log.join("\n");
    expect(all).not.toMatch(/to_regclass|::regclass|'auth\.users'/);
    expect(all).toMatch(/has_schema_privilege\(current_user, n\.oid, 'USAGE'\)/);
    expect(all).toMatch(/has_table_privilege\(current_user, c\.oid,/);
    expect(all).toMatch(/has_any_column_privilege\(current_user, c\.oid,/);
    expect(all).not.toMatch(/from\s+(auth|public|storage|vault|reference_data)\.\w+/i);
    expect([...FORBIDDEN_SCHEMA_USAGE]).toEqual(expect.arrayContaining(["auth"]));
    expect([...FORBIDDEN_TABLE_SCHEMAS]).toEqual(expect.arrayContaining(["auth", "public", "storage", "vault"]));
  });

  it("発行するSQLは全てselect(書き込み・権限変更・DDLなし)", async () => {
    const log: string[] = [];
    await runUpdaterPreflight(fakeClient(normalState(), log));
    expect(log.length).toBe(7);
    for (const sql of log) {
      expect(sql.trim()).toMatch(/^select\b/i);
      // 権限名の文字列literal('SELECT, INSERT, ...')は文ではないため除いてから検査する。
      const code = sql.replace(/'[^']*'/g, "''");
      expect(code).not.toMatch(/\b(insert|update|delete|truncate|grant|revoke|alter|create|drop|copy|set|security definer)\b/i);
    }
    const src = readFileSync(path.join(__dirname, "production-apply-preflight.ts"), "utf8");
    expect(src).not.toMatch(/\b(insert into|delete from|truncate |grant |revoke |alter |create |drop )/i);
  });
});

describe("updater preflight: role・権限の異常", () => {
  it("誤role・owner・BYPASSRLS・SUPERUSER・DELETE/TRUNCATE・read-onlyでない・lock取得不可はfail", async () => {
    const n = normalState;
    const cases: Array<[FakeState, string]> = [
      [{ ...n(), role: { ...n().role, u: "postgres" } }, "wrong_role"],
      [{ ...n(), tables: n().tables.map((t) => (t.name === "managers" ? { ...t, owned: true } : t)) }, "role_owns_table:managers"],
      [{ ...n(), tables: n().tables.map((t) => (t.name === "player_card_analysis" ? { ...t, owned: true } : t)) }, "role_owns_table:player_card_analysis"],
      [{ ...n(), role: { ...n().role, bypass: true } }, "role_bypasses_rls"],
      [{ ...n(), role: { ...n().role, super: true } }, "role_is_superuser"],
      [{ ...n(), tableGrants: [...n().tableGrants, `${SCHEMA}.managers:DELETE`].sort() }, "table_grants"],
      [{ ...n(), tableGrants: [...n().tableGrants, `${SCHEMA}.world_player_cards:TRUNCATE`].sort() }, "table_grants"],
      [{ ...n(), tables: n().tables.map((t) => (t.name === "managers" ? { ...t, forced: false } : t)) }, "rls_not_forced:managers"],
      [{ ...n(), role: { ...n().role, read_only: "off" } }, "preflight_not_read_only"],
      [{ ...n(), lock: false }, "production_write_lock_busy"],
      [{ ...n(), role: {} }, "wrong_role"],
    ];
    for (const [s, problem] of cases) {
      const r = await runUpdaterPreflight(fakeClient(s));
      expect(r.ok, problem).toBe(false);
      expect(r.problems).toContain(problem);
    }
  });
});

describe("updater preflight: 照会エラーは成功扱いにせず、安全なcodeだけを返す", () => {
  const raw = "permission denied for schema auth at postgres://reference_data_updater:secret-value@db.example.supabase.co:5432/postgres";

  it("42501(権限拒否)も含め、どの照会エラーもfail(握りつぶさない)", async () => {
    for (const [step, code] of [
      [/has_schema_privilege/, "42501"],
      [/has_table_privilege/, "42501"],
      [/pg_catalog\.pg_roles/, "57014"],
      [/role_table_grants/, "42P01"],
      [/pg_try_advisory_xact_lock/, "40001"],
      [/relforcerowsecurity/, "08006"],
    ] as const) {
      const r = await runUpdaterPreflight(fakeClient({ ...normalState(), fail: { step, error: pgError(code, raw) } }));
      expect(r.ok).toBe(false);
      expect(r.problems).toHaveLength(1);
      expect(r.problems[0]).toMatch(new RegExp(`^query_failed:[a-z_]+:sqlstate_${code}$`));
      expect(JSON.stringify(r)).not.toMatch(/permission denied|postgres:\/\/|secret-value|supabase/);
    }
  });

  it("codeの無い例外はunknownとしてfail", async () => {
    const r = await runUpdaterPreflight(fakeClient({ ...normalState(), fail: { step: /column_privileges/, error: new Error(raw) } }));
    expect(r).toEqual({ ok: false, problems: ["query_failed:column_grants:unknown"], facts: {} });
  });

  it("safeErrorCodeはSQLSTATEとNode.jsのerror codeだけを通し、本文を含めない", () => {
    expect(safeErrorCode(pgError("42501", raw))).toBe("sqlstate_42501");
    expect(safeErrorCode(pgError("28P01", raw))).toBe("sqlstate_28P01");
    expect(safeErrorCode(pgError("ECONNREFUSED", raw))).toBe("net_ECONNREFUSED");
    expect(safeErrorCode(pgError("SELF_SIGNED_CERT_IN_CHAIN", raw))).toBe("net_SELF_SIGNED_CERT_IN_CHAIN");
    expect(safeErrorCode(pgError("ERR_TLS_CERT_ALTNAME_INVALID", raw))).toBe("net_ERR_TLS_CERT_ALTNAME_INVALID");
    expect(safeErrorCode(pgError("postgres://u:p@h/db", raw))).toBe("unknown");
    expect(safeErrorCode(pgError("secret value with spaces", raw))).toBe("unknown");
    expect(safeErrorCode(new Error(raw))).toBe("unknown");
    expect(safeErrorCode(raw)).toBe("unknown");
    expect(safeErrorCode(null)).toBe("unknown");
  });
});

describe("Production apply CLI: mode", () => {
  it("許可済みのmode以外(undo・rollback・restore・表記ゆれ等)は接続前に拒否する", () => {
    for (const m of ["preflight", "plan", "dry-run", "apply", "verify"]) expect(checkApplyMode(m)).toBe(true);
    for (const m of ["APPLY", "preflight ", "", undefined, "undo", "rollback", "restore", "apply-world", "dry_run"]) expect(checkApplyMode(m)).toBe(false);
    // apply等の確認入力の照合は stage4-managers.test.ts(runStage4Mode)で確認する。
  });
});
