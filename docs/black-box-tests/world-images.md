# World 画像 実取得確認

実行日時: 2026-08-28T02:32:55.701Z
対象: http://localhost:3000（内部プロキシ経由）
許可外部ホスト: d1zxa6glxh8sq9.cloudfront.net（GET のみ / 同時1 / 20秒 / 再試行なし / リダイレクト非追跡）
外部 GET 累計: **9 / 10**

## 個別カードの結果

| カード | worldCardId | 結果 | サイズ | 外部GET |
|---|---|---|---|---|
| 代表1: eFHUB リンクなし Messi | 89138556575063 | IMAGE | 241KB | 1 |
| 代表3: World 通常画像カード (Eden Hazard) | 88045755863174 | IMAGE | 264KB | 1 |
| 代表2a: eFHUB リンクあり Messi / eFHUB プロキシ(efimg) | 89136409091415 | IMAGE | 45KB | - |
| 代表2b: eFHUB リンクあり Messi / World プロキシ経路 | 89136409091415 | IMAGE | 76KB | 1 |
| 代表4: World モバイル画像 (?variant=mobile) | 89136409091415 | IMAGE | 6KB | 1 |
| 代表5: 存在しない World ID | 99999999999999 | PLACEHOLDER | - | 0 |
| 代表6: 不正な World ID | abc | HTTP 400 | - | 0 |
| 先頭ページ Paolo Maldini | 88045755960770 | IMAGE | 260KB | 1 |
| 先頭ページ Fabio Cannavaro | 88045755964133 | IMAGE | 266KB | 1 |
| 先頭ページ Zlatan Ibrahimović | 89136140651034 | IMAGE | 65KB | 1 |
| 先頭ページ George Best | 89136677522134 | IMAGE | 61KB | 1 |

## チェック項目

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | 一覧API 先頭24件を取得（外部アクセスなし） | 24 件 |
| PASS | 代表1: eFHUB リンクなし Messi の World 通常画像が取得できる | IMAGE 241KB up=1 |
| PASS | 代表3: World 通常画像カードが取得できる | Eden Hazard IMAGE up=1 |
| PASS | 代表2a: eFHUB リンクあり Messi は eFHUB プロキシ(efimg)で画像が出る | IMAGE 45KB |
| PASS | 代表2b: 同カードの World プロキシ経路も画像が出る | IMAGE up=1 |
| PASS | 代表4: World モバイル画像が取得できる | IMAGE up=1 |
| PASS | 代表5: 存在しない ID はプレースホルダー & 外部アクセス 0 | PLACEHOLDER up=0 |
| PASS | 代表6: 不正な ID は 400 & 外部アクセス 0 | HTTP 400 up=0 |
| PASS | 代表6b: SQL 風 ID も 400 & 外部アクセス 0 | HTTP 400 |
| PASS | 先頭ページのサンプル画像がすべて正常取得できる | 4/4  [Paolo Maldini:IMAGE, Fabio Cannavaro:IMAGE, Zlatan Ibrahimović:IMAGE, George Best:IMAGE] |
| PASS | 先頭24件: World 画像 URL を持つ枚数 | 24/24（NO IMAGE 想定 0） |
| PASS | 取得画像はすべて 3MB 以内 | 最大 266KB |
| PASS | 外部 GET 累計は 10 回以内 | 9 回 |

## 判定: 全項目 PASS

