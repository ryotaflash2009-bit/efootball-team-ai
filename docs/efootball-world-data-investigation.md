# eFootball World データソース調査（最小調査）

実行日時: 2026-08-27T22:26:18.570Z
外部リクエスト: robots.txt 1回（手動）+ 本スクリプト 4回 = 合計 5/5
対象ホスト: efootball-world.com のみ / Cookie・Authorization・APIキー不使用 / UA 偽装なし / リダイレクト非追跡

## 1. robots.txt
```
User-Agent: *
Allow: /
Disallow: /my/
Disallow: /auth/

Sitemap: https://efootball-world.com/sitemap.xml
```
判定: 全UAに Allow: /。Disallow は /my/（個人ページ）と /auth/ のみ。Crawl-delay 指定なし。ClaudeBot 等の AI クローラー制限や Content-Signal なし。→ /api/ と /player/ への自動アクセスは robots.txt 上は許可。

## 2. players/search API（1ページ目）
- POST https://efootball-world.com/api/proxy/v1/api/players/search
- HTTP 200 / Content-Type application/json / 52056 bytes
- レート制限ヘッダー: （なし）
- トップレベルキー: players, totalCount, totalPages, currentPage, pageSize, hasNext, hasPrevious, lastCacheRefresh
- ページング: {"totalCount":13009,"totalPages":543,"currentPage":1,"pageSize":24,"hasNext":true,"cursorLike":[]}
- players 件数: 24
- players[0] フィールド:
```json
{
  "id": "string=\"88043608522894\"",
  "name": "string=\"Burchet\"",
  "nameJp": "string=\"バーチャット\"",
  "type": "string=\"EPIC\"",
  "position": "string=\"RWF\"",
  "nationality": "string=\"Australia\"",
  "region": "string=\"Asia-Oceania\"",
  "league": "string=\"Other\"",
  "team": "string=\"EFB United\"",
  "overallRating": "number=84",
  "playingStyle": "string=\"Prolific Winger\"",
  "playingStyleDef": "string=\"Basic\"",
  "imageUrl": "string=\"https://d1zxa6glxh8sq9.cloudfront.net/player_88043608522894",
  "mobileImageUrl": "null",
  "likesCount": "number=0",
  "viewCount": "number=97",
  "averageRating": "null",
  "totalRatings": "number=0",
  "height": "number=178",
  "weight": "number=70",
  "age": "number=25",
  "foot": "string=\"Right foot\"",
  "maximumLevel": "number=19",
  "maxOverall": "number=94",
  "rating": "string=\"B\"",
  "skills": "array[10]",
  "aiStyles": "array[1]",
  "boost1": "number=159",
  "boost2": "number=0",
  "offensiveAwareness": "number=74",
  "ballControl": "number=74",
  "dribbling": "number=75",
  "tightPossession": "number=69",
  "lowPass": "number=68",
  "loftedPass": "number=75",
  "finishing": "number=67",
  "heading": "number=64",
  "setPieceTaking": "number=58",
  "curl": "number=59",
  "defensiveAwareness": "number=58",
  "tackling": "number=63",
  "aggression": "number=71",
  "defensiveEngagement": "number=64",
  "gkAwareness": "number=40",
  "gkCatching": "number=40",
  "gkParrying": "number=40",
  "gkReflexes": "number=40",
  "gkReach": "number=40",
  "speed": "number=92",
  "acceleration": "number=91",
  "kickingPower": "number=68",
  "jumping": "number=76",
  "physicalContact": "number=58",
  "balance": "number=75",
  "stamina": "number=57",
  "appearance": "object{position,updatedAt,legCoverageRadius,armCoverageRadius,torsoCollision,jumpingHeight,dribbleHeight,legLength}"
}
```
- 先頭3件:
```json
{"id":"88043608522894","name":"Burchet","nameJp":"バーチャット","type":"EPIC","position":"RWF","nationality":"Australia","region":"Asia-Oceania","league":"Other","team":"EFB United","overallRating":84,"playingStyle":"Prolific Winger","playingStyleDef":"Basic","imageUrl":"https://d1zxa6glxh8sq9.cloudfront.net/player_88043608522894_1787815095927.webp","mobileImageUrl":null,"likesCount":0,"viewCount":97,"averageRating":null,"totalRatings":0,"height":178,"weight":70,"age":25,"foot":"Right foot","maximumLevel":19,"maxOverall":94,"rating":"B","skills":["Chop Turn","Pinpoint Crossing","Fighting Spirit","Acceleration Burst","Super-sub","Scissors Feint","Penalty Specialist","Long Throw","Double Touch","Scotch Move"],"aiStyles":["Speeding Bullet"],"boost1":159,"boost2":0,"offensiveAwareness":74,"ballControl":74,"dribbling":75,"tightPossession":69,"lowPass":68,"loftedPass":75,"finishing":67,"heading":64,"setPieceTaking":58,"curl":59,"defensiveAwareness":58,"tackling":63,"aggression":71,"defensiveEngagement":64,"gkAwareness":40,"gkCatching":40,"gkParrying":40,"gkReflexes":40,"gkReach":40,"speed":92,"acceleration":91,"kickingPower":68,"jumping":76,"physicalContact":58,"balance":75,"stamina":57,"appearance":{"position":"RWF","updatedAt":"2026-08-27T16:09:08.972164","legCoverageRadius":{"value":171.77,"overall":{"rank":8820,"total":13009,"topPercent":68},"position":{"rank":322,"total":730,"topPercent":45}},"armCoverageRadius":{"value":160.60685714285714,"overall":{"rank":8697,"total":13009,"topPercent":67},"position":{"rank":317,"total":730,"topPercent":44}},"torsoCollision":{"value":49.59715714285714,"overall":{"rank":8791,"total":13009,"topPercent":68},"position":{"rank":298,"total":730,"topPercent":41}},"jumpingHeight":{"value":257.25142857142856,"overall":{"rank":6262,"total":13009,"topPercent":49},"position":{"rank":82,"total":730,"topPercent":12}},"dribbleHeight":{"value":178,"overall":{"rank":8793,"total":13009,"topPercent":68},"position":{"rank":328,"total":730,"topPercent":45}},"legLength":{"value":7,"overall":{"rank":6605,"total":13009,"topPercent":51},"position":{"rank":421,"total":730,"topPercent":58}}}}
{"id":"106799999082154","name":"Morita Hidemasa","nameJp":"守田 英正","type":"SHOWTIME","position":"DMF","nationality":"Japan","region":"Asia-Oceania","league":"English League","team":"Hull OB","overallRating":85,"playingStyle":"Box-to-Box","playingStyleDef":"Box-to-Box","imageUrl":"https://d1zxa6glxh8sq9.cloudfront.net/player_106799999082154_1787815268043.webp","mobileImageUrl":null,"likesCount":0,"viewCount":51,"averageRating":null,"totalRatings":0,"height":177,"weight":74,"age":31,"foot":"Right foot","maximumLevel":33,"maxOverall":100,"rating":"A","skills":["Fighting Spirit","Through Passing","Outside Curler","Interception","Phenomenal Pass","Man Marking","One-touch Pass","Double Touch","Fortress","Sole Control"],"aiStyles":["Long Ball Expert"],"boost1":161,"boost2":0,"offensiveAwareness":71,"ballControl":80,"dribbling":77,"tightPossession":78,"lowPass":78,"loftedPass":79,"finishing":68,"heading":67,"setPieceTaking":58,"curl":71,"defensiveAwareness":73,"tackling":75,"aggression":77,"defensiveEngagement":76,"gkAwareness":40,"gkCatching":40,"gkParrying":40,"gkReflexes":40,"gkReach":40,"speed":75,"acceleration":77,"kickingPower":74,"jumping":66,"physicalContact":78,"balance":75,"stamina":84,"appearance":{"position":"DMF","updatedAt":"2026-08-27T16:09:23.91148","legCoverageRadius":{"value":170.805,"overall":{"rank":9461,"total":13009,"topPercent":73},"position":{"rank":776,"total":1026,"topPercent":76}},"armCoverageRadius":{"value":158.87014285714287,"overall":{"rank":9639,"total":13009,"topPercent":75},"position":{"rank":809,"total":1026,"topPercent":79}},"torsoCollision":{"value":49.48395321428571,"overall":{"rank":9088,"total":13009,"topPercent":70},"position":{"rank":780,"total":1026,"topPercent":77}},"jumpingHeight":{"value":249.6542857142857,"overall":{"rank":9192,"total":13009,"topPercent":71},"position":{"rank":838,"total":1026,"topPercent":82}},"dribbleHeight":{"value":177,"overall":{"rank":9456,"total":13009,"topPercent":73},"position":{"rank":768,"total":1026,"topPercent":75}},"legLength":{"value":7,"overall":{"rank":6605,"total":13009,"topPercent":51},"position":{"rank":482,"total":1026,"topPercent":47}}}}
{"id":"106799999081429","name":"Tomiyasu Takehiro","nameJp":"冨安 健洋","type":"SHOWTIME","position":"CB","nationality":"Japan","region":"Asia-Oceania","league":"English League","team":"Crystal Palace RB","overallRating":85,"playingStyle":"Build Up","playingStyleDef":"High Line Master","imageUrl":"https://d1zxa6glxh8sq9.cloudfront.net/player_106799999081429_1787815246675.webp","mobileImageUrl":null,"likesCount":1,"viewCount":65,"averageRating":null,"totalRatings":0,"height":188,"weight":84,"age":28,"foot":"Right foot","maximumLevel":27,"maxOverall":100,"rating":"A","skills":["Long Reach Tackle","Aerial Superiority","Weighted Pass","Through Passing","Interception","Man Marking","One-touch Pass","Shadow Hunt","Visionary Pass","Blocker"],"aiStyles":["Long Ball Expert"],"boost1":160,"boost2":0,"offensiveAwareness":54,"ballControl":73,"dribbling":69,"tightPossession":70,"lowPass":74,"loftedPass":72,"finishing":54,"heading":63,"setPieceTaking":55,"curl":62,"defensiveAwareness":77,"tackling":79,"aggression":77,"defensiveEngagement":79,"gkAwareness":40,"gkCatching":40,"gkParrying":40,"gkReflexes":40,"gkReach":40,"speed":80,"acceleration":77,"kickingPower":70,"jumping":78,"physicalContact":78,"balance":69,"stamina":76,"appearance":{"position":"CB","updatedAt":"2026-08-27T16:09:23.189956","legCoverageRadius":{"value":180.85600000000002,"overall":{"rank":3228,"total":13009,"topPercent":25},"position":{"rank":1023,"total":1919,"topPercent":54}},"armCoverageRadius":{"value":168.74342857142855,"overall":{"rank":3388,"total":13009,"topPercent":27},"position":{"rank":994,"total":1919,"topPercent":52}},"torsoCollision":{"value":52.058878571428565,"overall":{"rank":3553,"total":13009,"topPercent":28},"position":{"rank":1073,"total":1919,"topPercent":56}},"jumpingHeight":{"value":268.81142857142856,"overall":{"rank":1532,"total":13009,"topPercent":12},"position":{"rank":801,"total":1919,"topPercent":42}},"dribbleHeight":{"value":187,"overall":{"rank":3695,"total":13009,"topPercent":29},"position":{"rank":1090,"total":1919,"topPercent":57}},"legLength":{"value":6,"overall":{"rank":10819,"total":13009,"topPercent":84},"position":{"rank":1620,"total":1919,"topPercent":85}}}}
```

## 3. ホームページ HTML
- HTTP 200 / 534693 bytes / Next.js data: true
- 利用規約系リンク: {"terms":["/terms"],"tos":[],"legal":[],"privacy":["/privacy"],"guideline":[],"利用規約":[],"player/":["/player/88043608522894","/player/106799730583961","/player/106799730641209","/player/106799730668598","/player/106799999081317","/player/106799999081429","/player/106799999082154","/player/105853764157582","/player/52902186060334","/player/52902185983779"]}
- API / 個別ページ参照候補（未アクセス）:
  - /player/88043608522894
  - /player/106799730583961
  - /player/106799730641209
  - /player/106799730668598
  - /player/106799999081317
  - /player/106799999081429
  - /player/106799999082154
  - /player/105853764157582
  - /player/52902186060334
  - /player/52902185983779
  - /player/52902186037300
  - /player/52902186057942
  - /player/52902186027753
  - /player/52902186041249
  - /player/52902186044588
  - /player/52902185973799
  - /player/52902186086216
  - /player/52902186086248
  - /player/52902186095121
  - /player/53990691759915
  - /player/53990691828711
  - /player/53990691853358
  - /player/53990691741940
  - /player/53990691764136
  - /player/53990691863762
  - /player/105894566299420
  - /player/105894566308007
  - /player/105894566318879
  - /player/105894566270946
  - /player/105894566321736
  - /player/105894566326468
  - /player/105894566340165
  - /player/105894566325156
  - /player/105894834754618
  - /player/105894834728845
  - /player/105894834728843
  - /player/105894834729724
  - /player/105894834737245
  - /player/105894834745154
  - /player/105894834770018

## 4. 利用条件ページ
- https://efootball-world.com/terms（HTTP 200 / 100620 bytes）
- 兆候: {"mentionsScraping":true,"prohibitsAutomated":false,"mentionsApi":false,"mentionsDataUse":false}
- ※ 全文は保存せず、自動取得の可否に関わる語の有無のみ記録。

## 5. 個別選手ページ（players/search で直接確認できた1件）
- https://efootball-world.com/player/88043608522894（HTTP 200 / 206979 bytes）
- 能力値/詳細キーの出現: なし
- __NEXT_DATA__: false / RSC: true
- 個別ページ内の API 参照候補（未アクセス）:
  - /player/88043608522894
  - /player/105853764157582

> Messi / Cannavaro の照合は本調査では **未実施**（players/search 1ページ目は CREATED_AT DESC のため両者が含まれず、
> 追加の名前検索は 5 リクエスト制約により送っていない）。次回の最小調査で対応。

## 次に必要な最小調査（案）
- players/search で `size` の上限を確認（1リクエスト。レスポンス or 公開コードから判断できれば不要）。
- Messi / Cannavaro を名前検索（各1リクエスト）→ eFHUB 保存済みデータと照合。
- 個別詳細 API の正確な形式を1〜2件で確認（能力値・スキル・育成の取得可否）。
- 監督 / ブースター / パック / Tier の API 候補を1件ずつ確認。

（詳細な方式比較・所要時間見積り・SQLite 統合設計・データ競合設計は、上記の追加調査結果を待って確定する）

