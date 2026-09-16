-- ============================================================================
-- reference_data.player_card_analysis への efhub_name_en列の追加(前進用migration)
--
-- 目的:
--   SQLite側の分析詳細(getEfhubAnalysisDetailSqlite)は、レガシーのeFHUBスクレイプ由来
--   `player_cards.name_en`を参照している(一部の選手名でダイアクリティカルマークが
--   欠落した表記になっている)。一方Supabase側(analysis-source.ts)は、
--   player_card_analysis自体にname_en相当の列が無いため、`world_player_cards.name_en`
--   (World正規化名、正しい表記)を代わりに参照しており、19件中7件で表記が異なることが
--   実測で確認された。
--
--   ユーザーの明示判断により、どちらの表記が「正しい」かを推測で決定せず、
--   既存SQLiteの表示仕様(player_cards.name_en)を「正」として維持しつつ、
--   Supabase側にも同じ値を保持できる専用フィールドを追加する。
--   通常のWorld選手名(world_player_cards.name_en)とは明確に区別するため、
--   列名を`efhub_name_en`とし、コメントで用途を明記する。
--
-- このファイルで行うこと:
--   - player_card_analysis.efhub_name_en (text) の追加
--   - 空文字を禁止するCHECK制約(NULLは許容: 値投入前の一時的な状態のため)
--
-- このファイルで行わないこと:
--   - world_player_cards.name_en の変更(既存のWorld正規化名はそのまま)
--   - managers・個人データの変更
--   - 既存19件の他の列(positions/player_model等)の変更
--   - RLS/権限の変更(既存のplayer_card_analysis単位GRANT/RLSポリシーがそのまま適用される)
--   - 新規テーブルの作成
--   - 実データの投入(投入は別途、追加差分専用ツールで実施する)
--
-- 冪等性(複数回実行時の挙動): `add column if not exists`は2回目以降も無害に成功する。
--   CHECK制約は`pg_constraint`を参照するDOブロックで存在確認してから追加するため、
--   既に存在する場合は何もしない(ALTER TABLE ADD CONSTRAINT IF NOT EXISTSという構文が
--   実PostgreSQLで安全に使えるかをこのセッションでは確認できなかったため、より確実な
--   存在確認方式を採用した)。COMMENT ON は本質的に上書き(idempotent)であり、
--   何度実行しても安全。
--
-- トランザクション: このファイル全体を明示的なBEGIN/COMMITで囲む。途中で構文エラー等が
--   発生した場合、SQL Editor側の暗黙のトランザクション動作に依存せず、確実に全体が
--   ロールバックされる(以前バージョンで発生した"COMMENT ON ... IS"の構文エラーは、
--   実際には暗黙のロールバックが機能していたことをData API経由の非破壊SELECTで確認済み
--   だが、今後はこの動作を明示的に保証する)。
-- ============================================================================

begin;

alter table reference_data.player_card_analysis
  add column if not exists efhub_name_en text;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_card_analysis_efhub_name_en_not_blank'
      and connamespace = 'reference_data'::regnamespace
  ) then
    alter table reference_data.player_card_analysis
      add constraint player_card_analysis_efhub_name_en_not_blank
      check (efhub_name_en is null or char_length(btrim(efhub_name_en)) > 0);
  end if;
end
$do$;

comment on column reference_data.player_card_analysis.efhub_name_en is
$comment$レガシーのeFHUBスクレイプ由来の選手名(SQLite player_cards.name_enと同じ値)。分析詳細の互換表示専用であり、通常のWorld選手名(world_player_cards.name_en、正規化済み・ダイアクリティカルマーク保持)とは意図的に別の意味を持つ。world_player_cards.name_enと表記が異なる場合があるが、これは既知の仕様であり不具合ではない。差分データ投入前はNULL。$comment$;

commit;

-- ============================================================================
-- 手動確認手順(実行後、Claude Codeが自動確認できない項目):
--
-- 1. Supabase Dashboard → Table Editor → player_card_analysis で
--    efhub_name_en列が追加されていることを目視確認する。
-- 2. 新規列は既存テーブルへの追加のため、Data APIへは追加のGRANT操作なしに
--    既存のSELECT権限(anon, authenticated)がそのまま適用される。
-- 3. 既存の19件の行数・他の列の値に変化が無いことを確認する。
-- ============================================================================
