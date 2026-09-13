-- ============================================================================
-- my_team_snapshots: My Team クラウド保存(手動・任意)専用テーブル(技術検証PoC)
-- ============================================================================
--
-- 目的:
--   利用者が明示的に「クラウドへ保存」を実行したときだけ、My Team
--   (実際に保有しているカードの一覧)のスナップショットを1件、認証済み
--   ユーザー本人のためだけに保存する。ログイン・ページ表示・アプリ起動・
--   セッション復元では絶対に書き込まれない(このテーブルへのINSERT/UPDATEは
--   すべてアプリの明示的なユーザー操作からしか発生しない設計)。
--
--   保存対象は My Team だけ。お気に入り・保存ビルド・保存スカッド・
--   スカッドテンプレート・診断履歴・プロフィールは一切含まない。
--
--   このテーブルの team_data(JSONB)には、My Team を復元するために必要な
--   最小限のフィールドだけを保存する。次のものは絶対に保存しない:
--     メールアドレス・パスワード・内部認証UUIDの重複格納・
--     アクセストークン/リフレッシュトークン/Cookie・
--     Project URL・APIキー全般・DB パスワード・
--     ブラウザーのlocalStorage全体・他機能の保存データ・
--     氏名/学校名/電話番号/住所などの個人情報・端末情報・User-Agent・IPアドレス。
--
-- 保存方式(比較の結論。詳細はStop 1報告を参照):
--   採用: (A) ユーザー1人につきJSONBスナップショット1件(user_idにunique制約)。
--   理由: 既存localStorage形式(MyTeamStore { storageVersion, updatedAt, records[] })
--     とほぼ1対1で対応し、保存/復元が単純・原子的(1行のUPSERTで完結)・
--     RLS設計が最小(unique(user_id)により「本人の行は常に高々1件」)。
--   不採用: (B) カード1件=1行、(C) チーム本体+メンバー分離テーブル。
--     将来「複数チーム」「差分履歴」等が必要になった場合は、本テーブルとは
--     別の新しいテーブル(例: my_team_snapshot_history や my_teams)を追加する
--     形で移行でき、本テーブルの設計自体が将来の移行を妨げるものではない。
--
-- 安全設計の要点(rls_probe_recordsと同じ多層防御方針を踏襲):
--   - user_id はクライアントの入力を一切信用しない。既定値は auth.uid()。
--     未認証(auth.uid() IS NULL)ならNOT NULL制約でINSERT自体が失敗する。
--   - RLSポリシーは "authenticated" ロールにだけ許可する。"anon"(未認証)・
--     "public" には SELECT/INSERT/UPDATE/DELETE のいずれも許可しない。
--   - INSERT/UPDATE には WITH CHECK を必ず設定し、他人のuser_idを指定した
--     作成・更新時の所有者書き換えの両方を拒否する。
--   - user_id にunique制約があるため、アプリはUPSERT(ON CONFLICT (user_id))
--     で保存する。conflict対象の検索・実際のUPDATEの両方にRLSが適用されるため、
--     「他人のuser_idを持つ行を指定して」upsertすることはできない
--     (existingの行を見つける時点でRLSのUSING句が有効であり、
--     新しく挿入する行はWITH CHECK句でuser_id = auth.uid()を要求される)。
--   - トリガーで UPDATE 時の user_id 変更をさらに拒否する(RLSだけに頼らない)。
--   - item_count 列は team_data->'items' の実際の要素数と一致することを
--     CHECK制約でDB側にも強制する(アプリ層の主張を鵜呑みにしない)。
--   - USING (true) / WITH CHECK (true) のような無条件許可は一切使わない。
--   - 管理者専用の特権ロールやAPIキーは前提にしない。
--
-- 冪等性: このファイルは複数回実行しても安全(IF NOT EXISTS / OR REPLACE /
--   DROP ... IF EXISTS を使用)。
--
-- 影響範囲: public スキーマのみ。auth.users は外部キーとして参照するだけで
--   一切変更しない。rls_probe_records には一切影響しない。
--
-- ロールバック: rollback-my-team-cloud-schema.sql を参照。
-- ============================================================================

-- gen_random_uuid() を確実に使えるようにする(既に有効なら何もしない)。
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. テーブル本体
-- ----------------------------------------------------------------------------
-- client_updated_at はクライアント(ブラウザー)が報告するローカルMy Teamの
-- 更新日時である。信頼境界の明示: この値は「表示用の参考情報」としてのみ扱い、
-- 所有者判定・アクセス制御・「どちらが新しいか」の自動判定には一切使わない
-- (クライアントの時計は改ざん・誤動作しうるため)。所有者判定は常にRLS
-- (auth.uid())だけで行う。
create table if not exists public.my_team_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schema_version text not null,
  team_data jsonb not null,
  item_count integer not null,
  payload_hash text not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint my_team_snapshots_user_id_unique unique (user_id),
  constraint my_team_snapshots_schema_version_not_blank check (char_length(btrim(schema_version)) > 0),
  constraint my_team_snapshots_schema_version_length check (char_length(schema_version) <= 100),
  -- 初期PoCの安全な上限。実運用のMy Team件数を圧迫しない範囲で、
  -- 異常に巨大なペイロードだけを拒否する(詳細はStop 1報告の上限根拠を参照)。
  constraint my_team_snapshots_item_count_range check (item_count >= 0 and item_count <= 1000),
  -- SHA-256(16進64桁)以外の値を拒否する(想定外の形式のhashを保存させない)。
  constraint my_team_snapshots_payload_hash_format check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint my_team_snapshots_team_data_is_object check (jsonb_typeof(team_data) = 'object'),
  -- coalesce(...,'') により、items キーが存在しない場合(jsonb_typeofがNULLを返す)も
  -- 「NULLは制約を満たす」というCHECK制約の既定動作を回避し、確実に拒否する。
  constraint my_team_snapshots_items_is_array check (coalesce(jsonb_typeof(team_data -> 'items'), '') = 'array'),
  -- アプリが主張するitem_countと、実際のJSONB配列長が一致することをDB側でも強制する
  -- (アプリ層のバリデーションだけに依存しない多層防御)。
  constraint my_team_snapshots_item_count_matches check (item_count = jsonb_array_length(team_data -> 'items'))
);

comment on table public.my_team_snapshots is
  'My Teamクラウド保存(手動・任意)PoC専用テーブル。ユーザー1人につき最大1行。明示的な「クラウドへ保存」操作からのみ書き込まれる。';

-- ----------------------------------------------------------------------------
-- 2. updated_at自動更新 + user_id書き換え禁止 + created_at固定トリガー
-- ----------------------------------------------------------------------------
create or replace function public.my_team_snapshots_guard()
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
      raise exception 'my_team_snapshots.user_id cannot be changed after creation';
    end if;
    new.created_at = old.created_at;
    new.updated_at = now();
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists my_team_snapshots_guard on public.my_team_snapshots;
create trigger my_team_snapshots_guard
  before insert or update on public.my_team_snapshots
  for each row
  execute function public.my_team_snapshots_guard();

-- ----------------------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.my_team_snapshots enable row level security;
alter table public.my_team_snapshots force row level security;

drop policy if exists my_team_snapshots_select_own on public.my_team_snapshots;
create policy my_team_snapshots_select_own
  on public.my_team_snapshots
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists my_team_snapshots_insert_own on public.my_team_snapshots;
create policy my_team_snapshots_insert_own
  on public.my_team_snapshots
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists my_team_snapshots_update_own on public.my_team_snapshots;
create policy my_team_snapshots_update_own
  on public.my_team_snapshots
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists my_team_snapshots_delete_own on public.my_team_snapshots;
create policy my_team_snapshots_delete_own
  on public.my_team_snapshots
  for delete
  to authenticated
  using (user_id = auth.uid());

-- anon(未認証)・public には一切のポリシーを作らない
-- (ポリシーが無ければ、RLS有効なテーブルへは既定で全操作拒否となる)。

-- ----------------------------------------------------------------------------
-- 4. 権限(GRANT) — authenticated だけに必要最小限を付与
-- ----------------------------------------------------------------------------
revoke all on public.my_team_snapshots from public;
revoke all on public.my_team_snapshots from anon;

grant select, insert, update, delete on public.my_team_snapshots to authenticated;

-- ============================================================================
-- 実行後にSupabaseダッシュボードで確認すること:
--   Table Editor → my_team_snapshots が存在する
--   Table Editor → my_team_snapshots → RLSが「Enabled」
--   Authentication → Policies → 4種類のポリシー(select/insert/update/delete)
--   いずれのポリシーも対象ロールが authenticated のみで、anon/publicが
--   含まれていないこと
--   rls_probe_records に影響が無いこと(件数・ポリシーとも変化なし)
-- ============================================================================
