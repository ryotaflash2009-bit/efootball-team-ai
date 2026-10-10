-- rollback: 利用者自身によるアカウントの削除（2026-10-11）— 提案・未適用
-- 関数だけを消す（以後の削除を止める）。監査の表は既定では残す（削除の記録を失わない）。
-- 監査の表も消すのは、まだ 1 件も削除していないと確かめたときだけ（apply package §6）。
revoke all on function public.delete_my_account(text) from public;
drop function if exists public.delete_my_account(text);
-- 次の 1 行は、select count(*) from public.account_deletion_audit が 0 のときだけ実行する:
-- drop table if exists public.account_deletion_audit;
