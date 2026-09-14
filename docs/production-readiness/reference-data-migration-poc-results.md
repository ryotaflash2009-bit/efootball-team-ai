# 参照データ移行PoC 結果(ローカル限定、外部送信なし)

実行日時: 2026-09-14T10:04:15.382Z
実行環境: Node v24.20.0(このワークスペース内、実Supabase接続なし)

**注意: 本PoCは正本SQLiteを読み取り専用でのみ使用し、変更していない。変換成果物はすべて`data/poc-hybrid-migration/`(Git追跡対象外)へ出力した。**

## 1. 変換サイズ(生JSON / gzip圧縮後)

| 成果物 | 件数 | 生サイズ | gzip後 | 1件平均(生) |
|---|---|---|---|---|
| player_index_entries フル(47,479件) | 47,479 | 19.76 MiB | 1.44 MiB | 436 B |
| player_index 軽量検索索引(id/名前/OVRのみ) | 47,479 | 3.51 MiB | 1.03 MiB | 78 B |
| world_player_cards フル(stats+skills結合、13,009件) | 13,009 | 28.14 MiB | 2.21 MiB | 2268 B |
| world_player_cards 一覧用軽量版(13,009件) | 13,009 | 3.63 MiB | 0.59 MiB | 292 B |
| 典型的な検索結果100件(1ページ分) | 100 | 0.03 MiB | 0.00 MiB | 285 B |
| 選手詳細1件(フル) | 1 | 0.00 MiB | 0.00 MiB | 2279 B |
| managers フル(66件) | 66 | 0.04 MiB | 0.00 MiB | 640 B |
| player_booster_definitions フル(44件) | 44 | 0.04 MiB | 0.00 MiB | 861 B |

## 2. 検索速度(同一条件・5回平均、CF・OVR80以上・上位100件)

| 方式 | 平均応答時間 |
|---|---|
| SQLite(node:sqlite、インデックスなしの素朴なWHERE) | 3.41 ms |
| インメモリJS配列(Array.filter+sort、一覧用軽量版13,009件を全走査) | 0.55 ms |

## 3. JSON解析時間・メモリ使用量

- 一覧用軽量版(13,009件、3.63 MiB)のJSON.parse: 5.02 ms
- 軽量検索索引(47,479件、3.51 MiB)のJSON.parse: 6.84 ms
- 本PoC実行中のheapUsed増分(概算、GCタイミング依存のため参考値): 173.83 MiB

## 4. SQLiteとの整合性チェック

| 項目 | 結果 |
|---|---|
| player_index_entries 件数一致(期待47,479) | 一致(実測47479) |
| world_player_cards 件数一致(期待13,009) | 一致(実測13009) |
| managers 件数一致(期待66) | 一致(実測66) |
| player_booster_definitions 件数一致(期待44) | 一致(実測44) |
| player_index_entries 重複ID | 0件 |
| world_player_cards 重複ID | 0件 |
| world_player_cards 画像URL欠損 | 0件 / 13009件 |
| world_player_cards 日本語名欠損 | 0件 / 13009件 |
| 日本語名(Unicode)のJSON化・再読込確認 | サンプル: "バーチャット"(88043608522894)が変換後も破損なく保持されることを確認 |

## 5. 出力ファイル一覧(すべて`data/poc-hybrid-migration/`配下、Git追跡対象外)

- booster-definitions-full.json(0.04 MiB)
- booster-definitions-full.json.gz(0.00 MiB)
- managers-full.json(0.04 MiB)
- managers-full.json.gz(0.00 MiB)
- player-index-full.json(19.76 MiB)
- player-index-full.json.gz(1.44 MiB)
- player-index-light.json(3.51 MiB)
- player-index-light.json.gz(1.03 MiB)
- world-card-detail-one.json(0.00 MiB)
- world-card-detail-one.json.gz(0.00 MiB)
- world-cards-full.json(28.14 MiB)
- world-cards-full.json.gz(2.21 MiB)
- world-cards-list.json(3.63 MiB)
- world-cards-list.json.gz(0.59 MiB)
- world-cards-page100.json(0.03 MiB)
- world-cards-page100.json.gz(0.00 MiB)

