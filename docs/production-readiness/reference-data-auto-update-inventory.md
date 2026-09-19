# 参照データ自動更新: 既存部品の棚卸し(2026-09-19)

調査方法: リポジトリ内を`import`・`scraper`・`fetch`・`efootball-world`・`efhub`・`reference-data`・
`pg-real-import`・`shadow comparison`・`sync`・`upsert`・`staging`・`sourceMeta`・`fetchedAt`・
`cron`・`workflow_dispatch`・`lock`・`idempotency`・`retry`・`backoff`・`checksum`・`diff`・
`tombstone`等のキーワードで検索し、既存ファイルを実際に読んで分類した(推測で分類していない)。

分類基準:
- **A**: そのまま再利用可能
- **B**: 軽微な修正で再利用可能(主にSQLite専用→Supabase staging対応、初回投入前提→更新前提への一般化)
- **C**: ローカル専用(SQLite書込みが前提で、Supabase自動更新パイプラインには直接組み込めない)
- **D**: 本番自動実行には危険(人の判断・秘匿情報の対話的入力を前提とした設計)
- **E**: 不要または古い(現行のSupabase既定構成には非該当)
- **F**: 未実装

## 1. 外部データ取得スクリプト(`scripts/*.mjs`)

| ファイル | 対象 | 取得元 | 分類 | 備考 |
|---|---|---|---|---|
| `scripts/sync-world-players-incremental.mjs` | World選手カード差分 | `efootball-world.com/api/proxy/v1/api/players/search` | **B** | レート制限(間隔3秒・単一同時実行・20秒タイムアウト・429/403即停止・UA偽装なし・Cookie/認証なし)を既に実装済み。書込み先がSQLite固定のため、Supabase staging(または本CLIが読む中間JSON形式)へ出力を差し替える改修が必要。 |
| `scripts/sync-world-players-initial.mjs` | World選手カード全件初期取得 | 同上 | **B** | 初回投入専用、増分更新には不向き(自動更新では incremental の方を軸にする)。 |
| `scripts/sync-managers.mjs` | 監督データ | `raw.githubusercontent.com/amine250/efootball-managers/main/data/managers.json` | **B** | GET1回・redirect非追跡・20秒・再試行なしを実装済み。SQLite書込み部分の差し替えが必要。 |
| `scripts/sync-player-index.mjs` | 選手インデックス(旧eFHUB系) | efhub系 | **C** | 現行のWorld/Supabase構成とは別系統(レガシー`/players`用)。自動更新の対象としては優先度低。 |
| `scripts/sync-booster-definitions.mjs` / `scripts/sync-booster-resolution.mjs` | 監督ブースター定義・解決 | 手動調査ベース(スクレイピングでなく分析結果の反映) | **D** | 人による確認・分析結果の反映が前提の設計であり、無人自動実行には不向き。 |
| `scripts/sync-player-details-sample.mjs` | 選手詳細サンプル | efootball-world.com | **C** | サンプル抽出用、全件更新用ではない。 |
| `scripts/investigate-*.mjs`(5ファイル) | 各種調査 | 各サイト | **E** | 一度限りの調査記録用。定期実行を前提にしていない。 |
| `scripts/fetch-player-index.mjs` | 旧eFHUB player-index | efhub | **E** | `data-distribution-rights-audit.md`が指摘する「再配布許諾未確認」系統の旧経路。現行のWorld系に置き換え済み。 |

## 2. Supabase投入・検証基盤(`src/lib/reference-data/*.ts`)

| ファイル | 役割 | 分類 | 備考 |
|---|---|---|---|
| `real-import-guards.ts` | 安全ゲート純関数群(件数一致・重複検出・主キー集合一致・孤立参照検出・ID形式検証・SQLite integrity_check・COMMIT/ROLLBACK判定・冪等性ガード・チャンク分割・UPSERT/UPDATE SQL組立・秘密情報マスキング) | **A**(大部分) / **B**(`checkAllTablesEmpty`のみ、初回投入前提のため更新シナリオには不適用) | 今回新設した`auto-update/safety-gates.ts`から`GuardCheck`型・`decideCommitOrRollback`・`sanitizeErrorMessage`を直接re-export/再利用した。 |
| `real-import-orchestrator.ts` | 単一トランザクションでの初回投入オーケストレーション(`QueryClient`インターフェースでテストダブル注入可能) | **B** | `checkAllTablesEmpty`前提・列挙型カラムがWorld/Managers/Analysis固定。更新シナリオ用には「既存行をUPSERT」する別オーケストレーターが必要(`buildUpsertSql`自体はAでそのまま使える)。 |
| `real-import-detail-extension-orchestrator.ts` / `real-import-phase-d-remediation-orchestrator.ts` | 既存行への列追加・UPDATE専用オーケストレーション | **A** | `buildBulkUpdateSql`(型キャスト明示のUPDATE ... FROM VALUES)を使う既存の「差分UPDATE」実装そのもの。自動更新の「更新」ステップの直接のひな型になる。 |
| `migration-transform.ts` / `detail-extension-transform.ts` | SQLite行→PostgreSQL行への変換・フィールド単位の検証 | **B** | 変換ロジック自体はテーブル固有で書き直しが要るが、「検証→変換→ハッシュ計算」という構造パターンは直接踏襲できる。 |
| `name-sort-key.ts` | ソート用派生値の計算 | **A** | 純関数、そのまま再利用可能。 |
| `search-index.ts` | 検索インデックス構築 | **A** | 純関数。 |
| `connection-string-builder.ts` / `pg-ssl-config.ts` / `local-env-file.ts` | 接続文字列組立・SSL設定・ローカルenv読取り | **A** | 既存の安全な接続確立パターンをそのまま踏襲できる(今回のPhase 1では未使用、Phase 2で必要)。 |

## 3. CLIラッパー(`scripts/migration/*.mjs`)

| ファイル | 分類 | 備考 |
|---|---|---|
| `pg-real-import.mjs` | **B** | `--execute`/`--validate-only`/既定dry-runという操作フラグ設計・環境変数経由の秘密情報受け渡し・`secure-connect.ps1`経由の推奨実行方法は、自動更新CLIでもそのまま踏襲すべき安全パターン。初回投入前提の中身はB。 |
| `pg-detail-extension-import.mjs` / `pg-phase-d-remediation-import.mjs` | **A**(パターンとして) | 既存行へのUPDATE適用CLIとして、更新シナリオへの構造的な近さが最も高い。 |
| `phase-d-shadow-compare.mjs` | **B** | SQLite経路 vs Supabase経路の比較ロジックだが、実装は「アプリの実装関数を両方の`WORLD_DATA_SOURCE`で呼んで比較する」という汎用パターン。自動更新後の検証では「更新前スナップショット vs 更新後Supabase」の比較に応用できる(比較対象の取得方法を変える程度の改修)。 |
| `reference-data-migration-tool.mjs` / `run-migration.mjs` | **E** | 汎用移行ツール、現行のPhase D/E運用では個別スクリプトに役割が分散済み。 |
| `secure-connect.ps1` | **A** | 非表示入力・使用後の環境変数削除を行う実行ラッパー、秘密情報の取り扱いパターンとしてそのまま踏襲すべき。 |

## 4. CI/Cron/監視

| 項目 | 現状 | 分類 |
|---|---|---|
| GitHub Actions schedule (`workflow_dispatch`/`schedule:`) | `.github/workflows/ci.yml`は`push`/`pull_request`トリガーのみ。schedule系トリガーは存在しない。 | **F**(未実装) |
| Vercel Cron (`vercel.json`) | `vercel.json`自体がリポジトリに存在しない。Cron設定は一切ない。 | **F**(未実装) |
| Supabase Cron / Edge Function | 参照データ自動更新用のEdge Functionは存在しない(`rls_auto_enable()`はRLS自動有効化専用のSECURITY DEFINER関数であり、参照データ更新とは無関係)。 | **F**(未実装) |
| Observability/アラート | 参照データ更新専用のログ・通知の仕組みは存在しない。 | **F**(未実装) |
| Lock機構(advisory lock等) | 存在しない。今回`auto-update/safety-gates.ts`に`checkLockAcquired`(判定関数のみ)を新設したが、実際のadvisory lock取得処理は未実装。 | **F**(判定ロジックのみA、取得処理はF) |

## 5. 今回新設した部品(Phase 1、前回セッションで追加)

| ファイル | 役割 |
|---|---|
| `src/lib/reference-data/auto-update/types.ts` | 共有型(`StagingDataset`・`PreviousSnapshot`等) |
| `src/lib/reference-data/auto-update/schema-validation.ts` | 取得結果の構造検証・重複ID検出 |
| `src/lib/reference-data/auto-update/diff.ts` | checksumベースの差分計算(追加/更新/削除/不変) |
| `src/lib/reference-data/auto-update/safety-gates.ts` | 更新シナリオ専用の安全ゲート(件数増減率・NULL率増加・未知フィールド・部分取得失敗・ロック・冪等性) |
| `src/lib/reference-data/auto-update/plan.ts` | 上記を統合した「更新計画」生成(書込み0件) |
| `src/lib/reference-data/auto-update/audit-log.ts` | 監査ログエントリー生成(秘密情報マスキング込み) |
| `scripts/migration/reference-data-auto-update-dry-run.mjs` | 手動実行可能なdry-run専用CLI(`--execute`は存在しない) |

## 5b. Phase 2で新設した部品(このセッションで追加、詳細は`reference-data-auto-update-phase-2.md`)

| ファイル | 役割 | 分類 |
|---|---|---|
| `src/lib/reference-data/auto-update/job.ts` | 更新ジョブの状態モデル・許可された状態遷移 | **A**(実装済み・テスト済み) |
| `src/lib/reference-data/auto-update/approval.ts` | 承認artifact検証(checksum・期限・期待件数の完全一致) | **A** |
| `src/lib/reference-data/auto-update/lock.ts` | advisory lock設計・テスト用フェイクアダプター | **A**(Production接続部分は**F**) |
| `src/lib/reference-data/auto-update/tombstone.ts` | 削除候補の連続不在カウント・大量削除即reject | **A** |
| `src/lib/reference-data/auto-update/shadow-comparison.ts` | 適用後検証(期待値との完全一致) | **A** |
| `src/lib/reference-data/auto-update/staging.ts` | ローカル合成SQLite専用DDL文字列(実行コードなし) | 設計のみ(合成環境向け、Production版は**F**) |
| `src/lib/reference-data/auto-update/apply-orchestrator.ts` | 事前ゲート→BEGIN→UPSERT→shadow比較→COMMIT/ROLLBACK | **A**(フェイク+実SQLite両方でテスト済み) |
| `src/lib/reference-data/auto-update/rollback.ts` | 成功commit後の明示undo | **A**(実SQLiteでテスト済み) |
| `src/lib/reference-data/auto-update/sqlite-adapter.ts` | `node:sqlite`用`QueryClient`アダプター(ローカル合成専用) | **C**(ローカル専用、Production非該当) |
| `scripts/migration/reference-data-auto-update-apply.mjs` | 承認付き適用・明示rollbackCLI(`--production`等の禁止フラグは存在しない) | **A**(ローカル合成環境専用) |

## 5c. PostgreSQL隔離検証で新設した部品(このセッションで追加、詳細は`reference-data-auto-update-postgres-validation.md`)

| ファイル | 役割 | 分類 |
|---|---|---|
| `src/lib/reference-data/auto-update/postgres-staging.ts` | GitHub Actions PostgreSQL service container専用DDL(実行コードなし) | 設計のみ(隔離環境向け、Production版は**F**) |
| `src/lib/reference-data/auto-update/postgres-adapter.ts` | 接続安全性強制(localhost限定・Supabaseホスト拒否)+ `?`→`$1`変換 + jsonb正規化アダプター | **A**(接続安全性はUnit Testで、apply/rollback/lockはGitHub Actions実PostgreSQLで実証済み) |
| `src/lib/reference-data/auto-update/apply-orchestrator.postgres.test.ts` | 実PostgreSQL統合試験(通常Unit Testからは除外、専用config経由でのみ実行) | **A**(GitHub Actions専用) |
| `vitest.postgres.config.ts` | PostgreSQL統合試験専用vitest設定 | **A** |
| `.github/workflows/ci.yml`(`reference-data-postgres-validation`ジョブ) | 一時PostgreSQL service containerでの検証ジョブ(`schedule:`なし) | **A** |

## 6. 結論(何が足りないか)

再利用可能な部品(安全ゲート・差分計算パターン・UPDATE SQL組立・CLI設計パターン・秘密情報取り扱い)は
既に豊富に存在する。**今回新たに作る必要があったのはSupabase固定型データ更新のドメイン知識(A/B)
ではなく、それらを「初回投入」ではなく「定期的な差分更新」の文脈で統合する薄い調整層(diff・
更新専用safety gate・plan生成)であり、これは今回`auto-update/`配下として新設した**。

未実装(F)なのは、外部取得スクリプトの出力を本基盤の入力形式へ変換する「glue」部分、実際の
advisory lock取得、Cron登録(Vercel/GitHub Actions/Supabase いずれも)、Edge Function、
通知/アラート経路であり、これらはいずれも今回のPhase 1では意図的に実装していない。
