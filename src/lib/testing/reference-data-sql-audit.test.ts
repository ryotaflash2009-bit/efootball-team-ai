import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditReferenceDataSql } from "./reference-data-sql-audit";

const REPO_ROOT = resolve(__dirname, "../../..");
const CREATE_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/create-reference-data-schema.sql");
const ROLLBACK_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-reference-data-schema.sql");

const VALID_BASELINE = `
create schema if not exists reference_data;

create table if not exists reference_data.import_batches (
  batch_id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  payload_hash text not null
);

create table if not exists reference_data.world_player_cards (
  world_card_id text primary key,
  name_en text not null,
  stats jsonb not null default '{}'::jsonb,
  dataset_version text not null,
  import_batch_id uuid references reference_data.import_batches (batch_id)
);

create table if not exists reference_data.managers (
  internal_manager_id integer primary key,
  name_en text not null,
  dataset_version text not null
);

create table if not exists reference_data.player_card_analysis (
  world_card_id text primary key references reference_data.world_player_cards (world_card_id) on delete cascade,
  dataset_version text not null
);

create or replace function reference_data.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table reference_data.world_player_cards enable row level security;
alter table reference_data.world_player_cards force row level security;
alter table reference_data.managers enable row level security;
alter table reference_data.managers force row level security;
alter table reference_data.player_card_analysis enable row level security;
alter table reference_data.player_card_analysis force row level security;
alter table reference_data.import_batches enable row level security;
alter table reference_data.import_batches force row level security;

create policy world_player_cards_select_all
  on reference_data.world_player_cards
  for select
  to anon, authenticated
  using (true);

create policy managers_select_all
  on reference_data.managers
  for select
  to anon, authenticated
  using (true);

create policy player_card_analysis_select_all
  on reference_data.player_card_analysis
  for select
  to anon, authenticated
  using (true);

revoke all on schema reference_data from public;
grant usage on schema reference_data to anon, authenticated;
grant select on reference_data.world_player_cards to anon, authenticated;
grant select on reference_data.managers to anon, authenticated;
grant select on reference_data.player_card_analysis to anon, authenticated;
`;

describe("auditReferenceDataSql: 実際のマイグレーションファイル", () => {
  it("create-reference-data-schema.sql は監査項目をすべて満たす(issues空)", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    const result = auditReferenceDataSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rollback-reference-data-schema.sql は reference_data スキーマだけを対象にしている(他テーブルへのALTER/DROP文が無い)", () => {
    const sql = readFileSync(ROLLBACK_SQL_PATH, "utf8");
    expect(sql).toContain("reference_data");
    expect(sql).not.toMatch(/alter\s+table\s+auth\.users/i);
    // 「my_team_snapshots等には影響しない」という説明コメントでの言及自体は許容する
    // (create-my-team-cloud-schema.shがrls_probe_recordsへの非影響を明記するのと同じ方針)。
    // 実際にALTER/DROPしていないことだけを確認する。
    expect(sql).not.toMatch(/(alter|drop)\s+table\s+(?:public\.)?my_team_snapshots\b/i);
    expect(sql).not.toMatch(/(alter|drop)\s+table\s+(?:public\.)?rls_probe_records\b/i);
  });

  it("マイグレーションファイルは実際の値(sb_secret_等)を含まない", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    expect(sql).not.toMatch(/sb_secret_/);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]/);
  });

  it("create-reference-data-schema.sql は既存のmy_team_snapshots/rls_probe_recordsを変更しない", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    expect(sql).not.toMatch(/alter\s+table\s+(?:public\.)?my_team_snapshots\b/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:public\.)?rls_probe_records\b/i);
    expect(sql).not.toMatch(/drop\s+table\s+(?:public\.)?my_team_snapshots\b/i);
    expect(sql).not.toMatch(/drop\s+table\s+(?:public\.)?rls_probe_records\b/i);
  });

  it("create-reference-data-schema.sqlは実際のGRANT ALL文を含まない(監査関数の判定を利用)", () => {
    const sql = readFileSync(CREATE_SQL_PATH, "utf8");
    expect(auditReferenceDataSql(sql).issues).not.toContain("GRANT ALLが使用されています(必要最小限のGRANTだけを使ってください)");
  });
});

describe("auditReferenceDataSql: 監査ロジックそのものが違反を検出できること(合成SQL)", () => {
  it("正常な基準SQLはissuesが空になる(監査関数自体の健全性確認)", () => {
    expect(auditReferenceDataSql(VALID_BASELINE).issues).toEqual([]);
  });

  it("RLSが無効化されている場合を検出する", () => {
    const bad = VALID_BASELINE.replace("alter table reference_data.world_player_cards enable row level security;\n", "");
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: RLSが有効化されていません(ENABLE ROW LEVEL SECURITY)");
  });

  it("FORCE ROW LEVEL SECURITYが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace("alter table reference_data.world_player_cards force row level security;\n", "");
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: FORCE ROW LEVEL SECURITYが設定されていません");
  });

  it("SELECTポリシーがanonへ許可されていない場合を検出する(参照データはanonも読めるべき)", () => {
    const bad = VALID_BASELINE.replace(
      "create policy world_player_cards_select_all\n  on reference_data.world_player_cards\n  for select\n  to anon, authenticated\n  using (true);",
      "create policy world_player_cards_select_all\n  on reference_data.world_player_cards\n  for select\n  to authenticated\n  using (true);",
    );
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: SELECTポリシーがanonへ許可されていません(公開参照データはanonも読めるべきです)");
  });

  it("INSERTポリシーが存在する場合を検出する(公開参照テーブルへの書込みポリシーは禁止)", () => {
    const bad =
      VALID_BASELINE +
      "\ncreate policy world_player_cards_insert_bad\n  on reference_data.world_player_cards\n  for insert\n  to authenticated\n  with check (true);\n";
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: INSERTポリシーが存在します(公開参照テーブルへの書込みポリシーは一切作らないでください)");
  });

  it("import_batches(管理専用)にSELECTポリシーがある場合を検出する", () => {
    const bad =
      VALID_BASELINE +
      "\ncreate policy import_batches_select_bad\n  on reference_data.import_batches\n  for select\n  to authenticated\n  using (true);\n";
    expect(auditReferenceDataSql(bad).issues).toContain("import_batches: SELECTポリシーが存在します(管理専用テーブルにはポリシーを作らないでください)");
  });

  it("anonへINSERT権限がGRANTされている場合を検出する", () => {
    const bad = VALID_BASELINE + "\ngrant insert on reference_data.world_player_cards to anon;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("anon/authenticatedへINSERT権限がGRANTされています");
  });

  it("GRANT ALLの使用を検出する", () => {
    const bad = VALID_BASELINE + "\ngrant all on reference_data.world_player_cards to authenticated;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("GRANT ALLが使用されています(必要最小限のGRANTだけを使ってください)");
  });

  it("import_batchesがanonへGRANTされている場合を検出する", () => {
    const bad = VALID_BASELINE + "\ngrant select on reference_data.import_batches to anon;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("import_batches(管理専用)がanon/authenticatedへGRANTされています");
  });

  it("world_player_cardsのGRANT SELECTがanon/authenticated双方に無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "grant select on reference_data.world_player_cards to anon, authenticated;",
      "grant select on reference_data.world_player_cards to authenticated;",
    );
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: anon/authenticated双方へのGRANT SELECTが見つかりません");
  });

  it("emailカラムを検出する(参照データに個人情報は不要)", () => {
    const bad = VALID_BASELINE.replace("name_en text not null,\n  stats jsonb", "name_en text not null,\n  email text,\n  stats jsonb");
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: emailカラムが含まれています(参照データに個人情報は不要です)");
  });

  it("user_id = auth.uid()相当の個人データ用条件が参照テーブルにある場合を検出する(混同の疑い)", () => {
    const bad = VALID_BASELINE.replace(
      "world_card_id text primary key,\n  name_en text not null,",
      "world_card_id text primary key,\n  name_en text not null,\n  user_id uuid default auth.uid(),",
    );
    expect(auditReferenceDataSql(bad).issues).toContain("world_player_cards: user_id = auth.uid() 相当の個人データ用条件が参照テーブルに含まれています(混同の疑い)");
  });

  it("service_roleへの言及を検出する", () => {
    const bad = VALID_BASELINE + "\n-- uses service_role for admin bypass\n";
    expect(auditReferenceDataSql(bad).issues).toContain("service_roleへの言及があります");
  });

  it("Secret key風の文字列(sb_secret_)を検出する", () => {
    const bad = VALID_BASELINE + "\n-- sb_secret_abcdefg\n";
    expect(auditReferenceDataSql(bad).issues).toContain("Secret key/JWT形式に見える文字列が含まれています");
  });

  it("SECURITY DEFINER関数を検出する", () => {
    const bad = VALID_BASELINE.replace("security invoker", "security definer");
    expect(auditReferenceDataSql(bad).issues).toContain("SECURITY DEFINER関数が使われています(必要性の明示的な確認が必要)");
  });

  it("search_pathの固定が無い関数を検出する", () => {
    const bad = VALID_BASELINE.replace("set search_path = ''\n", "");
    expect(auditReferenceDataSql(bad).issues).toContain("関数にsearch_pathの固定設定がありません");
  });

  it("動的SQL(EXECUTE format(...))の使用を検出する", () => {
    const bad = VALID_BASELINE + "\ndo $$ begin execute format('select %I', 'x'); end; $$;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("動的SQL(EXECUTE)の使用が疑われます");
  });

  it("auth.usersを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\nalter table auth.users add column extra text;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("auth.usersを変更/削除/切り詰める文が含まれています");
  });

  it("Supabaseシステムスキーマを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\ndrop schema storage cascade;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("Supabaseのシステムスキーマを変更/削除する文が含まれています");
  });

  it("既存のmy_team_snapshotsを変更する文を検出する", () => {
    const bad = VALID_BASELINE + "\nalter table public.my_team_snapshots add column extra text;\n";
    expect(auditReferenceDataSql(bad).issues).toContain("既存の公開スキーマテーブル(my_team_snapshots/rls_probe_records)を変更する文が含まれています");
  });

  it("player_card_analysisにworld_player_cardsへの外部キーが無い場合を検出する", () => {
    const bad = VALID_BASELINE.replace(
      "world_card_id text primary key references reference_data.world_player_cards (world_card_id) on delete cascade,",
      "world_card_id text primary key,",
    );
    expect(auditReferenceDataSql(bad).issues).toContain("player_card_analysis: world_player_cardsへの外部キー参照が見つかりません");
  });
});
