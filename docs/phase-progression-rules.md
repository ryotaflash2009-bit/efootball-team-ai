# Phase: 選手育成機能 — 規則の確認状態

作成日: 2026-08-28 / 調査時の外部アクセス: **0 回**（SQLite + 既存資料 + screenshots のみ）

## 参照資料
- SQLite: `world_player_cards` / `world_player_stats`(338,234行) / `player_cards`(19) / `stat_key_map`
- `docs/player-detail-findings.md` §3,7,8（eFHUB RSC の育成関連メッセージ）
- `screenshots/スクリーンショット 2026-08-28 020026.png`（eFHUB 選手詳細の育成パネル）
- `scripts/investigate-progression-data.mjs` の出力

## A. 確認済み（実データ・保存資料から確認できる）

| 規則 | 根拠 |
|---|---|
| レベル1の基礎能力値（26項目） | `world_player_stats`（`stat_kind='base'` のみ保存・全カード26項目） |
| **能力値の上限 = 99** | 保存済み 338,234 値の実測: 最小40 / 最大99 / 99超え **0件** |
| **最大レベル = レベル上限** | 同一カードID で World `maximum_level` と eFHUB `level_cap` が一致（Cannavaro 27=27, Messi 32=32） |
| 基礎OVR / 最大OVR（保存値として） | `world_player_cards.ovr_base` / `ovr_max`（54–98 / 59–105） |
| 26能力値キー ↔ eFHUB 内部キー | `stat_key_map`（tackling↔ballWinning など4件、他22件同一） |
| レベル1カードは育成なし | `maximum_level=1` のカードは `ovr_max = ovr_base`（TRENDING 3,502件はすべて lv1） |
| eFHUB は育成を「能力ごと」に行う | RSC メッセージ `"Tap an ability to use progression points"` |
| 「Auto Allocate Progression」「Max Level」「Max Level Stats」の概念が存在 | RSC メッセージ |
| 監督補正の存在と粒度 | RSC メッセージ `"Manager Boosts"` / `"{stat} +1"` |

## B. 有力候補（複数データで整合するが計算規則として未確定）

| 規則 | 根拠 / 注意 |
|---|---|
| 育成ポイント総数 = (最大レベル − 1) × 2 | screenshot 020026: レベル上限34 → 「ポイント 0 / 66」= 33×2。**データ点1件のみ** |
| 能力値グループ 10 種が存在 | screenshot 020026 左パネルに10スライダー。当初「撮影」等と読んだが **screenshot の日本語表記は判読が曖昧で日本語名は未確認（仮称）**。英語名（Shooting/Passing/Dribbling/Dexterity/Lower Body Strength/Aerial Strength/Defending/GK1-3）は eFHUB RSC キー等で確認。**各グループの対象能力値・消費規則は不可視** |
| ブースター「ボールキャリー」= ドリブル/ボールキープ/スピード/ボディバランス に +5 | screenshot 020026（緑 +5 バッジ）。**特定ブースター1種のみ。ID との対応は不明** |
| スキルバフ効果の一部 | `player-detail-findings.md` §4（例: `willPower` = Finishing/Kicking Power を撃つたび +1、最大+8）。**確定効果表ではない・条件付き** |

## C. 未確認（意味または取得経路が不明）

- 各能力値の育成消費ポイントと段階的コスト変化（`Tap an ability` の1タップあたりの上昇量とコスト）
- 各能力値の育成上限（+n）
- レベルごとの正確な付与ポイント（×2 は候補）
- グループ → 対象能力値の正式な対応
- グループのポイント消費規則
- Max Level Stats（最大レベル時の各能力値）の内訳
- 能力値グループの正式名称（screenshot は日本語表示のみ）

## D. 今回のデータだけでは実装不能（追加調査が必要）

- 公式 OVR 計算式 / ポジション別 OVR
- 基礎OVR → 最大OVR の正確な変換
- 選手ブースターの効果（World `boost1`/`boost2` は数値ID 106種、eFHUB `boostId1`/`boostId2` は1000番台。**どちらも効果表なし**。World と eFHUB は別ID体系）
- 監督補正の適用順序・対象能力・上昇量・重複規則
- 自動育成のゲーム内アルゴリズム（最大OVR保証の配分）

## 実装方針（この状況での結論）

1. **計算エンジンは常に動く**が、`calculationMode` は
   - `confirmed`: 育成配分ゼロ・ブースターなし・監督なし（= 基礎値表示のみ）
   - `provisional`: 育成配分あり（規則が B/C のため）
2. **育成は「能力値ごと」に配分**（RSC メッセージ準拠）。グループ操作は per-stat 配分を一括更新する補助。
3. 暫定規則: ポイント総数 `(maxLevel-1)×2`、消費 `+1 につき 1 ポイント`（線形）、上限 99（確認済み）。
4. **選手ブースター効果は適用しない**。ID と「効果未確認」を表示。build には ID を保持。
5. **監督補正は 0**。ただしエンジン・型は `managerBoosterDelta` レイヤーを受け取れる。
6. **OVR は「推定OVR（検証中）」**としてポジション別加重平均で概算。`ovr_base`/`ovr_max` は保存値として別表示。「最大OVR保証」とは表示しない。
7. 自動育成は「攻撃重視 / 守備重視 / バランス重視 / GK重視」の**配分方針**（ヒューリスティック）。
8. 結果に `rulesVersion` / `calculationMode` / `confirmedRules` / `provisionalRules` / `unresolvedRules` / `warnings` を必ず含める。
9. 未確認値を 0 や確定値として表示しない。UI に「検証中」「追加調査中」を明示。

## 代表検証カード（`world_player_cards` から選定）

| 用途 | worldCardId | 選手 | type | pos | base/max | maxLv | boost1/2 |
|---|---|---|---|---|---|---|---|
| Messi 代表 | 89138556575063 | Lionel Messi | BIGTIME | SS | 90/105 | 32 | 90 / 44 |
| Messi 別カード | 89136409091415 | Lionel Messi | BIGTIME | RWF | 89/105 | 34 | 15 / 0 |
| Cannavaro 代表 | 88045755964133 | Fabio Cannavaro | EPIC | CB | 88/104 | 27 | 144 / 74 |
| Cannavaro 別カード | 88041460996837 | Fabio Cannavaro | EPIC | CB | 88/103 | 27 | 36 / 0 |
| GK | 106788187832737 | Manuel Neuer | SHOWTIME | GK | 88/103 | 28 | 63 / 54 |
| 攻撃型 CF | 89138556701095 | Erling Haaland | BIGTIME | CF | 87/104 | 33 | 87 / 31 |
| ブースターなし | 17592722922839 | Lionel Messi (ICON) | ICONS | RWF | 94/100 | 9 | 0 / 0 |
| 最大レベル最小 | 52902186095121 | Carlos Espí | TRENDING | CF | 92/94 | 1 | 76 / 0 |

---

# 追記2: v2 規則の修正（2026-08-28）

- **rulesVersion の日付修正**: `progression/2026-08-29.v2`（未来日付・誤り）→ **`progression/2026-08-28.v2`**。
  誤日付で保存されたビルドは読込時に v2 として受理し、バージョン名だけ正規化する（`PROGRESSION_RULES_VERSION_MISDATED` / `normalizeRulesVersion`）。
- **能力値上限をレイヤー別に分離**（`STAT_CAPS`）:
  - `base`: 99 / **confirmed**（保存済み基礎値338,234件の実測）
  - `progression` / `playerBooster` / `managerBooster` / `final`: 99 / **unresolved**（証拠なし・暫定値）
  - 最終値への 99 クランプは暫定処理。100以上が確認されたら `STAT_CAPS.final` の値だけ変更すればよい（エンジン改修不要）。
- **段階コスト**: `1 + floor(level/5)` は **provisional のまま**。confirmed なのは「0→1 は 1pt」「5→6 は 2pt」の2境界のみ。5刻みの一般化・9段階以降・13段階以降はすべて外挿であり confirmed ではない（rule-registry / UI に明記）。
- **能力値グループ**: 英語名のみ confirmed。**日本語グループ名は未確認（仮称）**。UI は英語名を表示。Shooting の日本語候補は「シュート」（『撮影』は誤訳のため使用しない）。Shooting 以外9グループの対象能力値は provisional 維持。

---

# 追記: 外部調査と v2 規則（作成日 2026-08-28）

## 使用した外部サイトと robots.txt / 利用条件

| サイト | robots.txt | 判定 | 使用 |
|---|---|---|---|
| pesmastery.com | `User-agent: * / Disallow:`（全許可・crawl-delay なし・AI 制限なし） | 自動アクセス可 | `efootball-level-up-guide/` を1回取得 |
| gamemarket.gg | `User-agent: *`（admin/checkout 等のみ Disallow・記事パスは許可） | 自動アクセス可 | 記事1本を取得 |
| mrtomboy.com | 取得できず（SSL エラー） | 未確認 | 不使用 |
| eFHUB (efhub.com) | `User-agent: ClaudeBot / Disallow: /` | **アクセス不可** | 不使用（再取得せず） |

- 外部 GET 合計: **WebSearch 3 回 + WebFetch 4 回（うち1回 SSL 失敗）= 7 回**（上限20以内）。
- User-Agent 偽装・VPN・認証回避・CAPTCHA 回避 なし。ログイン不要のページのみ。
- eFHUB は ClaudeBot 全面禁止のため再取得せず（既存の調査資料のみ使用）。

## v2 で confirmed へ昇格した規則

| ruleId | 規則 | 根拠（複数ソース一致） |
|---|---|---|
| `points.per-level` | レベルアップ1回につき **育成ポイント +2** | screenshot 020026（Lv上限34→66=33×2）+ pesmastery（"Each increase in level gives you 2 progression points"）+ gamingonphone ガイド |
| `points.total` | 総ポイント = **(最大レベル − 1) × 2** | 上記と screenshot の実数 66 |
| `stat.cap` | 能力値上限 **99** | SQLite 338,234値（最大99・超過0）+ gamemarket（"roughly 40 to 99"） |
| `progression.grouped` | 育成は約10グループ単位・1配分で複数能力が同時上昇 | screenshot + eFHUB RSC キー + pesmastery / gamemarket / mobilegaminghub |
| `group.shooting.stats` | **Shooting = Finishing / Set Piece Taking(Place Kicking) / Curl** | pesmastery + gamemarket + mobilegaminghub |
| `progression.eligibility` | **TRENDING カード / 最大レベル1 は育成不可** | pesmastery（"Trending — Able Level up: No"）+ SQLite（TRENDING 3,502件すべて Lv1） |
| `ovr.calc`（形のみ） | OVR は **ポジション別加重の能力値要約** | gamemarket |

## v2 で provisional（有力だが単一ソース or 外挿）

| ruleId | 規則 | メモ |
|---|---|---|
| `cost.staged` | 段階コスト `1 + floor(level / 5)`（0-4→1pt, 5-9→2pt, …） | pesmastery の実例（0→1 は 1pt、5→6 は 2pt）を「5段階ごとに +1」へ一般化。9/13段階以降は外挿 |
| `group.other.stats` | Shooting 以外9グループの対象能力値 | グループ名は confirmed、対象能力値は本アプリの暫定割当（26能力を重複なく10分割） |
| `progression.per-level-gain` | 1カテゴリレベル → 対象能力それぞれ +1（99上限） | 「複数能力が同時上昇」は confirmed、正確な上昇量（重み/上限）は未確認 |
| `booster.effect`（形のみ） | ブースターは名前 + レベルN、対象能力へ +N（例: ボールキャリー+5 → ドリブル/ボールキープ/スピード/ボディバランス、Fantasista+2 → BallControl/Dribbling/Finishing/Balance） | 効果の形は確認。**ID → 名前・対象の対応表が取得できず適用不可** |

## v2 で unresolved / unsupported（実装しない）

- 選手ブースターの効果（World `boost1`/`boost2` 1-162、eFHUB `boostId` 1028-1192 の対応表が非公開・別ID体系）
- 監督補正の適用順序・対象・上昇量（レイヤーのみ用意・delta 0）
- 公式 OVR 計算式の重み・丸め・特殊補正
- Max Level Stats の内訳
- 段階コストの9/13段階以降の正確な値
- カテゴリレベル1あたりの能力別の正確な上昇量

## v1 → v2 の変更点

- **配分の単位**: 能力値ごと（v1）→ **グループのカテゴリレベル**（v2）
- **コスト**: 線形 1pt/+1（v1）→ **段階制**（v2）
- **育成不可判定**: なし（v1）→ **TRENDING / Lv1**（v2）
- **ブースター**: 変わらず「効果未確認」（ID→効果が取れないため）
- 旧 v1 ビルド（能力値ごとの配分）は読み込み時に「各グループ = そのグループ能力への最大投入値」へ変換。元の配分は破壊せず、UI で「現行規則で再計算」を選択。予算超過分はグループレベルを段階的に下げてクランプ。

規則バージョン: `progression/2026-08-28.v2`（旧: `progression/2026-08-28.provisional-1`）
証拠台帳: `src/lib/progression/rule-registry.ts`（ruleId / formula / source / evidence / testedCards / exceptions / confirmationStatus）
