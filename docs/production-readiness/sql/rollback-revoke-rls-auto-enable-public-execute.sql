-- ============================================================================
-- rls_auto_enable() EXECUTE権限REVOKEのロールバック
-- ============================================================================
--
-- 復元根拠(推測ではなく実測、2026-09-18):
--   revoke-rls-auto-enable-public-execute.sql を実行する直前に、Supabase
--   Dashboard SQL Editorでの読み取り専用メタデータ確認により、
--   public.rls_auto_enable() のEXECUTE権限は次の状態であることを確定した。
--     PUBLIC: EXECUTE
--     postgres: EXECUTE
--     anon: 個別GRANTなし(PUBLIC経由の継承のみ)
--     authenticated: 個別GRANTなし(PUBLIC経由の継承のみ)
--
--   revoke-rls-auto-enable-public-execute.sql はPUBLICからのEXECUTEのみを
--   REVOKEしたため、本ロールバックはPUBLICへEXECUTEを再GRANTするだけで、
--   実行前に確認済みだった状態(PUBLIC/postgresがEXECUTE可能、anon/
--   authenticatedはPUBLIC経由でのみ実行可能)へ正確に戻る。
--
--   anon・authenticatedへの個別GRANT文は、実行前の実測状態にそれらの個別GRANTが
--   存在しなかったため含めない(含めるとロールバックが実行前の状態と一致しなく
--   なるため、あえて含めないことが正確な復元条件である)。
--
-- 影響範囲: public.rls_auto_enable() 関数のPUBLICに対するEXECUTE権限のみ。
--   関数本体・所有者・search_path・Event Trigger(ensure_rls)は一切変更しない。
-- ============================================================================

begin;

grant execute on function public.rls_auto_enable() to public;

commit;

-- ============================================================================
-- 実行後に確認すること:
--   information_schema.routine_privileges で public.rls_auto_enable() の
--   PUBLICへのEXECUTE権限が復元されていること
--   ensure_rls Event Triggerが引き続きenabledであること
--   Security Advisorの該当2警告が再度表示される可能性があること
--     (本ロールバックは実行前の実測状態へ戻すものであり、Advisor警告が
--     再表示されることは想定どおりの挙動である)
-- ============================================================================
