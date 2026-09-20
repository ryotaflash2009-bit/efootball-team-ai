# Backup manifestフォーマット

作成日: 2026-09-20。実装: `src/lib/reference-data/auto-update/backup-manifest.ts`。
関連: [[reference-data-production-backup-design.md]]

## 1. 目的

Backupファイル(暗号化済み)とは別に、秘密情報を一切含まない「何を・いつ・どんな状態で
取得したか」のmanifestを1件ずつ保持する。manifest単体は暗号化しない(復号せずに内容を
確認できる必要があるため)が、manifest自体にも秘密情報・利用者データを一切含めない。

## 2. フィールド一覧

| フィールド | 型 | 説明 |
|---|---|---|
| `backupVersion` | string | manifestフォーマット自体のバージョン |
| `schemaVersion` | string | 対象`reference_data`構造のバージョン識別子(`job.ts`等と同じ規約の不透明な文字列) |
| `jobId` | string | このBackupと紐づくジョブID(Promotion apply直前に取得する場合、対応するUpdateJobのID) |
| `sourceCategory` | `"reference_data_full_table_backup"` | 固定リテラル。行単位before snapshotとの区別のため |
| `createdAt` | string(ISO 8601) | Backup取得時刻 |
| `postgresMajorVersion` | number | 取得元PostgreSQLのmajor version(Restore時の`expectedPostgresMajorVersion`と比較する) |
| `tableAllowlist` | string[] | Backup対象テーブル名(常に`BACKUP_TARGET_TABLES`と一致する) |
| `rowCounts` | Record<table, number> | テーブルごとの件数 |
| `tableChecksums` | Record<table, string> | テーブルごとの決定的checksum |
| `totalChecksum` | string | 全テーブルchecksumから導出した合成checksum |
| `sourceMetadataChecksum` | string | 各テーブルの`source`/`dataset_version`列から導出した由来情報のchecksum |
| `dumpFormat` | `"jsonl-per-table"` | 固定値(将来複数形式を扱う場合の拡張余地として文字列型のまま保持) |
| `compression` | `"none" \| "gzip"` | 圧縮方式(このセッションの実装は`"none"`のみ使用) |
| `encryptionAlgorithm` | string | 暗号化アルゴリズム識別子(`BackupEncryptor.algorithmId`) |
| `encrypted` | boolean | 暗号化済みか |
| `restoreVerified` | boolean | 実際にRestoreし、Restore後checksumが一致したか |
| `retentionCategory` | `"isolated-test-ephemeral" \| "production-short-term" \| "production-standard"` | 保持方針の分類 |
| `expiresAt` | string(ISO 8601) | 保持期限 |
| `applicationCommitSha` | string | Backup取得時点のアプリケーションのGit commit SHA |
| `backupStatus` | `"pending" \| "encrypted" \| "restore_verified" \| "failed"` | 状態遷移(3章参照) |

## 3. 状態遷移

```
buildBackupManifest()      -> backupStatus: "pending"    (encrypted: false, restoreVerified: false)
  -> markManifestEncrypted() -> backupStatus: "encrypted"  (encrypted: true)
    -> markManifestRestoreVerified() -> backupStatus: "restore_verified" (restoreVerified: true)
    -> markManifestFailed()          -> backupStatus: "failed"
```

`restoreVerified: true`と主張してよいのは、実際に別の空の隔離schemaへRestoreし、Restore後
checksumがBackup前と完全一致した場合だけである(`restoreReferenceDataBackup`が成功した場合のみ
`markManifestRestoreVerified`を呼ぶ)。

## 4. 意図的に含めないフィールド

host・Project ID・database名の生値・username・password・接続文字列・token・key・利用者データ・
メールアドレス。これらは呼び出し元の`BuildBackupManifestInput`自体がそもそも持たない設計に
しており、`assertManifestHasNoSecrets`が禁止フィールド名・秘密情報らしき値のパターン
(postgres接続文字列・メールアドレス・JWT様トークン・Supabaseホスト名)を機械的に検出する。

## 5. 誠実な限界の開示

このフォーマットはfakeクライアント・隔離PostgreSQL検証専用コードだけで実証しており、
実Production Backupのmanifestを実際に生成したことはこのセッションでは一度もない。
