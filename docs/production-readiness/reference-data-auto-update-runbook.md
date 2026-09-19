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

## 5. このランブックが対象としないこと

- 実際の外部データ取得(`scripts/sync-*.mjs`の実行そのもの)。
- Supabaseへの実際の書込み(Phase 2で別途ランブックを用意する)。
- Cron・スケジュール実行(Phase 3、今回は有効化しない)。
