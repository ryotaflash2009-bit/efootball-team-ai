-- ============================================================================
-- rollback: saved_builds_snapshots(create-builds-cloud-schema.sql)を取り除く — 2026-10-11
-- ============================================================================
-- 注意: 表を消すと、利用者がクラウドに保存した保存ビルドも消える(端末の保存ビルドは消えない)。
-- 先にアプリの BUILDS_CLOUD_MODE を "disabled" に戻してから実行する。
-- 他の表(my_team_snapshots 等)には触れない。複数回実行しても安全。
-- ============================================================================

drop trigger if exists saved_builds_snapshots_guard on public.saved_builds_snapshots;
drop table if exists public.saved_builds_snapshots;
drop function if exists public.saved_builds_snapshots_guard();
