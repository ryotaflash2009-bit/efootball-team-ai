# eFootball World 全件同期 結果

実行: 2026-08-27T22:58:10.556Z 〜 2026-08-27T22:59:06.738Z
DB: data\efootball.db
状態: **完了**

## 件数
```
{
  "world_player_cards": 13009,
  "world_player_stats": 338234,
  "world_player_skills": 99337,
  "world_player_ai_styles": 28045,
  "world_player_appearances": 13009,
  "world_source_snapshots": 27
}
```
- 完了ページ: 27/27 / 完了カード: 13009/13009
- 成功: 12009 / 失敗: 0 / 重複(ページ内): 0
- world_card_id の重複行: 0

## リクエスト
- 総リクエスト数: 25（この run）+ 2（先行のブラックボックス PRE run: `--max-pages 2` で page 1-2）= **27**（上限 27 以内）
- 新規カード確認の追加1リクエストは未使用（合計 27 / 28）
- HTTP 429: 0 / 403: 0 / 5xx: 0 / timeout: 0
- 平均応答: 205ms / 平均保存: 59ms / 最終間隔: 2000ms（3000ms 開始 → クリーンページ継続で 2000ms へ加速）
- 再開回数: 1（PRE run 停止後、page 3 から再開）
- page 27 は 9 件（13009 - 26×500）。1-26 は各 500 件。

## 整合性
- PRAGMA integrity_check: [{"integrity_check":"ok"}]
- PRAGMA foreign_key_check 違反: 0
- 既存 eFHUB データ:
```
事前: {"player_cards":19,"player_index_entries":47479}
事後: {"player_cards":19,"player_index_entries":47479}
```
- 既存 eFHUB データ不変: true

## 未取得（推測で生成しない）
- 副ポジション適性 / Weak Foot / Form / Injury Resistance / 育成ポイント・規則・自動配分 / Max Level 各能力値 / 監督補正 / Tier
  → すべて null（未確認）。別フェーズで調査。

