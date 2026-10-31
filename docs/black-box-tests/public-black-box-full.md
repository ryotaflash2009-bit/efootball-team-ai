# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-31T10:33:21.131Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.22)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 658 | 82 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 637 | 96 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 665 | 96 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 654 | 82 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 640 | 71 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 651 | 91 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 641 | 93 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 651 | 87 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 653 | 91 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 639 | 84 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 698 | 84 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 639 | 84 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 639 | 112 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 646 | 71 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 638 | 84 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 651 | 84 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 653 | 84 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 653 | 85 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 651 | 71 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 634 | 71 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 634 | 71 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 639 | 73 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 648 | 72 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 641 | 71 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 895 | 84 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 650 | 86 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 651 | 85 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 648 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 901 | 85 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 650 | 87 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 637 | 89 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 666 | 99 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 649 | 88 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 640 | 90 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 808 | 99 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1290 | 103 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1309 | 103 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1296 | 125 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1435 | 116 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1045 | 88 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 652 | 87 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1028 | 122 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1044 | 121 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1042 | 113 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1037 | 125 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1287 | 164 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1343 | 126 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 638 | 85 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 648 | 97 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 654 | 91 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 2789 | 178 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1284 | 88 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 923 | 101 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1430 | 87 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 636 | 86 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1766 | 183 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2351 | 401 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 650 | 88 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 636 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 639 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 638 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1224 | 91 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1783 | 262 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1088 | 165 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1225 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 639 | 90 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 649 | 89 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1882 | 263 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 668 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2319 | 86 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 854 | 88 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 647 | 93 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 652 | 98 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 653 | 99 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 651 | 87 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 653 | 73 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 655 | 93 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 648 | 95 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 638 | 89 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 650 | 94 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 652 | 86 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 711 | 85 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 652 | 86 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 641 | 138 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 649 | 73 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 637 | 86 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 640 | 86 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 654 | 86 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 653 | 87 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 654 | 75 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 654 | 73 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 656 | 73 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 636 | 75 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 640 | 74 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 647 | 73 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 902 | 86 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 651 | 88 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 637 | 87 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 639 | 87 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 895 | 87 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 651 | 87 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 652 | 89 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 645 | 99 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 651 | 88 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 637 | 90 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 695 | 99 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1300 | 110 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1298 | 110 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1299 | 125 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1300 | 116 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1049 | 106 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 653 | 87 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1067 | 122 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1038 | 121 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1282 | 113 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1298 | 125 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 214 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1034 | 164 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1329 | 139 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 623 | 85 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 634 | 89 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 650 | 91 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1303 | 103 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1060 | 91 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 909 | 104 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1418 | 87 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 636 | 88 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1803 | 183 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2359 | 401 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 651 | 88 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 634 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 633 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 631 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 637 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1353 | 91 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1090 | 179 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 653 | 90 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 663 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2315 | 88 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 647 | 93 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 653 | 116 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 651 | 99 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 654 | 90 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 650 | 88 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 649 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 638 | 97 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 651 | 89 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 651 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 654 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 719 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 637 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 641 | 142 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 635 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 636 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 653 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 653 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 650 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 652 | 75 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 650 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 650 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 638 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 650 | 74 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 652 | 73 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 891 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 642 | 88 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 651 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 653 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 896 | 87 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 649 | 87 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 646 | 89 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 657 | 117 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 635 | 88 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 648 | 90 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 699 | 117 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1305 | 128 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1306 | 128 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1302 | 152 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1582 | 134 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1063 | 108 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 636 | 87 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1060 | 135 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1040 | 145 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1033 | 149 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1052 | 150 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1106 | 182 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1365 | 145 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 646 | 85 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 669 | 89 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 651 | 91 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1533 | 106 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1070 | 94 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 906 | 107 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1443 | 87 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 649 | 88 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1794 | 183 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2359 | 405 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 653 | 88 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 651 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 635 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 640 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 634 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 633 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1233 | 91 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1076 | 179 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1243 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 653 | 90 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 656 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2320 | 88 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 648 | 63 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 651 | 60 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 665 | 67 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 647 | 36 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 650 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 650 | 59 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 652 | 64 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 648 | 49 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 650 | 57 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 638 | 62 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 717 | 54 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 633 | 49 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 637 | 99 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 651 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 653 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 649 | 59 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 648 | 65 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 655 | 66 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 636 | 34 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 640 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 639 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 633 | 45 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 638 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 652 | 48 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 885 | 45 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 638 | 48 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 622 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 651 | 47 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 900 | 47 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 652 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 648 | 47 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 667 | 61 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 638 | 48 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 651 | 48 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 688 | 61 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1310 | 66 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1300 | 66 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1304 | 85 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1303 | 80 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1060 | 74 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 652 | 49 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1037 | 66 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1058 | 73 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1048 | 65 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1035 | 85 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1050 | 128 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1352 | 97 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 653 | 48 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 626 | 50 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 647 | 52 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1283 | 59 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1048 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 929 | 58 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1417 | 46 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 651 | 49 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1796 | 101 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2334 | 271 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 650 | 49 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 641 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 627 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 620 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 631 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 633 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1244 | 50 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1070 | 113 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 652 | 52 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 655 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2301 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 648 | 71 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 654 | 60 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 656 | 67 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 654 | 38 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 652 | 48 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 649 | 59 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 639 | 66 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 639 | 49 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 638 | 57 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 640 | 62 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 716 | 54 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 635 | 49 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 639 | 108 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 652 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 650 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 652 | 59 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 648 | 65 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 651 | 66 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 626 | 34 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 642 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 633 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 649 | 45 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 637 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 652 | 48 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 899 | 45 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 648 | 48 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 650 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 636 | 47 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 896 | 47 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 651 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 650 | 47 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 641 | 61 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 653 | 48 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 651 | 48 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 684 | 61 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1312 | 74 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1305 | 74 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1304 | 85 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1301 | 80 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1053 | 88 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 650 | 49 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1038 | 74 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1060 | 81 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1061 | 73 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1042 | 85 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1061 | 128 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1331 | 97 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 651 | 48 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 627 | 50 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 652 | 63 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1295 | 68 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1031 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 902 | 62 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1303 | 46 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 656 | 49 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1748 | 101 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2327 | 275 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 656 | 49 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 635 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 648 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 634 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 640 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 638 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1213 | 50 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1086 | 121 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1239 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 652 | 52 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2329 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 650 | 52 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 653 | 44 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 666 | 51 | identity ok |
| PASS | mobile-390x844 | /managers | view | 649 | 31 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 650 | 26 | identity ok |
| PASS | mobile-390x844 | /compare | view | 649 | 59 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 639 | 50 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 650 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 652 | 57 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 650 | 62 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 718 | 48 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 644 | 49 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 638 | 78 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 650 | 25 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 644 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 649 | 59 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 635 | 56 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 652 | 66 | h1 ok |
| PASS | mobile-390x844 | /support | view | 649 | 25 | legal links present |
| PASS | mobile-390x844 | /terms | view | 646 | 25 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 646 | 25 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 640 | 27 | h1 ok |
| PASS | mobile-390x844 | /about | view | 651 | 26 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 651 | 48 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 900 | 45 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 653 | 48 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 654 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 650 | 47 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 896 | 47 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 655 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 652 | 47 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 666 | 45 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 648 | 48 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 649 | 48 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 682 | 45 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1294 | 47 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1301 | 47 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1312 | 53 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1299 | 64 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1057 | 65 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 638 | 49 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1041 | 48 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1055 | 49 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1054 | 45 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1043 | 53 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 212 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1041 | 72 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1319 | 68 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 649 | 48 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 655 | 48 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 655 | 48 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1294 | 54 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1048 | 32 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 924 | 53 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1432 | 46 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 649 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1773 | 101 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2333 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 649 | 49 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 635 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 634 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 623 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1228 | 50 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1788 | 182 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1085 | 102 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 654 | 52 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 650 | 51 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1766 | 181 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 653 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2316 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 795 | 52 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 651 | 52 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 654 | 44 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 638 | 50 | identity ok |
| PASS | mobile-393x852 | /managers | view | 652 | 31 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 652 | 26 | identity ok |
| PASS | mobile-393x852 | /compare | view | 649 | 59 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 650 | 50 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 651 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 655 | 58 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 640 | 62 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 702 | 48 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 640 | 49 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 654 | 78 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 636 | 25 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 637 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 640 | 59 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 652 | 56 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 650 | 66 | h1 ok |
| PASS | mobile-393x852 | /support | view | 653 | 25 | legal links present |
| PASS | mobile-393x852 | /terms | view | 650 | 25 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 640 | 25 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 638 | 27 | h1 ok |
| PASS | mobile-393x852 | /about | view | 652 | 26 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 646 | 48 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 901 | 45 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 649 | 48 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 639 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 652 | 47 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 900 | 47 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 652 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 651 | 47 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 654 | 45 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 651 | 48 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 649 | 48 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 669 | 45 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1297 | 47 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1289 | 47 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1297 | 53 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1316 | 64 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1043 | 65 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 653 | 49 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1054 | 50 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1055 | 49 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1051 | 45 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1045 | 53 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 212 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1048 | 80 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1317 | 68 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 648 | 48 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 652 | 48 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 639 | 48 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1537 | 54 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1053 | 32 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 914 | 53 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1425 | 46 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 649 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1757 | 101 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2336 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 638 | 49 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 638 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 618 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 624 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 669 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 623 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1215 | 50 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1088 | 102 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1231 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 652 | 52 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 667 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2325 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 649 | 58 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 653 | 44 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 641 | 49 | identity ok |
| PASS | mobile-430x932 | /managers | view | 651 | 31 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 650 | 26 | identity ok |
| PASS | mobile-430x932 | /compare | view | 652 | 59 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 651 | 50 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 639 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 639 | 57 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 637 | 62 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 689 | 50 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 621 | 49 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 640 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 638 | 25 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 651 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 640 | 59 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 652 | 65 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 638 | 66 | h1 ok |
| PASS | mobile-430x932 | /support | view | 651 | 25 | legal links present |
| PASS | mobile-430x932 | /terms | view | 651 | 25 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 638 | 25 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 649 | 27 | h1 ok |
| PASS | mobile-430x932 | /about | view | 650 | 26 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 652 | 48 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 887 | 45 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 649 | 48 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 651 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 652 | 47 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 901 | 47 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 642 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 651 | 47 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 652 | 45 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 650 | 48 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 637 | 48 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 795 | 45 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1307 | 47 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1322 | 47 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1308 | 53 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1301 | 64 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1055 | 71 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 649 | 49 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1059 | 48 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1055 | 49 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1059 | 45 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1045 | 53 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 213 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1038 | 80 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1318 | 67 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 650 | 48 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 650 | 48 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 653 | 48 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1285 | 54 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1042 | 32 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 914 | 53 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1307 | 46 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 651 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1781 | 101 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2345 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 656 | 49 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 624 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 623 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 623 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 635 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1216 | 50 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1088 | 108 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1248 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 650 | 52 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 647 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2312 | 50 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 184 | 23 | 4 | 16 | 40 | 0 | 0/0 | 80 | 2 | 169 | 4/169 | 294 | 0 |
| OK | desktop-1280x720 | /players | 161 | 36 | 11 | 33 | 56 | 0 | 0/0 | 96 | 0 | 125 | 4/90 | 430 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 191 | 37 | 14 | 35 | 56 | 0 | 0/0 | 96 | 0 | 395 | 4/395 | 438 | 0 |
| OK | desktop-1280x720 | /managers | 48 | 27 | 8 | 25 | 48 | 0 | 0/0 | 82 | 0 | 25 | 0/0 | 312 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 76 | 39 | 11 | 37 | 60 | 0 | 0/0 | 83 | 0 | 66 | 0/0 | 435 | 0 |
| OK | desktop-1280x720 | /squads | 55 | 28 | 7 | 26 | 320 | 0 | 0/0 | 96 | 3 | 37 | 0/0 | 294 | 0 |
| OK | desktop-1280x720 | /best-xi | 54 | 26 | 4 | 13 | 44 | 0 | 0/0 | 84 | 0 | 33 | 0/0 | 393 | 0 |
| OK | mobile-390x844 | / | 98 | 21 | 4 | 14 | 36 | 0 | 0/0 | 53 | 0 | 88 | 4/88 | 294 | 0 |
| OK | mobile-390x844 | /players | 91 | 33 | 10 | 31 | 48 | 0 | 0/0 | 43 | 2 | 75 | 4/75 | 432 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 72 | 35 | 12 | 33 | 44 | 0 | 0/0 | 49 | 1 | 365 | 4/365 | 434 | 0 |
| OK | mobile-390x844 | /managers | 66 | 31 | 11 | 29 | 48 | 0 | 0/0 | 31 | 1 | 22 | 0/0 | 431 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 69 | 39 | 11 | 37 | 52 | 0 | 0/0 | 48 | 1 | 33 | 0/0 | 433 | 0 |
| OK | mobile-390x844 | /squads | 86 | 25 | 6 | 24 | 316 | 0 | 0/0 | 50 | 1 | 25 | 0/0 | 293 | 0 |
| OK | mobile-390x844 | /best-xi | 94 | 30 | 5 | 14 | 40 | 0 | 0/0 | 62 | 0 | 40 | 0/0 | 295 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10833, 13239, 13247, 13244, 13242, 13241, 13241, 13242, 13245, 13243

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
