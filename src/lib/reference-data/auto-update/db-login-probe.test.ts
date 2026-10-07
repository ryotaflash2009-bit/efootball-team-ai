import { describe, it, expect } from "vitest";
import { classifyProbeError, flattenPrivilegeSpec, formatProbeResult, probeDatabaseLogin, PROBE_CLASSIFICATIONS } from "../../../../scripts/lib/db-login-probe.mjs";
import { UPDATER_EXPECTED_ROLE, UPDATER_PROBE_SPEC } from "../../../../scripts/lib/updater-probe-spec.mjs";
import { buildClientConfig } from "../../../../scripts/check-apply-db-login.mjs";
import { UPDATER_COLUMN_GRANTS, UPDATER_ROLE_SETTINGS } from "./updater-role";

const err = (code: string | undefined, message = "x") => Object.assign(new Error(message), code ? { code } : {});

describe("DB の確認: SQLSTATE の分類", () => {
  it("28P01 は INVALID_PASSWORD", () => {
    expect(classifyProbeError(err("28P01", 'password authentication failed for user "reference_data_updater.abc"'))).toEqual({ classification: "INVALID_PASSWORD", code: "28P01", relation: null });
  });
  it("42P01 は認証済み・関係が無い（LOGIN_FAILED ではない）。関係の名前だけを安全に取り出す", () => {
    expect(classifyProbeError(err("42P01", 'relation "public.world_player_cards" does not exist'))).toEqual({
      classification: "AUTHENTICATED_BUT_PROBE_RELATION_MISSING",
      code: "42P01",
      relation: "public.world_player_cards",
    });
    expect(classifyProbeError(err("42P01", 'relation "a; drop table x" does not exist')).relation).toBeNull();
  });
  it("42501 は認証済み・権限不足", () => {
    expect(classifyProbeError(err("42501", "permission denied for table x")).classification).toBe("AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE");
  });
  it("08 系・ネットワークは CONNECTION_FAILURE", () => {
    for (const c of ["08006", "08001", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"]) expect(classifyProbeError(err(c)).classification).toBe("CONNECTION_FAILURE");
    expect(classifyProbeError(err(undefined, "Connection terminated due to connection timeout")).classification).toBe("CONNECTION_FAILURE");
  });
  it("TLS は TLS_FAILURE", () => {
    for (const c of ["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "ERR_SSL_WRONG_VERSION_NUMBER"]) {
      expect(classifyProbeError(err(c)).classification).toBe("TLS_FAILURE");
    }
    expect(classifyProbeError(err(undefined, "The server does not support SSL connections"))).toMatchObject({ classification: "TLS_FAILURE", code: "SSL_NOT_SUPPORTED" });
  });
  it("その他は PROBE_FAILED_WITH_SQLSTATE（SQLSTATE を残す）", () => {
    expect(classifyProbeError(err("57014"))).toEqual({ classification: "PROBE_FAILED_WITH_SQLSTATE", code: "57014", relation: null });
    expect(classifyProbeError(null)).toEqual({ classification: "PROBE_FAILED_WITH_SQLSTATE", code: "UNKNOWN", relation: null });
  });
  it("出力の行にエラー文・接続情報・パスワードを含めない", () => {
    const secretish = 'password authentication failed for user "reference_data_updater.abcdefghij" host=aws-0.pooler.supabase.com password=Sup3rS3cret';
    const line = formatProbeResult({ stage: "connect", ...classifyProbeError(err("28P01", secretish)) });
    expect(line).toBe("RESULT INVALID_PASSWORD stage=connect sqlstate=28P01");
    expect(line).not.toMatch(/Sup3rS3cret|pooler|abcdefghij/);
    expect(PROBE_CLASSIFICATIONS).toContain("AUTHENTICATED_BUT_PROBE_RELATION_MISSING");
  });
});

describe("DB の確認: 段階の分離（偽の client）", () => {
  const okRows = () => flattenPrivilegeSpec(UPDATER_PROBE_SPEC).rels.map((rel, i) => ({ rel, priv: "SELECT", col: String(i), rel_exists: true, col_exists: true, granted: true }));
  function fake(responses: Record<string, unknown>[] | Error, connectError?: Error) {
    const calls: string[] = [];
    let i = 0;
    const client = {
      query: async (sql: string) => {
        calls.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
        const r = Array.isArray(responses) ? responses[i++] : undefined;
        if (responses instanceof Error) throw responses;
        if (r instanceof Error) throw r;
        return r as { rows: unknown[] };
      },
      end: async () => {},
    };
    return { calls, connect: async () => { if (connectError) throw connectError; return client; } };
  }

  it("最初は select 1 だけ。成功の後に catalog の確認", async () => {
    const f = fake([{ rows: [{ ok: 1 }] }, { rows: [{ role: UPDATER_EXPECTED_ROLE, schema_usage: true, schema_exists: true }] }, { rows: okRows() }]);
    const r = await probeDatabaseLogin({ connect: f.connect, expectedRole: UPDATER_EXPECTED_ROLE, spec: UPDATER_PROBE_SPEC });
    expect(r.classification).toBe("LOGIN_OK_AND_PRIVILEGES_OK");
    expect(f.calls[0]).toBe("select 1 as");
    expect(f.calls).toHaveLength(3);
  });
  it("接続で 28P01 → INVALID_PASSWORD（SQL は実行しない）", async () => {
    const f = fake([], err("28P01"));
    const r = await probeDatabaseLogin({ connect: f.connect, expectedRole: UPDATER_EXPECTED_ROLE, spec: UPDATER_PROBE_SPEC });
    expect(r).toMatchObject({ stage: "connect", classification: "INVALID_PASSWORD" });
    expect(f.calls).toHaveLength(0);
  });
  it("別のロールでログイン → AUTHENTICATED_AS_UNEXPECTED_ROLE", async () => {
    const f = fake([{ rows: [{ ok: 1 }] }, { rows: [{ role: "postgres", schema_usage: true, schema_exists: true }] }]);
    expect((await probeDatabaseLogin({ connect: f.connect, expectedRole: UPDATER_EXPECTED_ROLE, spec: UPDATER_PROBE_SPEC })).classification).toBe("AUTHENTICATED_AS_UNEXPECTED_ROLE");
  });
  it("表が無い・権限が無い行を分類する", async () => {
    const rows = okRows();
    const missingRel = rows.map((x, i) => (i === 0 ? { ...x, rel_exists: false, granted: null } : x));
    const f1 = fake([{ rows: [{ ok: 1 }] }, { rows: [{ role: UPDATER_EXPECTED_ROLE, schema_usage: true, schema_exists: true }] }, { rows: missingRel }]);
    expect((await probeDatabaseLogin({ connect: f1.connect, expectedRole: UPDATER_EXPECTED_ROLE, spec: UPDATER_PROBE_SPEC })).classification).toBe("AUTHENTICATED_BUT_PROBE_RELATION_MISSING");
    const noGrant = rows.map((x, i) => (i === 1 ? { ...x, granted: false } : x));
    const f2 = fake([{ rows: [{ ok: 1 }] }, { rows: [{ role: UPDATER_EXPECTED_ROLE, schema_usage: true, schema_exists: true }] }, { rows: noGrant }]);
    const r2 = await probeDatabaseLogin({ connect: f2.connect, expectedRole: UPDATER_EXPECTED_ROLE, spec: UPDATER_PROBE_SPEC });
    expect(r2.classification).toBe("AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE");
    expect(formatProbeResult(r2)).toMatch(/missing=reference_data\.world_player_cards/);
  });
});

describe("確認の対象は正式な権限と同じ", () => {
  it("UPDATER_PROBE_SPEC は UPDATER_COLUMN_GRANTS・search_path の schema と一致する", () => {
    expect(UPDATER_PROBE_SPEC.schema).toBe(UPDATER_ROLE_SETTINGS.search_path);
    for (const [table, g] of Object.entries(UPDATER_COLUMN_GRANTS)) {
      const s = UPDATER_PROBE_SPEC.tables[table as keyof typeof UPDATER_PROBE_SPEC.tables];
      expect(s, table).toBeDefined();
      expect(s.select).toBe(g.select === "all");
      expect([...s.insert].sort()).toEqual([...g.insert].sort());
      expect([...s.update].sort()).toEqual([...g.update].sort());
    }
    expect(Object.keys(UPDATER_PROBE_SPEC.tables).sort()).toEqual(Object.keys(UPDATER_COLUMN_GRANTS).sort());
    // 関係の名前はすべて schema 付き
    expect(flattenPrivilegeSpec(UPDATER_PROBE_SPEC).rels.every((r: string) => r.startsWith("reference_data."))).toBe(true);
  });
  it("接続設定: sslmode などの query は拒否・TLS は CA で検証", () => {
    expect(() => buildClientConfig("postgresql://u:p@h.example:5432/postgres?sslmode=disable", "CA")).toThrow("URL_QUERY_NOT_ALLOWED");
    const c = buildClientConfig("postgresql://reference_data_updater.abc:p%40ss@h.example:5432/postgres", "CA");
    expect(c).toMatchObject({ user: "reference_data_updater.abc", password: "p@ss", database: "postgres", ssl: { ca: "CA", rejectUnauthorized: true } });
  });
});
