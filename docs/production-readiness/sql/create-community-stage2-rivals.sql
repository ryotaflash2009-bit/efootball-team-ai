-- コミュニティ 第 2 段階（2026-10-14）: F-062 ライバル（オプトイン）と、比較に使う診断の総合点の履歴（成長）
-- 前提: create-community-stage1-schema.sql。戻しは rollback-community-stage2-rivals.sql。
-- 検証: src/lib/community/community-stage2.postgres.test.ts（使い捨ての PostgreSQL）。
--
-- 規則（src/lib/social/friends.ts の契約と同じ）:
--   - ライバルの機能は本人が使うと決めたときだけ（既定は使わない）。相手も使っている友達だけを、5 人まで選べる。
--   - 使うのをやめると、自分のライバルの一覧は空になり、相手の一覧からも外れる。友達でなくなる・ブロックでも外れる。
--   - 成長（週・月）は、比較に使う診断を保存した時点の総合点の履歴から、同じ規則の版の点だけで計算する。
--   - 表は RLS を有効にし、利用者へ直接の権限を与えない（関数だけ）。履歴は 1 人 100 件まで。

begin;

create table if not exists public.rival_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.rivals (
  user_id uuid not null references auth.users (id) on delete cascade,
  rival_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, rival_id),
  constraint rivals_not_self check (user_id <> rival_id)
);
create index if not exists rivals_rival on public.rivals (rival_id);

create table if not exists public.comparison_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  overall integer,
  rules_version text not null,
  recorded_at timestamptz not null default now(),
  constraint comparison_history_overall check (overall is null or overall between 0 and 100)
);
create index if not exists comparison_history_user on public.comparison_history (user_id, recorded_at);

alter table public.rival_settings enable row level security;
alter table public.rivals enable row level security;
alter table public.comparison_history enable row level security;
revoke all on public.rival_settings, public.rivals, public.comparison_history from anon, authenticated;

-- 友達の関係が消えたら（解除・ブロック・退会）、2 人の間のライバルも消す
create or replace function public.community_friendship_removed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.rivals r
    where (r.user_id = old.requester_id and r.rival_id = old.addressee_id) or (r.user_id = old.addressee_id and r.rival_id = old.requester_id);
  return old;
end
$$;
drop trigger if exists community_friendship_removed on public.friendships;
create trigger community_friendship_removed after delete on public.friendships for each row execute function public.community_friendship_removed();

-- 比較に使う診断を保存したら、総合点を履歴に残す（同じ関数を置き換える・第 1 段階の検証はそのまま）
create or replace function public.community_set_comparison(p_summary jsonb) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  v_overall integer;
begin
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' or octet_length(p_summary::text) > 2048
     or p_summary ->> 'k' is distinct from 'sd' or p_summary ->> 'v' is distinct from '1'
     or coalesce(p_summary ->> 'r', '') !~ '^squad-diagnosis/[0-9]{4}-[0-9]{2}-[0-9]{2}\.v[0-9]{1,3}$' then
    raise exception 'invalid_summary' using errcode = '22023';
  end if;
  insert into public.comparison_summaries (user_id, summary) values (me, p_summary)
    on conflict (user_id) do update set summary = excluded.summary, updated_at = now();
  v_overall := case when jsonb_typeof(p_summary -> 'o' -> 0) = 'number' then (p_summary -> 'o' ->> 0)::numeric::integer else null end;
  if v_overall is not null and (v_overall < 0 or v_overall > 100) then v_overall := null; end if;
  insert into public.comparison_history (user_id, overall, rules_version) values (me, v_overall, p_summary ->> 'r');
  delete from public.comparison_history h where h.user_id = me and h.id not in (
    select x.id from public.comparison_history x where x.user_id = me order by x.recorded_at desc, x.id desc limit 100
  );
  return 'saved';
end
$$;

-- 期間（日数）の成長: 最新の点と、期間の中の同じ規則の版の最も古い点との差（2 点が無ければ null）
create or replace function public.community_growth(p_user uuid, p_days integer) returns integer language sql stable security definer set search_path = public as $$
  with latest as (
    select h.overall, h.rules_version, h.id from public.comparison_history h
    where h.user_id = p_user and h.recorded_at >= now() - make_interval(days => p_days)
    order by h.recorded_at desc, h.id desc limit 1
  ), first_point as (
    select h.overall, h.id from public.comparison_history h, latest l
    where h.user_id = p_user and h.rules_version = l.rules_version and h.recorded_at >= now() - make_interval(days => p_days)
    order by h.recorded_at asc, h.id asc limit 1
  )
  select case when f.id = l.id or f.overall is null or l.overall is null then null else l.overall - f.overall end
  from latest l, first_point f
$$;

create or replace function public.community_set_rival_opt_in(p_opted_in boolean) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  insert into public.rival_settings (user_id, opted_in) values (me, coalesce(p_opted_in, false))
    on conflict (user_id) do update set opted_in = excluded.opted_in, updated_at = now();
  if not coalesce(p_opted_in, false) then
    delete from public.rivals where user_id = me or rival_id = me;
    return 'opted_out';
  end if;
  return 'opted_in';
end
$$;

create or replace function public.community_rival_opted_in(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.opted_in from public.rival_settings s where s.user_id = p_user), false)
$$;

create or replace function public.community_add_rival(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
begin
  if not public.community_rival_opted_in(me) then raise exception 'not_opted_in' using errcode = 'P0020'; end if;
  if other is null or other = me or public.community_relation(me, other) <> 'friends' or not public.community_can_view(me, other) then
    raise exception 'not_found' using errcode = 'P0010';
  end if;
  if not public.community_rival_opted_in(other) then raise exception 'other_not_opted_in' using errcode = 'P0021'; end if;
  if exists (select 1 from public.rivals where user_id = me and rival_id = other) then return 'already'; end if;
  if (select count(*) from public.rivals where user_id = me) >= 5 then raise exception 'rival_limit' using errcode = 'P0022'; end if;
  insert into public.rivals (user_id, rival_id) values (me, other);
  return 'added';
end
$$;

create or replace function public.community_remove_rival(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
  n int;
begin
  if other is null then return 'none'; end if;
  delete from public.rivals where user_id = me and rival_id = other;
  get diagnostics n = row_count;
  return case when n > 0 then 'removed' else 'none' end;
end
$$;

-- 自分の設定と、自分（is_self）＋ライバルの最新の総合点・成長。相手が使うのをやめた・見えなくなった行は出さない。
create or replace function public.community_list_rivals()
returns table (public_id text, display_name text, is_self boolean, opted_in boolean, overall integer, rules_version text, summary_date text, growth_week integer, growth_month integer)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  return query
    select p.public_id, p.display_name, p.user_id = me, public.community_rival_opted_in(p.user_id),
      case when jsonb_typeof(c.summary -> 'o' -> 0) = 'number' then (c.summary -> 'o' ->> 0)::numeric::integer else null end,
      c.summary ->> 'r', c.summary ->> 'd',
      public.community_growth(p.user_id, 7), public.community_growth(p.user_id, 30)
    from public.public_profiles p
    left join public.comparison_summaries c on c.user_id = p.user_id
    where p.deleted_at is null and (
      p.user_id = me
      or (
        p.user_id in (select r.rival_id from public.rivals r where r.user_id = me)
        and public.community_rival_opted_in(p.user_id)
        and public.community_relation(me, p.user_id) = 'friends'
        and public.community_can_view(me, p.user_id)
      )
    )
    order by (p.user_id = me) desc, p.public_id;
end
$$;

do $$
declare f text;
begin
  foreach f in array array['public.community_friendship_removed()', 'public.community_growth(uuid, integer)', 'public.community_rival_opted_in(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.community_set_comparison(jsonb)', 'public.community_set_rival_opt_in(boolean)', 'public.community_add_rival(text)', 'public.community_remove_rival(text)', 'public.community_list_rivals()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

commit;
