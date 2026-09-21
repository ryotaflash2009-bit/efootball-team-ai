# 参照データ自動更新 Production Backup実運用設計(隔離PostgreSQL検証、Production未接続)

作成日: 2026-09-20。**このセッションでは実Supabase・実Productionへ一切接続していない。実Production
Backupの取得・実Production Restoreはまだ実施していない。**

関連文書: [[reference-data-backup-decision.md]](既存の行単位before snapshot方式、本設計の前段)・
[[reference-data-promotion-rollback-validation.md]]・[[reference-data-backup-manifest.md]]・
[[reference-data-backup-restore-runbook.md]]・[[reference-data-backup-restore-validation.md]]

**関連(2026-09-20追記)**: 本文書6章のProduction Backup gate(17項目)は、
[[reference-data-production-backup-security-model.md]]で追加11項目(Environment承認・
read-only role・Secret scope等、計28項目)へ拡張した。read-only資格情報・Secret設計は
[[reference-data-production-backup-credentials.md]]、保管先・Retentionは
[[reference-data-production-backup-storage.md]]、本人承認workflowの運用手順は
[[reference-data-production-backup-approval-runbook.md]]、脅威モデルは
[[reference-data-production-backup-threat-model.md]]を参照。

**関連(2026-09-21追記)**: 保管先をCloudflare R2 Standardに確定し、Storage adapter・
Object key・checksum検証・Token最小権限設計を[[reference-data-production-backup-r2-adapter.md]]に
記録した。

実装コード: `src/lib/reference-data/auto-update/backup-target.ts`・`backup-schema.ts`・
`backup-checksum.ts`・`backup-manifest.ts`・`backup-encryptor.ts`・`backup-sql.ts`・
`backup-orchestrator.ts`・`backup-restore.ts`・`backup-gate.ts`・`backup-sql-audit.ts`
(すべて純関数・実DB接続コードなし、fakeクライアントで実証済み)。GitHub Actions向け実PostgreSQL
検証: `backup-restore.postgres.test.ts`(このセッションでは未実行、後述)。

## 1. 既存のbefore snapshot方式との関係

[[reference-data-backup-decision.md]]で確定した「行単位before snapshot(C) + source metadata
snapshot + inverse operation plan(E)」は、**特定job・特定行だけを正確に戻す**ためのPromotion
rollback専用の仕組みであり、今回のfull-table Backupとは目的が異なる。両者は排他ではなく併用する:

| | 行単位before snapshot(既存) | full-table Backup(本設計) |
|---|---|---|
| 目的 | 特定jobのrollback | テーブル全体の障害復旧 |
| 粒度 | 変更対象行だけ | 対象4テーブル全行 |
| 保存場所 | `reference_data_ops.promotion_before_snapshots`(DB内) | 暗号化ファイル(DB外、Artifact等) |
| 取得タイミング | Promotion transaction内 | Promotion apply直前(独立) |
| 復元方法 | 明示rollback transaction | 別DB/別schemaへのRestore |

## 2. Backup方式の比較

| 方式 | 概要 |
|---|---|
| A. `pg_dump` custom format | バイナリ形式、`pg_restore`が必要 |
| B. `pg_dump` plain SQL | テキストSQL、`psql`で再生可能 |
| C. Supabase CLI `db dump` | Supabase CLIのラッパー、内部は`pg_dump` |
| D. `COPY`による参照テーブル単位Export | CSVまたはバイナリ形式 |
| E. JSON/JSONLによるアプリ独自Export | `SELECT`結果をアプリ側でシリアライズ |
| F. 行単位before snapshot | [[reference-data-backup-decision.md]]と同一(比較のため再掲) |

| 観点 | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| schema復元 | 可能(dump内に含む) | 可能 | 可能 | 不可(データのみ) | 不可(データのみ) | 不可 |
| data復元 | 可能 | 可能 | 可能 | 可能 | 可能 | 部分的(該当行のみ) |
| constraints/indexes | dump内で復元 | dump内で復元 | dump内で復元 | 別途DDL必要 | 別途DDL必要 | 該当なし |
| RLS/policies/grants | dump内に含み得る(設定次第) | 同左 | 同左 | 含まない | 含まない | 該当なし |
| table ownership | dump内に含み得る | 同左 | 同左 | 含まない | 含まない | 該当なし |
| partial restore | 困難 | 困難 | 困難 | テーブル単位で容易 | テーブル単位で容易 | 行単位で容易 |
| full restore | 容易 | 容易 | 容易 | テーブル単位の積み上げ | 同左 | 不可 |
| size | 中〜大 | 大(冗長) | 中〜大 | 小〜中 | 小〜中(JSON冗長分) | 最小 |
| checksum | 標準では無し(別途付与) | 同左 | 同左 | 自前で付与容易 | 自前で付与容易 | あり(既存) |
| encryption | 別途必要 | 別途必要 | 別途必要 | 別途必要 | 別途必要 | DB自体の暗号化に依存 |
| PostgreSQL version互換性 | serverと`pg_dump`のversion整合が必要 | 同左(SQLはやや互換性が高い) | Supabase側管理 | 依存しない(SQL標準の`SELECT`のみ) | 依存しない | 依存しない |
| Production資格情報 | 直接接続必須、`pg_dump`バイナリも必要 | 同左 | Supabase CLIの認証が必要 | 直接接続必須(SELECTのみ) | 同左 | 実行roleと同一 |
| GitHub Actions適合性 | `pg_dump`のバージョン管理が必要 | 同左 | Supabase CLIのインストールが必要 | 追加バイナリ不要(`pg`パッケージのみ) | 同左 | 追加不要 |
| Supabase Free適合性 | 可能(自前接続) | 可能 | 可能 | 可能 | 可能 | 可能 |
| user data混入リスク | 対象をreference_dataに限定すれば低いが、dump単位がschema全体になりがち | 同左 | 同左 | テーブルを明示するため最も低い | 同左 | 最も低い(job単位) |
| restore検証可能性 | `pg_restore --list`等で検証可能だが別ツール | 同左 | Supabase側ツールに依存 | アプリ内でchecksum検証を完結できる | 同左 | 既存で実証済み |
| 運用負担 | `pg_dump`/`pg_restore`のversion管理・バイナリ配布が必要 | 同左 | Supabase CLIのversion管理が必要 | 既存の`pg`パッケージだけで完結 | 同左 | 追加負担なし(既存機構) |

## 3. 採用方式(第一候補): E(JSON/JSONLによるアプリ独自Export)+ D の思想を反映した allowlist限定

**データ本体はアプリ独自のJSONシリアライズ(E)を採用し、schema contract(構造そのもの)は
バックアップに含めず、リポジトリ内DDL(`docs/production-readiness/sql/create-reference-data-schema.sql`)
で管理する。**

理由:
- A/B/Cは`pg_dump`本体または`Supabase CLI`という外部バイナリへの依存を追加することになり、
  GitHub Actions runnerでのversion管理・Production PostgreSQLサーバー側とのversion整合確認という
  新たな運用負担が生じる。今回は「package追加・依存追加をしない」という制約とも整合しない。
- D(COPY)はバイナリ/CSV形式であり、jsonb・text[]列の型情報をアプリ側で正しく再構成するには
  結局アプリ側の変換ロジックが必要になる。E(JSON)を採用すれば、この変換ロジックを
  Promotionで既に実証済みの`canonicalizeFieldsForComparison`/`mapFieldsToParams`と同じ設計
  (`toPortableBackupRow`/`mapBackupFieldsToParams`)でそのまま賄える。
- Eは`pg`パッケージの`SELECT`だけで完結し、Node.js標準の`JSON.stringify`/`crypto`だけで
  checksum・暗号化まで一貫して実装できる(新規パッケージ追加が不要)。
- schema自体(テーブル定義・制約・インデックス・RLS・ポリシー・GRANT)をBackupファイルに
  含めない設計にすることで、Backupファイルの内容から「複製可能なProduction構造の詳細」が
  漏れるリスクを構造的に減らせる(schema定義はこのリポジトリのDDLファイルという、既に
  アクセス制御された場所で管理する)。

対象は`reference_data`の4テーブル(`world_player_cards`・`managers`・`player_card_analysis`・
`import_batches`)だけに**allowlist固定**する(`backup-target.ts`、`real-import-guards.ts`の
`ALLOWED_TARGET_TABLES`をそのまま再利用)。スキーマ名・テーブル名を外部入力から自由に指定できる
設計は採用していない。

既存の行単位before snapshot(F)は、Promotion rollback専用として引き続き維持し、本設計の
full-table Backupはこれを置き換えない(1章参照)。Supabase platform backupは、[[reference-data-backup-decision.md]]
と同様に補助条件として扱う。

## 4. Backup manifest / checksum

詳細は[[reference-data-backup-manifest.md]]を参照。要点:

- 秘密情報(host・Project ID・database名の生値・username・password・接続文字列・token・key・
  利用者データ・メールアドレス)は一切含めない設計であり、`assertManifestHasNoSecrets`で
  自己点検する(`backup-manifest.ts`)。
- checksumは`computeRecordChecksum`(`diff.ts`、Promotionで既に実証済み)をそのまま再利用し、
  列順序・行順序に依存しない決定的な値にする。`updated_at`は除外しない(Promotionのbefore
  snapshotとは異なり、Backupは「取得時点の正確な複製」が目的のため)。
- テーブル単位checksum・total checksum・source metadata checksum(各テーブルの`source`・
  `dataset_version`列の値から導出、新規テーブルを追加しない)の3層で検証する。

## 5. 暗号化設計

詳細な比較は`backup-encryptor.ts`のコード内コメントを参照。要点:

**Production向けの第一候補は`age`(非対称鍵暗号)である。** GitHub Actions側は公開鍵だけを
保持すればよく、復号能力(秘密鍵)を一切持たない設計にできるため、CI側のSecret漏洩が
Backup内容の漏洩に直結しない。復号は常に本人がローカルで秘密鍵を使って行う。`age`は単一の
小さいバイナリで、Windows/Linuxいずれでも復号操作が単純という利点もある。

代替案として、対称鍵暗号(GPG・OpenSSL AES-256-GCM)も比較したが、いずれもGitHub Secretsに
「復号に使える鍵そのもの」を置く必要があり、CIのSecret漏洩がBackup内容の漏洩に直結する
(`age`より秘密情報の取り扱い範囲が広い)。GitHub Artifactの保存時暗号化だけに依存する案・
S3互換ストレージのserver-side encryptionだけに依存する案は、いずれも「保管先の権限設定ミス」
がそのままBackup内容の露出に直結するため、client-side encryptionと併用しない限り採用しない。

このセッションで新規package・外部バイナリを追加しない方針のため、隔離PostgreSQL検証では
Node.js標準`node:crypto`のAES-256-GCM(`NodeAesGcmEncryptor`)を代替実装として使用した。
GCMの認証タグにより、改ざん・誤った鍵での復号を確実に検出できることを`backup-encryptor.test.ts`・
`backup-restore.test.ts`で確認済み。**Production用の鍵・パスフレーズはこのセッションで
生成・使用していない**(`generateEphemeralTestKey()`は隔離検証専用の使い捨て鍵)。

## 6. Production Backup gate(Production apply前の最低要件)

`backup-gate.ts`の`evaluateProductionBackupGate`/`decideProductionBackupGate`が実装する17項目
(target allowlist確定・backup command確定・PostgreSQL client version適合・read-only source
connection・backup checksum成功・manifest生成成功・encryption成功・平文dump削除成功・storage
upload成功・storage checksum成功・**Restore試験成功**・**Restore後checksum一致**・retention設定済み・
decryption手順確認済み・backup owner確認済み・approval artifact一致・rollback plan一致)を
**すべて満たさない限り`decision: "blocked"`とする**。

**Backupを取得しただけ(暗号化・アップロードまで成功しただけ)ではreadyにしない。** Restoreを
実際に実証し、Restore後checksumが一致して初めて`restoreVerified: true`として扱う
(`decideProductionBackupGate`の`restoreTestSucceeded`/`restoreChecksumMatched`項目、
`backup-gate.test.ts`で確認済み)。

このgateの結果は、`production-preflight.ts`の`ProductionApplyIntent.backupConfirmed`へ
`deriveBackupConfirmedFromGate(result)`として渡すことを想定している。`production-preflight.ts`
自体はこのセッションで変更していない(既存の確定済みゲート構造をそのまま維持する)。

## 7. Artifact方針(Backupファイルの保管)

このセッションのUnit Test・隔離PostgreSQL検証では、Backup Artifactを永続化しない
(fakeクライアント・実PostgreSQL隔離schemaの中でだけ生成・検証し、テスト終了時に破棄する)。

Production運用案(将来、独立した承認事項):
- Backupを Gitへコミットしない、public repositoryへ保存しない。
- client-side encryption(6章の`age`)後のファイルだけを保存する。
- retentionを明示し、期限切れ後は安全に削除する。
- download権限を限定する(Production Backupは本人だけがアクセスできる場所に置く)。
- checksumとmanifestは保管し、Restore試験の実施履歴も保持する。
- GitHub Artifactだけを唯一の長期保管先にしない(GitHub Artifactの既定retentionは短く、
  長期保管には別のストレージが必要)。

## 8. 誠実な限界の開示

- ここまでの実装・Unit Testは、fakeクライアント(`FakeEncryptor`・`NodeAesGcmEncryptor`+
  `generateEphemeralTestKey`・in-memoryのfake `QueryClient`)だけで検証した。
- `backup-restore.postgres.test.ts`(GitHub Actions向け実PostgreSQL検証)は、このセッションでは
  **一度も実行していない**(ローカルWindows環境にPostgreSQLが存在しないため)。GitHub Actions上
  での実行結果は別途確認が必要。
- 実Production Supabaseへの接続・実Production Backupの取得・実Production Restoreは、
  このセッションでは一切行っていない(独立した承認事項)。
- `age`によるProduction向け実装(公開鍵・秘密鍵の生成、GitHub Actionsへの公開鍵配置、
  復号手順のローカル実行)は、このセッションでは一切行っていない(設計・比較のみ)。
- Production Backup gate(6章)の各項目を実際に`true`にする根拠は、このセッションの時点では
  一切存在しない。`decideProductionBackupGate`は常に`blocked`として扱うべきである。
