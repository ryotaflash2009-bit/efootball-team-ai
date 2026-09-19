-- ============================================================================
-- ⚠️ DO NOT RUN (このセッションでは実行していない) ⚠️  DESIGN ONLY  ⚠️
-- PRODUCTION NOT APPLIED — 将来、本人が接続後に読み取り専用で確認するためのクエリ案。
-- ============================================================================
--
-- このファイルは、将来Production Supabaseへ接続できる状態になった際に、
-- reference-data-production-preflight.md の「接続後read-only preflight」で
-- 本人が実行することを想定した、SELECT専用のクエリ集である。
--
-- すべてSELECT/SHOW相当であり、DDL・DML・GRANT・REVOKEは一切含まない。
-- 今回のセッションでは実行していない(実Supabaseへ一切接続していない)。
-- ============================================================================

-- 1. 接続先の基本情報(ホスト名そのものは表示しない設計を推奨。current_databaseは
--    Supabase Dashboard上で目視確認する分には安全だが、ログへの出力時は
--    fingerprint化すること)
select current_database(), current_user, version(), inet_server_addr() is not null as has_server_addr;

-- 2. SSL接続であることの確認
select ssl, cipher from pg_stat_ssl where pid = pg_backend_pid();

-- 3. reference_data_ops スキーマの存在確認
select schema_name from information_schema.schemata where schema_name = 'reference_data_ops';

-- 4. reference_data_ops 配下のテーブル一覧(想定10テーブルと突き合わせる)
select table_name from information_schema.tables where table_schema = 'reference_data_ops' order by table_name;

-- 5. anon/authenticatedがreference_data_opsスキーマへ権限を持たないことの確認
--    (0行が期待値。1行でもあれば「forbidden privileges検出」としてblocked扱いにする)
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'reference_data_ops' and grantee in ('anon', 'authenticated');

select grantee, privilege_type
from information_schema.usage_privileges
where object_schema = 'reference_data_ops' and grantee in ('anon', 'authenticated');

-- 6. RLSが全対象テーブルで有効かつFORCEされていることの確認
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'reference_data_ops' and c.relkind = 'r';

-- 7. reference_data(確定済み参照データ)側の現在の行数(参考値。書込みはしない)
select 'world_player_cards' as table_name, count(*) from reference_data.world_player_cards
union all
select 'managers', count(*) from reference_data.managers
union all
select 'player_card_analysis', count(*) from reference_data.player_card_analysis;

-- 8. 現在実行中のjobが無いことの確認(advisory lock取得前のpreflight)
select job_id, table_name, status, started_at
from reference_data_ops.update_jobs
where status = 'running';

-- 9. 直近の適用済みjobとchecksum履歴
select job_id, table_name, dataset_checksum, status, completed_at
from reference_data_ops.update_jobs
order by created_at desc
limit 20;

-- 10. statement_timeout / lock_timeoutの現在値(長時間ロックを防ぐための確認)
show statement_timeout;
show lock_timeout;

-- 11. auth/publicスキーマへ本preflightが一切触れていないことの確認(このファイル自体に
--     auth.*・public.*への参照が無いことをレビューで確認すること。SQL自体は
--     reference_data/reference_data_opsスキーマのみを対象にしている)。
