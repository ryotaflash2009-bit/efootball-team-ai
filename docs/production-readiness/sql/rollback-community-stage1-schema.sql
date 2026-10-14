-- コミュニティ 第 1 段階の戻し（create-community-stage1-schema.sql の逆）。
-- 友達・ミュート・通報・比較の要約・上限の記録の行は消える（戻す前に必要なら運営者が通報を書き出す）。
-- 公開 ID（public_profiles）は残す。link / friends の公開範囲は private に戻す。

begin;

drop view if exists public.community_report_queue;

drop function if exists public.community_my_profile();
drop function if exists public.community_save_my_profile(text, text, text);
drop function if exists public.community_get_profile(text);
drop function if exists public.community_search(text);
drop function if exists public.community_request_friend(text);
drop function if exists public.community_respond_friend(text, boolean);
drop function if exists public.community_remove_friend(text);
drop function if exists public.community_list_friends();
drop function if exists public.community_block(text);
drop function if exists public.community_unblock(text);
drop function if exists public.community_mute(text);
drop function if exists public.community_unmute(text);
drop function if exists public.community_list_safety();
drop function if exists public.community_report(text, text, text);
drop function if exists public.community_list_my_reports();
drop function if exists public.community_withdraw_report(bigint);
drop function if exists public.community_set_comparison(jsonb);
drop function if exists public.community_clear_comparison();
drop function if exists public.community_get_comparison(text);
drop function if exists public.community_moderate_report(bigint, text, text, boolean);
drop function if exists public.community_lift_restriction(text);
drop function if exists public.community_purge_old_reports();
drop function if exists public.community_require_own_profile(uuid);
drop function if exists public.community_take_rate(uuid, text, integer);
drop function if exists public.community_can_view(uuid, uuid);
drop function if exists public.community_relation(uuid, uuid);
drop function if exists public.community_uid_of(text);
drop function if exists public.community_me();

drop table if exists public.comparison_summaries;
drop table if exists public.community_rate_events;
drop table if exists public.community_reports;
drop table if exists public.friendships;
drop table if exists public.user_mutes;

update public.public_profiles set visibility = 'private' where visibility in ('link', 'friends');
alter table public.public_profiles drop constraint if exists public_profiles_visibility;
alter table public.public_profiles add constraint public_profiles_visibility check (visibility in ('private', 'public'));
drop policy if exists public_profiles_select on public.public_profiles;
alter table public.public_profiles drop column if exists restricted_at;
create policy public_profiles_select on public.public_profiles for select to authenticated using (
  user_id = auth.uid()
  or (
    visibility = 'public' and deleted_at is null
    and not public.is_blocked_between(auth.uid(), public_profiles.user_id)
  )
);
grant select, insert, delete on public.user_blocks to authenticated;

commit;
