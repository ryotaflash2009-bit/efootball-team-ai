# 参照データ移行ツール dry-run 結果

実行日時: 2026-09-14T12:16:59.274Z

**このツールは実Supabase・実PostgreSQLへ一切接続していない(dry-runのみ)。正本SQLiteは読み取り専用でのみ使用した。**

## world_player_cards

- 取得元件数(SQLite): 13009
- 検証OK件数: 13009
- 検証NG件数: 0
- 重複ID件数: 0
- dataset_version: world-2026-09-14
- import_batch_id: cabc0b69-6417-48a3-9125-a3dd2c1bac56
- payload_hash: 0d6ea084be4924818ae0e424a17cb2818b4e71e047c9fd534ca2340c5c9fcfa5

## managers

- 取得元件数(SQLite): 66
- 検証OK件数: 66
- 検証NG件数: 0
- 重複ID件数: 0
- dataset_version: managers-2026-09-14
- import_batch_id: 0b3a26a0-1268-49b3-b9c8-ff27f2b031e4
- payload_hash: 03ad15f5f7637b6da1acb73c2fe0e1168b2393fb6b540e412cd926de6724e5ef

## player_card_analysis(player_cards + 3補助テーブルの統合)

- 検証OK件数: 19
- world_player_cardsに存在しないID(除外): 0
- 重複ID件数: 0
- dataset_version: player-card-analysis-2026-09-14
- import_batch_id: 2c07c67e-7964-422c-a366-e9ac526f56cf
- payload_hash: d097441e4d041456cfa05c77b927ac04fa17537fc5825531e843aab8b4a70ac3

## player_index_entries → 検索索引(サーバー内静的アセット)

- 索引エントリ件数(is_anomalous除外後): 47477
- 索引サイズ: 生 4.65 MiB / gzip 1.08 MiB
- サンプル検索("リオ"): ヒット606件中5件を返却

## 出力ファイル一覧(`data/poc-hybrid-migration/migration-dry-run/`、Git追跡対象外)

- managers-invalid.json
- managers.json
- managers.manifest.json
- player-card-analysis.json
- player-card-analysis.manifest.json
- search-index-sample-query.json
- search-index.json
- search-index.json.gz
- world-player-cards-invalid.json
- world-player-cards.json
- world-player-cards.manifest.json

## 実施していないこと(明記)

- 実Supabase・実PostgreSQLへの接続・投入(このツールには接続機能自体が無い)。
- 正本SQLiteへの書込み(readOnly接続のみ使用)。
- 変換結果JSONのGitへの追加(すべて`.gitignore`対象の`/data`配下に出力)。
