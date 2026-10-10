-- ============================================================================
-- 利用者自身によるアカウントの削除（2026-10-11）— 提案・未適用
-- 適用の手順・Dry run・検証・Rollback・停止の条件: docs/production-readiness/account-deletion-apply-package.md
--
-- public.delete_my_account(confirm text) returns jsonb
--   - 呼び出した本人（auth.uid()）だけを削除する。対象の user ID を引数で受け取らない（他人を指定できない）。
--   - 確認の文字列 'DELETE' が必須（誤操作・誤った呼び出しの防止。画面の確認とは別の、サーバーの確認）。
--   - 最近の認証が必須: JWT の amr（認証の方法と時刻）の最新が 10 分以内。古いセッションのまま削除させない（再認証）。
--   - 課金の接続点: public.billing_subscriptions が存在し、有効な契約があれば拒否（課金の導入まで表は無い）。
--   - 1 つのトランザクション: どこかで失敗すれば何も消えない（部分的な削除を残さない）。
--   - 冪等: 既に削除済みなら { deleted: true, alreadyDeleted: true }（再送・二重の実行・タイムアウトの後の再試行で失敗にしない）。
--   - 削除: 本人の行（存在する表だけ）→ 監査（仮名のハッシュ・件数・時刻だけ）→ auth.users（identities・sessions・
--     refresh tokens は Supabase の外部キーの cascade で消える）。
--   - SECURITY DEFINER・search_path を空にし、すべて修飾した名前で参照する。実行できるのは authenticated だけ。
-- public.account_deletion_audit
--   - メール・名前・user ID を保存しない。subject_hash = sha256('efta-account-deletion:v1:' || user_id) の 16 進。
--     サポートで「この user ID のアカウントは削除済みか」を確かめるためだけに使う。RLS を有効にし、ポリシーなし（利用者からは読めない）。
-- ============================================================================

create table if not exists public.account_deletion_audit (
  id bigint generated always as identity primary key,
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  deleted_at timestamptz not null default now(),
  deleted_counts jsonb not null default '{}'::jsonb,
  providers text[] not null default '{}'
);
alter table public.account_deletion_audit enable row level security;
revoke all on table public.account_deletion_audit from public;
do $$
begin
  if to_regrole('anon') is not null then execute 'revoke all on table public.account_deletion_audit from anon'; end if;
  if to_regrole('authenticated') is not null then execute 'revoke all on table public.account_deletion_audit from authenticated'; end if;
end $$;

create or replace function public.delete_my_account(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  last_auth bigint;
  counts jsonb := '{}'::jsonb;
  provider_list text[] := '{}';
  n bigint;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- 冪等: 既に削除済み（同じ要求の再送・二重の実行・通信が切れた後の再試行）。JWT は期限まで有効なので呼び出しは届く。
  if not exists (select 1 from auth.users where id = uid) then
    return jsonb_build_object('deleted', true, 'alreadyDeleted', true, 'counts', '{}'::jsonb);
  end if;
  if confirm is distinct from 'DELETE' then
    raise exception 'confirmation_required' using errcode = '22023';
  end if;

  -- 再認証: amr = [{"method": "oauth" | "password" | ..., "timestamp": <unix 秒>}]
  select max((e ->> 'timestamp')::bigint) into last_auth
    from jsonb_array_elements(case when jsonb_typeof(claims -> 'amr') = 'array' then claims -> 'amr' else '[]'::jsonb end) as e
    where (e ->> 'timestamp') ~ '^[0-9]{1,12}$';
  if last_auth is null or last_auth < extract(epoch from now())::bigint - 600 then
    raise exception 'reauthentication_required' using errcode = '42501';
  end if;

  -- 課金の接続点（表があるときだけ）
  if to_regclass('public.billing_subscriptions') is not null then
    execute 'select count(*) from public.billing_subscriptions where user_id = $1 and status in (''active'', ''trialing'', ''past_due'', ''unpaid'')'
      into n using uid;
    if n > 0 then
      raise exception 'billing_active' using errcode = 'P0001';
    end if;
  end if;

  if to_regclass('auth.identities') is not null then
    execute 'select coalesce(array_agg(distinct provider order by provider), ''{}'') from auth.identities where user_id = $1'
      into provider_list using uid;
  end if;

  -- 本人の行（Production に適用済み: my_team_snapshots・rls_probe_records。提案中の表は適用された後に自動で対象になる）
  if to_regclass('public.my_team_snapshots') is not null then
    execute 'delete from public.my_team_snapshots where user_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('my_team_snapshots', n);
  end if;
  if to_regclass('public.rls_probe_records') is not null then
    execute 'delete from public.rls_probe_records where user_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('rls_probe_records', n);
  end if;
  if to_regclass('public.photo_posts') is not null then
    -- Storage の画像は SQL では消さない（Supabase は storage.objects の直接の削除を許さない）。画面の側で Storage API から先に消す（apply package §2）。
    execute 'delete from public.photo_posts where user_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('photo_posts', n);
  end if;
  if to_regclass('public.photo_post_audit') is not null then
    -- 投稿の監査は user_id を外部キーなしで持つため、本人の分を消す（削除の後に user ID を残さない）。
    execute 'delete from public.photo_post_audit where user_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('photo_post_audit', n);
  end if;
  if to_regclass('public.user_blocks') is not null then
    execute 'delete from public.user_blocks where blocker_id = $1 or blocked_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('user_blocks', n);
  end if;
  if to_regclass('public.public_id_history') is not null then
    execute 'delete from public.public_id_history where user_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('public_id_history', n);
  end if;
  if to_regclass('public.public_profiles') is not null then
    execute 'delete from public.public_profiles where user_id = $1' using uid;
    get diagnostics n = row_count; counts := counts || jsonb_build_object('public_profiles', n);
  end if;

  insert into public.account_deletion_audit (subject_hash, deleted_counts, providers)
    values (encode(sha256(convert_to('efta-account-deletion:v1:' || uid::text, 'UTF8')), 'hex'), counts, provider_list);

  delete from auth.users where id = uid;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'auth_user_not_deleted' using errcode = 'P0002';
  end if;

  return jsonb_build_object('deleted', true, 'counts', counts);
end;
$$;

revoke all on function public.delete_my_account(text) from public;
do $$
begin
  if to_regrole('anon') is not null then execute 'revoke all on function public.delete_my_account(text) from anon'; end if;
  if to_regrole('authenticated') is not null then execute 'grant execute on function public.delete_my_account(text) to authenticated'; end if;
end $$;
