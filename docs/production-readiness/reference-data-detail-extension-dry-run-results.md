# reference_data 詳細フィールド追加 dry-run 結果

実行日時: 2026-09-15T10:04:46.895Z

**このツールは実Supabase・実PostgreSQLへ一切接続していない(dry-runのみ)。正本SQLiteは読み取り専用でのみ使用した。**
**この投入は既存13,009/66/19件の再投入ではなく、差分列(未移行フィールド)だけを対象にする。**

SQLite integrity_check: ok

## world_player_cards 詳細フィールド

- 対象行数: 13009件(既存world_player_cards全件と同数のはず)
- efhub_card_id 設定件数: 653件
- ai_styles 非空件数: 11558件
- appearance 設定件数: 13009件
- efhub_conflicts 非空件数: 21件
- 孤立参照(world_player_cardsに存在しないID): efhub_link=0 / ai_styles=0 / appearance=0 / conflicts=0
- dataset_version: world-detail-2026-09-15
- import_batch_id: 2e230446-0c8a-4303-b509-00f8a6ec203e
- payload_hash: 2f0249f4b368be33da7a79198928c88cc9b9d0d1f60ecb2a5cbe17c0ae626f4b

## managers 詳細フィールド

- 対象行数: 66件(既存managers全件と同数のはず)
- boosters 非空件数: 64件
- link_up_plays 非空件数: 25件
- 孤立参照: boosters=0 / link_up_plays=0
- dataset_version: managers-detail-2026-09-15
- import_batch_id: 210ddefb-b408-421f-91ac-5506dfe05bfc
- payload_hash: 69dc6d3e182a5a0ac65d3b42ce26f31b8ade576e05bc08e5202b87af5c195c6c

## 実施していないこと(明記)

- 実Supabase・実PostgreSQLへの接続・更新(このツールには接続機能自体が無い)。
- 正本SQLiteへの書込み(readOnly接続のみ使用)。
- 既存13,009件・66件・19件の再投入(今回は差分列のUPDATE対象データを算出しただけ)。
- 変換結果JSONのGitへの追加(すべて`.gitignore`対象の`/data`配下に出力)。
