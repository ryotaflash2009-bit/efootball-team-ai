# ローカル性能計測(招待制ベータ前)

実行日時: 2026-09-24T11:07:14.037Z  対象: http://localhost:3000(next start、Production build)  HTTP warm=5回・browser=3回(1回目をcold相当)
閾値(重大な問題だけを判定): page warm中央値 3000ms / API 2000ms / long task合計 1000ms / CLS 0.25 / 同一APIの重複0 / console error 0 / 5xx 0
数値はこの端末・この時点の参考値であり一般化しない。

## HTTP(server render・API)

| 判定 | 対象 | cold ms | warm中央値 ms | warm最大 ms | KB | status |
|---|---|---|---|---|---|---|
| OK | Home | 5217 | 437 | 643 | 72 | 200 |
| OK | Players initial | 923 | 244 | 258 | 106 | 200 |
| OK | Players search | 347 | 377 | 391 | 107 | 200 |
| OK | Players filter | 227 | 244 | 257 | 107 | 200 |
| OK | Managers | 156 | 145 | 185 | 125 | 200 |
| OK | Managers search | 145 | 147 | 173 | 38 | 200 |
| OK | Compare | 25 | 15 | 16 | 36 | 200 |
| OK | My Team | 16 | 14 | 17 | 31 | 200 |
| OK | My Builds | 16 | 16 | 17 | 31 | 200 |
| OK | Squads | 18 | 16 | 18 | 30 | 200 |
| OK | Best XI | 14 | 15 | 15 | 33 | 200 |
| OK | World list API | 225 | 230 | 240 | 16 | 200 |
| OK | World search API | 325 | 302 | 317 | 17 | 200 |
| OK | Managers API | 105 | 106 | 134 | 12 | 200 |

## Browser(navigation・hydration後)

| 判定 | viewport | page | cold load ms | warm load中央値 ms | warm最大 ms | TTFB中央値 ms | long task最大 ms | CLS最大 | requests | API | 重複API | error | 5xx |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop | / | 425 | 368 | 370 | 6 | 0 | 0 | 93 | 24 | 0 | 0 | 0 |
| OK | desktop | /players | 198 | 169 | 176 | 6 | 0 | 0 | 96 | 24 | 0 | 0 | 0 |
| OK | desktop | /players?q=メッシ | 316 | 273 | 291 | 7 | 0 | 0 | 96 | 24 | 0 | 0 | 0 |
| OK | desktop | /players?position=CF | 177 | 169 | 187 | 5 | 0 | 0 | 96 | 24 | 0 | 0 | 0 |
| OK | desktop | /managers | 166 | 126 | 140 | 6 | 0 | 0 | 66 | 0 | 0 | 0 | 0 |
| OK | desktop | /managers?q=conte | 132 | 117 | 117 | 5 | 0 | 0.014 | 55 | 0 | 0 | 0 | 0 |
| OK | desktop | /compare | 38 | 20 | 21 | 8 | 0 | 0 | 56 | 0 | 0 | 0 | 0 |
| OK | desktop | /my-team | 19 | 18 | 18 | 4 | 0 | 0 | 53 | 0 | 0 | 0 | 0 |
| OK | desktop | /my-builds | 18 | 19 | 19 | 3 | 0 | 0.019 | 53 | 0 | 0 | 0 | 0 |
| OK | desktop | /squads | 22 | 19 | 20 | 7 | 0 | 0.024 | 60 | 0 | 0 | 0 | 0 |
| OK | desktop | /best-xi | 25 | 19 | 19 | 3 | 0 | 0 | 53 | 0 | 0 | 0 | 0 |
| OK | mobile | / | 431 | 419 | 445 | 5 | 0 | 0 | 43 | 16 | 0 | 0 | 0 |
| OK | mobile | /players | 241 | 239 | 254 | 7 | 0 | 0 | 36 | 10 | 0 | 0 | 0 |
| OK | mobile | /players?q=メッシ | 316 | 332 | 350 | 7 | 0 | 0 | 36 | 10 | 0 | 0 | 0 |
| OK | mobile | /players?position=CF | 228 | 239 | 241 | 6 | 0 | 0 | 36 | 10 | 0 | 0 | 0 |
| OK | mobile | /managers | 173 | 156 | 167 | 6 | 0 | 0 | 22 | 0 | 0 | 0 | 0 |
| OK | mobile | /managers?q=conte | 128 | 142 | 151 | 6 | 0 | 0 | 32 | 0 | 0 | 0 | 0 |
| OK | mobile | /compare | 21 | 18 | 18 | 6 | 0 | 0 | 39 | 0 | 0 | 0 | 0 |
| OK | mobile | /my-team | 16 | 20 | 22 | 4 | 0 | 0 | 43 | 0 | 0 | 0 | 0 |
| OK | mobile | /my-builds | 17 | 18 | 19 | 3 | 0 | 0 | 29 | 0 | 0 | 0 | 0 |
| OK | mobile | /squads | 16 | 18 | 18 | 6 | 0 | 0 | 23 | 0 | 0 | 0 | 0 |
| OK | mobile | /best-xi | 15 | 18 | 18 | 3 | 0 | 0 | 45 | 0 | 0 | 0 | 0 |

**重大な問題: 0件**
