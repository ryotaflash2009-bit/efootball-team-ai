# F-071 基礎能力値のパーセンタイル ブラックボックス

実行日時: 2026-09-27T11:31:45.258Z
対象: localhost（Production Build）  viewport: 8  locale: ja, en  実際の成果物の状態: not_generated

表示の確認は、ブラウザー内で分布 API の応答だけを合成の分布へ差し替えて行う（サーバー・DB は変えない）。書き込み・ログインなし。

| 結果 | viewport | locale | route | 確認 | 詳細 |
|---|---|---|---|---|---|
| PASS | desktop-1280x720 | ja | /api/percentiles/world-base | actual state: not_generated | not_generated |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | actual state shown without guessed values | fallback=true |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1280x720 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1280x720 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1280x720 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1280x720 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1440x900 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1440x900 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1440x900 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1440x900 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1440x900 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1440x900 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1920x1080 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1920x1080 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1920x1080 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1920x1080 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1920x1080 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1920x1080 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-768x1024 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-768x1024 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-768x1024 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-768x1024 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-768x1024 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-768x1024 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-820x1180 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-820x1180 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-820x1180 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-820x1180 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-820x1180 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-820x1180 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-390x844 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-390x844 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-390x844 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-390x844 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-390x844 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-390x844 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-393x852 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-393x852 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-393x852 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-393x852 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-393x852 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-393x852 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-430x932 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-430x932 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-430x932 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-430x932 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-430x932 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-430x932 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |

## 判定: 50/50 PASS
