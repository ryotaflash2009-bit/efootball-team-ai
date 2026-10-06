# de — ネイティブのレビュー用パッケージ（Native review package）

生成: `node scripts/i18n-review-package.mjs de`（辞書から自動生成。手で編集しない）。行数: 4366（うち計算ライブラリの文 407）。

## レビューの手順（for the reviewer）

1. `review.csv` を表計算ソフトで開く（UTF-8）。
2. `severity = high`（核の UI・エラー・アクセシビリティ・共有カード・サポート・ログイン・計算ライブラリの文）から確認する。
3. 各行の `decision` に **Accept**（そのまま）/ **Edit**（`suggested_alternative` に案）/ **Reject**（理由を `reviewer_comment`）を記入。
4. `max_length` がある行は、ボタン・タブ・見出しなどの短い表示。それを超えないこと。
5. `{name}`・`{count}`・`{1}`・`{cat:1}` などの差し込みは変えない（順序は自然な語順に変えてよい）。
6. 選手名・監督名・カード種別・プレースタイル名・スキル名・TeamAIXI・eFootball™・KONAMI・World・OVR・Link-Up Play は訳さない。
7. 終わったら `reviewed_date`（YYYY-MM-DD）を記入して返す。レビュー担当の氏名は書かない。

## 特に確認してほしい用語（game terms）

ゲーム内の de の公式の表記と照合していない。照合できた語は用語集（`docs/i18n/terminology-glossary.md`）を `approved` にする。

- 26 の能力名・10 の育成カテゴリ・6 の戦術名（`src/lib/i18n/game-terms.ts`）
- 能力 = atributo(s)、スキル = habilidad(es) / habilidade(s)、辛口の評価 = directo / direto、スカッド = plantilla / elenco、枠 = puesto / vaga
- Power of Many・Game Plan・Team Power・Coaching Affinity・Center Piece・Key Man（English のまま残した。ゲーム内の訳があれば合わせる）
- ブースター名（Ball-carrying・Attacking Hub 等）・「rank」の訳・セットプレーの役割

## 含めないもの

内部ページ（公開しない機能）・法務文書（利用規約・プライバシー・免責事項。English で表示し、専門家のレビューの無い訳は出さない）。
