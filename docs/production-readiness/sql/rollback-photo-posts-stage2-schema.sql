-- ============================================================================
-- rollback: photo_posts（F-084 段階 2）— 提案・未適用
-- ============================================================================
-- create-photo-posts-stage2-schema.sql で作ったものだけを取り除く。
-- 注意: 表を消すと投稿と監査ログが失われる。実行前に Backup を取り、本人が承認すること。
-- Storage のオブジェクトは SQL では消さない（Storage API で本人が確認して削除する）。バケットも残す
-- （オブジェクトが残っていると削除できないため）。ポリシーだけを外し、どのロールからも読めない状態にする。
-- ============================================================================

drop policy if exists photo_posts_objects_select_own on storage.objects;
drop policy if exists photo_posts_objects_insert_own on storage.objects;
drop policy if exists photo_posts_objects_delete_own on storage.objects;

drop trigger if exists photo_posts_audit on public.photo_posts;
drop trigger if exists photo_posts_guard on public.photo_posts;
drop function if exists public.photo_posts_audit();
drop function if exists public.photo_posts_guard();

drop table if exists public.photo_post_audit;
drop table if exists public.photo_posts;
