# Supabase Auth / RLS Hardening 実行結果

実行日: 2026-09-18

対象: Supabase Security AdvisorおよびPerformance Advisorの警告(招待制アルファ公開準備の一環)。

**実Supabaseへの行データ変更は一切なし(権限・ポリシー定義の変更のみ)。auth.usersおよび
my_team_snapshots/rls_probe_recordsの実利用者データは今回一切参照していない。**

## 総合結果

- Security Advisor: Errors 0 / Warnings 3 → Errors 0 / Warnings 1
- Performance Advisor: Errors 0 / Warnings 8 / Info 7 → Errors 0 / Warnings 0 / Info 7
- 解消したSecurity警告: `public.rls_auto_enable()`に関する2件
  (Public Can Execute SECURITY DEFINER Function / Signed-In Users Can Execute SECURITY DEFINER Function)
- 残ったSecurity警告: Leaked Password Protection Disabled(今回は対応せず、別トラックで管理)
- 解消したPerformance警告: Auth RLS Initialization Plan 8件
  (`public.rls_probe_records` 4ポリシー、`public.my_team_snapshots` 4ポリシー)

## A. `public.rls_auto_enable()` の実行権限(Security Advisor対応)

実行前に読み取り専用メタデータ確認で確定した状態:

- 戻り値: `event_trigger`
- 所有者: `postgres`
- セキュリティモード: `SECURITY DEFINER`
- `search_path`: `pg_catalog`
- 紐づくEvent Trigger: `ensure_rls`(イベント `ddl_command_end`、対象コマンドタグ
  `CREATE TABLE` / `CREATE TABLE AS` / `SELECT INTO`、状態 `enabled`)
- 実行前の明示権限: PUBLIC=EXECUTE、postgres=EXECUTE。anon/authenticatedへの個別GRANTはなく、
  PUBLIC経由の継承で実行可能になっていた。

適用したSQL: `docs/production-readiness/sql/revoke-rls-auto-enable-public-execute.sql`
(PUBLICからのEXECUTEのみをREVOKE。anon/authenticated/postgresへの個別操作はなし)

実行後に確認した状態:

- `public_can_execute`: false
- `anon_can_execute`: false
- `authenticated_can_execute`: false
- `postgres_can_execute`: true(維持)
- `ensure_rls` Event Trigger: 引き続き `enabled`
- `public.rls_auto_enable()`: 引き続き存在、`SECURITY DEFINER`・`search_path`とも維持

ロールバック: `docs/production-readiness/sql/rollback-revoke-rls-auto-enable-public-execute.sql`
(実測された実行前状態=PUBLICへのEXECUTE再付与に正確に対応)

## B. RLSポリシー最適化(Performance Advisor対応)

対象: `public.rls_probe_records`・`public.my_team_snapshots` の各SELECT/INSERT/UPDATE/DELETE
用ポリシー(計8件)。`user_id = auth.uid()` を `user_id = (select auth.uid())` へ変更(意味論的に
等価なプランナー最適化、認可条件は不変)。ポリシー名・対象テーブル・command・ロール(authenticated)・
USING/WITH CHECKの配置は変更なし。

適用したSQL: `docs/production-readiness/sql/optimize-auth-rls-initplan.sql`

実行後に確認した状態:

- 対象ポリシー数: 8件(想定どおり)
- `public.rls_probe_records`: RLS enabled=true / FORCE RLS enabled=true / owner=postgres
- `public.my_team_snapshots`: RLS enabled=true / FORCE RLS enabled=true / owner=postgres

ロールバック: `docs/production-readiness/sql/rollback-auth-rls-initplan.sql`
(Git管理下の元定義 `create-rls-probe-records.sql` / `create-my-team-cloud-schema.sql` に基づく
確実な復元)

## C. Leaked Password Protection(今回は対応しない)

Free/Pro要否は未検証。招待制5〜10名アルファでの残存リスクは低いと判断し、今回のSQL修正には
一切混在させていない。対応要否の判断は別途行う。

## D. 影響範囲外であることの確認

- 行データのINSERT/UPDATE/DELETEはなし
- `auth.users`への参照・変更なし
- Supabase実利用者データ(メールアドレス・ユーザーID・行内容)の読み取りなし
- Vercel操作なし、デプロイ未実施
