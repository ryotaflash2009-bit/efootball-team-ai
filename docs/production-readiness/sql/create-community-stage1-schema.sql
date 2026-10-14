-- コミュニティ 第 1 段階（2026-10-14）: F-054 公開範囲・F-055 友達・F-056 ブロック・ミュート・通報・F-062 友達との比較
-- 前提: create-public-profiles-schema.sql（F-053・public_profiles / public_id_history / user_blocks）を先に適用する。
-- 戻しは rollback-community-stage1-schema.sql。CI の使い捨て PostgreSQL で検証する（src/lib/community/community-stage1.postgres.test.ts）。
--
-- 方針（docs/product/community-and-growth-design.md・community-safety-operations.md）:
--   - 利用者は他人の user_id（内部の UUID）を一切受け取らない。他人に関わる操作は、公開 ID を引数にした security definer の関数だけ。
--   - 新しい表は RLS を有効にし、anon・authenticated へ直接の権限を与えない（関数の中だけで読み書きする）。
--   - 公開範囲: private（本人だけ）/ link（ID を知っているログイン済みの人）/ friends（友達だけ）/ public（ログイン済みの人・検索に出る）。
--     未ログイン（anon）は何も読めない。検索エンジンへは出さない（画面は noindex）。
--   - ブロックはどちらの向きでも、相手からは「存在しない」と同じに見える。ブロックすると友達・申請は消える。
--   - ミュートは自分の画面だけ（相手の申請・検索の結果を隠す）。相手には分からない。
--   - 通報は運営者だけが読む（community_report_queue・SQL Editor）。通報した人は相手に知らされない。
--   - 1 日の上限: 友達の申請 20・ブロック 100・通報 20（community_rate_events）。友達は 300 人まで。
--   - 制限（restricted_at）は運営者だけが付ける（列の権限なし）。制限中のプロフィールは他人から見えず、申請もできない。

begin;

-- ---------------------------------------------------------------------------
-- F-054 公開範囲・運営者の制限
-- ---------------------------------------------------------------------------
alter table public.public_profiles drop constraint if exists public_profiles_visibility;
alter table public.public_profiles add constraint public_profiles_visibility check (visibility in ('private', 'link', 'friends', 'public'));
alter table public.public_profiles add column if not exists restricted_at timestamptz;

-- 直接の読み取り（検索の関数・本人）は「全体公開・未削除・未制限・ブロックの関係なし」だけ。link / friends は関数で判定する。
drop policy if exists public_profiles_select on public.public_profiles;
create policy public_profiles_select on public.public_profiles for select to authenticated using (
  user_id = auth.uid()
  or (
    visibility = 'public' and deleted_at is null and restricted_at is null
    and not public.is_blocked_between(auth.uid(), public_profiles.user_id)
  )
);

-- ---------------------------------------------------------------------------
-- 表
-- ---------------------------------------------------------------------------
create table if not exists public.user_mutes (
  muter_id uuid not null references auth.users (id) on delete cascade,
  muted_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  constraint user_mutes_not_self check (muter_id <> muted_id)
);

create table if not exists public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status check (status in ('pending', 'accepted'))
);
-- 2 人の間の関係は 1 行だけ（向きを問わない）
create unique index if not exists friendships_pair on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee on public.friendships (addressee_id);

create table if not exists public.community_reports (
  id bigint generated always as identity primary key,
  -- 退会しても通報の記録は保持期間（解決から 1 年）まで残す。人の ID だけを外す。
  reporter_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  target_kind text not null default 'user',
  target_public_id text not null,
  reason text not null,
  note text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolution_note text,
  constraint community_reports_kind check (target_kind in ('user')),
  constraint community_reports_reason check (reason in ('spam', 'harassment', 'personal_info', 'impersonation', 'inappropriate_image', 'rights_violation', 'minor_safety', 'other')),
  constraint community_reports_note check (char_length(note) <= 500),
  constraint community_reports_status check (status in ('open', 'reviewing', 'actioned', 'dismissed', 'withdrawn'))
);
create index if not exists community_reports_reporter on public.community_reports (reporter_id, created_at);
create index if not exists community_reports_status on public.community_reports (status, created_at);

create table if not exists public.community_rate_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now(),
  constraint community_rate_events_action check (action in ('friend_request', 'block', 'report'))
);
create index if not exists community_rate_events_user on public.community_rate_events (user_id, action, created_at);

-- F-062: 友達との比較に使う診断の要約（共有 URL の sd1 と同じ中身・1 人 1 件・友達だけが読める）
create table if not exists public.comparison_summaries (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary jsonb not null,
  updated_at timestamptz not null default now(),
  constraint comparison_summaries_shape check (jsonb_typeof(summary) = 'object' and octet_length(summary::text) <= 2048)
);

alter table public.user_mutes enable row level security;
alter table public.friendships enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_rate_events enable row level security;
alter table public.comparison_summaries enable row level security;
revoke all on public.user_mutes, public.friendships, public.community_reports, public.community_rate_events, public.comparison_summaries from anon, authenticated;
-- ブロックも公開 ID の関数からだけ扱う（他人の user_id を渡さない）
revoke all on public.user_blocks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 内部の補助（利用者からは呼べない）
-- ---------------------------------------------------------------------------
create or replace function public.community_me() returns uuid language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return me;
end
$$;

-- 公開 ID → user_id（未削除の行だけ。制限中も返す: ブロック・通報の対象にできるように）
create or replace function public.community_uid_of(p_public_id text) returns uuid language sql stable security definer set search_path = public as $$
  select p.user_id from public.public_profiles p where p.public_id = lower(btrim(coalesce(p_public_id, ''))) and p.deleted_at is null
$$;

create or replace function public.community_relation(me uuid, other uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when f.status = 'accepted' then 'friends' when f.requester_id = me then 'pending_outgoing' else 'pending_incoming' end
    from public.friendships f
    where least(f.requester_id, f.addressee_id) = least(me, other) and greatest(f.requester_id, f.addressee_id) = greatest(me, other)
  ), 'none')
$$;

-- 自分（me）から相手のプロフィールが見えるか（本人・ブロック・制限・公開範囲）
create or replace function public.community_can_view(me uuid, other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when me = other then true
    else exists (
      select 1 from public.public_profiles p
      where p.user_id = other and p.deleted_at is null and p.restricted_at is null
        and not public.is_blocked_between(me, other)
        and (
          p.visibility in ('link', 'public')
          or (p.visibility = 'friends' and public.community_relation(me, other) in ('friends', 'pending_incoming'))
        )
    )
  end
$$;

create or replace function public.community_take_rate(me uuid, p_action text, p_limit int) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.community_rate_events where user_id = me and created_at < now() - interval '2 days';
  if (select count(*) from public.community_rate_events where user_id = me and action = p_action and created_at > now() - interval '1 day') >= p_limit then
    raise exception 'rate_limited' using errcode = 'P0011';
  end if;
  insert into public.community_rate_events (user_id, action) values (me, p_action);
end
$$;

-- 申請・承認には、自分の公開プロフィール（未削除・未制限・非公開ではない）が要る（相手から自分が見えるように）
create or replace function public.community_require_own_profile(me uuid) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.public_profiles where user_id = me and deleted_at is null and restricted_at is null and visibility <> 'private') then
    raise exception 'profile_required' using errcode = 'P0013';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- プロフィール・検索
-- ---------------------------------------------------------------------------
-- 本人のプロフィール（作成・変更は 1 つの関数で。予約語・30 日に 1 回・手放した ID の再利用の禁止は既存の trigger が守る）
create or replace function public.community_my_profile()
returns table (public_id text, display_name text, visibility text, public_id_changed_at timestamptz, restricted boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  return query select p.public_id, p.display_name, p.visibility, p.public_id_changed_at, p.restricted_at is not null
    from public.public_profiles p where p.user_id = me and p.deleted_at is null;
end
$$;

create or replace function public.community_save_my_profile(p_public_id text, p_display_name text, p_visibility text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  pid text := lower(btrim(coalesce(p_public_id, '')));
  dn text := btrim(coalesce(p_display_name, ''));
  cur public.public_profiles%rowtype;
begin
  select * into cur from public.public_profiles x where x.user_id = me;
  if not found then
    insert into public.public_profiles (user_id, public_id, display_name, visibility) values (me, pid, dn, p_visibility);
    return 'created';
  end if;
  if cur.deleted_at is not null then raise exception 'profile_deleted' using errcode = 'P0015'; end if;
  if cur.restricted_at is not null and p_visibility <> 'private' then raise exception 'restricted' using errcode = 'P0016'; end if;
  update public.public_profiles x set public_id = pid, display_name = dn, visibility = p_visibility where x.user_id = me;
  return 'updated';
end
$$;

create or replace function public.community_get_profile(p_public_id text)
returns table (public_id text, display_name text, visibility text, relation text, blocked_by_me boolean, muted_by_me boolean, is_self boolean, has_comparison boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
begin
  if other is null then return; end if;
  if other = me then
    return query select p.public_id, p.display_name, p.visibility, 'self'::text, false, false, true, exists (select 1 from public.comparison_summaries c where c.user_id = me)
      from public.public_profiles p where p.user_id = me;
    return;
  end if;
  -- 自分がブロックした相手: 解除できるように ID だけを返す（表示名・関係は出さない）
  if exists (select 1 from public.user_blocks b where b.blocker_id = me and b.blocked_id = other) then
    return query select p.public_id, null::text, null::text, 'blocked'::text, true, false, false, false from public.public_profiles p where p.user_id = other;
    return;
  end if;
  if not public.community_can_view(me, other) then return; end if;
  return query select p.public_id, p.display_name, null::text, public.community_relation(me, other), false,
    exists (select 1 from public.user_mutes m where m.muter_id = me and m.muted_id = other),
    false,
    public.community_relation(me, other) = 'friends' and exists (select 1 from public.comparison_summaries c where c.user_id = other)
    from public.public_profiles p where p.user_id = other;
end
$$;

-- 検索: 全体公開だけ・3 文字以上の前方一致・最大 20 件・ブロックの関係とミュートした相手を除く
create or replace function public.community_search(q text) returns table (public_id text, display_name text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  needle text := lower(btrim(coalesce(q, '')));
begin
  if char_length(needle) < 3 or char_length(needle) > 20 or needle !~ '^[a-z0-9_]+$' then return; end if;
  return query select p.public_id, p.display_name from public.public_profiles p
    where p.public_id like replace(needle, '_', '\_') || '%' escape '\'
      and p.visibility = 'public' and p.deleted_at is null and p.restricted_at is null and p.user_id <> me
      and not public.is_blocked_between(me, p.user_id)
      and not exists (select 1 from public.user_mutes m where m.muter_id = me and m.muted_id = p.user_id)
    order by p.public_id
    limit 20;
end
$$;

-- ---------------------------------------------------------------------------
-- F-055 友達
-- ---------------------------------------------------------------------------
create or replace function public.community_request_friend(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
  rel text;
begin
  perform public.community_require_own_profile(me);
  if other is null or other = me or not public.community_can_view(me, other) then
    raise exception 'not_found' using errcode = 'P0010';
  end if;
  rel := public.community_relation(me, other);
  if rel = 'friends' then return 'already_friends'; end if;
  if rel = 'pending_outgoing' then return 'already_requested'; end if;
  if (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester_id = me or f.addressee_id = me)) >= 300 then
    raise exception 'friend_limit' using errcode = 'P0012';
  end if;
  if rel = 'pending_incoming' then
    -- 相手から申請が来ている: 承認と同じ
    if (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester_id = other or f.addressee_id = other)) >= 300 then
      raise exception 'friend_limit' using errcode = 'P0012';
    end if;
    update public.friendships set status = 'accepted', responded_at = now() where requester_id = other and addressee_id = me;
    return 'accepted';
  end if;
  perform public.community_take_rate(me, 'friend_request', 20);
  insert into public.friendships (requester_id, addressee_id) values (me, other);
  return 'requested';
end
$$;

create or replace function public.community_respond_friend(p_public_id text, p_accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
begin
  if other is null or not exists (select 1 from public.friendships where requester_id = other and addressee_id = me and status = 'pending') then
    return 'not_found';
  end if;
  if not coalesce(p_accept, false) then
    delete from public.friendships where requester_id = other and addressee_id = me and status = 'pending';
    return 'rejected';
  end if;
  perform public.community_require_own_profile(me);
  if (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester_id = me or f.addressee_id = me)) >= 300
     or (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester_id = other or f.addressee_id = other)) >= 300 then
    raise exception 'friend_limit' using errcode = 'P0012';
  end if;
  update public.friendships set status = 'accepted', responded_at = now() where requester_id = other and addressee_id = me and status = 'pending';
  return 'accepted';
end
$$;

-- 取り消し（自分の申請）・友達の解除。相手には通知しない。
create or replace function public.community_remove_friend(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
  n int;
begin
  if other is null then return 'none'; end if;
  delete from public.friendships f
    where least(f.requester_id, f.addressee_id) = least(me, other) and greatest(f.requester_id, f.addressee_id) = greatest(me, other)
      and not (f.status = 'pending' and f.addressee_id = me);
  get diagnostics n = row_count;
  return case when n > 0 then 'removed' else 'none' end;
end
$$;

-- 友達・申請の一覧（相手のプロフィールが未削除・未制限のものだけ。ミュートした相手からの申請は出さない）
create or replace function public.community_list_friends() returns table (public_id text, display_name text, state text, since timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  return query
    select p.public_id, p.display_name,
      case when f.status = 'accepted' then 'friends' when f.requester_id = me then 'pending_outgoing' else 'pending_incoming' end,
      coalesce(f.responded_at, f.created_at)
    from public.friendships f
    join public.public_profiles p on p.user_id = case when f.requester_id = me then f.addressee_id else f.requester_id end
    where (f.requester_id = me or f.addressee_id = me)
      and p.deleted_at is null and p.restricted_at is null
      and not (f.status = 'pending' and f.addressee_id = me and exists (select 1 from public.user_mutes m where m.muter_id = me and m.muted_id = f.requester_id))
    order by 3, p.public_id;
end
$$;

-- ---------------------------------------------------------------------------
-- F-056 ブロック・ミュート
-- ---------------------------------------------------------------------------
create or replace function public.community_block(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
begin
  if other is null or other = me then raise exception 'not_found' using errcode = 'P0010'; end if;
  if exists (select 1 from public.user_blocks where blocker_id = me and blocked_id = other) then return 'already_blocked'; end if;
  perform public.community_take_rate(me, 'block', 100);
  insert into public.user_blocks (blocker_id, blocked_id) values (me, other) on conflict do nothing;
  -- 友達・申請・比較の関係を消す（どちらの向きも）
  delete from public.friendships f where least(f.requester_id, f.addressee_id) = least(me, other) and greatest(f.requester_id, f.addressee_id) = greatest(me, other);
  return 'blocked';
end
$$;

create or replace function public.community_unblock(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
  n int;
begin
  if other is null then return 'none'; end if;
  delete from public.user_blocks where blocker_id = me and blocked_id = other;
  get diagnostics n = row_count;
  return case when n > 0 then 'unblocked' else 'none' end;
end
$$;

create or replace function public.community_mute(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
begin
  if other is null or other = me then raise exception 'not_found' using errcode = 'P0010'; end if;
  insert into public.user_mutes (muter_id, muted_id) values (me, other) on conflict do nothing;
  return 'muted';
end
$$;

create or replace function public.community_unmute(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
  n int;
begin
  if other is null then return 'none'; end if;
  delete from public.user_mutes where muter_id = me and muted_id = other;
  get diagnostics n = row_count;
  return case when n > 0 then 'unmuted' else 'none' end;
end
$$;

-- ブロック・ミュートした相手の一覧（kind = 'block' | 'mute'。表示名は出さない: ブロックした相手の名前を残さない）
create or replace function public.community_list_safety() returns table (kind text, public_id text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  return query
    select 'block'::text, p.public_id, b.created_at from public.user_blocks b join public.public_profiles p on p.user_id = b.blocked_id
      where b.blocker_id = me and p.deleted_at is null
    union all
    select 'mute'::text, p.public_id, m.created_at from public.user_mutes m join public.public_profiles p on p.user_id = m.muted_id
      where m.muter_id = me and p.deleted_at is null
    order by 1, 3 desc;
end
$$;

-- ---------------------------------------------------------------------------
-- F-056 通報
-- ---------------------------------------------------------------------------
create or replace function public.community_report(p_public_id text, p_reason text, p_note text) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
  pid text := lower(btrim(coalesce(p_public_id, '')));
  v_note text := btrim(coalesce(p_note, ''));
begin
  if other is null then raise exception 'not_found' using errcode = 'P0010'; end if;
  if other = me then raise exception 'self_report' using errcode = 'P0014'; end if;
  if char_length(v_note) > 500 then raise exception 'note_too_long' using errcode = '22001'; end if;
  -- 同じ相手への未解決の通報は 1 件だけ（重ねて送っても増やさない・上限も消費しない）
  if exists (select 1 from public.community_reports r where r.reporter_id = me and r.target_user_id = other and r.status in ('open', 'reviewing')) then
    return 'duplicate';
  end if;
  perform public.community_take_rate(me, 'report', 20);
  insert into public.community_reports (reporter_id, target_user_id, target_public_id, reason, note) values (me, other, pid, p_reason, v_note);
  return 'reported';
end
$$;

create or replace function public.community_list_my_reports() returns table (id bigint, target_public_id text, reason text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  return query select r.id, r.target_public_id, r.reason, r.status, r.created_at from public.community_reports r where r.reporter_id = me order by r.created_at desc limit 100;
end
$$;

create or replace function public.community_withdraw_report(p_id bigint) returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  n int;
begin
  update public.community_reports set status = 'withdrawn' where id = p_id and reporter_id = me and status = 'open';
  get diagnostics n = row_count;
  return case when n > 0 then 'withdrawn' else 'none' end;
end
$$;

-- ---------------------------------------------------------------------------
-- F-062 友達との比較
-- ---------------------------------------------------------------------------
create or replace function public.community_set_comparison(p_summary jsonb) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := public.community_me();
begin
  -- 中身の厳密な検証はアプリ（validateSharePayload）。ここでは形と大きさと版だけを確かめる。
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

create or replace function public.community_clear_comparison() returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  n int;
begin
  delete from public.comparison_summaries where user_id = me;
  get diagnostics n = row_count;
  return case when n > 0 then 'cleared' else 'none' end;
end
$$;

-- 本人のもの、または友達（どちらの向きにもブロックなし・相手が未制限）のものだけを返す
create or replace function public.community_get_comparison(p_public_id text) returns table (summary jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.community_me();
  other uuid := public.community_uid_of(p_public_id);
begin
  if other is null then return; end if;
  if other <> me and (public.community_relation(me, other) <> 'friends' or not public.community_can_view(me, other)) then return; end if;
  return query select c.summary, c.updated_at from public.comparison_summaries c where c.user_id = other;
end
$$;

-- ---------------------------------------------------------------------------
-- 運営者（SQL Editor・postgres）だけ: 通報の確認の列・対応・保持期間の削除
-- ---------------------------------------------------------------------------
create or replace view public.community_report_queue as
  select r.id, r.created_at, r.status, r.reason, r.target_public_id, r.note,
    (select count(*) from public.community_reports x where x.target_user_id = r.target_user_id and x.status in ('open', 'reviewing')) as open_reports_for_target,
    p.restricted_at is not null as target_restricted
  from public.community_reports r
  left join public.public_profiles p on p.user_id = r.target_user_id
  where r.status in ('open', 'reviewing')
  order by (r.reason = 'minor_safety') desc, r.created_at;

-- p_status: reviewing / actioned / dismissed。p_restrict = true で相手のプロフィールを制限（非公開・他人から見えない・申請できない）。
create or replace function public.community_moderate_report(p_id bigint, p_status text, p_resolution_note text, p_restrict boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if p_status not in ('reviewing', 'actioned', 'dismissed') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update public.community_reports set status = p_status, reviewed_at = now(), resolution_note = p_resolution_note where id = p_id returning target_user_id into target;
  if not found then return 'none'; end if;
  if coalesce(p_restrict, false) and target is not null then
    update public.public_profiles set restricted_at = now(), visibility = 'private' where user_id = target;
  end if;
  return p_status;
end
$$;

create or replace function public.community_lift_restriction(p_public_id text) returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.public_profiles set restricted_at = null where public_id = lower(btrim(p_public_id)) and restricted_at is not null;
  get diagnostics n = row_count;
  return case when n > 0 then 'lifted' else 'none' end;
end
$$;

-- 保持期間: 解決（actioned / dismissed / withdrawn）から 1 年を過ぎた通報を消す（月に 1 回、運営者が実行）
create or replace function public.community_purge_old_reports() returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  delete from public.community_reports where status in ('actioned', 'dismissed', 'withdrawn') and coalesce(reviewed_at, created_at) < now() - interval '1 year';
  get diagnostics n = row_count;
  return n;
end
$$;

-- ---------------------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------------------
revoke all on public.community_report_queue from anon, authenticated;
do $$
declare f text;
begin
  -- 内部の補助と運営者の関数: 誰にも公開しない
  foreach f in array array[
    'public.community_me()', 'public.community_uid_of(text)', 'public.community_relation(uuid, uuid)', 'public.community_can_view(uuid, uuid)',
    'public.community_take_rate(uuid, text, integer)', 'public.community_require_own_profile(uuid)',
    'public.community_moderate_report(bigint, text, text, boolean)', 'public.community_lift_restriction(text)', 'public.community_purge_old_reports()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- 利用者の関数: ログイン済みだけ
  foreach f in array array[
    'public.community_my_profile()', 'public.community_save_my_profile(text, text, text)',
    'public.community_get_profile(text)', 'public.community_search(text)',
    'public.community_request_friend(text)', 'public.community_respond_friend(text, boolean)', 'public.community_remove_friend(text)', 'public.community_list_friends()',
    'public.community_block(text)', 'public.community_unblock(text)', 'public.community_mute(text)', 'public.community_unmute(text)', 'public.community_list_safety()',
    'public.community_report(text, text, text)', 'public.community_list_my_reports()', 'public.community_withdraw_report(bigint)',
    'public.community_set_comparison(jsonb)', 'public.community_clear_comparison()', 'public.community_get_comparison(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

commit;
