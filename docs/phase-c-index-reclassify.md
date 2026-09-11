# Phase C 索引 異常判定の補正レポート

実行日時: 2026-08-27T21:51:56.483Z
DB: data\efootball.db
外部アクセス: 0 回（既存 DB 行のみで再判定）

## 背景
- 初回索引同期の異常ルールに `short id (< 10桁)` を含めていたのが誤り。
  eFHUB の選手ID は「短いID（2〜8桁・標準カード）」と「長いID（14〜15桁・特殊カード）」の2レンジがあり、
  短いIDのカード（Mbappe 110718 / Haaland 133543 / C.Ronaldo 4522 等）を **34,088件も誤検出**していた。
- 修正後ルール（`scripts/sqlite/db.mjs` classifyIndexAnomaly）: invalid id / 両名空 / ovr 欠損or<1 / **ovr >= 115**。

## 再判定結果
- 対象行: 47479
- 異常 → 正常 に変更: **34086**
- 異常のまま（理由更新）: 2
- 正常 → 異常 に変更: 0
- 変更なし: 13391

## 補正後の異常エントリ（全 2 件）

| efhub_card_id | name_en | ovr | reason |
|---|---|---|---|
| 8554053 | Ismail Nasrallah | 120 | ovr >= 115 (likely template entry without a normal detail page) |
| 8554076 | Safi Belal | 120 | ovr >= 115 (likely template entry without a normal detail page) |

## detail_sync_status 分布（補正後）
```
{
  "anomalous": 2,
  "fetched": 19,
  "pending": 47458
}
```
- 異常（is_anomalous=1）: 2
- Phase D の詳細取得対象（detail_sync_status='pending' AND is_anomalous=0）: **47458**

## sync_errors の整理
- 誤記録（"index anomaly: short id …"）を SUPERSEDED マーク: 20 件（DELETE せず UPDATE）
- 補正後の真の異常を追加記録: 2 件

## 既存19カードの保護
```
事前: {"player_cards":19,"player_card_stats":494,"player_card_skills":179,"player_card_com_skills":34,"player_card_positions":76,"player_card_boosters":38}
事後: {"player_cards":19,"player_card_stats":494,"player_card_skills":179,"player_card_com_skills":34,"player_card_positions":76,"player_card_boosters":38}
```
- player_cards 系6テーブル 不変: **true**

## テーブル件数（最終）
```
{
  "parser_versions": 2,
  "player_cards": 19,
  "player_card_stats": 494,
  "player_card_skills": 179,
  "player_card_com_skills": 34,
  "player_card_positions": 76,
  "player_card_boosters": 38,
  "sync_runs": 4,
  "sync_errors": 23
}
```

