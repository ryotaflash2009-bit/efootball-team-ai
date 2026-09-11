# 「スカッドで使用」遷移 ブラックボックステスト結果

実行日時: 2026-09-11T12:12:10.607Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

注: My Team・保存ビルド・保存スカッドは localStorage 保存のため、SSRでは「空状態シェル」までを検証。
カード+ビルドの引き継ぎ・配置確定・保存・再読み込み後の維持等の状態遷移は
src/lib/squad/pending-addition.test.ts（vitest）と、隔離ヘッドレスChromeの実ブラウザ検証で担保。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | My Team: /my-team が 200 | HTTP 200 |
| PASS | スカッド一覧: card付きで200 | HTTP 200 |
| PASS | スカッド一覧: 内部情報を含まない(card単独) |  |
| PASS | スカッド一覧: card+buildで200(クラッシュしない) | HTTP 200 |
| PASS | スカッド一覧: 不正なbuildパラメータでも200(安全に無視) | HTTP 200 |
| PASS | スカッド編集(存在しないID): card+build付きでも200(安全な不明表示) | HTTP 200 |
| PASS | 回帰: /squads が200 | HTTP 200 |
| PASS | 回帰: /squads/compare が200 | HTTP 200 |
| PASS | 回帰: /squads/templates が200 | HTTP 200 |
| PASS | 回帰: /my-team が200 | HTTP 200 |
| PASS | 回帰: /my-builds が200 | HTTP 200 |
| PASS | 回帰: /build-inventory が200 | HTTP 200 |

## 判定: 全項目 PASS

