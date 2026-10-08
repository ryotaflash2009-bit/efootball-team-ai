# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-08T18:56:27.658Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,372 / Managers 69

**画面・操作: 576/576 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.24)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 690 | 61 | World 13,372 |
| PASS | desktop-1280x720 | /players | view | 919 | 80 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 920 | 74 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 949 | 66 | managers 69 |
| PASS | desktop-1280x720 | /managers/65 | view | 655 | 55 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 668 | 71 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 670 | 73 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 684 | 68 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 667 | 72 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 667 | 65 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 654 | 65 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 636 | 65 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 667 | 65 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 684 | 65 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 675 | 55 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 666 | 55 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 646 | 55 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 656 | 57 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 681 | 55 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 652 | 55 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 689 | 70 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 666 | 67 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 647 | 67 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 672 | 66 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 836 | 66 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 654 | 66 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 684 | 66 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 677 | 81 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 666 | 67 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 666 | 67 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 829 | 81 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 3109 | 161 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1614 | 101 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1332 | 105 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 2954 | 149 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1090 | 86 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 670 | 66 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1066 | 101 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1073 | 101 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1082 | 93 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 2750 | 161 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1102 | 141 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1387 | 112 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 1007 | 63 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 676 | 65 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 944 | 67 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1343 | 79 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1072 | 68 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 1067 | 78 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1478 | 66 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 676 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1832 | 137 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2389 | 303 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 667 | 67 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 653 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 655 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 655 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 648 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 651 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 668 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1241 | 68 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1825 | 198 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1116 | 125 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1276 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 666 | 67 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 666 | 65 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1954 | 198 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 698 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2377 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 906 | 67 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 638 | 72 | World 13,372 |
| PASS | desktop-1440x900 | /players | view | 680 | 92 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 696 | 74 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 670 | 69 | managers 69 |
| PASS | desktop-1440x900 | /managers/65 | view | 664 | 55 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 653 | 71 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 704 | 73 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 659 | 68 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 654 | 73 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 652 | 65 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 666 | 65 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 671 | 65 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 653 | 65 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 668 | 65 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 649 | 57 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 653 | 55 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 668 | 55 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 653 | 57 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 648 | 55 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 649 | 55 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 652 | 70 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 672 | 67 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 654 | 67 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 683 | 66 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 928 | 66 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 655 | 66 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 665 | 66 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 656 | 93 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 651 | 67 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 655 | 67 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 712 | 93 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1334 | 113 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1324 | 113 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1318 | 117 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1319 | 105 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1073 | 96 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 664 | 66 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1071 | 113 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1079 | 109 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1054 | 105 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1104 | 129 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1056 | 148 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1353 | 112 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 664 | 63 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 646 | 65 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 665 | 67 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1322 | 82 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1068 | 71 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 1073 | 81 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1321 | 66 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 655 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1793 | 137 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2407 | 303 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 654 | 67 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 651 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 655 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 652 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 646 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 653 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 653 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 654 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 650 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1238 | 68 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1367 | 137 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1244 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 689 | 67 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 701 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2375 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 665 | 88 | World 13,372 |
| PASS | desktop-1920x1080 | /players | view | 685 | 98 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 683 | 74 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 666 | 72 | managers 69 |
| PASS | desktop-1920x1080 | /managers/65 | view | 672 | 67 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 685 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 662 | 75 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 654 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 654 | 72 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 667 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 664 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 653 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 667 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 653 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 653 | 57 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 652 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 637 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 687 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 651 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 665 | 55 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 666 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 670 | 67 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 650 | 67 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 653 | 66 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 856 | 66 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 652 | 66 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 653 | 66 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 660 | 99 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 664 | 67 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 653 | 67 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 719 | 99 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1333 | 135 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1321 | 135 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1303 | 135 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1357 | 111 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1052 | 130 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 655 | 66 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1058 | 135 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1054 | 131 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1079 | 127 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1117 | 141 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 210 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1032 | 156 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1347 | 118 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 672 | 63 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 926 | 77 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 648 | 67 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1319 | 85 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1057 | 74 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 935 | 84 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1325 | 66 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 656 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1819 | 137 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2385 | 295 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 660 | 67 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 649 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 669 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 648 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 651 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 653 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 641 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 633 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 648 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 645 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1274 | 68 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1093 | 153 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1247 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 664 | 67 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 698 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2392 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 667 | 57 | World 13,372 |
| PASS | tablet-768x1024 | /players | view | 669 | 52 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 688 | 52 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 654 | 31 | managers 69 |
| PASS | tablet-768x1024 | /managers/65 | view | 664 | 21 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 654 | 49 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 667 | 54 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 653 | 41 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 639 | 48 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 640 | 52 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 652 | 44 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 643 | 48 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 658 | 54 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 641 | 54 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 654 | 29 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 651 | 20 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 653 | 20 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 643 | 37 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 648 | 20 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 650 | 42 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 657 | 42 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 652 | 40 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 653 | 39 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 651 | 39 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 905 | 39 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 658 | 39 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 639 | 39 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 652 | 53 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 665 | 40 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 656 | 40 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 794 | 53 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1325 | 73 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1309 | 73 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1307 | 77 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1330 | 68 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1061 | 81 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 652 | 40 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1049 | 73 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1076 | 73 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1071 | 65 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1044 | 77 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1052 | 104 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1355 | 79 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 667 | 38 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 672 | 40 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 646 | 42 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1332 | 51 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1058 | 33 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 929 | 50 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1308 | 38 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 653 | 41 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1807 | 85 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2406 | 223 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 666 | 41 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 643 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 626 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 641 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 653 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 645 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 654 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 650 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 658 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 654 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 668 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1264 | 42 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1090 | 99 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1247 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 653 | 44 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 669 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2366 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 652 | 57 | World 13,372 |
| PASS | tablet-820x1180 | /players | view | 668 | 52 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 669 | 52 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 660 | 33 | managers 69 |
| PASS | tablet-820x1180 | /managers/65 | view | 650 | 40 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 653 | 49 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 656 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 642 | 41 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 654 | 48 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 649 | 52 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 656 | 44 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 655 | 48 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 656 | 54 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 652 | 54 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 657 | 29 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 651 | 20 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 650 | 20 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 657 | 37 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 653 | 20 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 655 | 42 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 654 | 42 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 639 | 40 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 649 | 39 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 670 | 39 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 901 | 39 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 652 | 39 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 655 | 39 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 675 | 53 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 669 | 40 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 649 | 40 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 691 | 53 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1311 | 73 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1316 | 73 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1340 | 77 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1347 | 68 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1065 | 81 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 651 | 40 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1059 | 73 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1070 | 73 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1059 | 65 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1047 | 77 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1071 | 104 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1337 | 79 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 670 | 38 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 663 | 40 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 673 | 42 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1297 | 53 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1075 | 35 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 949 | 52 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1341 | 37 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 652 | 41 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1787 | 85 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2429 | 227 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 666 | 41 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 639 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 642 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 647 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 640 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 648 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 654 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 653 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 666 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 656 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1377 | 42 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1104 | 99 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1246 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 667 | 44 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 669 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2360 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 655 | 42 | World 13,372 |
| PASS | mobile-390x844 | /players | view | 651 | 36 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 666 | 39 | identity ok |
| PASS | mobile-390x844 | /managers | view | 656 | 26 | managers 69 |
| PASS | mobile-390x844 | /managers/65 | view | 668 | 21 | identity ok |
| PASS | mobile-390x844 | /compare | view | 673 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 669 | 41 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 663 | 41 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 654 | 48 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 652 | 52 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 639 | 44 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 653 | 48 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 654 | 47 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 654 | 54 | h1 ok |
| PASS | mobile-390x844 | /support | view | 670 | 20 | legal links present |
| PASS | mobile-390x844 | /terms | view | 649 | 20 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 655 | 20 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 653 | 22 | h1 ok |
| PASS | mobile-390x844 | /about | view | 656 | 20 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 650 | 42 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 639 | 42 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 652 | 40 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 653 | 39 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 665 | 39 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 809 | 39 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 654 | 39 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 651 | 39 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 669 | 37 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 653 | 40 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 660 | 40 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 703 | 37 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1330 | 41 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1323 | 41 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1326 | 45 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1324 | 52 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1075 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 653 | 40 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1087 | 41 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1073 | 45 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1068 | 41 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1066 | 45 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 210 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1074 | 68 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1372 | 53 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 691 | 38 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 670 | 38 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 668 | 38 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1324 | 46 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1066 | 27 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 923 | 45 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1326 | 37 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 646 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1823 | 85 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2380 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 667 | 41 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 641 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 657 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 653 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 651 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 649 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 652 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 647 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 639 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 655 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1255 | 42 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1697 | 140 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1105 | 84 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1246 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 660 | 44 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 652 | 42 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 2066 | 143 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 688 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2400 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 831 | 44 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 656 | 42 | World 13,372 |
| PASS | mobile-393x852 | /players | view | 668 | 36 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 680 | 38 | identity ok |
| PASS | mobile-393x852 | /managers | view | 700 | 26 | managers 69 |
| PASS | mobile-393x852 | /managers/65 | view | 701 | 21 | identity ok |
| PASS | mobile-393x852 | /compare | view | 649 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 655 | 41 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 646 | 41 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 673 | 49 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 651 | 52 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 655 | 44 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 669 | 48 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 652 | 47 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 652 | 54 | h1 ok |
| PASS | mobile-393x852 | /support | view | 655 | 20 | legal links present |
| PASS | mobile-393x852 | /terms | view | 653 | 20 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 661 | 20 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 657 | 22 | h1 ok |
| PASS | mobile-393x852 | /about | view | 638 | 20 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 668 | 42 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 669 | 42 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 636 | 40 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 652 | 39 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 664 | 39 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 905 | 39 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 653 | 39 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 665 | 39 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 671 | 37 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 640 | 40 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 649 | 40 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 729 | 37 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1290 | 41 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1313 | 41 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1329 | 45 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1332 | 52 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1079 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 662 | 40 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1093 | 41 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1074 | 45 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1071 | 41 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1082 | 45 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 206 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1067 | 60 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1350 | 53 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 660 | 38 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 668 | 38 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 667 | 38 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1276 | 46 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1055 | 27 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 920 | 45 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1302 | 38 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 658 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1821 | 85 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2391 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 652 | 41 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 648 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 650 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 648 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 640 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 646 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1366 | 42 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1094 | 84 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1240 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 639 | 44 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 669 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2351 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 647 | 48 | World 13,372 |
| PASS | mobile-430x932 | /players | view | 650 | 36 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 931 | 38 | identity ok |
| PASS | mobile-430x932 | /managers | view | 673 | 26 | managers 69 |
| PASS | mobile-430x932 | /managers/65 | view | 666 | 21 | identity ok |
| PASS | mobile-430x932 | /compare | view | 652 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 670 | 41 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 638 | 41 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 651 | 48 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 654 | 52 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 637 | 44 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 657 | 48 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 637 | 47 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 651 | 54 | h1 ok |
| PASS | mobile-430x932 | /support | view | 654 | 20 | legal links present |
| PASS | mobile-430x932 | /terms | view | 655 | 20 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 651 | 20 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 651 | 22 | h1 ok |
| PASS | mobile-430x932 | /about | view | 660 | 20 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 644 | 42 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 654 | 42 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 655 | 40 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 664 | 39 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 653 | 39 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 795 | 39 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 651 | 39 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 660 | 39 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 661 | 37 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 652 | 40 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 643 | 40 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 680 | 37 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1308 | 41 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1336 | 41 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1332 | 45 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1312 | 52 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1066 | 58 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 648 | 40 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1058 | 41 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1070 | 45 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1062 | 41 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1074 | 45 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1068 | 45 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1359 | 53 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 671 | 38 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 670 | 38 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 668 | 38 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1302 | 46 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1064 | 27 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 933 | 45 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1444 | 38 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 658 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1808 | 85 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2379 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 650 | 41 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 640 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 651 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 651 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 654 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 650 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 635 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1364 | 42 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1088 | 90 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1242 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 657 | 44 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 668 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2335 | 42 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 363 | 44 | 17 | 42 | 64 | 0 | 0/0 | 61 | 0 | 325 | 4/325 | 436 | 0 |
| OK | desktop-1280x720 | /players | 111 | 67 | 41 | 65 | 108 | 0 | 0/0 | 81 | 0 | 141 | 4/76 | 463 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 112 | 51 | 21 | 47 | 72 | 0 | 0/0 | 75 | 0 | 76 | 2/59 | 431 | 0 |
| OK | desktop-1280x720 | /managers | 86 | 41 | 13 | 39 | 64 | 0 | 0/0 | 67 | 0 | 41 | 0/0 | 432 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 113 | 62 | 20 | 54 | 92 | 0 | 0/0 | 64 | 0 | 144 | 0/0 | 434 | 0 |
| OK | desktop-1280x720 | /squads | 58 | 36 | 13 | 34 | 336 | 0 | 0/0 | 77 | 0 | 34 | 0/0 | 310 | 0 |
| OK | desktop-1280x720 | /best-xi | 61 | 26 | 5 | 15 | 40 | 0 | 0/0 | 66 | 0 | 33 | 0/0 | 295 | 0 |
| OK | mobile-390x844 | / | 151 | 28 | 8 | 26 | 44 | 0 | 0/0 | 43 | 0 | 134 | 4/134 | 416 | 0 |
| OK | mobile-390x844 | /players | 165 | 47 | 20 | 45 | 84 | 0 | 0/0 | 37 | 0 | 130 | 4/130 | 420 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 86 | 55 | 37 | 54 | 76 | 0 | 0/0 | 39 | 0 | 52 | 2/52 | 436 | 0 |
| OK | mobile-390x844 | /managers | 96 | 62 | 48 | 60 | 88 | 0 | 0/0 | 27 | 0 | 37 | 0/0 | 340 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 128 | 77 | 14 | 76 | 96 | 0 | 0/0 | 39 | 0 | 146 | 0/0 | 480 | 0 |
| OK | mobile-390x844 | /squads | 70 | 30 | 8 | 29 | 336 | 0 | 0/0 | 42 | 0 | 31 | 0/0 | 307 | 0 |
| OK | mobile-390x844 | /best-xi | 107 | 42 | 12 | 36 | 52 | 0 | 0/0 | 53 | 0 | 53 | 0/0 | 431 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 9518, 11831, 11831, 11811, 11839, 11832, 11834, 11818, 11835, 11843

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
