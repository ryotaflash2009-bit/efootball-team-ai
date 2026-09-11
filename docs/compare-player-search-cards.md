# 選手比較（/compare）: カード画像付き検索結果

実施日: 2026-08-31 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除なし

## 目的

`/compare` の「＋ N人目へ選手を追加」検索を、文字中心の細い行から **カード画像付きの検索結果** へ改善し、
同名選手の別カード（別 worldCardId）を画像・カードタイプ・登録ポジション・最大 OVR・World ID・
付属ブースターで判別できるようにする。表示部分はスカッド選手検索で完成した実装を再利用し、
比較専用に複製しない。既存の比較計算・URL・監督・育成・ブースター計算には一切触れない。

## 共通化

- **純関数 `./src/lib/world/search-card.ts`**（スカッド検索 / 比較検索で共通）:
  - `buildPlayerSearchCardView(player): PlayerSearchCardView` — 表示名（nameJa→nameEn→フォールバック）、
    `ovr`（`ovrMax` 優先・無ければ `ovrBase`・両方 null なら null・**0 を欠損扱いしない**）、
    `teamLine`（team · nationality）、`imageSources`（既存 `resolveCardImageSources` 再利用）、`imageAlt`、
    `identityLabel`（同名別カード識別・aria 用: カードタイプ / ポジション / 最大OVR / World ID）、`boosterChips`。
    **欠損値は別カードから補完しない（null のまま）。**
  - `boosterChipsForCard(card)` — `search-results.ts` からここへ移動（`SearchBoosterChip`）。
    fixed は `provisional: boolean`（＝「固定型（推定）」）を持つ。pom は名前 + 最大レベル。ID あり対応表なし → `unresolved`。
  - `./src/lib/squad/search-results.ts` は後方互換のため `boosterChipsForCard` / `buildPlayerSearchCardView` /
    型を再エクスポート（既存の import・テストは変更不要）。`sortSearchResults` はそのまま。
- **表示コンポーネント `./src/components/world/WorldPlayerSearchCard.tsx`**（共通・`<li>` を描画）:
  カード画像（左）+ 名前 / 英語名 / OVR / バッジ（ポジション・カードタイプ）/ 最大 OVR / Lv上限 /
  チーム・国籍 / World ID・プレースタイル / ブースターチップ / アクションチップ + 詳細リンク（`z-10`・前面）。
  カード全体が 1 個の `<button>`（`absolute inset-0`）で `onPick`。`disabled` + `disabledReason`（文字）。
  色だけでブースター発動方式を断定しない（必ず文字ラベル + `title`）。画像は `WorldCardImage` が
  取得失敗時に `PlayerSilhouette` へフォールバック（追加は可能）。
- `./src/components/squad/SquadPlayerSearchCard.tsx` は `WorldPlayerSearchCard` の薄いラッパー
  （`duplicate` / `duplicateWhere` / `targetLabel` → 共通 props へマッピング）。`PlayerSearchPanel` は無変更。

## 画面固有（比較検索）— `./src/components/compare/AddPlayerSearch.tsx`（全面書き換え）

- コントロールされたパネル（開閉は `ComparisonBoard` が管理）。プロップ:
  `existingIds: string[]` / `targetIndex: number`（0 始まり・表示は +1 人目）/
  `onAdd: (id) => Promise<boolean>` / `onClose: () => void`。
- ヘッダー「N人目に追加するカードを選択」。検索 input（`aria-label`・最小 2 文字・`pageSize=20`・`sort=ovr_max_desc`）。
- 状態分離（`aria-live="polite"`）: idle / tooShort / loading（Skeleton グリッド）/ error（`role="alert"` + 再試行）/
  results（件数 + `WorldPlayerSearchCard` グリッド `sm:grid-cols-2 xl:grid-cols-3` `max-h-[55vh]` 内部スクロール）。
- **古いレスポンス破棄**: `reqIdRef`（スカッド検索と同方式）。debounce 300ms。
- 並び: `sortSearchResults(players, q, null)`（名前完全一致 → API の OVR 降順 → World ID 安定・再ソート最小）。
- 各カード: `disabled = existingIds に含む || 追加処理中`。理由「比較に追加済み」/「追加処理中」を文字表示。
  `actionLabel = "N人目へ追加"`（追加中は「追加中…」）。
- `onPick`: `const ok = await onAdd(id); ok ? onClose() : パネル維持 + role="alert" エラー`。
- **Escape** でパネルを閉じる → `ComparisonBoard.closeSearch` が `requestAnimationFrame` で元の「＋」ボタンへフォーカスを戻す。

## `./src/components/compare/ComparisonBoard.tsx`（最小変更）

- `addPlayer` を `async (worldCardId): Promise<boolean>` へ（成功 `true` / 失敗 `false`・`setAddError` は維持・
  `encodeURIComponent(worldCardId)`・**worldCardId は文字列のまま比較**・`Number()` しない）。
- `searchOpen` state + `addTriggerRef` + `closeSearch`（false + rAF フォーカス）。
- 末尾の空きスロット: 旧 `<AddPlayerSearch inline>` → トリガー `<button ref onClick aria-expanded disabled={>=4}>＋ N人目へ選手を追加</button>`。
- グリッド（`overflow-x-auto`）の**下に全幅で** `{searchOpen && players.length < 4 && <AddPlayerSearch ... />}`
  （狭い比較列に押し込めず、カード画像を判別できる幅を確保）。
- 5 人目: `slotsToShow = min(players.length+1, 4)` のため 4 人時は空きスロット 0 → トリガー無し + `searchOpen` ガードで追加不可（既存仕様維持）。

## 維持したもの（変更なし）

最大 4 人 / 26 能力比較 / 育成方針（全員・個別）/ 保存ビルド / fixed booster / fixed 型推定 /
Power of Many / 条件反映後値 / 実験値 / 監督補正（全員・個別・解除）/ 比較順位 / URL 生成・復元
（`serializeComparisonState` / `window.history.replaceState`・`ids` は文字列）/ rulesVersion /
`ComparisonTables` / `PlayerControlColumn`。検索結果側で育成・ブースター・監督計算を複製しない。
ポジション別 OVR は未実装（保存済みカード全体 OVR のみ）。

## テスト

- `./src/lib/world/search-card.test.ts`（11）: 表示名フォールバック、`ovr = ovrMax ?? ovrBase`、
  `0` を欠損扱いしない、`teamLine`、欠損値を補完しない、`identityLabel` の識別情報、
  画像候補なしでも view を返す、World 保存画像 → 同一オリジンプロキシ URL、`boosterChipsForCard`（空 / unresolved / fixed(provisional)・pom）。
- `./src/lib/squad/search-results.test.ts`（9・無変更）: 再エクスポート経由で従来どおり PASS。
- 全 605 単体テスト PASS（+11）。`black-box-compare.mjs` 45/45（+7: 追加トリガー文言・`aria-expanded`・
  検索 API の画像判定フィールド・同名別カードが複数 worldCardId・pageSize 準拠・詳細 API 26 能力値・画像プロキシ 400）。
- 全 12 ブラックボックスレール PASS（回帰なし）。
- コンポーネントの実描画・クリック / Enter / Space / Escape / フォーカス復帰は jsdom 未導入（新規 npm 禁止）のため
  純関数テスト + SSR ブラックボックス + 手動確認で担保。

## 手動確認手順（ブラウザ）

1. `/compare` を開く →「＋ 1人目へ選手を追加」を押す → パネルが全幅で開き「1人目に追加するカードを選択」。
2. 「メッシ」と入力 → 検索中（Skeleton）→ 件数 → 複数の Messi カードがカード画像付きで並ぶ。
   画像・日本語名・英語名・カードタイプ・登録ポジション・最大 OVR・World ID・ブースター（青=固定/固定型推定、金=Power of Many、
   中立=未解決）・「1人目へ追加」チップ・詳細リンクを確認。
3. World ID 89138556575063 のカードを押す → 1人目へ追加 → URL に反映 → パネルが閉じフォーカスが「＋」へ戻る。
4. 「＋ 2人目へ選手を追加」→ 同じ「メッシ」→ 1人目のカードが「比較に追加済み」で disabled。別 worldCardId の Messi を追加（同一人物の別カード比較）。
5. 3 人目・4 人目を追加 → 4 人時は「＋」トリガーが消え 5 人目を追加できない。
6. ページ再読込 → URL から 4 人復元。育成方針・監督・Power of Many を変更 → 比較結果が検索 UI 変更前と一致。
7. 画像が無いカードを検索 → プレースホルダー表示・追加可能。検索失敗を再現 → `role="alert"` + 再試行。
8. Escape で閉じる → フォーカスが「＋」へ戻る。キーボード（Tab → 入力 → Tab → Enter/Space）でカード追加。
9. 375 / 430 / 768 / 1440 / 1920px で横スクロールなし・カード画像が判別できる大きさ。
10. スカッド選手検索（`/squads/{id}` の枠タップ）が従来どおり動作。`.next` 削除なし・OneDrive 警告なし。
