# フェーズ: 選手分析レール（育成画面 右カラム・2026-08-29）

> **第2次調整（2026-08-29・後刻）** — `docs/phase-player-analysis-detail.md` に内部データ監査を追加。
> - 中央カラム下部の空白対策: **選手スキル / AI・COM プレースタイルを中央カラムへ移動**（`PlayerSkillsPanel.tsx`）。右レールからは削除（二重表示なし）。計算根拠 `<details>` も中央カラムへ。
> - 左カラムの高さ対策: **非 GK カードは GK 育成スライダー 3 本を初期折りたたみ**（`<details>`・`card.registeredPosition === "GK"` 判定）。GK カードは初期展開。配分・ポイントは折りたたみ状態でも state で保持。
> - 右レール = ポジション適性 / 物理データ / プレーヤーモデル / その他特性 の 4 セクションに整理。
> - 物理データの**パーセンタイル表現を修正**: 「上位 98%」（rank 12,733/13,009 は実は下位）は誤解を生むため廃止。`valuePercentile = round((total − rank)/total × 100)` を「パーセンタイル（100 に近いほど値が大きい）」＋「大きさ順位 N / 母数」で表示。バーは valuePercentile%。
> - プレーヤーモデル 11 項目 = 2 列グリッド・0 と未収録を区別・「cm として確認された値ではありません」。
> - その他特性 = 事実値（利き足/身長/体重/年齢）と内部特性値（逆足/フォーム/怪我耐性 = 「内部値 N」）を分離。
> - 3 カラム開始点を 1536px → **1400px**（arbitrary media variant `[@media(min-width:1400px)]:`・左 320 / 中央 minmax(0,1fr) / 右 300）、1536px 以上はより広い 400/340。
> - **ポジション別 OVR は再監査でも数値ソース・算式ともに確認できず**（全テーブル走査で position＋OVR 列 0 件）→ Level 2（適性のみ）維持。


## 目的

1920px 前後で育成画面の右側に空いていた領域を活用し、
育成結果（能力値）と選手特性（ポジション適性・プレーヤーモデル・物理データ・スキル・その他特性）を
同時に確認できる「選手分析レール」を追加した。

**既存の育成計算・ブースター計算・監督補正・保存/復元・比較・スカッドには一切触れていない。**
外部アクセス 0・SQLite 書き込み 0・新規 npm 0。

## スクリーンショット目録の更新

| 相対パス | 参考/現在 | 主な表示内容 | このマイルストーンでの用途 |
|---|---|---|---|
| `./screenshots/スクリーンショット 2026-08-29 194846.png` | 参考(eFHUB) | **新規追加**。ビルド画面下部: スキル（SKILL FX 印付き）・プレーヤーモデル 11 項目（腕の長さ 5 … ふくらはぎのサイズ 10）・物理 5 項目（脚カバー半径 162.0 / 腕カバー半径 152.8 / ジャンプ高 231.0 / 胴体衝突 48.1 / 脚の長さベースの身長 166）・コムスキル（トリックスター / ロングボールエキスパート）・その他スタッツ（逆足頻度 めったに / 逆足精度 最高 / コンディション安定度 小さい / 怪我耐性 中） | プレーヤーモデル 11 項目の日本語ラベル 1:1 確認、物理 5 項目のラベル確認、スキル/COM/特性のセクション分けの参考 |
| `./screenshots/スクリーンショット 2026-08-29 014855.png` | 参考(eFHUB) | ポジション別総合値グリッド（CF 92 / ST 97 / OMF 96 / RMF 95 / CMF 89 / DMF 75 / RWG 96 / LMF 95 / LWG 96 / LSB 83 / CB 66 / RSB 83 / GK 43）・青/金ブースタードロップダウン | ポジショングリッドの配置・強調方法の参考（**数値・配置はコピーせず、実データが無いため OVR は非表示**） |

新規画像で確認できたこと / できなかったこと:
- 確認できた: プレーヤーモデル 11 キーの日本語名（`player_model_json` の各キーと screenshot の並びが 1:1）、物理 5 項目の日本語名、
  スキル・COM スキル・その他特性のセクション分離、逆足/フォーム/怪我耐性が「その他スタッツ」に集約されること。
- 確認できなかった（画像だけでは不可）: ポジション別 OVR の算出規則、モデル値・状態値の段階の意味（cm 換算や「低い/普通/高い」）、
  Skill FX（+ 印）の判別データがカードのどのフィールドに対応するか。→ いずれも正式仕様として断定していない。

## 既存データ監査の結論

| データ | World（全 13,009） | eFHUB 詳細（`player_cards` 19 件・カード ID が長桁で World と一致） |
|---|---|---|
| ポジション別 OVR（数値） | ❌ 未収録 | ❌ 未収録 |
| ポジション適性（副ポジション） | ❌（登録のみ） | ✅ `player_card_positions`（position_code / familiarity / is_registered。適性度の段階は暫定解釈） |
| プレーヤーモデル 11 項目 | ❌（`leg_length` のみ `world_player_appearances`） | ✅ `player_cards.player_model_json` |
| 物理 5 項目（脚/腕カバー半径・ジャンプ高・胴体衝突・脚の長さ基準の身長） | ✅ `world_player_appearances`（100%） | ✅（model_json にも） |
| 物理の順位・上位% | ✅ `world_player_appearances.ranks_json`（100%・全 13,009 での overall/position 順位） | — |
| 選手スキル | ✅ `world_player_skills` | ✅ `player_card_skills` |
| Highlight Skill / Skill FX 判別 | ❌ | ❌ |
| AI・COM プレースタイル | ✅ `world_player_ai_styles` | ✅ `player_card_com_skills` |
| 逆足頻度/精度・フォーム・コンディション安定度・怪我耐性 | ❌ | ✅ `player_cards`（生値のみ・段階の意味は未確認） |
| 利き足・身長・体重・年齢 | ✅ | ✅ |

**代表カードの実値**: Messi `89138556575063` は eFHUB 詳細あり（モデル 11・適性 4・COM 2・状態値あり）。
GK `106788187832737` / Osimhen `106779597991855` は eFHUB 詳細なし（World データのみ）。

## ポジション別 OVR の実装レベル（§28）

- **Level 1（既存ソース値）**: 該当なし。どのソースにも per-position OVR が無い。
- **Level 2（適性のみ）**: ✅ 実装。eFHUB 詳細のある 19 カードは登録＋副ポジション適性を表示。
  その他のカードは「適性未確認（登録ポジションのみ）」。
- **Level 3/4（育成後 OVR・複数モード）**: 根拠不足のため実装せず。
  ポジション別総合値の数値は表示せず「計算規則を確認中」と明記（架空値ゼロ）。

## 実装

### データ層（読み取り専用・すべて任意）

- `src/lib/world/types.ts` — `WorldMetricRank` 型と `WorldAppearance.ranks` を追加。
- `src/lib/world/mappers.ts` — `rowToAppearance` が `ranks_json` をパース（壊れていれば null）。
- `src/lib/world/analysis-repository.ts`（新規）— `getEfhubAnalysisDetail(cardId)`。
  `player_cards` にカード ID が一致し、かつ登録ポジションが World と一致するときだけ
  モデル JSON・`player_card_positions`・`player_card_com_skills`・`player_card_skills`・状態値を返す。
  テーブル未作成・クエリ失敗でも `null` / `[]`。SQLite 書き込みなし。
- `src/lib/world/player-analysis.ts`（新規・純関数）— `buildPlayerAnalysis(worldDetail, efhubDetail | null)`。
  ラベルマップ（`PLAYER_MODEL_LABELS` 11・`PHYSICAL_METRIC_LABELS` 5・`POSITION_GRID_TEMPLATE`）。
  データが無い項目は `confirmation` を付けて返し、コンポーネントは推測しない。

### UI

- `src/components/world/progression/PlayerAnalysisRail.tsx`（新規）— 折りたたみセクション:
  1. ポジション適性（3 列グリッド・登録/適性/部分/情報なしを枠線＋ラベル＋色で区別・OVR は「—」）
  2. 選手スキル（すべて「選手スキル」・AI・COM プレースタイル）
  3. 物理データ（値＋順位バー：`(total − rank) / total`・「全体 N/13,009（上位N%・値の大きい順）・同ポジション …」）
  4. プレーヤーモデル（主要 5 項目＋「すべて表示」で 11・生値・単位なし）
  5. その他特性（逆足/フォーム/怪我耐性 = 生値＋「意味は追加検証中」・利き足/身長/体重/年齢 = 事実値）
- `ProgressionPanel.tsx` — グリッドを
  `lg:grid-cols-[340px_1fr]` → `2xl:grid-cols-[400px_1fr_340px]` に変更。
  レール child は `lg:col-span-2 2xl:col-span-1`（狭幅では能力値の下に全幅、2xl で右 3 カラム目）。
- `src/app/players/world/[worldCardId]/page.tsx` — `getEfhubAnalysisDetail` → `buildPlayerAnalysis` を
  サーバー側で 1 回だけ実行し `analysis` prop で渡す。`PageContainer` を `xwide` → `full`(1720)。

## レスポンシブ（実測に合わせた調整）

サイドバー幅 244px を差し引くと 1280〜1535px では 3 カラムにすると中央能力値が潰れるため、
**3 カラム化は 2xl（1536px 以上）から**。1024〜1535px は 2 カラム（スライダー / 能力値）＋
レールを能力値の下に全幅表示。1024px 未満は縦積み（概要 → ブースター → スライダー → 能力値 → 選手分析 → 計算根拠）。

## テスト

- `src/lib/world/player-analysis.test.ts`（新規・16）— ポジション（登録/適性/部分/none・eFHUB なし・ID 不一致・
  グリッドテンプレート）、モデル（11 項目・world_partial・none・単位を付けない）、物理（5・順位・0/小数・appearance なし）、
  スキル（重複除去・"-" 除去・comSkills 補完・空配列）、特性（生値+raw_unverified・missing・事実値）。
- `scripts/black-box-progression.mjs` — 分析レール 17 項目を追加（86/86 PASS）。
- 全 429 テスト・11 ブラックボックススイート PASS。SQLite 整合性 ok・件数不変。

## 未解決 / 次に必要なデータ調査

- **ポジション別 OVR の計算規則**（Level 3/4）: KONAMI 公式のポジション別 OVR 算式・適性による減算規則が未確認。
  eFHUB 個別ページの「育成後ポジション別総合値」表示ロジックの調査が必要（robots で再取得不可）。
- **プレーヤーモデル値・状態値の段階の意味**: 0〜15 / 0〜3 の生値が何を表すか（cm 換算・「低い/普通/高い」表記）未確認。
- **Highlight Skill / Skill FX の判別**: どのソースにもフラグが無い。
- **プレーヤーモデル 11 項目**: eFHUB 詳細の 19 カード以外は未収録。World 側の取り込み拡張が必要。
- **逆足/フォーム/怪我耐性**: World 側は全カード未収録。
