-- verify: 利用者自身によるアカウントの削除（2026-10-11）— 読み取りだけ。適用の前後に実行する（apply package §4・§5）。
-- 1. 関数: SECURITY DEFINER・search_path 固定・所有者
select p.proname, p.prosecdef as security_definer, p.proconfig as config, pg_get_userbyid(p.proowner) as owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'delete_my_account';
-- 2. 実行の権限: authenticated だけ true・anon と public は false
select r.rolname, has_function_privilege(r.rolname, 'public.delete_my_account(text)', 'execute') as can_execute
  from pg_roles r where r.rolname in ('anon', 'authenticated');
-- 3. 監査の表: RLS が有効・ポリシー 0・anon / authenticated に権限なし
select c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'account_deletion_audit') as policy_count,
       has_table_privilege('anon', 'public.account_deletion_audit', 'select') as anon_select,
       has_table_privilege('authenticated', 'public.account_deletion_audit', 'select') as authenticated_select
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'account_deletion_audit';
-- 4. 本人の行を持つ表が auth.users を cascade で参照している（関数で消し漏れても auth.users の削除で消える）
select tc.table_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.constraint_schema
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name and ccu.constraint_schema = rc.unique_constraint_schema
  where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY' and ccu.table_schema = 'auth' and ccu.table_name = 'users';
-- 5. 件数だけ（個人情報なし）
select count(*) as audit_rows from public.account_deletion_audit;
