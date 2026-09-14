-- ============================================================================
-- reference_data: 参照データ(選手カード・監督・分析補助データ)専用スキーマ
-- ============================================================================
--
-- 目的:
--   選手カード(World)・監督・選手カード分析補助データという、全ユーザー共通の
--   読み取り専用ゲームデータを、ユーザー個人データ(public.my_team_snapshots等)
--   とは完全に別のスキーマへ配置する。
--
--   本スキーマには、ユーザーの氏名・メールアドレス・UUID・Token・Cookie・
--   支払い情報等は一切保存しない。保存するのは選手・監督のゲーム内データ
--   (能力値・所属・画像URLなど)と、その取得・投入管理に必要なメタ情報のみ。
--
-- 対象データ(2026-09-14時点、正本 data/efootball.db の実測件数):
--   - world_player_cards        13,009件(選手カード本体)
--   - managers                     66件(監督)
--   - player_card_analysis         19件(選手カード分析補助。World 13,009件のうち
--                                        eFHUB個別ページ由来の19件だけに存在する
--                                        追加情報。src/lib/world/analysis-repository.ts
--                                        が参照し、/players/world/[worldCardId] から
--                                        呼び出される現役の補助データ)
--
--   player_index_entries(47,479件、簡易検索索引)は本スキーマへは投入しない。
--   件数が多く更新頻度も異なるため、サーバー内の分割静的アセットとして別管理する
--   (設計は reference-data-hybrid-migration-design.md 8章、
--   docs/production-readiness/reference-data-migration-poc-results.md 参照)。
--
--   player_booster_definitions(44件)も本スキーマへは投入しない。
--   真の出所は src/lib/progression/booster-catalog.ts(コード内定義)であり、
--   二重正本を避けるためコード内定義を正本のまま維持する。
--
-- 権限モデル(このファイル全体の要点):
--   - anon(未認証)・authenticated(認証済み)とも SELECT のみ許可。
--   - INSERT/UPDATE/DELETE/TRUNCATE はいずれのロールにも許可しない
--     (ポリシーを作らない、GRANTしない、の二重の拒否)。
--   - 更新は本ファイルの対象外の管理用経路(Supabase管理コンソールの特権資格情報・
--     ローカルの移行ツール経由のみ)で行う。その特権資格情報はNext.js
--     クライアントアプリへは一切含めない(vercel-owner-actions-checklist.md参照)。
--   - GRANT ALL は使用しない。必要最小限(USAGE・SELECT)だけを付与する。
--
-- 冪等性: このファイルは複数回実行しても安全(IF NOT EXISTS / OR REPLACE /
--   DROP ... IF EXISTS を使用)。
--
-- 影響範囲: reference_data スキーマのみ。public スキーマ(my_team_snapshots・
--   rls_probe_records・auth.users等)には一切影響しない。
--
-- ロールバック: rollback-reference-data-schema.sql を参照。
--
-- 実行前提: このファイルはまだ実Supabaseへ実行していない(監査可能なDDLとして
--   作成したのみ)。実行する場合も、まずステージング/PreviewのSupabase
--   プロジェクトで実行し、Table Editor・Policies画面での確認を経ること。
-- ============================================================================

-- 既存スキーマの安全確認: 同名スキーマが既に存在する場合は何もしない
-- (CREATE SCHEMA IF NOT EXISTS は既存オブジェクトを変更しないため、
--  誤って別用途の既存 reference_data スキーマを上書きする心配はない)。
create schema if not exists reference_data;

comment on schema reference_data is
  '全ユーザー共通の読み取り専用参照データ(選手カード・監督等)専用スキーマ。ユーザー個人データは一切含まない。';

-- ----------------------------------------------------------------------------
-- 0. 投入バッチ管理(dataset_version・provenance・ロールバック用)
-- ----------------------------------------------------------------------------
-- 1回の「取得→検証→投入」を1バッチとして記録する。各データテーブルの行は
-- どのバッチで投入されたかを import_batch_id で追跡できる。
create table if not exists reference_data.import_batches (
  batch_id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  target_table text not null,
  source text not null,
  source_row_count integer not null check (source_row_count >= 0),
  inserted_row_count integer not null default 0 check (inserted_row_count >= 0),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rolled_back')),
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  rolled_back_at timestamptz,
  constraint import_batches_dataset_version_not_blank check (char_length(btrim(dataset_version)) > 0),
  constraint import_batches_target_table_not_blank check (char_length(btrim(target_table)) > 0),
  constraint import_batches_source_not_blank check (char_length(btrim(source)) > 0)
);

comment on table reference_data.import_batches is
  '参照データの投入バッチ管理。1回の取得・検証・投入サイクルにつき1行。ロールバック・監査の単位。';

create index if not exists import_batches_target_table_idx
  on reference_data.import_batches (target_table, created_at desc);

-- ----------------------------------------------------------------------------
-- 1. world_player_cards(選手カード本体、13,009件)
-- ----------------------------------------------------------------------------
-- 検索・絞り込み・並べ替えに使う列は正規化カラムとして保持する
-- (巨大JSONBへ閉じ込めない)。26能力値(stats)は常に1件まとめて取得する
-- アクセスパターンのため JSONB、スキル一覧(skills)は単純な文字列配列のため
-- text[] とし、能力値ごとに別テーブルへ過剰分解しない。
create table if not exists reference_data.world_player_cards (
  world_card_id text primary key check (world_card_id ~ '^[0-9]{1,20}$'),
  name_en text not null,
  name_ja text,
  card_type text,
  registered_position text,
  nationality text,
  region text,
  league text,
  team text,
  ovr_base integer check (ovr_base is null or (ovr_base >= 0 and ovr_base <= 130)),
  ovr_max integer check (ovr_max is null or (ovr_max >= 0 and ovr_max <= 130)),
  maximum_level integer check (maximum_level is null or maximum_level >= 0),
  card_rating text,
  playing_style text,
  playing_style_def text,
  preferred_foot text,
  age integer check (age is null or age >= 0),
  height integer check (height is null or height >= 0),
  weight integer check (weight is null or weight >= 0),
  image_url text,
  mobile_image_url text,
  boost1 text,
  boost2 text,
  -- 26能力値。キーは src/lib/world/db.mjs の WORLD_STAT_KEYS と一致させる。
  -- 例: {"offensiveAwareness": 80, "ballControl": 85, ...}
  stats jsonb not null default '{}'::jsonb,
  skills text[] not null default '{}',
  -- provenance(取得元・取得日時・データセット版)
  source text not null default 'efootball-world.com',
  source_url text,
  appearance_updated_at timestamptz,
  fetched_at timestamptz not null,
  dataset_version text not null,
  import_batch_id uuid references reference_data.import_batches (batch_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_player_cards_name_en_not_blank check (char_length(btrim(name_en)) > 0),
  constraint world_player_cards_dataset_version_not_blank check (char_length(btrim(dataset_version)) > 0),
  constraint world_player_cards_stats_is_object check (jsonb_typeof(stats) = 'object')
);

comment on table reference_data.world_player_cards is
  '選手カード本体(World由来、読み取り専用の全ユーザー共通参照データ)。クライアントからの書込みは不可。';

-- 検索・絞り込み・並べ替え用の索引
create index if not exists world_player_cards_position_idx
  on reference_data.world_player_cards (registered_position);
create index if not exists world_player_cards_ovr_max_idx
  on reference_data.world_player_cards (ovr_max desc);
create index if not exists world_player_cards_team_idx
  on reference_data.world_player_cards (team);
create index if not exists world_player_cards_league_idx
  on reference_data.world_player_cards (league);
create index if not exists world_player_cards_card_type_idx
  on reference_data.world_player_cards (card_type);
-- 名前の部分一致検索(日本語・英語とも)用の簡易全文検索索引
create index if not exists world_player_cards_name_search_idx
  on reference_data.world_player_cards
  using gin (to_tsvector('simple', coalesce(name_en, '') || ' ' || coalesce(name_ja, '')));

-- ----------------------------------------------------------------------------
-- 2. managers(監督、66件)
-- ----------------------------------------------------------------------------
create table if not exists reference_data.managers (
  internal_manager_id integer primary key,
  source text not null,
  source_manager_id text not null,
  name_en text not null,
  name_ja text,
  team_name text,
  nationality text,
  age integer check (age is null or age >= 0),
  released_at text,
  -- 6戦術適性(-99..+99程度の増減値。既存SQLiteのINTEGER列をそのまま踏襲)
  possession_game integer,
  quick_counter integer,
  long_ball_counter integer,
  out_wide integer,
  long_ball integer,
  overload integer,
  manager_rating text,
  coaching_affinity text,
  formation text,
  has_booster boolean not null default false,
  has_link_up_play boolean not null default false,
  booster_confirmation text,
  source_url text,
  fetched_at timestamptz not null,
  dataset_version text not null,
  import_batch_id uuid references reference_data.import_batches (batch_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managers_name_en_not_blank check (char_length(btrim(name_en)) > 0),
  constraint managers_source_not_blank check (char_length(btrim(source)) > 0),
  constraint managers_dataset_version_not_blank check (char_length(btrim(dataset_version)) > 0)
);

comment on table reference_data.managers is
  '監督データ(読み取り専用の全ユーザー共通参照データ)。写真は保持しない(既存の非表示方針を踏襲)。クライアントからの書込みは不可。';

create index if not exists managers_name_search_idx
  on reference_data.managers
  using gin (to_tsvector('simple', coalesce(name_en, '') || ' ' || coalesce(name_ja, '')));
create index if not exists managers_has_link_up_play_idx
  on reference_data.managers (has_link_up_play);

-- ----------------------------------------------------------------------------
-- 3. player_card_analysis(選手カード分析補助データ、19件)
-- ----------------------------------------------------------------------------
-- world_player_cards のうち、eFHUB個別ページ由来の19件だけに存在する追加情報
-- (プレーヤーモデル・ポジション適性・COMスキル・player_skills・逆足/フォーム/
-- コンディション/怪我耐性)。件数が少なく常に1件まとめて取得するため、
-- ポジション適性・スキル一覧は正規化テーブルへ分解せず JSONB/text[] とする
-- (元のSQLiteでは player_card_positions/player_card_com_skills/
-- player_card_skills の3テーブルに分解されていたが、19件×数行という規模では
-- 過剰な分解と判断し、本スキーマでは1テーブルへ統合する)。
create table if not exists reference_data.player_card_analysis (
  world_card_id text primary key references reference_data.world_player_cards (world_card_id) on delete cascade,
  weak_foot_usage integer,
  weak_foot_accuracy integer,
  form integer,
  condition_value integer,
  injury_resistance integer,
  -- 例: {"armLength": 2, "shoulderWidth": 4, ...}
  player_model jsonb not null default '{}'::jsonb,
  -- 例: [{"code": "CF", "familiarity": 2, "isRegistered": true}, ...]
  positions jsonb not null default '[]'::jsonb,
  com_skills text[] not null default '{}',
  player_skills text[] not null default '{}',
  source text not null default 'efhub',
  source_url text,
  fetched_at timestamptz not null,
  dataset_version text not null,
  import_batch_id uuid references reference_data.import_batches (batch_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_card_analysis_player_model_is_object check (jsonb_typeof(player_model) = 'object'),
  constraint player_card_analysis_positions_is_array check (jsonb_typeof(positions) = 'array'),
  constraint player_card_analysis_dataset_version_not_blank check (char_length(btrim(dataset_version)) > 0)
);

comment on table reference_data.player_card_analysis is
  'World選手カードの分析補助データ(eFHUB個別ページ由来の19件のみ)。world_player_cardsに存在しないIDへは外部キー制約でINSERTできない。クライアントからの書込みは不可。';

-- ----------------------------------------------------------------------------
-- 4. updated_at自動更新トリガー(3テーブル共通)
-- ----------------------------------------------------------------------------
create or replace function reference_data.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists world_player_cards_touch_updated_at on reference_data.world_player_cards;
create trigger world_player_cards_touch_updated_at
  before update on reference_data.world_player_cards
  for each row
  execute function reference_data.touch_updated_at();

drop trigger if exists managers_touch_updated_at on reference_data.managers;
create trigger managers_touch_updated_at
  before update on reference_data.managers
  for each row
  execute function reference_data.touch_updated_at();

drop trigger if exists player_card_analysis_touch_updated_at on reference_data.player_card_analysis;
create trigger player_card_analysis_touch_updated_at
  before update on reference_data.player_card_analysis
  for each row
  execute function reference_data.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security — 方式A(RLS有効 + SELECTポリシーのみ)を採用
-- ----------------------------------------------------------------------------
-- 採用理由(reference-data-hybrid-migration-design.md 5章の比較結論):
--   このプロジェクトの既存テーブル(my_team_snapshots・rls_probe_records)は
--   いずれもRLSを多層防御の中心に据えており、Supabase自身もRLS無効の
--   公開テーブルにセキュリティ警告を出す設計になっている。参照データは
--   「全員が読める」という点で個人データ用RLSとは目的が異なるが、
--   「書込みは一切許可しない」という制約自体はRLSポリシーとGRANTの両方で
--   二重に表現でき、実装の単純さ・プロジェクト内の一貫性の両面で最も優れる。
--   個人データ用の user_id = auth.uid() のような行単位の条件は使わない
--   (参照データはそもそも「行の所有者」という概念を持たない)。
alter table reference_data.world_player_cards enable row level security;
alter table reference_data.world_player_cards force row level security;
alter table reference_data.managers enable row level security;
alter table reference_data.managers force row level security;
alter table reference_data.player_card_analysis enable row level security;
alter table reference_data.player_card_analysis force row level security;
-- import_batches は投入管理用の内部テーブルであり、通常のアプリからは
-- 一切参照させない(anon/authenticatedへのGRANTを行わない。8章参照)。
alter table reference_data.import_batches enable row level security;
alter table reference_data.import_batches force row level security;
-- import_batches にはSELECTポリシーも作らない
-- (ポリシーが無ければRLS有効テーブルは既定で全操作拒否となる)。

drop policy if exists world_player_cards_select_all on reference_data.world_player_cards;
create policy world_player_cards_select_all
  on reference_data.world_player_cards
  for select
  to anon, authenticated
  using (true);

drop policy if exists managers_select_all on reference_data.managers;
create policy managers_select_all
  on reference_data.managers
  for select
  to anon, authenticated
  using (true);

drop policy if exists player_card_analysis_select_all on reference_data.player_card_analysis;
create policy player_card_analysis_select_all
  on reference_data.player_card_analysis
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETEポリシーはいずれのテーブルにも作らない
-- (anon/authenticatedからの書込みは、ポリシー不在により既定で拒否される)。

-- ----------------------------------------------------------------------------
-- 6. 権限(GRANT) — 必要最小限。GRANT ALL は使用しない
-- ----------------------------------------------------------------------------
revoke all on schema reference_data from public;
revoke all on all tables in schema reference_data from public;

grant usage on schema reference_data to anon, authenticated;

grant select on reference_data.world_player_cards to anon, authenticated;
grant select on reference_data.managers to anon, authenticated;
grant select on reference_data.player_card_analysis to anon, authenticated;
-- import_batches はGRANTしない(anon/authenticatedからは見えない・触れない)。

-- 将来のテーブル追加時に既定権限が誤って広くならないよう、既定権限も
-- SELECTのみに限定しておく(REVOKE ALLしてからGRANT SELECTのみ、を既定化)。
alter default privileges in schema reference_data
  revoke all on tables from public;
alter default privileges in schema reference_data
  grant select on tables to anon, authenticated;

-- sequence・function・routineへの権限は付与しない
-- (gen_random_uuid()はpublicスキーマの拡張機能を素の関数呼び出しとして
-- 使うだけであり、reference_dataスキーマ独自のsequence/functionを
-- anon/authenticatedへ公開する必要はない)。

-- ============================================================================
-- 実行後にSupabaseダッシュボードで確認すること(実行する場合):
--   Table Editor → reference_data スキーマに4テーブルが存在する
--     (world_player_cards, managers, player_card_analysis, import_batches)
--   Table Editor → 各テーブル → RLSが「Enabled」
--   Authentication → Policies → world_player_cards/managers/player_card_analysis
--     に SELECT ポリシーが1つずつ(対象ロール anon, authenticated)、
--     INSERT/UPDATE/DELETEポリシーが存在しないこと
--   Authentication → Policies → import_batches にポリシーが存在しないこと
--   Database → Roles → anon/authenticatedがreference_dataスキーマの
--     SELECT権限だけを持つこと(INSERT/UPDATE/DELETEを持たないこと)
--   public.my_team_snapshots・public.rls_probe_records・auth.usersに
--     影響が無いこと(件数・ポリシーとも変化なし)
--
--   Data APIから reference_data.world_player_cards 等を直接読みたい場合は、
--   Supabaseダッシュボードの Project Settings → API → Exposed schemas へ
--   reference_data を追加する操作が別途必要になる(このSQL自体はその設定を
--   変更しない)。詳細は reference-data-hybrid-migration-design.md 6章、
--   および完了報告の「Exposed schemas要否」の項目を参照。
-- ============================================================================
