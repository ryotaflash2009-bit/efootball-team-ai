# 選手分析レール — 内部データ監査（2026-08-29・第2次）

外部アクセスなしで既存 SQLite・型・コードを精査した結果。
数値は `data/efootball.db` の実測（`scripts` の一時監査で集計。参考画像の値ではない）。

## プレーヤーモデル 11 項目（eFHUB `player_cards.player_model_json`・19 カードのみ）

| 表示名 | 内部キー | 型 | min | max | median | 0 件数 | 収録カード | 情報源 |
|---|---|---|---|---|---|---|---|---|
| 腕の長さ | `armLength` | int | 2 | 10 | 5 | 0 | 19 | eFHUB 個別ページ |
| 肩幅 | `shoulderWidth` | int | 4 | 14 | 8 | 0 | 19 | eFHUB |
| 首の長さ | `neckLength` | int | 3 | 9 | 5 | 0 | 19 | eFHUB |
| 胸囲 | `chestMeasurement` | int | 2 | 10 | 7 | 0 | 19 | eFHUB |
| 首のサイズ | `neckSize` | int | 5 | 14 | 9 | 0 | 19 | eFHUB |
| 肩の高さ | `shoulderHeight` | int | 0 | 10 | 5 | 1 | 19 | eFHUB（**0 は実値**） |
| 脚の長さ | `legLength` | int | 3 | 13 | 8 | 0 | 19 | eFHUB ＋ World `world_player_appearances.leg_length`（全 13,009・min 0 / max 14 / median 8） |
| 太もものサイズ | `thighSize` | int | 3 | 13 | 9 | 0 | 19 | eFHUB |
| ウエストサイズ | `waistSize` | int | 1 | 9 | 6 | 0 | 19 | eFHUB |
| 腕のサイズ | `armSize` | int | 4 | 10 | 7 | 0 | 19 | eFHUB |
| ふくらはぎのサイズ | `calfSize` | int | 3 | 11 | 9 | 0 | 19 | eFHUB |

- 日本語ラベルは screenshots `スクリーンショット 2026-08-29 194846.png` で `player_model_json` のキー順と 1:1 確認。
- 単位・尺度は未確認 → cm 等を付けない。0 と未収録（null / カードなし）を UI で区別。
- eFHUB 詳細のない 12,990 カードは `leg_length` の 1 項目のみ表示可能。

## 物理データ（World `world_player_appearances`・全 13,009・null 0 件）

| 表示名 | 内部キー | 型 | min | max | median | 順位方向 |
|---|---|---|---|---|---|---|
| 脚カバー半径 | `leg_coverage_radius` | float | 151.522 | 203.116 | 175.630 | rank 1 = 最大値 |
| 腕カバー半径 | `arm_coverage_radius` | float | 138.205 | 185.640 | 163.986 | 同上 |
| ジャンプ高 | `jumping_height` | float | 220.259 | 285.667 | 256.620 | 同上 |
| 胴体衝突 | `torso_collision` | float | 44.137 | 57.532 | 50.682 | 同上 |
| 脚の長さ基準の身長 | `dribble_height` | int | 156 | 213 | 183 | 同上 |
| （脚の長さ） | `leg_length` | int | 0 | 14 | 8 | 同上（1 件 0） |

### `ranks_json` の意味（実測で確定）

- 構造: 各メトリクスに `overall`（全 13,009 中）と `position`（同ポジション中）、それぞれ `{ rank, total, topPercent }`。
- **`rank` 1 = 最大値**。実測: 最大 `leg_coverage_radius`(203.116) のカード → rank 1 / topPercent 1。最小(151.522) → rank 13001 / topPercent 100。
- `topPercent` ≒ `round(rank / total * 100)` = 「上から数えた位置の百分率」。
  **「上位◯%」と読むと誤解を生む**（rank 12,733 / 13,009 は「上位 98%」＝実は下位）。
- 当アプリは `topPercent` を使わず、`valuePercentile = round((total − rank) / total × 100)` を「パーセンタイル（100 に近いほど値が大きい）」として表示。
  Messi の脚カバー半径 12,733 / 13,009 → パーセンタイル 2。
- バーは `valuePercentile`%（値が大きいほど長い）。母数 0 ならバーなし。架空の基準値は設定しない。
- 2,000 件サンプルで JSON パース失敗 0 件。

## その他特性

| 表示名 | 内部キー | ソース | ユニーク値:件数（19 カード） | null | 既存日本語対応表 |
|---|---|---|---|---|---|
| 逆足頻度 | `weak_foot_usage` | eFHUB `player_cards`（19 のみ） | 0:2 / 1:9 / 2:4 / 3:4 | 0 | なし（生値表示） |
| 逆足精度 | `weak_foot_accuracy` | 同上 | 1:4 / 2:8 / 3:7 | 0 | なし |
| フォーム | `form` | 同上 | 0:1 / 2:18 | 0 | なし |
| コンディション安定度 | `condition_value` | 同上 | 3:19（**全件同値**） | 0 | なし |
| 怪我耐性 | `injury_resistance` | 同上 | 0:4 / 1:6 / 2:9 | 0 | なし |
| 利き足 / 身長 / 体重 / 年齢 | `preferred_foot` / `height` / `weight` / `age` | World（全カード） | — | 一部 | 事実値（変換不要） |

- 段階の意味（低い/普通/高い等）の確認済みマッピングは **どのソースにも無い** → 内部値のまま表示。
- screenshot 194846 の Messi 1 件（`weak_foot_usage 1` = 「めったに」等）は**1 件だけなので全カード対応表を作らない**。
- `condition_value` は 19 件すべて 3 で分散なし。

## ポジション（`player_card_positions`・19 カード・76 行）

| 項目 | 実測 |
|---|---|
| 登録ポジション | World `world_player_cards.registered_position`（全カード）／ eFHUB `is_registered = 1`（19 カード・各 1 行・familiarity は null） |
| 副ポジション | `is_registered = 0`（57 行） |
| `familiarity` 値別件数 | null:19（＝登録）／ 1:21 ／ 2:36 |
| `is_registered` 値別 | 0:57 ／ 1:19 |
| **ポジション別 OVR（数値）** | **どのテーブルにも列が存在しない**（`world_player_cards` / `world_player_appearances` / `player_cards` / `player_card_positions` を全列走査。position＋OVR/rating を含む列は 0 件） |
| 確認状態 | eFHUB 詳細あり → `suitability_only`（登録＋適性コード）／ なし → `unresolved`（登録のみ） |

## ポジション別 OVR — 再監査の結論（§13・§14）

| 証拠基準（§14） | 判定 |
|---|---|
| A: 既存ソースにポジション別 OVR が明示保存されている | ❌ 該当なし（全テーブル走査で該当列ゼロ） |
| B: 複数カードで能力値と表示 OVR から一意の算式を再現できる | ❌ 表示 OVR（per-position）のサンプルが存在しない |
| C: 既存コード／保存資料に検証可能な計算規則がある | ❌ `calculate-rating.ts` に単一の推定 OVR（`estimatedOvr`）はあるが per-position ではなく、重みは「shape only・検証中」と明記済み。ポジション適性による補正規則も未確認 |
| D: 適性補正・丸めを含め複数カードで表示値と一致する | ❌ 検証対象データがない |

→ **ポジション別 OVR は実装レベル 2（適性のみ）で確定。数値は表示せず「—」＋「ポジション別 OVR は計算規則確認後に追加予定」。**
→ 育成前後・固定ブースター込み・Power of Many 条件反映後・監督補正込みの OVR も、per-position の基準が無いため実装しない（§15）。

### 次に必要なデータ調査

1. eFHUB 個別ページの「育成後ポジション別総合値」表示（screenshot 014855 の CF 92 / ST 97 … の算出元）。robots.txt で再取得不可のため代替が必要。
2. ポジション適性（`familiarity` 1/2）による OVR 減算規則・丸め。
3. per-position の重み（能力→OVR）の公式値。
4. モデル値・状態値の段階表（cm 換算・「低い/普通/高い」）。
5. World 側でのプレーヤーモデル 11 項目・状態値の取り込み可否（`players/search` / カード詳細 API）。
