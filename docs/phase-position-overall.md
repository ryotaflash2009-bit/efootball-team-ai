# フェーズ: 育成後ポジション別総合値（Position Overall）の調査

調査日: 2026-08-30 ／ 実装可否: **Phase A（調査）のみ完了。Phase B（計算エンジン）は証拠不足のため未実装。**

## 1. 調査目的

育成スライダーを変更したときに、各ポジション（CF / SS / LWF / RWF / AMF / CMF / DMF / LMF / RMF / LB / RB / CB / GK）の
総合値を即時更新して表示する。ただし算式・重み・適性補正・丸め規則を推測で作らない。

## 2. 現在データ

| データ | 範囲 |
|---|---|
| `registered_position` | 全 13,009 カード |
| カード全体 `ovr_base` / `ovr_max` | 全カード |
| World 26 能力値 / 育成後 26 能力値 / 固定ブースター / Power of Many / 監督補正 | 計算エンジンで算出可能 |
| `player_card_positions`（`position_code` / `familiarity` / `is_registered`） | **eFHUB 詳細 19 カードのみ** |
| **per-position の OVR 数値** | **どのソースにも無し** |
| **per-position の能力値重み** | **どのソースにも無し** |

## 3. 内部調査（読み取り専用）

### 3-1. SQLite 全テーブル・全列走査

`ovr` / `rating` / `overall` / `weight` / `score` / `position` / `proficiency` / `familiarity` / `_json` / `raw` / `snapshot` を含む列を全 47 テーブルで検索:

- `player_card_positions`: `position_code`, `familiarity`（null / 1 / 2）, `is_registered`（0 / 1）— **OVR 値なし**
- `world_player_appearances.ranks_json`: **6 つの物理メトリクスの順位のみ**（legCoverageRadius / armCoverageRadius / torsoCollision / jumpingHeight / dribbleHeight / legLength）。ポジション別 OVR は含まない
- `world_player_cards`: `card_rating`（カード全体のレターグレード）、`average_rating` / `total_ratings`（ユーザー評価）— per-position OVR ではない
- `source_snapshots.sample_json`: 229 文字・position / ovr / rating キーワードなし
- **World の生カード JSON は保存されていない**（正規化済み・列展開のみ）
- `data_conflicts.field_name`: `ovr_max` / `level_cap` / `playing_style` / `ovr_base` のみ

→ **per-position の OVR 数値・能力重みは SQLite に存在しない。**

### 3-2. 既存コードの再監査（`src/lib/progression/calculate-rating.ts`）

- `POSITION_WEIGHTS`（13 ポジションの暫定重み）が存在するが、ソースコメントに
  「**暫定の重み**」「**ゲーム内 OVR とは一致しません**」「公式の OVR 計算式は未確認」と明記。
- `estimateOvr(stats, position)`: 正規化加重平均 → `Math.round`。familiarity 補正なし・上限なし・ポジション別だが重みは**推測値**。
- `RatingResult.confidence = "provisional"` / `method = "position-weighted-average (weights are provisional)"`。
- **判定**: これは `screenshot_fitted` にすら達しない **推測値**。§7「名称を変えただけでポジション別 OVR として表示しない」に該当 → 流用不可。
- カード全体の推定 OVR として `ProgressionPanel` に「推定OVR（検証中）」で表示中（現状維持）。

## 4. スクリーンショットサンプル

| screenshotPath | worldCardId | card | registeredPosition | 表示ポジション別 OVR | 状態 | confidence |
|---|---|---|---|---|---|---|
| `./screenshots/スクリーンショット 2026-08-29 014855.png` | 89138556575063 | リオネル・メッシ（97 ST・S+） | SS | ST(SS) 97 / CF 92 / OMF(AMF) 96 / RWG(RWF) 96 / LWG(LWF) 96 / RMF 95 / LMF 95 / CMF 89 / DMF 75 / LSB(LB) 83 / RSB(RB) 83 / CB 66 / GK 43 | 最大レベル + ブースター（正確さ+4 青 / ボールキープ+3 金）+ 監督（A.コンテ・ディフェンスセンス+1）。育成配分 0/62 | 高（画面明記） |

このときの表示 26 能力値（ブースター込み）:
OA 83 / BC 92 / Dr 90 / TP 92 / LP 88 / LoP 86 / Fin 86 / Head 50 / SPT 86 / Curl 89 /
DA 46 / Tack 43 / DE 43 / Agg 43 / GK系 41×5 /
Speed 78 / Accel 83 / KP 84 / Jump 49 / PC 82 / Bal 87 / Sta 74

**得られた検証サンプル: カード 1 枚 × 状態 1 種 × ポジション 13。** 他のスクリーンショット（`image.png` ほか）は
ポジション別 OVR グリッドが画面外またはコメントページで、追加サンプルは 0。

unresolvedFields: 育成前のポジション別 OVR、ブースターなし状態、familiarity 別の同一カード、GK カードの完全グリッド、低 OVR カード。

## 5. 外部調査

外部アクセス **合計 11 リクエスト**（GET のみ・Cookie/Authorization/APIキー/UA偽装なし・リダイレクト非追従・eFHUB/eFootBase 未アクセス・上限 30 内）。

| # | 種別 | 対象 | 結果 |
|---|---|---|---|
| 1 | WebSearch | "eFootball 2027 position overall rating formula weights" | 一般記事のみ・算式なし |
| 2 | WebSearch | "PES overall rating formula reverse engineered position weights reddit" | 該当なし |
| 3 | WebSearch | "efootball position rating calculator per position" | GameMarket.gg 記事（「Overall is a position-weighted average」）にヒット・重み値なし |
| 4 | WebFetch | gamemarket.gg/…/efootball-player-stats-explained | 「Overall Rating は**登録ポジション**用の加重平均。同じ能力でも FB と CF で Overall が変わる」。**算式・重み・丸め・上限の記載なし**（「内部データ」と明記） |
| 5 | WebSearch | "pesmaster efootball position ratings methodology" | pesmastery.com / pesmanager wiki にヒット |
| 6 | WebFetch | pesmanager.fandom.com/wiki/Calculating_Player_Stats | **HTTP 402**（取得不可・再試行せず） |
| 7 | WebFetch | pesmastery.com/pes-player-ratings/ | 「ポジション依存の加重」「**Overall は 100 を超え得る（上限の明記なし）**」。**具体的な重みテーブルなし** |
| 8 | WebSearch | reddit "overall" formula "weighted" attributes exact numbers | 該当なし |
| 9 | WebSearch | "EFScout position overall rating attribute weights" | efscout.app/positions にヒット（重み値の記載は結果に出ず） |
| 10 | WebFetch | efscout.app/positions | JS SPA・本文取得不可（シェルのみ） |
| 11 | WebSearch | "github eFootball overall rating calculator position weights json" | **FIFA 用のみ**。eFootball の per-position 重みを公開したリポジトリ／スプレッドシートは見つからず |

## 6〜11. 候補算式 / 能力重み / 適性補正 / familiarity / 丸め / 上限

| 項目 | 判明したこと | 証拠レベル |
|---|---|---|
| **候補算式** | 「登録ポジション用の能力値加重平均」（複数の外部解説が一致） | `community_formula`（方向性のみ） |
| **能力重み / ポジション別重み** | **具体的な数値・テーブルはどこにも公開されていない** | `unresolved` |
| **OVR 正規化 / 定数項** | 不明 | `unresolved` |
| **丸め処理** | 不明（floor / round / ceil 未確認）。カード全体 OVR は整数表示だが `94.07` のような小数表示例あり（screenshot 194846） | `unresolved` |
| **OVR 上限** | **99 ではない**（pesmastery: 「100 を超え得る」／ カード `ovr_max` に 103・105 等あり）。**能力値の 99 クランプとは別ルール** | `external_cross_verified`（方向性） |
| **familiarity null** | 登録ポジション（`is_registered = 1` と対応・全 19 カードで一致） | `external_cross_verified` |
| **familiarity 1** | 副ポジション適性・「弱い方」（例: Nedved の SS = 1、他の副ポジは 2） | `provisional`（意味の段階は暫定） |
| **familiarity 2** | 副ポジション適性・「強い方」 | `provisional` |
| **無適性ポジション** | eFHUB は `player_card_positions` に無いポジションにも OVR を表示（Messi CMF 89 / CB 66 / GK 43）→ 全ポジションで OVR を計算し、familiarity は緑ハイライトの制御に使っている模様。**適性による OVR 減算があるかは未確認** | `unresolved` |
| **適性が能力値補正か OVR 表示補正か** | 未確認 | `unresolved` |

## 12. 検証カード

| カード | ポジション | 完全一致 | ±1 | ±2 | 平均絶対誤差 | 最大誤差 | 反例 |
|---|---|---|---|---|---|---|---|
| （検証実施せず） | — | — | — | — | — | — | — |

**誤差分析を行っていない理由**: 検証サンプルがカード 1 枚のみ。1 枚 13 ポジションに対して 26 能力値の重み（ポジションあたり 8〜12 個の非ゼロ重み）を解くのは大幅に劣決定。1 枚に合わせた式は §8・§13 で禁止。

## 13. 反例

なし（そもそも検証していない）。既存 `calculate-rating.ts` の暫定重みで Messi 014855 の 13 ポジションを概算すると、ST は近いが CB・GK・DMF で大きくずれることが目視で分かる（重みが役割ベースの推測のため）。

## 14. 証拠レベル（§9・§12 分類）

| 分類 | 該当 |
|---|---|
| `official_verified` | なし |
| `external_cross_verified` | 「OVR = 登録ポジション用の加重平均」「OVR 上限は 99 ではない」「familiarity null = 登録」の 3 点（方向性のみ） |
| `community_formula` | 加重平均という枠組み |
| `screenshot_fitted` | なし（サンプル不足で fit すらしていない） |
| `confirmed_formula` | **なし** |
| `high_confidence_formula` | **なし** |
| `provisional_formula` | 既存 `calculate-rating.ts` の `POSITION_WEIGHTS`（役割ベースの推測。UI に per-position では出さない） |
| `unresolved` | 能力重み・正規化・定数・丸め・適性補正・familiarity 補正 |

## 15. 実装可否

**§13 の実装許可基準を満たさない**（1: ポジション重み未確認 / 3: 丸め未確認 / 5-8: 複数カード検証不能 / 13-15: 反例・誤差測定不能）。
→ **正式なポジション別 OVR 計算エンジンは実装しない。**

## 16. 実装した範囲（Phase B は見送り・§21 の代替改善のみ）

- `PositionSuitabilityGrid` の詳細（`<details>`「ポジション別 OVR と適性について」）を強化:
  - 未実装理由を明記（「KONAMI は算式・重みを公開しておらず、複数カードの表示値サンプルも 1 件しか得られていません（推測で算式を作りません）」）
  - **情報源の表記**（登録: eFootball World ／ 副ポジション適性: eFHUB 個別ページ）
  - **適性度の生値テーブル**（ポジション / 区分（登録 or 副ポジション）/ 適性度 (生値) 1 or 2）
  - 適性度 1 / 2 の意味は「暫定解釈」と明記
- 総合値欄は従来どおり「**—（計算規則を確認中）**」。架空値は表示しない。
- `player-analysis.ts` に `positions.familiarityRows` / `positions.source` を追加（純関数・表示専用）。
- `position-overall/*.ts` の計算エンジンは**作成していない**（`rulesVersion` も追加しない）。
- 既存の育成・ブースター・監督計算は 1 行も変更なし。SQLite 書き込み 0。

## 17. 未実装の理由

上記 15 のとおり。特に **検証データがカード 1 枚しかない**ことが決定的。

## 18. rulesVersion

**追加なし**（計算エンジンを実装していないため。§25「実装しなかった場合は不要な rulesVersion を追加しない」）。

## 19. 次に必要な証拠

1. **複数カード（10 枚以上・多ポジション・高/低 OVR・GK 含む）のポジション別 OVR グリッドのスクリーンショット**（ユーザー提供が最短）。
   - 各サンプルに 26 能力値・育成配分・ブースター状態・監督状態を併記。
   - 理想は「同一カードのブースターあり / なし」「育成前 / 後」のペア。
2. KONAMI 公式または独立した複数ソースによる **per-position の能力重みテーブル**。
3. familiarity 1 / 2 / 無適性 での OVR 差（同一能力値の別カードで比較）。
4. 丸め規則（小数 raw → 整数表示）の確定。
5. **次回の最短調査手順**:
   a. ユーザーに「育成タブでポジションを切り替えたスクリーンショット」を 5〜10 枚依頼（Messi 以外・GK・CB・低 OVR を含む）。
   b. 各サンプルの (position, 26 stats, displayed OVR) を `docs/` に表として蓄積。
   c. 登録ポジションのみのサンプルが 8 枚以上そろったら、非負最小二乗で重みを推定し、
      別の 3 枚以上で検証（最大誤差 ±1 以内なら `high_confidence`、独立ソースの重みと一致し反例なしなら `confirmed`）。
   d. `confirmed_formula` になって初めて `src/lib/ratings/position-overall.ts` と `position-overall/2026-08-DD.v1` を実装。

## 20. rulesVersion（再掲）

なし。

## 21. 再監査 2026-08-31（比較画面内育成マイルストーン時・外部アクセスなし）

比較画面内育成の実装にあたり、ワークスペース内に新しい計算根拠が追加されていないか再確認した（外部調査は再実施せず）。

| 確認項目 | 結果 |
|---|---|
| `src/lib/ratings/` ディレクトリ | **存在しない**（`position-overall/*.ts` も無し） |
| `calculate-rating.ts` の `POSITION_WEIGHTS` | **変更なし・依然「暫定の重み」**。`confidence: "provisional"` / `method: "position-weighted-average (weights are provisional)"` / コメント「ゲーム内 OVR とは一致しません」「公式の OVR 計算式は未確認」 |
| `confirmed_formula` の新規追加 | **なし** |
| ポジション別能力重み / 正規化係数 / 定数項 / 丸め規則 | **なし**（未確認のまま） |
| OVR 上限の確定 | **なし** |
| familiarity 1 / 2 / 無適性 の補正の確定 | **なし** |
| GK を含む複数カード検証・rulesVersion | **なし**（検証サンプルは依然カード 1 枚） |

→ **§15・§19 の実装許可基準を引き続き満たさない。正式なポジション別 OVR は実装しない。**
比較画面（`/compare`）の各列「ポジション適性」`<details>` は、登録ポジションを明示しつつ
総合値欄「**—**（計算規則を確認中）」＋ 未確認理由 ＋「現在の育成内容は 26 能力値比較へ反映されています」を表示。
架空値は 0 件。`calculate-rating.ts` の推定 OVR をポジション別欄へ流用していない。
比較画面内育成（スライダー・26 能力値即時反映・URL 復元）は本項目と独立して実装済み（`docs/compare-in-place-training.md`）。

**次に必要な証拠**: §19 のとおり（複数カード 10 枚以上のポジション別 OVR グリッド・per-position 能力重みテーブル・
familiarity 別 OVR 差・丸め規則）。新しい確実な証拠が得られるまで実装しない。
