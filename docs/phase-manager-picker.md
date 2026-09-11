# フェーズ: 監督選択UIの全面改善

作成日: 2026-08-28

育成画面の小さな監督検索ボックスを廃し、一覧カード型の選択UIへ。
育成 / 比較 / スカッドで**同一コンポーネントを再利用**する。

## コンポーネント

- `src/components/managers/ManagerPicker.tsx`
  - `<Drawer>`（PC: 右からのワイド、モバイル: ほぼ全画面）。`open=false` では DOM を描画しない。
  - 検索は「一覧の絞り込み補助」。主操作は一覧カード。
  - フィルタ: 得意戦術（クライアント側）/ hasBooster / hasLinkUpPlay（API）/ リリース年（クライアント側）
  - 並べ替え: 名前 / リリース新旧 / 6 戦術適性の降順（`possession_desc` ほか）
  - カードは「詳細を見る」（選択を変えず確認）と「この監督を選択」（選択して閉じる）を分離
  - 詳細表示: リリース日・ID・6 戦術適性・ブースター・Link-Up Play・同名カード区別・確認状況
    + 「監督補正の適用順序（育成前 / 後）は未確認」を明記
- `src/components/managers/CurrentManagerCard.tsx`
  - 選択中監督の要約（イニシャルアバター・名前・得意戦術+値・ブースター・適用ステータス・Link-Up・変更 / 解除 / 詳細）
  - 監督なし: 「監督なし（managerBoosterDelta = 0）」+「監督一覧から選択」

## API 拡張

- `ManagerSortKey` に 4 キー追加: `long_ball_counter_desc` / `out_wide_desc` / `long_ball_desc` / `overload_desc`
  - `types.ts` / `schemas.ts`(`MANAGER_SORT_KEYS`) / `repository.ts`(`ORDER_BY`) / `ManagerPicker` の `SORTS`

## 統合

| 画面 | 監督の単位 | 実装 |
|---|---|---|
| 育成 | 選手 1 人 | `ProgressionPanel` が `CurrentManagerCard` + `ManagerPicker` |
| 比較 | 全員一括 or 個別 | `ComparisonBoard`（共有 picker + 個別 picker）。インライン検索は撤去 |
| スカッド | チーム全体 | `SquadManagerPanel` が `CurrentManagerCard` + `ManagerPicker` |

## 監督変更の副作用なし

- 監督変更は育成配分 / 選手ブースター / 保存ビルドに触れない。
- 「解除」は `managerBoosterDelta` を 0 にするだけ。
- 保存形式（ビルド / URL / sessionStorage / localStorage）は不変。後方互換。

## 監督画像

- 候補 6 サイトの調査で安全に使える A/B 判定のソースが無いと確定（別 doc）。
- **イニシャルアバターを正式な標準表示**として維持。今後の調査対象から除外。

## テスト

- `scripts/black-box-manager-picker.mjs`（35）
- `src/lib/managers/schemas.test.ts` に 6 適性ソートキーの受理を追加
- `src/components/managers/tactics.test.ts`（既存 `topTactic` 等）
