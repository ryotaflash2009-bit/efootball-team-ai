# Production Backup role 作成・確認 実行手順(将来実施用、このセッションでは未実施)

作成日: 2026-09-21。**この文書は将来の実施手順であり、記載された操作はこのセッションでは
一切実行していない。role作成・password設定は、いずれも独立した承認事項である。**

関連: [[reference-data-production-backup-role-design.md]]・[[reference-data-production-backup-credentials.md]]・
[[reference-data-production-backup-approval-runbook.md]]

## 1. 前提条件

1. [[reference-data-production-backup-role-design.md]]の設計・独立監査結果を本人が確認済み。
2. `docs/production-readiness/sql/create-reference-data-backup-role.sql`の内容を本人が
   目視確認済み(DO NOT RUNバナー・password句が無いこと・GRANT対象が4テーブルだけで
   あることを含む)。
3. role作成という単独の判断について、本人が独立して承認済み(他の操作の承認と
   まとめない)。

## 2. role作成手順

1. Supabase Dashboardを開く。
2. 対象Productionプロジェクトを選択する。
3. SQL Editorを開く。
4. New queryを作成する。
5. エディタの内容をクリアする。
6. `create-reference-data-backup-role.sql`の内容を貼り付ける。
7. 冒頭の安全宣言(DO NOT RUN/DESIGN ONLY/REQUIRES SEPARATE APPROVAL/PRODUCTION NOT
   APPLIED/DOES NOT CREATE OR STORE A PASSWORD/DOES NOT GRANT USER-DATA ACCESS)を
   確認する。
8. **本人が明示的に承認した場合だけ**Runをクリックする(Claude Codeはこの操作を
   実行しない)。
9. 実行結果にエラーが無いことを確認する。

## 3. password設定手順(role作成とは別操作)

1. 強力なランダムパスワードを、本人が信頼する方法で生成する(Claude Codeへ
   生成を依頼しない、チャットへ貼り付けない)。
2. Supabase DashboardのDatabase → Roles画面、または`alter role
   reference_data_backup_reader password '<生成したパスワード>';`を本人が
   SQL Editorへ直接入力して実行する(この文言をClaude Codeとの会話やコミットへ
   含めない)。
3. 生成した接続文字列(role名・password・接続先を含む)を、本人が直接
   GitHub Secretsの`REFERENCE_DATA_BACKUP_DB_URL`へ登録する(GitHub Web UI経由、
   Claude Codeを介さない)。

## 4. 作成後確認手順

1. SQL Editorで`verify-reference-data-backup-role.sql`を実行する。
2. 結果のJSONを本人が目視確認する:
   - `role_exists: true`
   - `login: true`
   - `superuser`/`createdb`/`createrole`/`replication`/`bypassrls`がすべて`false`
   - `schema_usage.reference_data_usage: true`、他3項目は`false`
   - `table_privileges`の4件すべてで`can_select: true`、他の権限はすべて`false`
3. 想定と異なる結果が1件でもあれば、role作成SQLを見直し、[[reference-data-production-backup-role-revocation.md]]の
   手順で一旦停止してから再作成を検討する。
4. 結果のJSONをそのまま外部やClaude Codeへ共有する場合、内容がmetadataだけ
   (role名・boolean値・数値・timeout設定文字列)であり、password・接続文字列・
   Project ID等を含まないことを確認してから共有する。

## 5. 誠実な限界の開示

この手順書は設計段階のものであり、実際にこの手順どおりに実行して成功したことを示す
記録はまだ存在しない。
