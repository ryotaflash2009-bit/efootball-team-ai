# fr — ネイティブのレビュー用パッケージ（Native review package）

生成: `node scripts/i18n-review-package.mjs fr`（辞書から自動生成。手で編集しない）。
文言 4367 行（P0 934・P1 2431・P2 1002。うち計算ライブラリの文 407）・用語 61 行。
元の版: `v1.0.0+i18n-foundation`・用語集の版: `glossary-2026-10-07`。状態: RELEASE_CANDIDATE（AI 翻訳・ネイティブのレビュー前・本番の言語の選択には出していない）。

## 手順（for the reviewer）

1. **terminology.csv を先に**確認する（能力名・育成グループ・戦術・機能名）。ここが決まると本文の多くが決まる。
   ゲーム内の公式の表記が分かる場合は `official_in_game_term` と、その確認元（画面・日付）を `source_of_official_term` に書く。
2. **review.csv を priority の順に**（P0 → P1 → P2）。
   - **P0**: 誤訳で操作を誤るもの（保存・削除・復元・Import・Export・エラー・警告・プライバシー・サポート・ログイン）。必ず全件。
   - **P1**: 診断・改善・弱点・育成・能力・戦術・共有カード・計算ライブラリの文。
   - **P2**: 説明・装飾・任意の Tooltip。時間があれば。
3. 各行の `decision` に **Accept**（そのまま）/ **Edit**（`suggested_alternative` に案）/ **Reject**（理由を `reviewer_comment`）。
4. `max_length` がある行は、ボタン・タブ・見出しなどの短い表示。それを超えないこと。
5. `screen`・`screenshot_reference` は、その文言が出る画面（内部の確認用の build で開く）。
6. `{name}`・`{count}`・`{1}`・`{cat:1}` などの差し込みは変えない（順序は自然な語順に変えてよい）。
7. 選手名・監督名・カード種別・プレースタイル名・スキル名・TeamAIXI・eFootball™・KONAMI・World は訳さない。
   **Link-Up Play・OVR は契約で原語のまま**（データ元で正式な現地語の表記を確認できた場合だけ変える。短い補足は原語と並べて Tooltip・初回の説明だけ）。
8. 終わったら `reviewed_date`（YYYY-MM-DD）を記入して返す。レビュー担当の氏名は書かない。

## 含めないもの

内部ページ（公開しない機能）・法務文書（利用規約・プライバシー・免責事項。English で表示し、専門家のレビューの無い訳は出さない）・
Secret・内部 URL・利用者のデータ。

## レビューの後（運営者）

1. Edit の行を辞書（`src/lib/i18n/dictionaries/locales/fr/`）へ反映し、`node scripts/audit-locale-coverage.mjs --record fr`。
2. `docs/i18n/locale-status.json` の `quality` を `VERIFIED_REVIEWED`・`reviewedBy` を記録（氏名ではなく役割・依頼の記録）。
3. 公開（`PUBLISHED`）は本人の判断。
