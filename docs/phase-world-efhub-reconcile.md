# World × eFHUB 照合レポート

実行日時: 2026-08-27T22:59:19.294Z
DB: data\efootball.db  外部アクセス: 0 回

## 結果
- World カード総数: 13009
- 高信頼一致（source_record_links に登録・internal_card_id 採番）: **1138**（内部カード 1138 件）
- 曖昧（merge_candidates・人間確認待ち・自動統合しない）: World カード 8681 件 / 候補行 24826
- eFHUB 索引にマッチなし（World のみ）: 3190
- 値の不一致（data_conflicts・自動上書きしない）: 59

## 照合キー
- 前提: 正規化英語名（無ければ日本語名）
- 加点: maxOVR 近接 / 登録ポジション一致 / 基礎OVR 近接 / levelCap 一致 / 身長・体重一致（eFHUB 詳細がある場合）
- 高信頼: score >= 0.75 かつ 2位との差 >= 0.15

## 注意
- `source_record_links` は 1,791 行（world 側 1,138 + eFHUB 側 653 ユニーク）。同名・同maxOVR の eFHUB 索引エントリが複数の World カードに一致し得るため、eFHUB 側は world 側より少ない。これらは「確定マージ」ではなく要確認の紐付けであり、能力値ベースの検証は別フェーズで行う。
- eFHUB 索引47,479件のうち多く（レガシーカード）は World（13,009件）に存在しない → World のみ / eFHUB のみ の非対称は想定内。
- eFHUB 詳細は19件のみのため、詳細レベルの競合検出は現状その19件に限られる。
- 能力値の対応は stat_key_map（tackling↔ballWinning など）で行う。能力値の値比較は Phase 次で。
- `player_cards`（eFHUB 詳細19件）は本処理で変更していない。

## stat_key_map（World キー → eFHUB キー）
- `tackling` → `ballWinning`
- `defensiveEngagement` → `trackingBack`
- `gkParrying` → `gkClearing`
- `jumping` → `jump`
（他22キーは同一）

