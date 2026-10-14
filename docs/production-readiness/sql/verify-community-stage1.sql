-- コミュニティ 第 1 段階の適用後の確認（読み取りだけ・何も変えない）。1 行の結果で、すべて true なら OK。
select
  -- 表があり、RLS が有効
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('public_profiles', 'public_id_history', 'user_blocks', 'user_mutes', 'friendships', 'community_reports', 'community_rate_events', 'comparison_summaries')
     having count(*) = 8) as tables_with_rls,
  -- 利用者は新しい表を直接は読めない（関数だけ）
  not has_table_privilege('authenticated', 'public.friendships', 'select')
    and not has_table_privilege('authenticated', 'public.user_blocks', 'select')
    and not has_table_privilege('authenticated', 'public.community_reports', 'select')
    and not has_table_privilege('authenticated', 'public.comparison_summaries', 'select')
    and not has_table_privilege('anon', 'public.public_profiles', 'select')
    and not has_table_privilege('authenticated', 'public.community_report_queue', 'select') as no_direct_table_access,
  -- 他人の user_id の列は読めない
  not has_column_privilege('authenticated', 'public.public_profiles', 'user_id', 'select')
    and not has_column_privilege('authenticated', 'public.public_profiles', 'restricted_at', 'update') as column_privileges_ok,
  -- 利用者の関数はログイン済みだけ・内部と運営者の関数は誰も呼べない
  has_function_privilege('authenticated', 'public.community_get_profile(text)', 'execute')
    and has_function_privilege('authenticated', 'public.community_report(text, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.community_save_my_profile(text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.community_get_profile(text)', 'execute')
    and not has_function_privilege('anon', 'public.community_search(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.community_uid_of(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.community_moderate_report(bigint, text, text, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.community_purge_old_reports()', 'execute') as function_privileges_ok,
  -- 公開範囲の 4 値
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'public_profiles_visibility') like '%friends%' as visibility_values_ok,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'community\_%') as community_function_count;
