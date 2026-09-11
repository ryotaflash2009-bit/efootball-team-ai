# マイルストーン完了報告: 保存ビルドのローカル JSON エクスポート

- 実施日: 2026-09-02
- 対象: My Builds 画面（`/my-builds`）
- 種別: ローカルバックアップ（ブラウザーからユーザー端末へファイルをダウンロード）。**エクスポートのみ。**
  インポート・ファイルアップロード・クラウド同期・外部送信は実装しない。
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**

---

## 1. 目的と非目的

### 目的
保存ビルド（`build-storage` / `SavedBuild`）を、ユーザー自身がローカルへバックアップできるようにする。
全件、または選択した保存ビルドだけを 1 つの JSON ファイルへ出力する。出力前に件数と対象を確認でき、
出力ファイルに形式バージョンと作成日時を含める。ブラウザー内だけで処理し、サーバーや外部サービスへ
送信しない。将来のインポート実装で厳格に検証できる、決定的で明示的なエクスポート形式を定義する。

### 非目的（実装しないこと）
JSON インポート / ファイルアップロード / ファイル選択・ドラッグ&ドロップ読込 / buildId 衝突処理 /
buildId 再発行 / 保存ビルドの復元・上書き・新規作成・変更・削除・並び替え保存 / My Team・スカッド・
カードお気に入りの変更やエクスポート / SQLite 変更 / 新しい localStorage キー / 保存スキーマ変更 /
暗号化・ZIP・CSV・PDF・PNG・TXT 出力 / URL 形式変更 / ポジション別 OVR / Power of Many 計算変更。

---

## 2. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/progression/build-export.ts` | エクスポート形式・検証・重複除去・決定的並び順・競合再検証・ファイル名の純ロジック |
| `src/lib/browser-download.ts` | Blob + Object URL + 一時 `a[download]` の最小ダウンロードユーティリティ（SSR 安全） |
| `src/components/progression/BuildExportModal.tsx` | `BuildExportLauncher`（入口）＋ `BuildExportModal`（3 ステップ） |
| `src/lib/progression/build-export.test.ts` | 純ロジックの Unit テスト 34 件 |
| `src/lib/browser-download.test.ts` | ダウンロードユーティリティの Unit テスト 6 件 |
| `docs/milestones/2026-09-02-saved-build-export.md` | 本報告 |

### 編集（最小差分）
| ファイル | 変更 |
|---|---|
| `src/lib/progression/build-storage.ts` | `const savedBuildSchema` → `export const savedBuildSchema`（**`export` を付けただけ**・スキーマ定義は不変）。エクスポート直前の再検証で共有するため。 |
| `src/components/progression/MyBuildsView.tsx` | `BuildExportLauncher` を import し、保存ビルド 0 件の空状態分岐と通常表示の 2 か所へ配置。既存の一覧・検索・絞り込み・並び替え・名前変更・複製・削除・My Team 連携・storage イベントには変更なし。 |
| `scripts/black-box-my-builds.mjs` | `/my-builds` SSR の書き出し入口の文言・安全性チェックを 10 件追加（57 → 67）。ヘッダー注記に `build-export.test.ts` / `browser-download.test.ts` を追記。 |
| `docs/my-builds.md` | 「保存ビルドのローカル JSON エクスポート」節を追加。 |
| `docs/progress.md` | 2026-09-02 の日付エントリを追加。 |
| `docs/project-baseline.md` | unit 894 → 934、ブラックボックス 664 → 674、my-builds レール 57 → 67、直前マイルストーン名、直近サーバー PID、実装済み機能一覧を更新。 |
| `docs/milestones/README.md` | 一覧に本報告を追加。 |

### 削除
なし。

---

## 3. エクスポート形式

### トップレベル（`SavedBuildExportFile`）
```json
{
  "format": "efootball-team-ai-saved-builds",
  "formatVersion": "1",
  "app": "eFootball Team AI",
  "exportedAt": "2026-09-02T13:45:01.238Z",
  "itemCount": 2,
  "builds": [ /* SavedBuild[] */ ]
}
```

| フィールド | 値・規則 |
|---|---|
| `format` | 固定文字列 `"efootball-team-ai-saved-builds"`（`SAVED_BUILD_EXPORT_FORMAT`） |
| `formatVersion` | 固定 `"1"`（文字列・`SAVED_BUILD_EXPORT_FORMAT_VERSION`） |
| `app` | 固定文字列 `"eFootball Team AI"`（環境情報・バージョン番号・パスは含めない） |
| `exportedAt` | `new Date().toISOString()`（UTC・ミリ秒付き ISO 8601・保存の `createdAt`/`updatedAt` と同形式） |
| `itemCount` | `builds.length` と**必ず一致**（`buildSavedBuildExportFile` で `builds.length` を代入） |
| `builds` | `savedBuildSchema` 検証済み `SavedBuild` の配列・決定的な並び順（`updatedAt` 降順 → `buildId` 昇順） |

- トップレベルのキーは上記 6 つのみ（Unit テストで `Object.keys` を固定）。
- `formatVersion` は **エクスポートファイル形式**のバージョンであり、`SavedBuild.rulesVersion`
  （育成規則）や `schemaVersion`（保存スキーマ）とは**別軸**。混同しない旨を confirm 画面と docs に明記。

### `builds[]` の各要素（出力フィールド）
`savedBuildSchema.safeParse` の結果（Zod `.strip()` 既定で未知キー除去）を `canonicalizeExportBuild` で
決定的な形へ整えたもの。フィールドと順序:

`buildId` / `worldCardId` / `buildName` / `progressionAllocation` / `selectedPlayerBooster` /
（`conditionalBoosterSelections` — 指定がある場合のみ）/ `calculatedStats` / `calculatedOvr` /
`calculationMode` / `rulesVersion` / `createdAt` / `updatedAt` / `schemaVersion`

- `progressionAllocation` / `calculatedStats` のレコードキーは**ソート**。
- `conditionalBoosterSelections`（Power of Many のユーザー指定段階）は**未指定ならキー自体を出さない**
  （`saveBuild` が空配列を削除する既存保存仕様と一致）。指定がある場合は `{ boosterKey, selection }` の順。
- `selectedPlayerBooster` / `calculatedOvr` の `null` はそのまま出力（欠損を 0 に変換しない）。
- `worldCardId` は文字列のまま（Number/parseInt しない・20 桁でも文字列保持を Unit テストで確認）。

### 除外フィールド（構造的に出力されない）
`savedBuildSchema` は `SavedBuild` の 13 フィールドのみを定義し `.strip()` するため、以下は
入力に混ざっていても**出力に現れない**（Unit テストで `k in build === false` を確認）:

`selectedBuildId` / `favoriteBuildId`（My Team）/ `ownershipStatus` / `usageStatus` / `tags` /
`note`（My Team のメモ）/ スカッドの `savedBuildId` / `teamCardId` / `localRecordId` / `deletedAt` /
`syncStatus` / localStorage 全体 / My Team ストレージ / スカッドストレージ / カードお気に入り /
SQLite データ / 選手 DB / 監督 DB / `process.env` / 環境変数 / 内部ログ / `dev-err.log` /
`server.pid` / ファイルパス / ブラウザー情報 / 認証・セッション情報 / API キー。

出力 JSON 文字列に `server.pid` / `dev-err.log` / `process.env` / `C:\` / `efootball.db` を
示唆する語が含まれないことも Unit テストで確認。

### 出力の性質
UTF-8・**BOM なし**（既存の localStorage / API と同じ方針）・`JSON.stringify(file, null, 2)`（2 スペース
インデント）。JavaScript コード・HTML・CSV・ZIP へは変換しない。暗号化・圧縮しない（そう誤認させる
表現もしない）。並び順が決定的でフィールド順・レコードキー順も固定のため、同じデータからは
**バイト同一の JSON** が得られる（Unit テストで入力順シャッフルしても `json` が一致することを確認）。

---

## 4. `exportedAt` とファイル名のタイムゾーン

**両方とも UTC（協定世界時）。** 同一の `Date` インスタンスから生成するため必ず整合する。

- `exportedAt` = `now.toISOString()` → 例 `2026-09-02T13:45:01.238Z`
- ファイル名 = `efootball-team-ai-builds-YYYY-MM-DD-HHMMSS-mmmZ.json`（UTC・末尾 `Z`）
  → 例 `efootball-team-ai-builds-2026-09-02-134501-238Z.json`
- ミリ秒（`mmm`）を含むため、**同じ秒に再実行してもファイル名が異なる**。
- 選手名・ビルド名などユーザー入力は入れない。使う文字は英数字・ハイフン `-`・ドット `.` のみ
  （`^[A-Za-z0-9._-]+$` を満たさなければ固定名 `efootball-team-ai-builds-export.json` にフォールバック）。
  Windows 禁止文字（`< > : " / \ | ? *`）・パス区切り・制御文字・空白を含まない。
- 不正な `Date` のときは固定名 `efootball-team-ai-builds-export.json`。
- 画面（done ステップ）に「ファイル名の日時と `exportedAt` はいずれも UTC」と明記。

---

## 5. 全件・選択の違い

| | 全件 | 選択 |
|---|---|---|
| 対象の識別 | 一覧の全 `buildId` 集合 | ユーザーがチェックした `buildId` |
| 確認開始時に控える情報 | `buildId` の配列 | `{ buildId, worldCardId, updatedAt }` の配列（`SelectionExportTarget`） |
| ダウンロード直前の再検証 | `reconcileAllExport(snapshot, listAllBuilds())`：`buildId` **集合**を比較（件数だけでなく追加/削除を検出） | `reconcileSelectionExport(targets, listAllBuilds())`：各対象を `buildId` + `worldCardId`（文字列完全一致）+ `updatedAt` で再取得検証 |
| 競合時 | ダウンロードしない・成功表示しない・`role="alert"` ＋「再読込」 | 同左。削除は `removed`、内容変化は `changed` として件数表示 |
| 0 件 | 保存ビルドがなければボタン自体が無効 | 選択 0 件では「次へ」不可・`reconcileSelectionExport` が `empty` |
| 重複 `buildId` | `dedupeExportBuilds` で 1 件に | `reconcileSelectionExport` が同一 `buildId` を 1 件に畳む |
| 並び順 | どちらも `buildExport` 内で `updatedAt` 降順 → `buildId` 昇順（決定的） | 同左 |

選択 UI は Modal 内だけの状態で、My Builds 本体の検索・絞り込みとは独立（その旨を画面に明記）。
Modal 内の検索は既存 `normalizeBuildSearchQuery` / `matchesBuildSearch` を再利用（正規表現評価なし）。

---

## 6. 競合処理・無効データの扱い

### 出力直前の再検証（確認開始時の状態を信用しない）
「JSON をダウンロード」を押した時点で `listAllBuilds()` を**再取得**し、次を検証:

1. **対象集合**（全件: `buildId` 集合 / 選択: 各 `buildId`）
2. **`worldCardId`**（選択・文字列完全一致・Number 変換しない）
3. **`updatedAt`**（選択・確認開始時から変化していないこと）
4. **スキーマ**（`buildExport` → `validateExportBuilds` → `savedBuildSchema`）

いずれかで差異・無効があれば:
- **ダウンロードしない**
- **成功通知を表示しない**
- 元データを変更しない
- 選択状態は可能な範囲で維持（存在しない `buildId` だけ落として件数を通知）
- `role="alert"` で「別のタブで保存ビルドが更新されました。再読込して内容を確認してください。」
  ＋手動「再読込」ボタン

### 無効データ（推奨初期方針＝全体停止）
`buildExport` は無効ビルドが **1 件でもあれば全体を停止**（`{ ok:false, reason:"invalid", validCount,
invalidCount, invalidRefs }`）。有効分だけの部分書き出しはしない（ユーザーが明示的に選べる既存仕様が
ないため）。無効ビルドを**修復しない・削除しない・0 や空配分へ変換しない・`rulesVersion` を変更しない・
`buildId` を新規発行しない・再保存しない**。エラー表示は安全な識別子のみ（`safeBuildRef`：正規表現に
合う `buildId` / `worldCardId` だけ・内容全文や localStorage は出さない）。画面には
「無効な保存ビルドが N 件あります（書き出せるのは M 件）。安全のため書き出しを中止しました。My Builds で
対象を確認してください。」と表示。

> 補足: 現在の `build-storage` は `readStore()` が**ストア全体**を `storeSchema` で検証するため、
> 一部だけ無効なビルドが `listAllBuilds()` から返ることは実際には起こらない（壊れていれば全体が空になる）。
> `buildExport` の無効検出・全体停止は、将来の入力元変更・防御目的で実装し Unit テストで担保している。

---

## 7. Blob と Object URL の扱い・SSR 安全性

`src/lib/browser-download.ts` の `downloadTextFile(filename, text, mimeType?)`:

- `typeof window === "undefined"` / `typeof document === "undefined"` /
  `typeof URL === "undefined"` / `typeof URL.createObjectURL !== "function"` のいずれかなら
  **`{ ok:false, reason:"ssr" }` を返すだけ**（SSR・hydration 前で何もしない）。
- `new Blob([text], { type: "application/json;charset=utf-8" })` → `URL.createObjectURL`。
- 一時 `<a download rel="noopener" style="display:none">` を `document.body` に追加 → `click()` →
  `finally` で**同期的に**要素を除去。
- Object URL は各呼び出しがクロージャで自分の URL を保持し、`window.setTimeout(..., 10_000)` で
  `URL.revokeObjectURL`（クリック直後の revoke でダウンロードが始まらないブラウザー対策）。
  複数回呼んでもそれぞれの URL が解放される（Unit テストで確認）。
- 例外時は `{ ok:false, reason:"error" }`（成功表示しない）。
- ダウンロード内容・JSON 全文を `console` へ出さない（Unit テストで確認）。
- クリップボードへコピーしない。画面へ JSON 全文を無条件表示しない。

サーバー API は新設しない。外部アクセス・アップロードなし。

---

## 8. storage イベント（別タブ更新）

- **新しいリスナーを追加しない。** 親 `MyBuildsView` の既存 `BUILD_STORAGE_KEY` 監視（`stale` state）を
  `BuildExportLauncher` へ prop で渡して共有する。
- Modal を開いている状態で `stale` になったら:
  - Modal を**勝手に閉じない**
  - 選択を**勝手に最新へ置き換えない**
  - `role="alert"` バナー「別のタブで保存ビルドが更新されました。再読込して内容を確認してください。」
    ＋手動「再読込」
  - 確認前（choose→confirm）と確認後（confirm→ダウンロード）の両方で主要操作を無効化
  - 「再読込」で親 `reload()` → Modal は choose ステップへ戻す・**検索入力は保持**
  - 再読込後、存在しなくなった選択 `buildId` を落として件数を通知（`droppedCount`）
  - 新しく追加されたビルドを**勝手に選択しない**
- My Team・スカッドはエクスポート対象外のため、それらの更新をダウンロード競合として扱わない。
  一覧の「使用中/未使用」ラベルは参考表示で、エクスポート内容には**含めない**。

---

## 9. UI・アクセシビリティ

- 既存 `Modal`（フォーカストラップ・Esc・フォーカス復帰・`role="dialog"` `aria-modal`）を使用。
  ネストした Modal は作らず、1 つの Modal 内で choose / confirm / done の 3 ステップ。
- `BuildExportLauncher` は My Builds 上部（保存ビルド 0 件の空状態でも）に「保存ビルドを書き出す」ボタン
  ＋固定説明（ローカル JSON・サーバー/外部へ送信しない・書き出しても保存ビルドは変更されない・
  全件/選択）。保存ビルド 0 件・localStorage 不可のときボタンは無効＋理由表示。
- 選択リストの各行はチェックボックスに `aria-label`（「〈ビルド名〉（〈選手名〉）を書き出しに含める」）。
- 選択件数は `role="status"` `aria-live="polite"` で読み上げ。
- 成功通知は `aria-live="polite"`、失敗・競合は `role="alert"`。
- 現行/旧規則・使用中/未使用は色だけでなく `Badge` の文字ラベルを併記。
- 主要操作（次へ / ダウンロード / 閉じる）は `Button size="md"`（高さ 40px）。
- ダークテーマ・既存コンポーネント（`Modal` / `Button` / `Badge` / `Surface` / `EmptyState`）を再利用。
- 追加アニメーションなし（`prefers-reduced-motion` で問題になる新規モーションを入れていない）。
- ダウンロード開始は done ステップの文言で通知。

---

## 10. テスト結果

### Unit（新規 2 ファイル・計 40 件）

**`src/lib/progression/build-export.test.ts`（34 件）**
- 構築: 0 件 empty / 1・複数・全件 / itemCount 一致 / format・formatVersion 固定（rulesVersion・
  schemaVersion と別物）/ 重複 buildId 除去 / 決定的並び順（入力順非依存・json 一致）/ 元配列不変 /
  JSON 再パース・日本語ビルド名 UTF-8 保持 / 大きな worldCardId の文字列保持 / 配分・PoM 指定・
  実験的試算・calculatedOvr null 保持 / conditionalBoosterSelections 未指定はキーを出さない
- データ除外: SavedBuild にない同名フィールド（selectedBuildId / favoriteBuildId / ownershipStatus /
  usageStatus / tags / note / savedBuildId / teamCardId / localRecordId / deletedAt / syncStatus）を
  混ぜても出力に含めない / トップレベルキーは 6 つだけ / 環境情報・server.pid・パスの語を含まない
- スキーマ検証: 全件有効 / 1 件無効で全体停止 / 複数中 1 件無効でも全体停止 / エラーは安全な ID のみ
  （内容全文・localStorage を出さない）/ safeBuildRef の正規表現 / 無効ビルドの入力不変（修復・削除しない）
- 全件競合: 追加 / 削除 / 差し替えで conflict
- 選択再検証: 1・複数件変化なしで ok / 0 件 empty / 重複 buildId を畳む / 削除で removed /
  updatedAt 変化で changed / worldCardId 変化で changed（文字列一致）/ 名前変更（updatedAt も変わる）で changed
- ファイル名: 既定形式（UTC）/ 禁止文字・空白・制御文字なし / 同一秒でもミリ秒で区別 / 不正 Date でフォールバック
- 正規化・直列化: レコードキーソート・フィールド順固定 / 2 スペースインデント・BOM なし・再パース可 /
  dedupe・sort が非破壊

**`src/lib/browser-download.test.ts`（6 件）**
- window 不在で `{ ok:false, reason:"ssr" }` / `URL.createObjectURL` なしで ssr /
  ブラウザー相当環境で Blob 生成・`a[download]` クリック・要素除去・後で Object URL 解放 /
  複数回呼んでも Object URL を残さない / createObjectURL 例外で `{ ok:false, reason:"error" }` /
  ダウンロード内容を console へ出さない

### `npm run verify`（最終）
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`・stale 0・未許可 0） |
| `npm run typecheck`（tsc --noEmit） | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`。`next lint` 廃止予告のみ・Warning に数えない） |
| `npm run test`（vitest run） | **934 / 934 PASS**（48 テストファイル） |

### `npm run build`（最終・`next dev` 停止後）
PASS（全 26 ルート。`/my-builds` は Static・19 kB / First Load 164 kB）。

### ブラックボックス（全13レール・`next start` 上・合計 674 / 674 PASS）
| レール | 件数 |
|---|---|
| my-builds（＋My Team 連携＋`/build-inventory` SSR ＋旧規則ガイド ＋**ローカル JSON エクスポート**） | **67** |
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
| **合計** | **674** |

`black-box-my-builds` 追加 10 件（`/my-builds` SSR）: 「保存ビルドを書き出す」入口 / ローカル JSON 説明 /
サーバー・外部へ送信しない説明 / 書き出しても元データを変更しない説明 / 全件・選択の両方に触れる /
インポート・読み込みを同時実装していない / `input type=file` がない / 自動上書き・一括削除を謳わない /
架空ポジション別 OVR を断定表示しない / server.pid・dev-err.log・環境変数を含まない。
動的なファイルダウンロード・競合処理・スキーマ検証は Unit テストで担保（14 番目のレールは作らない）。

### HTTP 200（`next start`）
`/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/squads/sq_blackbox0001`（soft 404）
`/squads/compare` `/players/world/89138556575063` `/compare?ids=…` `/favorites` `/managers`
`/api/managers` `/api/world/players/89138556575063` `/api/world/players/by-ids?ids=…` → すべて 200。
`Cannot find module './NNN.js'` / `readlink EINVAL` / `UNKNOWN read` なし。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。**書き込み 0。**

---

## 11. Node 停止 PID とコマンド / 起動 PID と親子関係 / server.pid / dev-err.log

### 最終品質ゲート中の Node 操作
| 局面 | 操作 | PID / コマンド |
|---|---|---|
| 開始時の `next dev` | 停止前検証 | 親 38192 相当（記録 27248・当時）→ 実測 親 27248 / リスナー 30472（27248 の子）/ cmdline に `C:\Development\eFootball-Team-AI` |
| dev 停止 | `Stop-Process -Id 30472 -Force` → `Stop-Process -Id 27248 -Force` → `Stop-Process -Id 31496 -Force`（npm ラッパー） | ポート 3000 FREE・node 0 を確認 |
| build 前 | `./data/server.pid` → `0`（ASCII・改行なし） | |
| build | `npm run build` | PASS |
| start | `npm run start -- -p 3000` | npm ラッパー 21200 / `next start` 親 35996 / リスナー 34104 |
| 全13ブラックボックス・SQLite | `next start` 上で実行 | 674/674 PASS / integrity ok |
| start 停止 | `Stop-Process -Id 34104 -Force` → `Stop-Process -Id 35996 -Force` → `Stop-Process -Id 21200 -Force` | ポート 3000 FREE・node 0 を確認 |
| dev 再起動 | `npm run dev` | npm ラッパー 20004 / **`next dev` 親 38192** / **リスナー 36996（38192 の子）** |
| server.pid | `38192` を書き込み（ASCII・改行なし）・`od -c` で確認 | |
| dev ページ再確認 | `/` `/my-builds` `/build-inventory` `/my-team` `/squads` `/api/world/players/by-ids` `/api/managers` | すべて 200 |
| `./data/dev-err.log` | 0 行（クリーン） | |

Node 一括停止・PID 未確認停止・stale PID のみの停止・プレースホルダー PID は使用していない。

### 現在のサーバー状態（引き継ぎ）
- `next dev` 稼働中: 親 PID **38192** / ポート 3000 リスナー PID **36996**（38192 の子孫）
- `./data/server.pid` = `38192`（ASCII・改行なし）
- `./data/dev-err.log` = 0 行
- `http://localhost:3000` の主要ページ・API = 200

PID は再利用され得るため、次回操作前に `docs/safe-build-and-cache-policy.md` §7 の全項目を再検証すること。

---

## 12. フィールド単位の変更 / 変更されなかったデータ

### 変更したもの
- `src/lib/progression/build-storage.ts`: `savedBuildSchema` に `export` を付与（**シンボルの可視性のみ**）。
  スキーマの `z.object({...})` の中身・`BUILD_SCHEMA_VERSION` は不変。
- `src/components/progression/MyBuildsView.tsx`: JSX に `<BuildExportLauncher>` を 2 か所追加。
  既存の state・ハンドラ・storage リスナー・レンダリングロジックは不変。

### 変更していないもの（明示）
- `SavedBuild` / `MyTeamRecord` / `StoredSquad` / `StoredSlot` / `StoredSub` スキーマ・`storageVersion` /
  `schemaVersion` / `rulesVersion` の定義: **不変**
- localStorage キー: 追加・改名なし（エクスポート形式を localStorage に保存しない）
- 保存ビルドの `buildId` / `worldCardId` / `progressionAllocation` / `selectedPlayerBooster` /
  `conditionalBoosterSelections` / `calculatedStats` / `calculatedOvr` / `updatedAt` / `createdAt`:
  **1 バイトも書き換えていない**（エクスポートは読み取りと変換のみ）
- My Team（`selectedBuildId` / `favoriteBuildId` / `ownershipStatus` / `usageStatus` / `tags` / `note`）:
  **不変**（読みもしない）
- スカッド（配置・座標・キャプテン・セットプレー・監督・`savedBuildId`）: **不変**
- カード自体のお気に入り（`favorites` ストレージ）: **不変**
- SQLite（`./data/efootball.db`）: 読み取りのみ・`integrity_check` ok・全件一致
- URL パラメーター形式（`ids` / `b` / `m` / `tp` / `al`）: 新パラメータなし・新ルートなし
- 計算エンジン（`calculateBuild` / `buildComparison` / fixed booster / fixed 型推定 /
  Power of Many 計算 / 監督補正）: **不変**。Power of Many の未指定を最大値扱いしていない。
- ポジション別 OVR: 未実装のまま。表示は「総合値（ポジション別 OVR）: —（計算規則を確認中）」。
  架空 OVR 0 件。
- 新規 npm 依存: 0 / 外部アクセス: 0 / ファイル削除: 0 / `.next` への手動変更: 0

---

## 13. 発生したバグと修正（この報告内で完結）

1. **`build-export.ts` 初版のファイル名検査正規表現でファイル書き込みに NUL バイトが混入**
   （`grep -aP '\x00'` で検出・`UNSAFE_FILENAME_RE` の char class 行）。
   許可文字ホワイトリスト方式 `SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/` に書き換えて解消。NUL なしを確認。
   アプリの挙動には影響していない（typecheck 前に修正）。
2. **`build-export.test.ts` の型エラー** `TS2352: Conversion of type 'SavedBuild' to 'Record<string, unknown>'`。
   `as unknown as Record<string, unknown>` に修正。
3. **`BuildExportModal.tsx` が存在しない `sortExportBuildsForList` を import**（`my-builds.ts` に無い）。
   `build-export.ts` の `sortExportBuilds` に統一。

いずれも最終品質ゲート前に解消済み。ゲート本体の FAIL は 0。

---

## 14. 未解決問題

**なし。** 完了条件（機能・データ保護・品質）をすべて満たしている。

---

## 15. 人間の目視確認項目（推奨）

- 実ブラウザーで `/my-builds` を開き、保存ビルドがある状態で「保存ビルドを書き出す」→「すべて」→
  「次へ」→「JSON をダウンロード」で JSON がダウンロードされること。ファイル名が
  `efootball-team-ai-builds-YYYY-MM-DD-HHMMSS-mmmZ.json` 形式で、中身の `exportedAt` が同じ UTC 時刻であること。
- 「選択」で数件チェック → ダウンロードした JSON の `itemCount` と `builds.length` が選択数と一致し、
  My Team のメモ・タグ・`selectedBuildId` 等が含まれないこと。
- ダウンロード前に別タブで保存ビルドを 1 件削除・リネーム → 「JSON をダウンロード」で競合警告が出て
  ダウンロードされないこと。「再読込」で choose ステップに戻り検索語が残ること。
- モバイル幅（375 / 430 / 768px）と PC 幅（1024 / 1280 / 1440 / 1920px）で Modal と選択リストが
  横スクロールを起こさず操作できること。
- キーボードのみで Modal を開閉（Esc）・タブ移動（フォーカストラップ）・チェックボックス操作ができ、
  閉じたときにフォーカスがボタンへ戻ること。
- ダウンロードした JSON を再度 `JSON.parse` できること（将来のインポート実装の前提）。

---

## 16. 次に推奨する単独マイルストーン（候補・今回は着手しない）

- 保存ビルドの **JSON インポート**（今回定義した `format` / `formatVersion` を厳格に検証・
  `buildId` 衝突時の扱いをユーザーに選ばせる・既存ビルドを上書きしない既定・プレビュー必須）。
  ※ インポートは認証・クラウド同期とは独立した単独マイルストーンにする。
- エクスポート形式のドキュメント（`docs/` にスキーマ仕様を独立記載し、インポート実装の契約にする）。
