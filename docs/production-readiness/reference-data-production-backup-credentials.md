# Production Backup 資格情報・Secret設計(design only、実資格情報は作成していない)

作成日: 2026-09-20。**この文書は設計のみである。実PostgreSQL roleの作成、実GitHub Secretsの
登録、実age鍵の生成は、このセッションでは一切行っていない。**

関連: [[reference-data-production-backup-security-model.md]]

## 1. read-only資格情報の設計方針

Backup専用の実行主体は、Production apply(書込み)で使う資格情報とは**別の、専用の
read-only PostgreSQL role**を使う。管理者資格情報(`postgres`)やSupabaseの`service_role`
keyをBackupへ流用しない。

| 比較対象 | 権限範囲 | 採用可否 |
|---|---|---|
| 専用PostgreSQL read-only role | 対象4テーブルのSELECTのみ | **第一候補** |
| postgres管理者資格情報 | 全権限 | 不採用(過剰権限、漏洩時の被害が全DBに及ぶ) |
| service role key | RLSバイパス含む全権限相当 | 不採用(同上、かつSupabase固有の強力な鍵) |
| anon/authenticated key | RLSに従うSELECTのみ、公開鍵相当 | 不採用(Backup目的には権限が違いすぎる、そもそもimport_batchesを読めない) |

### 1.1 read-only role作成SQL(設計案、未実行)

```sql
-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- ============================================================================
-- このSQLはこのセッションでは実行していない。実行する場合は、本人による独立した
-- 承認(read-only role作成という単独の判断)を経てから、本人が手動で実行すること。
create role reference_data_backup_reader login password '<本人が別途生成する強力なパスワード>';

-- role creation privilege / BYPASSRLS / replication / superuserのいずれも付与しない
-- (create role文自体にNOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLSを
-- 明示することで、既定値に依存せず意図を明記する)。
alter role reference_data_backup_reader with nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

grant usage on schema reference_data to reference_data_backup_reader;
grant select on
  reference_data.world_player_cards,
  reference_data.managers,
  reference_data.player_card_analysis,
  reference_data.import_batches
to reference_data_backup_reader;

-- 明示的に他スキーマへのUSAGEを一切付与しない(auth/public/reference_data_opsへは無権限のまま)。
-- INSERT/UPDATE/DELETE/TRUNCATE/CREATE/ALTER/DROP/GRANTはいずれも付与しない。
```

`checkBackupCredentialSeparateFromApply`(`backup-production-security-gate.ts`)が、Backup role名と
apply role名が同一でないこと、role名に`postgres`/`service_role`らしき文字列が含まれていないことを
機械的に確認する。

## 2. Secret設計(名前と責務のみ、実Secretは追加していない)

| Secret名 | 内容の種類 | 読み取り権限 | 保存場所 | 利用workflow | ログマスキング | rotation | revoke方法 | 漏洩時の影響 | apply資格情報との分離 |
|---|---|---|---|---|---|---|---|---|---|
| `REFERENCE_DATA_BACKUP_DB_URL` | read-only role専用の接続文字列 | Backup workflowのjobだけ | GitHub Actions Secrets(リポジトリ or Environment単位) | `reference-data-production-backup.yml`のみ | GitHub Actionsは`secrets.*`をログへ自動マスクする(既定機能に依存、追加のマスキングコードは書かない設計にしない=念のため出力しないコードにする) | Supabase側でread-only roleのパスワードを再発行し、Secretを更新 | Secretを削除、次にrole自体のパスワードを変更(role無効化ではなくパスワード変更が即時性が高い) | read-onlyのため書込み被害は無いが、対象4テーブルの内容(公開データ相当)が読み取られる | apply用の別Secretとは名前・値とも完全に別 |
| `REFERENCE_DATA_BACKUP_AGE_RECIPIENT` | age**公開鍵**(復号能力なし) | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 公開鍵自体は秘密情報ではないが、Secretとして管理し値の混入経路を限定する | 本人が新しい鍵ペアを生成した場合に更新 | Secretを削除するだけ(公開鍵漏洩自体に実害はない) | 実害なし(公開鍵) | 該当なし |
| `REFERENCE_DATA_BACKUP_STORAGE_TOKEN` | 保管先(後述)へのアップロード用トークン | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 同上 | 保管先側でトークンを再発行 | トークンを保管先側で無効化、Secretを削除 | 保管先への書込み(アップロード)が可能になる、内容は暗号化済みのため読み取り不可 | apply資格情報と無関係 |
| `REFERENCE_DATA_BACKUP_STORAGE_DESTINATION` | 保管先の識別子(バケット名/リポジトリ名等、接続文字列ではない) | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 識別子自体は秘密情報ではないが、Secretとして管理 | 保管先変更時に更新 | Secretを削除・更新 | 保管先の場所が特定される程度、内容自体は暗号化済み | 該当なし |

**秘密鍵自体(age秘密鍵)をGitHub Secretへ保存する設計は第一候補にしない。** GitHub Actions側は
「暗号化する能力」だけを持てばよく、「復号する能力」を持つ必要がないため、Secretとして
渡すのは公開鍵(`REFERENCE_DATA_BACKUP_AGE_RECIPIENT`)だけにする。秘密鍵は本人のローカル
環境だけで保管する([[reference-data-production-backup-security-model.md]]の暗号化設計と対応)。

## 3. 誠実な限界の開示

上記4つのSecretは、このセッションでは一切GitHubリポジトリへ登録していない。`.github/workflows/reference-data-production-backup.yml`はこれらのSecret名を参照するが、実行すれば必ず最初のステップで「required secret not configured」として失敗する設計であることを、`backup-workflow-audit.test.ts`で確認済み。
