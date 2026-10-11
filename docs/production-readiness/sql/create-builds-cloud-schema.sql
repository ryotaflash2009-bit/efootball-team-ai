-- ============================================================================
-- saved_builds_snapshots: 保存ビルドのクラウド保存(手動・任意)専用テーブル — 2026-10-11 提案(未適用)
-- ============================================================================
--
-- 目的(F-052 クラウド同期の第2段階):
--   利用者が明示的に「クラウドへ保存」を実行したときだけ、保存ビルド(My Builds)の
--   スナップショットを1件、認証済みユーザー本人のためだけに保存する。ログイン・ページ表示・
--   アプリ起動・セッション復元では書き込まない。復元は「端末に無いビルドだけを追加」(上書き・削除なし)。
--
-- 設計は my_team_snapshots (create-my-team-cloud-schema.sql) と同じ多層防御:
--   - ユーザー1人につき1行(unique(user_id))。user_id はクライアントの入力を信用せず既定値 auth.uid()。
--   - RLS は authenticated だけ。select/insert/update/delete とも user_id = (select auth.uid())。
--     USING (true) / WITH CHECK (true) は使わない。anon・public には何も許可しない。
--   - UPDATE での user_id の変更はトリガーでも拒否。
--   - item_count は builds_data->'items' の要素数と一致することを CHECK で強制。
--   - builds_data に保存するのは保存ビルドそのもの(ビルド名・配分・ブースターの選択・計算結果・規則の版)だけ。
--     メールアドレス・トークン・端末情報・他機能のデータは保存しない。
--   - アカウントを消すと auth.users の on delete cascade で行も消える。
--
-- 冪等性: 複数回実行しても安全(IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS)。
-- 影響範囲: public スキーマの新しい表 1 つと関数 1 つだけ。my_team_snapshots ほか既存の表には触れない。
-- ロールバック: rollback-builds-cloud-schema.sql
-- 検証: src/lib/account/builds-cloud-rls.postgres.test.ts(CI の使い捨て PostgreSQL 16)
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. テーブル本体
create table if not exists public.saved_builds_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schema_version text not null,
  builds_data jsonb not null,
  item_count integer not null,
  payload_hash text not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_builds_snapshots_user_id_unique unique (user_id),
  constraint saved_builds_snapshots_schema_version_not_blank check (char_length(btrim(schema_version)) > 0),
  constraint saved_builds_snapshots_schema_version_length check (char_length(schema_version) <= 100),
  -- 異常に大きなペイロードだけを拒否する上限(アプリ側の上限 2000 件・約 900KB と同じ)
  constraint saved_builds_snapshots_item_count_range check (item_count >= 0 and item_count <= 2000),
  constraint saved_builds_snapshots_payload_size check (octet_length(builds_data::text) <= 1000000),
  constraint saved_builds_snapshots_payload_hash_format check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint saved_builds_snapshots_builds_data_is_object check (jsonb_typeof(builds_data) = 'object'),
  constraint saved_builds_snapshots_items_is_array check (coalesce(jsonb_typeof(builds_data -> 'items'), '') = 'array'),
  constraint saved_builds_snapshots_item_count_matches check (item_count = jsonb_array_length(builds_data -> 'items'))
);

comment on table public.saved_builds_snapshots is
  '保存ビルドのクラウド保存(手動・任意)。ユーザー1人につき最大1行。明示的な「クラウドへ保存」操作からのみ書き込まれる。';

-- 2. updated_at の自動更新・user_id の書き換えの禁止・created_at の固定
create or replace function public.saved_builds_snapshots_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at = now();
    return new;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'saved_builds_snapshots.user_id cannot be changed after creation';
    end if;
    new.created_at = old.created_at;
    new.updated_at = now();
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists saved_builds_snapshots_guard on public.saved_builds_snapshots;
create trigger saved_builds_snapshots_guard
  before insert or update on public.saved_builds_snapshots
  for each row
  execute function public.saved_builds_snapshots_guard();

-- 3. Row Level Security(initplan の最適化済みの形: (select auth.uid()))
alter table public.saved_builds_snapshots enable row level security;

drop policy if exists saved_builds_snapshots_select_own on public.saved_builds_snapshots;
create policy saved_builds_snapshots_select_own
  on public.saved_builds_snapshots
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists saved_builds_snapshots_insert_own on public.saved_builds_snapshots;
create policy saved_builds_snapshots_insert_own
  on public.saved_builds_snapshots
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists saved_builds_snapshots_update_own on public.saved_builds_snapshots;
create policy saved_builds_snapshots_update_own
  on public.saved_builds_snapshots
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists saved_builds_snapshots_delete_own on public.saved_builds_snapshots;
create policy saved_builds_snapshots_delete_own
  on public.saved_builds_snapshots
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 4. 権限 — authenticated だけに必要最小限
revoke all on public.saved_builds_snapshots from public;
revoke all on public.saved_builds_snapshots from anon;
grant select, insert, update, delete on public.saved_builds_snapshots to authenticated;

-- ============================================================================
-- 適用の後に確認すること(読み取りだけ):
--   Table Editor → saved_builds_snapshots が存在し、RLS が Enabled
--   Policies → 4 つ(select/insert/update/delete)・対象ロールは authenticated のみ
--   my_team_snapshots の件数・ポリシーに変化がないこと
-- ============================================================================
