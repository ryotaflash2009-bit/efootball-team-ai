-- ============================================================================
-- ⚠️ DO NOT RUN ⚠️  DESIGN ONLY  ⚠️  REQUIRES SEPARATE APPROVAL  ⚠️
-- PRODUCTION NOT APPLIED — このSQLは実Supabaseへ一度も実行されていない。
-- ============================================================================
--
-- create-reference-data-ops-schema.sql のロールバック。
--
-- 実行前提(本人が個別に確認すること、このSQL自体はこれを検証・強制しない):
--   1. reference_data_ops schemaが本migration(create-reference-data-ops-schema.sql)
--      専用であり、他の用途で共用されていないことを確認済みであること。
--   2. preflight-reference-data-ops.sqlのread-only inventory(schema内オブジェクト一覧)を
--      事前に実行し、下記で明示的にDROPする10テーブル以外にreference_data_ops内へ
--      オブジェクトが存在しないことを確認済みであること。
--   3. 2で想定外のオブジェクトが1つでも見つかった場合、このSQLを実行せず停止し、
--      その内容を人が確認すること(このSQLは想定外オブジェクトを推測でCASCADE削除しない)。
--
-- 設計方針(CASCADEを一切使用しない):
--   - 対象10テーブルを依存関係の逆順(update_jobsを参照している9テーブルを先に、
--     参照される側のupdate_jobsを最後に)、それぞれschema修飾して個別に明示DROPする。
--   - CASCADEは使用しない。想定外の依存オブジェクト(将来追加されたテーブル・ビュー等が
--     このいずれかを参照していた場合)が存在すれば、対応するDROP TABLE文自体が
--     依存エラーで失敗し、そこで停止する(黙って想定外オブジェクトを削除しない)。
--   - インデックス・CHECK制約・主キー・外部キー制約、および audit_events.id (bigserial)が
--     内部的に作成するシーケンスは、それらが属するテーブル自身をDROPすればPostgreSQLの
--     標準動作として自動的に除去される(CASCADE指定とは無関係の挙動であり、個別の
--     DROP対象として扱わない)。
--   - 最後の`drop schema if exists reference_data_ops;`もCASCADEを付けない。この時点で
--     schema内に上記10テーブル以外の何かが残っていれば、この文自体が失敗して停止する
--     (この失敗自体を、想定外オブジェクト検出の最終防御線として使う)。
--
-- 対象外(このスキーマにそもそも存在しない、かつこのSQLは一切触れない): 利用者データ、
--   reference_data(確定済み参照データ)、public/authスキーマ。
-- ============================================================================

-- 依存関係の逆順: update_jobsを参照している9テーブルを先に個別DROPする
drop table if exists reference_data_ops.approvals;
drop table if exists reference_data_ops.applied_checksums;
drop table if exists reference_data_ops.audit_events;
drop table if exists reference_data_ops.staging_world_player_cards;
drop table if exists reference_data_ops.staging_managers;
drop table if exists reference_data_ops.staging_player_card_analysis;
drop table if exists reference_data_ops.before_snapshots;
drop table if exists reference_data_ops.rollback_jobs;
drop table if exists reference_data_ops.source_metadata_snapshots;

-- 参照される側のupdate_jobsを最後にDROPする(この時点で他の9テーブルは既に存在しない)
drop table if exists reference_data_ops.update_jobs;

-- schema自体の削除はCASCADEなし: 上記10テーブル以外に何か残っていれば、この文が失敗する
drop schema if exists reference_data_ops;
