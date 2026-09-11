# スカッド選手検索: カード画像付き結果 + 自動保存状態表示

実施日: 2026-08-30 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし

## 背景

`/squads/{squadId}` の空き枠 → 選手検索は、文字だけの候補一覧だった。
同じ選手に複数カードがあるため選手名だけでは目的のカードを判別できなかった。

## 変更

### 検索結果のカード化（`src/components/squad/`）

- `PlayerSearchPanel.tsx` を全面刷新。結果を `SquadPlayerSearchCard`（新規）のグリッドで表示。
  - PC: `grid lg:grid-cols-2 2xl:grid-cols-3`、モバイル: 1 列。結果は `max-h-[55vh]` 内スクロール。
- `SquadPlayerSearchCard.tsx`（新規）: **既存の画像解決をそのまま再利用**
  （`resolveCardImageSources` + `WorldCardImage`、内部プロキシ画像、`loading="lazy"`、
  失敗時は次候補 → `PlayerSilhouette` プレースホルダー）。外部取得・複製保存なし。
  - 表示: カード画像 / 選手名（JA・EN）/ カードタイプ / 登録ポジション / OVR(最大) /
    Lv上限 / チーム・国籍 / World ID / プレースタイル / 付属ブースター。
  - 画像が無くてもカード名・タイプ・ID で判別でき、追加操作は続行可能。
- 同名判別: 名前でのdedup は**しない**。異なる `worldCardId` は独立した結果として出す。

### ブースター表示（`src/lib/squad/search-results.ts` 新規・純関数）

- `boosterChipsForCard(card)` → `resolveAttachedBooster` で解決:
  - 固定型 = 「青 {name} +N」、Power of Many = 「金 {name} 最大+N」、対応表に無い ID = 「未解決ブースター」。
  - 色だけに依存せず必ず文字ラベル + `title`（証拠の要約）。長文の証拠説明は出さない。

### 並び替え（`sortSearchResults` 純関数）

名前完全一致 → 対象スロットのポジション一致 → API 順（`sort=ovr_max_desc`）→ World ID で安定。
ポジション別 OVR は未確認のため架空の適性評価では並べない。適性データ未収録カードも除外しない。

### 検索状態（§12）

`idle`（2 文字以上入力を促す）/ `tooShort` / `loading`（skeleton・`aria-live`）/
`results`（件数表示）/ 空（「条件に一致するカードがありません。」）/
`error`（「選手を検索できませんでした。」+ 再試行）。
最小 2 文字（全 13,009 件の一括表示を防ぐ）。`reqIdRef` で古いレスポンスを破棄。

### 追加操作 / イベント競合（§10・§11）

- カード全体が「この枠へ追加」ボタン（`absolute inset-0`、重複時 `disabled`）。
  カード本文は `pointer-events-none`。詳細リンクだけ `relative z-10 pointer-events-auto` で前面。
  → `<a>`/`<button>` を追加ボタンにネストしない（インタラクティブ要素のネスト規則順守）。
- 詳細リンクは `target="_blank"`（スカッド編集から離脱しない）。お気に入り/育成ボタンは検索パネルに置かない
  （追加ボタンを埋もれさせないため）。
- 配置成功時のみパネルを閉じる（`placeInSlot`/`addBench` 内）。失敗時は toast で理由表示・パネル維持。

### 自動保存状態の可視化（§21・§25）

- `SquadEditor` に `saveState: "idle" | "saving" | "saved" | "error"` と `savedSquadRef`。
- 初回ロードで `savedSquadRef.current = 読み込んだ squad`（hydration 前に「保存済み」と誤表示しない）。
- 変更検知は参照比較（`squad === savedSquadRef.current` なら未変更 = idle）。
- 自動保存・手動保存・再試行は共通 `runSave()`。成功で `savedSquadRef` 更新 + `"saved"`、失敗で `"error"`。
- ヘッダーの「変更は自動保存されます」を状態連動ラベルに（`aria-live="polite"`、控えめ、Toast にしない）。
  失敗時のみ「保存を再試行」ボタン。既存 `saveSquad` を使用（別ストレージ処理を作らない）。

## 維持したもの（前回修正）

`resolveCard` 自己キャンセル解消 / `requestedCardsRef` / effect deps `[placedIds]` /
`assignWorldCardToSlot` / `addWorldCardToBench` / `squadRef.current` 検証 / 再読込復元 /
未解決カードの読み込み中・取得失敗・再試行表示 / My Team `?card=` 導線 /
部分破損データの安全読込 / `worldCardId` の文字列保持 / 重複防止・別カード許可 /
manager・buildId・Power of Many 設定の保持。選手追加処理は複製していない。

## テスト

- `src/lib/squad/search-results.test.ts`（9件）: 並び替え（名前一致・ポジション一致・安定性・
  適性 null 非除外・同名別カード両残し・空）、ブースターチップ（なし/未解決/解決形）。
- 全 496 単体テスト PASS。`black-box-squads.mjs` 34/34、全 12 ブラックボックスレール PASS、回帰なし。
- 検索結果は client 描画のため SSR ブラックボックスでは検証不可（vitest 純関数 + 手動確認で担保）。

## 手動確認手順（ブラウザ）

1. `/squads` で **テスト用スカッド**を新規作成（4-3-3）。
2. CF/SS/LWF の空き枠をタップ → 検索パネルが開く。
3. 「Messi」と入力（1 文字では「あと 1 文字」表示、2 文字で検索）。
4. 結果に**カード画像**・カードタイプ・OVR・ポジション・World ID・ブースターが出る。
   同名の Messi が複数あれば、それぞれ別カードとして並ぶ。
5. `World ID 89138556575063` のカードをタップ → CF に配置、先発 1/11、平均更新、
   ヘッダーが「保存中…」→「保存済み」。
6. 再読込 → 選手が残る。GK 枠・ベンチでも同様。
7. My Team →「スカッドで使用」→ 一覧で「このカードを追加」→ 編集で空き枠タップ → 配置。
   My Team・お気に入りの記録は変化しない。
8. 375 / 430 / 768 / 1440 / 1920px で横スクロールが出ないこと、画像が判別できる大きさであること。
