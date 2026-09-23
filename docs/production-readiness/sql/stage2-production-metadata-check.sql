-- ============================================================================
-- READ ONLY
-- METADATA ONLY
-- DOES NOT READ USER ROW DATA
-- DOES NOT READ REFERENCE DATA ROWS
-- NO SECRETS IN OUTPUT
-- ============================================================================
--
-- Stage 2(Production updater setup)の前後で、本人がSupabase SQL Editorで1回ずつ実行する確認SQL。
-- catalog/information_schemaだけを読み、結果は1行1列のJSON(metadata)になる。
-- 結果のJSONをそのままClaude Codeへ渡すと、
-- src/lib/reference-data/auto-update/production-metadata-contract.ts が契約と照合する。
-- 行データ・password・接続情報は含まれない。
-- ============================================================================

select json_build_object(
  'checkedAt', now(),
  'serverVersionNum', current_setting('server_version_num'),
  'tables', (
    select coalesce(json_agg(t order by t.name), '[]'::json) from (
      select c.relname as name,
             pg_catalog.pg_get_userbyid(c.relowner) as owner,
             c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced,
             (
               select json_agg(json_build_object('name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull) order by a.attnum)
               from pg_catalog.pg_attribute a
               where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
             ) as columns
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'reference_data'
        and c.relname in ('world_player_cards', 'managers', 'player_card_analysis', 'import_batches')
    ) t
  ),
  'roles', (
    select coalesce(json_agg(json_build_object(
      'name', r.rolname, 'canLogin', r.rolcanlogin, 'super', r.rolsuper, 'createDb', r.rolcreatedb, 'createRole', r.rolcreaterole,
      'replication', r.rolreplication, 'bypassRls', r.rolbypassrls, 'inherit', r.rolinherit, 'connLimit', r.rolconnlimit,
      'config', (select coalesce(json_agg(x order by x), '[]'::json) from unnest(s.setconfig) x)
    ) order by r.rolname), '[]'::json)
    from pg_catalog.pg_roles r
    left join pg_catalog.pg_db_role_setting s on s.setrole = r.oid and s.setdatabase = 0
    where r.rolname in ('reference_data_updater', 'reference_data_backup_reader')
  ),
  'policies', (
    select coalesce(json_agg(json_build_object('table', p.tablename, 'name', p.policyname, 'cmd', p.cmd, 'permissive', p.permissive, 'roles', p.roles) order by p.tablename, p.policyname), '[]'::json)
    from pg_catalog.pg_policies p
    where p.schemaname = 'reference_data'
  ),
  'updaterTableGrants', (
    select coalesce(json_agg(json_build_object('table', g.table_name, 'privilege', g.privilege_type) order by g.table_name, g.privilege_type), '[]'::json)
    from information_schema.role_table_grants g
    where g.grantee = 'reference_data_updater'
  ),
  'updaterColumnGrants', (
    select coalesce(json_agg(json_build_object('table', g.table_name, 'privilege', g.privilege_type, 'column', g.column_name) order by g.table_name, g.privilege_type, g.column_name), '[]'::json)
    from information_schema.column_privileges g
    where g.grantee = 'reference_data_updater' and g.privilege_type in ('INSERT', 'UPDATE')
  ),
  -- 利用者・認証データ等への実効権限(PUBLIC経由を含む)。roleが無い間は空配列。
  'updaterSensitiveAccess', case
    when not exists (select 1 from pg_catalog.pg_roles r where r.rolname = 'reference_data_updater') then '[]'::json
    else (
      select coalesce(json_agg(t.name order by t.name), '[]'::json)
      from (
        select x.name
        from unnest(array['auth.users', 'auth.identities', 'auth.sessions', 'public.my_team_snapshots', 'reference_data.player_card_analysis']) as x(name)
        where pg_catalog.to_regclass(x.name) is not null
          and pg_catalog.has_table_privilege('reference_data_updater', pg_catalog.to_regclass(x.name), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
      ) t
    )
  end
) as stage2_metadata;
