# 参照データ自動更新 dry-run 手動実行ランブック(Phase 1)

対象CLI: `scripts/migration/reference-data-auto-update-dry-run.mjs`

このCLIは**常にdry-runであり、`--execute`は存在しない**。実行しても実Supabase・実ネットワークへは
一切接続せず、書込みも行わない(`writesPerformed`は常に0)。

## 1. 実行前に用意するもの(すべてローカルファイル、外部接続なし)

1. **取得結果ファイル(`--staging`)**: 対象テーブルの最新データを表すJSON。
   ```json
   {
     "table": "world_player_cards",
     "sourceMeta": {
       "source": "efootball-world.com",
       "sourceUrl": "https://efootball-world.com/api/proxy/v1/api/players/search",
       "fetchedAt": "2026-09-19T00:00:00.000Z",
       "httpStatus": 200,
       "contentType": "application/json",
       "contentLength": 123456
     },
     "records": [{ "id": "wc-1", "fields": { "nameEn": "...", "ovrMax": 90 } }]
   }
   ```
   現時点では、既存の`scripts/sync-world-players-incremental.mjs`等の出力をこの形式へ
   手動で変換する必要がある(自動変換は未実装、`reference-data-auto-update-design.md`4章参照)。
2. **前回スナップショットファイル(`--previous`)**: 直近の本番相当データのID・checksumだけの一覧。
   ```json
   { "table": "world_player_cards", "records": [{ "id": "wc-1", "checksum": "..." }] }
   ```
3. **スキーマ設定ファイル(`--schema`)**: 対象テーブルのID形式・必須フィールド・数値範囲・既知フィールド。
   ```json
   {
     "idPattern": "^wc-\\d+$",
     "requiredFields": ["nameEn"],
     "numericRanges": [{ "field": "ovrMax", "min": 40, "max": 99 }],
     "knownFields": ["nameEn", "ovrMax"]
   }
   ```

## 2. 実行

```
node scripts/migration/reference-data-auto-update-dry-run.mjs \
  --staging path/to/staging.json \
  --previous path/to/previous.json \
  --schema path/to/schema.json
```

任意オプション: `--max-decrease-ratio 0.05`(既定5%)、`--max-increase-ratio 0.1`(既定10%)、
`--max-removed-count 9999999`(既定は事実上無制限、必要に応じて具体的な上限を指定する)。

## 3. 結果の読み方

- `decision: apply-candidate` — 安全ゲートを通過。ただし**このCLIは書込みを一切行わない**。
  実際にSupabaseへ適用するには、Phase 2の人承認付き適用処理(未実装)が必要。
- `decision: reject` — いずれかの安全ゲートで拒否。`理由:`欄に具体的な拒否理由が列挙される。
  この場合、既存の本番データは一切変更されていない(そもそも書込み経路が存在しない)。
- 終了コード: `apply-candidate`なら0、`reject`またはエラーなら非0。CIやスクリプトから
  呼び出す場合は終了コードで判定できる。
- 標準出力の末尾に監査ログエントリー(JSON)が出力される。秘密情報(接続文字列・APIキー等)は
  含まれない設計(`sanitizeErrorMessage`によるマスキングを適用済み)。この出力を
  ファイルへ保存する場合は、保存先がリポジトリ外(または`.gitignore`対象)であることを確認する。

## 4. 異常時の対応

- CLIがエラーで終了した場合(引数不足・JSON形式不正等)、標準エラー出力にエラーメッセージが
  表示される。既存の本番データ・ローカルファイルへの影響は一切ない(読み取り専用)。
- `decision: reject`は失敗ではなく「安全側に倒れた」正常な結果である。理由を確認し、
  取得元データそのものに問題がある場合は取得元を再確認し、閾値設定が厳しすぎる場合は
  `--max-decrease-ratio`等を見直す(ただし閾値の緩和は人が意図を持って行うこと)。

## 5. Phase 2: 承認付き適用(ローカル合成SQLite専用、実Supabaseへは一切接続しない)

対象CLI: `scripts/migration/reference-data-auto-update-apply.mjs`

このCLIは`--sqlite-db`で指定したローカルの一時SQLiteファイルだけを対象とする(Supabase/Postgres
への接続コードは含まれていない)。`--production`・`--force`・`--skip-validation`・`--no-lock`・
`--no-rollback`・`--execute`・`--yes`はいずれも存在せず、指定すると即座にエラー終了する。

### 5.1 必要なファイル(Phase 1のstaging/previous/schemaに加えて)

- **ジョブメタデータ(`--job`)**: `{"jobId": "...", "table": "world_player_cards", "schemaVersion": "v1", "datasetChecksum": "..."}`
- **承認artifact(`--approval`)**: `{"jobId": "...", "datasetChecksum": "...", "diffChecksum": "...", "schemaVersion": "v1", "approvedAt": "...", "approvedBy": "...", "nonce": "...", "expiresAt": "...", "expectedCounts": {"added": 0, "updated": 1, "removedCandidate": 0}}`。
  `diffChecksum`は対象データの実際の差分から計算される値と完全一致しなければならない
  (推測やダミー値では通らない)。まずPhase 1のdry-run CLIで差分を確認してから作成すること。

### 5.2 実行

```
node scripts/migration/reference-data-auto-update-apply.mjs \
  --sqlite-db path/to/local-temp.sqlite \
  --staging path/to/staging.json --previous path/to/previous.json --schema path/to/schema.json \
  --job path/to/job.json --approval path/to/approval.json
```

`decision: commit`なら、指定したローカルSQLiteファイル内の`target_records`テーブルへ反映される
(**このファイルはローカルの一時ファイルであり、実Supabaseとは無関係**)。`decision: rollback`なら
一切書き込まれない。

### 5.3 明示rollback(成功適用後のundo)

```
node scripts/migration/reference-data-auto-update-apply.mjs \
  --sqlite-db path/to/local-temp.sqlite \
  --rollback-plan path/to/rollback-plan.json
```

`rollback-plan.json`: `{"jobId": "...", "beforeSnapshot": [...], "addedIds": [...]}`。

### 5.4 Production未実装の明示

このCLI・関連コードはローカル合成SQLiteでの実証専用であり、実Supabaseへの適用経路は
今回一切実装していない。Production適用には、少なくとも次が別途必要(いずれも今回未着手):
Production向けstaging schemaの設計・作成、PostgreSQL版UPSERT/UPDATE SQLの実装、
`pg_try_advisory_xact_lock`への実接続、Secret/認証情報の安全な管理方式の確定。

## 5.5 PostgreSQL隔離検証(GitHub Actions専用、ローカルでは実行しない)

`apply-orchestrator.postgres.test.ts`は通常の`npx vitest run`には含まれない。実行するには
PostgreSQLへ接続可能な環境で明示的に次を実行する(ローカルWindows環境にPostgreSQLが無い場合は
実行できない、実行しないこと):

```
PHASE2_TEST_PG_HOST=localhost PHASE2_TEST_PG_PORT=5432 \
PHASE2_TEST_PG_USER=phase2_test_user PHASE2_TEST_PG_PASSWORD=<任意のテスト用値> \
PHASE2_TEST_PG_DATABASE=phase2_test_db \
npx vitest run --config vitest.postgres.config.ts
```

GitHub Actions上では`reference-data-postgres-validation`ジョブが、ジョブ限定の一時
PostgreSQL service containerに対してこれを自動実行する(詳細:
`reference-data-auto-update-postgres-validation.md`)。

## 5.6 Production preflight・apply・rollback(設計のみ、未接続・未適用)

Production(Supabase)向けのstaging schema・最小権限方式・接続前後のpreflight・apply/rollback
手順は、`reference-data-production-security-model.md`・`reference-data-production-preflight.md`・
`reference-data-production-apply-runbook.md`・`reference-data-production-rollback-runbook.md`を
参照。**いずれも設計のみであり、このランブックの対象であるローカル/GitHub Actions検証とは異なり、
実Production接続コードは実装されていない(`createProductionAdapter()`は意図的な未実装)。**

## 5.7 Backup方式・Promotion設計・rollback検証(隔離PostgreSQL専用、2026-09-20追記)

Production apply前に必要なbackup方式の確定、`reference_data_ops_test`(staging)から
`reference_data_test`(確定相当)への昇格SQL設計・実装、自動/明示rollbackの検証は、
`reference-data-backup-decision.md`・`reference-data-promotion-design.md`・
`reference-data-promotion-rollback-validation.md`を参照。**対象は隔離テスト専用schemaのみ、
実Production reference_data/reference_data_opsへの適用は一切行っていない。**

## 6. このランブックが対象としないこと

- 実際の外部データ取得(`scripts/sync-*.mjs`の実行そのもの)。
- 実Supabaseへの適用(今回のPhase 2はローカル合成SQLiteのみ、Production適用は将来の別タスク)。
- Cron・スケジュール実行(Phase 3、今回は有効化しない)。
