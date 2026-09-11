# マイルストーン完了報告: 保存ビルドのローカル JSON インポート

- 実施日: 2026-09-02
- 対象: My Builds 画面（`/my-builds`）
- 種別: 高リスク寄り。前回このアプリが出力した正式なエクスポート JSON を、**ユーザーの最終確認後に**
  保存ビルドとして**追加**する。**インポートのみ**（エクスポートは前回実装済み・維持）。
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**

---

## 1. 目的と非目的

### 目的
前回定義したエクスポート形式（`build-export.ts`）を読み込み、保存前に厳格検証し、内容と処理結果を
プレビューし、既存保存ビルドを上書きせず、`buildId` 衝突時は正式な ID 生成処理で新 ID を発行し、
参照関係を引き継がず、My Team・スカッドへ自動適用せず、全対象の保存可否を事前確認し、
中途半端な部分保存を防ぎ、外部へ送信せず、**ユーザーが最終確認を押した場合だけ**保存する。

### 非目的（実装しない）
My Team / スカッド / カードお気に入り / localStorage 全体 / SQLite のインポート、外部アップロード、
クラウド同期、ドラッグ&ドロップ、未対応 `formatVersion` の自動変換、旧スキーマ自動移行、将来バージョンの推測読込、
既存ビルド上書き・削除、同名ビルドの自動統合、完全同一内容の自動重複排除、My Team 参照の自動作成、
`selectedBuildId` / `favoriteBuildId` / スカッド `savedBuildId` の自動設定、`buildName` 自動変更、
`rulesVersion` / `progressionAllocation` / `selectedPlayerBooster` / `conditionalBoosterSelections` /
`calculatedStats` / `calculatedOvr` / `createdAt` / `updatedAt` / `worldCardId` の変更、
新 localStorage キー、`storageVersion` 変更、保存スキーマ変更、URL 形式変更、
`calculateBuild` / `buildComparison` / Power of Many / 監督補正の変更、ポジション別 OVR、ZIP/CSV/PDF/PNG/TXT、新規 npm 依存。

---

## 2. 対応 format / formatVersion

| 項目 | 値 |
|---|---|
| 対応 `format` | `"efootball-team-ai-saved-builds"`（`SAVED_BUILD_EXPORT_FORMAT` を `build-export.ts` から再利用・**完全一致のみ**） |
| 対応 `formatVersion` | `"1"`（`SUPPORTED_IMPORT_FORMAT_VERSIONS = ["1"]`・**完全一致のみ**） |
| 未対応 `formatVersion` | 変換せず拒否（`unsupported-version`）。「アプリの更新が必要」と案内。将来バージョンを現在版として読まない。 |
| SavedBuild 検証 | `savedBuildSchema`（`build-storage.ts` から `export` 済み）を **`.strict()`** で再利用（未知キー拒否）＋ `schemaVersion === BUILD_SCHEMA_VERSION`（1）。 |

エクスポートとインポートで `format` / `formatVersion` / `SavedBuild` 検証が**同じ定数・同じスキーマ**。

---

## 3. ファイルサイズ上限と理由 / itemCount 上限と理由

| 定数 | 値 | 理由 |
|---|---|---|
| `MAX_IMPORT_FILE_BYTES` | `4_000_000`（≈4MB） | 1 ビルド ≈ 1KB（インデント付き JSON）。localStorage の実効クォータは概ね 5MB 前後で、ビルドストアがそれに迫れば保存側で容量エラーになる。4MB あれば通常のバックアップ（数十〜数千件）を拒否せず、かつ `file.text()` 一括読込がブラウザーをフリーズさせない範囲。 |
| `MAX_IMPORT_ITEM_COUNT` | `3000` | 通常のユーザーの保存ビルドは数十〜数百件。3000 は現実的なバックアップを拒否せず、プレビュー描画と全件検証の計算量を安全に抑えられる上限。 |

- `file.size` が上限超なら **`file.text()` を呼ぶ前に** `too-large` で拒否（`browser-upload.ts`）。
- `file.size` が取れない環境向けに、本文の UTF-8 バイト数で二重チェック（`parseImportText` と `readUploadedTextFile` の両方）。
- 上限超過時: 保存しない・内容をログへ出さない・安全なエラー表示のみ。

---

## 4. トップレベル検証（`parseImportText`）

拡張子は信用しない。中身を解析して以下を順に検証（エラーコード付き）:

1. 空文字 / 空白のみ / 非文字列 → `empty`
2. UTF-8 バイト数 > `MAX_IMPORT_FILE_BYTES` → `too-large`
3. `JSON.parse` 失敗 → `not-json`（HTML / JavaScript 文字列もここで弾かれる）
4. `null` / 配列 / プリミティブ → `not-object`
5. own key に `__proto__` / `constructor` / `prototype` → `risky-keys`
6. 許可キー（`format` / `formatVersion` / `app` / `exportedAt` / `itemCount` / `builds`）以外の own key → `unknown-top-key`
7. `format !== "efootball-team-ai-saved-builds"` → `format-mismatch`
8. `formatVersion` が文字列でない → `format-version-type`
9. `formatVersion` が `["1"]` に含まれない → `unsupported-version`
10. `exportedAt` が文字列でない / ISO 8601 正規表現不一致 / `Date.parse` 非有限 → `exported-at`
11. `itemCount` が非負整数でない → `item-count`
12. `itemCount > MAX_IMPORT_ITEM_COUNT` または `builds.length > MAX_IMPORT_ITEM_COUNT` → `item-count-too-large`
13. `builds` が配列でない → `builds-not-array`
14. `itemCount !== builds.length` → `item-count-mismatch`

`itemCount: 0` かつ `builds: []` の空エクスポートは受理する（保存対象 0 件としてプラン生成へ）。

---

## 5. 各 SavedBuild 検証（`validateImportBuilds`）

- 各要素を **`savedBuildSchema.strict()`** で検証（top-level の未知キーを拒否）。
- 追加で `schemaVersion === BUILD_SCHEMA_VERSION`（1）を確認。
- 有効分は `canonicalizeExportBuild` で決定的な形へ整える（フィールド順固定・レコードキーソート・**値は変えない**）。
- 無効は**修復しない・削除しない・0 配分化しない・`rulesVersion` を変えない・`buildId` を発行し直さない**。
  `invalid` には安全な ID（`buildId` / `worldCardId` が正規表現に合うもののみ）と `index` だけを積む。内容全文は返さない。
- `analyzeImport` は **無効が 1 件でもあれば `stage:"validate"` で全体拒否**（部分読み込みなし）。

保持を確認済み: `worldCardId` の文字列維持（20 桁も可）/ `rulesVersion` / `progressionAllocation` /
`conditionalBoosterSelections`（Power of Many 指定）/ `selectedPlayerBooster`（実験的試算）/
`calculatedOvr` の `null` / `createdAt` / `updatedAt`。

---

## 6. 不明キーの扱い（採用方針）

- **トップレベルの不明キー → ファイル全体を拒否**（`unknown-top-key`）。正式なエクスポートは 6 キーちょうど。
- **SavedBuild 内部の不明キー → そのビルドを無効扱い → ファイル全体を拒否**（`savedBuildSchema.strict()`）。
  エクスポートは Zod `.strip()` で正式 13 フィールドだけを書き出しているため、未知キーがある時点で
  「このアプリの正式なエクスポートではない」と判断できる。警告での通過ではなく**拒否**（安全側）を採用。
- `conditionalBoosterSelections` の配列要素 `{boosterKey, selection}` は既存 `conditionalBoosterSelectionSchema`
  （非 strict）で検証。`selection` の `z.enum` が値を厳しく制約し、エクスポートは 2 キーちょうどを書くため、
  ここだけは既存の strip 挙動のまま（実質リスクなし）。

---

## 7. プロトタイプ汚染対策

- `parseImportText` はトップレベルの own key に `__proto__` / `constructor` / `prototype` があれば拒否。
  （`Object.prototype.hasOwnProperty` と `Object.keys` の両方で確認）
- `JSON.parse` の結果を**スプレッド / `Object.assign` で既存データへ混ぜない**。
- 保存する `SavedBuild` は `canonicalizeExportBuild` が**フィールドを明示列挙して新規オブジェクトを構築**する
  （入力オブジェクトをそのまま保持しない）。
- `savedBuildSchema.strict()` が SavedBuild 内部の未知キーも拒否。
- `eval` / `Function` / 動的 import / `dangerouslySetInnerHTML` / DOM への JSON 直挿入は使わない。
- Unit テストで「`{"__proto__":{"polluted":true}}` を parse しても `Object.prototype` が汚れない」ことを確認。

---

## 8. ファイル内 buildId 重複の扱い

- `findInFileDuplicateBuildIds` が重複 `buildId` を検出。**1 件でもあれば `analyzeImport` が `stage:"duplicate"` で
  ファイル全体を拒否**。
- 内容が同じでも重複扱い（黙って 1 件化しない・自動 ID 変更しない・黙ってスキップしない）。
- `buildId` が異なる完全同一内容のビルドは別ビルドとして扱う（自動統合・自動重複排除は実装しない）。

---

## 9. 既存 buildId 衝突の扱い / 新 buildId 生成方法

- 既存保存ビルドと同じ `buildId` がインポート対象にある場合、**既存を上書きしない**。
  インポート対象側へ**新しい `buildId` を発行**。`worldCardId`（文字列維持）/ `progressionAllocation` /
  `rulesVersion` / `buildName` / `createdAt` / `updatedAt` は変更しない。プレビューに元 ID → 新 ID を表示。
- My Team / スカッドの参照は作らない。元 `buildId` への参照を新 `buildId` へ自動移植しない。
- 新 ID 生成 = `build-storage.ts` の **`generateUniqueBuildId(taken)`**:
  既存 `newBuildId`（`crypto.randomUUID` ベース・`b_` + 16 hex）を再利用し、`taken` と衝突したら生成し直す。
  `taken` = 「既存ビルド ＋ 同一処理で発行済みの新 ID ＋ ファイル内の他ビルドの元 `buildId`」。
- 禁止事項（不採用）: 末尾 `-copy` のみ / `Math.random` のみ / `Date.now` のみ / 再衝突未確認 /
  `worldCardId` や `buildName` からの推測生成 / 衝突時の既存削除・上書き・黙ってスキップ / 参照の自動作成。
- Unit テストで新 ID が「現在の既存ビルド」「同じファイル内の他ビルド」「発行済みの新 ID」のいずれとも
  衝突しないことを確認（連番 genId 200 回で全ユニーク・実 `generateUniqueBuildId` でも同様）。

---

## 10. 日時の扱い

- `createdAt` / `updatedAt` は**ファイルの値をそのまま維持**する。
  インポート時刻・`exportedAt`・ファイル選択時刻を `SavedBuild` の日時に使わない。
- build-storage には store レベルの `storageVersion` は存在しない。per-build `schemaVersion` が `1` であることを検証。
- `importBuilds` は `saveBuild`（`updatedAt` を `now` で上書きする）を**使わず**、日時を verbatim で書く新プリミティブ。
  → 「既存 API が日時を無条件更新して元日時を保持できない」ケースには当たらない（新プリミティブが保持する）。
- インポート履歴用の新しい localStorage キーは作らない。

---

## 11. 全件単位保存の方法 / 部分失敗防止（`importBuilds`）

**新しい安全プリミティブを `build-storage.ts` に追加**した。これは「独自の危険な直接書込」ではなく、
storage モジュール自身の primitive で、既存の読み書き機構（`readStore` / `storeSchema` / `writeStore` /
`BUILD_STORAGE_KEY`）をそのまま使う。`saveBuild` も本質的にこのパターン（検証 → 単一 `writeStore`）。

`importBuilds(builds, { expectedExistingBuildIds })`:

1. `getStorage()` 不可なら `storage` エラー。空配列なら `invalid`。
2. `readStore()` で既存ストアを読む。既存 `buildId` 集合を作る。
3. `expectedExistingBuildIds`（確認開始時の集合）と現在の既存集合が**メンバー単位で一致**しなければ `conflict`（保存しない）。
4. 追加分を各要素 `savedBuildSchema` ＋ `schemaVersion === 1` で再検証（`invalid`）。
   既存 or 追加分どうしの `buildId` 衝突は `conflict`（呼び出し側で解決済みが前提）。
5. マージ: **既存はそのまま**（`list.slice()`）＋ 追加分を各 `worldCardId` 配列の**末尾**へ push。
   `createdAt` / `updatedAt` は渡された値のまま。
6. **マージ結果のストア全体を既存 `storeSchema` で検証**。失敗なら `invalid`（保存しない）。
7. **既存 `writeStore` で 1 回だけ** `setItem`。失敗（例外）は `quota`（容量不足の可能性）。
8. `{ ok: true, saved }`。

- 途中失敗による部分保存が発生しない（検証 → 単一 `setItem`）。
- 独自ロールバック不要（そもそも 1 回書込）。localStorage 全体のバックアップ/復元/全消去はしない。
- 他ストレージを同時保存しない。既存データの並び順を変えない（既存配列は `slice` でそのまま）。
- 保存後、コンポーネント側で `listAllBuilds()` を再取得し、新 `buildId` の存在と件数
  （`旧件数 + 追加件数`）を検証。食い違えば `savefail` 表示 ＋ 一覧再読込を案内。

---

## 12. 保存直前の再検証（`reconcileImport`） / 保存後の再検証

### 保存直前（最終確認ボタン直後）
`analyzeImport` 時に控えた `existingSnapshot`（`{buildId, updatedAt}[]`）と、**再取得した `listAllBuilds()`** を突き合わせ:

- 既存 `buildId` の**追加 / 削除**（集合の差分）→ `conflict`
- 既存ビルドの `updatedAt` 変化 → `conflict`（`changedExisting`）
- `conflict` 時: 保存しない・成功通知を出さない・ファイル内容とプレビューは可能な範囲で維持・
  `role="alert"` で「別のタブで保存ビルドが更新されました。既存データを再読込して、インポート内容をもう一度
  確認してください。」＋手動再読込・**新しい `buildId` の割当も再計算**（再解析）。
- 問題なければ、現在の一覧に対して衝突と新 ID を**再計算**して最終 `SavedBuild[]` を返す
  （`worldCardId` 文字列完全一致・保存予定件数がプレビューと一致）。

さらに `importBuilds` 自身も `expectedExistingBuildIds` と現在ストアを再チェック（二重の競合検出）。

### 保存後
`listAllBuilds()` を再取得し、`rec.builds` の全 `buildId` が存在し、件数が `fresh.length + rec.builds.length` に
一致することを検証。不一致なら `savefail` ＋ 一覧再読込。

---

## 13. storage イベント

- **新しいリスナーを追加しない。** 親 `MyBuildsView` の既存 `BUILD_STORAGE_KEY` 監視（`stale` state）を
  `BuildImportLauncher` へ prop で渡して共有。
- Modal を開いている状態で `stale` になったら（preview / confirm ステップ）:
  - Modal を勝手に閉じない
  - プレビューを最新へ勝手に書き換えない
  - `role="alert"` バナー ＋「既存データを再読込」ボタン、保存を禁止（confirm ボタン無効）
  - 「既存データを再読込」で親 `reload()` → `builds` prop 更新 → `useEffect` が同じファイルテキストで**再解析**し
    衝突と新 ID を再計算（`step` は preview へ戻す）
  - 検索入力に相当する状態（ファイルテキスト）は保持・ファイルを自動再読込しない
- My Team / スカッドの更新はインポート対象と保存競合しないため、`BUILD_STORAGE_KEY` のみを対象。

---

## 14. UI とアクセシビリティ

- 既存 `Modal`（フォーカストラップ・Esc・フォーカス復帰・`aria-modal`）を使用。**ネスト Modal を作らない**
  （最終確認は 1 つの Modal 内の inline `role="alertdialog"` セクション）。
- `BuildImportLauncher` — My Builds 上部（「保存ビルドを書き出す」の隣・別入口）に「保存ビルドを読み込む」ボタン
  ＋固定の安全性説明 7 項目（`<ul>`）。`available` が false のとき無効。
- Modal ステップ: `select`（`<input type="file" accept="application/json,.json">` は **Modal 内でのみ**・`<label>` 付き・
  `file:` 疑似要素でボタン風）→ `error`（安全な短いメッセージ・`role="alert"`・無効件数 / 重複 ID を併記）→
  `preview`（ファイル情報 dl・検証結果 dl・対象一覧 `max-h-72 overflow-y-auto`・変更しないデータ）→
  `confirm`（`role="alertdialog"` + `aria-labelledby` + `aria-describedby`）→ `saving`（`role="status" aria-live="polite"`）→
  `done`（`aria-live="polite"`・件数・新 ID 件数）/ `savefail`（`role="alert"`）。
- 保存予定件数は `aria-live="polite"` の段落で読み上げ。検証中は `role="status"`。
- 主要操作（次へ / インポートする / 確定してインポート / 閉じる）は `Button size="md"`（高さ 40px）。
- 二重実行防止（`busy` で確定ボタン無効・ステップ遷移）。
- 色だけに依存しない（`Badge` は必ず文字ラベル・現行/旧規則・「新しい buildId」を文字表示）。
- 長いファイル名・ビルド名・buildId は `break-all` で折り返し。対象一覧はスクロール。追加アニメーションなし。
- レスポンシブ: `Modal` は `max-w-2xl`＋`p-4`＋`overflow-y-auto`、dl は `grid-cols-2 sm:grid-cols-3`。
  375〜1920px で横スクロールを起こさない設計（人間の目視確認項目に記載）。

---

## 15. 変更しなかったデータ（フィールド単位）

- `SavedBuild` / `MyTeamRecord` / `StoredSquad` / `StoredSlot` / `StoredSub` スキーマ・`storageVersion` /
  `schemaVersion` の**定義**: 不変。`savedBuildSchema` は前マイルストーンで `export` 済み（今回も変更なし）。
- 既存の保存ビルド: **1 バイトも変更していない**（`importBuilds` は既存配列を `slice` してそのまま維持し、
  追加分を末尾へ push するのみ）。既存の `updatedAt` / `createdAt` / `buildId` / 配分: 不変。
- My Team（`selectedBuildId` / `favoriteBuildId` / `ownershipStatus` / `usageStatus` / `tags` / `note`）: 不変（読みもしない）。
- スカッド（配置・`savedBuildId` 参照）: 不変。カード自体のお気に入り（`favorites`）: 不変。
- SQLite（`./data/efootball.db`）: 読み取りのみ・`integrity_check` ok・全件一致。
- URL パラメーター（`ids` / `b` / `m` / `tp` / `al`）: 新パラメータなし・新ルートなし。
- 計算エンジン（`calculateBuild` / `buildComparison` / fixed booster / fixed 型推定 / Power of Many / 監督補正）: 不変。
  Power of Many の未指定を最大値扱いしていない。
- ポジション別 OVR: 未実装のまま。「総合値（ポジション別 OVR）: —（計算規則を確認中）」。架空 OVR 0 件。
- インポートしたビルドを `selectedBuildId` / `favoriteBuildId` / スカッド `savedBuildId` へ**自動設定しない**
  （My Builds の使用状況では「参照なし」として表示）。
- 新規 localStorage キー: 0 / 新規 npm 依存: 0 / 外部アクセス: 0 / ファイル削除: 0 / `.next` 手動変更: 0。

---

## 16. テスト結果

### Unit（新規 2 ファイル ＋ 既存 1 ファイル拡張・計 +57 件）

**`src/lib/progression/build-import.test.ts`（40 件）**
- `parseImportText`: 正式 JSON 受理 / empty / not-json（JS 文字列・HTML 含む）/ not-object（配列・null・文字列）/
  risky-keys（`__proto__` / `constructor` / `prototype`）/ プロトタイプ非汚染 / unknown-top-key /
  format-mismatch / unsupported-version（"2" / "99"・将来版を読まない）/ format-version-type /
  exported-at（文字列でない・不正日時）/ item-count（負数・小数）/ builds-not-array / item-count-mismatch /
  too-large / item-count-too-large / itemCount:0 の空エクスポート受理
- `validateImportBuilds`: 有効 1・複数 / worldCardId 文字列維持・大きな worldCardId / 必須欠損・不正 worldCardId・
  不正 buildId・不正 rulesVersion・不正配分・不正日時 → invalid / 未知 SavedBuild キーを strict で拒否 /
  schemaVersion 不一致 / PoM・実験的試算・calculatedOvr null 保持 / 無効の識別情報は安全な ID のみ（内容全文なし）/
  入力不変
- ファイル内 buildId 重複: 検出（昇順）/ 同内容同 buildId でも重複・全体拒否 / buildId 違いは別ビルド（統合しない）
- `analyzeImport`: 衝突なし → 元 ID・日時維持 / 既存衝突 → 新 ID（内容・worldCardId・配分・rulesVersion・名前は維持）/
  全件衝突でも新 ID どうし非衝突 / 新 ID がファイル内他ビルドの元 ID とも非衝突 / 無効 1 件で validate 全体拒否 /
  parse 失敗は stage:parse
- `reconcileImport`: 変化なし → ok（最終 SavedBuild を返す）/ 既存追加 → conflict / 既存削除 → conflict /
  既存 updatedAt 変更 → conflict / 変化なしなら reassigned=false

**`src/lib/browser-upload.test.ts`（7 件）**
- window 不在 → ssr（読まない）/ file.text なし・null → no-file-api / size 上限超は `text()` を呼ぶ前に too-large /
  正常テキスト / size 無しでも本文バイト数で too-large / `text()` 例外 → read-error（内容漏らさない）/
  `text()` が非文字列 → read-error

**`src/lib/progression/build-storage.test.ts`（+10 件）**
- `generateUniqueBuildId`: 既存形式（`b_` 始まり）/ taken を避ける（200 回全ユニーク）
- `importBuilds`: 複数件を 1 回で追加・既存維持・日時そのまま / 既存 buildId 衝突で `conflict`（既存不変）/
  追加分どうしの重複拒否（何も保存しない）/ `expectedExistingBuildIds` 食い違いで `conflict` /
  schemaVersion 不一致で `invalid` / 無効 1 件で全体拒否（部分保存なし）/ localStorage 不可で `storage` / 空配列で `invalid`

### `npm run verify`（最終）
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`・stale 0・未許可 0） |
| `npm run typecheck`（tsc --noEmit） | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`。`next lint` 廃止予告のみ・Warning に数えない） |
| `npm run test`（vitest run） | **991 / 991 PASS**（50 テストファイル） |

### `npm run build`（最終・`next dev` 停止後）
PASS（全 26 ルート。`/my-builds` は Static・24.8 kB / First Load 171 kB）。

### ブラックボックス（全13レール・`next start` 上・合計 687 / 687 PASS）
| レール | 件数 |
|---|---|
| my-builds（＋My Team 連携＋`/build-inventory` SSR ＋旧規則ガイド ＋エクスポート ＋**インポート**） | **80** |
| compare | 74 |
| progression | 99 |
| squads | 46 |
| boosters | 53 |
| world-ui | 82 |
| favorites | 33 |
| ui | 69 |
| managers | 41 |
| manager-picker | 35 |
| phase-b5 | 23 |
| phase-c | 17 |
| world-sync | 35 |
| **合計** | **687** |

`black-box-my-builds` の変更: 旧エクスポート系チェックのうち「インポート未実装」「input type=file なし」
「自動上書きなし」の 3 件を再構成（「書き出す」と「読み込む」が別入口という 1 件へ集約）＋
インポート SSR チェック 15 件を追加（入口 / 対象説明 / 外部送信しない / 選択・プレビューだけでは保存しない /
既存上書きなし / 衝突時新 ID / My Team・スカッド・お気に入りへ自動適用しない / 未対応 formatVersion 拒否 /
プレビュー・最終確認 / localStorage 全体・SQLite インポートではない / SSR にファイル入力を常設しない /
自動参照作成なし / 架空 OVR なし / 内部情報リークなし）。動的なファイル読込・ID 衝突・競合・全件保存は Unit テストで担保（14 番目のレールなし）。

### HTTP 200（`next start`）
`/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/squads/sq_blackbox0001`（soft 404）`/squads/compare`
`/players/world/89138556575063` `/compare?ids=…` `/favorites` `/managers` `/api/managers`
`/api/world/players/89138556575063` `/api/world/players/by-ids?ids=…` → すべて 200。
`Cannot find module './NNN.js'` / `readlink EINVAL` / `UNKNOWN read` なし。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。**書き込み 0。**

---

## 17. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/progression/build-import.ts` | 形式検証・SavedBuild 厳格検証・ファイル内重複・衝突分析・プラン生成・保存直前再検証の純ロジック |
| `src/lib/browser-upload.ts` | 選択ファイルの安全なテキスト読込（SSR 安全・サイズ上限・例外を理由コードに） |
| `src/components/progression/BuildImportModal.tsx` | `BuildImportLauncher`（入口）＋ `BuildImportModal`（select→error→preview→confirm→saving→done/savefail） |
| `src/lib/progression/build-import.test.ts` | 純ロジック Unit テスト 40 件 |
| `src/lib/browser-upload.test.ts` | 読込ユーティリティ Unit テスト 7 件 |
| `docs/milestones/2026-09-02-saved-build-import.md` | 本報告 |

### 編集（最小差分）
| ファイル | 変更 |
|---|---|
| `src/lib/progression/build-storage.ts` | `generateUniqueBuildId(taken)` ＋ `importBuilds(builds, opts)` を追加。既存関数・`savedBuildSchema` / `storeSchema` / `writeStore` / `getStorage` / `newBuildId` は不変。 |
| `src/components/progression/MyBuildsView.tsx` | `BuildImportLauncher` を import し、0 件空状態と通常表示の 2 か所へ配置（エクスポート入口の直前）。既存ロジック・storage リスナー・レンダリングは不変。 |
| `src/lib/progression/build-storage.test.ts` | `importBuilds` / `generateUniqueBuildId` の describe を追加（+10）。既存テストは不変。 |
| `scripts/black-box-my-builds.mjs` | 旧エクスポート系 3 チェックを再構成 ＋ インポート 15 チェック。ヘッダー注記追記。 |
| `docs/my-builds.md` | 「保存ビルドのローカル JSON インポート」節を追加。 |
| `docs/progress.md` | 2026-09-02 の日付エントリを追加。 |
| `docs/project-baseline.md` | unit 934→991、ブラックボックス 674→687、my-builds レール 67→80、直近サーバー PID、別プロジェクト並走の注記、実装済み機能一覧、直前マイルストーン名を更新。 |
| `docs/milestones/README.md` | 一覧に本報告を追加。 |

### 削除
なし。

---

## 18. Node 停止 PID とコマンド / 起動 PID と親子関係 / server.pid / dev-err.log

### 特記: 同一 PC の別プロジェクト
最終品質ゲート中、同一 PC で別プロジェクト `遅延証明書シミュレーター`（OneDrive 内）の Node プロセス
（`npm run start` / `next start` / `npm run dev` / `next dev` / start-server / turbopack pool・計 6 個）が並走していた。
**これらには一切触れていない**（停止対象はコマンドラインに `C:\Development\eFootball-Team-AI` を含む PID のみ）。

### 本プロジェクトの Node 操作
| 局面 | 操作 | PID / コマンド |
|---|---|---|
| 開始時の `next dev` | 停止前検証 | 親 38192（cmdline に `C:\Development\eFootball-Team-AI` を含む）/ リスナー 36996（38192 の子）/ server.pid=38192 一致 |
| dev 停止 | `Stop-Process -Id 36996 -Force` → `Stop-Process -Id 38192 -Force` | ポート 3000 FREE・両 PID 消滅を確認・別プロジェクトの 6 プロセスは残存（正常） |
| build 前 | `./data/server.pid` → `0`（ASCII・改行なし） | |
| build | `npm run build` | PASS |
| start | `npm run start -- -p 3000` | npm ラッパー 13408 / `next start` リスナー 23072（cmdline に `C:\Development\eFootball-Team-AI` を含む） |
| 全13ブラックボックス・SQLite | `next start` 上で実行 | 687/687 PASS / integrity ok |
| start 停止 | `Stop-Process -Id 23072 -Force`（npm ラッパー 13408 は既に消滅） | ポート 3000 FREE を確認 |
| dev 再起動 | `npm run dev` | **`next dev` 親 32588**（cmdline に `C:\Development\eFootball-Team-AI` を含む）/ **リスナー 23180（32588 の子）** |
| server.pid | `32588` を書き込み（ASCII・改行なし）・`od -c` で確認 | |
| dev ページ再確認 | `/` `/my-builds` `/build-inventory` `/my-team` `/squads` `/api/world/players/by-ids` `/api/managers` | すべて 200 |
| `./data/dev-err.log` | 0 行（クリーン） | |

Node 一括停止・PID 未確認停止・stale PID のみの停止・プレースホルダー PID・別プロジェクトの停止は行っていない。

### 現在のサーバー状態（引き継ぎ）
- `next dev` 稼働中: 親 PID **32588** / ポート 3000 リスナー PID **23180**（32588 の子孫）
- `./data/server.pid` = `32588`（ASCII・改行なし）
- `./data/dev-err.log` = 0 行
- `http://localhost:3000` の主要ページ・API = 200

PID は再利用され得るため、次回操作前に `docs/safe-build-and-cache-policy.md` §7 の全項目を再検証すること
（特に cmdline に `C:\Development\eFootball-Team-AI` を含むかで別プロジェクトと区別する）。

---

## 19. 発生したバグと修正（この報告内で完結）

1. **`black-box-my-builds.mjs` の既存チェックがインポート追加で FAIL する**
   （「保存ビルドを読み込む」の存在で「インポート未実装」チェックが破れる）。
   前マイルストーンの export 実装時に置いた「インポート同時実装なし」チェックを、import 実装に合わせて
   「書き出す/読み込むが別入口」に再構成（`quality-gates.md` §5 の「根拠なく期待値を変更しない」に対し、
   同機能を実装したという明確な根拠あり）。

ゲート本体（verify / build / 全13ブラックボックス / SQLite）の FAIL は 0。

---

## 20. 未解決問題

**なし。** 完了条件（検証・プレビュー・保存・データ保護・品質）をすべて満たしている。

---

## 21. 人間の目視確認項目（推奨）

- 実ブラウザーで `/my-builds` →「保存ビルドを読み込む」→ 前回の「保存ビルドを書き出す」で作った JSON を選択 →
  プレビューに件数・元 buildId / インポート後 buildId・rulesVersion・配分・日時が出ること →「インポートする」→
  最終確認 →「確定してインポート」で My Builds 一覧に追加され、`createdAt` / `updatedAt` がファイルの値のまま
  （名前変更もされていない）であること。
- 既存と同じ `buildId` を含む JSON を読み込み、プレビューで「新しい buildId」バッジと元 ID → 新 ID が表示され、
  既存ビルドが変化しないこと。読み込んだビルドが My Team / スカッドの選択中・お気に入り・savedBuildId に
  設定されていない（使用状況が「参照なし」）こと。
- ファイル内に同じ `buildId` を 2 つ持つ JSON、`format` / `formatVersion` を書き換えた JSON、`itemCount` を
  ずらした JSON、`__proto__` を足した JSON、`.txt` にリネームした JSON、巨大ファイル → いずれも保存されず
  安全なエラーが出ること。
- プレビュー中に別タブで保存ビルドを 1 件追加/削除/リネーム →「確定してインポート」で競合警告が出て保存されず、
  「既存データを再読込」で新 ID が再計算されること。
- 375 / 430 / 768 / 1024 / 1280 / 1440 / 1920px で Modal・対象一覧・最終確認が横スクロールなしで操作でき、
  キーボードのみで開閉（Esc）・タブ移動（フォーカストラップ）・ファイル選択・確定ができ、閉じたときに
  フォーカスがボタンへ戻ること。
- インポート後のエクスポート（前機能）が引き続き動くこと。

---

## 22. 次に推奨する単独マイルストーン（候補・今回は着手しない）

- インポート時の「同名ビルドが既にある」注意表示の充実（統合はしない・件数と一覧の見せ方のみ）。
- エクスポート/インポート形式仕様の独立ドキュメント化（`docs/` にスキーマ契約を明文化）。
- `formatVersion` を上げる必要が出たときの移行方針（旧版を読めるようにするかどうかの設計判断）。
