import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditRlsProbeSql } from "./rls-probe-sql-audit";

const REPO_ROOT = resolve(__dirname, "../../..");
const CREATE_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/create-rls-probe-records.sql");
const ROLLBACK_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-rls-probe-records.sql");

const VALID_BASELINE = `
create extension if not exists pgcrypto;

create table if not exists public.rls_probe_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.rls_probe_records_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'no';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rls_probe_records_guard on public.rls_probe_records;
create trigger rls_probe_records_guard
  before insert or update on public.rls_probe_records
  for each row
  execute function public.rls_probe_records_guard();

alter table public.rls_probe_records enable row level security;

create policy rls_probe_records_select_own
  on public.rls_probe_records
  for select
  to authenticated
  using (user_id = auth.uid());

create policy rls_probe_records_insert_own
  on public.rls_probe_records
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy rls_probe_records_update_own
  on public.rls_probe_records
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy rls_probe_records_delete_own
  on public.rls_probe_records
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.rls_probe_records from public;
revoke all on public.rls_probe_records from anon;
grant select, insert, update, delete on public.rls_probe_records to authenticated;
`;

describe("auditRlsProbeSql: 実際のマイグレーションファイル", () => {
  it("create-rls-probe-records.sql は監査項目をすべて満たす(issues空)", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    const result = auditRlsProbeSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rollback-rls-probe-records.sql は同じテーブル名・関数名を対象にしている", () => {
    const sql = readFileSync(ROLLBACK_SQL_PATH, "utf8");
    expect(sql).toContain("rls_probe_records");
    expect(sql).toContain("rls_probe_records_guard");
    // ロールバックはauth.usersやシステムスキーマを一切変更しない
    expect(sql).not.toMatch(/alter\s+table\s+auth\.users/i);
    expect(sql).not.toMatch(/drop\s+schema/i);
  });

  it("マイグレーションファイルは実際の値(email/service_role/secret)を含まない", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/sb_secret_/);
  });
});

describe("auditRlsProbeSql: 監査ロジックそのものが違反を検出できること(合成SQL)", () => {
  it("正常な基準SQLはissuesが空になる(監査関数自体の健全性確認)", () => {
    expect(auditRlsProbeSql(VALID_BASELINE).issues).toEqual([]);
  });

  it("RLSが無効化されている場合を検出する", () => {
    const bad = VALID_BASELINE.replace(/alter table public\.rls_probe_records enable row level security;/, "");
    expect(auditRlsProbeSql(bad).issues).toContain("RLSが有効化されていません(ENABLE ROW LEVEL SECURITY)");
  });

  it("SELECTポリシーが欠落している場合を検出する", () => {
    const bad = VALID_BASELINE.replace(/create policy rls_probe_records_select_own[\s\S]*?using \(user_id = auth\.uid\(\)\);/, "");
    expect(auditRlsProbeSql(bad).issues).toContain("SELECTポリシーが見つかりません");
  });

  it("USING (true)のような無条件許可を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for select\n  to authenticated\n  using (user_id = auth.uid());",
      "for select\n  to authenticated\n  using (true);",
    );
    const result = auditRlsProbeSql(bad);
    expect(result.issues).toContain("SELECTポリシーに無条件許可(USING/WITH CHECK (true))が含まれています");
  });

  it("WITH CHECK (true)のような無条件許可を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for insert\n  to authenticated\n  with check (user_id = auth.uid());",
      "for insert\n  to authenticated\n  with check (true);",
    );
    expect(auditRlsProbeSql(bad).issues).toContain("INSERTポリシーに無条件許可(USING/WITH CHECK (true))が含まれています");
  });

  it("ポリシーがanonへ許可されている場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for select\n  to authenticated\n  using (user_id = auth.uid());",
      "for select\n  to authenticated, anon\n  using (user_id = auth.uid());",
    );
    expect(auditRlsProbeSql(bad).issues).toContain("SELECTポリシーがpublic/anonへ許可されています");
  });

  it("INSERTポリシーにWITH CHECKのauth.uid()条件が無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for insert\n  to authenticated\n  with check (user_id = auth.uid());",
      "for insert\n  to authenticated\n  with check (label is not null);",
    );
    expect(auditRlsProbeSql(bad).issues).toContain("INSERTポリシーのWITH CHECK句にauth.uid()条件がありません");
  });

  it("UPDATEポリシーにWITH CHECKが無い場合を検出する(USINGだけでは不十分)", () => {
    const bad = VALID_BASELINE.replace(
      "for update\n  to authenticated\n  using (user_id = auth.uid())\n  with check (user_id = auth.uid());",
      "for update\n  to authenticated\n  using (user_id = auth.uid());",
    );
    expect(auditRlsProbeSql(bad).issues).toContain("UPDATEポリシーのWITH CHECK句にauth.uid()条件がありません");
  });

  it("anon/publicへのGRANTを検出する", () => {
    const bad = VALID_BASELINE.replace(
      "grant select, insert, update, delete on public.rls_probe_records to authenticated;",
      "grant select on public.rls_probe_records to anon;",
    );
    expect(auditRlsProbeSql(bad).issues).toContain("anon/publicへGRANTしています");
  });

  it("service_roleへの言及を検出する", () => {
    const bad = VALID_BASELINE + "\n-- uses service_role for admin bypass\n";
    expect(auditRlsProbeSql(bad).issues).toContain("service_roleへの言及があります");
  });

  it("emailカラムを検出する(所有者判定にemailを使うべきではない)", () => {
    const bad = VALID_BASELINE.replace("label text not null,", "label text not null,\n  email text,");
    expect(auditRlsProbeSql(bad).issues).toContain("テーブルにemailカラムが含まれています(所有者判定に使うべきではない)");
  });

  it("user_idにNOT NULLが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,",
      "user_id uuid default auth.uid() references auth.users (id) on delete cascade,",
    );
    expect(auditRlsProbeSql(bad).issues).toContain("user_idにNOT NULL制約がありません");
  });

  it("user_idの既定値がauth.uid()でない場合を検出する", () => {
    const bad = VALID_BASELINE.replace("default auth.uid() references auth.users", "references auth.users");
    expect(auditRlsProbeSql(bad).issues).toContain("user_idの既定値にauth.uid()が使われていません");
  });

  it("SECURITY DEFINER関数を検出する", () => {
    const bad = VALID_BASELINE.replace("security invoker", "security definer");
    expect(auditRlsProbeSql(bad).issues).toContain("SECURITY DEFINER関数が使われています(必要性の明示的な確認が必要)");
  });

  it("search_pathの固定が無い関数を検出する", () => {
    const bad = VALID_BASELINE.replace("set search_path = ''\n", "");
    expect(auditRlsProbeSql(bad).issues).toContain("関数にsearch_pathの固定設定がありません");
  });

  it("動的SQL(EXECUTE format(...))の使用を検出する", () => {
    const bad = VALID_BASELINE + "\ndo $$ begin execute format('select %I', 'x'); end; $$;\n";
    expect(auditRlsProbeSql(bad).issues).toContain("動的SQL(EXECUTE)の使用が疑われます");
  });

  it("auth.usersを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\nalter table auth.users add column extra text;\n";
    expect(auditRlsProbeSql(bad).issues).toContain("auth.usersを変更/削除/切り詰める文が含まれています");
  });

  it("Supabaseシステムスキーマを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\ndrop schema storage cascade;\n";
    expect(auditRlsProbeSql(bad).issues).toContain("Supabaseのシステムスキーマを変更/削除する文が含まれています");
  });

  it("Secret key風の文字列(sb_secret_)を検出する", () => {
    const bad = VALID_BASELINE + "\n-- sb_secret_abcdefg\n";
    expect(auditRlsProbeSql(bad).issues).toContain("Secret key/JWT形式に見える文字列が含まれています");
  });
});
