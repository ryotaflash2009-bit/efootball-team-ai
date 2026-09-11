# スカッド比較ビュー（/squads/compare）

実施日: 2026-08-30 / 外部アクセス: 0 / SQLite 書き込み: 0 / 新規 npm: なし / `.next` 削除なし

## 目的

保存済みの**通常スカッドを 2 つ**横並びで比較し、フォーメーション・自由配置・先発 / ベンチ・
共通 / 相違カード・監督・キャプテン・セットプレー・保存ビルド・fixed booster・Power of Many・
平均能力値・カテゴリ平均・共通スキル・Link-Up・適性・警告・チーム構成の違いを確認する。
**読み取り専用。ポジション別 OVR は推測しない。** 既存の buildSquad / ブースター計算 / 監督計算 /
保存ビルド解決を再利用し、比較専用の計算は作らない。

## URL と状態

- ページ: `/squads/compare?a={squadIdA}&b={squadIdB}`（`dynamic = "force-static"` シェル ＋
  クライアント `SquadCompareBoard`・`useSearchParams` を `Suspense` 内で使用）。
- **URL が主な状態源**。再読込で復元される。`router.replace` で URL を更新（履歴を汚さない）。
- 検証: `SQUAD_ID_RE = /^sq_[A-Za-z0-9]{6,32}$/`。不正 / 長すぎ / 制御文字 → 弾く。
  同一 ID → 「同じスカッド同士は比較できません。」。片方だけ / 両方未指定 → 空状態メッセージ。
  存在しない・削除済み ID → `getSquad` が null → 「見つかりません」。パラメーター重複 → 先頭値のみ使用（注記表示）。
- **比較画面を開いても保存済みスカッドを変更・削除しない**（`getSquad` は読み取りのみ）。

## 軽量ストア（`src/lib/squad/comparison-store.ts`）

- localStorage `efootball-team-ai:squad-comparison:v1`。
  storageVersion `squad-comparison-storage/2026-08-30.v1`。
- **保存するのは `{ storageVersion, squadIdA, squadIdB, updatedAt }` だけ。**
  スカッド本体・選手データ・カード画像・保存ビルド本体・ブースター定義・My Team・お気に入りは保存しない。
- 用途: パラメーター無しで `/squads/compare` に来たとき、直前のペアを復元するだけ。
  不正 ID は null 化。壊れた JSON / localStorage 不可でもクラッシュしない。

## 比較用純関数

- `src/lib/squad/compare-format.ts`: 表示用の数値整形（`roundTo` 小数第1位・`-0`→`0`・`fmtDiff` 符号付き・
  `diffValue` / `diffSide` / `finiteOrNull`・NaN / Infinity は「—」）。**丸めは表示専用。保存値は変更しない。**
- `src/lib/squad/assemble-build-input.ts`: `StoredSquad` ＋ 解決済み `WorldPlayerDetail` → `BuildSquadInput`
  （SquadEditor の `computed` 組み立てと同じ規則を純関数化）。`resolveSlotPlacements` で座標 → effectiveRole。
  座標の書き戻しはしない（表示のための導出のみ）。
- `src/lib/squad/compare-squads.ts`:
  - `compareSquads(a, b): SquadComparisonResult` — メイン。
  - `findCommonWorldCardIds` / `findExclusiveWorldCardIds` — **worldCardId 文字列一致のみ**。
  - `toCompareUnits(side)` — 1 スカッドを配置単位（先発 → ベンチ）へ正規化。
  - 出力: `summary` / `formationComparison` / `shapeComparison`（placementChanges）/ `playerComparison`
    （common / onlyA / onlyB / sameNameDifferentCard / areaChanges / starterBoth / starterOnlyA / starterOnlyB）/
    `benchComparison` / `managerComparison` / `captainComparison` / `setPieceComparison` / `linkUpComparison` /
    `buildComparison` / `boosterComparison` / `metricComparison` / `categoryComparison` / `skillComparison` /
    `suitabilityComparison` / `warningComparison` / `dataAvailability` / `metricsNotes`。
- **比較ロジックは React コンポーネントに書かない。** コンポーネントは表示のみ。

## 共通カードの照合（重要）

- 主キー = `worldCardId`（文字列）。slotId が違っても worldCardId が同じなら共通カード。
  同じ slotId でも worldCardId が違えば共通ではない。
- 同じ選手名でも worldCardId が異なれば**別カード**。確認済みの選手識別子（playerId 等）が無いため、
  「同一選手の別カード」とは表示せず **「同名の別カード」** とだけ補助表示する。

## データ取得（`src/components/squad/useSquadCompareData.ts`）

- スカッド 2 件を `getSquad` で読む（内容は書き換えない）。
- 必要な worldCardId を **Set で統合**し、既存 `/api/world/players/{id}` を `Promise.allSettled` で
  重複なく取得（**全 13,009 カード走査なし**・上限 500・超過分は切り捨てず先頭 500）。
- 取得失敗は `dataAvailability` に載せ、比較は続行。保存済み worldCardId は削除しない。再読込で再取得。
- 監督詳細（`/api/managers/{id}`）・保存ビルド（`listBuilds`・localStorage）も取得。
- `assembleBuildSquadInput` → `buildSquad` で集計（既存エンジン再利用）。
- 別タブでのスカッド更新（`storage` イベント・キー `efb:squads:v1`）を検知 → 「別のタブで更新されました」＋
  手動「再読込」ボタン。

## 画面（`SquadCompareBoard.tsx` / `CompareMiniPitch.tsx`）

- 上部: A / B セレクタ（スカッド名・フォーメーション・先発 / ベンチ人数・監督有無・カスタム配置・更新日時）、
  ⇄ 入れ替え、比較を解除、スカッドを開くリンク。
- 比較サマリー: 両スカッドの名前・フォーメーション・カスタム配置・先発 / ベンチ・監督・キャプテン・更新・警告数、
  中央に共通カード数・Aだけ・Bだけ。**優劣は自動判定しない。**
- タブ: 概要 / 配置 / 選手 / 能力値 / 役割 / ブースター / スキル・適性 / 警告。
  PC は横並び、モバイルは 2 カラム grid（項目ごとに A/B 隣接）。
- **差分のみ表示** トグル（UI 設定・スカッドには保存しない）。同値の行を折りたたむ。
- 配置タブ: `CompareMiniPitch` を 2 枚（保存 x/y 座標・配置ロール・キャプテン「C」・共通は●/この側だけは▫・
  色＋形＋テキスト・`role="img"` に全選手を読み上げる aria-label）。共通カードの配置差（Aの座標 / Bの座標 /
  x差 / y差 / roleA / roleB・「正規化座標」と明記）。先発↔ベンチの変化。
- 能力値タブ: 指標テーブル（Aの値 / Bの値 / 差 A−B）＋カテゴリ平均の CSS 比較バー（A アクセント色 / B 金色・
  数値ラベル併記・新チャートライブラリなし）＋適性の集計＋注意書き。
- ブースタータブ: fixed / **固定型（推定）** / Power of Many（指定 +0/+1/+2/+3・未指定）/ 条件型 / 未解決を分離。
  ユーザー指定値は標準値として扱わない。保存ビルド差（buildMode / ビルド名 / rulesVersion / 旧規則 /
  参照先削除済み / 標準表示OVR）。
- 警告タブ: 両方 / Aだけ / Bだけ ＋ 取得失敗カード一覧（worldCardId・先発 / ベンチ・配置位置）。

## 読み取り専用（比較画面で「しない」こと）

選手の移動 / 削除、監督変更、Power of Many 段階変更、保存ビルド変更、キャプテン変更、
セットプレー担当変更、スカッド名変更、フォーメーション変更、自動保存。
編集したい場合は各スカッドの編集画面へ遷移する導線のみ提供。

## 一覧・編集画面との接続

- `SquadListBoard`: 各カードに「比較」ボタン（`/squads/compare?a={squadId}` へ・既存の 開く/複製/テンプレ保存/
  名前変更/削除 は維持）＋ 一覧見出しに「スカッドを比較」リンク。
- `SquadEditor`: ヘッダー操作列に「別のスカッドと比較」（`/squads/compare?a={currentSquadId}` へ・
  編集中スカッドは変更しない・自動保存と競合しない）。

## 平均値の注意書き（維持）

単純平均（加重平均ではない）/ 公式チームパワーではない / ポジション別 OVR ではない /
ユーザー指定 Power of Many は標準平均に含めない / 固定型推定の扱い / 監督補正の適用順序未確認 /
未解決ブースターは加算しない / 欠損選手は集計から除外。

## テスト

- `src/lib/squad/compare-squads.test.ts`（13）: 共通 / 排他、toCompareUnits、同一 ID、
  worldCardId 判定、配置差、先発→ベンチ、フォーメーション一致、平均・カテゴリ差（自動勝者なし）、
  共通スキル、同名別カード、警告、取得失敗時の続行、複製直後は差分なし→編集で差分。
- `src/lib/squad/compare-format.test.ts`（5）: finiteOrNull / roundTo（-0 正規化）/ fmt / fmtDiff / diffSide。
- `src/lib/squad/comparison-store.test.ts`（6）: 既定、保存→取得、不正 ID の null 化、
  余計なキーを保存しない、壊れた JSON、localStorage 不可。
- 全 594 単体テスト PASS（+24）。`black-box-squads.mjs` 44/44（+10・SSR シェル）。全 12 ブラックボックスレール PASS。回帰なし。
- インタラクション（タブ切替・差分のみ表示・入れ替え・セレクタ）は jsdom 未導入（新規 npm 禁止）のため
  純関数テスト＋ SSR ブラックボックス＋手動確認で担保。

## 手動確認手順（ブラウザ）

1. テスト用に攻撃スカッドを作成 → 複製 →「守備用」に改名。
2. 守備用の選手を数人入れ替え、監督・キャプテン・FK/CK/PK 担当・自由配置・Power of Many を変更。保存済みを待つ。
3. 一覧で攻撃スカッドの「比較」→ `/squads/compare?a=...` → セレクタBで守備用を選択。
4. サマリー・ミニピッチ 2 枚・配置形状差・共通 / Aだけ / Bだけ・先発↔ベンチ・監督差・キャプテン差・
   CK/FK/PK 差・保存ビルド差・Power of Many 差・平均基礎/表示OVR差・カテゴリ平均バー・共通スキル差・
   Link-Up 差・警告差を確認。
5. 「差分のみ表示」ON で同値が畳まれる。「⇄ 入れ替え」で A/B が反転し URL も反転。
6. ページ再読込 → URL から復元。各スカッドを開いて保存内容が変わっていないこと、My Team・お気に入りが
   変わっていないことを確認。
7. 375 / 430 / 768 / 1440 / 1920px で横スクロールなし。キーボードでセレクタ・タブ・入れ替えを操作。
8. `.next` 削除なし・OneDrive 大量削除警告なし。
