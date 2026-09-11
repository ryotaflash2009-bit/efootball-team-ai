# スカッド: Game Plan 風の配置編集（移動・交代・役割）

実施日: 2026-08-30 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除なし

## 目的

実際の eFootball Game Plan に近い操作性:
先発⇔先発の入れ替え、先発⇔ベンチの交代、ベンチの並び替え、キャプテン／セットプレー担当設定。

## 純関数（`src/lib/squad/moves.ts` 新規）

```
type SquadLoc =
  | { area: "starter"; slotId: string }
  | { area: "bench"; index: number };

applySquadMove(squad, from, to, makeSubId): SquadMoveResult
reorderBench(squad, from, to): SquadMoveResult
removeSquadPlayer(squad, loc): SquadMoveResult
```

- 6 ケースを 1 実装で処理: 先発→空き先発 / 先発↔先発 / 先発→空きベンチ末尾 / 先発↔ベンチ /
  ベンチ→空き先発 / ベンチ↔先発 / ベンチ↔ベンチ（並び替え）。
- **カード設定は選手と一緒に移動**: `worldCardId` / `buildMode` / `savedBuildId` / `boosters` /
  `conditionalBoosters`（= Power of Many 段階含む）。空き枠へ移動しても元の枠には残さない。
- **役割（スロット参照）は選手に追従**:
  - 先発→空き先発: `captainSlotId` / `setPieces` / `linkUp` の参照を from → to へ付け替え。
  - 先発↔先発 入れ替え: 参照を from ↔ to で交換。
  - 先発から外れる（ベンチ移動 / ベンチと交代 / removeSquadPlayer）: その枠の役割を**解除**し
    `warnings` で通知（別選手へは移さない・自動選出しない）。
- `errorCode`: `invalid_squad` / `invalid_source` / `invalid_target` / `source_empty` /
  `target_not_found` / `same_location`（no-op 扱い） / `bench_full`。
- 選手を複製・消失させない（常に既存カード集合の並び替え）。

`assign.ts`（追加）と合わせ、UI に移動ロジックを直接書かない（§5）。

## SquadEditor の配線

- `swapSource: string`（先発限定）→ `moveSource: SquadLoc | null`（先発 / ベンチ両対応）。
- `applyMove(from, to)`: `squadRef.current` で検証 → `applySquadMove` → Undo 退避 → `setSquad` →
  `warnings` を toast。移動元は成功/失敗どちらでもクリア。
- 旧 `swapSlots` / `moveSlotToBench` / `promoteSub` / インラインの `removeFromSlot` を撤去し
  `applyMove` / `removeSquadPlayer` へ集約。`reorderBenchAt`（トースト無し）。
- **1 段階 Undo**: `undo: { squad, label }`。配置系操作の直前状態を退避、「元に戻す」で 1 回復元。
  再読込・フォーメーション変更・リセットで破棄（永続化しない）。
- Escape で移動モードをキャンセル（`window` keydown、モード中のみ）。
- ベンチ行の index ズレ対策: `benchRows`（`squad.substitutes` と 1:1、未解決カードでも
  index が動かない。`buildSquad` は未解決 sub をフィルタするため `computed.substitutes` は使わない）。

## 操作方式（PC / モバイル / キーボード）

- **クリック / タップ（主操作）**: 選手（ピッチ枠 or ベンチ行）を選択 →「移動・交代」→
  ピッチ枠 or ベンチ行 or「ここへ（ベンチへ移動）」をタップ。空き＝移動 / 選手あり＝入れ替え。
  移動元をもう一度選ぶとキャンセル。
- **ドラッグ（PC 追加手段）**: HTML5 DnD（新規ライブラリなし）。`draggable` な選手カードを
  `onDragStart` で移動元に、枠 / ベンチ行 / 末尾ゾーンで `onDragOver`+`onDrop` → 同じ `applyMove`。
  ドラッグのみの設計にはしない。
- **キーボード**: 枠・ベンチ行は `<button>`（Tab / Enter / Space）。移動モード中は Enter で移動先確定、
  Esc でキャンセル。
- ベンチ並び替え: 各行に ↑ / ↓ ボタン（先頭で ↑、末尾で ↓ を disabled）。

## 強調表示（色以外にテキストも）

- 移動元: `opacity-60` + aria-label「移動中 —」
- 移動先候補: `ring-2 ring-accent/60` + aria-label「移動先候補 —」「選ぶと入れ替え」「選ぶとここへ移動」
- 上部に `aria-live` バー「〈選手名〉を移動中。空き枠を選ぶと移動、選手がいる枠を選ぶと入れ替え…（Esc でキャンセル）」

## 役割設定パネル（サマリータブ / PC は常時）

- キャプテン / FK 担当 / CK 担当 / PK 担当 を「先発選手」から `<select>` で選択。
  キー は既存の `setPieces.corners / freeKicks / penalties` のみ（推測で役割を増やさない）。
- 担当選手が先発から外れると自動解除（`moves.ts` が `remapRoles` で処理）。別選手へは移さない。
- ピッチのキャプテンバッジ（"C"）は従来どおり。

## SlotPlayerPanel の整理（§14）

- 主要操作: 「移動・交代」/「ベンチへ」/「枠から外す」
- その他: 「キャプテンに設定/解除」/「比較へ追加」/「選手詳細」/「育成」
- 選手情報（画像 / 名前 / ポジション / OVR / 保存ビルド / 固定ブースター / Power of Many / 適性）は従来どおり。

## 適性（§16）

移動は登録ポジション一致 / 副ポジション / 未収録 / 不適性の可能性を **警告表示のみ**。
ユーザーが選んだ移動を適性を理由に禁止しない。架空のポジション別 OVR は表示しない。

## 自動保存（§17）

`saveState`（idle/saving/saved/error）を維持。移動・交代でも `squad` 参照が変わり
`savedSquadRef` との比較で「保存中…」→ 500ms デバウンス → `runSave` → 「保存済み / 失敗＋再試行」。
連続移動でも最新 `squad` だけ保存（`squadRef.current` ＋関数更新で古い state を掴まない）。

## お気に入り / My Team との独立性（§20・§21）

`removeSquadPlayer` / `applySquadMove` は `squad` オブジェクトだけを返す。
`ownershipStatus` / `usageStatus` / タグ / メモ / `selectedBuildId` / `favoriteBuildId` /
お気に入り状態には一切触れない。usageStatus=main でもスカッド位置を固定しない。

## 前回機能の維持（§2・§26）

`resolveCard` 自己キャンセル解消 / `requestedCardsRef` / effect deps `[placedIds]` /
`assignWorldCardToSlot` / `addWorldCardToBench` / `worldCardId` 文字列保持 / 取得失敗表示・再試行 /
My Team `?card=` 導線 / 部分破損データの安全読込 / カード画像付き検索（`SquadPlayerSearchCard`）/
`changeFormation`（共通ポジション保持・余りベンチ・全消ししない）。
移動・交代のために選手検索・追加処理は複製していない。

## テスト

- `src/lib/squad/moves.test.ts`（24件）: 6 移動ケース / same_location / source_empty /
  target_not_found / bench_full / カード設定保持 / managerId・formation・squadId 保持 /
  キャプテン追従・解除＋警告 / 入れ替えでキャプテン交換 / セットプレー解除 /
  reorderBench 上下 / removeSquadPlayer（先発・ベンチ・空き枠・独立性）。
- 全 516 単体テスト PASS。`black-box-squads.mjs` 34/34、全 12 ブラックボックスレール PASS、回帰なし。
- ドラッグ / タップ / キーボードの実描画は jsdom 未導入（新規 npm 禁止）のため
  純関数テスト + 手動確認手順で担保。

## 手動確認手順（ブラウザ）

1. `/squads` で **テスト用スカッド**を新規作成（4-3-3）。CF に Messi、RWF に別選手、ベンチに 1 人追加。
2. Messi の枠をタップ →「移動・交代」→ 空き LWF をタップ → CF が空・LWF に Messi・先発人数不変。
3. Messi ⇔ RWF: Messi 選択 → 移動・交代 → RWF タップ → 両者入れ替え（消失なし）。
4. Messi の枠ドラッグ → 別の枠へドロップ（PC）。
5. Messi を「ベンチへ」→ 先発 -1 / ベンチ +1。ベンチ選手を空き CF へ（移動・交代 → CF タップ）→ 先発 +1。
6. ベンチ行の ↑ / ↓ で並び替え。
7. サマリータブの「役割設定」でキャプテン / FK / CK / PK を先発選手に設定。キャプテンをベンチへ → 自動解除＋警告。
8. 「元に戻す」で直前操作を 1 回取り消し。
9. 自動保存「保存中…」→「保存済み」。再読込 → 配置・キャプテン・担当・保存ビルド・Power of Many 設定を維持。
10. 375 / 430 / 768 / 1440 / 1920px で横スクロールが出ないこと、タップで全操作が完了できること。Esc / Tab / Enter で操作できること。
