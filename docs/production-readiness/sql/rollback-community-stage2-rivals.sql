-- コミュニティ 第 2 段階の戻し（create-community-stage2-rivals.sql の逆）。ライバル・設定・総合点の履歴は消える。
-- community_set_comparison は第 1 段階の形（履歴を残さない）に戻す。

begin;

drop function if exists public.community_list_rivals();
drop function if exists public.community_remove_rival(text);
drop function if exists public.community_add_rival(text);
drop function if exists public.community_rival_opted_in(uuid);
drop function if exists public.community_set_rival_opt_in(boolean);
drop function if exists public.community_growth(uuid, integer);
drop trigger if exists community_friendship_removed on public.friendships;
drop function if exists public.community_friendship_removed();

drop table if exists public.comparison_history;
drop table if exists public.rivals;
drop table if exists public.rival_settings;

create or replace function public.community_set_comparison(p_summary jsonb) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' or octet_length(p_summary::text) > 2048
     or p_summary ->> 'k' is distinct from 'sd' or p_summary ->> 'v' is distinct from '1'
     or coalesce(p_summary ->> 'r', '') !~ '^squad-diagnosis/[0-9]{4}-[0-9]{2}-[0-9]{2}\.v[0-9]{1,3}$' then
    raise exception 'invalid_summary' using errcode = '22023';
  end if;
  insert into public.comparison_summaries (user_id, summary) values (me, p_summary)
    on conflict (user_id) do update set summary = excluded.summary, updated_at = now();
  return 'saved';
end
$$;
revoke all on function public.community_set_comparison(jsonb) from public, anon;
grant execute on function public.community_set_comparison(jsonb) to authenticated;

commit;
