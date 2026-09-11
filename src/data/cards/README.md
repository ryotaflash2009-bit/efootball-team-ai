# src/data/cards/

Phase A の暫定カード保存先（1カード = 1 JSON ファイル、ファイル名は `{efhubCardId}.json`）。

- 形式は `src/lib/efhub/card-schema.ts` の `ParsedPlayerCard`（Zod 検証済み）。
- 読み書きは `src/lib/efhub/card-store.ts` の関数を通す。
- **これは最終的な本番 DB ではない。** Phase B（20選手試験）が成功したら、
  同じスキーマで SQLite をローカル DB として導入し、この JSON 群から移行する。

現在 19 ファイル:

- `89138556575063.json` / `88041460996837.json` … golden fixture（Messi / Cannavaro）。
  `fetchedAt` はテスト決定性のため固定値 `2026-08-28T00:00:00.000Z`。`parserVersion` は `.2`。
- その他 17 ファイル … Phase B で eFHUB から取得した実カード。`parserVersion` は `.1`
  （Phase D の再取得時に `.2` へ更新され `playingStyleDefensive` が入る）。

任意フィールド `playingStyleDefensive`（守備プレースタイル英語名）は、
`.2` で追加。値が無いカードは null / キー欠落どちらも許容（Zod optional）。

これらの JSON は Phase B.5 で `data/efootball.db`（SQLite）へ移行済み。
JSON は削除せず、SQLite と JSON の両方を保持する（照合の基準）。
