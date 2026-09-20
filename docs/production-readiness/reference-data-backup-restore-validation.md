# 参照データ自動更新 Backup・Restore検証記録(隔離環境)

作成日: 2026-09-20。**この記録はローカル合成fakeクライアント、および`node:crypto`
(AES-256-GCM、使い捨てテスト鍵)による検証結果である。実Productionへの接続・実Production
Backupの取得・実Production Restoreは一切行っていない。**

**追記(2026-09-20、PR #26マージ後)**: `backup-restore.postgres.test.ts`はGitHub Actions
PostgreSQL 16 service containerで実行され、外部キー制約に起因するTRUNCATE順序の不具合を
1件修正した上で成功した(job-level success、個別テスト件数はジョブログ非公開のため未確認)。
詳細はPR #26のマージ後確認記録を参照(この文書自体は更新せず、下記の「未実行」の記述は
このセッション時点の状態として残す)。

関連: [[reference-data-production-backup-design.md]]・[[reference-data-backup-manifest.md]]・
[[reference-data-backup-restore-runbook.md]]・[[reference-data-production-backup-security-model.md]]
(Production Backup資格情報・暗号鍵・保管先の安全設計、design only)

## 1. 実施範囲の明確な区分

| 区分 | 内容 |
|---|---|
| designed(設計のみ) | `age`によるProduction向け非対称鍵暗号化の採用方針、Production Backup保管方針(7章) |
| implemented locally(ローカル実装済み) | `backup-target.ts`〜`backup-sql-audit.ts`(9モジュール)、いずれも純関数・fakeクライアント設計 |
| proven with synthetic data(合成データで実証済み) | 下記2〜4章のUnit Test(fakeクライアント・`NodeAesGcmEncryptor`+使い捨てテスト鍵) |
| ready for isolated PostgreSQL validation(GitHub Actions向け準備済み、未実行) | `backup-restore.postgres.test.ts`(3ケース: 正常系Restore・wrong key拒否・checksum改ざん拒否) |
| not connected to Production | 全体(このセッションでSupabase/実Productionへの接続は一度もない) |
| Production Backup not acquired | 実Production Backupの取得は未実施 |
| Production Restore not attempted | 実Production Restoreの実施は未実施 |
| Secret not configured | GitHub Secrets・Vercel環境変数・Supabase Vaultへの追加は一切行っていない |
| Cron not configured | 定期実行の登録は行っていない |
| public sharing prohibited | Backupファイル・鍵・manifestを外部やPRへ含めていない |

## 2. Backup生成の検証(`backup-orchestrator.test.ts`)

| # | 確認項目 | 結果 |
|---|---|---|
| 1 | 事前ゲート(target allowlist・PostgreSQL major version・retentionDays・encryptor指定)が1件でも不合格ならDBへ問い合わせない | 合格 |
| 2 | 対象4テーブルすべてを、jsonb/text[]列がネイティブ値へ復元された状態で取得する | 合格 |
| 3 | 0件テーブルはrowCount=0として扱う(1件との区別) | 合格 |
| 4 | manifest生成後、暗号化前に`assertManifestHasNoSecrets`で秘密情報混入を検出できる | 合格 |
| 5 | `NodeAesGcmEncryptor`で実際に暗号化され、平文内容(名前等)がciphertextに含まれない | 合格 |
| 6 | 生成直後のmanifestは`restoreVerified: false`のまま(Backup取得だけではverifiedにしない) | 合格 |

## 3. Restore検証(`backup-restore.test.ts`、fakeクライアント)

| # | 確認項目 | 結果 |
|---|---|---|
| 1 | 正常系Restore: 件数・内容が一致し、`restoreVerified: true`となる | 合格 |
| 2 | `NodeAesGcmEncryptor`(正しい鍵)でも成功する | 合格 |
| 3 | wrong key拒否: 誤った鍵での復号は拒否し、Restore先へ一切書き込まない | 合格 |
| 4 | 暗号化ファイル改ざん時拒否: 認証タグ検証失敗で拒否、書込みなし | 合格 |
| 5 | incomplete dump拒否: 短すぎるciphertextを拒否 | 合格 |
| 6 | checksum不一致時拒否: テーブルchecksum改ざんを、書込み前に検出 | 合格 |
| 7 | total checksum改ざんを検出 | 合格 |
| 8 | source metadata checksum改ざんを検出 | 合格 |
| 9 | row count mismatch(manifestの件数改ざん)を検出 | 合格 |
| 10 | missing table時拒否: Backup本体からテーブルが1つ欠落している場合を検出 | 合格 |
| 11 | unexpected table時拒否: 想定外テーブル(`my_team_snapshots`)混入を検出 | 合格 |
| 12 | schema version不一致拒否: 書込み前にblocked、呼び出し0件 | 合格 |
| 13 | PostgreSQL major version不一致時の安全な停止: 書込み前にblocked、呼び出し0件 | 合格 |
| 14 | Restore中の書込み失敗時はROLLBACKし、`restoreVerified: false` | 合格 |
| 15 | Restore失敗時、manifestは`backupStatus: "failed"`となる(Production apply-ready判定と連動可能) | 合格 |

## 4. 静的監査(`backup-sql-audit.test.ts`)

`auditBackupSql()`が生成する実SQL文字列に対して、次をすべて拒否できることを確認した:
利用者データテーブル参照・`reference_data`/`reference_data_ops`/`public`/`auth`への直接参照・
`SELECT *`・`DROP DATABASE`/`DROP SCHEMA`/`ALTER`/`GRANT`/`REVOKE`・Restore先schema以外への
`TRUNCATE`・動的SQL(`EXECUTE`/`DO`/`CALL`)・接続文字列/トークン/パスワードらしき文字列・
既知のbypassフラグ(`--no-encryption`/`--skip-checksum`/`--skip-restore-test`)。実ファイルに
対する監査(`auditBackupSql()`本体)は**issues: []**。

## 5. GitHub Actions隔離PostgreSQL向け準備(`backup-restore.postgres.test.ts`、未実行)

次の3ケースを実PostgreSQL向けに実装したが、ローカルWindows環境にPostgreSQLが存在しないため
このセッションでは一度も実行できていない:

1. 正常系: 合成データをsource schemaへ投入 → Backup(`NodeAesGcmEncryptor`+使い捨てテスト鍵) →
   別の空schema(`reference_data_backup_restore_test`)へRestore → Restore後checksum一致 →
   実際にRestore先テーブルの内容を読み出して確認。
2. 誤った鍵での復号拒否: Restore先schemaが空のままであることを実PostgreSQL上で確認。
3. manifest改ざん拒否: checksum不一致により書込み前にblockedとなり、Restore先schemaへ
   1件も書き込まれないことを実PostgreSQL上で確認。

`vitest.postgres.config.ts`の既存include pattern(`*.postgres.test.ts`)にそのまま含まれるため、
`vitest.config.ts`(通常のUnit Test)には影響しない。schedule/cronはこのファイルへ一切追加して
いない。

## 6. 回帰確認

Phase 1/Phase 2/Promotion/read-only preflightの既存テストは、`npx vitest run`で全件成功
(190ファイル/3,607テスト、failure 0、意図しないskip 0)。`npx tsc --noEmit`はエラーなし。
`npm run build`は成功。

## 7. 誠実な限界の開示

- fakeクライアント・`NodeAesGcmEncryptor`はいずれも実PostgreSQLの挙動を模倣した設計だが、
  実PostgreSQL固有の挙動(pooler経由の制約、実際の型変換の細部)は、`backup-restore.postgres.test.ts`
  がGitHub Actions上で実行されるまで実地検証されていない。
- Production向けの`age`実装(公開鍵暗号化、GitHub Actionsへの公開鍵配置)は、このセッションでは
  一切実装していない(比較・方針決定のみ、[[reference-data-production-backup-design.md]]5章)。
- Production Backup gate(`backup-gate.ts`)の17項目はすべて、このセッション終了時点で
  `false`(未達成)として扱うべきであり、`decideProductionBackupGate`は常に`blocked`を返す状態にある。
