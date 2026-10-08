# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-08T18:15:30.654Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,372 / Managers 69

**画面・操作: 576/576 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.24)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 776 | 61 | World 13,372 |
| PASS | desktop-1280x720 | /players | view | 663 | 80 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 685 | 74 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 657 | 66 | managers 69 |
| PASS | desktop-1280x720 | /managers/65 | view | 658 | 55 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 654 | 71 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 669 | 73 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 634 | 68 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 652 | 72 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 657 | 65 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 668 | 65 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 652 | 65 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 656 | 65 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 693 | 65 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 655 | 55 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 657 | 55 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 674 | 55 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 660 | 57 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 640 | 55 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 656 | 55 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 654 | 70 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 653 | 67 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 655 | 67 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 662 | 66 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 808 | 66 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 640 | 66 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 670 | 66 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 670 | 81 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 673 | 67 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 666 | 67 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 796 | 81 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1320 | 101 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1338 | 101 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1318 | 105 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1335 | 93 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1073 | 86 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 653 | 66 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1077 | 101 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1076 | 101 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1063 | 93 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1347 | 105 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 218 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1061 | 141 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1332 | 112 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 684 | 63 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 670 | 65 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 681 | 67 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1316 | 79 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1073 | 68 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 946 | 78 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1323 | 66 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 664 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1814 | 137 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2403 | 291 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 650 | 67 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 653 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 654 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 653 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 646 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 656 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 652 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 652 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 652 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 657 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1242 | 68 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 2106 | 193 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1084 | 125 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1263 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 663 | 67 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 656 | 65 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1816 | 198 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 671 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2375 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 893 | 67 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 662 | 72 | World 13,372 |
| PASS | desktop-1440x900 | /players | view | 652 | 92 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 682 | 74 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 656 | 69 | managers 69 |
| PASS | desktop-1440x900 | /managers/65 | view | 657 | 55 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 662 | 71 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 656 | 73 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 653 | 68 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 651 | 73 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 657 | 65 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 661 | 65 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 659 | 65 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 649 | 65 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 668 | 65 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 659 | 57 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 655 | 55 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 653 | 55 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 654 | 57 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 655 | 55 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 697 | 55 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 662 | 70 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 650 | 67 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 655 | 67 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 648 | 66 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 907 | 66 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 667 | 66 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 651 | 66 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 671 | 93 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 651 | 67 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 674 | 67 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 687 | 93 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1331 | 113 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1328 | 113 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1330 | 117 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1322 | 105 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1307 | 96 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 651 | 66 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1329 | 113 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1067 | 109 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1061 | 105 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1040 | 129 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 219 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1054 | 147 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1378 | 112 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 653 | 63 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 692 | 65 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 671 | 67 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1333 | 82 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1066 | 71 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 1059 | 81 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1323 | 66 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 649 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1820 | 137 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2394 | 303 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 667 | 67 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 639 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 652 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 641 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 650 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 641 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 670 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 649 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 650 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 648 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 653 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1241 | 68 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1107 | 137 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1259 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 655 | 67 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 681 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2378 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 907 | 98 | World 13,372 |
| PASS | desktop-1920x1080 | /players | view | 656 | 98 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 666 | 74 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 671 | 72 | managers 69 |
| PASS | desktop-1920x1080 | /managers/65 | view | 672 | 67 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 653 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 667 | 75 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 657 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 654 | 72 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 650 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 650 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 650 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 671 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 661 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 652 | 57 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 657 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 668 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 664 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 668 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 658 | 55 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 663 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 639 | 67 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 655 | 67 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 666 | 66 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 812 | 66 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 662 | 66 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 656 | 66 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 670 | 99 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 653 | 67 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 655 | 67 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 703 | 99 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1316 | 135 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1354 | 135 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1319 | 135 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1326 | 111 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1074 | 130 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 653 | 66 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1070 | 135 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1094 | 131 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1045 | 127 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1106 | 141 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 219 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1044 | 159 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1345 | 118 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 665 | 63 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 688 | 65 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 670 | 67 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1304 | 85 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1067 | 74 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 938 | 84 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1313 | 66 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 660 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1803 | 137 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2446 | 307 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 653 | 67 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 648 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 641 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 653 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 649 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 654 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 652 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 653 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1247 | 68 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1100 | 153 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1239 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 641 | 67 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 666 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2381 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 648 | 57 | World 13,372 |
| PASS | tablet-768x1024 | /players | view | 683 | 52 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 687 | 52 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 670 | 31 | managers 69 |
| PASS | tablet-768x1024 | /managers/65 | view | 680 | 21 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 669 | 49 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 655 | 54 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 651 | 41 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 653 | 48 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 650 | 52 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 640 | 44 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 654 | 48 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 655 | 54 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 648 | 54 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 641 | 29 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 648 | 20 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 653 | 20 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 649 | 37 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 655 | 20 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 648 | 42 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 655 | 42 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 650 | 40 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 651 | 39 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 654 | 39 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 906 | 39 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 651 | 39 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 654 | 39 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 668 | 53 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 655 | 40 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 649 | 40 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 687 | 53 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1306 | 73 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1299 | 73 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1304 | 77 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1317 | 68 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1069 | 81 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 651 | 40 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1071 | 73 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1060 | 73 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1047 | 65 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1068 | 77 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 219 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1091 | 77 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1355 | 79 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 667 | 38 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 667 | 40 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 669 | 42 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1574 | 51 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1076 | 33 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 927 | 50 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1451 | 38 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 650 | 41 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1807 | 85 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2360 | 223 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 651 | 41 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 642 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 634 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 649 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 642 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 632 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 637 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1370 | 42 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1332 | 99 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1243 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 654 | 44 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 665 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2379 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 652 | 57 | World 13,372 |
| PASS | tablet-820x1180 | /players | view | 669 | 52 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 674 | 52 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 667 | 33 | managers 69 |
| PASS | tablet-820x1180 | /managers/65 | view | 666 | 40 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 652 | 49 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 659 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 662 | 41 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 653 | 48 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 649 | 52 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 657 | 44 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 668 | 48 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 655 | 54 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 649 | 54 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 654 | 29 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 652 | 20 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 641 | 20 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 654 | 37 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 649 | 20 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 652 | 42 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 649 | 42 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 656 | 40 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 656 | 39 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 649 | 39 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 807 | 39 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 649 | 39 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 652 | 39 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 671 | 53 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 653 | 40 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 635 | 40 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 672 | 53 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1320 | 73 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1323 | 73 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1319 | 77 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1322 | 68 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1068 | 81 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 653 | 40 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1058 | 73 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1069 | 73 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1070 | 65 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1052 | 77 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 208 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1063 | 92 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1342 | 79 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 661 | 38 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 670 | 40 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 669 | 42 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1316 | 53 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1081 | 35 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 933 | 52 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1334 | 38 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 657 | 41 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1817 | 85 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2380 | 227 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 652 | 41 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 655 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 644 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 654 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 650 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 654 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 655 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 654 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 656 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 651 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 649 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1220 | 42 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1086 | 99 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1243 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 667 | 44 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 648 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2373 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 647 | 42 | World 13,372 |
| PASS | mobile-390x844 | /players | view | 653 | 36 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 654 | 39 | identity ok |
| PASS | mobile-390x844 | /managers | view | 654 | 26 | managers 69 |
| PASS | mobile-390x844 | /managers/65 | view | 649 | 21 | identity ok |
| PASS | mobile-390x844 | /compare | view | 659 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 664 | 41 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 652 | 41 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 650 | 48 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 652 | 52 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 647 | 44 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 656 | 48 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 664 | 47 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 651 | 54 | h1 ok |
| PASS | mobile-390x844 | /support | view | 654 | 20 | legal links present |
| PASS | mobile-390x844 | /terms | view | 655 | 20 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 655 | 20 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 648 | 22 | h1 ok |
| PASS | mobile-390x844 | /about | view | 654 | 20 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 653 | 42 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 663 | 42 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 652 | 40 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 654 | 39 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 651 | 39 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 829 | 39 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 662 | 39 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 654 | 39 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 670 | 37 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 651 | 40 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 656 | 40 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 675 | 37 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1318 | 41 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1310 | 41 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1335 | 45 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1331 | 52 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1054 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 652 | 40 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1077 | 41 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1072 | 45 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1075 | 41 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1053 | 45 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1036 | 45 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1352 | 53 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 670 | 38 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 667 | 38 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 673 | 38 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1316 | 46 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1061 | 27 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 930 | 45 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1324 | 38 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 647 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1792 | 85 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2392 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 661 | 41 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 662 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 650 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 651 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 657 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 648 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 667 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 649 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1232 | 42 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1689 | 143 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1335 | 84 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1251 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 667 | 44 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 652 | 42 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1858 | 146 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 668 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2375 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 838 | 44 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 925 | 42 | World 13,372 |
| PASS | mobile-393x852 | /players | view | 667 | 36 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 666 | 38 | identity ok |
| PASS | mobile-393x852 | /managers | view | 667 | 26 | managers 69 |
| PASS | mobile-393x852 | /managers/65 | view | 655 | 21 | identity ok |
| PASS | mobile-393x852 | /compare | view | 651 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 657 | 41 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 650 | 41 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 641 | 49 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 651 | 52 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 668 | 44 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 658 | 48 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 652 | 47 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 654 | 54 | h1 ok |
| PASS | mobile-393x852 | /support | view | 655 | 20 | legal links present |
| PASS | mobile-393x852 | /terms | view | 641 | 20 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 653 | 20 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 645 | 22 | h1 ok |
| PASS | mobile-393x852 | /about | view | 653 | 20 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 652 | 42 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 652 | 42 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 672 | 40 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 667 | 39 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 654 | 39 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 871 | 39 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 653 | 39 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 654 | 39 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 652 | 37 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 669 | 40 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 650 | 40 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 671 | 37 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1338 | 41 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1332 | 41 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1324 | 45 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1314 | 52 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1066 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 649 | 40 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1044 | 41 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1083 | 45 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1070 | 41 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1052 | 45 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 214 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1077 | 45 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1348 | 53 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 700 | 38 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 682 | 38 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 953 | 38 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1319 | 46 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1088 | 27 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 947 | 45 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1466 | 38 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 653 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1804 | 85 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2391 | 200 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 651 | 41 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 650 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 636 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 652 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 653 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 652 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 648 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1371 | 42 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1099 | 84 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1248 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 666 | 44 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 670 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2352 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 642 | 48 | World 13,372 |
| PASS | mobile-430x932 | /players | view | 651 | 36 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 666 | 38 | identity ok |
| PASS | mobile-430x932 | /managers | view | 667 | 26 | managers 69 |
| PASS | mobile-430x932 | /managers/65 | view | 653 | 21 | identity ok |
| PASS | mobile-430x932 | /compare | view | 654 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 654 | 41 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 654 | 41 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 640 | 48 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 651 | 52 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 648 | 44 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 671 | 48 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 649 | 47 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 641 | 54 | h1 ok |
| PASS | mobile-430x932 | /support | view | 647 | 20 | legal links present |
| PASS | mobile-430x932 | /terms | view | 653 | 20 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 649 | 20 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 658 | 22 | h1 ok |
| PASS | mobile-430x932 | /about | view | 651 | 20 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 655 | 42 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 637 | 42 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 651 | 40 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 673 | 39 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 663 | 39 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 811 | 39 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 639 | 39 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 650 | 39 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 670 | 37 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 652 | 40 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 653 | 40 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 669 | 37 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1351 | 41 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1305 | 41 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1332 | 45 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1320 | 52 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1086 | 58 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 660 | 40 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1045 | 41 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1070 | 45 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1059 | 41 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1084 | 45 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 218 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1041 | 68 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1353 | 53 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 689 | 38 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 666 | 38 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 939 | 38 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1305 | 46 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1080 | 27 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 945 | 45 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1333 | 38 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 652 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1796 | 85 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2386 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 655 | 41 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 642 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 665 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 649 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 628 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 650 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 654 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 646 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1365 | 42 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1347 | 90 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1260 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 665 | 44 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 669 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2362 | 42 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 239 | 44 | 14 | 42 | 64 | 0 | 0/0 | 61 | 0 | 211 | 4/211 | 447 | 0 |
| OK | desktop-1280x720 | /players | 178 | 58 | 14 | 53 | 88 | 0 | 0/0 | 81 | 0 | 284 | 4/159 | 447 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 194 | 115 | 57 | 112 | 128 | 0 | 0/0 | 75 | 0 | 123 | 2/123 | 491 | 0 |
| OK | desktop-1280x720 | /managers | 97 | 44 | 18 | 42 | 68 | 0 | 0/0 | 67 | 0 | 37 | 0/0 | 450 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 86 | 71 | 22 | 68 | 100 | 0 | 0/0 | 64 | 0 | 65 | 0/0 | 466 | 0 |
| OK | desktop-1280x720 | /squads | 141 | 41 | 10 | 39 | 324 | 0 | 0/0 | 77 | 0 | 42 | 0/0 | 417 | 0 |
| OK | desktop-1280x720 | /best-xi | 64 | 25 | 5 | 15 | 40 | 0 | 0/0 | 66 | 0 | 66 | 0/0 | 293 | 0 |
| OK | mobile-390x844 | / | 167 | 57 | 17 | 55 | 76 | 0 | 0/0 | 43 | 0 | 150 | 4/150 | 448 | 0 |
| OK | mobile-390x844 | /players | 131 | 35 | 14 | 33 | 52 | 0 | 0/0 | 37 | 0 | 113 | 4/113 | 433 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 111 | 51 | 27 | 49 | 68 | 0 | 0/0 | 39 | 0 | 75 | 2/56 | 447 | 0 |
| OK | mobile-390x844 | /managers | 68 | 44 | 26 | 41 | 84 | 0 | 0/0 | 27 | 0 | 39 | 0/0 | 336 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 79 | 37 | 14 | 36 | 84 | 0 | 0/0 | 39 | 0 | 79 | 0/0 | 447 | 0 |
| OK | mobile-390x844 | /squads | 76 | 29 | 10 | 28 | 336 | 0 | 0/0 | 42 | 0 | 31 | 0/0 | 306 | 0 |
| OK | mobile-390x844 | /best-xi | 64 | 27 | 5 | 21 | 40 | 0 | 0/0 | 53 | 0 | 29 | 0/0 | 294 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 9475, 11782, 11789, 11771, 11786, 11794, 11771, 11793, 11794, 11789

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
