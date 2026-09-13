import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditMyTeamCloudSql } from "./my-team-cloud-sql-audit";

const REPO_ROOT = resolve(__dirname, "../../..");
const CREATE_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/create-my-team-cloud-schema.sql");
const ROLLBACK_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-my-team-cloud-schema.sql");

const VALID_BASELINE = `
create extension if not exists pgcrypto;

create table if not exists public.my_team_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schema_version text not null,
  team_data jsonb not null,
  item_count integer not null,
  payload_hash text not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint my_team_snapshots_user_id_unique unique (user_id),
  constraint my_team_snapshots_item_count_range check (item_count >= 0 and item_count <= 1000),
  constraint my_team_snapshots_payload_hash_format check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint my_team_snapshots_team_data_is_object check (jsonb_typeof(team_data) = 'object'),
  constraint my_team_snapshots_items_is_array check (coalesce(jsonb_typeof(team_data -> 'items'), '') = 'array'),
  constraint my_team_snapshots_item_count_matches check (item_count = jsonb_array_length(team_data -> 'items'))
);

create or replace function public.my_team_snapshots_guard()
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

drop trigger if exists my_team_snapshots_guard on public.my_team_snapshots;
create trigger my_team_snapshots_guard
  before insert or update on public.my_team_snapshots
  for each row
  execute function public.my_team_snapshots_guard();

alter table public.my_team_snapshots enable row level security;
alter table public.my_team_snapshots force row level security;

create policy my_team_snapshots_select_own
  on public.my_team_snapshots
  for select
  to authenticated
  using (user_id = auth.uid());

create policy my_team_snapshots_insert_own
  on public.my_team_snapshots
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy my_team_snapshots_update_own
  on public.my_team_snapshots
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy my_team_snapshots_delete_own
  on public.my_team_snapshots
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.my_team_snapshots from public;
revoke all on public.my_team_snapshots from anon;
grant select, insert, update, delete on public.my_team_snapshots to authenticated;
`;

describe("auditMyTeamCloudSql: 実際のマイグレーションファイル", () => {
  it("create-my-team-cloud-schema.sql は監査項目をすべて満たす(issues空)", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    const result = auditMyTeamCloudSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rollback-my-team-cloud-schema.sql は同じテーブル名・関数名を対象にしている", () => {
    const sql = readFileSync(ROLLBACK_SQL_PATH, "utf8");
    expect(sql).toContain("my_team_snapshots");
    expect(sql).toContain("my_team_snapshots_guard");
    expect(sql).not.toMatch(/alter\s+table\s+auth\.users/i);
    expect(sql).not.toMatch(/drop\s+schema/i);
    // ロールバックはrls_probe_recordsに触れない
    expect(sql).not.toMatch(/rls_probe_records/i);
  });

  it("マイグレーションファイルは実際の値(email/service_role/secret)を含まない", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/sb_secret_/);
  });

  it("create-my-team-cloud-schema.sql はrls_probe_recordsを変更しない", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    expect(sql).not.toMatch(/alter\s+table\s+(?:public\.)?rls_probe_records/i);
    expect(sql).not.toMatch(/drop\s+table\s+(?:public\.)?rls_probe_records/i);
  });
});

describe("auditMyTeamCloudSql: 監査ロジックそのものが違反を検出できること(合成SQL)", () => {
  it("正常な基準SQLはissuesが空になる(監査関数自体の健全性確認)", () => {
    expect(auditMyTeamCloudSql(VALID_BASELINE).issues).toEqual([]);
  });

  it("RLSが無効化されている場合を検出する", () => {
    const bad = VALID_BASELINE.replace(/alter table public\.my_team_snapshots enable row level security;/, "");
    expect(auditMyTeamCloudSql(bad).issues).toContain("RLSが有効化されていません(ENABLE ROW LEVEL SECURITY)");
  });

  it("FORCE ROW LEVEL SECURITYが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(/alter table public\.my_team_snapshots force row level security;/, "");
    expect(auditMyTeamCloudSql(bad).issues).toContain("FORCE ROW LEVEL SECURITYが設定されていません");
  });

  it("SELECTポリシーが欠落している場合を検出する", () => {
    const bad = VALID_BASELINE.replace(/create policy my_team_snapshots_select_own[\s\S]*?using \(user_id = auth\.uid\(\)\);/, "");
    expect(auditMyTeamCloudSql(bad).issues).toContain("SELECTポリシーが見つかりません");
  });

  it("USING (true)のような無条件許可を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for select\n  to authenticated\n  using (user_id = auth.uid());",
      "for select\n  to authenticated\n  using (true);",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("SELECTポリシーに無条件許可(USING/WITH CHECK (true))が含まれています");
  });

  it("ポリシーがanonへ許可されている場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for select\n  to authenticated\n  using (user_id = auth.uid());",
      "for select\n  to authenticated, anon\n  using (user_id = auth.uid());",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("SELECTポリシーがpublic/anonへ許可されています");
  });

  it("INSERTポリシーにWITH CHECKのauth.uid()条件が無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "for insert\n  to authenticated\n  with check (user_id = auth.uid());",
      "for insert\n  to authenticated\n  with check (item_count >= 0);",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("INSERTポリシーのWITH CHECK句にauth.uid()条件がありません");
  });

  it("UPDATEポリシーにWITH CHECKが無い場合を検出する(USINGだけでは不十分)", () => {
    const bad = VALID_BASELINE.replace(
      "for update\n  to authenticated\n  using (user_id = auth.uid())\n  with check (user_id = auth.uid());",
      "for update\n  to authenticated\n  using (user_id = auth.uid());",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("UPDATEポリシーのWITH CHECK句にauth.uid()条件がありません");
  });

  it("anon/publicへのGRANTを検出する", () => {
    const bad = VALID_BASELINE.replace(
      "grant select, insert, update, delete on public.my_team_snapshots to authenticated;",
      "grant select on public.my_team_snapshots to anon;",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("anon/publicへGRANTしています");
  });

  it("service_roleへの言及を検出する", () => {
    const bad = VALID_BASELINE + "\n-- uses service_role for admin bypass\n";
    expect(auditMyTeamCloudSql(bad).issues).toContain("service_roleへの言及があります");
  });

  it("emailカラムを検出する(所有者判定にemailを使うべきではない)", () => {
    const bad = VALID_BASELINE.replace("schema_version text not null,", "schema_version text not null,\n  email text,");
    expect(auditMyTeamCloudSql(bad).issues).toContain("テーブルにemailカラムが含まれています(所有者判定に使うべきではない)");
  });

  it("user_idにNOT NULLが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,",
      "user_id uuid default auth.uid() references auth.users (id) on delete cascade,",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("user_idにNOT NULL制約がありません");
  });

  it("user_idにunique制約が無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace("constraint my_team_snapshots_user_id_unique unique (user_id),\n  ", "");
    expect(auditMyTeamCloudSql(bad).issues).toContain("user_idにunique制約がありません(1ユーザー1行の前提が崩れます)");
  });

  it("item_countの上下限チェックが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "constraint my_team_snapshots_item_count_range check (item_count >= 0 and item_count <= 1000),\n  ",
      "",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("item_countの上下限チェック制約が見つかりません");
  });

  it("item_countとJSONB配列長の一致チェックが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      ",\n  constraint my_team_snapshots_item_count_matches check (item_count = jsonb_array_length(team_data -> 'items'))",
      "",
    );
    expect(auditMyTeamCloudSql(bad).issues).toContain("item_countとteam_data内配列長を一致させるチェック制約が見つかりません");
  });

  it("user_idの既定値がauth.uid()でない場合を検出する", () => {
    const bad = VALID_BASELINE.replace("default auth.uid() references auth.users", "references auth.users");
    expect(auditMyTeamCloudSql(bad).issues).toContain("user_idの既定値にauth.uid()が使われていません");
  });

  it("SECURITY DEFINER関数を検出する", () => {
    const bad = VALID_BASELINE.replace("security invoker", "security definer");
    expect(auditMyTeamCloudSql(bad).issues).toContain("SECURITY DEFINER関数が使われています(必要性の明示的な確認が必要)");
  });

  it("search_pathの固定が無い関数を検出する", () => {
    const bad = VALID_BASELINE.replace("set search_path = ''\n", "");
    expect(auditMyTeamCloudSql(bad).issues).toContain("関数にsearch_pathの固定設定がありません");
  });

  it("動的SQL(EXECUTE format(...))の使用を検出する", () => {
    const bad = VALID_BASELINE + "\ndo $$ begin execute format('select %I', 'x'); end; $$;\n";
    expect(auditMyTeamCloudSql(bad).issues).toContain("動的SQL(EXECUTE)の使用が疑われます");
  });

  it("auth.usersを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\nalter table auth.users add column extra text;\n";
    expect(auditMyTeamCloudSql(bad).issues).toContain("auth.usersを変更/削除/切り詰める文が含まれています");
  });

  it("Supabaseシステムスキーマを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\ndrop schema storage cascade;\n";
    expect(auditMyTeamCloudSql(bad).issues).toContain("Supabaseのシステムスキーマを変更/削除する文が含まれています");
  });

  it("Secret key風の文字列(sb_secret_)を検出する", () => {
    const bad = VALID_BASELINE + "\n-- sb_secret_abcdefg\n";
    expect(auditMyTeamCloudSql(bad).issues).toContain("Secret key/JWT形式に見える文字列が含まれています");
  });
});
