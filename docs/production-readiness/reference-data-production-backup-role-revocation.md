# Production Backup role Revoke・Rotation・緊急対応(将来実施用、このセッションでは未実施)

作成日: 2026-09-21。**この文書は将来の手順であり、記載された操作はこのセッションでは
一切実行していない。**

関連: [[reference-data-production-backup-role-design.md]]・[[reference-data-production-backup-role-runbook.md]]・
[[reference-data-production-backup-threat-model.md]]

実SQLファイル: `docs/production-readiness/sql/rollback-reference-data-backup-role.sql`
(DO NOT RUN、未実行)。静的監査: `auditRollbackRoleSql()`(6項目、issues: []を確認済み)。

## 1. password rotation(定期・非緊急)

1. 新しいパスワードを本人が生成する。
2. Supabase Dashboardまたは`alter role reference_data_backup_reader password
   '<新パスワード>';`を本人が直接実行し、role側のパスワードを更新する。
3. GitHub Secretsの`REFERENCE_DATA_BACKUP_DB_URL`を、新しい接続文字列で本人が更新する。
4. 次回のBackup workflow実行(承認された手動実行)で、新しい資格情報が機能することを
   確認する。
5. rotation実施日を本人が記録する。

## 2. GitHub Secret rotation

`REFERENCE_DATA_BACKUP_AGE_RECIPIENT`(公開鍵)・`REFERENCE_DATA_BACKUP_STORAGE_TOKEN`・
`REFERENCE_DATA_BACKUP_STORAGE_DESTINATION`は、それぞれの発行元(本人のage鍵管理・
storageプロバイダ)側で再発行してから、GitHub Secretsの値を本人が更新する。

## 3. role NOLOGIN化(緊急停止、最優先)

password漏洩・鍵漏洩が疑われる場合、最初に実行する操作:

```sql
alter role reference_data_backup_reader nologin;
```

(`rollback-reference-data-backup-role.sql`段階1と同一。role・権限・データは一切
変更せず、新規ログインだけを即座に禁止する、最も影響範囲が小さく即効性のある操作)。

## 4. active session終了

NOLOGIN化は新規接続を防ぐだけで、既存の接続中セッションは終了させない。稼働中の
Backup workflow実行が無いことをGitHub Actions側で確認し、必要であれば
Supabase Dashboardから該当セッションを終了させる(自動化しない、本人が個別に判断する)。

## 5. 権限のrevoke(role自体は残す場合)

```sql
revoke select on table
  reference_data.world_player_cards,
  reference_data.managers,
  reference_data.player_card_analysis,
  reference_data.import_batches
from reference_data_backup_reader;

revoke usage on schema reference_data from reference_data_backup_reader;
```

## 6. role削除(完全に不要になった場合)

`rollback-reference-data-backup-role.sql`の段階4〜5(`alter role ... reset all`
→ `drop role if exists ...`)を、他のオブジェクトからの依存が無いことを確認してから
実行する。この削除文はCASCADE相当の構文を使わない設計のため、依存が残っている場合は
失敗する(意図的な安全側の挙動)。

## 7. credential漏洩時の対応順序

1. **即座に**role NOLOGIN化(3章)。
2. GitHub Secretsから`REFERENCE_DATA_BACKUP_DB_URL`を削除。
3. Backup workflow(`.github/workflows/reference-data-production-backup.yml`)が
   実行中でないことを確認し、実行中であればGitHub Actions側でキャンセルする。
4. storage token(該当する場合)を保管先サービス側で無効化。
5. 影響範囲を評価する(read-only roleのため書込み被害は無いが、対象4テーブルの
   内容が読み取られた可能性を評価する)。
6. 原因を特定し、対応内容を本人が記録する(このセッションの範囲外)。
7. 対応完了後、新しいrole・新しいpassword・新しいSecretで再開するか、
   [[reference-data-production-backup-role-design.md]]を見直してから再作成するかを
   本人が判断する。

## 8. Backup保管物の扱い

role・Secretの失効は、既に取得済みのBackup(暗号化済み)自体には影響しない。
Backup保管物自体の漏洩が疑われる場合は、[[reference-data-production-backup-threat-model.md]]の
「暗号鍵漏洩」「storage bucket誤公開」の手順に従う(role revocationとは別の対応)。

## 9. audit記録

rotation・revocation・緊急対応を実施した場合、実施日・実施理由・実施者(本人)を
本人が記録する(具体的な記録先はこのセッションの範囲外、独立した運用判断)。

## 10. 誠実な限界の開示

この文書の手順はすべて設計であり、実際に実行して成功したことを示す記録はまだ
存在しない。`pg_terminate_backend`によるセッション強制切断の具体的なSQLは、
対象pidが実行時点の状態に依存するため、このセッションでは事前に決め打ちできる
形では設計していない。
