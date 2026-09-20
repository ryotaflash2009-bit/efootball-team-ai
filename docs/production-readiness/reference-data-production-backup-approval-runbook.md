# Production Backup 本人承認workflow 運用手順(将来実施用、このセッションでは未実施)

作成日: 2026-09-20。**この文書は将来の実施手順であり、記載された操作はこのセッションでは
一切実行していない。**

関連: [[reference-data-production-backup-security-model.md]]・[[reference-data-production-backup-credentials.md]]・
[[reference-data-production-backup-storage.md]]

対応workflow: `.github/workflows/reference-data-production-backup.yml`
(design only、workflow_dispatchのみ、`schedule`/`pull_request`/`push`トリガーなし)

## 1. 前提条件(実施前に必ず完了していること、このセッションではいずれも未完了)

1. read-only role(`reference_data_backup_reader`)をProduction Supabaseへ作成済み
   ([[reference-data-production-backup-credentials.md]]のSQL案を本人が実行、独立した承認事項)。
2. `age`鍵ペアを本人がローカルで生成済み(秘密鍵はローカルだけに保持)。
3. 4つのGitHub Secretsをリポジトリ(または`production-backup-approval` Environment単位)へ
   登録済み: `REFERENCE_DATA_BACKUP_DB_URL`・`REFERENCE_DATA_BACKUP_AGE_RECIPIENT`・
   `REFERENCE_DATA_BACKUP_STORAGE_TOKEN`・`REFERENCE_DATA_BACKUP_STORAGE_DESTINATION`。
4. GitHub Environment `production-backup-approval`を作成し、本人自身を必須レビュアーとして
   設定済み(GitHub Web UIの Repository Settings → Environments)。
5. 保管先([[reference-data-production-backup-storage.md]]の第一候補)のアカウント・
   バケットを本人が作成済み。
6. 隔離環境でのRestore試験手順([[reference-data-backup-restore-runbook.md]])を、
   Production由来の合成データ相当で最低1回実施し、成功していること。

## 2. 実行手順

1. GitHub リポジトリの Actions タブを開く。
2. "Reference data Production backup (manual, approval-gated, design only)" workflowを選択する。
3. "Run workflow" をクリックし、`confirm`入力欄に文字列 `backup` を入力する。
4. GitHub Environment承認の通知を受け取る。
5. 承認画面で、実行者・実行時刻・対象commitを確認してから承認する(自動承認・事前承認は
   行わない)。
6. workflowの実行ログを確認する(Secretが正しく設定されていれば、secret存在チェックを
   通過し、以降のBackup手順(このセッションでは未実装)へ進む)。
7. 完了後、manifestの`restoreVerified`が`true`であることを確認する(`false`のままBackupを
   完了とみなさない)。
8. 保管先へのアップロードとchecksum一致を確認する。

## 3. 異常時の対応

- secret存在チェックで失敗した場合: 該当Secretが未設定、または名前が誤っている。**バイパス
  フラグを追加せず**、Secretを正しく設定してから再実行する。
- Environment承認が得られない場合: 実行は開始されない。これは正しい動作であり、承認プロセス
  自体を変更しない。
- Restore試験が失敗した場合: そのBackupを`restoreVerified: false`のまま保持し、Production
  apply-readyとして扱わない。原因を特定してから再取得する。

## 4. Emergency revocation(鍵・Secret漏洩時)

1. 漏洩が疑われるSecretをGitHub Secretsから即座に削除する。
2. `REFERENCE_DATA_BACKUP_DB_URL`が漏洩した場合、Supabase側でread-only roleのパスワードを
   直ちに変更する(role自体を削除する場合は、Backup workflowが機能しなくなることを理解した
   上で行う)。
3. `REFERENCE_DATA_BACKUP_STORAGE_TOKEN`が漏洩した場合、保管先サービス側でトークンを
   直ちに無効化・再発行する。
4. age秘密鍵が漏洩した場合、旧鍵で暗号化された既存Backupすべてを「危殆化した」として扱い、
   新しい鍵ペアを生成して以降のBackupを新鍵で暗号化し直す。旧鍵で暗号化された既存Backupの
   内容(対象4テーブルは公開的性質のデータだが、念のため)漏洩リスクを本人が評価する。
5. 対応内容を本人の記録(このセッションの範囲外)へ残す。

## 5. 誠実な限界の開示

この手順書は設計段階のものであり、実際にこの手順どおりに実行して成功したことを示す記録は
まだ存在しない。GitHub Environment・Secrets・read-only role・保管先アカウントのいずれも、
このセッションでは作成していない。
