# Production Backup保管先: Cloudflare R2 Standard(採用確定、design only、未接続)

作成日: 2026-09-21。**Cloudflare R2 Standardを正式な主保管先として採用したことをこの文書で
確定する。ただし、実R2への接続・実アップロード・実ダウンロードは、このセッションでは
一切行っていない。API Token・Access Key・Secretはいずれも作成・保存していない。**

関連: [[reference-data-production-backup-storage.md]](保管先比較、本文書がR2採用を確定する)・
[[reference-data-production-backup-credentials.md]](Secret契約)・
[[reference-data-production-backup-security-model.md]]・[[reference-data-production-backup-threat-model.md]]

実装コード: `src/lib/reference-data/auto-update/backup-r2-target.ts`(prefix allowlist・
object key組み立て)・`backup-r2-client.ts`(`R2Client` interface + `FakeR2Client`)・
`backup-r2-adapter.ts`(6つの操作: `putEncryptedBackup`・`headEncryptedBackup`・
`getEncryptedBackupForIsolatedRestore`・`listBackupManifests`・`deleteExpiredBackup`・
`verifyRemoteChecksum`)。いずれもfake clientだけで検証済み、実R2への接続コードは
このセッションでは実装していない(`@aws-sdk/client-s3`等の新規package追加も行っていない)。

## 1. Cloudflare Dashboardで本人が確定済みの状態(確認済み事実)

- provider: Cloudflare R2、storage class: Standard
- Bucket: private(Public Access: Disabled、Public Development URL: Disabled、Custom
  Domain: なし、CORS: なし、Data Catalog: Disabled、Event Notifications: なし、
  Bucket Lock: なし)
- Lifecycle Rules: `daily/`(8日後削除)・`weekly/`(35日後削除)・`monthly/`(100日後削除)・
  `pre-apply/`(自動削除なし)・multipart uploads(7日後中止)
- Budget Alert設定済み
- API Token・Access Key・Secret: 未作成
- Backup objects: 0件、Production Backup: 0件

**Bucket名自体はこの文書・コードのいずれにも直書きしない**(`REFERENCE_DATA_BACKUP_R2_BUCKET`
Secretの値としてのみ扱う、[[reference-data-production-backup-credentials.md]]参照)。

## 2. Storage adapterの設計

`backup-r2-adapter.ts`はProduction runtimeから一切参照しない(`src/app`/`src/components`から
importしない、API endpoint・Route Handler・Server Action・UI導線を作らない、既存の
`checkBackupCredentialSeparateFromApply`等と同じ隔離方針)。

| 操作 | 関数 | 役割 |
|---|---|---|
| upload | `putEncryptedBackup` | 事前ゲート→重複/上書き拒否→upload→upload後checksum検証 |
| 存在確認 | `headEncryptedBackup` | sanitizeされたsize/checksumだけを返す |
| 隔離Restore用取得 | `getEncryptedBackupForIsolatedRestore` | ダウンロード直後にchecksum再計算、不一致ならpayloadを返さない |
| manifest一覧 | `listBackupManifests` | `.manifest.json`だけを列挙・取得(暗号化payload本体は読まない) |
| 期限切れ削除 | `deleteExpiredBackup` | `expiresAt`到来済み・`pre-apply/`以外だけを許可する手動削除 |
| checksum再確認 | `verifyRemoteChecksum` | size + metadata上のchecksumを独立して確認(ETag単独に依存しない) |

### 2.1 adapterが拒否するもの(`evaluatePutEncryptedBackupGates`で機械的に確認済み)

- `manifest.encrypted === false`(平文Backup)
- `manifest.restoreVerified === false`(隔離Restore試験未検証のBackup)
- `manifest.tableAllowlist`が`BACKUP_TARGET_TABLES`と不一致(allowlist外table)
- `assertManifestHasNoSecrets`に失敗するmanifest(Secretを含む疑い)
- allowlist外のobject prefix
- 形式不正なchecksum(sha256 hex 64文字でない)
- 空のencryptedPayload(平文相当・不正な入力の疑い)
- 呼び出し側が渡したchecksumが実際のpayloadと不一致
- 既存のobject key(重複・上書き拒否、`FakeR2Client`によるUnit Testで確認済み)

## 3. Object key設計

形式: `<prefix><UTC date>/<jobId>/<encrypted checksumの先頭12文字>` に、暗号化payloadは
`.age`、manifestは`.manifest.json`を付与する。

- prefixは`daily/`・`weekly/`・`monthly/`・`pre-apply/`の4つだけ(`BACKUP_OBJECT_PREFIXES`)。
- jobId・checksum断片は英数字・ハイフン・アンダースコアだけの安全な文字集合に限定
  (`checkSafeKeySegment`)、path traversal(`..`・`/`・`\`)・制御文字を拒否。
- email・Project ID・database名・username・接続文字列・source URL・user IDは、この
  key構成要素の入力にそもそも型シグネチャ上含まれない。
- checksum由来のcontent-addressed設計のため、同一内容のBackupを再uploadすると同一keyに
  なり、既存object検出により重複・上書きが構造的に拒否される(collision検出)。

## 4. Checksum(ETagだけに依存しない完全性検証)

- upload前: 暗号化済みpayloadのsha256(`localEncryptedChecksum`)・manifest checksum・
  dataset checksum(manifest内に既存フィールドとして保持)。
- upload時: sha256を`x-amz-meta-sha256`相当のobject metadataへ埋め込む(`R2PutObjectInput.metadata`)。
- upload後: `headObject`でsize一致・metadata上のchecksum一致の両方を独立して確認する
  (`verifyRemoteChecksum`)。**ETagだけを完全性の唯一の根拠にしない**(ETagはmultipart upload時に
  単純なMD5にならない実装依存の挙動があるため、アプリ側計算のsha256を必ず別途保持する)。
- 不一致の場合: `storageVerified = false`を返し、Backup gateをblockedにする
  ([[reference-data-production-backup-design.md]]の既存gate設計と連動)。自動削除・
  自動再upload・自動上書きは一切行わない。

## 5. Secret契約の再評価(単一TOKEN設計からR2固有4項目への変更)

**単一の`REFERENCE_DATA_BACKUP_STORAGE_TOKEN`design(provider未確定時の汎用名)は、
R2採用確定に伴い安全とは言えないと判断し、以下の4項目へ分離した**(R2はS3互換の
SigV4認証を要求し、Access Key IDとSecret Access Keyという性質の異なる2つの値を
必要とするため、単一のbearer token相当では表現できない):

| Secret名 | 内容 |
|---|---|
| `REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID` | R2 API TokenのAccess Key ID(公開識別子相当だが、Secretとして扱う) |
| `REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY` | R2 API TokenのSecret Access Key(最も機微、rotation対象) |
| `REFERENCE_DATA_BACKUP_R2_ENDPOINT` | R2のS3互換エンドポイントURL(Account IDを含むため非公開情報として扱う) |
| `REFERENCE_DATA_BACKUP_R2_BUCKET` | 対象Bucket名 |

既存の`REFERENCE_DATA_BACKUP_DB_URL`・`REFERENCE_DATA_BACKUP_AGE_RECIPIENT`は変更なし。
詳細な責務・rotation・revoke手順は[[reference-data-production-backup-credentials.md]]を
更新して記録する。`.github/workflows/reference-data-production-backup.yml`の
secret存在チェックステップも、この6項目を確認するよう更新した(design only、
実Secretは未設定のため引き続き最初のステップで必ず失敗する)。

## 6. API Token最小権限設計(実Token未作成)

将来作成するCloudflare R2 API Tokenの第一候補:

- 権限: **Object Read & Write**(Object単位、Admin Read & Writeではない)
- 対象: 特定Bucket(`REFERENCE_DATA_BACKUP_R2_BUCKET`)だけに限定、Account全体への
  Adminアクセスは付与しない
- 他Bucketへのアクセス: 不可
- Bucket作成・削除権限: 不要(付与しない)
- Public Access変更権限: 不要(付与しない)
- Lifecycle Rule変更権限: 不要(付与しない)
- Token rotation: 定期的に実施(頻度は本人が運用開始後に決定)
- emergency revoke: 漏洩が疑われる場合、Cloudflare DashboardからToken即時削除
  (R2 API Tokenの失効は即時反映される)

**実Tokenはこのセッションでは作成していない。**

## 7. Free tier超過・R2障害時の停止条件

- R2の無料枠(Class A/B operations、storage容量)を超過した場合、追加費用が発生する
  (Budget Alertは本人が既に設定済み)。Alertを受け取った場合、Backup workflowの
  次回実行を本人が判断するまで一時停止する。
- R2側で障害・エラーが発生した場合(接続不可・5xxエラー等)、自動リトライを行わず、
  Backup全体を失敗として扱う(部分的にuploadされたobjectを残さない設計、
  `putEncryptedBackup`が両方のobject——暗号化payload+manifest——を書き切れなかった
  場合の扱いは、将来の実R2実装時に明示的なロールバック処理を追加検討する)。
- checksum不一致・size不一致を検出した場合、当該objectを自動削除せず、本人が
  手動で調査してから対応する。

## 8. テスト

`backup-r2-target.test.ts`(22件)・`backup-r2-adapter.test.ts`(35件、Secret非出力確認
4件を含む)。いずれもネットワーク通信を行わない`FakeR2Client`だけを使用。実R2への
接続はこのセッションでは一度も行っていない。

## 9. 誠実な限界の開示

- `R2Client`の実装(実際に`@aws-sdk/client-s3`等でR2のS3互換エンドポイントへ接続する
  コード)は、このセッションでは一切実装していない(新規package追加を避けるため)。
  実装は将来の別作業とする。
- multipart upload(大きいBackupファイル向け)の設計は、このセッションでは検討して
  いない(現状のBackupサイズは小さく、単純なPUTで十分と想定している)。
- R2の実際のAPI呼び出し制限・レイテンシ・エラー挙動は未確認。
