# スカッド: フォーメーション配置補助（スナップ・ガイド・グリッド・左右反転）

実施日: 2026-08-30 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除なし

## 目的

自由配置の自由度を保ったまま、選手を整列させやすくする。**スナップは弱い補助**で、
強制固定しない・スナップなしで配置できる・修飾キー / 設定で無効化できる。
座標形式（`squad-positioning/2026-08-30.v1`）とロール判定規則（`squad-role-inference/2026-08-30.v1`）は**変更なし**。

## A. 配置スナップ（`src/lib/squad/position-snapping.ts`・純関数）

`calculateSnapCandidate({ movingSlotId, proposedX, proposedY, existingPlacements, settings, disableSnap })`
→ `{ x, y, rawX, rawY, snapApplied, snapTypes, guides }`。

- **中央線スナップ**: `|x-50| ≤ SNAP_DIST_X(3.5)` → x を 50 に。
- **水平ラインスナップ**: 他の先発で `|y-proposedY| ≤ SNAP_DIST_Y(3.5)` かつ `|x-theirX| ≥ SNAP_MIN_X_SEPARATION(6)`
  （横に近すぎる相手は対象外）→ 最も近い y へ、±1 以内はクラスタとみなし平均。移動中の選手は除外。
- **左右対称スナップ**: 他の先発の鏡像 `(100-theirX, theirY)` が `SNAP_DIST_X/Y` 以内 → その座標へ（x も y も）。
  中央線上（`|x-50|≤1`）の選手は対称候補にしない。**明示的な意図なので中央/ラインより優先**。
- 全閾値は position-snapping.ts の定数に集約。UI に散在させない。
- `settings.enabled === false` / `disableSnap === true`（Alt キー）→ スナップしない（生座標）。
- `guides`（表示用）は `GUIDE_NEAR_DIST(6)` 以内で返す（スナップ閾値より広い）。表示可否は呼び出し側（showGuides）。
- ロール判定は**スナップ後の最終座標**で行う（`SquadEditor.applyFreePosition`）。保存座標と表示ロールが食い違わない。
- 現行 `HYSTERESIS_MARGIN(5)` を維持。スナップ後座標を `inferPlacementRole(x, y, previousRole)` に渡す。

## B. 左右反転（`mirrorSquadPositions` in `moves.ts`）

- 先発全スロット: `x → 100-x`、`y` 維持。
- roleOverride が左右ロール（LWF/RWF・LMF/RMF・LB/RB）なら反対側へ（`MIRROR_ROLE`）。中央ロール（CF/SS/AMF/CMF/DMF/CB/GK）は維持。
- inferredRole は座標から自動再計算（保存しない）。
- **変更しない**: slotId / worldCardId / savedBuildId / boosters / conditionalBoosters / buildMode /
  managerId / captainSlotId / setPieces / linkUp / substitutes / squadName / formationId。
- 確認ダイアログ →（実行）→ 1 段階 Undo に含む。2 回反転で元に戻る（テスト済み）。ベンチは反転しない。

## C. 表示設定（`src/lib/squad/editor-preferences.ts`）

- **ユーザー UI 設定**（スカッド固有ではない）。localStorage `efootball-team-ai:squad-editor-preferences:v1`、
  storageVersion `squad-editor-preferences-storage/2026-08-30.v1`。SQLite へ保存しない。
- `{ snapEnabled, showGuides, showGrid }`。既定 `{ true, true, false }`（自由配置を妨げない弱い設定）。
- 壊れた JSON / 不正な型は既定へフォールバック。フラット形式・`preferences` ネスト形式どちらも読める。
- スカッドの保存形式（座標・roleOverride）には混ぜない。テンプレートにも含めない。

## D. UI（`SquadPitch` / `SquadEditor`）

- ピッチ上部に「配置補助:」バー: スナップ ON/OFF・ガイド ON/OFF・グリッド ON/OFF・配置を左右反転・フォーメーション位置に戻す。
  `aria-pressed`、色＋テキスト。
- **グリッド**: 10% 刻みの半透明線（`bg-white/5`・`pointer-events-none`・`z-0`＝カードより背面）。ロール判定ゾーンの塗りではない。
- **中央線**: 常時ごく薄い縦線。
- **ドラッグ中プレビュー**: `onDragOver` を `requestAnimationFrame` で 1 フレーム 1 回に制限し、
  `calculateSnapCandidate` で候補座標＋ガイドを算出 → ローカル state のみ更新（`SquadEditor` は再描画しない）。
  候補位置に半透明ゴーストカード＋「スナップ: 同ライン/中央/左右対称」ラベル。ガイド線（水平/中央/対称・色＋ラベル）。
  ドラッグ中に localStorage 保存・SQLite 取得・画像取得・全カード走査・ブースター再解決・Undo 連続追加をしない。
- **ドロップ時**に 1 回だけ `applyFreePosition(slotId, rawX, rawY, { disableSnap: altKey })` → スナップ確定 → ロール判定 → Undo 退避 → setSquad → 自動保存。
- **タップ**（位置調整モード）: ピッチタップ → `applyFreePosition`（スナップ適用）。
- **キーボード**: 矢印 ±2 / Shift+矢印 ±6 は既定でスナップ、**Alt+矢印でスナップなし**（微調整）。Enter/Esc で終了。
- Alt キー: PC でドラッグ中に押すとスナップ一時無効（ヒント文言を UI に表示）。モバイルは「スナップ ON/OFF」トグルのみ（修飾キー不要）。

## スナップしない条件

スナップ OFF / Alt / 閾値超過 / 候補がピッチ外 or 不正 / NaN・Infinity / 明示スロットへのドロップ（既存の入れ替え・移動）/
ベンチへのドロップ。既存の枠間移動・交換・ベンチ交代を自由配置スナップへ変換しない。

## 維持したもの

自由配置 / 配置ロール自動判定 / ヒステリシス / 手動ロール上書き / 選手追加 / 枠間移動 / 入れ替え / ベンチ交代 /
キャプテン / セットプレー / Link-Up / 保存ビルド / Power of Many / 監督補正 / テンプレート・複製での座標保持 /
`buildSquad` 経由の集計（FW/MF/DF 人数・適性警告・Link-Up 条件）。
座標調整だけでは選手能力値・平均値は変わらない（`estimateOvr` はカード登録ポジションのまま）。
既存スカッドを開いても座標を勝手にスナップし直さない（ユーザーが移動操作したときだけ適用）。

## 未実装（次候補として報告）

- 複数選手の選択 UI、選択選手だけの左右反転、配置座標だけのコピー／貼り付け、複数選手の一括整列（上/下/中央揃え・左右均等）。
  いずれも複数選択 UI が大きな追加になるため今回は見送り。弱いスナップ＋配置全体の左右反転を優先して完成させた。

## テスト

- `src/lib/squad/position-snapping.test.ts`（16件）: スナップ無効時の生座標、Alt 無効化、中央/水平ライン/左右対称、
  横に近すぎる相手の除外、y 閾値外、中央線上の選手は対称候補外、NaN/Infinity/範囲外の clamp、0/100 端、
  自己除外、rawX/rawY 保持、ガイドは閾値外でも返る。`mirrorRole` / `mirrorSquadPositions`（x→100-x・中央維持・2 回で戻る・その他不変）。
- `src/lib/squad/editor-preferences.test.ts`（5件）: 既定値、保存→再取得、壊れた JSON・不正型のフォールバック、
  フラット/ネスト両形式、localStorage 不可。
- 全 570 単体テスト PASS。`black-box-squads.mjs` 34/34、全 12 ブラックボックスレール PASS、回帰なし。
- ドラッグプレビュー・ガイド描画・グリッドの実描画は jsdom 未導入（新規 npm 禁止）のため純関数テスト＋手動確認で担保。

## 手動確認手順（ブラウザ）

1. `/squads` でテスト用 4-3-3 を作成、LWF と RWF に選手を配置。
2. RWF を LWF の対称位置付近へドラッグ → 「左右対称位置」ガイド → ドロップで `(84,22)` 付近へスナップ、y が揃う。
3. CB を別 CB の横ライン付近へドラッグ → 「同じライン」ガイド → y が揃う。
4. CF を中央線付近へ → x=50 へスナップ。
5. 「配置補助」バーで スナップ OFF → 同じ操作で生座標のまま。スナップ ON に戻す。
6. Alt を押しながらドラッグ → スナップしない。
7. グリッド ON → 10% グリッド表示。ガイド OFF → ドラッグ中のガイド線が消える。
8. 「配置を左右反転」→ 確認 → LWF↔RWF / LMF↔RMF / LB↔RB が入れ替わり、中央ロール・キャプテン・FK/CK/PK 担当・ベンチ・保存ビルド・Power of Many を維持。
9. 「元に戻す」で反転前へ。自動保存「保存済み」。再読込で座標維持。
10. 完全テンプレート作成 → テンプレートから新規スカッド → スナップ済み座標を維持。複製 → 複製元は不変。
11. My Team・お気に入りが不変。375/430/768/1440/1920px で横スクロールなし・グリッド/ガイドでピッチが見えにくくならない。
