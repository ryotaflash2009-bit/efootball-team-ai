-- コミュニティ 第 2 段階（ライバル）の適用後の確認（読み取りだけ）。すべて true なら OK。
select
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('rival_settings', 'rivals', 'comparison_history') having count(*) = 3) as tables_with_rls,
  not has_table_privilege('authenticated', 'public.rivals', 'select')
    and not has_table_privilege('authenticated', 'public.rival_settings', 'select')
    and not has_table_privilege('authenticated', 'public.comparison_history', 'select') as no_direct_table_access,
  has_function_privilege('authenticated', 'public.community_list_rivals()', 'execute')
    and has_function_privilege('authenticated', 'public.community_add_rival(text)', 'execute')
    and has_function_privilege('authenticated', 'public.community_set_comparison(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.community_list_rivals()', 'execute')
    and not has_function_privilege('authenticated', 'public.community_growth(uuid, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.community_rival_opted_in(uuid)', 'execute') as function_privileges_ok,
  exists (select 1 from pg_trigger where tgname = 'community_friendship_removed') as friendship_trigger_ok,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'community\_%') as community_function_count;
