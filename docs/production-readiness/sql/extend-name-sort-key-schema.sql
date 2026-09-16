-- ============================================================================
-- reference_data.world_player_cards / reference_data.managers への
-- name_sort_key列の追加(前進用migration)
--
-- 目的:
--   SQLite側の一覧・監督一覧の「name」系ソートは`name_en COLLATE NOCASE`を使っている。
--   Supabase(PostgreSQL)側は`name_en`列自体に既定の(ロケール依存の)照合順序しか
--   持たないため、ダイアクリティカルマーク付きの名前(例: "Aarón", "Ståle Solbakken")で
--   SQLiteと異なる並び順になることが実測で確認された(値・件数は完全一致、順序のみが
--   異なる)。
--
--   この列は、SQLiteの`COLLATE NOCASE`(ASCIIの大文字だけを小文字へ畳み込み、それ以外は
--   一切変更しない仕様)と同じ規則で事前計算した文字列を保持し、"C"照合順序
--   (常にバイト単位比較、DBのロケール設定に依存しない)を明示的に指定する。
--   これにより`ORDER BY name_sort_key`だけで、SQLite側と完全に同じ並び順を
--   DB側のインデックス付きソート・ページングを維持したまま再現できる
--   (アプリ側で全件取得して並べ替える方式は採用しない)。
--
--   name_sort_keyの値そのものは、JavaScript側の純関数
--   `src/lib/reference-data/name-sort-key.ts`の`computeNameSortKey`で計算し、
--   実データ13,009件・66件全件でSQLiteのライブクエリ結果と完全一致することを
--   ローカルで検証済み(scripts/migration/phase-d-remediation-dry-run.mjsのdry-run結果を参照)。
--
-- このファイルで行うこと:
--   - world_player_cards.name_sort_key (text, COLLATE "C") の追加
--   - managers.name_sort_key (text, COLLATE "C") の追加
--   - 空文字を禁止するCHECK制約(NULLは許容: 値投入前の一時的な状態のため)
--   - ORDER BY性能のための最小限のインデックス追加
--
-- このファイルで行わないこと:
--   - 既存の13,009件・66件のデータ変更(ADD COLUMNはメタデータのみの変更)
--   - name_en列自体の変更・削除
--   - RLS/権限の変更(既存のテーブル単位GRANT/RLSポリシーがそのまま適用される)
--   - 新規テーブルの作成
--   - 実データの投入(投入は別途、追加差分専用ツールで実施する)
--
-- 冪等性(複数回実行時の挙動): `add column if not exists`と`create index if not exists`は
--   2回目以降も無害に成功する(既に存在する場合は何もしない)。CHECK制約は`pg_constraint`を
--   参照するDOブロックで存在確認してから追加するため、既に存在する場合は何もしない
--   (ALTER TABLE ADD CONSTRAINT IF NOT EXISTSという構文が実PostgreSQLで安全に使えるかを
--   このセッションでは確認できなかったため、より確実な存在確認方式を採用した)。
--   COMMENT ON は本質的に上書き(idempotent)であり、何度実行しても安全。
--
-- トランザクション: このファイル全体を明示的なBEGIN/COMMITで囲む。途中で構文エラー等が
--   発生した場合、SQL Editor側の暗黙のトランザクション動作に依存せず、確実に全体が
--   ロールバックされる。
-- ============================================================================

begin;

alter table reference_data.world_player_cards
  add column if not exists name_sort_key text collate "C";

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'world_player_cards_name_sort_key_not_blank'
      and connamespace = 'reference_data'::regnamespace
  ) then
    alter table reference_data.world_player_cards
      add constraint world_player_cards_name_sort_key_not_blank
      check (name_sort_key is null or char_length(name_sort_key) > 0);
  end if;
end
$do$;

comment on column reference_data.world_player_cards.name_sort_key is
$comment$SQLiteのORDER BY name_en COLLATE NOCASEと同じ並び順を再現するための事前計算済みソートキー。"C"照合順序(バイト単位比較)を明示指定しているため、ORDER BY name_sort_keyだけでSQLite側と一致する順序になる。表示用のname_enとは別物で、そのまま画面へ表示しないこと。差分データ投入前はNULL。$comment$;

create index if not exists world_player_cards_name_sort_key_idx
  on reference_data.world_player_cards (name_sort_key);

alter table reference_data.managers
  add column if not exists name_sort_key text collate "C";

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'managers_name_sort_key_not_blank'
      and connamespace = 'reference_data'::regnamespace
  ) then
    alter table reference_data.managers
      add constraint managers_name_sort_key_not_blank
      check (name_sort_key is null or char_length(name_sort_key) > 0);
  end if;
end
$do$;

comment on column reference_data.managers.name_sort_key is
$comment$SQLiteのORDER BY name_en COLLATE NOCASEと同じ並び順を再現するための事前計算済みソートキー(world_player_cards.name_sort_keyと同じ設計・同じ計算方法)。差分データ投入前はNULL。$comment$;

create index if not exists managers_name_sort_key_idx
  on reference_data.managers (name_sort_key);

commit;

-- ============================================================================
-- 手動確認手順(実行後、Claude Codeが自動確認できない項目):
--
-- 1. Supabase Dashboard → Table Editor → world_player_cards / managers で
--    name_sort_key列が追加されていることを目視確認する。
-- 2. 新規列は既存テーブルへの追加のため、Data APIへは追加のGRANT操作なしに
--    既存のSELECT権限(anon, authenticated)がそのまま適用される
--    (「Automatically expose new tables」設定は新規テーブルではないため無関係)。
-- 3. 既存の13,009件・66件の行数・他の列の値に変化が無いことを確認する。
-- ============================================================================
