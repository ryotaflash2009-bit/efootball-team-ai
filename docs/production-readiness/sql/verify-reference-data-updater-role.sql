-- ============================================================================
-- READ ONLY
-- METADATA ONLY
-- DOES NOT READ USER ROW DATA
-- DOES NOT READ REFERENCE DATA ROWS
-- ============================================================================
--
-- reference_data_updaterの設定確認SQL案(Phase G準備)。catalog/information_schemaだけを読む。
-- 期待値は src/lib/reference-data/auto-update/updater-role.ts を参照。
-- ============================================================================

-- 1. role属性(期待: login=true, super/createdb/createrole/replication/bypassrls/inherit=false, connlimit=1)。
select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit, rolconnlimit
from pg_catalog.pg_roles
where rolname = 'reference_data_updater';

-- 2. table単位の権限(期待: 3 tableのSELECTだけ。DELETE/TRUNCATE/REFERENCES/TRIGGERは0件)。
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'reference_data_updater'
order by table_schema, table_name, privilege_type;

-- 3. 列単位のINSERT/UPDATE権限(期待: UPDATER_COLUMN_GRANTSと完全一致)。
select table_name, privilege_type, column_name
from information_schema.column_privileges
where grantee = 'reference_data_updater' and privilege_type in ('INSERT', 'UPDATE')
order by table_name, privilege_type, column_name;

-- 4. updater用policy(期待: 9件、DELETEなし、対象roleはreference_data_updaterだけ)。
select tablename, policyname, cmd, permissive, roles
from pg_catalog.pg_policies
where schemaname = 'reference_data' and policyname like '%\_updater\_%' escape '\'
order by tablename, policyname;

-- 5. RLSがFORCEのままであること。
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'reference_data' and c.relname in ('world_player_cards', 'managers', 'import_batches')
order by c.relname;

-- 6. session既定値。
select unnest(setconfig) as setting
from pg_catalog.pg_db_role_setting s join pg_catalog.pg_roles r on r.oid = s.setrole
where r.rolname = 'reference_data_updater';
