-- ============================================================================
-- ⚠️ DO NOT RUN ⚠️  DESIGN ONLY  ⚠️  REQUIRES SEPARATE APPROVAL  ⚠️
-- PRODUCTION NOT APPLIED — このSQLは実Supabaseへ一度も実行されていない。
-- ============================================================================
--
-- reference_data_ops: 参照データ自動更新 Phase 2(承認付き適用)専用の
-- 管理スキーマ(staging・job・approval・監査)。
--
-- 目的:
--   Phase 2(ローカルSQLite・GitHub Actions PostgreSQL service containerで実証済み)の
--   job/approval/staging/audit/rollbackモデルを、Production(Supabase)へ適用する場合の
--   スキーマ設計案。このファイル自体を実行することは、別途独立した承認事項である。
--
-- 分離方針(既存 create-reference-data-schema.sql の設計を踏襲):
--   - public スキーマ(my_team_snapshots・rls_probe_records等の利用者データ)とは
--     完全に別スキーマ。
--   - auth スキーマには一切触れない。
--   - reference_data スキーマ(読み取り専用の確定済み参照データ)ともあえて分離する
--     (stagingは「まだ承認・適用されていない候補データ」であり、確定データと
--     混在させない)。
--   - anon・authenticated ロールへは USAGE すら付与しない(既存の reference_data とは
--     異なり、reference_data_ops は一般利用者・Vercelアプリ実行時からは完全に不可視で
--     あるべき管理専用スキーマ)。Data API(PostgREST)の Exposed schemas にも
--     追加しない。
--   - 実行主体(サーバー側の限定ロール)は未確定(9章の比較を参照)。そのため、
--     このファイルには特定ロールへのGRANT文を一切含めない
--     (「実行主体が未確定ならGRANTを含めない」というタスクの明示的要求どおり)。
--
-- 冪等性: IF NOT EXISTS / OR REPLACE を使用、複数回実行しても安全な設計(ただし
--   今回は実行しない)。
--
-- 含まれないもの: DROP CASCADE・TRUNCATE・利用者データへのDML・public/authスキーマの
--   変更・拡張機能の追加・ロール変更・GRANT・RLSの無効化・SECURITY DEFINER関数・
--   Event Trigger・Cron。
--
-- ロールバック: rollback-reference-data-ops-schema.sql を参照。
-- ============================================================================

create schema if not exists reference_data_ops;

comment on schema reference_data_ops is
  '参照データ自動更新Phase 2の管理専用スキーマ(job/approval/staging/audit/rollback)。一般利用者・Vercelアプリからは不可視。DO NOT RUN(設計のみ、未適用)。';

-- ----------------------------------------------------------------------------
-- 1. update_jobs
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.update_jobs (
  job_id uuid primary key default gen_random_uuid(),
  table_name text not null,
  source text not null,
  schema_version text not null,
  dataset_checksum text not null check (dataset_checksum ~ '^[0-9a-f]{64}$'),
  previous_checksum text check (previous_checksum is null or previous_checksum ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'rolled_back')),
  started_at timestamptz,
  completed_at timestamptz,
  expected_tables jsonb not null,
  fetched_tables jsonb not null,
  added_count integer check (added_count is null or added_count >= 0),
  updated_count integer check (updated_count is null or updated_count >= 0),
  removed_candidate_count integer check (removed_candidate_count is null or removed_candidate_count >= 0),
  unchanged_count integer check (unchanged_count is null or unchanged_count >= 0),
  created_at timestamptz not null default now(),
  constraint update_jobs_table_name_not_blank check (char_length(btrim(table_name)) > 0),
  constraint update_jobs_source_not_blank check (char_length(btrim(source)) > 0)
);
comment on table reference_data_ops.update_jobs is
  '参照データ更新ジョブの状態管理。job.ts の状態機械(pending→running→completed/failed→rolled_back)と一致させる。';
create index if not exists update_jobs_table_status_idx
  on reference_data_ops.update_jobs (table_name, status);

-- ----------------------------------------------------------------------------
-- 2. approvals(人間の明示承認artifact)
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.approvals (
  approval_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  dataset_checksum text not null check (dataset_checksum ~ '^[0-9a-f]{64}$'),
  diff_checksum text not null check (diff_checksum ~ '^[0-9a-f]{64}$'),
  schema_version text not null,
  expected_added_count integer not null check (expected_added_count >= 0),
  expected_updated_count integer not null check (expected_updated_count >= 0),
  expected_removed_candidate_count integer not null check (expected_removed_candidate_count >= 0),
  approved_by text not null check (char_length(btrim(approved_by)) > 0),
  nonce text not null check (char_length(btrim(nonce)) > 0),
  approved_at timestamptz not null,
  expires_at timestamptz not null,
  constraint approvals_expires_after_approved check (expires_at > approved_at)
);
comment on table reference_data_ops.approvals is
  '承認artifact。単純なフラグでの承認は許可しない(approved_by・nonce・checksum一致・有効期限をすべて必須とする)。';
create unique index if not exists approvals_job_id_key on reference_data_ops.approvals (job_id);

-- ----------------------------------------------------------------------------
-- 3. applied_checksums(冪等性)
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.applied_checksums (
  dataset_checksum text primary key check (dataset_checksum ~ '^[0-9a-f]{64}$'),
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  applied_at timestamptz not null
);
comment on table reference_data_ops.applied_checksums is
  '適用済みdataset_checksumの履歴。同一内容の重複適用を拒否するための冪等性テーブル。';

-- ----------------------------------------------------------------------------
-- 4. audit_events(監査ログ、秘密情報を含まない)
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.audit_events (
  id bigserial primary key,
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  phase text not null check (phase in ('preflight', 'lock', 'validate', 'approve', 'apply', 'shadow_compare', 'commit', 'rollback', 'error')),
  logged_at timestamptz not null default now(),
  detail_json jsonb not null default '{}'::jsonb,
  constraint audit_events_detail_is_object check (jsonb_typeof(detail_json) = 'object')
);
comment on table reference_data_ops.audit_events is
  '監査ログ。接続文字列・APIキー・トークン・Cookie・パスワード・実ユーザーデータを含めないこと(アプリ側でsanitize済みの内容だけを書き込む前提)。';
create index if not exists audit_events_job_id_idx on reference_data_ops.audit_events (job_id, logged_at);

-- ----------------------------------------------------------------------------
-- 5. staging_* (取得結果の一時保管、テーブルごと)
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.staging_world_player_cards (
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  world_card_id text not null,
  fields_json jsonb not null,
  primary key (job_id, world_card_id)
);
create table if not exists reference_data_ops.staging_managers (
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  internal_manager_id text not null,
  fields_json jsonb not null,
  primary key (job_id, internal_manager_id)
);
create table if not exists reference_data_ops.staging_player_card_analysis (
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  world_card_id text not null,
  fields_json jsonb not null,
  primary key (job_id, world_card_id)
);
comment on table reference_data_ops.staging_world_player_cards is
  '取得結果の一時保管(未承認・未適用)。reference_data.world_player_cardsとは別物。';
comment on table reference_data_ops.staging_managers is
  '取得結果の一時保管(未承認・未適用)。reference_data.managersとは別物。';
comment on table reference_data_ops.staging_player_card_analysis is
  '取得結果の一時保管(未承認・未適用)。reference_data.player_card_analysisとは別物。';

-- ----------------------------------------------------------------------------
-- 6. before_snapshots(rollback用の適用前スナップショット)
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.before_snapshots (
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  table_name text not null,
  record_id text not null,
  fields_json jsonb not null,
  primary key (job_id, table_name, record_id)
);
comment on table reference_data_ops.before_snapshots is
  '適用前の対象行スナップショット。明示rollbackで元の値へ正確に復元するために使う(推測で復元しない)。';

-- ----------------------------------------------------------------------------
-- 7. rollback_jobs
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.rollback_jobs (
  rollback_job_id uuid primary key default gen_random_uuid(),
  target_job_id uuid not null references reference_data_ops.update_jobs (job_id),
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  restored_count integer check (restored_count is null or restored_count >= 0),
  removed_count integer check (removed_count is null or removed_count >= 0)
);
comment on table reference_data_ops.rollback_jobs is
  '明示rollbackの実行記録(二重rollback防止のため、target_job_idごとに1件までを想定)。';
create unique index if not exists rollback_jobs_target_job_id_key
  on reference_data_ops.rollback_jobs (target_job_id)
  where status <> 'failed';

-- ----------------------------------------------------------------------------
-- 8. source_metadata_snapshots
-- ----------------------------------------------------------------------------
create table if not exists reference_data_ops.source_metadata_snapshots (
  table_name text not null,
  job_id uuid not null references reference_data_ops.update_jobs (job_id),
  source text not null,
  schema_version text not null,
  recorded_at timestamptz not null default now(),
  primary key (table_name, job_id)
);
comment on table reference_data_ops.source_metadata_snapshots is
  'テーブルごとの最終適用元メタ情報の履歴。';

-- ----------------------------------------------------------------------------
-- 9. Row Level Security — 全テーブルRLS有効化、ポリシーは一切作らない
-- ----------------------------------------------------------------------------
-- ポリシーが存在しない場合、RLS有効テーブルは既定ですべての操作を拒否する
-- (anon・authenticatedへは9章のとおりUSAGEすら付与しないため、二重の拒否になる)。
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'update_jobs', 'approvals', 'applied_checksums', 'audit_events',
      'staging_world_player_cards', 'staging_managers', 'staging_player_card_analysis',
      'before_snapshots', 'rollback_jobs', 'source_metadata_snapshots'
    ])
  loop
    execute format('alter table reference_data_ops.%I enable row level security', t);
    execute format('alter table reference_data_ops.%I force row level security', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 10. 権限 — 明示的に何も付与しない
-- ----------------------------------------------------------------------------
-- 実行主体(9章「最小権限設計」比較の結論)が確定するまで、GRANT文はこのファイルに
-- 含めない。少なくとも次は確実に行う: anon/authenticatedへはUSAGE ON SCHEMAすら
-- 付与しない。Data APIのExposed schemasへも追加しない(=PostgRESTからは
-- そもそも到達不能)。
revoke all on schema reference_data_ops from public;
revoke all on all tables in schema reference_data_ops from public;
alter default privileges in schema reference_data_ops
  revoke all on tables from public;

-- ============================================================================
-- 保持・削除方針(運用ルール、この DDL 自体は自動削除処理を含まない):
--   - audit_events: 監査要件が確定するまで無期限保持を既定とする(自動削除しない)。
--   - staging_*: 対応するjobがcompleted/rolled_backになった後、一定期間
--     (例: 30日、運用開始後に確定)経過したものを人間の判断で削除する運用を想定。
--     自動削除ジョブはこのDDLにもコードにも含まれていない。
--   - before_snapshots: rollback可能性を維持するため、staging_*より長く保持する
--     運用を推奨(具体的な保持期間は未確定)。
--   - 物理削除の自動化はしない(タスクの明示的要求どおり)。
-- ============================================================================
