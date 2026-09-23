import { describe, it, expect } from "vitest";
import {
  buildSourceIdentitySql,
  buildSourceTableVisibilitySql,
  evaluateSourcePreflight,
  runSourcePreflight,
  PRODUCTION_EXPECTED_SOURCE_IDENTITY,
} from "./backup-source-preflight";
import { BACKUP_TARGET_TABLES } from "./backup-target";
import type { QueryClient, QueryResult } from "./apply-orchestrator";

const OK_IDENTITY = [
  { current_database_name: "postgres", current_user_name: "reference_data_backup_reader", session_user_name: "reference_data_backup_reader", is_superuser: false, bypass_rls: false },
];

function tableRows(overrides: Partial<Record<string, unknown>> = {}) {
  return BACKUP_TARGET_TABLES.map((t) => ({
    table_name: t, table_exists: true, rls_enabled: true, rls_forced: true, owner_is_current_user: false, has_select_privilege: true,
    has_applicable_select_policy: true, has_restrictive_select_policy: false, ...overrides,
  }));
}

function failures(identity: Record<string, unknown>[], tables: Record<string, unknown>[]) {
  return evaluateSourcePreflight(identity, tables, PRODUCTION_EXPECTED_SOURCE_IDENTITY).filter((c) => !c.ok).map((c) => c.reason ?? "");
}

describe("PRODUCTION_EXPECTED_SOURCE_IDENTITY", () => {
  it("database=postgres、role=reference_data_backup_reader(秘密情報ではない既知の契約)", () => {
    expect(PRODUCTION_EXPECTED_SOURCE_IDENTITY).toEqual({
      database: "postgres",
      currentUser: "reference_data_backup_reader",
      sessionUser: "reference_data_backup_reader",
      allowPrivilegedRoleForIsolatedTesting: false,
    });
    expect(Object.isFrozen(PRODUCTION_EXPECTED_SOURCE_IDENTITY)).toBe(true);
  });
});

describe("evaluateSourcePreflight", () => {
  it("想定どおりの接続先・RLSポリシーあり・SELECT権限ありなら合格", () => {
    expect(failures(OK_IDENTITY, tableRows())).toEqual([]);
  });

  it("Run #6の状態(RLS有効・このroleに適用されるSELECTポリシー無し・NOBYPASSRLS)を、全4テーブルについて明示的な理由で拒否する", () => {
    const reasons = failures(OK_IDENTITY, tableRows({ has_applicable_select_policy: false }));
    expect(reasons.length).toBe(4);
    for (const r of reasons) expect(r).toMatch(/RLS/);
  });

  it("RLS無効のテーブルはポリシー無しでも可視として扱う", () => {
    expect(failures(OK_IDENTITY, tableRows({ rls_enabled: false, has_applicable_select_policy: false }))).toEqual([]);
  });

  it("Productionの期待値では、BYPASSRLS・superuserのroleを成功条件にせずblockedにする(ポリシーがあっても)", () => {
    expect(failures([{ ...OK_IDENTITY[0], bypass_rls: true }], tableRows()).join(" ")).toMatch(/BYPASSRLS/);
    expect(failures([{ ...OK_IDENTITY[0], is_superuser: true }], tableRows()).join(" ")).toMatch(/superuser/);
  });

  it("隔離CI専用の明示フラグがある場合だけ、privileged roleはRLSを回避できるものとして扱う", () => {
    const ci = { ...PRODUCTION_EXPECTED_SOURCE_IDENTITY, allowPrivilegedRoleForIsolatedTesting: true };
    const r = evaluateSourcePreflight([{ ...OK_IDENTITY[0], is_superuser: true }], tableRows({ has_applicable_select_policy: false, owner_is_current_user: true }), ci);
    expect(r.every((c) => c.ok)).toBe(true);
  });

  it("FORCE RLSの有無を理由に含めて診断する(FORCE解除を成功条件にしない)", () => {
    const forced = failures(OK_IDENTITY, tableRows({ has_applicable_select_policy: false }));
    expect(forced[0]).toMatch(/FORCE: true/);
    const notForced = failures(OK_IDENTITY, tableRows({ rls_forced: false, has_applicable_select_policy: false }));
    expect(notForced[0]).toMatch(/FORCE: false/);
    expect(notForced.length).toBe(4); // FORCEが無くてもpolicyが無ければblocked
  });

  it("Backup roleがtable ownerならblockedにする", () => {
    expect(failures(OK_IDENTITY, tableRows({ owner_is_current_user: true })).join(" ")).toMatch(/所有者/);
  });

  it("このroleに適用されるRESTRICTIVE SELECTポリシーがある想定外の状態をblockedにする(PERMISSIVEポリシーがあっても)", () => {
    expect(failures(OK_IDENTITY, tableRows({ has_restrictive_select_policy: true })).join(" ")).toMatch(/RESTRICTIVE/);
  });

  it("新しい診断列が欠けた結果(旧形式)は形式不正としてblockedにする", () => {
    const legacy = BACKUP_TARGET_TABLES.map((t) => ({ table_name: t, table_exists: true, rls_enabled: true, has_select_privilege: true, has_applicable_select_policy: true }));
    expect(failures(OK_IDENTITY, legacy).length).toBe(4);
  });

  it("database名・current_user・session_userのいずれかが想定と異なれば拒否する", () => {
    expect(failures([{ ...OK_IDENTITY[0], current_database_name: "other" }], tableRows()).join(" ")).toMatch(/current_database/);
    expect(failures([{ ...OK_IDENTITY[0], current_user_name: "postgres" }], tableRows()).join(" ")).toMatch(/current_user/);
    expect(failures([{ ...OK_IDENTITY[0], session_user_name: "postgres" }], tableRows()).join(" ")).toMatch(/session_user/);
  });

  it("identityが0行・複数行なら拒否する", () => {
    expect(failures([], tableRows()).length).toBe(1);
    expect(failures([OK_IDENTITY[0], OK_IDENTITY[0]], tableRows()).length).toBe(1);
  });

  it("role属性が真偽値として判定できなければ拒否する", () => {
    expect(failures([{ ...OK_IDENTITY[0], bypass_rls: null }], tableRows()).join(" ")).toMatch(/role属性/);
  });

  it("テーブルが存在しない・SELECT権限が無い・結果行が欠落していれば拒否する", () => {
    expect(failures(OK_IDENTITY, tableRows({ table_exists: false })).length).toBe(4);
    expect(failures(OK_IDENTITY, tableRows({ has_select_privilege: false })).length).toBe(4);
    expect(failures(OK_IDENTITY, tableRows().slice(1)).length).toBe(1);
  });

  it("結果の真偽値の形式が不正なら拒否する", () => {
    expect(failures(OK_IDENTITY, tableRows({ rls_enabled: "maybe" })).length).toBe(4);
  });
});

describe("preflight SQL(読み取り専用・カタログだけ・schema修飾)", () => {
  const identitySql = buildSourceIdentitySql();
  const visibilitySql = buildSourceTableVisibilitySql("reference_data");

  it("適用可能なpolicyの条件は、PERMISSIVE・SELECTまたはALL・このroleまたはPUBLIC・USING (true)で、RESTRICTIVEは別に検出する", () => {
    expect(visibilitySql).toContain("p.permissive = 'PERMISSIVE'");
    expect(visibilitySql).toContain("p.qual = 'true'");
    expect(visibilitySql).toContain("p.permissive = 'RESTRICTIVE'");
    expect(visibilitySql).toContain("p.cmd in ('SELECT', 'ALL')");
    expect(visibilitySql).toContain("relforcerowsecurity");
    expect(visibilitySql).toContain("pg_get_userbyid(c.relowner) = current_user");
  });

  it("書込み・DDL・権限変更を一切含まない", () => {
    for (const sql of [identitySql, visibilitySql]) {
      expect(sql.trim().toLowerCase().startsWith("select")).toBe(true);
      expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|set)\b/i);
    }
  });

  it("利用者データ・auth系テーブル・対象テーブルの行そのものを読まない(pg_catalogだけ)", () => {
    for (const sql of [identitySql, visibilitySql]) {
      expect(sql).not.toMatch(/\bauth\./i);
      expect(sql).not.toMatch(/my_team_snapshots|rls_probe_records/i);
      const fromTargets = [...sql.matchAll(/\bfrom\s+([\w.]+)/gi)].map((m) => m[1]);
      for (const f of fromTargets) expect(f === "unnest" || f.startsWith("pg_catalog.")).toBe(true);
    }
  });

  it("対象4テーブルとreference_data schemaを固定で参照する", () => {
    for (const t of BACKUP_TARGET_TABLES) expect(visibilitySql).toContain(`'${t}'`);
    expect(visibilitySql).toContain("to_regclass('reference_data.' || t.table_name)");
    expect(visibilitySql).toContain("p.schemaname = 'reference_data'");
  });

  it("許可されていないschemaはSQL組み立て自体を拒否する", () => {
    expect(() => buildSourceTableVisibilitySql("public" as never)).toThrow();
    expect(() => buildSourceTableVisibilitySql("reference_data'; drop table x; --" as never)).toThrow();
  });
});

describe("runSourcePreflight(結果shapeの異常を空配列扱いしない)", () => {
  function client(identity: unknown, visibility: unknown): QueryClient {
    return {
      async query(sql: string): Promise<QueryResult> {
        return (/current_database\(\)/.test(sql) ? identity : visibility) as QueryResult;
      },
    };
  }

  it("正常な結果なら合格", async () => {
    const r = await runSourcePreflight(client({ rows: OK_IDENTITY }, { rows: tableRows() }), "reference_data", PRODUCTION_EXPECTED_SOURCE_IDENTITY);
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.tables.map((t) => t.table).sort()).toEqual([...BACKUP_TARGET_TABLES].sort());
    for (const t of r.tables) {
      expect(t.rlsForced).toBe(true);
      expect(t.ownerIsCurrentUser).toBe(false);
    }
  });

  it("rowsが無い・undefinedの結果は例外になる(空として通過しない)", async () => {
    await expect(runSourcePreflight(client(undefined, { rows: tableRows() }), "reference_data", PRODUCTION_EXPECTED_SOURCE_IDENTITY)).rejects.toThrow(/rows配列/);
    await expect(runSourcePreflight(client({ rows: OK_IDENTITY }, {}), "reference_data", PRODUCTION_EXPECTED_SOURCE_IDENTITY)).rejects.toThrow(/rows配列/);
  });
});
