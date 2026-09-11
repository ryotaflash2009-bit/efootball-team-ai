# フェーズ: カード付属ブースターの発動方式（activationType）再監査

調査日: 2026-08-30 ／ 規則: `player-booster-resolution/2026-08-30.v8`

> **関連（2026-09-05）**: この文書は B1（カード付属ブースター）の発動方式監査。B2（ユーザー選択の追加
> ブースター・`selectedPlayerBooster`）と Power of Many の分離・B2 正式化可否の監査は
> `docs/milestones/2026-09-05-b2-booster-readiness.md` を参照。B2 正式化（実験モードの必須解除）は
> 今回未実施（理由は同報告）。`BOOSTER_CATALOG` に `isB2SelectableCandidate` / `isConfirmedB2Candidate`
> を追加（表示上の絞り込みのみ・スキーマ/計算は不変）。

## 1. 調査目的

各カード付属ブースターについて「**何の効果か**（`boosterEffectKey`）」と「**どう発動するか**（`activationType`）」を
分離し、**World ID 単位**で安全に判定する。証拠基準を下げず、誤った固定自動適用を防ぐことを優先する。

## 2. effectKey と activationType の違い

| 概念 | 例 | フィールド |
|---|---|---|
| 効果名（何の能力にいくつ） | Ball Protection = ballControl/tightPossession/physicalContact/balance に +N | `boosterEffectKey`（catalog `key`） |
| 発動方式（どう発動） | fixed（常時）/ power_of_many（Game Plan 人数依存）/ live_update（フォーム連動）| `activation`（World-ID 単位） |

**同じ効果名でも fixed 版と power_of_many 版が併存**する（EFScout `boot.json` で各名称に `color:0/conditional:false` と
`color:2/conditional:true` が両方存在）。→ 効果名だけ・色だけ・`conditional: true` だけで発動方式を決めない。

## 3. fixed

- カード固有のレベルが固定。Game Plan / Live Update に依存しない。
- 効果の証拠レベル（`evidenceLevel`）が基準を満たせば標準/厳密モードで自動適用。
- **当アプリの解決済み fixed は「推定（provisional）」**（§7）。青/金の判別材料が未確認。

## 4. Power of Many

- KONAMI 公式 Version Info v3.2.0: "a new type of Booster ... a property type applicable to multiple boosters"。
  Game Plan の Activation Condition 該当選手数で効果量が段階変化。閾値・最大値はブースターごとに異なる。
- **どのモードでも自動適用しない。** ユーザー段階指定（+0/+1/+2/+3）→ その効果名の対象能力へだけ「条件反映後値」に反映。
- 確定: `total-package`（boost1=83・341 カード・全26能力）、`ball-protection`（boost2=44・3 カード・4能力）。

## 5. Live Update

- KONAMI 公式で存在は確認（Live Update Rating 連動・B 以上で発動・A で最大）。
- **当アプリのデータで Live Update 方式と確定できた World ID は 0 件。** ブースター名・説明にも該当なし。推測で割り当てない。

## 6. unresolved / conflicted

- `unresolved` … 発動方式を確認できない（型としては存在。現状 World ID への割当 0）。
- `conflicted` … 同一 World ID で発動方式の証拠が矛盾。**現状 0 件**（`competing boost1 IDs 0` / conflicts 0）。

## 7. boost1 と boost2 の ID 分離

- **別の ID 体系**。同一数値でも別ブースター。実測 13 件の衝突（すべて別効果）:

| ID | boost1 | boost2 |
|---|---|---|
| 30 | counter+3 | shooting+3 |
| 31 | crossing+2 | strength+3 |
| 32 | crossing+3 | accuracy+3 |
| 36 | duelling+3 | strikers-instinct+3 |
| 40 | free-kick-taking+3 | physicality+3 |
| 42 | goalkeeping+3 | breakthrough+3 |
| **44** | **hard-worker+3（fixed）** | **ball-protection+3（power_of_many）** |
| 52 | offence-creator+3 | hard-worker+3 |
| 56 | physicality+3 | offence-creator+3 |
| 70 | stealing+2 | technique+3 |
| 73 | strength+3 | single-ball-control+6 |
| 75 | strikers-instinct+2 | single-speed+6 |
| 76 | strikers-instinct+3 | single-balance+6 |

複合キーは `source`(world_boost1 / world_boost2 / efhub) + `source_booster_id`。World ID ↔ eFHUB ID ↔ EFScout ID は同一視しない。

## 8. World ID 分布（`data/efootball.db` 実測・読み取り専用）

### boost1

| 指標 | 値 |
|---|---|
| カードで使用中ユニークID | 106 |
| 対応表登録 / 解決済み | 71 / 71 |
| 未解決ID（カードで使用・対応表になし） | 35（例: 16–26 / 45–48 / 66 / 69 / 74 / 77 / 80 / 84 / 86 / 89 / 92 / 143 / 146 / 150–162） |
| 解決済み ID の activation | fixed 70 ID（全 derived・`activationEvidence: provisional`） / power_of_many 1 ID（id 83・explicit・official_verified） |
| live_update 候補 ID | 0 |

### boost2

| 指標 | 値 |
|---|---|
| カードで使用中ユニークID | 27 |
| 対応表登録 / 解決済み | 14 / 14 |
| 未解決ID | 13（38 / 46 / 48 / 50 / 54 / 58 / 60 / 62 / 64 / 66 / 68 / 72 / 74） |
| 解決済み ID の activation | fixed 13 ID（全 derived・provisional） / power_of_many 1 ID（id 44・explicit・screenshot_verified） |
| live_update 候補 ID | 0 |

### カード単位

| 指標 | 値 |
|---|---|
| ブースター付きカード | 2,314 |
| デュアルブースター | 57 |
| fixed のみのカード | 1,909 |
| power_of_many を含むカード | 344（total-package 341 + ball-protection 3） |
| 未解決ID を含むカード | 61 |
| **標準モードで自動適用中（distinct）** | **1,931（v7 と不変）** |
| 条件段階を指定できるカード | 344 |
| activation_conflicted カード | 0 |

## 9. 同名 effectKey が複数 World ID

boost1 のほぼ全効果名に +2 / +3（一部 +4）のレベル違い ID がある（例: `accuracy` = id1(+2) / id2(+3) / id90(+4)）。
**すべて現状 fixed（derived・provisional）。** レベル違いだけで発動方式は変わらないと推定。

`ball-protection` のみ発動方式が分岐:
- boost1 id 11（+2・3 カード・fixed 推定）
- boost1 id 12（+3・34 カード・fixed 推定）
- boost2 id 44（+3・3 カード・**power_of_many 確定**）

## 10. EFScout の fixed/conditional 併存（保存済み調査結果より）

- `allBoosters` の各エントリ: `id / name / jap_name / color / conditional / variable / stat_modifiers`。
- 多くの名称に `color:0 / conditional:false`（通常）と `color:2 / conditional:true`（purple）が併存。`color:1`（gold）は `variable:true`。
- **EFScout の `conditional` / `variable` は主にブースター item の色ティア区分**であり、ゲーム内の発動条件そのものを説明しない。
  → 「同名の固定版と条件版が存在しうる」という候補抽出に使えるが、World ID の activationType 確定には使えない。
- **World ID ↔ EFScout ID の対応表は非公開。** EFScout ID を World ID 列へ保存しない。

## 11. スクリーンショット証拠

| relativePath | worldCardId | slot | booster | color | 段階変更前後 | activationTypeCandidate | evidence |
|---|---|---|---|---|---|---|---|
| `スクリーンショット 2026-08-29 014855.png` / `194846.png` | 89138556575063 | 1 | Accuracy +4 | 青 | — | fixed（青と明示）だが判別元データ未確認 → provisional | ユーザー提供 |
| `スクリーンショット 2026-08-29 014855.png` / `194846.png` | 89138556575063 | 2 | Ball Protection +3 | **金** | 段階を下げると対象4能力だけ各 -1 / OVR 94→93 | **power_of_many（screenshot_verified）** | ユーザー実測 |
| `スクリーンショット 2026-08-28 020026.png` | 89136409091415 | 1 | Ball-carrying +5 | — | — | fixed（screenshot_verified・効果のみ）／方式は provisional | ユーザー保存 |
| `image.png` / `image (1).png` | 106799730583961 | 1 | Offence Creator +4 | — | — | fixed（screenshot_verified・効果のみ）／方式は provisional | ユーザー保存 |

**青/金ヘキサゴンの元データ（HTML/CSS/JSON）を写したスクリーンショットは無い。** 色を直接見られるのは Messi の 2 スロットのみ。
Bruno `106799730641209` は boost1=149(Balancer+4) / boost2=0（eFHUB の Aerial+1 は空きスロットへのユーザー試算）。

## 12. KONAMI 公式情報

- Version Info v3.2.0「The Power of Many」節: 発動方式の存在・仕組み・「効果量と必要人数はブースターごとに異なる」を明記。
- 別方式として Live Update Rating 連動を明記。
- **per-World-ID / per-card の発動方式一覧、能力重み、閾値の完全な数値表は非公開。**

## 13. activationEvidence（発動方式の証拠レベル・効果の evidenceLevel とは別軸）

| 値 | 意味 | 該当 |
|---|---|---|
| `official_verified` | KONAMI 公式が発動方式を明記 | `total-package`（boost1=83） |
| `screenshot_verified` | ユーザー提供の画面で段階変化 or 条件表示を確認 | `ball-protection`（boost2=44） |
| `external_cross_verified` | 複数の独立外部ソースで一致・カード対応も確認 | 現状 0 |
| `provisional` | 状況証拠のみ（色系列・slot 位置）。カード裏取り不足＝**推定** | 解決済み fixed 全 83 ID（boost1 70 / boost2 13） |
| `unresolved` | 発動方式不明 | 対応表に無い 48 ID |
| `conflicted` | 証拠が矛盾 | 0 |

## 14. 標準適用条件（実装の正）

`resolveAttachedBooster()` / `appliesInMode()` の実装より:

| effectEvidenceLevel | activationType | activationEvidence | 厳密モードで適用 | 標準モードで適用 |
|---|---|---|---|---|
| game_client_verified | fixed | （問わない） | ✅ | ✅ |
| screenshot_verified | fixed | provisional でも ✅ | ✅ | ✅ |
| external_cross_verified | fixed | **provisional でも ✅** | ❌ | ✅ |
| effect_provisional | fixed | — | ❌ | ❌ |
| conditional_unverified（total-package）| power_of_many | official_verified | ❌ | ❌ |
| （どれでも）| power_of_many / live_update / unresolved | — | ❌ | ❌ |

- **適用の基準は「効果内容（対象能力・上昇量）の証拠」であり、`activationEvidence` は適用可否をゲートしない。**
  厳密モードも標準モードも `activation === "fixed"` かどうか（＝ Power of Many の**明示フラグ**が付いていないか）と `evidenceLevel` だけで決まる。
- したがって §4 の答えは **A**（厳密モードは効果証拠のみを基準・発動方式の証拠は要求しない）。標準モードも同じ。
- **v8.1 での挙動変更**: なし。fixed の `activationEvidence` を `provisional` にしても、UI/ドキュメント文言を修正しても計算は不変。

### confirmed_fixed が 0 なのに 1,931 カードが標準適用される理由

`activation` はデフォルトで「Power of Many の**明示指定が無ければ fixed**」と導出する（`hit.activation ?? (def.conditional ? "power_of_many" : "fixed")`）。
「Power of Many である具体的証拠がない」＝「fixed として暫定適用」。効果内容は外部2ソースで照合済みなので標準モードへ適用する。
`activationEvidence: provisional` は「固定型と**確認**したのではなく**推定**」を表すラベルであり、適用ロジックには影響しない。

### 正しい説明文（UI / ドキュメント共通）

- 短い表示: **「外部照合済み・固定型推定を含む」**
- 詳細: 「標準モードでは、対象能力と上昇量を外部データ間で照合したブースターを適用します。発動方式の証拠が不足する一部のブースターは、Power of Many（条件型）である具体的証拠がないため固定型として暫定適用しています。」
- fixed 推定バッジ: **「固定型・推定」** または「固定型（発動方式未確認）」
- **使わない表現**: 「confirmed fixed だけを適用」「発動方式確認済みのみを適用」「公式確認済み固定ブースター」「すべて固定型として確認済み」「条件なしを確認済み」

### 集計（`auditActivation()` — 単一の真実源）

| 指標 | World のみ | eFHUB 2 ID を含む |
|---|---|---|
| confirmedFixedIdCount | 0 | 0 |
| provisionalFixedIdCount | 83（boost1 70 / boost2 13）| 85 |
| confirmedPowerOfManyIdCount | 2（boost1=83 / boost2=44）| 2 |
| unresolvedActivationIdCount | 48（対応表に無い使用中 ID）| 48 |
| standardAppliedCardCount | 1,931 | — |
| conditionalSelectableCardCount | 344 | — |

## 15. 誤適用候補

現在 `external_cross_verified` で標準自動適用中の 83 fixed ID（1,931 カード）は、
**発動方式が `provisional`（推定）** = Power of Many 版だった場合「最大効果を無条件表示」の過大評価になり得る。

| 分類（§13） | 該当 | 今回の扱い |
|---|---|---|
| `confirmed_fixed` | なし（青/金の判別元データ未確認） | — |
| `confirmed_power_of_many` | boost1=83 / boost2=44 のみ（v7 で対応済み） | 固定自動適用を停止済み・条件指定UIへ接続済み |
| `suspected_conditional` | なし（特定 ID を PoM と疑う具体証拠なし） | — |
| `activation_unknown`（＝ provisional） | 解決済み fixed 全 83 ID / 1,931 カード | **一括変更しない。** UI で「固定（推定）」と明示。証拠が出たら個別に修正 |
| `conflicted` | 0 | — |

**誤適用の可能性**: 理論上 1,931 カードすべてにあるが、特定カードの誤りは未確認。
**自動適用を維持するリスク**: Power of Many 版が混在していた場合、そのカードの標準最終値が過大（最大効果ぶん）になる。
**未適用へ戻すリスク**: 大多数（おそらく大半が本当に fixed）で標準最終値が過小になり、既存の保存ビルド・比較・スカッドの数値が一斉に変わる。
→ **証拠なしの一括変更・ロールバックはしない**（§13・§23）。UI で「推定」と明示し、ユーザーが判断できるようにする。

## 16. カード数への影響

| 指標 | v7 | v8 | 差分 |
|---|---|---|---|
| 標準モードで自動適用（distinct カード） | 1,931 | 1,931 | 0 |
| power_of_many を含むカード | 344 | 344 | 0 |
| 固定適用を停止したカード | 3（v7 で実施済み） | 0（今回の追加停止なし） | 0 |
| 条件指定可能カード | 344 | 344 | 0 |
| 対象能力の変化 | — | 0（計算不変） | — |
| 不正能力値 / 99超過 / 負値 | 0 | 0 | 0 |

## 17. 変更した World ID

**activationType を変更した World ID: 0 件。**
`activationEvidence` の付与のみ:
- boost1=83（total-package）→ `official_verified`
- boost2=44（ball-protection）→ `screenshot_verified`
- 他 83 fixed ID → `provisional`（新規付与）

## 18. 変更しなかった World ID

解決済み fixed 83 ID（boost1 70 / boost2 13）は activationType = fixed のまま。
**証拠がないため（青/金の判別元データ未確認・ScoreBar 差分では区別不可）。**

## 19. 反例

なし。既存の `external_cross_verified` 27 種は「別カード 2 枚以上・delta==level・反例 0」で効果を検証済み（発動方式とは独立）。

## 20. 競合

`player_booster_conflicts` = 0。`competing boost1 IDs` = 0（全 71 ID が一意のブースターに対応）。

## 21. 未解決問題

1. **解決済み fixed 83 ID の青/金判別**（＝ `provisional` → `confirmed_fixed` or `confirmed_power_of_many`）。
2. 対応表に無い 48 World ID（boost1 35 / boost2 13）の名称解決。
3. Live Update 方式の World ID 特定。
4. familiarity 補正・per-position 重み（別マイルストーン `docs/phase-position-overall.md`）。

## 22. 次に必要な証拠

- **eFHUB 個別ページの青/金ヘキサゴンを決めている元データ**（HTML class 名 / CSS / 埋め込み JSON）。ユーザーによる eFHUB ページソース提供、または `./screenshots/` への該当画面追加。
- **eFootball World 個別ページの RSC 生ペイロード**（booster の color / conditional / type フィールドがあるか。WebFetch の Markdown 変換では失われる）。
- **各効果名の代表カードでゲーム内 Game Plan を変えて能力変化を観測**（fixed なら不変、Power of Many なら変化）。最優先: Ball Protection の boost1=12（34 カード）、Shooting boost1=65（150 カード）、Strikers Instinct boost1=76（117 カード）。
- 次回の最短手順:
  a. ユーザーに「育成タブで付属ブースターが青/金で表示されているスクリーンショット」を効果名ごとに 1〜2 枚依頼。
  b. 色が確認できた World ID を `activationEvidence: screenshot_verified` へ更新（fixed 確定 or power_of_many 確定）。
  c. power_of_many と判明した ID は `WORLD_BOOST*_MAP` に `activation: "power_of_many"` を追加し、既存の条件指定 UI へ接続（`ConditionalBoosterControl`）。
  d. カード数の差分と、標準自動適用カード数の変化を報告。

## 23. rulesVersion

- `player-booster-resolution/2026-08-28.v7` → **`player-booster-resolution/2026-08-30.v8`**（`activationEvidence` を分離・fixed の大半を「推定」と明示）。
- `conditional-booster/2026-08-28.v2` は不変。
- `booster-catalog/2026-08-28.total-package-1` は不変。
- v1〜v7 は `BOOSTER_RESOLUTION_PREVIOUS_VERSIONS` に保持（読み込み互換）。
