# マイルストーン完了報告: 保存ビルドエクスポートの保存場所選択

- 実施日: 2026-09-05
- 対象: My Builds「保存ビルドを書き出す」（`BuildExportModal.tsx`）
- 種別: 既存エクスポート機能の**保存方法**だけを拡張。JSON 形式・対象・競合検証は不変。
- 正本ワークスペース: `C:\Development\eFootball-Team-AI`（OneDrive 同期対象外）
- 総合判定: **完了**

---

## 1. 目的

保存ビルド JSON のエクスポート時、対応ブラウザーではユーザーが保存場所を選択できるようにする。現状 JSON
ファイルがデスクトップへ保存される環境があるため、保存操作時にファイル保存ダイアログを表示し、ユーザーへ
Windows の「ドキュメント」フォルダーを保存先として選ぶよう明確に案内する。非対応環境・拒否時・例外時は、
既存の Blob + `download` 属性によるローカルダウンロードへ安全にフォールバックする。

---

## 2. Web アプリから保存先を強制できない理由

ブラウザーのセキュリティモデル上、Web ページ（JavaScript）は OS のファイルシステムへ直接アクセスできない。
File System Access API（`showSaveFilePicker`）は**必ずユーザー操作（クリック等）から呼び出す必要があり**、
呼び出すと**ブラウザーネイティブの保存ダイアログ**が開く。このダイアログの初期表示・最終的な保存先は
**ブラウザーと OS が管理し、ユーザーが都度選択する**。Web ページ側は次を一切できない:

- Windows のユーザー名・プロファイルパスの取得
- `C:\Users\<name>\Documents` のような絶対パスの構築・埋め込み
- ダイアログを経由しない書き込み（`showSaveFilePicker` を使わない代替経路は存在しない）
- ダイアログの初期フォルダーを絶対パスで強制指定（`startIn` は下記 §3 の**列挙値**のみを受け付ける）
- ユーザーがダイアログでキャンセル・別フォルダーを選んだ場合の上書き

したがって、本実装は**保存ダイアログを開いて「ドキュメント」フォルダーを選ぶよう案内する**ことまでしかできず、
「必ずドキュメントへ保存される」という断定はできない（そのためユーザー向け文言でも断定していない）。

---

## 3. `showSaveFilePicker` の使用条件（`src/lib/browser-save-file.ts`）

```ts
const handle = await showSaveFilePicker({
  suggestedName: filename,                 // 既存 buildExportFilename の値そのまま
  types: [{ description: "JSON ファイル", accept: { "application/json": [".json"] } }],
  startIn: "documents",                    // OS 標準の「候補ディレクトリ」列挙値。絶対パスではない
});
const writable = await handle.createWritable();
await writable.write(text);
await writable.close();
```

- **`suggestedName`**: 既存 `buildExportFilename(now)`（`build-export.ts`・無変更）の戻り値をそのまま渡す。
  ファイル名生成ロジックには一切手を加えていない。
- **MIME type / 拡張子**: `types: [{ accept: { "application/json": [".json"] } }]` を明示。ピッカーの
  ファイル種類フィルターに「JSON ファイル」という説明を表示する。
- **`startIn: "documents"`**: File System Access API 仕様が定める **`WellKnownDirectory` 列挙値**
  （`"desktop" | "documents" | "downloads" | "music" | "pictures" | "videos"`）の 1 つ。**絶対パスではなく、
  ブラウザーが解釈する記号的なヒント**であり、コードは実際のディレクトリパスを一切知らない・扱わない。
  ユーザーはダイアログ内で自由に別の場所へ移動でき、この値を渡しても最終決定はユーザーに委ねられる。
  今回は「ドキュメントフォルダーを選ぶよう案内する」という目的に直接合致するため採用したが、確認画面の
  文言では**断定せず**「選択画面が表示されたらドキュメントを選んでください」という案内にとどめている。
  ブラウザーによっては `startIn` を無視する可能性があるため、それも断定を避ける理由の一つ。
- **ユーザーキャンセル**: `showSaveFilePicker` の呼び出し自体、または表示中にユーザーがキャンセルすると
  `DOMException`（`name === "AbortError"`）が投げられる。`isAbortError()` で判定し
  `{ ok:false, reason:"cancelled", method:"picker" }` を返す。**エラーとして表示しない**・**成功として
  表示しない**（保存ビルド自体は何も変更していないため、単に確認画面へ留まり中立的な案内を出す）。
- **`write` / `close`**: `write` が失敗したら `close` を試みたうえで（結果に関わらず）`reason:"error"`。
  `write` が成功しても `close` が失敗したら `reason:"error"`（`close` 完了＝ディスクへの確定を意味するため、
  `close` が失敗した時点で成功とは言えない）。**成功（`ok:true`）は `write` と `close` の両方が完了した
  ときだけ**返す。
- **ユーザー操作からの直接呼び出し**: `BuildExportModal` の「保存場所を選ぶ」ボタンの `onClick` から
  `doDownload()`（`async` 関数）を呼び、その内部で**最初の `await` より前に**（同期的な検証処理の直後に）
  `saveTextFile(...)` を呼び出す。`saveTextFile` 内でも `showSaveFilePicker` は関数内の最初の非同期操作
  として即座に呼ばれるため、ユーザーアクティベーションは維持される。
- **ファイルハンドルの非永続化**: `handle` / `writable` は `saveTextFile` 関数のローカル変数としてのみ
  存在し、呼び出し元にも返さない。localStorage・IndexedDB・グローバル変数・React state のいずれにも
  保存しない（Unit テストで `localStorage.setItem` / `indexedDB.open` が呼ばれないことを確認）。
- **ディレクトリ権限**: `showDirectoryPicker` は使用しない。`showSaveFilePicker` は単一ファイルの書き込み
  許可のみをユーザーに求める（ブラウザーの標準権限モデルの範囲内・回避なし）。

---

## 4. 非対応時のフォールバック

`isSaveFilePickerSupported()`（`typeof window.showSaveFilePicker === "function"` の同期チェック）が
`false`、または `showSaveFilePicker` が存在しても `AbortError` 以外の例外を投げた場合、**その場では
Blob ダウンロードへ切り替えない**（§5 参照）。`isSaveFilePickerSupported()` が最初から `false` の環境
（Safari・旧 Firefox 等）でのみ、既存 `downloadTextFile(filename, text, mimeType)`
（`src/lib/browser-download.ts`・**無変更**）をそのまま呼び出す（`method:"download"`）。

- Blob 生成・`URL.createObjectURL`・一時 `<a download>`・クリック後の要素除去・10 秒後の
  `URL.revokeObjectURL` は既存実装のまま（今回の変更対象外）。
- SSR / hydration 前（`window` 不在）は `saveTextFile` の最上部で `{ ok:false, reason:"ssr", method:"picker" }`
  を返し、ピッカーもフォールバックも試みない。
- `document` / `URL.createObjectURL` 不在時は、フォールバック経路の `downloadTextFile` 自身が
  `{ ok:false, reason:"ssr" }` を返す（この場合 `saveTextFile` の戻り値は `method:"download"` のまま
  `reason:"ssr"` を透過する）。
- フォールバックしたことは、成功画面で「このブラウザーは保存場所の選択に対応していないため、通常の
  ダウンロード先へ保存しました」として案内する（完了要件 21）。

---

## 5. Object URL の扱い / SSR 安全性

- ピッカー経路は Blob も Object URL も使わない（`FileSystemWritableFileStream.write(text)` へ文字列を
  直接渡す）。Object URL の生成・解放が発生するのは**フォールバック経路のみ**で、そこは既存
  `downloadTextFile` の実装（Blob 生成 → `URL.createObjectURL` → クリック → 一時要素の同期除去 →
  10 秒後 `revokeObjectURL`）をそのまま再利用する。今回の変更でこの経路のコードには一切触れていない。
- `saveTextFile` は関数の最上部で `typeof window === "undefined"` を確認し、SSR / hydration 前は
  即座に安全な失敗を返す。ピッカー分岐でも `getPicker()` が `window` の存在を再確認してから
  `window.showSaveFilePicker` を参照する。

---

## 6. Documents 絶対パスを使用していないこと / ファイルハンドルを永続化していないこと

- コード中に `C:\Users\...\Documents` のような絶対パス文字列は**存在しない**（`grep` で確認済み）。
- Windows のユーザー名取得・ファイルシステム列挙・ドキュメントフォルダーの無断オープンは行っていない。
- `startIn: "documents"` は上記 §3 のとおり列挙値であり、絶対パスへの変換・推測は行っていない。
- `FileSystemFileHandle` / `FileSystemWritableFileStream` はいずれも `saveTextFile` 関数内のローカル
  変数としてのみ存在し、関数を抜けると破棄される。React state・module スコープ変数・localStorage・
  IndexedDB のいずれにも保持しない（Unit テストで確認）。
- サーバー API は新設していない。Node.js・PowerShell からユーザーの Documents へ直接書き込む処理も
  実装していない（このマイルストーンはブラウザー内の UI 拡張のみ）。

---

## 7. JSON 形式が不変であること

以下はすべて**無変更**（`src/lib/progression/build-export.ts` は 1 行も編集していない）:

- `format`（固定文字列）/ `formatVersion`（固定 `"1"`）/ `app` / `exportedAt`（UTC ISO 8601）/ `itemCount`
  （`builds.length` と一致）
- 出力される `SavedBuild` フィールド（`buildId` / `worldCardId` / `buildName` / `progressionAllocation` /
  `selectedPlayerBooster` / `conditionalBoosterSelections` / `calculatedStats` / `calculatedOvr` /
  `calculationMode` / `rulesVersion` / `createdAt` / `updatedAt` / `schemaVersion`）
- 決定的な並び順（`updatedAt` 降順 → `buildId` 昇順）・レコードキーのソート
- UTF-8・BOM なし・`JSON.stringify(file, null, 2)` の 2 スペース整形
- 全件エクスポート・選択エクスポートの両モード、選択 0 件拒否、無効ビルドで全体停止、`buildExportFilename`
  によるファイル名生成
- 保存直前の再検証（`reconcileAllExport` / `reconcileSelectionExport` による対象集合・`worldCardId`・
  `updatedAt`・スキーマの再確認）と競合時の非保存・`role="alert"` 通知・手動再読込

変更したのは「検証済みの JSON 文字列と決定したファイル名を**どうやってユーザーへ渡すか**」という**保存方法**
だけであり、`buildExport()` / `reconcileAllExport()` / `reconcileSelectionExport()` / `buildExportFilename()`
の呼び出し順序・引数・戻り値は一切変えていない。

---

## 8. UI（`BuildExportModal.tsx`）

- **入口の常時表示説明**（`BuildExportLauncher`・SSR 可視）に追記: 「対応ブラウザーでは保存場所の選択画面が
  表示されます（Windows の『ドキュメント』フォルダーを選ぶことをおすすめします）。非対応の場合は通常の
  ダウンロード先へ保存します。」
- **confirm ステップ**に「保存場所について」ボックスを追加。対応ブラウザーでは:
  「保存場所の選択画面が表示されたら、Windows の『ドキュメント』フォルダーを選択してください。」＋
  箇条書き（保存先はユーザー自身が選択／アプリが無断で固定しない／外部送信なし／元データ不変／
  キャンセル時は何も保存されない／非対応ブラウザーは通常のダウンロード先）。非対応ブラウザーでは
  その旨の代替文言を表示。「必ずドキュメントへ保存される」とは断定していない。
- 主要ボタンの文言を対応状況で切り替え: 対応ブラウザー「保存場所を選ぶ」／非対応「JSON をダウンロード」。
- **キャンセル時**: `role="status" aria-live="polite"` の中立的な案内（エラーでも成功でもない）を confirm
  ステップに表示し、再試行を促す。
- **done ステップ**: 成功時のみ表示。保存方法がフォールバックだった場合はその旨を追記。
- 既存の choose → confirm → done の 3 ステップ構造・`stale` 別タブ通知・競合再検証・droppedCount 通知は
  無変更。

---

## 9. テスト結果

### Unit（新規 1 ファイル・17 件）

**`src/lib/browser-save-file.test.ts`**
- `isSaveFilePickerSupported`: window 不在 → false／関数あり → true／関数でない・不在 → false
- SSR: window 不在 → `{ ok:false, reason:"ssr", method:"picker" }`
- ピッカー経由: `suggestedName`・MIME type・`.json` 拡張子を正しく渡す／`startIn` を渡す（絶対パスは渡さない）／
  `write` 失敗 → error（`close` は試みる）／`write` 成功・`close` 失敗 → error（成功表示しない）／
  ユーザーキャンセル（プレーンオブジェクトの `AbortError`）→ cancelled／`DOMException` の `AbortError` も
  cancelled／`AbortError` 以外の例外は error（キャンセルと誤表示しない）／`createWritable` 例外 → error／
  ファイルハンドルをどこにも永続化しない（`localStorage.setItem` / `indexedDB.open` 未呼び出しを確認）／
  ファイル内容を console へ出さない
- フォールバック: `showSaveFilePicker` なし → 既存方式・クリック実行・ファイル名一致／URL API 不在 → ssr／
  `document` 不在 → ssr／Blob 生成例外 → error

### `npm run verify`（最終）
| 検査 | 結果 |
|---|---|
| `npm run audit:ja-labels` | PASS（allowlist 1 = `GroupRow.tsx` の `{group.nameEn}`） |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS（`✔ No ESLint warnings or errors`） |
| `npm run test`（vitest run） | **1048 / 1048 PASS**（52 テストファイル） |

### `npm run build`
PASS（全 26 ルート。`/my-builds` は Static・25.8 kB / First Load 172 kB）。

### ブラックボックス（全13レール・`next start` 上・合計 705 / 705 PASS）
| レール | 件数 |
|---|---|
| my-builds（＋…＋保存場所選択） | **98**（95 → 98） |
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
| **合計** | **705** |

`black-box-my-builds` 追加 3 件: 対応ブラウザーで保存場所の選択画面が表示される旨とドキュメントフォルダーの
案内／非対応ブラウザーは通常のダウンロード先へ保存する旨／「必ずドキュメントへ保存される」と断定していない
こと。本マイルストーンのプロンプトには専用の「ブラックボックス」節が無かったため 14 番目のレールは作らず、
既存 `black-box-my-builds` へ軽量に統合するにとどめた（動的な `showSaveFilePicker` 呼び出し・
write/close/AbortError 処理は Unit テストで担保）。

### HTTP 200（`next start`）
`/` `/build-inventory` `/my-builds` `/my-team` `/squads` `/squads/sq_blackbox0001`（soft 404）`/squads/compare`
`/players/world/89138556575063` `/compare?ids=…` `/favorites` `/managers` `/api/managers`
`/api/world/players/89138556575063` `/api/world/players/by-ids?ids=…` → すべて 200。

### SQLite `integrity_check`
**ok**。`world_player_cards` 13,009 / `managers` 66 / `player_index_entries` 47,479 /
`player_cards` 19 / `player_booster_definitions` 44 — すべて一致。**書き込み 0**（この機能は SQLite に触れない）。

---

## 10. 作成・編集・削除ファイル

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/browser-save-file.ts` | `showSaveFilePicker` 経由の保存 ＋ 既存 `downloadTextFile` へのフォールバック |
| `src/lib/browser-save-file.test.ts` | Unit テスト 17 件 |
| `docs/milestones/2026-09-05-saved-build-export-location.md` | 本報告 |

### 編集（最小差分）
| ファイル | 変更 |
|---|---|
| `src/components/progression/BuildExportModal.tsx` | `downloadTextFile` 直接呼び出しを `saveTextFile` 経由へ変更。`doDownload` を `async` 化。保存場所の説明・キャンセル通知・ボタン文言の条件分岐を追加。choose/confirm/done の構造・競合再検証・エクスポート形式ロジックは不変。 |
| `scripts/black-box-my-builds.mjs` | 保存場所の案内文言チェックを 3 件追加。 |
| `docs/my-builds.md` | エクスポート節に「保存場所の選択」小節を追加。 |
| `docs/progress.md` | 2026-09-05 の日付エントリを追加。 |
| `docs/project-baseline.md` | unit 1031→1048、ブラックボックス 702→705、my-builds レール 95→98、直近サーバー PID、実装済み機能一覧、直前マイルストーン名を更新。 |
| `docs/milestones/README.md` | 一覧に本報告を追加。 |

### 削除
なし。`src/lib/browser-download.ts` / `src/lib/progression/build-export.ts` は**一切変更していない**
（`downloadTextFile` は今もフォールバック用として直接呼ばれる。エクスポート形式・競合再検証ロジックは無変更）。

---

## 11. Node 停止 PID とコマンド / 起動 PID と親子関係 / server.pid / dev-err.log

| 局面 | 操作 | PID / コマンド |
|---|---|---|
| 開始時の `next dev` | 停止前検証 | 親 33252（cmdline に `C:\Development\eFootball-Team-AI`）/ リスナー 28848（33252 の子）/ server.pid=33252 一致 |
| dev 停止 | `Stop-Process -Id 28848 -Force` → `Stop-Process -Id 33252 -Force` | 両 PID 消滅を確認。ポート 3000 は一時的に TIME_WAIT/FIN_WAIT2 の残存のみ（LISTEN 状態は無し）を確認してから続行 |
| build 前 | `./data/server.pid` → `0`（ASCII・改行なし） | |
| build | `npm run build` | PASS |
| start | `npm run start -- -p 3000` | npm ラッパー 33748 / `next start` リスナー 10452（cmdline に `C:\Development\eFootball-Team-AI`） |
| 全13ブラックボックス・SQLite | `next start` 上で実行 | 705/705 PASS / integrity ok |
| start 停止 | `Stop-Process -Id 10452 -Force` | ポート 3000 LISTEN 無し（FREE）を確認 |
| dev 再起動 | `npm run dev` | npm ラッパー 23448 / **`next dev` 親 13996** / **リスナー 28108（13996 の子）** |
| server.pid | `13996` を書き込み（ASCII・改行なし）・`od -c` で確認 | |
| dev ページ再確認 | `/` `/my-builds` `/build-inventory` `/my-team` `/squads` `/api/world/players/by-ids` `/api/managers` | すべて 200 |
| `./data/dev-err.log` | 0 行（クリーン） | |

同一 PC の別プロジェクトの Node プロセスには触れていない（今回は検出されなかったが、停止対象は
コマンドラインに `C:\Development\eFootball-Team-AI` を含む PID のみに限定する方針を継続）。

### 現在のサーバー状態（引き継ぎ）
- `next dev` 稼働中: 親 PID **13996** / ポート 3000 リスナー PID **28108**（13996 の子孫）
- `./data/server.pid` = `13996`（ASCII・改行なし）
- `./data/dev-err.log` = 0 行
- `http://localhost:3000` の主要ページ・API = 200

---

## 12. 未解決問題

**なし。** 完了条件（保存場所選択・案内・フォールバック・キャンセル処理・JSON 形式不変・品質ゲート）を
すべて満たしている。

---

## 13. 人間の目視確認項目（推奨・実ブラウザーでのみ確認可能）

- **Chromium 系ブラウザー（Chrome / Edge）** で `/my-builds` →「保存ビルドを書き出す」→ 内容確認 →
  「保存場所を選ぶ」を押すと、OS 標準のファイル保存ダイアログが表示され、初期フォルダーが「ドキュメント」
  付近になっていること（`startIn` はブラウザー・OS の設定により無視される場合がある点に留意）。
  任意の場所（例: デスクトップ）へ変更して保存できること。
- ダイアログで「キャンセル」を押すと、エラー表示も成功表示もされず、「保存場所の選択をキャンセルしました」
  という中立的な案内が出て、確認画面に留まること。もう一度押せばやり直せること。
- 保存後、ダウンロードした（保存した）JSON の内容が既存エクスポートと同じ形式（`format` / `formatVersion` /
  `itemCount` / フィールド）であること。
- **Safari など `showSaveFilePicker` 非対応ブラウザー**で同じ操作を行うと、保存場所選択画面は出ず、
  従来どおりダウンロードフォルダーへ保存され、完了画面に「このブラウザーは保存場所の選択に対応していない
  ため、通常のダウンロード先へ保存しました」と表示されること。
- キーボードのみで Modal の開閉（Esc）・ボタン操作ができ、フォーカスが適切に戻ること。
- 375〜1920px の各幅で「保存場所について」の説明ボックスが横スクロールなく読めること。

---

## 14. 次に推奨する単独マイルストーン（候補・今回は着手しない）

- インポート側（ファイル選択）にも File System Access API の `showOpenFilePicker` を使った選択 UX 改善を
  検討する余地があるが、既存の `<input type="file">` は十分に機能しており、優先度は低い。
- `startIn` のブラウザー対応状況を継続的に確認し、必要なら案内文言を調整する。
