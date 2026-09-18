-- ============================================================================
-- Auth RLS Initialization Plan 最適化のロールバック
-- ============================================================================
--
-- 用途: optimize-auth-rls-initplan.sql を実行した後、何らかの理由で
--   `(select auth.uid())`形式から元の`auth.uid()`直接呼び出し形式へ
--   戻したい場合に使う。
--
-- 復元根拠: ここで復元する8ポリシーのUSING/WITH CHECK句は、Git管理下の
--   正式定義(docs/production-readiness/sql/create-rls-probe-records.sql・
--   docs/production-readiness/sql/create-my-team-cloud-schema.sql)に
--   記載された、テーブル作成時点の元の定義そのものである(推測で再構成した
--   ものではない)。ロール指定(TO authenticated)・command種別・ポリシー名は
--   optimize-auth-rls-initplan.sqlと同様にALTER POLICYでは変更しないため、
--   本ファイルでも対象外(そもそも変更されていない)。
--
-- 意味的な等価性: `(select auth.uid())`と`auth.uid()`は返す値が完全に同じ
--   (STABLE関数呼び出しをスカラーサブクエリで包んだだけ)。本ロールバックも
--   optimize-auth-rls-initplan.sql同様、認可条件の意味を一切変更しない
--   純粋な性能上の書き戻しである。
--
-- 冪等性: ALTER POLICYによる書き換えのため、複数回実行しても同じ最終状態になる。
--
-- 影響範囲: public.rls_probe_records と public.my_team_snapshots の
--   既存8ポリシーの定義のみ。他は一切変更しない。
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- public.rls_probe_records (4ポリシー) — 元の定義(create-rls-probe-records.sql)へ復元
-- ----------------------------------------------------------------------------
alter policy rls_probe_records_select_own
  on public.rls_probe_records
  using (user_id = auth.uid());

alter policy rls_probe_records_insert_own
  on public.rls_probe_records
  with check (user_id = auth.uid());

alter policy rls_probe_records_update_own
  on public.rls_probe_records
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter policy rls_probe_records_delete_own
  on public.rls_probe_records
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- public.my_team_snapshots (4ポリシー) — 元の定義(create-my-team-cloud-schema.sql)へ復元
-- ----------------------------------------------------------------------------
alter policy my_team_snapshots_select_own
  on public.my_team_snapshots
  using (user_id = auth.uid());

alter policy my_team_snapshots_insert_own
  on public.my_team_snapshots
  with check (user_id = auth.uid());

alter policy my_team_snapshots_update_own
  on public.my_team_snapshots
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter policy my_team_snapshots_delete_own
  on public.my_team_snapshots
  using (user_id = auth.uid());

commit;
