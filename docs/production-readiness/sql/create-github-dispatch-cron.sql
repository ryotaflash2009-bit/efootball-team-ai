-- GitHub Actions の毎時の起動を Supabase（pg_cron + pg_net）から行う（2026-10-25）。
--
-- 背景: GitHub の schedule が間引かれ、「毎時」の検出・暫定のカードの同期が 4〜5 時間に 1 回しか起動していなかった。
-- 本人の判断（2026-10-25「やる」「君ができる範囲は君がして」）で、外部の cron から workflow_dispatch する。
--
-- - 起動の鍵（GitHub の fine-grained token・このリポジトリの Actions: Read and write だけ）は本人が Supabase の Vault に
--   名前 `github_dispatch_token` で保存する。Claude Code は鍵を見ない・扱わない。鍵が無い間は何もしない（no-op）。
-- - 起動できる workflow は下の 2 つだけ（関数の中の許可リスト）。関数は API に出さない schema に置き、anon・authenticated から実行できない。
-- - 参照データ・利用者のデータの表には触れない。
--
-- 元に戻す:
--   select cron.unschedule('teamaixi-provisional-dispatch');
--   select cron.unschedule('teamaixi-detection-dispatch');
--   drop function if exists ops_private.dispatch_github_workflow(text, jsonb);
--   （鍵は Vault から本人が削除。GitHub の token も本人が削除できる）

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists ops_private;
revoke all on schema ops_private from public, anon, authenticated;

create or replace function ops_private.dispatch_github_workflow(workflow text, body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
begin
  if workflow not in ('reference-data-provisional-cards.yml', 'reference-data-update-detection.yml') then
    raise exception 'workflow not allowed: %', workflow;
  end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_dispatch_token' limit 1;
  if tok is null or tok = '' then
    return; -- 鍵がまだ無い（本人の保存の前）・消された
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/ryotaflash2009-bit/efootball-team-ai/actions/workflows/' || workflow || '/dispatches',
    body := body,
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || tok,
      'X-GitHub-Api-Version', '2022-11-28',
      'Content-Type', 'application/json',
      'User-Agent', 'teamaixi-pg-cron'
    ),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function ops_private.dispatch_github_workflow(text, jsonb) from public, anon, authenticated;

-- 暫定のカードの同期: 毎時 52 分（GitHub の schedule の 7 分・37 分と重ならない）
select cron.schedule(
  'teamaixi-provisional-dispatch',
  '52 * * * *',
  $$select ops_private.dispatch_github_workflow('reference-data-provisional-cards.yml', '{"ref":"main"}'::jsonb)$$
);

-- 公式データの検出: 毎時 22 分（World の 429 の待ち時間 55 分は workflow の中で守られる）
select cron.schedule(
  'teamaixi-detection-dispatch',
  '22 * * * *',
  $$select ops_private.dispatch_github_workflow('reference-data-update-detection.yml', '{"ref":"main","inputs":{"confirm":"detect"}}'::jsonb)$$
);
