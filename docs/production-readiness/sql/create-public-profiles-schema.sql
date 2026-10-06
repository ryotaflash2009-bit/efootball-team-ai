-- F-053 公開 ID・プロフィール — Production の migration の提案（2026-10-07・未適用）
-- 適用は本人の承認の後（Production の schema・RLS の変更）。CI の使い捨て PostgreSQL でだけ検証する
-- （src/lib/profile/public-profiles.postgres.test.ts）。戻しは rollback-public-profiles-schema.sql。
--
-- 規則（src/lib/profile/public-id.ts と同じ・版 public-id/2026-10-02.v1）:
--   形式 ^[a-z][a-z0-9_]{2,19}$・`__` なし・末尾の `_` なし。保存は正規化済み（小文字・NFKC はアプリで）。
--   予約語は完全一致で使えない（下の public_id_reserved_words。TS の RESERVED_PUBLIC_IDS と同期をテストで確認）。
--   変更は 30 日に 1 回。手放した ID は 90 日間ほかの人が使えない（本人は戻せる）。
--   退会（soft delete）で ID を手放す。表示名・ID の検索は、公開（public）・未削除・ブロックの関係なしのものだけ。
--   anon（未ログイン）は表を読めない（列挙の防止）。他人の user_id（内部の UUID）は読めない（列の権限）。

begin;

create table if not exists public.public_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  public_id text not null,
  display_name text not null,
  visibility text not null default 'private',
  public_id_changed_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_profiles_public_id_format check (public_id ~ '^[a-z][a-z0-9_]{2,19}$' and position('__' in public_id) = 0 and right(public_id, 1) <> '_'),
  constraint public_profiles_display_name_length check (char_length(display_name) between 1 and 30 and display_name !~ '[[:cntrl:]]'),
  constraint public_profiles_visibility check (visibility in ('private', 'public'))
);

-- 使用中の ID は一意（退会済みの行は数えない）
create unique index if not exists public_profiles_public_id_active on public.public_profiles (public_id) where deleted_at is null;

create table if not exists public.public_id_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  public_id text not null,
  released_at timestamptz not null default now(),
  reusable_after timestamptz not null
);
create index if not exists public_id_history_public_id on public.public_id_history (public_id, reusable_after);

create table if not exists public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create or replace function public.public_id_reserved_words() returns text[] language sql immutable as $$
  select array[
    'about','account','admin','api','app','auth','best_xi','billing','blog','community','compare','contact',
    'dashboard','data','delete','diagnosis','disclaimer','favorites','help','home','login','logout','managers',
    'me','my_builds','my_team','new','null','players','privacy','profile','release','root','search','settings',
    'share','signin','signup','squads','static','status','support','system','team','terms','test','undefined',
    'user','users','world','www'
  ]::text[]
$$;

-- 予約語・変更の間隔・手放した ID の再利用を DB でも守る（アプリの確認を迂回された場合の最後の砦）
create or replace function public.public_profiles_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.public_id = any (public.public_id_reserved_words()) then
    raise exception 'public_id is reserved' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.public_id is distinct from old.public_id then
    if old.public_id_changed_at > now() - interval '30 days' then
      raise exception 'public_id can be changed once every 30 days' using errcode = 'P0002';
    end if;
    insert into public.public_id_history (user_id, public_id, reusable_after) values (old.user_id, old.public_id, now() + interval '90 days');
    new.public_id_changed_at := now();
  end if;
  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    insert into public.public_id_history (user_id, public_id, reusable_after) values (old.user_id, old.public_id, now() + interval '90 days');
  end if;
  if (tg_op = 'INSERT' or new.public_id is distinct from old.public_id) and exists (
    select 1 from public.public_id_history h where h.public_id = new.public_id and h.reusable_after > now() and h.user_id <> new.user_id
  ) then
    raise exception 'public_id was released recently and is not reusable yet' using errcode = 'P0003';
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists public_profiles_guard on public.public_profiles;
create trigger public_profiles_guard before insert or update on public.public_profiles for each row execute function public.public_profiles_guard();

alter table public.public_profiles enable row level security;
alter table public.public_id_history enable row level security;
alter table public.user_blocks enable row level security;

-- ブロックの関係（どちらの向きでも）。相手が自分をブロックした行は RLS で自分からは見えないため、security definer で確認する
-- （真偽だけを返す・ブロックの行そのものは見せない）。
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks x where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a))
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- 読み取り: 本人の行・または 公開・未削除・どちらの向きにもブロックの関係が無い行
drop policy if exists public_profiles_select on public.public_profiles;
create policy public_profiles_select on public.public_profiles for select to authenticated using (
  user_id = auth.uid()
  or (
    visibility = 'public' and deleted_at is null
    and not public.is_blocked_between(auth.uid(), public_profiles.user_id)
  )
);
drop policy if exists public_profiles_insert on public.public_profiles;
create policy public_profiles_insert on public.public_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists public_profiles_update on public.public_profiles;
create policy public_profiles_update on public.public_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ブロック: 本人が作ったものだけ見る・作る・消す
drop policy if exists user_blocks_own on public.user_blocks;
create policy user_blocks_own on public.user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- 権限: anon は何もできない（列挙の防止）。authenticated は他人の user_id を読めない（列の権限）。
revoke all on public.public_profiles, public.public_id_history, public.user_blocks from anon, authenticated;
grant select (public_id, display_name, visibility, created_at) on public.public_profiles to authenticated;
grant insert (public_id, display_name, visibility) on public.public_profiles to authenticated;
grant update (public_id, display_name, visibility, deleted_at) on public.public_profiles to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
-- 履歴は利用者から直接は見えない（trigger だけが書く）

-- 検索: 3 文字以上・前方一致・最大 20 件・RLS をそのまま適用（security invoker）
create or replace function public.search_public_profiles(q text) returns table (public_id text, display_name text)
language sql stable security invoker set search_path = public as $$
  select p.public_id, p.display_name from public.public_profiles p
  where char_length(q) >= 3 and p.public_id like replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
    and p.visibility = 'public' and p.deleted_at is null
  order by p.public_id
  limit 20
$$;
revoke all on function public.search_public_profiles(text) from public, anon;
grant execute on function public.search_public_profiles(text) to authenticated;
revoke all on function public.public_profiles_guard() from public, anon, authenticated;

commit;
