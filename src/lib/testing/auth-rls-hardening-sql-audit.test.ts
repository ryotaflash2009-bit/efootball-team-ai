import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditAuthRlsInitplanSql, auditRlsAutoEnableExecuteSql } from "./auth-rls-hardening-sql-audit";

const REPO_ROOT = resolve(__dirname, "../../..");
const OPTIMIZE_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/optimize-auth-rls-initplan.sql");
const ROLLBACK_INITPLAN_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-auth-rls-initplan.sql");
const REVOKE_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/revoke-rls-auto-enable-public-execute.sql");
const ROLLBACK_REVOKE_SQL_PATH = resolve(
  REPO_ROOT,
  "docs/production-readiness/sql/rollback-revoke-rls-auto-enable-public-execute.sql",
);

describe("auditAuthRlsInitplanSql: optimize-auth-rls-initplan.sql(実ファイル)", () => {
  const sql = readFileSync(OPTIMIZE_SQL_PATH, "utf8");

  it("(select auth.uid())形式への書き換えとして安全", () => {
    const result = auditAuthRlsInitplanSql(sql, true);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("素のauth.uid()形式としては不合格になる(検出力の確認)", () => {
    const result = auditAuthRlsInitplanSql(sql, false);
    expect(result.ok).toBe(false);
  });

  it("破壊的操作・秘密情報・システムスキーマ変更を含まない", () => {
    expect(sql).not.toMatch(/drop\s+table|truncate|delete\s+from|insert\s+into/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9_-]/);
  });

  it("8ポリシー以外(CREATE/DROP TABLE・CREATE/DROP POLICY)を含まない", () => {
    expect(sql).not.toMatch(/create\s+table|drop\s+table|create\s+policy|drop\s+policy/i);
  });
});

describe("auditAuthRlsInitplanSql: rollback-auth-rls-initplan.sql(実ファイル)", () => {
  const sql = readFileSync(ROLLBACK_INITPLAN_SQL_PATH, "utf8");

  it("素のauth.uid()形式への復元として安全(元定義と一致)", () => {
    const result = auditAuthRlsInitplanSql(sql, false);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("create-rls-probe-records.sql/create-my-team-cloud-schema.sqlの元のUSING/WITH CHECK句と一致する", () => {
    const createRlsProbe = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/create-rls-probe-records.sql"), "utf8");
    const createMyTeamCloud = readFileSync(
      resolve(REPO_ROOT, "docs/production-readiness/sql/create-my-team-cloud-schema.sql"),
      "utf8",
    );
    // 元定義がuser_id = auth.uid()という素の形式であることを確認する
    // (ロールバック先として正しいことの根拠)。
    expect(createRlsProbe).toMatch(/using\s*\(user_id\s*=\s*auth\.uid\(\)\)/i);
    expect(createMyTeamCloud).toMatch(/using\s*\(user_id\s*=\s*auth\.uid\(\)\)/i);
  });
});

describe("auditRlsAutoEnableExecuteSql: revoke-rls-auto-enable-public-execute.sql(実ファイル)", () => {
  const sql = readFileSync(REVOKE_SQL_PATH, "utf8");

  it("PUBLICからだけEXECUTE権限をREVOKEする安全な内容(実測状態に一致)", () => {
    const result = auditRlsAutoEnableExecuteSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("anon/authenticated/postgresへの個別REVOKEを含まない(実測上その必要がないため)", () => {
    expect(sql).not.toMatch(/revoke\s+execute\b[^;]*\b(from)\s+(anon|authenticated|postgres)\b/i);
  });

  it("関数の削除・変更・再作成を含まない(関数自体は維持)", () => {
    expect(sql).not.toMatch(/drop\s+function|alter\s+function|create\s+(?:or\s+replace\s+)?function/i);
  });

  it("対象がpublic.rls_auto_enable()に限定されている", () => {
    const statements = sql.split(";").filter((s) => /revoke|grant/i.test(s));
    for (const s of statements) {
      expect(s).toMatch(/public\.rls_auto_enable\(\)/);
    }
  });

  it("Event Triggerの削除を含まない", () => {
    expect(sql).not.toMatch(/drop\s+event\s+trigger/i);
  });

  it("実測された実行前の権限状態(PUBLIC/postgres/anon/authenticated)が明記されている", () => {
    expect(sql).toMatch(/実測/);
    expect(sql).toMatch(/ensure_rls/);
  });
});

describe("auditRlsAutoEnableExecuteSql: rollback-revoke-rls-auto-enable-public-execute.sql(実ファイル)", () => {
  const sql = readFileSync(ROLLBACK_REVOKE_SQL_PATH, "utf8");

  it("PUBLICへEXECUTE権限をGRANTし直すだけの安全な内容(実測された実行前状態への復元)", () => {
    const result = auditRlsAutoEnableExecuteSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("anon/authenticatedへの個別GRANTを含まない(実測上、実行前にそれらへの個別GRANTは存在しなかったため)", () => {
    expect(sql).not.toMatch(/grant\s+execute\b[^;]*\bto\s+(anon|authenticated)\b/i);
  });

  it("実測に基づく復元である旨が明記されている", () => {
    expect(sql).toMatch(/実測/);
  });
});

describe("auditAuthRlsInitplanSql: 違反検出力の確認(合成SQL)", () => {
  it("anon/publicへのロール変更を検出する", () => {
    const badSql = `
begin;
alter policy rls_probe_records_select_own
  on public.rls_probe_records
  to anon
  using (user_id = (select auth.uid()));
commit;
    `;
    const result = auditAuthRlsInitplanSql(badSql, true);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("anon/publicへのロール変更"))).toBe(true);
  });

  it("user_id比較の欠落を検出する", () => {
    const badSql = `
begin;
alter policy rls_probe_records_select_own
  on public.rls_probe_records
  using (true);
commit;
    `;
    const result = auditAuthRlsInitplanSql(badSql, true);
    expect(result.ok).toBe(false);
  });

  it("BEGIN/COMMITが無いと検出する", () => {
    const badSql = `
alter policy rls_probe_records_select_own
  on public.rls_probe_records
  using (user_id = (select auth.uid()));
    `;
    const result = auditAuthRlsInitplanSql(badSql, true);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("BEGIN") || i.includes("COMMIT"))).toBe(true);
  });
});

describe("auditRlsAutoEnableExecuteSql: 違反検出力の確認(合成SQL)", () => {
  it("DROP FUNCTIONを検出する", () => {
    const badSql = `
begin;
drop function public.rls_auto_enable();
commit;
    `;
    const result = auditRlsAutoEnableExecuteSql(badSql);
    expect(result.ok).toBe(false);
  });

  it("対象外関数へのREVOKEを検出する", () => {
    const badSql = `
begin;
revoke execute on function public.some_other_function() from public;
commit;
    `;
    const result = auditRlsAutoEnableExecuteSql(badSql);
    expect(result.ok).toBe(false);
  });

  it("anonへの個別REVOKEを検出する(実測状態では不要)", () => {
    const badSql = `
begin;
revoke execute on function public.rls_auto_enable() from anon;
commit;
    `;
    const result = auditRlsAutoEnableExecuteSql(badSql);
    expect(result.ok).toBe(false);
  });

  it("postgresへのREVOKEを検出する(実行権限を維持すべき対象)", () => {
    const badSql = `
begin;
revoke execute on function public.rls_auto_enable() from postgres;
commit;
    `;
    const result = auditRlsAutoEnableExecuteSql(badSql);
    expect(result.ok).toBe(false);
  });
});
