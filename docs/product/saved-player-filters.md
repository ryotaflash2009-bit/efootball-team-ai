# 選手一覧の保存した絞り込み（NEW-31・2026-10-09）

- 選手一覧（`/players`）の絞り込みの下に「今の条件を保存」。名前（30 文字まで）をつけて、今の検索・絞り込み・並べ替えを端末に保存する。最大 10 件。
- 保存したものを選ぶと、同じ条件の一覧へ移る。今の条件と同じ保存は選ばれた状態で表示。同じ名前で保存すると上書き。「選んだものを削除」。
- 保存する項目: `q`・`position`・`cardType`・`playingStyle`・`playingStyleDef`・`minOvr`・`maxOvr`・`hasBooster`・`sort` だけ（ページ番号・未知の項目は保存しない・値は 60 文字まで）。
- 保存先: `efootball-team-ai:local:guest:saved-player-filters:v1`（アカウントは `local:account:<scopeId>:…`）。サーバーへは送らない。ダイアログは使わない。
- 実装: `src/lib/world/saved-filters.ts`・`src/components/world/SavedPlayerFilters.tsx`。確認: `saved-filters.test.ts`（5）・`scripts/black-box-saved-filters.mjs`（10/10）。
