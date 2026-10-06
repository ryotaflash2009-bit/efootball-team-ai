-- F-053 公開 ID・プロフィールの migration の戻し（2026-10-07・提案）。create-public-profiles-schema.sql で作ったものだけを消す。
-- 注意: 利用者が作った公開 ID・ブロックの行も消える。Production で使う場合は、先に Backup を取ってから。
begin;
drop function if exists public.search_public_profiles(text);
drop trigger if exists public_profiles_guard on public.public_profiles;
drop function if exists public.public_profiles_guard();
drop policy if exists public_profiles_select on public.public_profiles;
drop function if exists public.is_blocked_between(uuid, uuid);
drop table if exists public.user_blocks;
drop table if exists public.public_id_history;
drop table if exists public.public_profiles;
drop function if exists public.public_id_reserved_words();
commit;
