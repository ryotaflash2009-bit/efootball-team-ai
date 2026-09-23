import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkStage2Metadata, parseStage2Metadata, type Stage2Metadata } from "./production-metadata-contract";
import { UPDATE_TABLE_CONTRACTS, type ReferenceTable } from "./update-contract";
import { UPDATER_COLUMN_GRANTS, UPDATER_POLICY_NAMES, type UpdaterTable } from "./updater-role";
import { buildAlterRolePasswordSql, buildScramSha256Verifier, validatePasswordForScram } from "../../../../scripts/lib/scram-verifier.mjs";

const TABLES: ReferenceTable[] = ["world_player_cards", "managers", "player_card_analysis", "import_batches"];

function typeOf(t: ReferenceTable, c: string): string {
  const k = UPDATE_TABLE_CONTRACTS[t];
  if (k.jsonbColumns.includes(c)) return "jsonb";
  if (k.textArrayColumns.includes(c)) return "text[]";
  if (k.timestampColumns.includes(c)) return "timestamp with time zone";
  if (c === "import_batch_id" || c === "batch_id") return "uuid";
  return "text";
}

function baseMetadata(): Stage2Metadata {
  return {
    tables: TABLES.map((t) => ({ name: t, owner: "postgres", rls_enabled: true, rls_forced: true, columns: UPDATE_TABLE_CONTRACTS[t].productionColumns.map((c) => ({ name: c, type: typeOf(t, c), notNull: false })) })),
    roles: [{ name: "reference_data_backup_reader", canLogin: true, super: false, createDb: false, createRole: false, replication: false, bypassRls: false, inherit: false, connLimit: 2, config: [] }],
    policies: TABLES.map((t) => ({ table: t, name: `${t}_backup_reader_select`, cmd: "SELECT", permissive: "PERMISSIVE", roles: ["reference_data_backup_reader"] })),
    updaterTableGrants: [],
    updaterColumnGrants: [],
    updaterSensitiveAccess: [],
  };
}

function withUpdater(m: Stage2Metadata): Stage2Metadata {
  const tables = Object.keys(UPDATER_COLUMN_GRANTS) as UpdaterTable[];
  return {
    ...m,
    roles: [
      ...m.roles,
      {
        name: "reference_data_updater", canLogin: true, super: false, createDb: false, createRole: false, replication: false, bypassRls: false, inherit: false, connLimit: 1,
        config: ["idle_in_transaction_session_timeout=60s", "lock_timeout=5s", "search_path=reference_data", "statement_timeout=120s"],
      },
    ],
    policies: [...m.policies, ...UPDATER_POLICY_NAMES.map((n) => ({ table: n.split("_updater_")[0], name: n, cmd: n.endsWith("select") ? "SELECT" : n.endsWith("insert") ? "INSERT" : "UPDATE", permissive: "PERMISSIVE", roles: "{reference_data_updater}" }))],
    updaterTableGrants: tables.map((t) => ({ table: t, privilege: "SELECT" })),
    updaterColumnGrants: tables.flatMap((t) => (["insert", "update"] as const).flatMap((p) => UPDATER_COLUMN_GRANTS[t][p].map((c) => ({ table: t, privilege: p.toUpperCase(), column: c })))),
  };
}

describe("Stage 2 metadata照合", () => {
  it("pre: 契約どおりならok、updaterが既にあればNG", () => {
    expect(checkStage2Metadata(baseMetadata(), "pre")).toEqual({ phase: "pre", ok: true, problems: [] });
    expect(checkStage2Metadata(withUpdater(baseMetadata()), "pre").problems).toEqual(expect.arrayContaining(["updater_role_already_exists", "updater_policies_already_exist", "updater_grants_already_exist"]));
  });

  it("post: 契約どおりならok", () => {
    expect(checkStage2Metadata(withUpdater(baseMetadata()), "post")).toEqual({ phase: "post", ok: true, problems: [] });
  });

  it("列の欠落・型違い・RLS未FORCE・owner・Backup reader policyの変化を検出する", () => {
    const m = baseMetadata();
    m.tables[0].columns = m.tables[0].columns!.filter((c) => c.name !== "appearance_updated_at");
    m.tables[1].columns = m.tables[1].columns!.map((c) => (c.name === "boosters" ? { ...c, type: "json" } : c));
    m.tables[2].rls_forced = false;
    m.tables[3].owner = "reference_data_updater";
    m.policies = m.policies.slice(1);
    expect(checkStage2Metadata(m, "pre").problems).toEqual(
      expect.arrayContaining(["column_missing:world_player_cards.appearance_updated_at", "column_type:managers.boosters", "rls_not_forced:player_card_analysis", "table_owned_by_limited_role:import_batches", "backup_reader_policies_changed"]),
    );
  });

  it("post: BYPASSRLS・設定値・余分な権限・DELETE policy・利用者データへの権限を検出する", () => {
    const m = withUpdater(baseMetadata());
    m.roles[1] = { ...m.roles[1], bypassRls: true, config: [] };
    m.updaterTableGrants.push({ table: "managers", privilege: "DELETE" });
    m.updaterColumnGrants.push({ table: "world_player_cards", privilege: "UPDATE", column: "ai_styles" });
    m.policies.push({ table: "managers", name: "managers_updater_delete", cmd: "DELETE", permissive: "PERMISSIVE", roles: ["reference_data_updater"] });
    m.updaterSensitiveAccess = ["auth.users"];
    expect(checkStage2Metadata(m, "post").problems).toEqual(
      expect.arrayContaining(["updater_attribute:bypassRls", "updater_settings", "updater_table_grants", "updater_column_grants:world_player_cards:update", "updater_policies", "updater_policy_command:managers_updater_delete", "updater_sensitive_access:auth.users"]),
    );
  });

  it("SQL Editorの出力(前後に文字列があっても)を解析し、必須配列が無ければ拒否する", () => {
    const text = `stage2_metadata\n${JSON.stringify(baseMetadata())}\n(1 row)`;
    expect(parseStage2Metadata(text).tables.length).toBe(4);
    expect(parseStage2Metadata(JSON.stringify({ stage2_metadata: baseMetadata() })).roles.length).toBe(1);
    expect(() => parseStage2Metadata('{"tables":[]}')).toThrow(/roles/);
    expect(() => parseStage2Metadata("no json")).toThrow();
  });

  it("metadata SQLは読み取り専用のcatalog参照だけ(行データ・書込み・秘密情報なし)", () => {
    const sql = readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql", "stage2-production-metadata-check.sql"), "utf8");
    // 文字列literal(権限名の指定など)は文ではないため除いてから検査する。
    const code = sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n").replace(/'[^']*'/g, "''");
    expect(sql.slice(0, 600)).toMatch(/READ ONLY[\s\S]*METADATA ONLY[\s\S]*DOES NOT READ USER ROW DATA/);
    expect(code).not.toMatch(/\b(insert|update|delete|truncate|grant|revoke|alter|create|drop)\b/i);
    expect(code).not.toMatch(/from\s+(reference_data|auth|public)\.\w+/i);
    expect(code).not.toMatch(/password|passwd|rolpassword|pg_authid|pg_shadow/i);
  });
});

describe("SCRAM-SHA-256 verifier", () => {
  it("PostgreSQLの保存形式(SCRAM-SHA-256$iter:salt$StoredKey:ServerKey)で、同じsaltなら決定的", () => {
    // 実際にPostgreSQLがこのverifierでloginを受け付けることは stage2-production-setup.postgres.test.ts で確認する。
    const salt = Buffer.from("W22ZaJ0SNY7soEsUEjb6gQ==", "base64");
    const long = "pencil-pencil-pencil-pencil";
    const v = buildScramSha256Verifier(long, salt);
    expect(v).toMatch(/^SCRAM-SHA-256\$4096:W22ZaJ0SNY7soEsUEjb6gQ==\$[A-Za-z0-9+/=]{44}:[A-Za-z0-9+/=]{44}$/);
    expect(buildScramSha256Verifier(long, salt)).toBe(v);
  });

  it("短い・非ASCII・空白・引用符を含むpasswordを拒否し、SQLに平文を含めない", () => {
    expect(validatePasswordForScram("short")).toMatch(/24文字/);
    expect(validatePasswordForScram("パスワードパスワードパスワードパスワードパスワード")).toMatch(/ASCII/);
    expect(validatePasswordForScram("abc def ghi jkl mno pqr stu")).toMatch(/ASCII/);
    expect(validatePasswordForScram("abcdefghijklmnopqrstuvwx'")).toMatch(/クォート/);
    const pw = "Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!";
    const sql = buildAlterRolePasswordSql("reference_data_updater", buildScramSha256Verifier(pw));
    expect(sql).toMatch(/^alter role reference_data_updater with password 'SCRAM-SHA-256\$4096:/);
    expect(sql).not.toContain(pw);
    expect(() => buildAlterRolePasswordSql("x; drop", "SCRAM-SHA-256$4096:a$b:c")).toThrow();
    expect(() => buildAlterRolePasswordSql("reference_data_updater", "plaintext")).toThrow();
  });
});
