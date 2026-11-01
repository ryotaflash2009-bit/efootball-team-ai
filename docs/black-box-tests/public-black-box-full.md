# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-31T16:38:42.318Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.2)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 646 | 78 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 649 | 93 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 647 | 95 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 648 | 78 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 651 | 67 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 634 | 88 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 644 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 649 | 83 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 654 | 87 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 653 | 80 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 680 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 640 | 80 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 635 | 108 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 645 | 67 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 640 | 80 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 651 | 80 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 653 | 80 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 657 | 81 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 653 | 67 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 642 | 67 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 637 | 67 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 651 | 69 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 638 | 68 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 638 | 67 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 885 | 80 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 640 | 82 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 648 | 81 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 652 | 81 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 899 | 81 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 652 | 83 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 654 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 651 | 96 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 636 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 639 | 86 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 802 | 96 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1291 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1302 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1309 | 110 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1305 | 98 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1044 | 85 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 653 | 83 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1042 | 119 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1053 | 106 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1026 | 98 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1286 | 122 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1037 | 161 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1329 | 125 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 643 | 82 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 652 | 86 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 637 | 88 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1295 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1045 | 84 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 902 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1667 | 83 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 656 | 82 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1799 | 175 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2365 | 372 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 653 | 84 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 634 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 639 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 625 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 624 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1221 | 87 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1789 | 252 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1078 | 157 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1226 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 654 | 86 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 653 | 85 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1892 | 252 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 652 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2311 | 82 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 852 | 84 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 646 | 89 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 656 | 95 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 651 | 99 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 653 | 83 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 652 | 69 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 635 | 90 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 640 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 648 | 85 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 648 | 90 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 639 | 82 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 703 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 649 | 82 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 634 | 134 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 648 | 69 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 637 | 82 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 652 | 82 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 653 | 82 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 651 | 83 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 651 | 71 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 636 | 69 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 652 | 69 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 637 | 71 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 653 | 70 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 639 | 69 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 902 | 82 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 649 | 84 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 638 | 83 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 653 | 83 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 889 | 83 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 639 | 83 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 651 | 85 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 652 | 96 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 649 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 636 | 86 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 685 | 96 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1309 | 107 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1304 | 107 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1310 | 122 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1308 | 113 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1041 | 103 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 655 | 83 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1043 | 119 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1042 | 118 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1039 | 110 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1029 | 122 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1042 | 161 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1554 | 153 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 653 | 82 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 639 | 86 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 654 | 88 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1542 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1040 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 901 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1430 | 83 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 648 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1785 | 175 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2348 | 387 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 652 | 84 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 634 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 639 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1211 | 87 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1086 | 171 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1244 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 654 | 86 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2323 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 648 | 89 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 654 | 113 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 654 | 98 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 653 | 86 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 651 | 84 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 640 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 654 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 639 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 652 | 89 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 649 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 700 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 649 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 640 | 138 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 651 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 648 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 653 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 638 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 653 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 651 | 71 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 638 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 651 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 649 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 639 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 655 | 69 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 886 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 651 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 640 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 651 | 83 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 901 | 83 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 653 | 83 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 649 | 85 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 656 | 114 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 638 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 638 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 669 | 114 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1305 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1310 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1302 | 152 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1299 | 131 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1059 | 105 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 649 | 83 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1042 | 132 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1043 | 148 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1039 | 130 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1032 | 158 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1041 | 158 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1320 | 144 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 652 | 82 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 653 | 86 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 652 | 88 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1288 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1040 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 914 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1430 | 83 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 654 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1772 | 175 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2332 | 391 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 654 | 84 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 634 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 621 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 639 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 635 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1353 | 87 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1074 | 171 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1218 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 639 | 86 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2316 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 645 | 59 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 640 | 61 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 650 | 67 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 654 | 36 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 648 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 634 | 57 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 655 | 62 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 650 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 637 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 648 | 57 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 700 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 639 | 48 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 636 | 99 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 650 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 637 | 51 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 638 | 54 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 637 | 60 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 640 | 61 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 637 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 638 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 637 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 638 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 653 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 651 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 885 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 649 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 635 | 45 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 650 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 904 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 650 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 651 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 653 | 62 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 637 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 656 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 662 | 62 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1291 | 67 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1303 | 67 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1290 | 86 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1289 | 80 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1054 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 641 | 48 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1039 | 67 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1055 | 74 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1052 | 66 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1046 | 86 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 214 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1049 | 86 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1318 | 97 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 650 | 47 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 654 | 49 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 640 | 51 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1548 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1026 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 905 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1462 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 652 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1770 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2343 | 265 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 650 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 634 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 635 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 621 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 638 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1226 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1087 | 108 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1214 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 640 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2329 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 650 | 67 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 651 | 61 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 641 | 67 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 648 | 38 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 637 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 638 | 57 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 641 | 64 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 648 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 654 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 652 | 57 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 686 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 653 | 48 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 636 | 108 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 650 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 651 | 51 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 635 | 54 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 637 | 60 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 650 | 61 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 645 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 648 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 651 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 650 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 636 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 638 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 899 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 638 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 635 | 45 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 638 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 904 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 638 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 650 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 653 | 62 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 650 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 650 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 667 | 62 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1304 | 75 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1300 | 75 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1308 | 86 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1277 | 80 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1031 | 85 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 650 | 48 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1057 | 75 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1057 | 82 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1057 | 74 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1031 | 86 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 211 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1038 | 117 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1318 | 97 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 651 | 47 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 886 | 49 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 650 | 51 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1509 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1043 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 914 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1434 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 650 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1775 | 101 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2330 | 269 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 652 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 623 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 633 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 622 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 620 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1213 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1070 | 116 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1240 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 653 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 649 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2318 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 648 | 48 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 652 | 45 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 650 | 52 | identity ok |
| PASS | mobile-390x844 | /managers | view | 648 | 31 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 651 | 26 | identity ok |
| PASS | mobile-390x844 | /compare | view | 653 | 57 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 652 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 636 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 638 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 638 | 57 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 684 | 44 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 636 | 48 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 649 | 78 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 647 | 25 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 655 | 51 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 633 | 54 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 640 | 54 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 650 | 61 | h1 ok |
| PASS | mobile-390x844 | /support | view | 651 | 25 | legal links present |
| PASS | mobile-390x844 | /terms | view | 648 | 25 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 654 | 25 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 652 | 27 | h1 ok |
| PASS | mobile-390x844 | /about | view | 650 | 26 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 640 | 46 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 888 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 637 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 653 | 45 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 650 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 900 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 651 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 637 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 638 | 46 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 648 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 651 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 772 | 46 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1302 | 48 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1304 | 48 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1304 | 54 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1303 | 64 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1053 | 60 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 637 | 48 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1043 | 51 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1058 | 50 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1058 | 46 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1044 | 54 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1029 | 54 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1320 | 69 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 653 | 47 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 654 | 47 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 652 | 47 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1301 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1023 | 32 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 904 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1414 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 652 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1789 | 99 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2343 | 239 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 637 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 624 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 625 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 621 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 623 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1224 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1780 | 176 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1088 | 97 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1223 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 651 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 649 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1762 | 176 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2330 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 805 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 650 | 48 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 650 | 45 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 653 | 51 | identity ok |
| PASS | mobile-393x852 | /managers | view | 649 | 31 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 637 | 26 | identity ok |
| PASS | mobile-393x852 | /compare | view | 649 | 57 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 639 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 636 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 656 | 56 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 638 | 57 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 687 | 44 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 647 | 48 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 642 | 78 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 648 | 25 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 638 | 51 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 637 | 54 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 640 | 54 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 650 | 61 | h1 ok |
| PASS | mobile-393x852 | /support | view | 652 | 25 | legal links present |
| PASS | mobile-393x852 | /terms | view | 649 | 25 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 639 | 25 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 652 | 27 | h1 ok |
| PASS | mobile-393x852 | /about | view | 638 | 26 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 649 | 46 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 887 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 651 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 638 | 45 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 637 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 885 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 652 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 638 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 649 | 46 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 638 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 639 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 667 | 46 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1290 | 48 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1306 | 48 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1300 | 54 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1292 | 64 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1057 | 60 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 651 | 48 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1036 | 49 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1056 | 50 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1056 | 46 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1041 | 54 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1037 | 54 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1315 | 68 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 654 | 47 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 652 | 47 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 655 | 47 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1285 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1041 | 32 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 900 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1300 | 45 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 652 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1774 | 99 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2341 | 239 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 637 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 622 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 622 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 652 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1231 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1070 | 97 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1210 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 652 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2310 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 650 | 54 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 652 | 45 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 651 | 51 | identity ok |
| PASS | mobile-430x932 | /managers | view | 653 | 31 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 651 | 26 | identity ok |
| PASS | mobile-430x932 | /compare | view | 653 | 57 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 650 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 636 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 649 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 639 | 57 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 686 | 46 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 638 | 48 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 640 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 639 | 25 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 651 | 51 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 651 | 54 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 636 | 60 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 648 | 61 | h1 ok |
| PASS | mobile-430x932 | /support | view | 653 | 25 | legal links present |
| PASS | mobile-430x932 | /terms | view | 648 | 25 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 639 | 25 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 633 | 27 | h1 ok |
| PASS | mobile-430x932 | /about | view | 641 | 26 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 649 | 46 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 896 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 654 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 637 | 45 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 640 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 901 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 639 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 639 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 653 | 46 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 653 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 635 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 776 | 46 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1302 | 48 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1305 | 48 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1305 | 54 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1303 | 64 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1052 | 68 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 638 | 48 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1042 | 49 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1058 | 50 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1042 | 46 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1042 | 54 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1041 | 54 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1323 | 68 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 638 | 47 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 653 | 57 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 651 | 47 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1280 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1049 | 32 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 890 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1412 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 652 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1783 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2345 | 256 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 637 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 635 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 635 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 622 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 624 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 637 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1219 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1087 | 103 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1229 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 652 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2312 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 177 | 22 | 5 | 20 | 48 | 0 | 0/0 | 76 | 2 | 164 | 4/164 | 419 | 0 |
| OK | desktop-1280x720 | /players | 128 | 33 | 10 | 30 | 52 | 0 | 0/0 | 93 | 0 | 106 | 4/79 | 422 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 126 | 34 | 12 | 31 | 48 | 0 | 0/0 | 95 | 0 | 387 | 4/387 | 418 | 0 |
| OK | desktop-1280x720 | /managers | 40 | 26 | 9 | 24 | 40 | 0 | 0/0 | 78 | 0 | 23 | 0/0 | 297 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 51 | 38 | 10 | 36 | 56 | 0 | 0/0 | 80 | 0 | 66 | 0/0 | 434 | 0 |
| OK | desktop-1280x720 | /squads | 106 | 26 | 7 | 24 | 324 | 0 | 0/0 | 92 | 3 | 24 | 0/0 | 296 | 0 |
| OK | desktop-1280x720 | /best-xi | 102 | 25 | 4 | 12 | 36 | 0 | 0/0 | 80 | 0 | 27 | 0/0 | 296 | 0 |
| OK | mobile-390x844 | / | 89 | 21 | 4 | 12 | 32 | 0 | 0/0 | 49 | 0 | 79 | 4/79 | 294 | 0 |
| OK | mobile-390x844 | /players | 66 | 32 | 10 | 30 | 48 | 0 | 0/0 | 44 | 2 | 47 | 4/47 | 419 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 75 | 34 | 11 | 32 | 44 | 0 | 0/0 | 50 | 1 | 336 | 4/336 | 417 | 0 |
| OK | mobile-390x844 | /managers | 38 | 25 | 8 | 24 | 40 | 0 | 0/0 | 31 | 1 | 17 | 0/0 | 297 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 58 | 34 | 9 | 32 | 48 | 0 | 0/0 | 47 | 1 | 91 | 0/0 | 419 | 0 |
| OK | mobile-390x844 | /squads | 46 | 25 | 6 | 24 | 316 | 0 | 0/0 | 49 | 1 | 23 | 0/0 | 295 | 0 |
| OK | mobile-390x844 | /best-xi | 63 | 23 | 4 | 11 | 28 | 0 | 0/0 | 57 | 0 | 25 | 0/0 | 294 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10967, 13170, 13172, 13172, 13172, 13173, 13172, 13173, 13175, 13194

## 公開範囲・セキュリティ

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | noindex meta |  |
| PASS | X-Robots-Tag noindex |  |
| PASS | no canonical/OG overriding noindex |  |
| PASS | robots.txt Disallow: / |  |
| PASS | sitemap 404 |  |
| PASS | no nav links to internal pages |  |
| PASS | no source maps | chunk .map → 404 |
| PASS | no debug endpoint /api/debug | status 404 |
| PASS | no debug endpoint /api/env | status 404 |
| PASS | no debug endpoint /api/health | status 404 |
| PASS | no debug endpoint /api/diagnostics | status 404 |
| PASS | no debug endpoint /api/admin | status 404 |
| PASS | no debug endpoint /diagnostics | status 404 |
| PASS | no open redirect (auth callback) | → /auth/sign-in |
| PASS | CORS not reflecting arbitrary origins with credentials | ACAO=none |
| PASS | search input rejection kept | status 400 |
| PASS | API responses carry no user data / no shared cache of user data | cache-control=public, max-age=60, stale-while-revalidate=300 |
| PASS | security headers | CSP, nosniff, X-Frame-Options |
