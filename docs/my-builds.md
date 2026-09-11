# My Builds 画面（保存ビルドの一元管理）

実施日: 2026-09-01 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / 新しい localStorage キー: なし

## 目的

選手詳細・選手比較・比較コックピットの「この育成を保存」・My Team・スカッド編集で作成できる
保存ビルド（`build-storage` / `SavedBuild`）を、**一覧・検索・絞り込み・並び替え・名前変更・複製・
安全な 1 件削除・使用状況確認**できる専用画面 `/my-builds` を追加する。

**新しい保存形式・別ストレージは作らない。** 既存 `build-storage`（localStorage キー
`efootball-team-ai:progression-builds:v1`）を単一の真実源として再利用する。
育成計算・ブースター計算・比較計算・スカッド計算・URL 形式・保存スキーマは変更しない。

## ルート / ナビゲーション

- `/my-builds`（`export const dynamic = "force-static"`・SSR は空状態シェル）。
- サイドメニュー「マイデータ」グループに `My Builds`（icon `sliders`・`status: "ready"`）を追加。
  お気に入り / My Team の隣。
- 検索状態を URL クエリへ保存する仕組みは今回入れていない（URL 状態は増やさない）。
  worldCardId / buildId は文字列として扱い、Number 変換しない。

## build-storage への最小追加（2 関数のみ）

| 関数 | 用途 |
|---|---|
| `listAllBuilds(): SavedBuild[]` | 全カードのビルドを平坦化（updatedAt 降順 → buildId 安定）。My Builds 一覧の入力 |
| `duplicateBuild(worldCardId, buildId, name?): SaveResult` | 同一カードへ複製。新 buildId・createdAt/updatedAt = now・配分/rulesVersion/PoM 指定/選手ブースター試算は複製元と同じ・複製元は不変 |

`renameBuild` / `deleteBuild` は既存のものをそのまま使う（buildId・worldCardId・createdAt・
progressionAllocation・rulesVersion・conditionalBoosterSelections は rename で保持される）。

## 純ロジック `src/lib/progression/my-builds.ts`

UI へロジックを埋め込まず、検索・整合性・表示計算を純関数へ分離（テスト対象）:

- `buildAllocationRows(allocation)` — 10 カテゴリを `PROGRESSION_GROUPS` 順で（level 0 も含む）。`groupLabelJa` で日本語表示。
- `buildPointSummary(build, maximumLevel)` — rulesVersion のルールセット（`getRuleset`）で使用ポイント。
  `maximumLevel` が分からなければ合計・残りは **null**（0 で代用しない）。旧規則は無条件変換しない。
- `resolveBuildRuleStatus(rulesVersion)` — 現行規則 / 旧規則 / 規則不明（`isV2RulesVersion` / `isLegacyRulesVersion`）。
- `describeBuildPoM(build)` — `conditionalBoosterSelections` の段階を `+1 / +2 / +3`。none / 未指定は `has:false`。
  最大値を自動表示しない・標準へ自動適用しない・fixed booster と混同しない。
- `buildHasExperimental(build)` — `selectedPlayerBooster` が数値なら true（保存ビルド仕様に存在する項目のみ）。
- `formatBuildTimestamp` / `buildTimeValue` — 不正な日時は「—」/ null（現在時刻で代用しない）。
- `validateBuildRename(raw)` — trim・制御文字除去・改行拒否・1〜60 文字。
- `nextDuplicateBuildName(name, taken)` — 「{元名} のコピー」/「… のコピー 2」…（名前は主キーにしない）。
- `normalizeBuildSearchQuery` / `matchesBuildSearch` — trim・小文字化・空白圧縮・制御文字除去。
  正規表現として評価しない・HTML として解釈しない。ビルド名 / 日本語選手名 / 英語選手名 / World ID / buildId を部分一致。
- `filterBuilds` — カードタイプ / 登録ポジション / 現行・旧規則 / Power of Many 指定 / 実験的試算 / 使用中・未使用（複数条件 AND）。
- `sortBuilds` — 更新日時 / 作成日時 / ビルド名 / 選手名。同キーは buildId で安定化。不正日時は末尾。元配列を変更しない。
- `buildFacets` — 今あるビルドとカードから既知のカードタイプ・ポジションだけ生成。
- `buildUsageSummary` / `collectUsedBuildIds` — 既存ヘルパー（My Team レコード + `findSquadUsageByWorldCardId` の結果）を渡すだけ。新しい索引ストレージは作らない。同じスカッドは重複表示しない。

## カード情報の取得

- 保存ビルドの `worldCardId` を **Set で重複除去** → 既存 `useResolvedCards`
  （`/api/world/players/by-ids` を 1 回）で必要なカードだけ取得。**全 13,009 カードは走査しない。外部アクセス 0。**
- 取得失敗しても保存ビルドを一覧から消さない・削除しない・保存済み worldCardId を変更しない。
  取得できないカードは「カード情報を取得できませんでした」＋ World ID / ビルド名 / 配分 / rulesVersion / 操作を表示。
- 画像は既存 `resolveCardImageSources` + `WorldCardImage`（同一オリジンのプロキシ・`loading="lazy"`・
  失敗時はローカル SVG プレースホルダー）。新規画像取得・保存はしない。

## 管理操作

### 名前変更（`renameBuild`）
buildName と updatedAt のみ変更。buildId / worldCardId / createdAt / progressionAllocation /
rulesVersion / Power of Many 指定 / calculatedStats は保持。失敗時は元の名前を維持し成功表示しない（`role="alert"`）。

### 複製（`duplicateBuild`）
新しい buildId、createdAt/updatedAt = 現在時刻、worldCardId・配分・rulesVersion・PoM 指定・
選手ブースター試算は複製元と同じ。複製元は不変。既定名は `nextDuplicateBuildName`。別カードへは複製しない。

### 削除（`deleteBuild`・1 回 1 件のみ）
確認ダイアログを必ず経由。ビルド名・選手名・World ID・buildId・**使用状況（影響する My Team / スカッド）**・
元に戻せないことを表示。

**採用した方針**: 既存設計は参照切れを安全に扱う
（My Team `selectedBuildId` / `favoriteBuildId` は `sanitizeBuildId` で ID を保持し、
`MyTeamView` が「ビルドが見つかりません（削除済み）」と表示。スカッド `savedBuildId` は
Zod `.catch(null)`）。したがって **使用中でも削除ボタンを無効化せず、影響を明示した上で確認可能**にする。
削除は保存ビルドのみを消し、**My Team レコード本体・スカッド本体・カード配置・お気に入り状態は変更しない**
（参照先を別ビルドへ自動フォールバックしない・null へ書き換えない）。

一括削除（複数選択 / 全削除 / 条件一致 / カード単位 / 自動削除 / 自動統合）は実装しない。

### My Team に登録（2026-09-01 追加・未登録カードの新規登録）

My Team 未登録カード（`resolveMyTeamBuildSelectionState` → `not-in-team`）のビルドカードに
「My Teamに登録」を追加。**無条件・自動では作らない。** 確認ダイアログでユーザーが
所有状態・使用状態・このビルドを選択中ビルドにするか・お気に入りビルドにするかを明示選択してから登録する。

- **登録 API**: 既存 `addToMyTeam`（`src/lib/user-cards/my-team-storage.ts`）のみ再利用。
  My Builds から `localStorage.setItem` を直接呼ばない・新しいキー / 保存形式を作らない。
  `addToMyTeam` は `worldCardId` / `ownershipStatus` / `usageStatus` / `selectedBuildId` / `note` / `tags` を
  受け取り、`teamCardId`（`newLocalRecordId("tc")`）・`addedAt` / `updatedAt`（now）を生成。
  同一 `worldCardId` の重複を自身で拒否（`{ ok:false, existing }`）。
- **`favoriteBuildId` の 2 段階（approach B）**: `addToMyTeam` は `favoriteBuildId` を受け取れない（常に `null`）。
  お気に入りビルド設定 ON のときのみ、登録成功後に `updateMyTeamRecord(record.teamCardId, { favoriteBuildId })` を追加で呼ぶ。
  **2 段階目が失敗しても登録レコードは有効**（`favoriteBuildId: null` の正しいレコード）。ロールバックしない・
  他データを巻き戻さない。通知で「登録は成功、お気に入りビルドの設定だけ失敗（My Builds から設定し直せる）」と明示。
  選択中ビルドは `addToMyTeam` の引数で 1 段階で入るため 2 段階目は不要。
- **既定値**（`resolveSafeOwnershipDefault` / `resolveSafeUsageDefault`・ダイアログの初期表示のみ・固定しない）:
  - `ownershipStatus = "owned"`（所有済み）— 既存 `addToMyTeam` / `MyTeamAddDialog` の既定と統一。
    My Team は「実際に保有しているカード」の管理用（`types.ts` の定義）で、保存ビルドを作った時点で所持している蓋然性が高い。
    ユーザーは 欲しい / 手放した / 未設定 を選び直せる。所有状態を自動で「所有済み」に**固定**はしない。
  - `usageStatus = "unknown"`（未設定）— 既存の既定と統一。中立で、カードを「使用中」と決めつけない。
    スカッド配置・比較の使用状況からは推測しない。
  - selectedBuildId に設定: **ON**（推奨初期値）。favoriteBuildId に設定: **OFF**（推奨初期値）。両者は完全に独立。
- **確認ダイアログ**（`RegisterToMyTeamDialog`・`Modal`）: (1) カード画像・日本語名・英語名・カードタイプ・登録ポジション・World ID、
  (2) 保存ビルド情報（ビルド名・buildId・rulesVersion + 現行/旧規則・配分概要・使用ポイント・Power of Many 指定・実験的試算・
  保存時の推定OVR・**ポジション別 OVR は「—（計算規則を確認中）」**）、(3) 所有状態 `Select`、(4) 使用状態 `Select`、
  (5) 選択中ビルドに設定チェック、(6) お気に入りビルドに設定チェック（独立と明記）、
  (7) 作成される My Team レコードのプレビュー（所有状態 / 使用状態 / 選択中ビルド / お気に入りビルド / タグ:なし / メモ:なし /
  スカッド:変更なし / カードのお気に入り:変更なし）、(8) 変更されない項目、「このカードを My Team へ登録します。」。
- **更新直前の再検証**（`validateMyTeamRegistration`・`handleRegisterToMyTeam` 内）: `getMyTeamByWorldId` / `getBuild` で**再取得**。
  `storageAvailable` / worldCardId 文字列＝数字1〜20桁（**Number 変換しない**）/ buildId 形式 / 保存ビルド存在（buildId・worldCardId 一致）/
  **同一 worldCardId 未登録**（重複なら `code: "duplicate"`）/ ownershipStatus・usageStatus が既存 enum。
  `duplicate` / `build-missing` はダイアログを閉じて再読込を案内（`staleMyTeam` 表示）・既存レコードを上書きしない・
  入力エラー（storage / ownership / usage）はダイアログ内 `role="alert"`。
- **成功**: `flash`（`aria-live="polite"`）「{選手名} を My Team へ登録しました。『{ビルド名}』を選択中ビルドに設定しました。…」。
  `useMyTeam`（`useSyncExternalStore`）がカード表示を未登録→登録済みへ即時切り替え。ページ全体を再読み込みしない。
- **失敗**: 成功表示しない・登録済み表示に切り替えない・不完全レコードを残さない（`addToMyTeam` は 1 トランザクション）・
  保存ビルド / 他 My Team レコード / スカッド / カードお気に入り / 比較状態 / URL を変更しない。
  エラー文にスタックトレース・localStorage 全内容・DB パス・`process.env` を出さない。
- **タグ・メモ**: 常に空で登録（`tags: []` / `note: ""`）。ビルド名・選手名・PoM・内部 ID を自動で入れない。
  登録後に My Team 画面で編集する設計を維持。
- **スカッド**: 自動追加・自動配置・`savedBuildId` 連動をしない。**カード自体のお気に入り（`favorites` ストレージ）**は変更しない。

### My Team で使用（2026-09-01 追加・`selectedBuildId` 連携）

各ビルドカードに「My Team で使用」を追加。対象の保存ビルドを、**同じ `worldCardId` の
`MyTeamRecord.selectedBuildId`** へ設定する。既存 `updateMyTeamRecord` API のみを使う
（My Builds から `localStorage.setItem` を直接呼ばない・新しいキー / 保存形式を作らない）。

- **ボタン表示**（`resolveMyTeamBuildSelectionState`）:
  - `not-in-team`（同一 worldCardId の My Team レコード無し）→ 「My Team未登録」（`aria-disabled`）＋「My Team を開く」導線。
    **My Builds から My Team へ新規登録はしない**（次マイルストーン候補）。
  - `selected`（この buildId が selectedBuildId）→ 「My Team で選択中」（チェックアイコン・色だけに依存しない）＋「選択を解除」。
  - `assignable` → 「My Team で使用」（赤ではない）。
- **確認ダイアログ**（`Modal`）: カード画像・選手名・英語名・カードタイプ・登録ポジション・World ID・
  設定するビルド名/buildId・現在の選択中ビルド名/buildId（見つからなければ「現在の選択中ビルドは見つかりません」・
  元の `selectedBuildId` は消さない）・**変更される項目（selectedBuildId と updatedAt のみ）**・
  **変更されない項目**（お気に入りビルド・所有状態・使用状態・タグ・メモ・登録日時・他レコード・保存ビルド本体・スカッド・お気に入り・比較状態）・
  「既存スカッドには自動適用されません」。
- **更新直前の再検証**（`validateMyTeamBuildAssignment`・`handleAssignToMyTeam` 内）: 表示開始時の状態を信用せず、
  `getMyTeamByWorldId` / `getBuild` で**再取得**。worldCardId 文字列完全一致（Number 変換しない）・buildId 形式・
  レコード存在・ビルド存在・localStorage 使用可を確認。競合時は「別のタブでデータが変更されました。再読込してください。」。
- **既に選択中**なら再保存しない（`alreadySelected` → ダイアログの確認ボタン disabled・成功通知を繰り返さない・updatedAt を無駄に更新しない）。
- **成功**: `flash`（`aria-live="polite"`）「『{ビルド名}』を My Team の選択中ビルドに設定しました」。`useMyTeam`
  （`useSyncExternalStore`）が更新を受けて使用状況表示を即時再計算。**保存ビルド一覧・配分・カード情報・他レコード・スカッド・お気に入りは変更しない**。
- **失敗**: `role="alert"`。元の `selectedBuildId` / `favoriteBuildId` / レコード全体 / 保存ビルド / スカッド / お気に入り / 比較状態を維持。
  エラー文にスタックトレース・localStorage 全内容・DB パス・`process.env` を出さない。
- **選択を解除**: 既存仕様に**あり**（`MyTeamView` の `<option value="">なし</option>` が `updateMyTeamRecord(teamCardId, { selectedBuildId: null })` を呼ぶ）。
  よって My Builds でも `selectedBuildId` を `null` へ戻す「選択を解除」を実装。favoriteBuildId・所有/使用状態・タグ・メモ・登録日時は維持。確認ダイアログあり。
- **スカッド `savedBuildId` とは独立**。「My Team で使用」でスカッドへ自動適用・一括変更しない。
- **URL・比較状態・選手詳細の一時育成状態は変更しない**（My Builds は `selectedBuildId` のみ更新）。

### お気に入りビルドに設定 / 解除（2026-09-01 追加・`favoriteBuildId` 連携）

各ビルドカードの「My Team 連携」領域に、**選択中ビルドとは別の行**で「お気に入りビルドに設定」/
「お気に入りを解除」を追加。対象の保存ビルドを、**同じ `worldCardId` の
`MyTeamRecord.favoriteBuildId`** へ設定・解除する。**`selectedBuildId` は変更しない。**
既存 `updateMyTeamRecord({ favoriteBuildId })` のみを使う（新キー / 保存形式なし）。

- **状態**（`resolveMyTeamBuildSelectionState` に `isSelected` / `currentFavoriteBuildId` を追加）:
  `not-in-team` → 「My Team未登録」（連携行を出さない）。
  登録済みは 2 行 —「選択中ビルド:」行（既存）と「お気に入りビルド:」行。
  お気に入り一致 → 「My Team のお気に入りビルド」（星アイコン・黄系・色以外にも文字/アイコン）＋「お気に入りを解除」。
  それ以外 → 「お気に入りビルドに設定」（赤ではない）。
- **確認ダイアログ**（`SetFavoriteBuildDialog`・`Modal`）: カード画像・選手名・英語名・カードタイプ・登録ポジション・World ID・
  設定するビルド名/buildId・**現在のお気に入りビルド名/buildId**（見つからなければ「現在のお気に入りビルドは見つかりません」・元の `favoriteBuildId` は消さない）・
  **現在の選択中ビルド（変更しません）** の併記・**変更される項目（favoriteBuildId と updatedAt のみ）**・
  **変更されない項目**（選択中ビルド（selectedBuildId）・所有状態・使用状態・タグ・メモ・登録日時・他レコード・保存ビルド本体・スカッド・カード自体のお気に入り・比較状態）・
  「選択中ビルドと既存スカッドには自動適用されません」。
- **更新直前の再検証**: 設定は `validateMyTeamFavoriteBuildAssignment`（`validateMyTeamBuildAssignment` と同じ共通検証）、
  解除は `validateMyTeamFavoriteBuildClear`（共通検証＋`record.favoriteBuildId === build.buildId` を追加確認）。
  `getMyTeamByWorldId` / `getBuild` で**再取得**してから検証。競合時は「お気に入りビルドの状態が変更されています。再読込してください。」。
- **既にお気に入り**なら再保存しない（`alreadyFavorite` → 確認ボタン disabled・成功通知を繰り返さない）。
- **成功**: `flash`（`aria-live="polite"`）「『{ビルド名}』を My Team のお気に入りビルドに設定しました。**選択中ビルドは変更していません。**」。
- **失敗**: `role="alert"`。元の `favoriteBuildId` / `selectedBuildId` / レコード全体 / 保存ビルド / スカッド / カードお気に入り / 比較状態を維持。
- **selectedBuildId と favoriteBuildId が同じビルドの場合**: 「My Team で選択中」と「My Team のお気に入りビルド」の両方を別行で表示。
  「お気に入りを解除」→ `favoriteBuildId` だけ null（「My Team で選択中」は残る）。「選択を解除」→ `selectedBuildId` だけ null（「My Team のお気に入りビルド」は残る）。両方まとめて解除する操作は追加しない。
- **カード自体のお気に入り（`favorites` ストレージ）は変更しない**。UI に「これは保存ビルドのお気に入り設定です。カード自体のお気に入り状態・既存スカッドは変更されません。」を明記。
- **スカッド `savedBuildId`・URL・比較状態・選手詳細の一時状態は変更しない**。

## My Team「保存ビルドを選ぶ」パネル（2026-09-01 追加・My Team 画面側）

My Team 画面（`MyTeamView` / `MyTeamBuildPanel`）で、対象カードの保存ビルドを**内容まで確認しながら**
選択中ビルド（`selectedBuildId`）とお気に入りビルド（`favoriteBuildId`）を設定・解除する。
新しい保存形式・localStorage キーは作らない。既存 `updateMyTeamRecord` のみ使用。

- **既存 `<select>` は削除しない**。各 My Team カード下のストリップに「かんたん選択」`<select>`（`selectedBuildId` のみ・既存挙動）を残し、
  横に「**保存ビルドを選ぶ**」ボタンを追加。ストリップに `選択中: X · お気に入り: Y · 保存 N 件` を常時表示
  （削除済み参照は「見つかりません（削除済み）」）。カードは過密にしない（詳細はパネル内）。
- **パネル本体**（`Modal size="lg"`）: 対象カード（画像・日本語名・英語名・カードタイプ・登録ポジション・World ID）／
  現在の設定（選択中ビルド名+buildId／お気に入りビルド名+buildId／所有状態／使用状態／各行に解除ボタン）／
  保存ビルド検索（ビルド名・buildId・部分一致・`normalizeBuildSearchQuery`+`matchesBuildSearch` 再利用・正規表現評価しない）／
  保存ビルド一覧（各行: ビルド名・`現行規則`/`旧規則` バッジ・`選択中`/`お気に入り` バッジ・buildId・rulesVersion・
  配分概要＋全10カテゴリ折りたたみ（`buildAllocationRows`・`groupLabelJa`）・使用/合計/残りポイント（`buildPointSummary`・`card.maximumLevel`・不明は「—」）・
  Power of Many（`describeBuildPoM`）・実験的試算（`buildHasExperimental`）・**保存時の推定OVR**（`calculatedOvr`+`calculationMode`）・
  **総合値（ポジション別 OVR）: —（計算規則を確認中）**・作成/更新日時（`formatBuildTimestamp`・不正日時は「—」））／
  My Builds で管理・育成でビルドを作成・閉じる。
- **並び順**（`sortMyTeamBuildPanel`・純関数・非破壊）: (1) 現在の選択中ビルド → (2) 現在のお気に入りビルド（選択中と同一なら 1 件のみ・両バッジ）→ (3) 更新日時降順 → (4) buildId 安定。不正日時は末尾。
- **設定**: `assign(build, "selectedBuildId" | "favoriteBuildId")` → `getMyTeamRecord(teamCardId)` / `getBuild(worldCardId, buildId)` で**再取得** →
  `validateMyTeamBuildAssignment` / `validateMyTeamFavoriteBuildAssignment`（既存・共通 `validateMyTeamRecordAndBuild` 再利用。worldCardId 文字列完全一致・Number 変換しない・buildId 形式・レコード/ビルド存在・localStorage 可）→
  既に同値なら再保存しない（`updatedAt` を無駄に更新しない）→ `updateMyTeamRecord(tc, { selectedBuildId })` または `{ favoriteBuildId }` のみ。
- **解除**: 行内 or 現在設定セクションから → **パネル内インライン確認**（`role="alertdialog"`・ネストした Modal を避ける採用方針）→
  `validateMyTeamBuildRefClear`（新規純関数・**保存ビルドの存在を要求しない**＝削除済み参照の明示解除に使える。`storageAvailable` / record 再取得 / teamCardId 一致 / 現在値が画面認識と一致（競合検出・上書きしない）/ 既に null なら失敗）→ `updateMyTeamRecord(tc, { selectedBuildId: null })` または `{ favoriteBuildId: null }`。
- **selectedBuildId と favoriteBuildId は完全独立**（`resolveMyTeamBuildRefs` で個別解決）。選択中設定でお気に入り不変・お気に入り設定で選択中不変・
  片方解除でもう片方維持（同じ buildId でも独立）。両方まとめて設定/解除する操作は追加しない・自動同期しない・自動フォールバックしない。
- **削除済み参照**（`resolveMyTeamBuildRefs().selected.missing` / `.favorite.missing`）: 「選択中ビルドが見つかりません（削除済み・buildId …）」と表示し、
  元 buildId は消さない。別ビルドへ自動フォールバック・先頭ビルドへ自動変更・勝手に null 化はしない。**明示的な解除操作だけ**提供。
- **保存ビルド 0 件**: パネルに「保存ビルドがありません」＋「選手詳細または選手比較で育成を調整し、『この育成を保存』から追加できます。」＋
  このカードの選手詳細 / 育成タブ / 選手比較 / My Builds への導線。My Team レコードは保持。削除済み参照があれば別枠で表示＋解除可能。
- **storage イベント**: `MY_TEAM_STORAGE_KEY` / `BUILD_STORAGE_KEY` / `key == null` のみ監視 → 「別のタブでデータが変更されました」＋手動「再読込」（`aria-live="polite"`）。
  パネルを勝手に閉じない・検索入力を消さない・操作対象を差し替えない。リスナーはアンマウント時解除・毎描画登録しない。同一タブ更新は `updateMyTeamRecord` の `notifyUserCards` → `useMyTeam` で即時反映（＋パネルは操作後に `reload()`）。
- **競合方針**（採用）: 更新確定直前に `getMyTeamRecord` / `getBuild` で再取得し検証。record 消失・buildId 不一致・worldCardId 不一致・現在値の別タブ変更 → `role="alert"` で「再読込してください」＋自動 `reload()`（上書きしない）。ビルド名だけ変更（buildId・worldCardId 一致）は `reload()` で最新名を表示（一覧は名前で解決）。
- **保護**: `ownershipStatus` / `usageStatus` / `tags` / `note` / `addedAt` / `worldCardId` / `teamCardId` / 他 My Team レコード / 保存ビルド本体 / 保存スカッド（`savedBuildId`）/ **カード自体のお気に入り（`favorites`）** / 比較状態 / URL は不変。`MyTeamRecord` / `SavedBuild` / `StoredSquad` スキーマ・`storageVersion` 不変。
- **My Team 側の追加操作は selectedBuildId / favoriteBuildId の設定・解除のみ**。名前変更・複製・削除・新規登録・配分編集は My Builds / 選手詳細で（パネルから導線）。

## スカッド編集画面のビルド選択パネル（2026-09-01 追加）

スカッド編集（`SquadEditor` / `SlotPlayerPanel` / `SquadBench` / `SquadBuildPanel` / `SquadBuildUsagePanel`）で、
各枠（先発 slot / ベンチ sub）の **`savedBuildId`**（＝スカッド用ビルド）を保存ビルドの内容を確認しながら
設定・解除する。**My Team の `selectedBuildId` / `favoriteBuildId` とは完全に別系統**。新しい保存形式・
localStorage キーは作らない。`StoredSquad` / `StoredSlot` / `StoredSub` スキーマ変更なし。

### マイルストーン1: 「保存ビルドを選ぶ」パネル（`SquadBuildPanel`）

- **既存 select は削除しない**。`SlotPlayerPanel` の「保存ビルドを適用...」select（先発・既存）はそのまま残し、
  横に「スカッド用ビルド: {名前/未設定/削除済み}」＋「保存ビルドを選ぶ」ボタンを追加。ベンチ（`SquadBench`）にも
  各行へ同じ表示＋ボタンを追加（ベンチにはもともと savedBuildId UI が無かったため新規のみ）。
- **対象枠の特定**: 先発は `slotId`、ベンチは `subId`（どちらも安定 ID・配列 index に依存しない）。パネルを開いた
  時点の `worldCardId` を `BuildPanelTarget` に保持し、別タブでカードが入れ替わっていたら card-mismatch で拒否。
- **パネル本体**（`Modal size="lg"`）: 対象（スカッド名 + squadId / 先発・ベンチ / 枠ラベル）／対象カード（画像・
  日本語名・英語名・カードタイプ・登録ポジション・World ID）／現在のスカッド用ビルド（名前 + buildId or「削除済み」）
  ＋その場で解除／保存ビルド一覧（各行: ビルド名・`現行規則`/`旧規則` バッジ・`この枠で使用中` バッジ・buildId・
  rulesVersion・配分概要＋全10カテゴリ折りたたみ・使用/合計/残りポイント（`buildPointSummary`・`card.maximumLevel`）・
  Power of Many・実験的試算・**保存時の推定OVR**・**総合値（ポジション別 OVR）: —（計算規則を確認中）**・作成/更新日時）。
- **並び順**: `sortMyTeamBuildPanel(builds, { selectedBuildId: currentSavedBuildId, favoriteBuildId: null })` を再利用
  → 現在の savedBuildId → 更新日時降順 → buildId 安定。検索は `normalizeBuildSearchQuery` + `matchesBuildSearch`（ビルド名・buildId）。
- **設定 / 解除**: パネルは `validateSquadBuildAssignment`（純関数・storageAvailable / slotExists / slotWorldCardId 一致
  （**Number 変換しない**）/ 設定時は `getBuild` 再取得で存在・worldCardId 一致 / `changed` 判定）で直前検証 →
  `onSet(buildId)` / `onClear()` → `SquadEditor.applySquadBuild` が `squadRef.current` で再検証し **対象枠 1 件のみ** `patch`
  （`slots.map` / `substitutes.map` で該当 slotId/subId だけ `savedBuildId` 変更）。既存の自動保存（`saveSquad`・500ms デバウンス）が永続化。
  他の枠・座標・配置・ロール・キャプテン・セットプレー・監督・スカッド名・テンプレート・他スカッド・**My Team・
  カード自体のお気に入り**・比較状態・URL は変更しない。既に同値なら再保存しない（`updatedAt` を無駄に更新しない）。
- **確認**: 設定・解除とも **パネル内インライン `role="alertdialog"`**（ネストした Modal を避ける）で、
  現在 → 変更後・配分/rulesVersion/PoM・変更される項目（この枠の savedBuildId と更新日時のみ）・変更されない項目を提示。
- **削除済み参照**: `resolveBuildRef(savedBuildId, builds).missing` → 「見つかりません（削除済み・buildId …）」。
  別ビルドへ自動フォールバック・先頭ビルドへ自動設定・My Team ビルド流用・favoriteBuildId 流用・勝手な null 化は
  **しない**。明示的な「スカッドでの選択を解除」のみ（`validateSquadBuildAssignment` は解除時 `storedBuild` を要求しない）。
- **保存ビルド 0 件**: パネルに空状態＋選手詳細 / 育成タブ / My Builds への導線。枠・カードは維持。
- **storage イベント**: パネルが `SQUAD_STORAGE_KEY` / `BUILD_STORAGE_KEY` / `key == null` を監視 → 「別のタブで…更新されました」
  ＋手動「再読込」（保存ビルド一覧を `listBuilds` で読み直し ＋ `onRequestReload` → `SquadEditor` が `getSquad` で最新へ）。
  パネルを勝手に閉じない・検索入力を消さない。リスナーはアンマウント時解除。
- **競合方針（採用）**: 更新確定直前に編集 state（`squadRef.current`）と `getBuild` で再取得し検証。枠消失 → slot-missing、
  カード入れ替え → card-mismatch、ビルド削除 → build-missing。いずれも `role="alert"` で「再読込してください」＋上書きしない。

### マイルストーン2: ビルド使用状況サマリー（`SquadBuildUsagePanel`・表示専用）

- スカッド編集の右カラム（サマリー）に配置。コンパクト表示「設定済み X / 未設定 Y / 削除済み参照 Z ・ 先発/ベンチ内訳」
  ＋「詳細を見る」→ `Modal` で件数サマリー（総登録 / 先発 / ベンチ / 設定済み / 未設定 / 削除済み参照 / 現行規則 / 旧規則 /
  規則不明 / Power of Many 指定あり / 実験的試算あり）＋フィルター（全員 / 設定済み / 未設定 / 削除済み参照 / 先発 / ベンチ）
  ＋検索（選手名・ビルド名・非破壊・正規表現評価なし）＋一覧（選手名・先発/ベンチ・枠ラベル・World ID・
  スカッド用ビルド名 or 未設定 or 削除済み・規則ラベル・PoM/実験注記）＋各行「保存ビルドを選ぶ」→ M1 パネルへ。
- **集計は純関数 `summarizeSquadBuilds(rows, buildsByCard)`**（現在の 1 スカッドのみ）: 「設定済み」= savedBuildId あり
  かつ同じ worldCardId の保存ビルド実在。「削除済み参照」= savedBuildId ありだが実在しない or worldCardId 不一致
  （**未設定へ自動変換しない**・別枠）。規則は実在ビルドの `resolveBuildRuleStatus`、PoM は `describeBuildPoM().has`
  （未指定を最大値扱いしない）、実験は `buildHasExperimental`。判定不能な規則は `unknownRulesCount` で別枠明示（件数をごまかさない）。
- **一括適用・一括解除・自動補完・自動修復は実装しない。** 表示しただけでは保存しない（`updatedAt` 不変）。
  M1 の `SquadBuildPanel` を再利用（別のビルド編集 UI を作らない）。

## 保存ビルド分析 `/build-inventory`（2026-09-01 追加・読み取り専用・2026-09-05 に名称変更）

> **名称変更（2026-09-05）**: ナビゲーション「ビルド棚卸し」→「ビルド分析」、ページタイトル
> 「保存ビルド棚卸し」→「保存ビルド分析」。**URL `/build-inventory` は変更していない**。内部の型名・
> ファイル名・関数名（`build-inventory.ts` / `BuildInventoryView` 等）はユーザー表示に出ないため変更していない。

保存ビルド（`build-storage`）が **My Team**（`selectedBuildId` / `favoriteBuildId`）と **スカッド**
（先発 slot / ベンチ sub の `savedBuildId`）のどこで使われているか、どのビルドが未使用か、どの参照が
削除済み・worldCardId 不一致・不正 buildId・不明かを一画面で確認する。**表示専用** — 保存ビルド・My Team・
スカッド・カード自体のお気に入り・SQLite を一切変更しない。一括削除・一括解除・一括適用・一括変換・
自動修復・別ビルドへのフォールバックは実装しない。安全な既存画面（My Builds / My Team / 対象スカッド /
選手詳細）への個別導線のみ。

- **ルート**: `/build-inventory`（`force-static`・SSR は空状態シェル・**URL 不変**）。ナビは Sidebar
  「マイデータ」グループの My Builds の下に「ビルド分析」（icon `database`・`status: "ready"`）。
  H1 は 1 つ「保存ビルド分析」。新しい localStorage キーなし。
- **データ源**: 既存 `listAllBuilds()` / `useMyTeam()`（`getMyTeam`）/ `listSquads()` ＋ `useResolvedCards`
  （`/api/world/players/by-ids` を 1 回・全 13,009 カード走査なし・外部アクセス 0）。分析結果は保存しない。
- **純ロジック `src/lib/progression/build-inventory.ts`**（テスト 28 件）:
  - `collectBuildReferences(myTeam, squads)` — null でない `selectedBuildId` / `favoriteBuildId` / slot・sub の
    `savedBuildId` を、参照元（`my-team-selected` / `my-team-favorite` / `squad-starter` / `squad-bench`・
    teamCardId / squadId / slotId / subId / slotLabel）付きで収集。worldCardId なし・savedBuildId なしの枠は無視。
  - `classifyBuildReference(raw, buildsById)` — `ok`（buildId 有効・保存ビルド存在・worldCardId 一致）/
    `missing`（保存ビルドなし）/ `world-card-mismatch`（保存ビルドはあるが worldCardId が参照元と不一致）/
    `invalid-build-id`（`/^[A-Za-z0-9_-]{1,64}$/` 違反）/ `unknown`（参照元 worldCardId が数字1〜20桁でない）。
    **不明を未設定や削除済みへ勝手に分類しない。worldCardId / buildId は文字列（Number 変換しない）。**
  - `buildInventory(builds, myTeam, squads, cards)` → `{ items, issues, summary, cardTypes, positions }`。
    - **使用中** = 正常参照 1 件以上。**未使用** = 正常参照 0 件。削除済み・worldCardId 不一致参照は使用回数に含めない。
    - `item`: `refCount`（各参照 1 件）/ `myTeamSelectedCount` / `myTeamFavoriteCount` / `squadRefCount`（枠単位）/
      `squads`（squadId 単位で重複除去・`starterSlots` / `benchSlots` 枠数）/ `multiUse`（2 件以上）/
      `mismatchRefCount`（この保存ビルドを worldCardId 不一致で指す件数）/ `ruleKind`（current/legacy/unknown）/ `pom` / `experimental`。
    - `summary`: **単位を明示**（「ビルド」= 保存ビルド単位・「件」= 参照件数・「枠」= スカッド枠数）。
      totalBuilds / usedBuilds / unusedBuilds / multiUseBuilds / currentRulesBuilds / legacyRulesBuilds /
      unknownRulesBuilds / pomBuilds / experimentalBuilds（ビルド）、myTeamSelectedRefs / myTeamFavoriteRefs（件）、
      squadRefs（枠）、missingMyTeamRefs / missingSquadRefs / worldCardMismatchRefs / invalidBuildIdRefs / unknownRefs（件）。
    - `selectedBuildId == favoriteBuildId` が同じ buildId でも参照は別々に 2 件（種別を分けて表示）。
    - 同じビルドが同じスカッドの複数枠 → 総参照数は各枠を含め、スカッド名は 1 件・「先発 N 枠 / ベンチ M 枠」表示。
      同名スカッドでも squadId が異なれば別参照（squadId を表示）。
  - `filterBuildInventory(items, filter)` — 使用状況 / My Team selected / favorite / スカッド / 複数箇所 / 規則
    （current/legacy/unknown）/ PoM / 実験 / 問題参照あり / カードタイプ / 登録ポジション ＋ 検索（`normalizeBuildSearchQuery` 再利用・
    正規表現評価なし・複数トークン AND・ビルド名/選手名/World ID/buildId/スカッド名）。複数条件は AND。
  - `sortBuildInventory(items, key)` — 更新 / 作成 / 選手名 / ビルド名 / 参照数 / 問題優先 / 未使用優先。
    同値は buildId で安定・不正日時は末尾・非破壊。
  - `filterBuildInventoryIssues(issues, kind, query)` — 種類フィルター＋検索。
- **画面 `BuildInventoryView`**: `LocalStorageNotice` / ストレージ不可警告（3 種を分離）/ 別タブ更新通知
  （`BUILD_STORAGE_KEY` / `MY_TEAM_STORAGE_KEY` / `SQUAD_STORAGE_KEY` / `key==null` のみ監視・更新元を判別表示・
  手動「再読込」・検索/フィルター/並び替えを消さない・アンマウント時解除）/ カード解決エラーは別 `role="alert"`
  （分析対象は消さない）/ 全体サマリー（状態: 正常 or 注意（問題参照あり）を文字表示・色のみに依存しない）/
  問題参照一覧（種類バッジ・参照元・選手名・World ID・buildId・スカッド名/squadId/枠ラベル or teamCardId・
  説明・個別導線）/ 検索・絞り込み・並び替え / 保存ビルドカード（画像・日本語/英語名・カードタイプ・登録ポジション・
  World ID・ビルド名・buildId・rulesVersion・現行/旧/規則不明・配分（`buildAllocationRows`・active＋全10折りたたみ）・
  使用/合計/残りポイント（`buildPointSummary`・不明は「—」）・PoM（`describeBuildPoM`）・実験的試算・
  **保存時の推定OVR**・**総合値（ポジション別 OVR）: —（計算規則を確認中）**・作成/更新日時・使用状況内訳・個別導線）。
- **保護**: 計算エンジン・URL・`SavedBuild` / `MyTeamRecord` / `StoredSquad` / `StoredSlot` / `StoredSub` スキーマ・
  `storageVersion` ・SQLite は不変。既存 My Builds / My Team / スカッドの機能に変更なし（純関数追加のみ）。
- 変更: `src/lib/progression/build-inventory.ts`（新規）、`src/components/progression/BuildInventoryView.tsx`（新規）、
  `src/app/build-inventory/page.tsx`（新規）、`src/components/Sidebar.tsx`（ナビ 1 行）、
  `scripts/black-box-my-builds.mjs`（`/build-inventory` の SSR シェル検証を統合・新レールは作らない）。

### 旧規則ビルド確認ガイド（2026-09-01 追加・`/build-inventory` 内のセクション・読み取り専用）

旧 `rulesVersion` で保存されたビルドを**安全に発見し、影響範囲を確認し、ユーザーが個別に現在の育成画面で
確認し直す**ための表示専用ガイド。新ページは作らない（`/build-inventory` 内の `<details>` セクション）。
**「自動移行機能」ではない** — この画面から旧規則ビルドを自動変換・一括変換・上書き・削除・解除・付け替え
することはなく、既存の旧規則ビルドはそのまま残る。移行状態を localStorage に保存しない・新キーなし。

- **判定**: `ruleKind === "legacy"`（= `resolveBuildRuleStatus` / `isLegacyRulesVersion`）のみ。空 `rulesVersion` の
  「規則不明」は含めない。ビルド名・保存日時・文字の見た目で旧規則判定しない。`rulesVersion` を書き換えない。
- **ポイント表示**: `buildPointSummary`（保存された `rulesVersion` のルールセット）。現行ルールセットでの無条件
  再計算はしない。算出不能は「—」。
- **純ロジック追加**（`build-inventory.ts` 末尾・純関数・非破壊）:
  - `summarizeLegacyBuilds(items)` → `LegacyBuildSummary`: `total` / `used` / `unused` /（ビルド）
    `myTeamSelectedRefs` / `myTeamFavoriteRefs`（件）、`squadRefs`（枠）、`multiUse` / `pom` / `experimental` /
    `withProblemRef`（ビルド）。`items` を変更しない。
  - `legacyOnlyFilter()` → `{ ...DEFAULT_BUILD_INVENTORY_FILTER, rules: "legacy" }`（既存フィルターは破棄）。
- **画面 `LegacyBuildGuide`**（`BuildInventoryView` 内）: `<details open={旧規則>0}>`・見出し「旧規則ビルド確認
  ガイド（N ビルド）」。常時表示の説明（読み取り専用・自動移行機能ではない・既存ビルドは保持）＋
  旧規則あり時: 件数サマリー（単位ラベル付き）＋注意事項（自動変換なし・一括操作なし・旧ルールセット表示）＋
  「現行規則で確認し直す手順」6 ステップ（育成タブを開く → 配分確認 → **上書きせず新しいビルド名で保存** →
  My Team / スカッドで個別に選び直す → 不要判断は My Builds で個別に）＋「旧規則ビルドだけを表示」ボタン
  （`legacyOnlyFilter()`・`aria-pressed`）＋ My Builds / My Team / スカッドへの導線。旧規則なし時: 「旧規則
  ビルドはありません」＋**「移行済み」と断定しない**説明＋総数/現行規則/規則不明の内訳。
  各保存ビルドカードに「育成で開く」（`?tab=progression`）導線を追加（旧規則配分の安全な URL 復元手段がない
  ため、`?tab=progression` リンクのみ・配分は自動読込されないと明記）。
- **検証**: `build-inventory.test.ts` に `summarizeLegacyBuilds` / `legacyOnlyFilter` の 6 件（状態別件数・
  規則不明の分離・非破壊・フィルター）。`scripts/black-box-my-builds.mjs` に SSR 文言・安全性 10 件（見出し・
  自動移行機能ではない明示・空状態「旧規則ビルドはありません」・「移行済み」非表示・個別導線・新ページなし）。
- 変更: `src/lib/progression/build-inventory.ts`（純関数 2 個追記）、`src/components/progression/BuildInventoryView.tsx`
  （`LegacyBuildGuide` 追加・カードに「育成で開く」導線）、`src/lib/progression/build-inventory.test.ts`（+6）、
  `scripts/black-box-my-builds.mjs`（+10）。スキーマ・URL・計算エンジン・localStorage キーは不変。

### 保存ビルド重複候補（2026-09-05 追加・`/build-inventory` 内のセクション・読み取り専用）

JSON インポートや複製で増えた可能性がある保存ビルドの**重複候補**を安全に確認する。**自動統合・自動削除・
自動上書き・一括処理ではない。** 既存 `buildInventory()` の結果（使用状況・参照索引・カード情報）をそのまま
再利用し、新しい索引やスカッド再走査は行わない。

- **完全一致候補**: 同じ `worldCardId` 内で、`worldCardId` / `rulesVersion` / `progressionAllocation` /
  `selectedPlayerBooster` / `conditionalBoosterSelections` がすべて一致する保存ビルド。`buildId` / `buildName` /
  `createdAt` / `updatedAt` / `calculatedStats` / `calculatedOvr` / `calculationMode` / `schemaVersion` は
  同一性の判定に使わない（除外理由は milestone 報告を参照）。
- **決定的フィンガープリント** `computeBuildFingerprint(build)`（`src/lib/progression/build-duplicate-review.ts`）:
  正規化済みフィールドの JSON 文字列。`progressionAllocation` はキー昇順・0/不在は同義。
  `conditionalBoosterSelections` は `boosterKey` 昇順へ正規化（意味上は「キーごとの集合」のため順序に依存しない）。
  localStorage へは保存しない・暗号学的ハッシュは使わない（外部依存を増やさない）。
- **類似候補**（安全な 2 パターンのみ・初期版で実装済み）: 同じ `worldCardId`・同じ `rulesVersion` の中で、
  (1) 配分が 1 カテゴリだけ異なる、(2) `selectedPlayerBooster` / `conditionalBoosterSelections`（Power of Many）
  だけが異なる、のいずれか。複数カテゴリ差分・複合差分（配分もブースターも異なる）は「別ビルド」として候補にしない。
  類似はペア（2 件 1 組）で表現し、n 件を 1 グループへまとめない（一致範囲を厳密に保つため）。架空の類似度・
  百分率・AI 判定は使わない。
- **判定不能**: 規則不明（空 `rulesVersion`）または `savedBuildSchema` 検証失敗のビルド。同一性を安全に
  判定できないため比較対象から除外し、「重複候補なし」には含めない。自動修復・自動削除しない。
- **使用状況**: 既存 `BuildInventoryItem` の `myTeamSelectedCount` / `myTeamFavoriteCount` / `squadRefCount` /
  `squads` / `used` / `multiUse` をそのまま各ビルドへ引き継ぐ（問題参照・削除済み参照・worldCardId 不一致は
  既存ロジックにより正常使用へ含まれない）。同じ候補グループ内でも各 `buildId` の使用状況は個別に表示。
- **画面**: `src/components/progression/DuplicateReviewSection.tsx`（`/build-inventory` 内の `<details>`
  セクション・新しい H1 なし）＋ `src/components/progression/DuplicateReviewTeaser.tsx`（`/my-builds` 上部の
  案内・Build Inventory への導線のみ・再計算なし）。検索・絞り込み（種類/使用状況/My Team参照/スカッド参照/
  複数箇所/規則/PoM/実験的試算/カードタイプ/ポジション）・並び替え（更新日時/作成日時/グループ件数/参照数/
  未使用優先/使用中優先/選手名/ビルド名/buildId安定順）に対応。別タブ更新は既存 3 キー
  （`BUILD_STORAGE_KEY` / `MY_TEAM_STORAGE_KEY` / `SQUAD_STORAGE_KEY`）監視を共有（新規リスナーなし）。
- **保護**: この画面から保存ビルド・My Team・スカッド・カードお気に入りを一切変更しない（純粋な表示）。
- 変更: `src/lib/progression/build-duplicate-review.ts`（新規）、`src/components/progression/DuplicateReviewSection.tsx`
  （新規）、`src/components/progression/DuplicateReviewTeaser.tsx`（新規）、`BuildInventoryView.tsx`
  （セクション追加のみ）、`MyBuildsView.tsx`（案内追加のみ）、`build-duplicate-review.test.ts`（新規・40）、
  `scripts/black-box-my-builds.mjs`（+15）。スキーマ・localStorage キー・URL・計算エンジンは不変。

## 保存ビルドのローカル JSON エクスポート（2026-09-02 追加・エクスポートのみ）

保存ビルドをユーザー端末へ **ローカル JSON ファイル**として書き出すバックアップ機能。**エクスポートのみ**
（インポート・ファイルアップロード・復元・上書き・並び替え保存は実装しない）。ブラウザー内だけで処理し、
サーバー API・外部送信・アップロードはしない。エクスポートしても保存ビルド・My Team・スカッド・
カードお気に入り・SQLite・`updatedAt` を一切変更しない。新しい localStorage キー・保存スキーマ変更なし。

### エクスポート形式（`src/lib/progression/build-export.ts`）

| 項目 | 値 |
|---|---|
| `format` | 固定文字列 `"efootball-team-ai-saved-builds"`（`SAVED_BUILD_EXPORT_FORMAT`） |
| `formatVersion` | 固定 `"1"`（`SAVED_BUILD_EXPORT_FORMAT_VERSION`）。**エクスポートファイル形式**のバージョンで、`SavedBuild.rulesVersion` / `schemaVersion` とは別軸 |
| `app` | 固定文字列 `"eFootball Team AI"`（環境情報・パスは含めない） |
| `exportedAt` | `new Date().toISOString()`（**UTC** ISO 8601・保存の `createdAt`/`updatedAt` と同形式） |
| `itemCount` | `builds.length` と必ず一致 |
| `builds` | 検証済み `SavedBuild` の配列。並び順は決定的（`updatedAt` 降順 → `buildId` 昇順） |

- 出力する `SavedBuild` フィールドは既存 `savedBuildSchema`（`build-storage.ts` から `export` を追加）で
  検証したものだけ。`savedBuildSchema` は Zod `.strip()`（既定）のため未知キーは除去される
  → `selectedBuildId` / `favoriteBuildId` / `ownershipStatus` / `usageStatus` / `tags` / `note` /
  スカッド `savedBuildId` / SQLite などは構造的に出力されない。
- `conditionalBoosterSelections`（Power of Many 指定）は未指定ならキー自体を出さない（既存保存仕様と同じ）。
- `progressionAllocation` / `calculatedStats` のレコードキーはソートし、フィールド順も固定して
  `JSON.stringify(file, null, 2)` の出力を安定させる。UTF-8・BOM なし。JS/HTML/CSV/ZIP へは変換しない。
- 既定ファイル名 `efootball-team-ai-builds-YYYY-MM-DD-HHMMSS-mmmZ.json`（**UTC**・`exportedAt` と同時刻・
  ミリ秒付きで同一秒の再実行も区別）。選手名・ビルド名は入れない。英数字・ハイフン・ドットのみ
  （Windows 禁止文字・パス区切り・制御文字・空白なし）。不正 Date は `efootball-team-ai-builds-export.json`。

### 純ロジック（`build-export.ts`・非破壊・localStorage/DOM を触らない）

- `validateExportBuilds(rawBuilds)` — 各要素を `savedBuildSchema` で検証。無効は修復も削除もせず、
  安全な ID（`safeBuildRef`: buildId / worldCardId のみ）を積む。
- `buildExport({ rawBuilds, exportedAt })` — 無効が **1 件でもあれば全体停止**（`{ ok:false, reason:"invalid", validCount, invalidCount, invalidRefs }`）。
  有効分だけの部分書き出しはしない。0 件は `{ ok:false, reason:"empty" }`。成功時は `{ ok:true, file, json, itemCount }`。
- `dedupeExportBuilds` / `sortExportBuilds` / `canonicalizeExportBuild` / `serializeSavedBuildExport`。
- `reconcileAllExport(snapshotBuildIds, currentBuilds)` — 確認開始時の buildId 集合と現在の集合を比較
  （件数だけでなく集合・追加/削除を検出）。差異があれば `conflict`。
- `reconcileSelectionExport(targets, currentBuilds)` — 控えた各対象を `buildId` + `worldCardId`（文字列完全一致）
  + `updatedAt` で再取得検証。消えていれば `removed`、内容が変わっていれば `changed`（最新状態で続行しない）。
  同一 buildId は 1 件に畳む。0 件は `empty`。
- `buildExportFilename(date)`。

### ダウンロード（`src/lib/browser-download.ts`）

`downloadTextFile(filename, text, mimeType?)` — Blob + `URL.createObjectURL` + 一時 `a[download]`。
`window` / `document` / `URL.createObjectURL` 不在（SSR・hydration 前）では `{ ok:false, reason:"ssr" }` で何もしない。
一時要素は同期で除去、Object URL は 10 秒後に `revokeObjectURL`（各呼び出しが自分の URL を解放）。
サーバー API・外部アクセス・アップロードなし。内容を console へ出さない。**この関数自体は不変**（フォールバック
専用として今も使われる）。

### 保存場所の選択（2026-09-05 追加・`src/lib/browser-save-file.ts`）

対応ブラウザーでは File System Access API（`showSaveFilePicker`）でユーザーに保存場所を選ばせ、非対応・
例外時は既存 `downloadTextFile`（上記）へ安全にフォールバックする。**JSON 形式・`format`・`formatVersion`・
`itemCount`・出力フィールド・決定的並び順・UTF-8・BOM なしは一切変更しない**（`buildExport` /
`buildExportFilename` は無変更）。

- `saveTextFile(filename, text, opts)` → `Promise<{ ok:true; method:"picker"|"download" } | { ok:false; reason:"cancelled"; method:"picker" } | { ok:false; reason:"ssr"|"error"; method }>`。
- 対応ブラウザー: `showSaveFilePicker({ suggestedName: filename（既存 buildExportFilename の値そのまま）,
  types:[{ description:"JSON ファイル", accept:{ "application/json":[".json"] } }], startIn:"documents" })` →
  `createWritable()` → `write(text)` → `close()`。**`startIn:"documents"` は OS 標準の「候補ディレクトリ」
  ヒントであり絶対パスではない**。ユーザーはピッカー内で自由に別の場所へ移動・キャンセルできる
  （断定的に「必ずドキュメントへ保存される」とは謳わない）。
- ユーザーキャンセル（`AbortError`）は `reason:"cancelled"` として**エラーとも成功とも表示しない**区別を維持。
- `write` 失敗・`close` 失敗はいずれも `reason:"error"`（`close` は書き込み失敗時も試みるが、結果に関わらず
  成功表示はしない）。
- `FileSystemFileHandle` / `FileSystemWritableFileStream` は関数のローカル変数としてのみ保持し、
  **localStorage・IndexedDB・その他へ一切永続化しない**。
- `showSaveFilePicker` 不在の環境（`isSaveFilePickerSupported()` が false）では既存 `downloadTextFile` を
  そのまま呼び出す（`method:"download"`）。Windows の絶対パス・ユーザー名・Documents フォルダーの推測・
  埋め込みは行わない。ディレクトリ権限（`showDirectoryPicker`）は要求しない。

### 画面（`src/components/progression/BuildExportModal.tsx`）

- `BuildExportLauncher` — My Builds 上部（空状態でも）に「保存ビルドを書き出す」ボタン＋固定説明
  （ローカル JSON・外部送信しない・元データ変更なし・全件/選択・**対応ブラウザーでは保存場所の選択画面が
  表示され「ドキュメント」フォルダーの選択を勧める旨・非対応時は通常のダウンロード先へ保存する旨**）。
  保存ビルド 0 件・localStorage 不可では無効。
- `BuildExportModal` — 既存 `Modal`（フォーカストラップ・Esc・フォーカス復帰）。3 ステップ:
  1. **choose** — 「すべて」/「選択」ラジオ、選択時は検索＋対象一覧（チェックボックス・ビルド名・
     日本語選手名・World ID・buildId・現行/旧規則バッジ・使用中/未使用・更新日時）＋選択件数の読み上げ。
  2. **confirm** — 件数・形式・UTC 時刻・安全性の説明 ＋ **保存場所についての説明**（保存場所選択画面が
     表示されたら「ドキュメント」フォルダーを選ぶ案内／保存先はユーザーが選ぶ／外部送信なし／元データ不変／
     キャンセル時は何も保存されない／非対応ブラウザーは通常のダウンロード先）。ボタンは対応ブラウザーでは
     「保存場所を選ぶ」、非対応では「JSON をダウンロード」と表示を切り替える。**直前再取得 → 再検証**は不変。
  3. **done** — 成功通知（`aria-live="polite"`）＋ファイル名＋UTC の明記＋（フォールバック時のみ）
     「このブラウザーは保存場所の選択に対応していないため、通常のダウンロード先へ保存しました」の案内。
  - **キャンセル時**（`reason:"cancelled"`）: confirm ステップに留まり、`role="status"
    aria-live="polite"` の中立的な案内（保存ビルドは変更していない旨）を表示。エラーとして扱わない。
- 別タブ更新（`stale`・親の `BUILD_STORAGE_KEY` 監視を共有・新規リスナーは追加しない）: `role="alert"` バナー＋
  手動「再読込」。Modal を勝手に閉じない・選択を勝手に置き換えない・確認前の保存を禁止。
  削除された選択対象は件数を通知し、新しいビルドを勝手に選択しない。検索入力は保持。
- 競合・無効データ時は保存せず成功表示もせず、`role="alert"` ＋再読込を案内（不変）。

### 変更ファイル

- 新規: `src/lib/progression/build-export.ts` / `src/lib/browser-download.ts` /
  `src/lib/browser-save-file.ts`（2026-09-05）/ `src/components/progression/BuildExportModal.tsx` /
  `src/lib/progression/build-export.test.ts`（34）/ `src/lib/browser-download.test.ts`（6）/
  `src/lib/browser-save-file.test.ts`（2026-09-05・17）。
- 変更（最小）: `src/lib/progression/build-storage.ts`（`savedBuildSchema` に `export` 追加のみ・スキーマ不変）、
  `src/components/progression/MyBuildsView.tsx`（`BuildExportLauncher` を 2 か所へ配置）、
  `src/components/progression/BuildExportModal.tsx`（2026-09-05: `downloadTextFile` 直接呼び出しを
  `saveTextFile` 経由へ変更・保存場所の説明とキャンセル表示を追加・ボタン文言を条件分岐。既存の choose/confirm/done
  ステップ構造・競合再検証・エクスポート形式は不変）、
  `scripts/black-box-my-builds.mjs`（SSR 文言・安全性 13 件）。
- `src/lib/browser-download.ts` は**無変更**（フォールバック用として今も直接使われる）。
- スキーマ・localStorage キー・URL・計算エンジン・SQLite は不変。`FileSystemFileHandle` の永続化なし。

## 保存ビルドのローカル JSON インポート（2026-09-02 追加・インポートのみ・追加保存）

前回このアプリの「保存ビルドを書き出す」で作った正式なエクスポート JSON を、**ユーザーの最終確認後に**
保存ビルドとして**追加**する。**エクスポートと同じ `format` / `formatVersion` / `savedBuildSchema` を再利用**する。
対象は `SavedBuild` のみ。My Team / スカッド / カードお気に入り / `selectedBuildId` / `favoriteBuildId` /
`savedBuildId` は読みも書きもしない。既存ビルドを上書き・削除しない。

### 段階の分離（ファイル選択だけ・解析成功だけ・プレビューだけでは保存しない）

1. ファイル選択 → 2. `file.size` でサイズ上限チェック → 3. `file.text()` で読み込み → 4. JSON 解析 →
5. トップレベル形式検証 → 6. `format` / `formatVersion` 完全一致 → 7. `itemCount` 整合 →
8. 各 `SavedBuild` の厳格検証 → 9. ファイル内 `buildId` 重複検出 → 10. `buildId` 衝突分析・新 ID 割当 →
11. プレビュー表示 → 12. **最終確認（inline `role="alertdialog"`）** → 13. 保存直前に既存一覧を再取得・競合再検証 →
14. **全件単位で 1 回だけ保存** → 15. 保存後に再取得・件数と `buildId` を検証 → 16. 成功通知。

### 対応 / 拒否

- **対応**: `format === "efootball-team-ai-saved-builds"` かつ `formatVersion === "1"`（完全一致）かつ
  `itemCount === builds.length` かつ全 `builds` が `savedBuildSchema.strict()` を通過。
- **拒否**: SavedBuild 単体 JSON / localStorage 全体 / My Team / スカッド / カードお気に入り / CSV / ZIP / TXT /
  JavaScript / HTML / 未対応 `formatVersion`（**将来バージョンを現在版として読まない**・変換もしない）/
  必須フィールド欠損 / `itemCount` 不一致 / **ファイル内 `buildId` 重複が 1 件でもある** /
  **無効な `SavedBuild` が 1 件でもある**（部分読み込みなし）/ トップレベルの不明キー /
  `__proto__` / `constructor` / `prototype` を含むトップレベル。

### 上限（`build-import.ts`）

| 項目 | 値 | 理由 |
|---|---|---|
| `MAX_IMPORT_FILE_BYTES` | 4,000,000（≈4MB） | 1 ビルド ≈ 1KB。localStorage 実効クォータ（概ね 5MB）に迫れば保存側で容量エラー。4MB は通常のバックアップ（数十〜数千件）を拒否せず FileReader 一括読込がフリーズしない範囲 |
| `MAX_IMPORT_ITEM_COUNT` | 3,000 | 通常のユーザーは数十〜数百件。プレビュー描画・全件検証の計算量を安全に抑える上限 |

`file.size` が上限超なら**読み込む前に**拒否。`file.size` が取れない環境向けに本文バイト数で二重チェック。

### 純ロジック（`src/lib/progression/build-import.ts`・localStorage/DOM/fetch を触らない）

- `parseImportText(text)` — サイズ / JSON / トップレベルがオブジェクト / 危険キー / 不明トップレベルキー /
  `format` / `formatVersion`（`SUPPORTED_IMPORT_FORMAT_VERSIONS = ["1"]`）/ `exportedAt`（ISO 8601 正規表現＋`Date.parse`）/
  `itemCount`（非負整数・上限）/ `builds` 配列 / `itemCount === builds.length` を検証。エラーコード付き。
  `JSON.parse` の結果を `eval` / `Function` / 動的 import で実行しない・スプレッドで既存へ混ぜない。
- `validateImportBuilds(rawBuilds)` — 各要素を **`savedBuildSchema.strict()`**（未知キーを拒否）＋ `schemaVersion === 1`。
  有効分は `canonicalizeExportBuild` で決定的な形へ（値は変えない）。無効は安全な ID のみ返す（内容全文なし）。
- `findInFileDuplicateBuildIds(builds)` — 重複 `buildId` 一覧（1 件でもあれば `analyzeImport` が全体拒否）。
- `analyzeImport(text, currentBuilds, genId)` — parse → validate（無効 1 件で `stage:"validate"` 全体拒否）→
  重複（`stage:"duplicate"` 全体拒否）→ プラン生成。`genId(taken)` は「既存 ＋ 発行済み」を避けた新 ID を返す契約。
  衝突しない元 `buildId` は維持。衝突は新 ID を割当（`worldCardId` / 配分 / `rulesVersion` / `buildName` /
  `createdAt` / `updatedAt` は**維持**）。`existingSnapshot`（`{buildId, updatedAt}[]`）を控える。
- `reconcileImport(plan, freshCurrentBuilds, genId)` — 最終確認後、控えた集合と再取得した一覧を突き合わせ。
  既存 `buildId` の増減・差し替え、既存の `updatedAt` 変化があれば `conflict`（保存しない）。
  問題なければ現在の一覧に対して衝突と新 ID を**再計算**し、最終 `SavedBuild[]` を返す。

### 新 buildId 生成（`build-storage.ts` の `generateUniqueBuildId(taken)`）

既存 `newBuildId`（`crypto.randomUUID` ベース・`b_` + 16 hex）を再利用し、`taken`（既存ビルド ＋
同一処理で発行済みの新 ID ＋ ファイル内の他ビルドの元 ID）と衝突したら生成し直す。
`-copy` 付与 / `Math.random` のみ / `Date.now` のみ / `worldCardId` や `buildName` からの推測生成 / 再衝突未確認は不採用。

### 全件単位の保存（`build-storage.ts` の `importBuilds(builds, { expectedExistingBuildIds })`）

**新しい安全プリミティブ**（危険な直書きではない・既存の読み書き機構を使う）:

- 既存ストアを `readStore()` で読む → 既存ビルドは**そのまま維持**（上書き・削除・改名・並び替えなし）。
- `expectedExistingBuildIds` が現在の既存集合と食い違えば `conflict`（保存しない）。
- 追加分を各要素 `savedBuildSchema` ＋ `schemaVersion === 1` で再検証。既存 or 追加分どうしの `buildId` 衝突は `conflict`。
- `createdAt` / `updatedAt` は渡された値のまま保存（インポート時刻で上書きしない）。
- マージ結果の**ストア全体を既存 `storeSchema` で検証**してから、**既存 `writeStore` で 1 回だけ** `setItem`。
- `BUILD_STORAGE_KEY` 以外の localStorage キーに触れない。新キー・`storageVersion` を作らない。
- 途中失敗による部分保存が発生しない（検証 → 単一書込）。容量不足は `quota`。
- 保存後、`listAllBuilds()` を再取得して新 `buildId` の存在と件数（`旧件数 + 追加件数`）を検証。

### プロトタイプ汚染対策

- トップレベルに `__proto__` / `constructor` / `prototype` の own key があれば拒否（`risky-keys`）。
- `JSON.parse` 結果をスプレッド / `Object.assign` で既存データへ混ぜない。保存する `SavedBuild` は
  `canonicalizeExportBuild` で**フィールドを明示列挙して新規構築**。
- `savedBuildSchema.strict()` が SavedBuild 内部の未知キーも拒否。
- `parseImportText` はプロトタイプを汚染しない（テストで `Object.prototype` が汚れないことを確認）。

### 日時の扱い

`createdAt` / `updatedAt` はファイルの値を**そのまま維持**する。インポート時刻・`exportedAt`・ファイル選択時刻を
`SavedBuild` の日時に使わない。build-storage には store レベルの `storageVersion` はなく、per-build `schemaVersion`
が `1`（`BUILD_SCHEMA_VERSION`）であることを検証する。インポート履歴用の新しい localStorage キーは作らない。

### 画面（`src/components/progression/BuildImportModal.tsx`）

- `BuildImportLauncher` — My Builds 上部（「書き出す」の隣・別入口）に「保存ビルドを読み込む」ボタン＋
  固定の安全性説明（ローカル JSON のみ・外部送信しない・選択/プレビューだけでは保存しない・既存を上書きしない・
  衝突時は新 ID・My Team/スカッド/お気に入りへ自動適用しない・未対応 formatVersion は拒否）。
- `BuildImportModal` — 既存 `Modal`（フォーカストラップ・Esc・フォーカス復帰）。ステップ:
  `select`（`<input type="file" accept="application/json,.json">` は Modal 内でのみ・ラベル付き）→
  `error`（安全な短いメッセージ・`role="alert"`）→ `preview`（ファイル情報・検証結果・対象一覧スクロール・
  元 buildId → インポート後 buildId・rulesVersion・配分・PoM・実験的試算・日時・変更しないデータ）→
  `confirm`（inline `role="alertdialog"`・ネスト Modal なし）→ `saving`（`role="status"`）→
  `done`（`aria-live="polite"`・件数・新 ID 件数）/ `savefail`（`role="alert"`）。
- File API 読込は `src/lib/browser-upload.ts` の `readUploadedTextFile`（SSR / File API 不在で読まない・
  サイズ上限・例外を安全な理由コードに・内容やパスを返さない）。読込トークンで古い非同期結果を無視。
  Modal を閉じる / 別ファイル選択で解析結果を破棄。
- storage イベント: 親の `BUILD_STORAGE_KEY` 監視を共有（新規リスナーなし）。`stale` 時は preview/confirm で
  `role="alert"` ＋「既存データを再読込」・保存を禁止・再解析で衝突と新 ID を再計算。Modal を勝手に閉じない。
- 二重実行防止（`busy`）。読み込んだビルドを `selectedBuildId` / `favoriteBuildId` / スカッド `savedBuildId` へ
  自動設定しない（使用状況では「参照なし」）。

### 検証

- Unit: `build-import.test.ts`（40）/ `browser-upload.test.ts`（7）/ `build-storage.test.ts` に
  `importBuilds` ＋ `generateUniqueBuildId`（+10）。形式検証・SavedBuild 検証・ファイル内重複・既存衝突・
  新 ID 一意性・競合・全件保存・部分失敗防止・非変更・プロトタイプ汚染・SSR を網羅。
- ブラックボックス: `scripts/black-box-my-builds.mjs` に `/my-builds` SSR の入口文言・安全性を 15 件追加
  （入口・対象説明・外部送信しない・選択/プレビューだけでは保存しない・既存上書きなし・衝突時新 ID・
  My Team/スカッド/お気に入りへ自動適用しない・未対応 formatVersion 拒否・プレビュー/最終確認・
  localStorage 全体/SQLite インポートではない・ファイル入力を SSR に常設しない・自動参照作成なし・
  架空 OVR なし・内部情報リークなし）。14 番目のレールは作らない。

### 変更ファイル

- 新規: `src/lib/progression/build-import.ts` / `src/lib/browser-upload.ts` /
  `src/components/progression/BuildImportModal.tsx` /
  `src/lib/progression/build-import.test.ts`（40）/ `src/lib/browser-upload.test.ts`（7）。
- 変更（最小）: `src/lib/progression/build-storage.ts`（`generateUniqueBuildId` ＋ `importBuilds` を追加・
  既存関数と `savedBuildSchema` / `storeSchema` / `writeStore` は不変）、
  `src/components/progression/MyBuildsView.tsx`（`BuildImportLauncher` を 2 か所へ配置）、
  `scripts/black-box-my-builds.mjs`（旧エクスポート系チェック 3 件を再構成 ＋ インポート 15 件）、
  `src/lib/progression/build-import.test.ts` 等。
- スキーマ・`storageVersion`・localStorage キー・URL・計算エンジン・SQLite は不変。

## storage イベント

- `window` の `storage` イベントで **`efootball-team-ai:progression-builds:v1`**（保存ビルド）と
  **`efootball-team-ai:my-team:v1`**（My Team）の 2 キーのみ（または `key == null`）を監視。
- 別タブ更新時は「別のタブで保存ビルドが更新されました」/「別のタブで My Team が更新されました」＋
  **手動「再読込」ボタン**を `aria-live="polite"` で表示。勝手に一覧を差し替えない・編集中のダイアログを閉じない・名前入力を上書きしない。
  （My Team 側は `my-team-storage` 自身の `storage` リスナーが `notifyUserCards` するため `useMyTeam` のデータは自動更新されるが、
  通知は明示的に出す。操作対象は確認ダイアログ側が submit 時に再検証するので入れ替わらない。）
- リスナーはアンマウント時に解除。毎描画で登録しない。同一タブの更新は `updateMyTeamRecord` の
  `notifyUserCards` → `useSyncExternalStore` で即時反映。

## 空状態 / エラー状態

- 保存ビルド 0 件: 「保存ビルドがありません」＋「選手詳細または選手比較で育成を調整し、『この育成を保存』から追加できます。」
  ＋ 選手を探す / 選手比較を開く / My Team を開く / スカッドを開く への導線。
- 検索結果のみ 0 件: 「条件に一致する保存ビルドがありません」（保存 0 件と混同しない）＋「検索条件を解除」。
- localStorage 使用不可 / 一括解決 API エラーを分離表示（`role="alert"`）。破損ビルドは build-storage の Zod が
  黙って捨てる（正常ビルドは残る・0 や空配分で置換しない）。エラー表示にスタックトレース・localStorage 全内容・
  DB パス・`process.env` を出さない。

## OVR 表示

- `SavedBuild.calculatedOvr` は「**保存時の推定OVR**」として表示（`calculationMode` を併記）。欠損時は「—」（0 表示しない）。
- **ポジション別 OVR は引き続き「総合値（ポジション別 OVR）: —（計算規則を確認中）」を維持。**
  `calculatedOvr` をポジション別 OVR として表示しない・レーダー平均や能力値合計から再計算しない・
  `POSITION_WEIGHTS` を使わない・スクリーンショット値を保存しない。**架空 OVR は 0 件。**

## buildMode について

`SavedBuild` に `buildMode` フィールドは**存在しない**（保存されるのは解決済みの `progressionAllocation`）。
そのため My Builds では buildMode を表示しない（推測でラベルを作らない・My Builds 用の重複ラベル辞書を作らない）。
`buildModeLabelJa` は既存の育成方針セレクト用のまま。

## 既存機能への影響

画面コンポーネントのユーザー向け UI 変更:
`Sidebar.tsx`（ナビ項目 1 行）、`LocalStorageNotice.tsx`（`"builds"` kind 追加）、新規 `/my-builds` 一式、
`MyBuildCard` / `MyBuildsView` への「My Teamに登録 / My Team で使用 / 選択を解除 / お気に入りビルドに設定 / お気に入りを解除」、
`MyTeamView` の保存ビルドストリップ強化＋新規 `MyTeamBuildPanel`（「保存ビルドを選ぶ」）。
計算エンジン・URL・保存スキーマ・`SavedBuild` / `MyTeamRecord` / `StoredSquad` スキーマ・SQLite・
Power of Many・監督補正・日本語ラベル監査は不変。`build-storage.ts` は `listAllBuilds` / `duplicateBuild` の
追加のみ。My Team 側は既存 `updateMyTeamRecord` / `getMyTeamRecord` / `getMyTeamByWorldId` / `listBuilds` / `getBuild` の**再利用のみ**（変更なし）。
`my-builds.ts` に純関数追加（`resolveMyTeamBuildRefs` / `sortMyTeamBuildPanel` / `validateMyTeamBuildRefClear`）— 既存関数の公開形は不変。
`favorites` ストレージには一切触れない。

## テスト

- `src/lib/progression/my-builds.test.ts`（142 件）: 配分行 / ポイント集計（v1・v2・null・超過）/ 規則状態 /
  PoM / 実験 / 日時（不正 → —）/ rename 検証 / 複製名 / 検索（日本語・英語・ID・記号・空）/ フィルタ各条件 /
  並び替え（安定・不正日時・非破壊）/ facets / 使用状況（重複スカッド除去・お気に入り参照・未使用）／
  **My Team 選択中ビルド連携**: `resolveMyTeamBuildSelectionState`（not-in-team / selected / assignable・別 worldCardId・
  `isSelected` / `isFavorite` / `currentSelectedBuildId` / `currentFavoriteBuildId`）、`validateMyTeamBuildAssignment`、
  `describeMyTeamBuildChange`、結合（`updateMyTeamRecord`: selectedBuildId のみ変更・他フィールド維持・他レコード不変・解除・不正 buildId は sanitize）／
  **My Team お気に入りビルド連携**: `validateMyTeamFavoriteBuildAssignment` / `validateMyTeamFavoriteBuildClear`
  （設定は共通検証・解除は favoriteBuildId 一致を追加確認・別ビルド/null は競合失敗）、`describeMyTeamFavoriteBuildChange`
  （from なし / 別 / 見つからない / already・selectedBuildId 併記）、結合（favoriteBuildId のみ変更・selectedBuildId 維持・
  両方一致でも独立解除・他レコード不変・`favorites` ストレージ不変）／
  **My Team 新規登録**: `validateMyTeamRegistration`（storage / worldCardId 文字列（Number 不可）/ buildId / build-missing /
  duplicate / 別 worldCardId は重複でない / ownership・usage enum / 20桁 worldCardId）、`buildMyTeamRegistrationPreview`
  （selected/favorite 4 組み合わせ・twoStage・tags:[]・note:""）、`resolveSafeOwnershipDefault` = "owned" /
  `resolveSafeUsageDefault` = "unknown"、`isOwnershipStatus` / `isUsageStatus`、結合（`addToMyTeam` 経由で
  selected ON/OFF × favorite ON/OFF の 4 通り・worldCardId 文字列維持・tags []・note ""・teamCardId/addedAt/updatedAt 生成・
  重複は addToMyTeam が拒否し既存レコード不変・他レコード不変・`favorites` ストレージ不変）／
  **My Team ビルド選択パネル**: `resolveMyTeamBuildRefs`（selected/favorite の解決・未設定・削除済み missing・元 ID 保持・record null・同一 buildId）、
  `sortMyTeamBuildPanel`（選択中→お気に入り→更新日時降順→buildId・selected==favorite は 1 件・不正日時は末尾・非破壊）、
  `validateMyTeamBuildRefClear`（現在値一致で ok・削除済み参照でも ok・favoriteBuildId 同様・storage 不可/record null/teamCardId 不一致/別タブ変更/既に null は失敗）、
  結合（`updateMyTeamRecord` 経由で selectedBuildId のみ・favoriteBuildId のみ・削除済み参照の null 化・selected==favorite の独立解除・他レコード/`favorites` ストレージ不変）／
  **スカッド枠の保存ビルド選択**: `resolveBuildRef`（一致 / 未設定 / 削除済み）、`validateSquadBuildAssignment`
  （設定/解除・changed 判定・storage / slot-missing / card-mismatch（Number 非変換・20桁）/ build-missing / build-id・解除は storedBuild 不要）、
  `summarizeSquadBuilds`（設定済み / 未設定 / 削除済み（未設定へ変換しない）/ 別 worldCardId は missing / 現行・旧・規則不明 / PoM（未指定を最大扱いしない）/ 実験・空スカッド・Map/Record 両対応）、
  `filterSquadBuildUsage`（フィルター 6 種・検索・非破壊・正規表現評価なし）。
- `src/lib/squad/squad-storage.test.ts`（+5 件）: 枠の savedBuildId は対象枠だけ変更（先発 slotId / ベンチ subId で特定・他枠/座標/キャプテン/ベンチ不変・別スカッド不変・不正 buildId は Zod で null）。
- `src/lib/progression/build-storage.test.ts`（+5 件）: `listAllBuilds` / `duplicateBuild`。
- `src/lib/user-cards/user-cards.test.ts`（既存）: `updateMyTeamRecord({ selectedBuildId })` / `{ favoriteBuildId }` の set/clear/sanitize を既にカバー。
- `scripts/black-box-my-builds.mjs`（35 件）: `/my-builds` 200・h1 は 1 つ・空状態シェル・ローカル保存明示・
  ログイン誤表示なし・内部情報リークなし・**架空の所有/使用状態を SSR で断定表示しない**・ナビ項目（準備中でない）・
  by-ids API・`/my-team` 空状態シェル・**My Team: 架空のポジション別 OVR を SSR で断定表示しない / 英語育成カテゴリ名を主表示に出さない / 内部情報リークなし**・
  `/favorites` 空状態シェル（別機能・回帰）・全画面の回帰。
  ※ SSR 空状態では build カードが出ないため「My Teamに登録 / My Team で使用 / お気に入りビルドに設定 / 保存ビルドを選ぶパネル」の
  更新処理はインメモリ結合テストで担保。全13ブラックボックスレール 637/637 PASS。
- 実ユーザーの保存ビルド / My Team / カードお気に入りはテストで変更しない（vitest はメモリ localStorage、black-box は読み取りのみ）。
