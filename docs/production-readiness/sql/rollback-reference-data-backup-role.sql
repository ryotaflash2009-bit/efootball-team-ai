-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- ============================================================================
--
-- Backup専用role(reference_data_backup_reader)の緊急停止・失効・削除手順(設計案)。
--
-- このSQLはこのセッションでは実行していない。実行する場合は、本人による独立した
-- 承認を経てから、本人が手動でSupabase SQL Editorから実行すること。
--
-- 実行前提(本人が事前に確認すること):
--   1. このroleを使用するBackup workflow(reference-data-production-backup.yml)が
--      実行中でないこと(GitHub ActionsのRunning状態を確認する)。
--   2. `REFERENCE_DATA_BACKUP_DB_URL` Secretを、このSQLの実行前または直後に
--      GitHub Secretsから削除・更新すること(role停止だけでなくSecret側も
--      同時に対応する)。
--   3. 段階的に実行し、各段階の完了を確認してから次へ進むこと(一括実行しない)。
-- ============================================================================

-- 段階1: 即時ログイン禁止(緊急停止、最も早く効かせられる操作)。
-- password漏洩・鍵漏洩が疑われる場合、まずこれだけを最優先で実行する。
alter role reference_data_backup_reader nologin;

-- 段階2: 稼働中セッションの強制切断(必要な場合だけ)。
-- 自動化しない。Supabase Dashboardの「Database」→「Roles」画面、または
-- 本人が個別にpg_terminate_backend(pid)を対象セッションのpidへ対して
-- 実行するかを判断すること。このSQLファイルには対象pidを特定するクエリを
-- 含めない(pidは実行時点の状態に依存し、事前に決め打ちできないため)。

-- 段階3: 権限の取り消し(roleは残すが、恒久的に権限を剥がす場合)。
revoke select on table
  reference_data.world_player_cards,
  reference_data.managers,
  reference_data.player_card_analysis,
  reference_data.import_batches
from reference_data_backup_reader;

revoke usage on schema reference_data from reference_data_backup_reader;

-- 段階4: role設定(statement_timeout等)のリセット(role削除前のクリーンアップ)。
alter role reference_data_backup_reader reset all;

-- 段階5: role自体の削除。
-- 他のオブジェクト(所有物・依存)が一切残っていないことを事前に確認してから
-- 実行すること。この削除文にCASCADE相当の構文は使わない設計のため、依存が
-- 残っている場合は失敗する(これは意図的な安全側の挙動であり、依存を
-- 無理に削除しない)。
drop role if exists reference_data_backup_reader;
