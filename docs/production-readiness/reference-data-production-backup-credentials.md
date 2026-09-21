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

**2026-09-21追記**: role作成SQL・作成後確認SQL・rollback SQLの独立監査を実施し、
このSQL自体をこの文書から実SQLファイルへ分離した(詳細は
[[reference-data-production-backup-role-design.md]]を参照)。理由: 独立監査の過程で、
当初この文書に直接埋め込んでいたSQL案が`password '<プレースホルダー>'`という
password句(literal)を含んでいたことを検出したため(プレースホルダーであっても、
静的監査が拒否すべきパターンそのものであった)。現在の設計はパスワードを一切
含まない・生成しない。

実SQLファイル:
- `docs/production-readiness/sql/create-reference-data-backup-role.sql`(作成、未実行)
- `docs/production-readiness/sql/verify-reference-data-backup-role.sql`(作成後確認、metadataのみ)
- `docs/production-readiness/sql/rollback-reference-data-backup-role.sql`(緊急停止・削除、未実行)

静的監査: `src/lib/reference-data/auto-update/backup-role-sql-audit.ts`
(`backup-role-sql-audit.test.ts`で実ファイルに対しissues: []を確認済み)。

`checkBackupCredentialSeparateFromApply`(`backup-production-security-gate.ts`)が、Backup role名と
apply role名が同一でないこと、role名に`postgres`/`service_role`らしき文字列が含まれていないことを
機械的に確認する。

## 2. Secret設計(名前と責務のみ、実Secretは追加していない)

**2026-09-21更新**: 保管先をCloudflare R2 Standardに確定したことに伴い、provider未確定時の
汎用名だった`REFERENCE_DATA_BACKUP_STORAGE_TOKEN`/`REFERENCE_DATA_BACKUP_STORAGE_DESTINATION`
(単一token設計)を、R2固有の4項目へ置き換えた。理由: R2はS3互換のSigV4認証を要求し、
性質の異なる2つの値(Access Key ID・Secret Access Key)を必要とするため、単一token design
では安全に表現できないと判断した(詳細は[[reference-data-production-backup-r2-adapter.md]]参照)。

| Secret名 | 内容の種類 | 読み取り権限 | 保存場所 | 利用workflow | ログマスキング | rotation | revoke方法 | 漏洩時の影響 | apply資格情報との分離 |
|---|---|---|---|---|---|---|---|---|---|
| `REFERENCE_DATA_BACKUP_DB_URL` | read-only role専用の接続文字列 | Backup workflowのjobだけ | GitHub Actions Secrets(リポジトリ or Environment単位) | `reference-data-production-backup.yml`のみ | GitHub Actionsは`secrets.*`をログへ自動マスクする(既定機能に依存、追加のマスキングコードは書かない設計にしない=念のため出力しないコードにする) | Supabase側でread-only roleのパスワードを再発行し、Secretを更新 | Secretを削除、次にrole自体のパスワードを変更(role無効化ではなくパスワード変更が即時性が高い) | read-onlyのため書込み被害は無いが、対象4テーブルの内容(公開データ相当)が読み取られる | apply用の別Secretとは名前・値とも完全に別 |
| `REFERENCE_DATA_BACKUP_AGE_RECIPIENT` | age**公開鍵**(復号能力なし) | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 公開鍵自体は秘密情報ではないが、Secretとして管理し値の混入経路を限定する | 本人が新しい鍵ペアを生成した場合に更新 | Secretを削除するだけ(公開鍵漏洩自体に実害はない) | 実害なし(公開鍵) | 該当なし |
| `REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID` | R2 API TokenのAccess Key ID | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 同上 | R2 API Tokenを再発行(Access Key ID・Secret Access Keyは対で再発行される) | Cloudflare DashboardでToken即時削除、Secretを削除 | 単体では悪用不可(Secret Access Keyと対で必要)、念のためTokenごと失効させる | apply資格情報と無関係 |
| `REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY` | R2 API TokenのSecret Access Key(最も機微) | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 同上 | 同上 | Cloudflare DashboardでToken即時削除、Secretを削除 | 対象BucketへのRead/Write(Object Read & Write権限の範囲内)が可能になる、内容は暗号化済みのため読み取り不可 | apply資格情報と無関係 |
| `REFERENCE_DATA_BACKUP_R2_ENDPOINT` | R2のS3互換エンドポイントURL(Account IDを含む) | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | エンドポイント自体は接続先情報のため、念のためSecretとして管理(直接の攻撃力は無いが情報最小化のため) | Account構成変更時に更新(通常は不変) | Secretを削除・更新 | 接続先が特定される程度、単体では悪用不可 | 該当なし |
| `REFERENCE_DATA_BACKUP_R2_BUCKET` | 対象Bucket名 | Backup workflowのjobだけ | GitHub Actions Secrets | 同上 | 識別子自体は秘密情報ではないが、Secretとして管理 | 保管先Bucket変更時に更新 | Secretを削除・更新 | 保管先の場所が特定される程度、単体では悪用不可 | 該当なし |

**秘密鍵自体(age秘密鍵)をGitHub Secretへ保存する設計は第一候補にしない。** GitHub Actions側は
「暗号化する能力」だけを持てばよく、「復号する能力」を持つ必要がないため、Secretとして
渡すのは公開鍵(`REFERENCE_DATA_BACKUP_AGE_RECIPIENT`)だけにする。秘密鍵は本人のローカル
環境だけで保管する([[reference-data-production-backup-security-model.md]]の暗号化設計と対応)。

## 3. 誠実な限界の開示

上記4つのSecretは、このセッションでは一切GitHubリポジトリへ登録していない。`.github/workflows/reference-data-production-backup.yml`はこれらのSecret名を参照するが、実行すれば必ず最初のステップで「required secret not configured」として失敗する設計であることを、`backup-workflow-audit.test.ts`で確認済み。
