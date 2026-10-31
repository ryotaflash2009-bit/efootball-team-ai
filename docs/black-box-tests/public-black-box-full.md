# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-31T12:22:05.465Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.22)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 667 | 82 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 657 | 96 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 663 | 96 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 654 | 82 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 647 | 71 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 644 | 91 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 656 | 93 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 638 | 87 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 636 | 91 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 656 | 84 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 691 | 84 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 641 | 84 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 639 | 112 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 633 | 71 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 640 | 84 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 640 | 84 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 652 | 84 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 653 | 85 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 639 | 71 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 637 | 71 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 653 | 71 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 640 | 73 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 652 | 72 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 653 | 71 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 886 | 84 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 649 | 86 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 652 | 85 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 637 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 884 | 85 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 637 | 87 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 640 | 89 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 651 | 99 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 651 | 88 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 638 | 90 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 808 | 99 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1303 | 103 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1308 | 103 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1302 | 125 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1304 | 116 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1046 | 88 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 654 | 87 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1036 | 122 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1040 | 121 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1279 | 113 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1278 | 125 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1288 | 164 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1321 | 126 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 654 | 93 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 627 | 89 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 651 | 91 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 3058 | 178 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1290 | 88 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 913 | 101 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1414 | 87 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 658 | 86 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1787 | 183 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2326 | 401 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 650 | 88 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 629 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 623 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 624 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1222 | 91 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1786 | 266 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1078 | 165 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1210 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 655 | 90 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 643 | 89 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1878 | 263 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 662 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2326 | 86 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 840 | 88 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 651 | 93 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 654 | 98 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 647 | 100 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 651 | 87 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 637 | 73 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 635 | 93 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 649 | 95 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 652 | 89 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 641 | 94 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 651 | 86 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 716 | 85 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 637 | 86 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 641 | 138 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 637 | 73 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 639 | 86 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 650 | 86 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 653 | 86 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 648 | 87 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 642 | 75 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 651 | 73 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 633 | 73 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 634 | 75 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 651 | 74 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 648 | 73 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 899 | 86 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 650 | 88 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 631 | 87 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 637 | 87 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 885 | 87 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 634 | 87 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 652 | 89 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 650 | 99 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 637 | 88 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 637 | 90 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 681 | 99 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1299 | 110 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1302 | 110 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1292 | 125 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1303 | 116 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1054 | 106 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 643 | 87 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1043 | 110 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1053 | 121 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1287 | 113 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1039 | 125 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 201 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1274 | 164 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1348 | 138 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 650 | 85 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 648 | 89 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 654 | 91 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1301 | 103 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1035 | 91 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 908 | 104 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1415 | 87 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 645 | 88 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1767 | 183 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2338 | 386 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 649 | 88 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 634 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 631 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 631 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1253 | 91 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1086 | 179 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1231 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 655 | 90 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 665 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2318 | 88 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 644 | 93 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 652 | 116 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 638 | 99 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 661 | 90 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 651 | 88 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 649 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 654 | 97 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 649 | 89 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 645 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 632 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 694 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 631 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 638 | 142 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 643 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 646 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 646 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 649 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 646 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 653 | 75 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 647 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 651 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 648 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 646 | 74 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 649 | 73 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 903 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 650 | 88 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 648 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 636 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 889 | 87 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 651 | 87 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 623 | 89 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 652 | 117 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 645 | 88 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 634 | 90 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 715 | 117 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1314 | 128 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1321 | 128 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1285 | 155 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1296 | 134 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1057 | 108 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 635 | 87 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1040 | 135 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1056 | 151 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1066 | 147 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1043 | 161 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 213 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1057 | 161 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1330 | 144 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 650 | 85 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 652 | 89 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 656 | 91 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1306 | 106 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1028 | 94 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 913 | 107 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1416 | 87 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 650 | 88 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1767 | 183 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2335 | 405 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 652 | 88 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 622 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 623 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 623 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 620 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 639 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 632 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 639 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1339 | 91 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1075 | 179 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1242 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 643 | 90 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2329 | 88 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 649 | 63 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 655 | 60 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 653 | 66 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 654 | 36 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 651 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 648 | 59 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 650 | 64 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 655 | 49 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 638 | 57 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 650 | 62 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 702 | 54 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 624 | 49 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 638 | 99 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 640 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 640 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 652 | 59 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 638 | 65 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 658 | 66 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 633 | 34 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 641 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 637 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 648 | 45 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 649 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 641 | 48 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 899 | 45 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 638 | 48 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 637 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 636 | 47 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 889 | 47 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 651 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 641 | 47 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 652 | 61 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 653 | 48 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 651 | 48 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 698 | 61 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1319 | 66 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1322 | 66 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1311 | 85 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1318 | 80 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1057 | 74 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 655 | 49 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1070 | 74 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1070 | 73 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1077 | 65 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1065 | 85 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 208 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1056 | 117 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1370 | 97 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 666 | 48 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 672 | 50 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 667 | 52 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1312 | 59 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1067 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 942 | 58 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1340 | 46 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 649 | 49 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1785 | 101 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2393 | 271 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 651 | 49 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 640 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 640 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 633 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 628 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 630 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1364 | 50 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1080 | 113 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1231 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 654 | 52 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 665 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2392 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 650 | 71 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 669 | 60 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 656 | 66 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 665 | 38 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 747 | 48 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 655 | 59 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 650 | 66 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 653 | 49 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 656 | 57 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 665 | 62 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 826 | 54 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 663 | 49 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 644 | 108 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 665 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 653 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 638 | 59 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 653 | 65 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 652 | 66 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 652 | 34 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 651 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 652 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 649 | 45 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 639 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 656 | 48 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 901 | 45 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 649 | 48 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 637 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 653 | 47 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 904 | 47 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 649 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 659 | 47 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 667 | 61 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 664 | 48 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 658 | 48 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 710 | 61 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1332 | 74 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1337 | 74 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1326 | 85 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1325 | 80 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1077 | 88 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 660 | 49 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1058 | 74 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1070 | 81 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1096 | 73 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1060 | 85 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1058 | 104 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1372 | 97 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 667 | 48 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 668 | 50 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 665 | 52 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1294 | 61 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1134 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 959 | 62 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1451 | 46 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 651 | 49 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1794 | 101 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2346 | 275 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 639 | 49 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 639 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 635 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 639 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1215 | 50 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1076 | 121 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1219 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 655 | 52 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 652 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2313 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 647 | 52 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 671 | 44 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 664 | 50 | identity ok |
| PASS | mobile-390x844 | /managers | view | 652 | 31 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 652 | 26 | identity ok |
| PASS | mobile-390x844 | /compare | view | 622 | 59 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 650 | 50 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 648 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 637 | 57 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 638 | 62 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 717 | 48 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 635 | 49 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 640 | 78 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 637 | 25 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 652 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 639 | 59 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 639 | 56 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 653 | 66 | h1 ok |
| PASS | mobile-390x844 | /support | view | 651 | 25 | legal links present |
| PASS | mobile-390x844 | /terms | view | 643 | 25 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 647 | 25 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 649 | 27 | h1 ok |
| PASS | mobile-390x844 | /about | view | 638 | 26 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 651 | 48 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 887 | 45 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 652 | 48 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 649 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 637 | 47 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 898 | 47 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 639 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 636 | 47 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 652 | 45 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 651 | 48 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 633 | 48 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 793 | 45 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1304 | 47 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1285 | 47 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1312 | 53 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1310 | 64 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1039 | 65 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 650 | 49 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1043 | 50 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1045 | 49 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1050 | 45 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1045 | 53 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 214 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1029 | 76 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1320 | 68 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 654 | 48 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 650 | 48 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 661 | 48 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1307 | 54 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1055 | 32 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 911 | 53 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1299 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 648 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1779 | 101 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2326 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 650 | 49 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 632 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 631 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 633 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 632 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1229 | 50 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1778 | 182 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1063 | 102 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1236 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 651 | 52 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 651 | 51 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1765 | 182 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2312 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 806 | 52 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 651 | 52 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 638 | 44 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 633 | 50 | identity ok |
| PASS | mobile-393x852 | /managers | view | 651 | 31 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 651 | 26 | identity ok |
| PASS | mobile-393x852 | /compare | view | 631 | 59 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 649 | 50 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 647 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 639 | 58 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 650 | 62 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 700 | 48 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 641 | 49 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 648 | 78 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 654 | 25 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 648 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 650 | 59 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 634 | 56 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 639 | 66 | h1 ok |
| PASS | mobile-393x852 | /support | view | 648 | 25 | legal links present |
| PASS | mobile-393x852 | /terms | view | 632 | 25 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 637 | 25 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 651 | 27 | h1 ok |
| PASS | mobile-393x852 | /about | view | 650 | 26 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 651 | 48 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 898 | 45 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 649 | 48 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 648 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 648 | 47 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 900 | 47 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 647 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 649 | 47 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 646 | 45 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 646 | 48 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 648 | 48 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 668 | 45 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1297 | 47 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1299 | 47 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1309 | 53 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1298 | 64 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1054 | 65 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 646 | 49 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1043 | 50 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1051 | 49 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1052 | 45 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1041 | 53 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 214 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1051 | 76 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1328 | 68 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 650 | 48 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 649 | 48 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 649 | 48 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1288 | 54 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1047 | 32 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 898 | 53 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1440 | 46 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 650 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1767 | 101 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2323 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 645 | 49 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 638 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 634 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 633 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 633 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 632 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1253 | 50 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1080 | 102 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 651 | 52 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2316 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 643 | 58 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 647 | 44 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 652 | 49 | identity ok |
| PASS | mobile-430x932 | /managers | view | 653 | 31 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 650 | 26 | identity ok |
| PASS | mobile-430x932 | /compare | view | 646 | 59 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 648 | 50 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 637 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 650 | 57 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 651 | 62 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 684 | 50 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 634 | 49 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 649 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 649 | 25 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 632 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 652 | 59 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 635 | 65 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 649 | 66 | h1 ok |
| PASS | mobile-430x932 | /support | view | 650 | 25 | legal links present |
| PASS | mobile-430x932 | /terms | view | 637 | 25 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 648 | 25 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 649 | 27 | h1 ok |
| PASS | mobile-430x932 | /about | view | 638 | 26 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 651 | 48 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 896 | 45 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 649 | 48 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 637 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 636 | 47 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 896 | 47 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 647 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 651 | 47 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 651 | 45 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 638 | 48 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 635 | 48 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 665 | 45 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1301 | 47 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1287 | 47 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1296 | 53 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1306 | 64 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1052 | 71 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 649 | 49 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1041 | 48 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1057 | 49 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1054 | 45 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1048 | 53 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1032 | 76 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1318 | 69 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 651 | 48 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 652 | 48 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 651 | 48 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1288 | 54 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1047 | 32 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 908 | 53 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1412 | 46 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 650 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1783 | 101 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2349 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 651 | 49 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 631 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 624 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 626 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 622 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 622 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1197 | 50 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1067 | 108 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1232 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 642 | 52 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2310 | 50 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 158 | 26 | 5 | 16 | 44 | 0 | 0/0 | 80 | 2 | 142 | 4/142 | 294 | 0 |
| OK | desktop-1280x720 | /players | 86 | 38 | 11 | 35 | 64 | 0 | 0/0 | 96 | 0 | 124 | 4/52 | 434 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 147 | 36 | 12 | 34 | 52 | 0 | 0/0 | 96 | 0 | 402 | 4/402 | 432 | 0 |
| OK | desktop-1280x720 | /managers | 47 | 29 | 10 | 27 | 48 | 0 | 0/0 | 82 | 0 | 27 | 0/0 | 416 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 61 | 41 | 11 | 39 | 60 | 0 | 0/0 | 83 | 0 | 57 | 0/0 | 434 | 0 |
| OK | desktop-1280x720 | /squads | 53 | 28 | 7 | 26 | 320 | 0 | 0/0 | 96 | 3 | 29 | 0/0 | 295 | 0 |
| OK | desktop-1280x720 | /best-xi | 57 | 29 | 5 | 13 | 40 | 0 | 0/0 | 84 | 0 | 37 | 0/0 | 295 | 0 |
| OK | mobile-390x844 | / | 114 | 25 | 4 | 15 | 40 | 0 | 0/0 | 53 | 0 | 103 | 4/103 | 418 | 0 |
| OK | mobile-390x844 | /players | 87 | 34 | 10 | 32 | 52 | 0 | 0/0 | 43 | 0 | 68 | 4/68 | 430 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 87 | 34 | 11 | 32 | 44 | 0 | 0/0 | 49 | 1 | 365 | 4/365 | 433 | 0 |
| OK | mobile-390x844 | /managers | 41 | 27 | 9 | 26 | 44 | 0 | 0/0 | 31 | 1 | 20 | 0/0 | 308 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 71 | 36 | 10 | 34 | 52 | 0 | 0/0 | 48 | 1 | 67 | 0/0 | 433 | 0 |
| OK | mobile-390x844 | /squads | 73 | 27 | 7 | 26 | 316 | 0 | 0/0 | 50 | 1 | 24 | 0/0 | 294 | 0 |
| OK | mobile-390x844 | /best-xi | 47 | 24 | 4 | 12 | 32 | 0 | 0/0 | 62 | 0 | 30 | 0/0 | 296 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10904, 13264, 13264, 13263, 13262, 13259, 13262, 13263, 13273, 13266

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
