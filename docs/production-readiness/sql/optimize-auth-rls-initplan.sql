-- ============================================================================
-- Auth RLS Initialization Plan 最適化(Supabase Performance Advisor対応)
-- ============================================================================
--
-- 対象警告(Supabase Performance Advisor、8件):
--   public.rls_probe_records の4ポリシー(select/insert/update/delete)
--   public.my_team_snapshots の4ポリシー(select/insert/update/delete)
--
-- 警告の意味:
--   RLSポリシーのUSING/WITH CHECK句内で`auth.uid()`を直接呼び出すと、
--   PostgreSQLのプランナーが行ごとに再評価しうる(STABLE関数だが、行フィルター式の
--   一部として毎行評価される経路になりうる)。`auth.uid()`を`(select auth.uid())`
--   というスカラーサブクエリで包むと、PostgreSQLのプランナーがInitPlanとして
--   クエリ全体で1回だけ評価するよう最適化できる余地が生まれる
--   (Supabase公式のPerformance Advisorルール`auth_rls_initplan`が推奨する、
--   広く文書化されたパターン)。
--
-- 意味的な等価性(重要、推測ではなく`auth.uid()`の定義に基づく事実):
--   `auth.uid()`はSTABLE関数(同一トランザクション内で同じ引数に対し常に同じ値を返す)
--   であり、引数を取らない。`(select auth.uid())`というスカラーサブクエリで包んでも、
--   返す値は`auth.uid()`単体呼び出しと完全に同じ(NULLの場合も含めて同一)。
--   したがって、本SQLはUSING/WITH CHECK句の「認可条件の意味」を一切変更しない。
--   これは純粋な性能最適化であり、認可ロジックの変更ではない。
--
-- 変更しないもの:
--   - ポリシー名(8件とも既存の名前を維持、DROP/CREATEではなくALTER POLICYを使う)
--   - 対象ロール(authenticatedのまま、TO句を省略することで既存のロール指定を保持)
--   - command種別(SELECT/INSERT/UPDATE/DELETE、ALTER POLICYでは変更不可かつ変更しない)
--   - user_id との比較条件そのもの(`user_id = ...`という構造は不変)
--   - FORCE ROW LEVEL SECURITY設定
--   - GRANT/REVOKE状態
--   - テーブル定義・トリガー・インデックス
--   - rls_auto_enable()関連(本SQLの対象外、別ファイルで扱う)
--
-- 前提: 対象8ポリシーの現在のUSING/WITH CHECK句が、本ファイルが置き換える前の
--   句(`user_id = auth.uid()`)と完全一致していること。この前提は
--   docs/production-readiness/sql/create-rls-probe-records.sql と
--   docs/production-readiness/sql/create-my-team-cloud-schema.sql の
--   Git管理下の正式定義に基づく。実DBのポリシーがこれらのファイルと異なる場合
--   (本人が未反映のGit差分や手動変更を行っている場合)、本SQLを実行する前に
--   Supabase Dashboard(Authentication → Policies)で実際のUSING/WITH CHECK句を
--   直接確認し、一致することを確かめること。
--
-- 冪等性: ALTER POLICYは既存ポリシーの定義を書き換えるだけなので、複数回実行しても
--   同じ最終状態になる(2回目以降は同じUSING/WITH CHECK句への書き換えが繰り返されるだけ)。
--
-- 影響範囲: public.rls_probe_records と public.my_team_snapshots の
--   既存8ポリシーの定義のみ。データ・テーブル構造・トリガー・GRANT・
--   Supabaseのシステムスキーマ(auth, storage等)は一切変更しない。
--
-- ロールバック: rollback-auth-rls-initplan.sql を参照。
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- public.rls_probe_records (4ポリシー)
-- ----------------------------------------------------------------------------
alter policy rls_probe_records_select_own
  on public.rls_probe_records
  using (user_id = (select auth.uid()));

alter policy rls_probe_records_insert_own
  on public.rls_probe_records
  with check (user_id = (select auth.uid()));

alter policy rls_probe_records_update_own
  on public.rls_probe_records
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy rls_probe_records_delete_own
  on public.rls_probe_records
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- public.my_team_snapshots (4ポリシー)
-- ----------------------------------------------------------------------------
alter policy my_team_snapshots_select_own
  on public.my_team_snapshots
  using (user_id = (select auth.uid()));

alter policy my_team_snapshots_insert_own
  on public.my_team_snapshots
  with check (user_id = (select auth.uid()));

alter policy my_team_snapshots_update_own
  on public.my_team_snapshots
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy my_team_snapshots_delete_own
  on public.my_team_snapshots
  using (user_id = (select auth.uid()));

commit;

-- ============================================================================
-- 実行後に確認済みの結果(2026-09-18、読み取り専用メタデータ確認):
--   policy_count: 8(対象8ポリシーすべてに適用済み)
--   public.rls_probe_records: RLS enabled true / FORCE RLS enabled true / owner postgres
--   public.my_team_snapshots: RLS enabled true / FORCE RLS enabled true / owner postgres
--   Performance Advisor: Errors 0 / Warnings 0
--     (以前のAuth RLS Initialization Plan警告8件は全て解消)
--   ブラックボックス検証(本人SELECT/INSERT/UPDATE/DELETE成功、他人行アクセス拒否、
--   未認証アクセス拒否)は別途実施・記録する(本ファイルのSQL実行自体とは別工程)。
-- ============================================================================
