# フェーズ: Total Package ブースターの発動条件調査

作成日: 2026-08-28（`phase-player-booster-effects.md` の続き・v6）

> **2026-08-29 追記（用語の再監査・コード変更なし）**
>
> ユーザー指摘（Messi `89138556575063` は Accuracy +4 が青・Ball Protection +3 が金色、Bruno `106799730641209` は両方青）を受けて再調査した。
>
> **確定した事実:**
> - KONAMI 公式 Version Info v3.2.0 は「The Power of Many」を **"a new type of Booster"** = **複数のブースターに付く発動方式**と明記（"a property type applicable to multiple boosters"）。効果量・最大到達に必要な人数は **ブースターごとに異なる**（"The exact value the Booster will add ... will vary according to the Booster. Furthermore, the number of players needed to achieve the maximum value will also vary."）。
> - 別方式として **Live Update Rating 連動**ブースターも存在（B 以上で発動・A で最大）。
> - EFScout `boot.json`: Ball Protection / Accuracy / Aerial / Balancer など**各名称に `color:0 / conditional:false` の通常版と `color:2 / conditional:true` の版が両方存在**する。→ 発動方式は名称付きブースターにも付く。
> - "Total Package"（World `boost1=83`・341 カード）は eFootball / World で literally "Total Package +3" と表示される**実在のブースター名**（EFScout 定義でも全26能力）。それが Power of Many 方式を使っている。
>   → **Total Package は「効果名」であり、かつその1つが Power of Many 方式**。「Total Package = 発動方式そのもの」ではない。
>
> **2026-08-29（同日・後刻）ユーザー実測で確定 → v7 で最小修正:**
> ユーザーが Messi `89138556575063` の金色スロットの段階を下げた eFHUB スクリーンショットを提供:
>
> | | Ball Protection +3（最大） | 段階を下げた状態 |
> |---|---|---|
> | Ball Control | 89 | 88 |
> | Tight Possession | 89 | 88 |
> | Physical Contact | 80 | 79 |
> | Balance | 85 | 84 |
> | 表示OVR | 94 | 93 |
>
> 同じ育成配分・同じ Accuracy +4 のまま、**Ball Protection の対象4能力だけが各 -1**、OVR 94→93。
> → **Messi のスロット2 Ball Protection は固定 +3 ではなく Power of Many 版（金色・最大 +3・Game Plan 人数で +1/+2/+3）。**
>
> **確定した正しいモデル（v7）:**
> - **効果名（`boosterEffectKey`）と発動方式（`activation`）を分離**。
>   - Messi slot1: `accuracy` / `fixed` / +4 / 青 → 既存どおり標準モードへ自動適用。
>   - Messi slot2: `ball-protection` / `power_of_many` / 最大+3 / 金 → 標準自動適用を**停止**。ユーザーが段階（+0/+1/+2/+3）を手動指定 → Ball Protection の対象4能力へだけ「条件反映後値」に試算反映。全26能力へは広げない。カード本来の付属情報は上書きしない。
> - **「Total Package」は独立した効果名（≈全26能力）として維持**。Ball Protection を Total Package へ差し替えることはしない。Total Package（`boost1=83`）も `activation: power_of_many`（既存の `conditional_unverified` / 未適用は不変）。
> - `WORLD_BOOST2_MAP[44]` に `activation: "power_of_many"` を付与（3 カード: Messi / Michael Olise / Kamada Daichi）。他の 27 種の名称付きブースターは**証拠がないため変更しない**（同名でも fixed 版と PoM 版があることは判明したが、実カードに付いている特定 ID が PoM だと確認できたのは boost2=44 のみ）。
>
> **根本的な限界（引き続き）**: World ScoreBar は常に最大効果、EFScout の通常版・PoM 版の `stat_modifiers` は同じ最大値。→ ScoreBar 突き合わせだけでは「固定 +N」と「PoM・最大 +N」を区別できない。boost2=44 以外の World ID は未判別（本ファイル §7）。
>
> **Bruno `106799730641209`**: SQLite 上 `boost1=149`（Balancer +4）/ `boost2=0`。eFHUB の「Aerial +1」は**空きスロット2へのユーザー試算**（カード本来の付属ではない）。スロット2だからといって PoM/金色扱いしない。Balancer / Aerial とも青の fixed。

## 1. 調査目的

341 カード（World `boost1=83` / "Total Package +3"）に付く Total Package ブースターについて、
**発動条件の有無・内容・アプリ内での評価可否・標準モードへの適用可否**を確定する。
数値上の対応率を上げるために証拠基準を下げない。条件を確認できなければ `conditional_unverified` と未適用を維持する。

## 2. 調査前の状態

- `booster-catalog.ts`: `category: special` / `evidenceLevel: conditional_unverified` / `conditional: true` / `maxLevel: 5` / 対象 26 能力。
- eFootball World の ScoreBar 差分で「全 26 能力へ +level」を観測（`verified_card_count = 341`）。
- 発動条件の内容は未確認。通常・標準・厳密・実験のどのモードでも通常の最終値へ未適用。
- 標準適用 1,931 カードには含まれない。

## 3. 既存データ分析（外部アクセス前・SQLite 読み取りのみ）

`node scripts/analyze-total-package.mjs`（読み取り専用・書き込み 0）:

| 項目 | 結果 |
|---|---|
| 対応表 ID | `world_boost1 = 83` の **1 ID のみ**（`boost2` に Total Package なし） |
| 対象カード | **341**（`player_card_resolved_boosters` = 341 = `world_player_cards.boost1=83` = 341） |
| slot | 全 341 が slot1 |
| ブースターレベル | 全 341 が **+3**（他レベルのカード付属は 0。catalog `maxLevel` は EFScout 定義由来の 5） |
| 名称/レベルの相違 | 0（全て "Total Package" +3） |
| デュアルブースター | **0 件**（全 341 が boost1=83 / boost2=0・他ブースターとの組み合わせなし） |
| card_type | SHOWTIME 233 / HIGHLIGHT 99 / BIGTIME 9 |
| 登録ポジション | CF 99 / AMF 55 / CB 45 / GK 37 / CMF 24 / LMF 16 / DMF 12 / RMF 12 / LB 10 / RB 10 / LWF 9 / RWF 9 / SS 3（GK 含む全ポジション） |
| リーグ | J1 118 / Trendyol Süper Lig 75 / Brasileirão 64 / J2 61 / Other 11 / BYD SEALION 6 League 1（タイ）8 / Liga Super Malaysia 4 |
| ovr_max | 95–99: 172 / 90–94: 156 / 85–89: 10 / 80–84: 2 / 75–79: 1 |
| ID 競合 | 0 |
| 「もし +3 を無条件適用したら」99 超過 | **0 件**（level1 基礎値ベース・最大 uncapped 94。※育成後の最大値では一部 +3 で 99 到達・エンジンが 99 クランプ） |
| null / 不正能力値キー | 0 |
| リーグ・国籍・チーム列 | `world_player_cards` に 13,009 件すべて populated |

**示唆**: 341 カードは J.League / Turkish Süper Lig / Brazilian League 等の**リーグ別キャンペーン（Monthly MVP "Show Time" 等）**で配布されたカード群であり、カードのリーグが発動条件のリーグと一致すると推測される。

## 4. 代表カード（外部確認）

少ないアクセスで異なる条件をカバーするため、以下を個別ページで確認（各条件 2 枚以上を意図）:

| world_card_id | 選手 | card_type | pos | クラブ / リーグ | 選定理由 |
|---|---|---|---|---|---|
| 106779597991855 | Victor Osimhen | SHOWTIME | CF | Galatasaray SK / Trendyol Süper Lig | フィールド・攻撃・Turkish |
| 106757586204383 | Ederson Moraes | SHOWTIME | GK | Fenerbahçe SK / Trendyol Süper Lig | GK・2 枚目の Turkish |

内部集計で 341 カードの名称・レベル・slot・対象能力・ScoreBar 差分がすべて一致しているため、
外部の個別ページ確認は 2 枚に留めた（41 リクエスト上限に対し外部合計 14）。

## 5. 外部アクセスログ（合計 14 リクエスト・GET のみ・Cookie/認証/UA偽装なし）

| # | 種別 | URL / クエリ | 取得内容 |
|---|---|---|---|
| 1–3 | WebFetch | `efscout.app/data/boot.json` | `allBoosters` の Total Package 定義（`conditional` フラグ・`stat_modifiers`・`variable`・`color`）、条件本文の有無 |
| 4 | WebSearch | eFootball "Total Package" booster condition all stats | 条件仮説（Game Plan の同一リーグ人数） |
| 5 | WebFetch | `efootball-world.com/player/106779597991855` | ブースター表示・On/Off トグル・条件文の有無 |
| 6 | WebSearch | Konami official help squad ability league condition（konami.com 限定） | 「The Power of Many」ブースター種別 |
| 7 | WebFetch | `konami.com/efootball/en-us/page/2024/versioninfo_v3-20` | 「The Power of Many」節の本文 |
| 8 | WebFetch | `konami.com/efootball/en/topic/promotion/agent/412/` | 404 |
| 9–10 | WebSearch | Power of Many / Game Plan 閾値（konami.com 限定） | 数値閾値 1–13 / 14–19 / 20+ |
| 11 | WebFetch | `konami.com/games/ca/en/topics/2321/` | 「The Power of Many」節（閾値なし） |
| 12 | WebFetch | `konami.com/efootball/en-us/topic/promotion/agent/412/` | 404 |
| 13 | WebSearch | Nakamura Total Package J.League MEIJI YASUDA | S. Nakamura Total Package の閾値・J1→J1+J2 拡張予定 |
| 14 | WebFetch | `efootball-world.com/player/106757586204383` | 2 枚目（GK・Turkish）の確認 |

429 / 403 / CAPTCHA / ログイン要求は発生せず。eFHUB・eFootBase へはアクセスしていない。

## 6. 効果対象・上昇量

- **対象**: 全 Player Stats（Characteristics 系を除く）。当アプリの World 26 能力キー全部。
  - eFootball World の ScoreBar 差分（ブースター ON − OFF）= 全 26 能力へ +3。
  - EFScout `boot.json` の `stat_modifiers` = 26 能力すべてに `[statIndex, +level]`。
  - → 効果候補は外部 2 ソースで整合（`external_cross_verified` 相当）。
- **上昇量**: 一律 +level（+1 / +2 / +3。ただし level は条件で決まる。下記）。

## 7. 発動条件の有無・内容

**条件あり。** KONAMI 公式「The Power of Many」ブースター:

> "By registering in your Game Plan more players that fit the Activation Condition described in the Booster,
> the player in possession of the Booster himself will enjoy a better enhancement in his Abilities."
> "For example, if the Activation Condition is 'J.League', the player ... the more 'J.League' players are registered in the Game Plan."
> （KONAMI 公式 Version Info v3-20「The Power of Many」節）

数値閾値（KONAMI 公式・S. Nakamura Total Package の告知）:

| Game Plan に登録した対象リーグの選手数 | 効果 |
|---|---|
| 1–13 人 | 全対象能力 **+1** |
| 14–19 人 | **+2** |
| 20 人以上 | **+3** |

- **Activation Condition = カードごとに固有のリーグ**（S. Nakamura → MEIJI YASUDA J1 LEAGUE。Léo Ceará / Shoma Doi → J.League MVP。Osimhen / Ederson → Turkish Süper Lig）。
  当アプリの `world_player_cards.league` とおおむね一致すると推測（ただし KONAMI が per-card で明示した対応表はなく、"Other" 11 件・J1↔J2 拡張予定など不確実性あり）。
- "Total Package +3" の **+3 は最大ティアの表記**であり、常時 +3 ではない。

**別種の条件付きブースターも公式に存在**（Total Package ではない）:
「A Booster Linked to Real-Life Player Performance」= Live Update Rating が B 以上で発動、A で最大。

## 8. eFootball World の ScoreBar の解釈

- World の個別ページは「Booster On」/「Booster Off」トグルのみで、**条件の説明文は一切なし**。
- 「Booster On」時の ScoreBar は **条件を無視して最大ティア（+3）を無条件表示**している。
- → **World ScoreBar の +3 は「条件を満たしたときの最大効果」であり、保証値ではない。**
  既存 docs の「World の計算機は条件を無視して適用している疑いがある」を**確認**した。

## 9. EFScout 定義の解釈

- `allBoosters` エントリのフィールド: `id / name / jap_name / color / conditional / variable / stat_modifiers / booster_version`。
- **条件本文・conditionText・activation 等のフィールドは存在しない。** `conditional: true`（真偽値）のみ。
- `conditional` は Total Package 専用ではなく、purple 系（`color: 2`）ブースター約 148 件に付く。
  gold 系（`color: 1`）は `variable: true`。→ EFScout の `conditional` / `variable` は主にブースター item の色ティア区分であり、
  ゲーム内の発動条件そのものを説明しない。
- Total Package の `stat_modifiers` は 26 能力すべて `[idx, 3]`（+3 表記のもの）。`jap_name` は空。

**未解決の派生リスク（本フェーズ範囲外・記録のみ）**: ScoreBar は条件付きブースターでも最大効果を表示するため、
ScoreBar 差分だけでは「条件なし」を証明できない。既存 `external_cross_verified` 27 種は「別カード 2 枚以上・delta==level・反例 0」で判定しており、
EFScout の `conditional` フラグ（color ティア）とは独立。27 種の再監査は行っていない（今回の変更対象外・反例なし）。

## 10. KONAMI 公式情報の有無

あり（Version Info v3-20 の「The Power of Many」節、J.LEAGUE Monthly MVP の告知）。
ブースター種別・発動の仕組み・数値閾値まで公式に説明されている。
per-card の対応リーグ表は公式には見当たらず（カードのリーグから推測）。

## 11. 証拠レベル / 条件確認レベル

効果対象・上昇量と、発動条件は別軸で評価する:

| 軸 | レベル | 根拠 |
|---|---|---|
| effectEvidenceLevel | `external_cross_verified` 相当（+ KONAMI 公式の記述と整合） | World ScoreBar 差分 ＝ EFScout stat_modifiers ＝ 全 26 能力 +level |
| conditionEvidenceLevel | **`condition_external_verified`**（KONAMI 公式 ＋ 複数コミュニティ告知が一致） | 条件の**内容**は判明。per-card の対応リーグは推測 |
| conditionEvaluationAvailable | **false（`condition_unsupported`）** | (a) per-card の対応リーグが KONAMI 公式で確定していない (b) 当アプリのスカッドは 11+ベンチで eFootball の Game Plan（控え含む 20+ 枠）と一致しない (c) 効果は試合／Game Plan 依存で静的能力画面には出ない |
| ブースター全体の `evidenceLevel` | **`conditional_unverified` 維持** | 条件を評価できない以上、標準モードへは上げない |

## 12. 341 カードへの影響分析

- 適用状態: **変更なし**。全 341 が `applied = 0` / `conditional_unverified` のまま。
- 標準モード適用: **1,931 カード（不変）**。厳密モード: 166（不変）。external_cross_verified 27 種 / screenshot_verified 2 種（不変）。
- 「もし +3 を無条件適用したら」: level1 基礎値ベースで 99 超過 0・最大 uncapped 94。
  育成最大値ベースでは一部能力が +3 で 99 到達しうるが、エンジンが 99 クランプ（`experimentalCapApplied` フラグ）。実際には全モードで未適用のため影響なし。
- null 能力値・不正キー・ID 競合・名称相違: いずれも 0。
- 推定 OVR / スカッド平均 / 比較順位: Total Package は集計・順位に含めない（不変）。

## 13. 標準適用可否

**不可（現状維持）。** §11 の理由により、標準モードへ自動適用しない。
条件が KONAMI 公式で判明しても、per-card の対応リーグと Game Plan 構成を確実に評価できないため、
`conditional_unverified` を維持し、育成・比較・スカッドのいずれでも通常の最終値へ加算しない。

## 14. 未適用理由（UI 表示）

「Total Package +3 / 状態: 編成条件付き・未適用 / 効果候補: 全 26 能力 +3（最大ティア） / 通常値: 未適用 /
理由: KONAMI 公式「The Power of Many」= Game Plan の同一リーグ登録人数で +1/+2/+3。この条件を静的な育成画面・現状のスカッドでは評価できないため、通常の最終値には含めていません。/
将来対応: Game Plan 構成を指定するスカッド評価で対応予定。」

## 15. 実装（非破壊）

- `booster-catalog.ts`: `BoosterDef` に任意フィールド `conditionText` / `conditionEvaluable` を追加。
  total-package に KONAMI 公式ベースの `conditionText` と `conditionEvaluable: false`。`evidenceLevel` は `conditional_unverified` のまま。効果・上昇量・対象能力・maxLevel は不変。
  `BOOSTER_CATALOG_VERSION = "booster-catalog/2026-08-28.total-package-1"`（evidence-levels-2 を previous に）。
- `booster-resolution.ts` / `-data.ts`: `ResolvedAttachedBooster` に `conditionText` / `conditionEvaluable`。`reasonFor(conditional_unverified)` を条件本文入りに。`BOOSTER_RESOLUTION_VERSION = "player-booster-resolution/2026-08-28.v6"`（v5 を previous に）。
- `types.ts` / `calculate-player-booster.ts`: `PlayerBoosterInfo` に `conditionText` / `conditionEvaluable` を透過。**計算ロジックは変更なし**（`appliesInMode` / `calculateFinalStats` は不変）。
- UI: `PlayerBoosterPanel` / `StatComparison` / `PlayerControlColumn` / `SlotPlayerPanel` / `TeamSummaryPanel` / `ComparisonTables` で「条件未確認」→「編成条件付き（Game Plan 依存）・未適用」＋条件本文を表示。
- SQLite（非破壊）: `player_booster_definitions` に `condition_text` / `condition_evaluable` 列を ALTER 追加。
  `player_booster_source_mappings.condition_note` / `player_card_resolved_boosters.resolution_reason` を条件本文入りに UPSERT。
  既存件数（World 13,009 / eFHUB 47,479 / eFHUB 詳細 19 / 監督 66 / ブースター定義 44）不変。競合 0。
- **条件評価エンジンは実装しない**（§13: 条件が判明しても現在のデータで評価不能のため）。

## 16. 未解決事項 / 次に必要な証拠

1. per-card の Activation Condition リーグの KONAMI 公式対応表（現状はカードのリーグから推測）。
2. J.League Total Package の J1 / J2 合算ルールの現行仕様（KONAMI が「J1 のみ→J1+J2 に拡張予定」と告知）。
3. "Other" 11 カードの対応リーグ。
4. 当アプリのスカッド機能を eFootball の Game Plan（控え枠含む）に合わせるか、Total Package 専用に「同一リーグ人数」入力を設けるか（将来の設計判断）。
5. `external_cross_verified` 27 種のうち EFScout `conditional: true`（color 2）に該当する item が実カードに付いていないかの再監査（今回は対象外・反例なし）。
6. Live Update Rating 連動ブースター（別種の条件付き）の当アプリでの扱い。

### 2026-08-29 追記の未解決事項

7. **World の各 `boost1`/`boost2` 数値 ID が「通常版」か「Power of Many 版」かの判別材料**。必要な情報:
   - eFHUB の青/金ヘキサゴンを決めている元データ（HTML / JSON / CSS クラス名）。ユーザーによる eFHUB のページソース提供、または `./screenshots/` への該当画面追加。
   - eFootball World の個別ページ RSC ペイロード内に booster type / color / conditional フィールドがあるか（WebFetch の Markdown 変換では失われる。生ソースの確認手段が必要）。
   - 同じ World `boost2=44` を持つ 3 カード（Messi / Michael Olise / Kamada Daichi）が別リーグ = Activation Condition がカード固有なら Power of Many 版の可能性が上がる。逆に全カードで固定 +3 なら通常版。→ 3 カードのゲーム内実測または eFHUB スクリーンショット。
8. **Messi `89138556575063` の Ball Protection +3 の実測**（KONAMI ゲームクライアントで Game Plan を変えて能力変化を観測、または信頼できる公開スクリーンショット）。
9. eFHUB の青/金と EFScout の `color:0` / `color:2` が一致するか（別ソース 2 つで照合）。
10. 27 種のうち、実カードに付いている ID が EFScout の通常版 ID 系列に対応するか Power of Many 版系列に対応するか（World ID ↔ EFScout ID の対応が非公開のため現状不能）。

**判別できるまでの扱い**: 名称付きブースター（Ball Protection 等）は現行どおり `external_cross_verified` として標準モードへ適用を維持する（Power of Many 版だった場合は「最大効果を無条件表示」の過大評価になり得るが、これは既存の 27 種すべてに同じ疑いがあり、特定カードの誤りは未確認。証拠なしの一括変更・ロールバックはしない）。Total Package（`boost1=83`・341 カード）は引き続き `conditional_unverified` / 未適用 / 手動段階指定のみ。
