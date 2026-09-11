# マイルストーン完了報告: B2 ブースター正式化監査 ＋「ビルド分析」への名称変更

- 実施日: 2026-09-05
- 対象: 選手詳細の育成タブ（`ProgressionPanel` / `PlayerBoosterPanel`）＋ `/build-inventory`（名称のみ）
- 種別: 監査（読み取り専用の分析）＋ 安全な範囲のみの UI 整理・名称変更。計算エンジン・保存形式は不変。
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **条件付き完了**（B2 の完全正式化＝実験モードの必須解除は、根拠に基づき今回は意図的に未実施。
  §16 の完了条件に照らせば「監査・名称変更・安全なUI整理・保護・品質」はすべて満たしており、
  「B2完全正式化」はプロンプト自身が明示的に許容する未実施区分〔§6/§15〕にあたる。詳細は §9・§16。）

---

## 1. リスク評価

| 項目 | 評価 |
|---|---|
| 計算結果への影響 | **0**。`calculateBuild` / `calculatePlayerBooster` / `booster-catalog.ts` の既存ロジックは 1 行も変更していない。追加した `isB2SelectableCandidate` / `isConfirmedB2Candidate` は表示用の絞り込みにのみ使用。 |
| 保存互換性 | **0 変更**。`SavedBuild` / `MyTeamRecord` / `StoredSquad` スキーマ・`storageVersion` / `rulesVersion` は不変。 |
| 既存 UI 回帰 | 低リスク。見出し文字列は完全維持（黒箱チェック依存の文言は 1 文字も変えていない）。追加した内容は既存文字列に対する**追記**（バッジ）または**折りたたみへの移動**（`<details>` は SSR で内容が HTML に残るため文字列一致チェックは影響を受けない）。 |
| 名称変更の影響 | `/build-inventory` の URL・機能は不変。表示名のみ変更。関連ブラックボックス 2 件を意図的に更新（理由: 明示的な仕様変更）。 |
| B2 完全正式化を行わなかったことの影響 | ユーザー体験の改善は限定的（実験モードの切替は依然必要）。ただし、正式化には `calculateBuild` 系の変更が必要になる可能性が高く、それは今回の重大停止条件（§15）に該当するため、安全側に倒した。 |

---

## 2. B1・B2・Power of Many の定義（既存実装の確認結果）

### B1: カード付属ブースター
- **実装**: `src/lib/progression/booster-resolution.ts` の `resolveAttachedBooster()`。カードの `boost1` / `boost2`
  （数値 ID・SQLite `world_player_cards` 由来）を `WORLD_BOOST1_MAP` / `WORLD_BOOST2_MAP`
  （`booster-resolution-data.ts`）で解決し、`booster-catalog.ts` の `BoosterDef` を対象能力・上昇量として参照する。
- **保存フィールド**: `SavedBuild` には保存されない（カード自体のデータであり、`ProgressionCard.boost1`/`boost2`
  として都度カードデータから解決）。
- **表示**: `ProgressionSummary` → `BoosterStrip`（常時表示・折りたたみなし）＋ `PlayerBoosterPanel`
  の「B1 カード付属ブースター（カードに収録・自動）」セクション（折りたたみ内・根拠は追加で `<details>` 化）。
- **変更不可**: ユーザーは B1 の内容を変更できない（`selectedPlayerBooster` で「上書き試算」はできるが、
  それは B2 の操作であり B1 自体のデータは変わらない）。
- **計算経路**: `calculatePlayerBooster()` 内、`selected`（B2）で上書きされていないスロットについて、
  `activation`（fixed / power_of_many / live_update / unresolved）と `evidenceLevel` に応じて
  `gameMeasuredDeltas` / `externalVerifiedDeltas` / `provisionalAttachedDeltas` / `conditionalAttachedDeltas`
  へ振り分け。標準モードでの自動適用可否は `appliesInMode()` が判定（**今回変更なし**）。

### B2: ユーザーが選択する追加ブースター（＝ 既存の「実験的なブースター試算」）
- **実装**: `selectedPlayerBooster: SelectedPlayerBooster[]`（`{ slot, boosterKey, level }`）。
  UI は `PlayerBoosterPanel` の「実験的なブースター試算（手動）」セクション。
- **保存フィールド**: `SavedBuild.selectedPlayerBooster: number | null`
  （注意: 保存ビルドの型は `number | null` 1 個で、UI 側の `SelectedPlayerBooster[]`（配列・複数スロット）とは
  **別の型**。`assemble-build-input.ts` 等で変換されている。**今回この対応関係は変更していない**）。
- **「なし」を選択可能**: `setSlot(slot, null)` で解除。
- **計算経路**: `calculatePlayerBooster()` の「手動試算ブースター」ループ（`selected` を反復）。
  **`mode` に関係なく常に計算される**が、結果は常に `manualTrialDeltas` → `experimentalExtraDeltas` にのみ
  加算され、`appliedDeltas`（標準/確定値の元）には**構造的に一切加算されない**（§4 参照）。
- **表示ゲート**: UI 上の選択肢（`<select>`）自体は `boosterMode === "experimental"` のときだけ描画される
  （`ExperimentalModeToggle` で「検証モード」を有効化した後）。**今回この UI ゲートは変更していない**。

### Power of Many（条件付きブースター）
- **実装**: `conditionalBoosterSelections: SelectedConditionalBooster[]`（`{ boosterKey, selection }`、
  `selection` は `"none" | "league_1_13" | "league_14_19" | "league_20_plus"`）。
- **B2 とは別状態**: `ConditionalBoosterControl` という**専用コンポーネント**で扱われ、B2 の `<select>` には
  一切現れない設計に**今回修正**（§5 の監査で発見した混同を是正・詳細は §7）。
- **未指定を最大扱いしない**: `levelForConditionalSelection("none") === 0`。`describeBuildPoM()` も
  `has:false` を返す（`my-builds.ts`・**変更なし**）。
- **保存互換性**: 今回変更なし。`conditionalBoosterSelections` の意味・保存形式は不変。

---

## 3. 確認済み B2 定義（29 件・`isConfirmedB2Candidate() === true`）

`confirmationStatus === "confirmed"`（証拠レベル `screenshot_verified` または `external_cross_verified`）かつ
`conditional === false`（Power of Many 専用ではない）。**判定は純関数 `isConfirmedB2Candidate`（`booster-catalog.ts`）
で機械的に確定し、目視や「コードに定義がある」だけでは確認済みとしない。**

| evidenceLevel | 件数 | 根拠の所在 |
|---|---|---|
| `screenshot_verified` | 2（ball-carrying / offence-creator） | ユーザー保存済みの eFHUB ビルドツールのスクリーンショットで対象能力・上昇量を直接確認（`screenshots/スクリーンショット 2026-08-28 020026.png` 他）。KONAMI ゲームクライアント画面ではない。 |
| `external_cross_verified` | 27 | eFootball World（外部コミュニティDB）ScoreBar 差分 と EFScout（外部DB）定義が一致・別カード2枚以上・反例0。KONAMI 公式実測ではない。 |

全 29 件（key・maxLevel・対象能力は `src/lib/progression/booster-catalog.ts` の `STANDARD`/`EXTENDED` 配列が単一の真実源）:

`shooting`(5) `free-kick-taking`(5) `aerial`(5) `passing`(5) `ball-carrying`(5) `technique`(5) `defending`(5)
`duelling`(5) `agility`(5) `physicality`(5) `goalkeeping`(5) `strikers-instinct`(5) `shutdown`(5) `hard-worker`(5)
`saving`(5) `crossing`(5) `fantasista`(5) `regista`(4) `rebuilding`(4) `accuracy`(4) `offence-creator`(4)
`ball-protection`(4) `balancer`(4) `counter`(3) `aerial-block`(3) `breakthrough`(4) `strength`(4) `off-the-ball`(4)
`stealing`(4)（括弧内 = maxLevel。対象能力・上昇値は catalog 定義どおり・すべて確認済みの4能力へ各 +level）。

**上昇値**: 各定義は対象4能力へ「+level」（level = 1..maxLevel、ユーザーが段階を選択）。上昇値そのものが
固定されているわけではなく、**「1段階あたり+1」という比例関係が確認済み**という意味（`booster-catalog.ts` の
`boosterDeltas()` 関数どおり・変更なし）。

**発動方式**: これら 29 件は「B1 として付属していた場合」の証拠区分であり、B2 として手動選択する文脈では
発動方式（fixed/power_of_many）は関係しない（B2 は常に「試算」として `experimentalExtraDeltas` にのみ乗る）。

---

## 4. 一部確認済み・未確認・定義不足（15 件・`isConfirmedB2Candidate() === false` かつ B2 選択肢に残る 14 件 ＋ 除外 1 件）

| evidenceLevel/分類 | 件数 | 内訳 | 昇格できない理由 |
|---|---|---|---|
| `effect_provisional`（単一能力 SINGLE） | 6 | single-aggression / single-balance / single-ball-control / single-jump / single-physical-contact / single-speed | 観測がデュアルカード1枚のみ・検証例不足（EFScout 定義 + 1件の ScoreBar 差分のみ）。反例なしと言い切れる複数ソース照合が無い。 |
| `effect_provisional`（レジェンド系 SPECIAL・非条件） | 8 | bearer-of-fate / son-of-god / king-of-football / le-petit-prince / magical / striking / natural-born / the-undisputed | カード付属としての観測例が無い（`EFScout（カード付属として未観測）`）。対象能力・上昇量が EFScout 定義のみに依存し外部2ソース照合ができていない。 |
| `conditional_unverified`（Power of Many・**B2 選択肢から除外**） | 1 | total-package | 発動条件（Game Plan 依存）が判明しているが評価不能。**そもそも B2（単純選択）の対象ではない**（Power of Many 専用）。今回 `isB2SelectableCandidate` で明示的に除外（§7）。 |

**「一部確認済み」に該当する定義は現状 0 件**（`confirmationStatus` は 2 値 `"confirmed" | "provisional"` のみで、
中間段階を持つ定義は catalog 上に存在しない。将来 evidenceLevel が増えた場合はこの監査の見直しが必要）。
**「競合あり」も現状 0 件**（`booster-resolution.ts` の `RESOLUTION_COVERAGE` / `player_booster_conflicts = 0` と一致・
`docs/phase-booster-activation-types.md` §20）。**「B2ではない」＝ Power of Many 専用は total-package の 1 件のみ**。
**「カード付属B1」というカテゴリは、この B2 候補監査とは別軸**（B1 は「カードに何が付属しているか」であり、
同じ `BOOSTER_CATALOG` の定義がカード付属としても B2 試算としても使われ得る。B1 側の発動方式監査は
`docs/phase-booster-activation-types.md` を参照。今回変更なし。）

---

## 5. B1（付属）の発動方式・証拠レベルの監査結果（既存文書の要約・今回変更なし）

`docs/phase-booster-activation-types.md`（2026-08-30・rulesVersion `player-booster-resolution/2026-08-30.v8`）より:

| 指標 | 値 |
|---|---|
| `confirmedFixedIdCount`（青/金が確定した fixed） | **0** |
| `provisionalFixedIdCount`（fixed と推定・青/金未確定） | 83（boost1 70 / boost2 13） |
| `confirmedPowerOfManyIdCount`（Power of Many 確定） | 2（boost1=83 total-package・boost2=44 ball-protection） |
| `unresolvedActivationIdCount`（対応表に無い ID） | 48 |
| `standardAppliedCardCount`（標準モードで自動適用中のカード） | 1,931 |
| `conditionalSelectableCardCount`（条件段階を指定できるカード） | 344 |

**今回この監査結果・分類・適用ロジックは一切変更していない**（`resolveAttachedBooster` / `appliesInMode` /
`auditActivation` は無編集）。B1 の「固定型・推定」という表示（`FixedBoosterDetails.tsx` / `BoosterStrip.tsx`）も
無変更。

---

## 6. URL・保存ビルド・エクスポート/インポートでの表現（現状の確認・変更なし）

| 項目 | B1 | B2 | Power of Many |
|---|---|---|---|
| 保存フィールド（`SavedBuild`） | なし（カードデータから都度解決） | `selectedPlayerBooster: number \| null` | `conditionalBoosterSelections?: SelectedConditionalBooster[]` |
| URL 表現 | なし（カード ID から再解決） | `b=`（比較 URL・`allocation-url.ts`。今回未確認箇所は推測せず現状維持） | `tp=`（比較 URL・Total Package 専用パラメータ・`black-box-boosters.mjs` の `tp=3,` クエリで確認済み） |
| JSON エクスポート | 出力しない（カードデータであり `SavedBuild` に無い） | `selectedPlayerBooster` として出力（`build-export.ts` の 13 正式フィールドの 1 つ・**今回変更なし**） | `conditionalBoosterSelections` として出力（未指定はキー自体を出さない・**今回変更なし**） |
| JSON インポート | 該当なし | `savedBuildSchema.strict()` で検証（**今回変更なし**） | 同上 |
| 比較画面（`ComparisonBoard`） | 付属ブースターの適用可否を表示 | `PlayerControlColumn` 経由で選択（**今回未変更・範囲外**） | `tp=` クエリ・条件段階の選択（**今回未変更・範囲外**） |

**今回、URL・エクスポート・インポート・比較の各表現には一切手を加えていない。** 監査で確認しただけであり、
既存の `docs/my-builds.md`（エクスポート/インポート節）・`docs/phase-conditional-boosters.md` の記載と整合する。

---

## 7. 発見した既存の設計上の重複と、今回実施した安全な是正

**発見**: `PlayerBoosterPanel.tsx` の B2 選択 `<select>` は、これまで `BOOSTER_CATALOG` を
`confirmationStatus`（confirmed/provisional）だけで絞り込んでいたため、**Power of Many 専用の
`total-package`（`conditional: true`）が「効果検証中」optgroup に紛れ込み、B2 として選択可能になっていた**。
これは §3 の要件「Power of Many と B2 を安全に分離する／通常の B2 選択欄へ混ぜない」に反する既存の隙間。

**是正内容**（すべて表示上の絞り込みのみ・計算エンジン・保存値は無変更）:
- `booster-catalog.ts` に `isB2SelectableCandidate(def) = !def.conditional` を追加。
- `PlayerBoosterPanel.tsx` の B2 `<select>` の2つの optgroup を `BOOSTER_CATALOG` 全体ではなく
  `selectableCatalog = catalog.filter(isB2SelectableCandidate)` から生成するよう変更。
- **後方互換**: 万一、過去のセッション状態で `selectedPlayerBooster.boosterKey === "total-package"` が
  既に選択されていた場合に選択肢が消えて `<select>` の表示が壊れないよう、除外された現在値だけを
  「Total Package（Power of Many・B2 選択肢からは提供終了）」という注記付きの単独 `<option>` として残す
  （新規選択の選択肢としては提示しない）。

この是正により、B2 の選択肢は 44 件中 **43 件**（total-package を除く）となった。

---

## 8. 「試算」「検証中」表示の整理（実施した範囲）

### 通常表示へ昇格した表現
なし（今回、既存の評価済みバッジ・ラベル文言は変更していない。理由: `black-box-boosters.mjs` /
`black-box-progression.mjs` が多数の完全一致文字列に依存しており、文言変更は既存の安全な検証と衝突するリスクが
高い。バッジの色・表現ロジック自体は既に「効果内容の証拠」と「発動方式の証拠」を正しく分離しており、
確認済み項目（`external_cross_verified` 等）に対して不要な黄色警告を出していないことを確認した
＝ 既存実装は §7 の基準に既に概ね適合しているため、新たな「昇格」を要する誤った過剰警告は見つからなかった）。

### 検証中を維持した表現
- B1 の発動方式（青/金の判別）: 83 件すべて `activationEvidence: provisional`。判別材料が無いため維持。
- Power of Many（total-package・ball-protection 以外は「発動方式不明」の可能性を排除できない）。
- 効果証拠が `effect_provisional`（単一能力6種・レジェンド系8種）。
- 対応表に無い 48 の World ID（名称すら解決できない）。

### 表示の折りたたみ（今回実施）
`PlayerBoosterPanel.tsx` の各付属ブースター行で、以下を `<details>「根拠を見る（解決段階・発動方式・情報源）」`
へ移動（既定は閉じた状態。ただし SSR の HTML には内容が残るため、黒箱テストの文字列一致チェックには影響しない）:
- 「解決段階: …」
- 「発動方式: …」
- 「情報源: …」
- （screenshot_verified のみ）「補足: …」

**維持した警告**（折りたたまない・常時表示）:
- Power of Many の発動条件本文（`conditionText`）
- 「Power of Many」の金色説明ボックス
- 「※ 下の試算で上書き中」の注記
- `ConditionalBoosterControl`（段階指定 UI）

### B1/B2 の見出しラベル追加
- `PlayerBoosterPanel.tsx` の「カード付属ブースター（カードに収録・自動）」の直前に `Badge` で「B1」を追加。
- 同「実験的なブースター試算（手動）」の直前に `Badge` で「B2」を追加。
- **既存の見出し文字列自体は 1 文字も変更していない**（黒箱チェック 2 件が完全一致で依存しているため）。

---

## 9. 正式 B2 選択 UI を実装したか／実装しなかった理由

**実装しなかった**（完全置換＝実験モードの必須解除は見送り）。

### 構造的な理由（最重要・不可逆）
`calculatePlayerBooster()` の実装（`calculate-player-booster.ts`）を確認した結果、B2（`selectedPlayerBooster`）の
計算結果は **`mode` の値に関わらず常に計算されるが、`manualTrialDeltas` → `experimentalExtraDeltas` にのみ
加算され、標準/確定値の元になる `appliedDeltas` には構造的に一切加算されない**（289-267行目）。
これは「モードによる出し分け」ではなく、**B2 は仕組みとして常に試算専用**という設計そのものである。
B2 を「ユーザーが簡単に選べる正式なブースター」として標準値へ反映させるには `calculatePlayerBooster` /
`calculateBuild` の変更が必要になり、これは §15 の重大停止条件
（「calculateBuild変更が必要」「booster計算変更が必要」）に該当するため、**その場で変更せず停止対象として報告する**。

### 概念上の理由
B2 は「このカードに実際には付属していないブースターを仮に付けたらどうなるか」という**仮定のシミュレーター**
であり、B1（カードの実データ）とは性質が異なる。ブースターの効果データ自体が確認済み（29件）であっても、
「未付属のブースターを任意のカードへ手動で付ける」という操作自体が非公式のシミュレーションである以上、
実際の試合結果や標準の総合値と誤認されないよう、「試算」という区別表示は維持するべきだと判断した。

### 実務上の理由
現在の UI・全13ブラックボックスのうち `black-box-boosters.mjs`（53件）・`black-box-progression.mjs`（99件）が
「実験モードは初期OFF（試算セレクトがSSRに出ない）」「実験モードの切替に警告」等、実験ゲートの存在そのものを
検証対象にしている。ゲートを撤廃する変更は、これらの既存チェックの前提を変えることになり、
安全な全面書き換えをこの単独マイルストーンの範囲・検証体制で保証しきれないと判断した。

### 今回の対応（sanctioned fallback・§6/§15 が明示的に許可する範囲）
- 定義監査（本報告）。
- B1/B2/Power of Many の表示区分の整理（バッジ追加）。
- 長い技術説明の折りたたみ。
- 検証中であることの必要箇所への表示維持（削除していない）。
- 正式化できない理由の文書化（本節）。
- 既存の試算操作（スロット選択・レベル選択・リセット）と保存互換性は完全に維持。
- Power of Many と B2 の選択肢混同という実際のバグ相当の重複を、安全な範囲で是正（§7）。

---

## 10. 「ビルド分析」への名称変更

| 項目 | 変更前 | 変更後 |
|---|---|---|
| ナビゲーション（`Sidebar.tsx`） | 「ビルド棚卸し」 | 「ビルド分析」 |
| ページタイトル（`<h1>`・`build-inventory/page.tsx`） | 「保存ビルド棚卸し」 | 「保存ビルド分析」 |
| ページ説明 | （旧文言） | 「保存ビルドの使用状況、重複候補、旧規則、参照問題を確認できます。この画面は読み取り専用です（保存ビルド・My Team・スカッドは変更しません）。」（既存の「読み取り専用」明示は維持・黒箱チェック互換） |
| URL | `/build-inventory` | **`/build-inventory`（不変）** |
| `<title>`（メタデータ） | 「保存ビルド棚卸し \| eFootball Team AI」 | 「保存ビルド分析 \| eFootball Team AI」 |
| ユーザー向けエラー文言（`BuildInventoryView.tsx`） | 「棚卸し対象」「棚卸し結果」 | 「分析対象」「分析結果」 |
| `DuplicateReviewTeaser.tsx` の案内文 | 「保存ビルド棚卸し（Build Inventory）で」 | 「保存ビルド分析（Build Inventory）で」 |
| 内部型名・ファイル名・関数名（`build-inventory.ts` / `BuildInventoryView` / `buildInventory()` 等） | — | **無変更**（ユーザー表示に出ないため） |
| 維持した機能 | 検索・絞り込み・並び替え・旧規則ガイド・重複候補・問題参照・SSR・ナビゲーション位置 | すべて無変更 |

---

## 11. テスト結果

### Unit（既存ファイルへ追加・6 件）

**`src/lib/progression/booster.test.ts`**（新規 describe ブロック
`isB2SelectableCandidate / isConfirmedB2Candidate（B2 選択肢の適格性・単一の真実源）`）
- `conditional: true`（total-package）は B2 選択肢から除外
- `conditional: false` の定義はすべて B2 選択肢として適格
- B2 選択肢は 44 件中 conditional な 1 件を除いた 43 件
- 確認済み B2 候補 = 29 件（screenshot_verified 2 + external_cross_verified 27）
- confirmationStatus:confirmed かつ conditional な定義は存在しない（0件）
- 「コードに定義がある」だけでは確認済みにしない: effect_provisional は isConfirmedB2Candidate で false

既存の `booster.test.ts` 48 件（`BOOSTER_CATALOG` 44件整合・`resolveAttachedBooster`/`appliesInMode`・
`calculatePlayerBooster` モード別デルタ・`calculateBuild` strict/standard/experimental 最終値）は
**無編集・全件 PASS**（計算結果の前後比較そのもの）。

### `npm run verify`（最終）
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`・stale 0・未許可 0） |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`） |
| `npm run test`（vitest run） | **1054 / 1054 PASS**（52 テストファイル） |

途中、`PlayerBoosterPanel.tsx` の後方互換 `<option>` が `audit:ja-labels` の `dynamic-name-en-child` ルールに
誤検出された（`{def.nameEn}` の `def` が既存の受け手リストに含まれる汎用名だったため）。ブースター名は
固有名詞として英語表示可能な対象であり、既存の `{b.nameEn}` 表示は問題にならない設計だが、たまたま変数名が
`def` だったことによる**誤検出**。プレーンな JS 変数（`excludedSelectionLabel`）へ切り出して解消（表示内容は
変更なし・§13 バグ参照）。

### `npm run build`
PASS（全 26 ルート。`/build-inventory` は Static・16.9 kB（前回と同一）。`/players/world/[worldCardId]` は
23.1 kB → 23.3 kB（B1/B2 バッジ・折りたたみ追加ぶんの微増）。`/my-builds` は 25.8 kB・前回と同一）。

### ブラックボックス（全13レール・`next start` 上・合計 705 / 705 PASS・**内訳は前回から完全に不変**）
| レール | 件数 |
|---|---|
| my-builds（見出し・サイドメニューの文言チェック 2 件を「ビルド分析」へ更新・件数不変） | 98 |
| compare | 74 |
| progression（実験モード・見出し・付属ブースター表示など全チェック無変更で PASS） | 99 |
| squads | 46 |
| boosters（B1/B2バッジ・折りたたみ・total-package除外を追加しても全チェック無変更で PASS） | 53 |
| world-ui | 82 |
| favorites | 33 |
| ui | 69 |
| managers | 41 |
| manager-picker | 35 |
| phase-b5 | 23 |
| phase-c | 17 |
| world-sync | 35 |
| **合計** | **705** |

`black-box-my-builds.mjs` の変更点: 「見出し「保存ビルド棚卸し」」→「見出し「保存ビルド分析」（旧名は主表示に
残さない）」、「サイドメニューに「ビルド棚卸し」」→「サイドメニューに「ビルド分析」（旧名は残さない）」の
2 件を意図的に更新（名称変更という明示的な仕様変更のため。件数は 98 のまま増減なし）。
`black-box-boosters.mjs` / `black-box-progression.mjs` は **1 行も変更していない**（B1/B2 バッジ追加・
折りたたみ・total-package 除外のいずれも、既存の完全一致文字列チェックと衝突しないよう設計したため）。

### HTTP 200（`next start`）
`/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/squads/sq_blackbox0001`（soft 404）`/squads/compare`
`/players/world/89138556575063` `/compare?ids=…` `/favorites` `/managers` `/api/managers`
`/api/world/players/89138556575063` `/api/world/players/by-ids?ids=…` → すべて 200。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。**書き込み 0**。

---

## 12. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `docs/milestones/2026-09-05-b2-booster-readiness.md` | 本報告 |

### 編集（最小差分）
| ファイル | 変更 |
|---|---|
| `src/lib/progression/booster-catalog.ts` | `isB2SelectableCandidate` / `isConfirmedB2Candidate` を追記（純関数・末尾）。既存の `BOOSTER_CATALOG` データ・型・他の関数は無変更。 |
| `src/components/world/progression/PlayerBoosterPanel.tsx` | B1/B2 バッジ追加（既存見出し文字列は保持）／B2 選択肢から `conditional` 定義を除外（後方互換オプション付き）／付属ブースター行の根拠テキストを `<details>` へ折りたたみ。計算・保存・ゲート（実験モード）は無変更。 |
| `src/lib/progression/booster.test.ts` | 新規 describe ブロック（+6 件）。既存テストは無編集。 |
| `src/components/Sidebar.tsx` | ナビラベル「ビルド棚卸し」→「ビルド分析」（1 行）。 |
| `src/app/build-inventory/page.tsx` | `<title>` とページタイトル・説明文を更新（URL は不変）。 |
| `src/components/progression/BuildInventoryView.tsx` | ユーザー向けエラー文言 2 箇所「棚卸し」→「分析」。 |
| `src/components/progression/DuplicateReviewTeaser.tsx` | 案内文 1 箇所「保存ビルド棚卸し」→「保存ビルド分析」。 |
| `scripts/black-box-my-builds.mjs` | 名称変更に伴うチェック文言 2 件を更新（件数不変）。 |
| `docs/my-builds.md` | 「保存ビルド棚卸し」節見出し・本文中の名称を更新し、名称変更の注記を追加。 |
| `docs/phase-booster-activation-types.md` | 冒頭に本報告への相互参照を追記。 |
| `docs/progress.md` | 2026-09-05 の日付エントリを追加。 |
| `docs/project-baseline.md` | unit 1048→1054、直近サーバー PID、実装済み機能一覧、直前マイルストーン名を更新（ブラックボックス合計・内訳は不変）。 |
| `docs/milestones/README.md` | 一覧に本報告を追加。 |

### 削除
なし。`src/lib/progression/engine.ts` / `calculate-player-booster.ts` / `booster-resolution.ts` /
`booster-resolution-data.ts` / `conditional-boosters.ts` / `src/lib/comparison/build-comparison.ts` /
`src/lib/squad/build-squad.ts` は**一切変更していない**。

---

## 13. Node 停止 PID とコマンド / 起動 PID と親子関係 / server.pid / dev-err.log

| 局面 | 操作 | PID / コマンド |
|---|---|---|
| 開始時の `next dev` | 停止前検証 | 親 13996（cmdline に `C:\Development\eFootball-Team-AI`）/ リスナー 28108（13996 の子）/ server.pid=13996 一致 |
| dev 停止 | `Stop-Process -Id 28108 -Force` → `Stop-Process -Id 13996 -Force` | 両 PID 消滅・ポート 3000 LISTEN 無し（FREE）を確認 |
| build 前 | `./data/server.pid` → `0`（ASCII・改行なし） | |
| build | `npm run build` | PASS |
| start | `npm run start -- -p 3000` | npm ラッパー 28348 / `next start` リスナー 26492（cmdline に `C:\Development\eFootball-Team-AI`） |
| 全13ブラックボックス・SQLite | `next start` 上で実行 | 705/705 PASS / integrity ok |
| start 停止 | `Stop-Process -Id 26492 -Force` | ポート 3000 LISTEN 無し（FREE）を確認 |
| dev 再起動 | `npm run dev` | npm ラッパー 19964 / **`next dev` 親 31480** / **リスナー 24984（31480 の子）** |
| server.pid | `31480` を書き込み（ASCII・改行なし）・`od -c` で確認 | |
| dev ページ再確認 | `/` `/my-builds` `/build-inventory` `/my-team` `/squads` `/players/world/89138556575063` `/api/managers` | すべて 200 |
| `./data/dev-err.log` | 0 行（クリーン） | |

同一 PC の別プロジェクトの Node プロセスには一切触れていない（今回は検出されず。停止対象は
コマンドラインに `C:\Development\eFootball-Team-AI` を含む PID のみに限定する方針を継続）。

### 現在のサーバー状態（引き継ぎ）
- `next dev` 稼働中: 親 PID **31480** / ポート 3000 リスナー PID **24984**（31480 の子孫）
- `./data/server.pid` = `31480`（ASCII・改行なし）
- `./data/dev-err.log` = 0 行
- `http://localhost:3000` の主要ページ・API = 200

---

## 14. 発生したバグと修正（この報告内で完結）

1. **`npm run audit:ja-labels` の誤検出**（`dynamic-name-en-child`）: 後方互換オプションの表示ラベルで
   `{def.nameEn}` と書いたところ、汎用の受け手名 `def` が既存の検出リストに含まれていたため誤検出された
   （ブースター名は固有名詞として英語表示可能な対象であり、実際には問題ない表示内容）。
   プレーンな JS 変数 `excludedSelectionLabel` へ値を切り出し、JSX 側では `.nameEn` を直接参照しない形へ変更して解消。
   表示される文言・機能は変更なし。

ゲート本体（verify / build / 全13ブラックボックス / SQLite）の FAIL は 0。

---

## 15. 未解決問題

1. **B2 の完全正式化（実験モードの必須解除・標準値への反映）は未実施。** 理由は §9 のとおり、
   `calculatePlayerBooster` の構造上の制約（B2 は常に試算専用）と、計算エンジン変更が今回の重大停止条件に
   該当するため。将来この機能を正式化する場合は、次のいずれかの設計判断が必要（本milestoneでは判断しない）:
   - (a) B2 を「試算専用の便利機能」として維持し、UI 上のゲート（実験モードの同意）だけを簡略化する
     （計算結果は変えない）。
   - (b) B2 を真に標準値へ反映させる場合、「未付属ブースターを手動で追加する」という操作の意味づけ
     （ゲーム内に対応する概念があるか）を再定義し、`calculateBuild` の仕様変更として別マイルストーンで扱う。
2. **B1 の発動方式（青/金の判別）は解決済み fixed 83 ID すべて未確定のまま**（`docs/phase-booster-activation-types.md`
   §21 から持ち越し・今回の範囲外）。
3. **対応表に無い 48 の World ID の名称解決** も持ち越し（同上）。

---

## 16. 人間の目視確認項目（推奨）

- 実ブラウザーで選手詳細の育成タブを開き、「計算根拠とデータの出所を見る」を展開して
  「B1」バッジ付きの「カード付属ブースター（カードに収録・自動）」と「B2」バッジ付きの
  「実験的なブースター試算（手動）」が視覚的に区別できることを確認する。
- 付属ブースター行の「根拠を見る（解決段階・発動方式・情報源）」をクリックして詳細が展開されること、
  閉じた状態でも Badge・対象能力・適用中/未適用の表示が読めることを確認する。
- 実験モードを有効化し、B2 の `<select>` に Total Package が**表示されない**こと、
  「効果の証拠あり」「効果検証中」の 2 グループに 43 件（44 − total-package）が分かれて表示されることを確認する。
- サイドメニューの「マイデータ」グループに「ビルド分析」が表示され、クリックすると `/build-inventory`
  （URL 変化なし）で「保存ビルド分析」という見出しのページが開くことを確認する。
- 375〜1920px の各幅で育成タブ・ビルド分析ページが横スクロールなく操作できることを確認する。

---

## 17. 次に推奨する単独マイルストーン（候補・今回は着手しない）

- B1 の発動方式（青/金）判別のための追加証拠収集（ユーザーからのスクリーンショット提供）。
- B2 を「試算専用の便利機能」として、実験モードの同意ステップを簡略化する UI 改善
  （計算結果・保存形式は変えない前提での再検討）。
- 対応表に無い 48 の World ID の名称解決。
