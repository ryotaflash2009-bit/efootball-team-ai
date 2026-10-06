# 監督の比較（NEW-23・2026-10-07）

`/managers/compare?ids=<id>,<id>[,<id>,<id>]` で 2〜4 人の監督を並べる。監督の一覧の「監督を比較」から開く。

## 表示するもの（データの事実だけ）

| 区分 | 内容 |
| --- | --- |
| 戦術の適性 | 6 項目の値。各行で最も高い監督に ★（同点は全員・値が無い監督は対象外） |
| 監督ブースター | 能力ごとの上昇量。確認されていない効果は「未確認」の印を付ける（確認済みと区別する） |
| そのほか | フォーメーション・登場日・Link-Up Play の数 |

- 総合点・おすすめ・推測の値は作らない（`compareManagers` は値を並べるだけ）。
- 監督の名前はデータ元の英語のまま（翻訳しない）。Link-Up Play は全言語で原語のまま。
- 選んだ監督は URL の `?ids=` に持つ（数値・重複なし・最大 4 件。`parseManagerIds`）。データは既存の `GET /api/managers/:id`。
- 新しい表・API・保存のキーはない（読み取りだけ）。

## 実装

- 規則: `src/lib/managers/compare-managers.ts`（テスト `compare-managers.test.ts`）
- 画面: `src/components/managers/ManagerCompareView.tsx`・`src/app/managers/compare/page.tsx`（`ManagerPicker` を再利用）
- 文言: 名前空間 `managerCompare`（12 言語）・`managersPage.compareLink`
- 注意: ページを `force-static` にすると静的の生成で `?ids=` が空になり hydration が合わない（React #418）ため、
  通常の静的のページ + Suspense の中の `useSearchParams` にしている。

## 確認

- `node scripts/black-box-manager-compare.mjs`（8 つの幅 × 日英: 表・★・横はみ出しなし・JS のエラーなし・英語の題名）: 16/16
