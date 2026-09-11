# AIベスト11 画面 ブラックボックステスト結果

実行日時: 2026-09-11T12:11:45.621Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

注: My Team・保存ビルドは localStorage 保存のため、SSR では「候補ゼロ(空状態)シェル」までを検証。
候補構築・適格性判定・選考アルゴリズム・重複防止・選考理由・選外候補・決定性は
src/lib/best-xi/*.test.ts（vitest）で担保。
実際の選考結果を伴う操作(再選出・複数ビルド・候補不足等)は隔離ヘッドレスChromeの実ブラウザ検証で担保。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | AIベスト11: /best-xi が 200 | HTTP 200 |
| PASS | AIベスト11: 見出し(h1)は1つ |  |
| PASS | AIベスト11: 見出し「AIベスト11」 |  |
| PASS | AIベスト11: 「総合型」の説明がある |  |
| PASS | AIベスト11: 「4-3-3」の初期フォーメーション表記がある |  |
| PASS | AIベスト11: 生成AI不使用の明示 |  |
| PASS | AIベスト11: 勝率予測ではないことの明示 |  |
| PASS | AIベスト11: 結果は保存されないことの明示 |  |
| PASS | AIベスト11: 「あなたの保存済み候補内」の明示 |  |
| PASS | AIベスト11: My Team未登録時の空状態案内 |  |
| PASS | AIベスト11: My Teamへの導線がある |  |
| PASS | AIベスト11: 保存ビルド一覧への導線がある |  |
| PASS | AIベスト11: 内部情報(SQL/絶対パス/APIキー等)を含まない |  |
| PASS | AIベスト11: worldCardId等の内部ID文字列がそのまま露出していない(候補ゼロ状態) |  |
| PASS | AIベスト11: 「世界最強」等の誇大表現を含まない |  |
| PASS | サイドバー: 「AIベスト11」リンクがある |  |
| PASS | サイドバー: 「AIベスト11」が「準備中」表示ではない |  |
| PASS | 回帰: / が200 | HTTP 200 |
| PASS | 回帰: /players が200 | HTTP 200 |
| PASS | 回帰: /compare が200 | HTTP 200 |
| PASS | 回帰: /my-team が200 | HTTP 200 |
| PASS | 回帰: /favorites が200 | HTTP 200 |
| PASS | 回帰: /squads が200 | HTTP 200 |
| PASS | 回帰: /squads/compare が200 | HTTP 200 |
| PASS | 回帰: /my-builds が200 | HTTP 200 |
| PASS | 回帰: /build-inventory が200 | HTTP 200 |
| PASS | 回帰: 選手詳細API 26能力値 |  |

## 判定: 全項目 PASS

