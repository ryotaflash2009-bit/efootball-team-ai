# F-071 パーセンタイル・F-072 称号・F-073 あなたの一番・F-061 成長プロフィール ブラックボックス

実行日時: 2026-10-08T18:42:55.684Z
対象: localhost（Production Build）  viewport: 8  locale: ja, en  実際の成果物の状態: valid

表示の確認は、ブラウザー内で分布 API の応答だけを合成の分布へ差し替えて行う（サーバー・DB は変えない）。書き込み・ログインなし。

| 結果 | viewport | locale | route | 確認 | 詳細 |
|---|---|---|---|---|---|
| PASS | desktop-1280x720 | ja | /api/percentiles/world-base | actual state: valid | valid |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | actual state shown without guessed values | badges=52 |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | seed My Team through the add dialog | 1 card |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1280x720 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1280x720 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | desktop-1280x720 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | desktop-1280x720 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | desktop-1280x720 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | desktop-1280x720 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1280x720 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1280x720 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1280x720 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | desktop-1280x720 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | desktop-1280x720 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | desktop-1280x720 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | desktop-1440x900 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1440x900 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1440x900 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1440x900 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | desktop-1440x900 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | desktop-1440x900 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | desktop-1440x900 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | desktop-1440x900 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1440x900 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1440x900 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1440x900 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | desktop-1440x900 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | desktop-1440x900 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | desktop-1440x900 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | desktop-1920x1080 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1920x1080 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1920x1080 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1920x1080 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | desktop-1920x1080 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | desktop-1920x1080 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | desktop-1920x1080 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | desktop-1920x1080 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | desktop-1920x1080 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | desktop-1920x1080 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | desktop-1920x1080 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | desktop-1920x1080 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | desktop-1920x1080 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | desktop-1920x1080 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | tablet-768x1024 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-768x1024 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-768x1024 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-768x1024 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | tablet-768x1024 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | tablet-768x1024 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | tablet-768x1024 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | tablet-768x1024 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-768x1024 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-768x1024 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-768x1024 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | tablet-768x1024 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | tablet-768x1024 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | tablet-768x1024 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | tablet-820x1180 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-820x1180 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-820x1180 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-820x1180 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | tablet-820x1180 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | tablet-820x1180 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | tablet-820x1180 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | tablet-820x1180 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | tablet-820x1180 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | tablet-820x1180 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | tablet-820x1180 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | tablet-820x1180 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | tablet-820x1180 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | tablet-820x1180 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | mobile-390x844 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-390x844 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-390x844 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-390x844 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | mobile-390x844 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | mobile-390x844 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | mobile-390x844 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | mobile-390x844 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-390x844 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-390x844 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-390x844 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | mobile-390x844 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | mobile-390x844 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | mobile-390x844 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | mobile-393x852 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-393x852 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-393x852 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-393x852 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | mobile-393x852 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | mobile-393x852 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | mobile-393x852 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | mobile-393x852 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-393x852 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-393x852 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-393x852 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | mobile-393x852 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | mobile-393x852 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | mobile-393x852 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | mobile-430x932 | ja | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-430x932 | ja | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-430x932 | ja | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-430x932 | ja | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | mobile-430x932 | ja | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | mobile-430x932 | ja | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | mobile-430x932 | ja | /my-team | F-073 your best (loads only when opened) | rows=7 |
| PASS | mobile-430x932 | en | /players/world/89138556575063 | stats tab: buckets, explanation, scope toggle | badges=26/26, scopes=3, small=0 |
| PASS | mobile-430x932 | en | /players/world/89138556575063 | F-034: base percentile shown separately from the build preview | badges=26 |
| PASS | mobile-430x932 | en | /compare | toggle shows buckets for every player in the same scope | badges=52 |
| PASS | mobile-430x932 | en | /players/world/89138556575063 | F-072 player titles strip with reasons | primary=1, badges=3 |
| PASS | mobile-430x932 | en | /share/diagnosis | F-072 diagnosis title from the shared token | primary=counterAttack, badges=pressResistance,dribblePossession |
| PASS | mobile-430x932 | en | /diagnosis-history | F-061 growth profile from 3 history entries | rows=1 |
| PASS | mobile-430x932 | en | /my-team | F-073 your best (loads only when opened) | rows=7 |

## 判定: 115/115 PASS
