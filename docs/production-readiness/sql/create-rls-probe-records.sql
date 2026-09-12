-- ============================================================================
-- rls_probe_records: Row Level Security 分離検証専用テーブル(技術検証PoC)
-- ============================================================================
--
-- 目的:
--   Supabase PostgreSQL + Row Level Security だけで、認証済みユーザーごとの
--   データ分離が安全に成立することを実証するための、検証専用の最小テーブル。
--
--   このテーブルには本番ユーザーデータ(My Team・お気に入り・保存ビルド・
--   保存スカッド・スカッドテンプレート等)を一切保存しない。保存してよいのは
--   「Probe A」のような無害な短い検証文字列だけ。
--
-- 安全設計の要点:
--   - user_id はクライアントの入力を一切信用しない。既定値は auth.uid()
--     (このSQLを実行しているPostgresセッードの認証済みユーザーID)であり、
--     未認証(auth.uid() IS NULL)なら NOT NULL 制約でINSERT自体が失敗する。
--   - RLSポリシーは "authenticated" ロールにだけ許可する。"anon"(未認証)・
--     "public" には SELECT/INSERT/UPDATE/DELETE のいずれも許可しない。
--   - INSERT/UPDATE には WITH CHECK を必ず設定し、「他人のuser_idを指定して
--     作成する」「更新時に所有者を書き換える」の両方を拒否する。
--   - トリガーで UPDATE 時の user_id 変更をさらに拒否する(RLSのWITH CHECK
--     だけに頼らない多層防御)。
--   - USING (true) / WITH CHECK (true) のような無条件許可は一切使わない。
--   - 管理者専用の特権ロール・Secret keyは前提にしない(このSQL自体もSQL
--     Editor経由の管理者操作で1回だけ実行するものであり、アプリの実行時
--     コードはPublishable keyと認証済みセッションだけで動作する)。
--
-- 冪等性: このファイルは複数回実行しても安全なように書かれている
--   (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS を使用)。
--
-- 影響範囲: public スキーマのみ。auth.users は外部キーとして参照するだけで、
--   一切変更しない。Supabaseのシステムスキーマ(auth, storage 等)は変更しない。
--
-- ロールバック: rollback-rls-probe-records.sql を参照。
-- ============================================================================

-- gen_random_uuid() を確実に使えるようにする(既に有効なら何もしない)。
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. テーブル本体
-- ----------------------------------------------------------------------------
-- user_idの既定値はauth.uid()(このSQL実行時点のセッションの認証済みユーザー)。
-- クライアントがINSERT時にuser_idを省略した場合はこれが使われる
-- (省略しても・別の値を指定してもRLSのWITH CHECKで最終的に拒否されるため、
-- これは利便性のための既定値であり、安全性の根拠はRLS側に置く)。
create table if not exists public.rls_probe_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rls_probe_records_label_length check (char_length(label) <= 100),
  constraint rls_probe_records_label_not_blank check (char_length(btrim(label)) > 0)
);

comment on table public.rls_probe_records is
  'RLS分離検証専用のPoCテーブル。本番ユーザーデータ(My Team等)は保存しない。短い検証文字列(label)だけを保持する。';

-- ----------------------------------------------------------------------------
-- 2. 検索性能のための最小限のインデックス(必須ではないが、
--    「本人の行だけを作成日時順で取得する」典型的なクエリに対して安全に追加)
-- ----------------------------------------------------------------------------
create index if not exists rls_probe_records_user_id_created_at_idx
  on public.rls_probe_records (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. updated_at自動更新 + user_id書き換え禁止トリガー(RLSだけに頼らない多層防御)
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER(既定)のまま・search_pathを空にして固定することで、
-- 検索パス経由の関数差し替え攻撃(search_path hijacking)を防ぐ。
-- このトリガーは行の値だけを見て判断し、他のテーブル・関数を一切参照しないため、
-- search_path = '' でも問題なく動作する。
create or replace function public.rls_probe_records_guard()
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
      raise exception 'rls_probe_records.user_id cannot be changed after creation';
    end if;
    new.created_at = old.created_at;
    new.updated_at = now();
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists rls_probe_records_guard on public.rls_probe_records;
create trigger rls_probe_records_guard
  before insert or update on public.rls_probe_records
  for each row
  execute function public.rls_probe_records_guard();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.rls_probe_records enable row level security;
-- テーブル所有者(管理者接続)であってもRLSを無条件に迂回できないようにする。
-- (管理者専用の特権接続は既定でRLSをバイパスするため、通常のPublishable key
--  経由の認証済みセッションには一切影響しない。念のための多層防御。)
alter table public.rls_probe_records force row level security;

drop policy if exists rls_probe_records_select_own on public.rls_probe_records;
create policy rls_probe_records_select_own
  on public.rls_probe_records
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists rls_probe_records_insert_own on public.rls_probe_records;
create policy rls_probe_records_insert_own
  on public.rls_probe_records
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists rls_probe_records_update_own on public.rls_probe_records;
create policy rls_probe_records_update_own
  on public.rls_probe_records
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists rls_probe_records_delete_own on public.rls_probe_records;
create policy rls_probe_records_delete_own
  on public.rls_probe_records
  for delete
  to authenticated
  using (user_id = auth.uid());

-- anon(未認証)・public には一切のポリシーを作らない
-- (ポリシーが無ければ、RLS有効なテーブルへは既定で全操作拒否となる)。

-- ----------------------------------------------------------------------------
-- 5. 権限(GRANT) — authenticated だけに必要最小限を付与
-- ----------------------------------------------------------------------------
-- 万一の既定権限(PUBLICへの暗黙付与等)を明示的に取り消してから、
-- 必要な範囲だけを付与し直す(「必要最小限」を実際のGRANT文でも明示する)。
revoke all on public.rls_probe_records from public;
revoke all on public.rls_probe_records from anon;

grant select, insert, update, delete on public.rls_probe_records to authenticated;
-- id/created_atはトリガーとデフォルト値が制御するため、シーケンス権限等は不要
-- (UUID主キーのため、integer主キー用のシーケンス権限も発生しない)。

-- ============================================================================
-- 実行後にSupabaseダッシュボードで確認すること:
--   Table Editor → rls_probe_records が存在する
--   Table Editor → rls_probe_records → RLSが「Enabled」
--   Authentication → Policies → 4種類のポリシー(select/insert/update/delete)
--   いずれのポリシーも対象ロールが authenticated のみで、anon/publicが
--   含まれていないこと
-- ============================================================================
