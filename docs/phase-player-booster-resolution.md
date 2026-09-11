# フェーズ: カード付属ブースターID対応表の解決

作成日: 2026-08-28（前フェーズ `phase-player-boosters.md` の続き）

前フェーズで「カード付属の数値ID（World `boost1`/`boost2`、eFHUB `boostId1`/`boostId2`）→
ブースター名・効果」は未解決のままだった。本フェーズでこれを最優先で解決した。

> **v2 更新（同日）**: World 個別選手ページを追加で 38 件取得し、
> `boost1` を 34 → **71 ID**、`boost2` を 6 → **14 ID** に拡大。名称対応率は 83.0% → **98.2%**。
> 最優先カード `89136409091415`（World `boost1=15`）は **Ball-carrying +5** と判明し自動適用。
>
> **v3 更新（同日・`phase-player-booster-effects.md`）**: 効果の実測方法（World 個別ページの
> ScoreBar[ブースターON] − RSC baseAbilities[OFF]）を確立し、**29 種のブースター効果を effect_confirmed へ昇格**。
> 自動適用を 166 → **1,931 カード（83.4%）** へ。`rulesVersion` は `player-booster-resolution/2026-08-28.v3`、
> カタログは `booster-catalog/2026-08-28.world-measured-1`。通常モードと検証モードを完全分離。
> 下記の一部の数値は v2 時点（最新は `phase-player-booster-effects.md`）。

---

## 1. 決め手: eFootball World（外部コミュニティDB）が名称を表示していた

`efootball-world.com/player/{worldCardId}` の個別選手ページの HTML に、
各カードの付属ブースターが **`<name> +<level>`** の形でそのまま描画されている。
※ `efootball-world.com` は **独立したコミュニティ運営のファンサイト**であり、KONAMI 公式サイトではない。

```html
<span class="Booster-module__…__selectButtonText">Technique +3</span>
<span class="Booster-module__…__selectButtonText">No Booster</span>
```

- ID → 名称・レベル は「外部ページ表示で名称確認済み」（複数カードで反例0）。KONAMI 公式の確定情報ではない。
- robots.txt: `Allow: /`（`/my/` `/auth/` のみ Disallow）。`/player/` は許可。AIクローラー制限なし。
- RSC ペイロードには `boost1`/`boost2` の**整数**と `baseAbilities`（基礎能力値）しか無い。
  効果（対象能力・上昇量）は JS バンドル内のルックアップ表で、SSR HTML には出ない。
  ドロップダウンの全ブースター一覧もクライアント描画で SSR に無い。
  → 効果は「名称一致で自前カタログ（EFScout 由来）を参照」する。

## 2. 外部アクセス

- efootball-world.com のみ。GET・同時1・20s・再試行は5xx/障害時のみ1回・redirect=manual・
  Cookie/Auth/APIキーなし・UA偽装なし。
- v1: **40 リクエスト**（プローブ 2 + バッチ 33 + デュアル 5）。間隔 3.2s。
- v2: **38 リクエスト**（未解決ID代表カード・ID15 の 2 枚含む）。最初 5 件を 3s、全てクリーンだったので以降 2s。
- 累計 **78 リクエスト**。すべて HTTP 200。429/403/CAPTCHA/リダイレクト/5xx/タイムアウト いずれも 0。
- eFHUB・eFootBase へはアクセスしていない。EFScout 等への追加アクセスは不要だった。
- 取得した HTML から `selectButtonText` の「name +level」だけを抽出。全選手データの再取得・画像取得はしていない。

## 3. 観測結果

### World boost1 → ブースター（34 ID）

| id | booster | id | booster | id | booster |
|---|---|---|---|---|---|
| 2 | Accuracy +3 | 35 | Duelling +2 | 65 | Shooting +3 |
| 4 | Aerial +3 | 36 | Duelling +3 | 67 | Shutdown +2 |
| 7 | Agility +2 | 41 | Goalkeeping +2 | 71 | Stealing +3 |
| 8 | Agility +3 | 42 | Goalkeeping +3 | 73 | Strength +3 |
| 10 | Balancer +3 | 44 | Hard Worker +3 | 75 | Striker's Instinct +2 |
| 12 | Ball Protection +3 | 50 | Off the Ball +3 | 76 | Striker's Instinct +3 |
| 13 | Ball-carrying +2 | 52 | Offence Creator +3 | 78 | Technique +2 |
| 14 | Ball-carrying +3 | 53 | Passing +2 | 79 | Technique +3 |
| 28 | Breakthrough +3 | 54 | Passing +3 | 83 | Total Package +3 |
| 32 | Crossing +3 | 58 | Rebuilding +3 | 87 | Striker's Instinct +4 |
| 34 | Defending +3 | 63 | Saving +3 | 90 | Accuracy +4 |
| | | 64 | Shooting +2 | | |

### World boost2 → ブースター（6 ID・boost1 とは別体系）

30=Shooting +3 / 31=Strength +3 / 36=Striker's Instinct +3 / 40=Physicality +3 /
42=Breakthrough +3 / 44=Ball Protection +3

**boost1 と boost2 は独立した ID 空間**（例: `boost1=65` も `boost2=30` も "Shooting +3"）。
ID の番号順とブースター種別・レベルには単純な規則性はない（例: Striker's Instinct は 75,76,87）。
→ **観測できた ID だけを載せ、番号の近さから推測はしていない。**

### eFHUB boost_id（2 ID・provisional）

同一カード（World と efhub で card_id 一致）の World 側表示から確認:
- 1028 = Technique +3（Xavi 88040387117922）
- 1033 = Goalkeeping +3（van der Sar 88038776505238）

## 4. 効果（対象能力・上昇量）の確認状態

観測した 25 種のブースター名は **すべて既存 `BOOSTER_CATALOG`（EFScout 由来）のキーと一致**した。

| 区分 | 内容 | 自動適用 |
|---|---|---|
| confirmed | ball-carrying / offence-creator（+ fantasista）— screenshot 実測で対象能力・上昇量を確認 | する |
| provisional | 他の名称一致ブースター — 名称は confirmed、効果は EFScout の定義のみ | しない（検証モードで試算） |
| conditional | total-package — 名称は confirmed、発動条件の内容が未確認 | しない |
| unresolved | 対応表に無い数値ID | しない |

screenshot 実測（`screenshots/`）:
- `020026.png` … ボールキャリー +5 → ドリブル/ボールキープ/スピード/ボディバランス に各 +5
- `image.png` / `image (1).png` … 攻撃の起点 +4 → オフェンスセンス/ボールコントロール/グラウンダーパス/キック力 に各 +4

## 5. 大量検証（`node scripts/scan-booster-resolution.mjs`・読み取り専用）

| 指標 | v1 | **v2** |
|---|---|---|
| 総カード数 | 13,009 | 13,009 |
| ブースター付きカード | 2,314 | 2,314 |
| デュアルブースター | 57 | 57 |
| slot1 解決 | 1,920 | **2,272 / 2,314（98.2%）** — confirmed 164 / provisional 1,767 / conditional 341 / 未解決 42 |
| slot2 解決 | 22 | **38 / 57（66.7%）** — confirmed 3 / provisional 35 / 未解決 19 |
| 自動適用カード | 147 | **166（7.2%）** |
| 名称のみカード | 1,774 | **2,106** |
| 完全未解決カード | 393 | **42（1.8%）** |
| 名称 対応率 | 83.0% | **98.2%** |
| ID 競合 | 0 | **0（71 の boost1 ID すべて一意のブースターに対応）** |
| 能力値異常（自動適用 668 項目） | 0 | **99超過 0 / 負値 0 / 基礎値異常 0** |

未解決の boost1 は 35 ID（計 42 カード）に減少。ほぼすべて 1〜2 カードの希少 ID。
未解決 boost2 は 13 ID（計 19 カード）。

## 6. 実装

- `src/lib/progression/booster-resolution-data.ts`（依存なしのリーフ）: `WORLD_BOOST1_MAP` /
  `WORLD_BOOST2_MAP` / `EFHUB_BOOST_MAP` / `CONFIRMED_EFFECT_KEYS` / `BOOSTER_RESOLUTION_VERSION`。
- `src/lib/progression/booster-resolution.ts`: `resolveAttachedBooster(source, slot, id)` →
  `{ boosterKey, nameEn, nameJa, level, affectedStats, perStatDelta, effectStatus, autoApply, reason }`。
- `src/lib/progression/calculate-player-booster.ts`:
  - 付属 boost1/boost2 を解決。confirmed は `deltas` へ加算（自動適用）。
  - provisional / conditional は表示のみ（検証モードでは provisional も加算、conditional は加算しない）。
  - **手動指定はそのスロットの付属を上書き**（公式 UI と同じドロップダウン挙動）。
- `PlayerBoosterInfo` に `boosterKey` / `level` / `perStatDelta` / `nameStatus` / `effectStatus` /
  `autoApplied` を追加。`ProgressionResult.playerBoosterAttached` を追加。
- `rulesVersion`: `player-booster-resolution/2026-08-28.v1`（育成 rulesVersion とは独立）。
- SQLite（非破壊・新規テーブルのみ）:
  - `player_booster_source_mappings`（42 行・PK `(source, source_booster_id)`）
  - `player_card_resolved_boosters`（2,371 行・World の boost 付きカードの解決結果）
  - `player_booster_conflicts`（0 行）
  - `player_booster_resolution_runs`
  - 投入: `node scripts/sync-booster-resolution.mjs`（既存件数ガードあり）。

## 7. UI

- 育成（`PlayerBoosterPanel`）: 付属ブースターを「名称 +レベル」で表示。
  効果 confirmed=「適用中」（緑）、provisional=「名称確認済み・効果は検証中」、conditional=「条件付き・未適用」、
  未解決=「効果未確認」。手動指定でスロットを上書きできる。
- 比較（`PlayerControlColumn` / `ComparisonTables`）: 各選手列に付属ブースターの適用状態、
  26能力値テーブルの「選」デルタに自動適用分が反映。
- スカッド（`SlotPlayerPanel`）: スロットに付属ブースター名 + 適用状態。

## 8. 自動適用しないもの（再掲）

- provisional ブースター（検証モードOFF時）
- total-package の条件付き効果（条件未確認）
- 対応表に無い数値ID
- eFHUB `boost_id`（2 ID のみ provisional・World カード表示が主）

## 9. 今後

- 未解決 35 の boost1 ID（1〜2 カードの希少 ID・42 カード）— さらなる個別ページ取得で解消可能。
- provisional → confirmed 昇格は screenshot 実測の追加が条件。
- boost2 の残り 13 ID、eFHUB `boost_id` の残り。
- 監督補正・選手ブースターの**適用順序（育成前 / 育成後）は依然未確認**（単純加算のため結果は順序非依存だが、上限処理は暫定）。

---

## 10. v2 追記（2026-08-28）

### 最優先カード `89136409091415` の解決

| 項目 | 内容 |
|---|---|
| カード名 | Lionel Messi（リオネル メッシ） |
| worldCardId | 89136409091415 |
| sourceBoosterId | slot1 = **15**、slot2 = なし |
| 個別ページ表示 | **Ball-carrying +5** |
| レベル | +5 |
| 対象能力 | ドリブル / ボールキープ / スピード / ボディバランス（各 +5） |
| 条件 | なし |
| 同じ ID 15 を持つカード | 2 枚（Messi 89136409091415、George Best 89136677522134） |
| 検証した同 ID カード | 2 枚とも「Ball-carrying +5」で一致 |
| 反例 | 0 |
| confirmationStatus | 名称=confirmed（公式表示 ×2 + screenshot 020026）、効果=confirmed（screenshot 020026 実測） |
| 自動適用 | **可**（ball-carrying は screenshot 実測済み） |
| 適用前 → 適用後 | dribbling 83→88 / tightPossession 80→85 / speed 78→83 / balance 81→86 |

→ このカードのカード付属ブースターは効果まで解決し、**能力値へ自動適用**した。

### 解決範囲の拡大

- `boost1`: 34 → **71 ID**（`booster-resolution-data.ts`）。1〜3 の低レベル帯、143〜157 の +4 帯を含む。
- `boost2`: 6 → **14 ID**。うち 73/75/76/77 は単一能力 +6 ブースター（Ball Control / Speed / Balance / Aggression）。
- 新規に観測したブースター名（すべて既存カタログにキーあり）: Aerial Block, Counter, Fantasista,
  Free-kick Taking, Physicality, Regista。
- **競合 0**。v1 の対応もすべて再確認して一致（同 ID を複数カードで検証）。

### 効果まで確認済み（自動適用対象）

`CONFIRMED_EFFECT_KEYS = ["ball-carrying", "offence-creator"]`（screenshot 実測で対象能力・上昇量を確認したもののみ）。
- Offence Creator は +4（Tielemans 106799730583961・screenshot image.png）でも実測一致。
- **fantasista はカタログ上 confirmed だが screenshot 実測がないため、カード付属の自動適用からは除外**
  （手動試算では従来どおり適用）。この二層構造を明記。

### 名称と効果の分離（`stageLabel`）

UI（`PlayerBoosterPanel`）で解決段階を表示:
- ① 数値IDのみ取得（対応表に未収録）
- ③ 名称・レベル確認済み／効果は検証中（または 発動条件が未確認）
- ⑤ 効果まで確認済み・自動適用

「カード付属ブースター（カードに収録・自動）」と「ブースター試算（手動）」を見出しで明確に分離。
未解決の付属は「付属ブースターは未解決のため能力値へは適用していません」と表示（「付属ブースターのまま」表記を廃止）。

### 能力値表の内訳

`ProgressionResult.playerBoosterByStat`（`{ attached, selected }`）を追加。
`StatComparison` の「選手B」列で、付属と手動試算の両方が効いているときに「付属+N / 試算+M」を併記。

### SQLite（v2・非破壊）

- `player_booster_source_mappings`: 42 → **87 行**。列を非破壊 ALTER で追加
  （`resolved_name` / `resolved_level` / `affected_stats_json` / `per_level_delta` / `condition_note` /
  `verified_card_count` / `conflicting_card_count`）。`sync-booster-resolution.mjs` が古い DB へ自動補完。
- `player_card_resolved_boosters`: 2,371 行（再スキャンで更新）。
- `rulesVersion`: `player-booster-resolution/2026-08-28.v2`。
  `BOOSTER_RESOLUTION_PREVIOUS_VERSIONS = ["...v1"]` で昇格履歴を保持。
