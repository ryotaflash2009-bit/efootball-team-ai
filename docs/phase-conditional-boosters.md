# フェーズ: Power of Many 方式ブースター（金色）の手動段階指定

作成日: 2026-08-29（`docs/phase-total-package.md` の続き）

> **v2（2026-08-29・後刻）**: ユーザー実測により「The Power of Many」は **複数の効果名に付く発動方式**（金色）と確定
> （Messi `89138556575063` の金色 Ball Protection の段階を下げると対象4能力が各 -1 / OVR 94→93）。
> 効果名（`boosterEffectKey`）と発動方式（`activation`: `fixed` / `power_of_many`）を分離。
> 段階指定は **その効果名の対象能力へだけ** 反映（Ball Protection = 4能力、Total Package = 26能力）。
> Total Package を Ball Protection へ差し替えることはしない（両者は独立）。

## 目的

KONAMI 公式「The Power of Many」= Game Plan に登録した対象リーグの選手数で効果量が変わる**発動方式**（金色）。
Total Package（World `boost1=83`・341 カード・対象=全26能力）と、
Ball Protection 等の名称付きブースター（World `boost2=44`・対象=そのブースターの4能力）の両方に付く。
アプリは per-card の対象リーグ・Game Plan の集計範囲を確定できないため**自動判定しない**。
代わりに eFHUB 育成画面のようにユーザーが段階（+0/+1/+2/+3）を手動指定できる機能を実装した。

## 規則バージョン

- `conditional-booster/2026-08-28.v2`（`src/lib/progression/conditional-boosters.ts`・v2 で PoM 全般へ一般化）
- `player-booster-resolution/2026-08-28.v7`（`activation` 分離・`WORLD_BOOST2_MAP[44]` = power_of_many）
- `booster-catalog/2026-08-28.total-package-1` / `progression/2026-08-28.v2` は不変（カタログの効果名・対象能力は変更なし）。
- 日付は `2026-08-28` を維持（既存スキーム識別子・元プロンプト指定）。

## 段階（`ConditionalBoosterSelection`）

| 列挙値 | レベル | 対象リーグ人数 | 効果 |
|---|---|---|---|
| `none` | 0 | 未指定 | 未適用 |
| `league_1_13` | 1 | 1〜13 人 | 全26能力 +1 |
| `league_14_19` | 2 | 14〜19 人 | 全26能力 +2 |
| `league_20_plus` | 3 | 20 人以上 | 全26能力 +3 |

**これはユーザー指定であり、アプリの自動判定ではない。** UI に必ず明記する。

## 計算状態の分離（`StatBreakdown`）

| フィールド | 意味 |
|---|---|
| `strictFinalValue` | 基礎 + 育成 + game_client/screenshot_verified + 監督（不変） |
| `standardFinalValue` | 厳密 + external_cross_verified（**条件手動指定は含まない・不変**） |
| `conditionalBoosterDelta` | Total Package のユーザー指定ぶん（全対象能力へ +段階値） |
| `conditionalFinalValue` | `standardFinalValue + conditionalBoosterDelta`（未指定なら = standardFinalValue） |
| `conditionalCapApplied` | 条件反映後値が 99 クランプされたか |
| `manualTrialBoosterDelta` | 手動試算ブースター（付属を上書き）ぶん・conditional とは別バケット |
| `experimentalPlayerBoosterDelta` | 検証中の付属 + 条件手動指定 + 手動試算（試算最終値用） |
| `experimentalFinalValue` | `standardFinalValue + experimentalPlayerBoosterDelta` |

`finalValue` は後方互換で「現在の適用モードの通常値」（strict → strict / standard・experimental → standard）。
**条件手動指定は `finalValue` を変えない。**

## 純関数（`conditional-boosters.ts`）

- `TOTAL_PACKAGE_TIERS` — 段階表
- `parseTotalPackageSelection(v)` — 不正・列挙外・4以上・負数・小数・NaN・Infinity・文字列 → `"none"`
- `levelForConditionalSelection(sel)` — 段階 → 0..3
- `levelForRegisteredPlayers(count)` — **将来の Game Plan 自動対応用の純関数**（現状 UI から呼ばない）。0 / 1〜13→1 / 14〜19→2 / 20+→3。不正入力は 0
- `validateConditionalBoosterSelection(raw)` — 保存・URL 検証。非対象キー・`none` は捨てる
- `calculateConditionalBoosterDeltas(key, sel)` — 段階 → 全対象能力へ +段階値（World 26 キーのみ）。非対象ブースター・`none` は `{}`
- `describeConditionalSelection(sel)` — 表示文
- `isManualConditionalBooster(key)` — `conditional && conditionEvaluable === false`（現状 total-package のみ）

## UI

- `src/components/world/progression/ConditionalBoosterControl.tsx`（新規・共通）:
  タップ / キーボードで開く小型 Modal（`@/components/ui/Overlay` の `Modal` を再利用・PC/モバイル両対応）。
  4 段階のラジオ + 「選択を解除」。各段階に人数条件・上昇量・「ユーザー指定・アプリの自動判定ではありません」。
  未選択時「編成条件付きです。現在のアプリでは対象リーグ人数を自動判定できないため、能力値へ未適用です。」
- 育成 `PlayerBoosterPanel` / 比較 `PlayerControlColumn` / スカッド `SlotPlayerPanel` に統合（Total Package カードのみ）。
- 育成 `StatComparison`: 「条件指定」列 + 「条件反映後」列を追加（標準最終と別列・同じ値として表示しない）。
- 比較 `ComparisonTables`: 「ユーザー指定条件を含む比較」チェックボックス（明示的 opt-in のときだけ `conditionalFinalValue` で表示・**通常の順位は `finalValue` のまま**）。
- スカッド `TeamSummaryPanel`: 「条件付き試算サマリー（手動指定による試算）」を折りたたみで表示（**通常のチームサマリーには含めない**）。
- 禁止表現を使わない: 自動判定済み / 公式現在値 / 条件達成確認済み / Game Plan との一致確認済み / 標準モードで自動適用中。

## 保存（後方互換）

- 育成ビルド: `SavedBuild.conditionalBoosterSelections?`（zod `.catch(undefined)`・`none`/不正/非対象は捨てる・空なら欄ごと省略）。
- スカッド: `StoredSlot.conditionalBoosters?` / `StoredSub.conditionalBoosters?` + `StoredSquad.conditionalSettings?`
  （`targetLeague` / `registeredPlayerCount` / `conditionTier` / `evaluationMode: "manual" | "automatic" | "unsupported"`。
  現状 `evaluationMode` は常に `manual`・自動照合しない・将来の Game Plan 対応の器）。
- 比較: URL `?tp=<digit,...>`（`""`/`1`/`2`/`3`・ids と同順・列挙外/4以上/不正は `none`）。
- すべて共通の `validateConditionalBoosterSelection` を通す。古い保存データは `none` 既定。

## 自動適用しない（重要）

カード所属リーグ一致・スカッド内同リーグ選手の有無・先発同リーグ・ベンチ込み人数・World のリーグ情報の有無 —
これらから**自動判定しない**。理由: per-card 対象リーグの公式対応表がない / J1・J2 合算規則が未確認 /
Game Plan の登録範囲が未確認 / "Other" カードが存在 / 現状のスカッド構造 ≠ ゲームの Game Plan。
条件評価エンジンは実装していない（`levelForRegisteredPlayers` は将来用の純関数のみ）。

## 影響

- 標準モード 1,931 カード / 厳密モード 166 カード / external_cross_verified 27 種 / screenshot_verified 2 種 — **すべて不変**。
- SQLite 書き込み 0（この機能は純ロジック + localStorage + URL のみ）。既存件数不変。
- 条件段階を指定しても `finalValue` / 標準最終値 / 比較の順位 / チームの通常集計は変わらない。

## テスト

- `src/lib/progression/conditional-boosters.test.ts`（新規・18）— 純関数の全境界（none/1〜13/14〜19/20+・0人/13人/14人/19人/20人・負数/小数/文字列/NaN/Infinity/巨大数・非対象ブースター）。
- `booster.test.ts` / `engine.test.ts` — 段階指定で `conditionalFinalValue` のみ変化・`strictFinalValue`/`standardFinalValue` 不変・`manualTrialBoosterDelta` と混ざらない・99 クランプ・全モード。
- `build-storage.test.ts` / `squad-storage.test.ts` — 保存・復元・後方互換・不正値の除去。
- `build-comparison.test.ts` — 通常順位不変・`hasAnyConditionalSelection`・`conditionalFinalValue`。
- `build-squad.test.ts` — `conditionalTeamSummary` 分離・通常サマリー不変。
- `schemas.test.ts` — `tp=` の parse/serialize round-trip・不正値 → none。
- `scripts/black-box-boosters.mjs` — Total Package カードの条件指定コントロール SSR・非 TP カードに出さない・比較 `tp=` クエリ。
