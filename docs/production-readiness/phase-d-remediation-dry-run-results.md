# Phase D 差分修正 dry-run 結果(name_sort_key / efhub_name_en)

実行日時: 2026-09-15T14:31:47.613Z

**このツールは実Supabase・実PostgreSQLへ一切接続していない(dry-runのみ)。正本SQLiteは読み取り専用でのみ使用した。**

SQLite integrity_check: ok

## name_sort_key 検証(SQLiteのCOLLATE NOCASE実測順序との完全一致確認)

- world_player_cards: 件数=13009 / 完全一致=true
- managers: 件数=66 / 完全一致=true

- world_player_cards: dataset_version=world-name-sort-key-2026-09-15 / import_batch_id=7b8db354-966b-431c-a902-bf499665e11b / payload_hash=810245b778ee9d81670ed0969179f5bafc4c4f2757bc0a21f822e0ae93a6e8c5
- managers: dataset_version=managers-name-sort-key-2026-09-15 / import_batch_id=ef5b4b65-bd8b-4785-9737-3e4c7886cf6a / payload_hash=09161d7f0dada70e532b75851c3223b9ebc1b9992cc602786a0f86485ed3eba6

## efhub_name_en (player_card_analysis)

- 対象行数: 19件(既存player_card_analysis全件と同数のはず、期待値19件)
- 孤立参照(world_player_cardsに存在しないID): 0件
- dataset_version: analysis-name-2026-09-15 / import_batch_id: 950bd642-b246-4e5f-b036-7160d3c7f2f1 / payload_hash: 5053deb43d5235191a65d8e93a5602d08bb9946181bffbc57b219e40908b2765

## 実施していないこと(明記)

- 実Supabase・実PostgreSQLへの接続・更新(このツールには接続機能自体が無い)。
- 正本SQLiteへの書込み(readOnly接続のみ使用)。
- world_player_cards.name_en / managers.name_en の変更(参照するだけで書き換えない)。
- 変換結果JSONのGitへの追加(すべて`.gitignore`対象の`/data`配下に出力)。
