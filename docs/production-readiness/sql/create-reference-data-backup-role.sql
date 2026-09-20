-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- DOES NOT CREATE OR STORE A PASSWORD
-- DOES NOT GRANT USER-DATA ACCESS
-- ============================================================================
--
-- Backup専用read-only role(reference_data_backup_reader)の作成SQL案。
--
-- このSQLはこのセッションでは実行していない。実行する場合は、本人による独立した
-- 承認(read-only role作成という単独の判断)を経てから、本人が手動でSupabase SQL
-- Editorから実行すること。Claude Code自身はこのSQLを一切実行しない。
--
-- password: このSQLはパスワードを一切生成・設定・保存しない。LOGIN権限だけを
-- 付与し、passwordキーワードに文字列リテラルを続ける構文は使わない。パスワード未設定のロールは、
-- 別途パスワードが設定されるまでパスワード認証でログインできない(=作成した
-- 時点では実質ログイン不能な安全側の状態になる)。パスワードの設定方法は
-- docs/production-readiness/reference-data-production-backup-role-design.md
-- 3章(password方式比較)を参照し、本人が別操作として実施すること。
--
-- user-data access: このSQLは`reference_data`スキーマの対象4テーブルへの
-- SELECTだけを付与する。`reference_data_ops`・`auth`・`public`(利用者テーブル)・
-- Vault・Storageへのいずれのschema usageも一切付与しないため、これらへは
-- 構造的にアクセス不能になる。
-- ============================================================================

-- 1. roleを作成する。LOGINは許可するが、パスワードはこのSQLでは設定しない。
--    NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLSを明示し、
--    将来のPostgreSQLの既定値変更に依存しない。NOINHERITも明示し、将来この
--    roleが誤って別roleのメンバーに追加された場合でも、その別roleの権限を
--    自動的に継承しないようにする。CONNECTION LIMITを2に制限し、Backup処理が
--    同時に多数の接続を張ることを防ぐ。
--
--    意図的に`IF NOT EXISTS`相当の構文を使わない(PostgreSQLの`CREATE ROLE`は
--    そもそも`IF NOT EXISTS`をサポートしない)。同名のroleが既に存在する場合、
--    この文はエラーで停止する。既存roleの設定を黙って上書きすることは一切
--    無く、その場合は実行者が手動で原因を調査すること(既存roleが誰によって
--    いつ作られたものかを確認しないまま、このSQLを再実行しない)。
create role reference_data_backup_reader with
  login
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls
  noinherit
  connection limit 2;

comment on role reference_data_backup_reader is
  'Production reference_data Backup専用のread-only role。対象4テーブルのSELECTだけを許可する。このSQLではパスワードを設定しない。';

-- 2. VALID UNTIL(有効期限)を設定する場合は、本人が運用サイクル(例: 1年ごとの
--    棚卸し)に合わせた具体的な日付へ、このSQLを実行する前に書き換えること。
--    このSQL自体はプレースホルダーのままでは実行できない構文にしていないが、
--    未記入のまま実行すると無期限ロールになるため、本人が意図的に決定すること。
-- alter role reference_data_backup_reader valid until '<本人が決定する具体的な日付、例: 2027-09-20T00:00:00Z>';

-- 3. schemaへのUSAGEを、reference_dataだけに限定して付与する。
--    reference_data_ops・auth・publicへのUSAGEは一切付与しない。
grant usage on schema reference_data to reference_data_backup_reader;

-- 4. 対象4テーブルへSELECTだけを付与する。
--    INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGERはいずれも付与しない。
grant select on table
  reference_data.world_player_cards,
  reference_data.managers,
  reference_data.player_card_analysis,
  reference_data.import_batches
to reference_data_backup_reader;

-- 5. 将来reference_dataスキーマへ追加されるテーブルへ、自動的に権限が
--    付与されないようにする(alter default privilegesは意図的に一切実行しない)。
--    新しいテーブルが追加された場合、Backup対象へ含めるかどうかは本人が
--    個別に判断し、このSQLファイル自体を更新してから改めて承認・実行すること。

-- 6. セッション単位の安全側パラメータを、role自体のデフォルトとして設定する
--    (接続のたびに毎回設定し忘れることを防ぐ)。read-onlyであることを
--    データベース自体にも強制させ、statement/lockのtimeoutで長時間の
--    ロック保持や無応答を防ぐ。search_pathをreference_dataだけに固定し、
--    別スキーマの同名オブジェクトを誤って参照しないようにする。
alter role reference_data_backup_reader set default_transaction_read_only = on;
alter role reference_data_backup_reader set statement_timeout = '120s';
alter role reference_data_backup_reader set lock_timeout = '5s';
alter role reference_data_backup_reader set search_path = reference_data;
