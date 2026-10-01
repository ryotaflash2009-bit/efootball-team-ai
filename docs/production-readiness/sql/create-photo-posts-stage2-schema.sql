-- ============================================================================
-- photo_posts（F-084 段階 2: 認証済みの本人だけが読める非公開の写真付き投稿）— 提案・未適用
-- ============================================================================
--
-- 状態: **提案（Production へ未適用）**。適用は本人の承認後（owner-decisions-2026-10-02.md C）。
--   設計: docs/product/photo-posts-stage2-proposal.md
--   検証: src/lib/testing/photo-posts-sql-audit.test.ts（静的）・
--         src/lib/posts/photo-posts-rls.postgres.test.ts（CI の使い捨て PostgreSQL で本人の分離を実行）
--
-- 段階 2 の範囲:
--   - 投稿・画像は投稿した本人だけが読み書き・削除できる。他人・未認証は 0 行。
--   - 公開範囲は 'private' だけ（CHECK 制約）。URL 限定・友達・全体は、通報・ブロック・管理者の非表示・
--     監査ログの実運用を確認してから、別の migration で CHECK を広げる（このファイルでは開けない）。
--   - 画像は非公開の Storage バケット `photo-posts`。オブジェクトのパスは `<auth.uid()>/<32 桁の 16 進>.<jpg|webp>`
--     （推測困難なキー・先頭のフォルダーが所有者）。投稿の image_path も同じ形で、所有者のフォルダーだけを許す。
--   - 削除は本人による行の削除（hard delete）。画像のオブジェクトも本人が削除できる。監査ログには本文・画像を残さない。
--
-- 安全設計（my_team_snapshots と同じ多層防御）:
--   - user_id はクライアントを信用しない（既定値 auth.uid()・WITH CHECK・変更禁止のトリガー）。
--   - RLS は enable + force。ポリシーは authenticated だけ。anon・public にはポリシーも GRANT も無い。
--   - USING (true) / WITH CHECK (true) は使わない。
--   - 監査ログは security definer のトリガーだけが書く。クライアントからは読めず書けない。
--
-- 冪等性: 複数回実行しても安全（IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS / ON CONFLICT）。
-- ロールバック: rollback-photo-posts-stage2-schema.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. 投稿
-- ----------------------------------------------------------------------------
create table if not exists public.photo_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null default '',
  category text not null,
  purpose text not null,
  visibility text not null default 'private',
  allow_comments boolean not null default false,
  image_path text,
  image_alt text not null default '',
  image_bytes integer,
  image_mime text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_posts_body_length check (char_length(body) <= 1000),
  constraint photo_posts_alt_length check (char_length(image_alt) <= 200),
  constraint photo_posts_category check (category in ('squad', 'gacha', 'build', 'before_after', 'question', 'other')),
  constraint photo_posts_purpose check (purpose in ('show', 'advice', 'record')),
  -- 段階 2: 非公開だけ。広げるのは別の承認つき migration。
  constraint photo_posts_visibility_stage2 check (visibility = 'private'),
  -- 段階 2: コメントは無効（コメントの表・通報の運用が無いため）。
  constraint photo_posts_comments_disabled check (allow_comments = false),
  constraint photo_posts_image_path_format check (image_path is null or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{32}\.(jpg|webp)$'),
  constraint photo_posts_image_path_owner check (image_path is null or split_part(image_path, '/', 1) = user_id::text),
  constraint photo_posts_image_fields check (
    (image_path is null and image_bytes is null and image_mime is null)
    or (image_path is not null and image_bytes between 1 and 5242880 and image_mime in ('image/jpeg', 'image/webp'))
  ),
  constraint photo_posts_not_empty check (char_length(btrim(body)) > 0 or image_path is not null)
);

create index if not exists photo_posts_user_created_idx on public.photo_posts (user_id, created_at desc);

comment on table public.photo_posts is
  'F-084 段階 2: 本人だけが読める非公開の写真付き投稿（提案・承認後に適用）。公開範囲は private だけ。';

-- ----------------------------------------------------------------------------
-- 2. 監査ログ（本文・画像を残さない。クライアントからは読めず書けない）
-- ----------------------------------------------------------------------------
create table if not exists public.photo_post_audit (
  id bigint generated always as identity primary key,
  post_id uuid not null,
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now(),
  constraint photo_post_audit_action check (action in ('created', 'updated', 'deleted'))
);

-- RLS は有効（ポリシーなし → クライアントは 0 行・書き込み不可）。FORCE はしない:
-- 書き込むのは表の所有者として動く security definer のトリガーだけで、FORCE だとそれも拒否されるため。
alter table public.photo_post_audit enable row level security;
revoke all on public.photo_post_audit from public;
revoke all on public.photo_post_audit from anon;
revoke all on public.photo_post_audit from authenticated;

-- ----------------------------------------------------------------------------
-- 3. 変更の保護（user_id・created_at の固定、updated_at、連投の制限）と監査
-- ----------------------------------------------------------------------------
create or replace function public.photo_posts_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recent integer;
begin
  if tg_op = 'INSERT' then
    -- 連投の制限（ローカルの契約 POST_LIMITS と同じ: 30 秒に 1 件・1 時間に 10 件）。
    select count(*) into recent from public.photo_posts p
      where p.user_id = new.user_id and p.created_at > now() - interval '30 seconds';
    if recent > 0 then
      raise exception 'photo_posts: posting too fast' using errcode = 'P0001';
    end if;
    select count(*) into recent from public.photo_posts p
      where p.user_id = new.user_id and p.created_at > now() - interval '1 hour';
    if recent >= 10 then
      raise exception 'photo_posts: hourly limit reached' using errcode = 'P0001';
    end if;
    new.created_at = now();
    new.updated_at = now();
    return new;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'photo_posts.user_id cannot be changed';
    end if;
    if new.image_path is distinct from old.image_path then
      raise exception 'photo_posts.image_path cannot be changed (delete and post again)';
    end if;
    new.created_at = old.created_at;
    new.updated_at = now();
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists photo_posts_guard on public.photo_posts;
create trigger photo_posts_guard
  before insert or update on public.photo_posts
  for each row
  execute function public.photo_posts_guard();

create or replace function public.photo_posts_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.photo_post_audit (post_id, user_id, action) values (old.id, old.user_id, 'deleted');
    return old;
  end if;
  insert into public.photo_post_audit (post_id, user_id, action)
    values (new.id, new.user_id, case when tg_op = 'INSERT' then 'created' else 'updated' end);
  return new;
end;
$$;

revoke all on function public.photo_posts_audit() from public;

drop trigger if exists photo_posts_audit on public.photo_posts;
create trigger photo_posts_audit
  after insert or update or delete on public.photo_posts
  for each row
  execute function public.photo_posts_audit();

-- ----------------------------------------------------------------------------
-- 4. RLS（本人だけ）
-- ----------------------------------------------------------------------------
alter table public.photo_posts enable row level security;
alter table public.photo_posts force row level security;

drop policy if exists photo_posts_select_own on public.photo_posts;
create policy photo_posts_select_own on public.photo_posts
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists photo_posts_insert_own on public.photo_posts;
create policy photo_posts_insert_own on public.photo_posts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists photo_posts_update_own on public.photo_posts;
create policy photo_posts_update_own on public.photo_posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists photo_posts_delete_own on public.photo_posts;
create policy photo_posts_delete_own on public.photo_posts
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.photo_posts from public;
revoke all on public.photo_posts from anon;
grant select, insert, update, delete on public.photo_posts to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Storage（非公開バケット・所有者のフォルダーだけ）
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photo-posts', 'photo-posts', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/webp'];

drop policy if exists photo_posts_objects_select_own on storage.objects;
create policy photo_posts_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'photo-posts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists photo_posts_objects_insert_own on storage.objects;
create policy photo_posts_objects_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photo-posts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{32}\.(jpg|webp)$'
  );

drop policy if exists photo_posts_objects_delete_own on storage.objects;
create policy photo_posts_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photo-posts' and (storage.foldername(name))[1] = auth.uid()::text);

-- 画像は上書きしない（UPDATE のポリシーは作らない）。anon には何も作らない。

-- ============================================================================
-- 適用後の確認（本人がダッシュボードで）:
--   Storage → photo-posts が Private、上限 5 MB、MIME は image/jpeg・image/webp だけ
--   Table Editor → photo_posts・photo_post_audit の RLS が Enabled
--   Policies → photo_posts は authenticated だけの 4 件、storage.objects の photo_posts_objects_* は 3 件
-- ============================================================================
