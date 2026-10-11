# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-11T10:38:18.969Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,455 / Managers 69

**画面・操作: 576/576 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.25)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 655 | 64 | World 13,455 |
| PASS | desktop-1280x720 | /players | view | 683 | 83 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 648 | 78 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 655 | 69 | managers 69 |
| PASS | desktop-1280x720 | /managers/65 | view | 649 | 58 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 641 | 74 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 683 | 75 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 655 | 70 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 659 | 74 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 671 | 68 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 672 | 68 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 665 | 68 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 658 | 68 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 664 | 68 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 667 | 58 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 637 | 58 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 656 | 58 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 680 | 60 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 666 | 58 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 668 | 58 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 915 | 68 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 655 | 70 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 641 | 70 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 661 | 69 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 854 | 69 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 692 | 69 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 654 | 69 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 669 | 84 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 655 | 70 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 667 | 70 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 855 | 84 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1368 | 104 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1609 | 104 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1586 | 108 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1912 | 96 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1067 | 89 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 657 | 69 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1085 | 104 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1063 | 104 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1175 | 96 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1061 | 106 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 234 | 2 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1066 | 144 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1366 | 116 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 718 | 66 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 684 | 68 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 682 | 70 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 2830 | 143 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1049 | 71 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 1202 | 81 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1339 | 69 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 676 | 70 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1841 | 143 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2416 | 311 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 675 | 70 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 683 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 660 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 666 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 654 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 656 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 655 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 641 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 642 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 649 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1232 | 71 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1854 | 205 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1106 | 131 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1321 | 139 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 695 | 70 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 677 | 68 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1941 | 205 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 700 | 70 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2409 | 70 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 1077 | 70 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 664 | 75 | World 13,455 |
| PASS | desktop-1440x900 | /players | view | 691 | 83 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 682 | 79 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 686 | 72 | managers 69 |
| PASS | desktop-1440x900 | /managers/65 | view | 690 | 58 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 661 | 74 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 657 | 75 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 670 | 70 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 672 | 75 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 661 | 68 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 655 | 68 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 658 | 68 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 658 | 68 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 677 | 68 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 665 | 60 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 670 | 58 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 689 | 58 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 659 | 60 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 655 | 58 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 673 | 58 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 811 | 68 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 666 | 70 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 672 | 70 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 682 | 69 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 843 | 69 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 652 | 69 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 673 | 69 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 946 | 96 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 642 | 70 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 662 | 70 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 714 | 84 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1321 | 104 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1353 | 104 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1338 | 108 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1338 | 96 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1089 | 99 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 669 | 69 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1035 | 104 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1094 | 104 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1071 | 96 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1056 | 108 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 207 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1082 | 108 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1353 | 116 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 660 | 66 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 689 | 68 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 711 | 70 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1327 | 85 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1060 | 74 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 952 | 84 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1364 | 69 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 715 | 70 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1793 | 143 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2414 | 311 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 666 | 70 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 658 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 648 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 654 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 675 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 652 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 667 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 641 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 639 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 656 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 655 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1256 | 71 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1115 | 143 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1275 | 139 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 670 | 70 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 683 | 70 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2386 | 70 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 670 | 91 | World 13,455 |
| PASS | desktop-1920x1080 | /players | view | 684 | 101 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 683 | 78 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 920 | 87 | managers 69 |
| PASS | desktop-1920x1080 | /managers/65 | view | 673 | 70 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 659 | 74 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 698 | 77 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 649 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 650 | 75 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 656 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 654 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 674 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 670 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 653 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 656 | 60 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 673 | 58 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 679 | 58 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 661 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 651 | 58 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 656 | 58 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 794 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 650 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 655 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 652 | 69 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 869 | 69 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 669 | 69 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 666 | 69 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 668 | 102 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 672 | 70 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 669 | 70 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 744 | 102 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1353 | 138 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1317 | 138 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1331 | 132 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1338 | 117 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1083 | 131 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 652 | 69 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1047 | 138 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1095 | 134 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1059 | 130 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1063 | 142 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 224 | 2 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1314 | 162 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1381 | 122 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 685 | 66 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 693 | 68 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 684 | 70 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1348 | 88 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1105 | 77 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 932 | 87 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1451 | 69 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 665 | 70 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1796 | 143 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2380 | 303 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 683 | 70 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 652 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 642 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 664 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 648 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 641 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 652 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 650 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 669 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1247 | 71 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1092 | 159 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1265 | 139 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 689 | 70 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 690 | 70 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2404 | 70 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 697 | 59 | World 13,455 |
| PASS | tablet-768x1024 | /players | view | 699 | 54 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 681 | 56 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 685 | 33 | managers 69 |
| PASS | tablet-768x1024 | /managers/65 | view | 675 | 23 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 710 | 52 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 662 | 55 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 650 | 42 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 656 | 50 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 645 | 54 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 655 | 46 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 652 | 50 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 654 | 57 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 658 | 57 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 667 | 31 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 638 | 22 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 657 | 22 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 639 | 39 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 640 | 22 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 659 | 45 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 800 | 39 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 662 | 42 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 662 | 41 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 682 | 41 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 794 | 41 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 671 | 41 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 649 | 41 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 672 | 55 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 658 | 42 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 669 | 42 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 703 | 55 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1330 | 75 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1315 | 75 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1346 | 79 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1338 | 70 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1074 | 83 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 666 | 42 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1059 | 75 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1074 | 75 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1080 | 67 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1056 | 79 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 205 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1059 | 118 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1385 | 83 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 660 | 41 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 670 | 43 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 663 | 45 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1298 | 53 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1067 | 35 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 1055 | 52 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1326 | 40 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 667 | 43 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1808 | 89 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2403 | 229 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 701 | 43 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 655 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 652 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 628 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 641 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 643 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 649 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 640 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 660 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 650 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1268 | 44 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1102 | 103 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1268 | 91 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 667 | 46 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 698 | 46 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2384 | 44 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 662 | 59 | World 13,455 |
| PASS | tablet-820x1180 | /players | view | 668 | 54 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 669 | 56 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 669 | 35 | managers 69 |
| PASS | tablet-820x1180 | /managers/65 | view | 677 | 42 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 666 | 52 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 664 | 57 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 656 | 42 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 656 | 50 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 655 | 54 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 653 | 46 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 659 | 50 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 667 | 57 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 670 | 57 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 654 | 31 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 652 | 22 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 652 | 22 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 660 | 39 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 650 | 22 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 669 | 45 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 919 | 39 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 654 | 42 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 654 | 41 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 655 | 41 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 907 | 41 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 668 | 41 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 656 | 41 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 671 | 55 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 651 | 42 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 656 | 42 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 701 | 55 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1343 | 75 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1307 | 75 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1324 | 79 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1300 | 70 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1072 | 83 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 672 | 42 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1059 | 75 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1063 | 75 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1054 | 67 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1067 | 79 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1101 | 118 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1351 | 83 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 669 | 41 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 685 | 43 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 674 | 45 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1321 | 55 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1072 | 37 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 940 | 54 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1485 | 40 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 680 | 43 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1790 | 89 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2415 | 233 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 673 | 43 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 653 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 641 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 662 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 659 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 671 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 651 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 669 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 669 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 671 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 668 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1231 | 44 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1111 | 103 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1281 | 91 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 684 | 46 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 683 | 46 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2408 | 44 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 662 | 44 | World 13,455 |
| PASS | mobile-390x844 | /players | view | 683 | 38 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 672 | 43 | identity ok |
| PASS | mobile-390x844 | /managers | view | 681 | 28 | managers 69 |
| PASS | mobile-390x844 | /managers/65 | view | 658 | 23 | identity ok |
| PASS | mobile-390x844 | /compare | view | 672 | 52 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 666 | 42 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 652 | 42 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 661 | 50 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 667 | 54 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 654 | 46 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 671 | 50 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 649 | 50 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 649 | 57 | h1 ok |
| PASS | mobile-390x844 | /support | view | 673 | 22 | legal links present |
| PASS | mobile-390x844 | /terms | view | 664 | 22 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 653 | 22 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 661 | 24 | h1 ok |
| PASS | mobile-390x844 | /about | view | 670 | 22 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 660 | 45 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 804 | 39 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 659 | 42 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 626 | 41 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 651 | 41 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 940 | 41 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 673 | 41 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 649 | 41 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 667 | 39 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 659 | 42 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 670 | 42 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 719 | 39 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1337 | 43 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1328 | 43 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1338 | 47 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1334 | 54 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1068 | 54 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 652 | 42 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1094 | 43 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1075 | 43 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1101 | 39 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1125 | 47 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 219 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1067 | 66 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1382 | 57 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 688 | 41 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 687 | 41 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 658 | 41 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1321 | 48 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1097 | 29 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 924 | 47 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1462 | 40 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 667 | 43 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1826 | 89 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2429 | 206 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 654 | 43 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 643 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 648 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 666 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 656 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 653 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 639 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 671 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1267 | 44 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1690 | 148 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1093 | 88 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1277 | 91 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 654 | 46 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 659 | 44 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1980 | 148 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 684 | 46 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2383 | 44 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 872 | 46 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 650 | 44 | World 13,455 |
| PASS | mobile-393x852 | /players | view | 662 | 38 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 682 | 42 | identity ok |
| PASS | mobile-393x852 | /managers | view | 675 | 28 | managers 69 |
| PASS | mobile-393x852 | /managers/65 | view | 670 | 23 | identity ok |
| PASS | mobile-393x852 | /compare | view | 658 | 52 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 658 | 42 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 656 | 42 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 655 | 50 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 654 | 54 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 666 | 46 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 660 | 50 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 673 | 50 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 669 | 57 | h1 ok |
| PASS | mobile-393x852 | /support | view | 668 | 22 | legal links present |
| PASS | mobile-393x852 | /terms | view | 693 | 22 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 653 | 22 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 670 | 24 | h1 ok |
| PASS | mobile-393x852 | /about | view | 666 | 22 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 658 | 45 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 947 | 39 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 655 | 42 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 652 | 41 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 662 | 41 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 821 | 41 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 670 | 41 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 671 | 41 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 688 | 39 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 666 | 42 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 653 | 42 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 842 | 39 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1336 | 43 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1336 | 43 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1341 | 47 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1326 | 54 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1097 | 54 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 689 | 42 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1090 | 43 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1109 | 47 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1113 | 43 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1110 | 47 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 213 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1078 | 70 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1407 | 57 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 683 | 41 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 683 | 41 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 669 | 41 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1325 | 48 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1064 | 29 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 1069 | 47 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1453 | 39 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 648 | 43 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1806 | 71 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2382 | 220 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 687 | 43 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 650 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 656 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 659 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 650 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 644 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 653 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 655 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 648 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 648 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 658 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1264 | 44 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1118 | 88 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1261 | 91 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 687 | 46 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 673 | 46 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2397 | 44 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 670 | 50 | World 13,455 |
| PASS | mobile-430x932 | /players | view | 704 | 38 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 692 | 42 | identity ok |
| PASS | mobile-430x932 | /managers | view | 668 | 28 | managers 69 |
| PASS | mobile-430x932 | /managers/65 | view | 672 | 23 | identity ok |
| PASS | mobile-430x932 | /compare | view | 639 | 52 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 673 | 42 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 681 | 42 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 658 | 50 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 656 | 54 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 668 | 46 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 665 | 50 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 673 | 50 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 661 | 57 | h1 ok |
| PASS | mobile-430x932 | /support | view | 654 | 22 | legal links present |
| PASS | mobile-430x932 | /terms | view | 656 | 22 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 659 | 22 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 665 | 24 | h1 ok |
| PASS | mobile-430x932 | /about | view | 670 | 22 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 678 | 45 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 917 | 39 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 660 | 42 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 668 | 41 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 660 | 41 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 801 | 41 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 658 | 41 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 697 | 41 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 673 | 39 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 666 | 42 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 665 | 42 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 818 | 39 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1350 | 43 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1385 | 43 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1318 | 47 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1311 | 54 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1075 | 60 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 654 | 42 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1097 | 43 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1081 | 47 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1074 | 43 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1071 | 47 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 208 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1100 | 47 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1348 | 57 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 681 | 41 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 685 | 41 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 657 | 41 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1346 | 48 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1096 | 29 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 1072 | 47 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1498 | 40 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 652 | 43 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1805 | 87 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2418 | 220 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 667 | 43 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 654 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 639 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 653 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 645 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 669 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 648 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 655 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 653 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1216 | 44 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1097 | 94 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1279 | 91 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 670 | 46 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 673 | 46 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2371 | 44 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 217 | 47 | 20 | 45 | 68 | 0 | 0/0 | 64 | 0 | 189 | 4/189 | 447 | 0 |
| OK | desktop-1280x720 | /players | 199 | 38 | 15 | 33 | 84 | 0 | 0/0 | 84 | 0 | 172 | 4/172 | 433 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 108 | 78 | 50 | 76 | 96 | 0 | 0/0 | 79 | 0 | 393 | 3/393 | 480 | 0 |
| OK | desktop-1280x720 | /managers | 69 | 55 | 25 | 53 | 116 | 0 | 0/0 | 70 | 0 | 38 | 0/0 | 385 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 69 | 62 | 28 | 59 | 84 | 0 | 0/0 | 67 | 0 | 40 | 0/0 | 463 | 0 |
| OK | desktop-1280x720 | /squads | 58 | 35 | 8 | 29 | 328 | 0 | 0/0 | 79 | 0 | 43 | 0/0 | 420 | 0 |
| OK | desktop-1280x720 | /best-xi | 136 | 30 | 5 | 18 | 44 | 0 | 0/0 | 69 | 0 | 98 | 0/0 | 294 | 0 |
| OK | mobile-390x844 | / | 187 | 28 | 10 | 26 | 40 | 0 | 0/0 | 45 | 0 | 160 | 4/160 | 306 | 0 |
| OK | mobile-390x844 | /players | 141 | 60 | 11 | 49 | 80 | 0 | 0/0 | 39 | 0 | 119 | 4/119 | 450 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 83 | 52 | 31 | 50 | 72 | 0 | 0/0 | 43 | 0 | 447 | 3/447 | 469 | 0 |
| OK | mobile-390x844 | /managers | 66 | 31 | 15 | 30 | 56 | 0 | 0/0 | 29 | 0 | 40 | 0/0 | 324 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 100 | 37 | 11 | 35 | 64 | 0 | 0/0 | 42 | 0 | 89 | 0/0 | 434 | 0 |
| OK | mobile-390x844 | /squads | 94 | 40 | 17 | 37 | 340 | 0 | 0/0 | 43 | 0 | 30 | 0/0 | 437 | 0 |
| OK | mobile-390x844 | /best-xi | 130 | 32 | 7 | 20 | 44 | 0 | 0/0 | 55 | 0 | 67 | 0/0 | 311 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 9705, 11995, 12145, 12142, 12084, 12143, 12138, 12144, 12152, 12134

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
