# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-11-08T16:34:21.276Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,009 / Managers 66

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.2)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 917 | 78 | World 13,009 |
| PASS | desktop-1280x720 | /players | view | 654 | 82 | 36 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 640 | 94 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 633 | 78 | managers 66 |
| PASS | desktop-1280x720 | /managers/65 | view | 631 | 67 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 633 | 88 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 628 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 624 | 83 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 624 | 88 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 625 | 80 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 1115 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 624 | 80 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 637 | 85 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 690 | 71 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 622 | 80 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 650 | 82 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 619 | 80 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 628 | 82 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 626 | 67 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 623 | 67 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 626 | 67 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 625 | 69 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 626 | 68 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 626 | 67 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 866 | 80 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 627 | 82 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 622 | 82 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 624 | 81 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 869 | 81 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 626 | 83 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 624 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 649 | 85 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 629 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 628 | 86 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 810 | 85 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1275 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1270 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1395 | 110 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1401 | 98 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1016 | 85 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 628 | 83 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1023 | 113 | 36 cards |
| PASS | desktop-1280x720 | /players | position filter | 1022 | 97 | position set, 36 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1022 | 100 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1017 | 103 | sort set, 36 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1019 | 135 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1604 | 104 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 703 | 82 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 639 | 86 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 643 | 88 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1260 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1013 | 84 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 902 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1380 | 83 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 630 | 82 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1734 | 175 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2530 | 393 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 625 | 84 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 613 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 613 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 620 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 617 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 616 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 613 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 614 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 615 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 622 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1197 | 87 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1776 | 269 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1044 | 157 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1201 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 629 | 86 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 627 | 85 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1843 | 256 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 652 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2260 | 82 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 883 | 84 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 625 | 89 | World 13,009 |
| PASS | desktop-1440x900 | /players | view | 899 | 87 | 36 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 636 | 98 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 636 | 83 | managers 66 |
| PASS | desktop-1440x900 | /managers/65 | view | 629 | 69 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 625 | 90 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 629 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 619 | 85 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 624 | 91 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 620 | 82 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 1039 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 621 | 82 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 632 | 130 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 622 | 69 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 618 | 82 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 621 | 84 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 625 | 82 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 633 | 84 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 621 | 71 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 623 | 69 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 622 | 69 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 620 | 71 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 620 | 70 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 620 | 69 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 865 | 82 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 622 | 84 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 622 | 84 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 623 | 83 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 873 | 83 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 626 | 83 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 623 | 85 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 643 | 88 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 624 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 623 | 86 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 809 | 88 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1290 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1273 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1270 | 132 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1289 | 126 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1253 | 103 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 622 | 83 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1020 | 113 | 36 cards |
| PASS | desktop-1440x900 | /players | position filter | 1014 | 100 | position set, 36 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1020 | 112 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1017 | 106 | sort set, 36 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1019 | 153 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1332 | 116 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 641 | 82 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 638 | 86 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 665 | 96 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1260 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1015 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 898 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1371 | 83 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 629 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1727 | 175 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2554 | 393 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 629 | 84 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 613 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 615 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 615 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 613 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 614 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 617 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1332 | 87 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1049 | 171 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1203 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 632 | 86 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 655 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2249 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 626 | 89 | World 13,009 |
| PASS | desktop-1920x1080 | /players | view | 918 | 102 | 36 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 640 | 98 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 635 | 86 | managers 66 |
| PASS | desktop-1920x1080 | /managers/65 | view | 629 | 84 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 629 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 629 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 622 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 623 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 620 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 986 | 96 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 621 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 635 | 136 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 624 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 621 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 622 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 626 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 627 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 624 | 71 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 618 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 620 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 623 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 627 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 620 | 69 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 865 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 620 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 622 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 619 | 83 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 871 | 83 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 623 | 83 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 621 | 85 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 646 | 88 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 630 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 623 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 746 | 88 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1290 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1292 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1268 | 142 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1388 | 129 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1258 | 117 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 626 | 83 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1030 | 117 | 36 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1016 | 100 | position set, 36 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1018 | 116 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1016 | 106 | sort set, 36 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1020 | 181 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1336 | 118 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 635 | 82 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 634 | 86 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 637 | 88 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1259 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1009 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 902 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1381 | 83 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 625 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1727 | 175 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2534 | 397 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 626 | 84 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 613 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 615 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 613 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 618 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 661 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 615 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1203 | 87 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1047 | 171 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1202 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 623 | 86 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 643 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2246 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 627 | 59 | World 13,009 |
| PASS | tablet-768x1024 | /players | view | 647 | 48 | 36 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 636 | 67 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 637 | 36 | managers 66 |
| PASS | tablet-768x1024 | /managers/65 | view | 629 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 622 | 57 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 628 | 61 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 622 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 619 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 620 | 57 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 996 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 623 | 48 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 632 | 100 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 621 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 622 | 51 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 619 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 620 | 60 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 622 | 62 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 622 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 622 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 620 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 621 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 621 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 624 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 873 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 621 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 620 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 622 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 876 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 623 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 621 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 640 | 49 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 625 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 624 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 720 | 49 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1268 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1262 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1263 | 90 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1263 | 84 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1011 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 623 | 48 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1257 | 65 | 36 cards |
| PASS | tablet-768x1024 | /players | position filter | 1036 | 76 | position set, 36 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1031 | 72 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1014 | 65 | sort set, 36 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1017 | 120 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1317 | 88 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 642 | 47 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 634 | 49 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 637 | 51 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1247 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1007 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 897 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1381 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 627 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1725 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2522 | 267 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 623 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 613 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 613 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 612 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 612 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1192 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1035 | 108 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1192 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 627 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 641 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2245 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 629 | 67 | World 13,009 |
| PASS | tablet-820x1180 | /players | view | 653 | 48 | 36 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 643 | 67 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 637 | 38 | managers 66 |
| PASS | tablet-820x1180 | /managers/65 | view | 634 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 631 | 57 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 630 | 63 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 626 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 623 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 619 | 57 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 1006 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 621 | 48 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 636 | 105 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 619 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 624 | 51 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 625 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 624 | 60 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 623 | 62 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 626 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 624 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 621 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 624 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 623 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 623 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 866 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 622 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 620 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 623 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 879 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 624 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 621 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 645 | 49 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 627 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 622 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 726 | 49 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1278 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1270 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1279 | 90 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1260 | 84 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1010 | 85 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 627 | 48 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1019 | 69 | 36 cards |
| PASS | tablet-820x1180 | /players | position filter | 1024 | 76 | position set, 36 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1034 | 80 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1015 | 65 | sort set, 36 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1016 | 96 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1328 | 89 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 636 | 47 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 637 | 49 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 640 | 51 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1262 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1012 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 896 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1264 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 630 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1733 | 99 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2527 | 271 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 627 | 50 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 615 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 617 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 618 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 613 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 612 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 614 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1316 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1038 | 116 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1201 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 626 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2249 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 628 | 48 | World 13,009 |
| PASS | mobile-390x844 | /players | view | 655 | 40 | 36 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 635 | 52 | identity ok |
| PASS | mobile-390x844 | /managers | view | 639 | 32 | managers 66 |
| PASS | mobile-390x844 | /managers/65 | view | 635 | 27 | identity ok |
| PASS | mobile-390x844 | /compare | view | 626 | 57 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 625 | 50 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 622 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 623 | 56 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 622 | 58 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 863 | 45 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 621 | 49 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 637 | 73 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 675 | 29 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 625 | 51 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 622 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 619 | 55 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 624 | 62 | h1 ok |
| PASS | mobile-390x844 | /support | view | 619 | 26 | legal links present |
| PASS | mobile-390x844 | /terms | view | 620 | 26 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 622 | 26 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 624 | 28 | h1 ok |
| PASS | mobile-390x844 | /about | view | 622 | 27 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 628 | 47 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 867 | 45 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 620 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 622 | 47 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 622 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 872 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 623 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 623 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 639 | 41 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 635 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 622 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 713 | 41 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1264 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1285 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1391 | 60 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1272 | 70 | 0 results |
| PASS | mobile-390x844 | header search | search button opens /players | 1633 | 70 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 623 | 48 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1015 | 53 | 36 cards |
| PASS | mobile-390x844 | /players | position filter | 1017 | 52 | position set, 36 cards |
| PASS | mobile-390x844 | /players | card type filter | 1032 | 50 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1021 | 49 | sort set, 36 cards |
| PASS | mobile-390x844 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1015 | 80 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1321 | 60 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 635 | 47 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 640 | 47 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 641 | 47 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1254 | 54 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1005 | 33 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 889 | 53 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1262 | 46 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 631 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1736 | 101 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2525 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 625 | 49 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 613 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 611 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 614 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 614 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1193 | 50 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1729 | 177 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1044 | 98 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1192 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 621 | 52 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 626 | 51 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1736 | 179 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 663 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2244 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 805 | 52 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 622 | 48 | World 13,009 |
| PASS | mobile-393x852 | /players | view | 645 | 40 | 36 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 637 | 51 | identity ok |
| PASS | mobile-393x852 | /managers | view | 639 | 32 | managers 66 |
| PASS | mobile-393x852 | /managers/65 | view | 632 | 27 | identity ok |
| PASS | mobile-393x852 | /compare | view | 634 | 57 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 629 | 50 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 622 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 620 | 57 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 622 | 58 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 878 | 45 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 621 | 49 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 635 | 76 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 621 | 26 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 622 | 51 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 625 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 623 | 55 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 628 | 62 | h1 ok |
| PASS | mobile-393x852 | /support | view | 623 | 26 | legal links present |
| PASS | mobile-393x852 | /terms | view | 620 | 26 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 622 | 26 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 619 | 28 | h1 ok |
| PASS | mobile-393x852 | /about | view | 621 | 27 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 621 | 47 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 863 | 45 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 621 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 617 | 47 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 624 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 873 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 623 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 619 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 641 | 41 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 623 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 622 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 782 | 41 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1259 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1262 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1261 | 60 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1261 | 70 | 0 results |
| PASS | mobile-393x852 | header search | search button opens /players | 1628 | 70 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 626 | 48 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1014 | 53 | 36 cards |
| PASS | mobile-393x852 | /players | position filter | 1033 | 52 | position set, 36 cards |
| PASS | mobile-393x852 | /players | card type filter | 1035 | 50 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1012 | 49 | sort set, 36 cards |
| PASS | mobile-393x852 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1015 | 76 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1327 | 60 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 637 | 47 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 636 | 47 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 641 | 47 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1254 | 54 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1014 | 33 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 898 | 53 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1265 | 46 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 631 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1730 | 101 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2520 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 624 | 49 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 612 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 613 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1195 | 50 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1033 | 98 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1193 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 623 | 52 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 646 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2249 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 626 | 54 | World 13,009 |
| PASS | mobile-430x932 | /players | view | 639 | 40 | 36 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 638 | 51 | identity ok |
| PASS | mobile-430x932 | /managers | view | 636 | 32 | managers 66 |
| PASS | mobile-430x932 | /managers/65 | view | 629 | 27 | identity ok |
| PASS | mobile-430x932 | /compare | view | 623 | 57 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 626 | 50 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 622 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 621 | 56 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 620 | 58 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 863 | 47 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 620 | 49 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 636 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 623 | 26 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 618 | 51 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 622 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 622 | 60 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 626 | 62 | h1 ok |
| PASS | mobile-430x932 | /support | view | 621 | 26 | legal links present |
| PASS | mobile-430x932 | /terms | view | 628 | 26 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 626 | 26 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 623 | 28 | h1 ok |
| PASS | mobile-430x932 | /about | view | 626 | 27 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 623 | 47 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 864 | 45 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 622 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 627 | 47 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 625 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 868 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 622 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 623 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 641 | 41 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 626 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 624 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 806 | 41 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1263 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1263 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1264 | 60 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1267 | 70 | 0 results |
| PASS | mobile-430x932 | header search | search button opens /players | 1630 | 76 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 632 | 48 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1019 | 53 | 36 cards |
| PASS | mobile-430x932 | /players | position filter | 1030 | 52 | position set, 36 cards |
| PASS | mobile-430x932 | /players | card type filter | 1023 | 50 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1010 | 49 | sort set, 36 cards |
| PASS | mobile-430x932 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1011 | 72 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1320 | 61 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 636 | 47 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 634 | 47 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 630 | 47 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1245 | 54 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1012 | 33 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 898 | 53 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1260 | 46 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 627 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1728 | 101 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2525 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 622 | 49 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 614 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 612 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 612 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 613 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 613 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1192 | 50 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1035 | 104 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1194 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 626 | 52 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 644 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2249 | 50 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 283 | 37 | 7 | 22 | 56 | 0 | 0/0 | 76 | 2 | 153 | 4/153 | 412 | 0 |
| OK | desktop-1280x720 | /players | 108 | 62 | 22 | 57 | 92 | 0 | 0/0 | 82 | 0 | 55 | 4/32 | 435 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 223 | 57 | 19 | 53 | 76 | 0 | 0/0 | 94 | 0 | 82 | 4/79 | 430 | 0 |
| OK | desktop-1280x720 | /managers | 69 | 43 | 14 | 40 | 68 | 0 | 0/0 | 78 | 0 | 43 | 0/0 | 419 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 97 | 53 | 16 | 51 | 84 | 0 | 0/0 | 80 | 0 | 49 | 0/0 | 429 | 0 |
| OK | desktop-1280x720 | /squads | 80 | 46 | 11 | 43 | 324 | 0 | 0/0 | 92 | 3 | 48 | 0/0 | 319 | 0 |
| OK | desktop-1280x720 | /best-xi | 192 | 47 | 7 | 22 | 60 | 0 | 0/0 | 80 | 0 | 49 | 0/0 | 425 | 0 |
| OK | mobile-390x844 | / | 83 | 36 | 8 | 22 | 52 | 0 | 0/0 | 49 | 0 | 54 | 4/30 | 414 | 0 |
| OK | mobile-390x844 | /players | 96 | 60 | 20 | 56 | 80 | 0 | 0/0 | 39 | 2 | 56 | 4/34 | 433 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 105 | 50 | 16 | 48 | 64 | 0 | 0/0 | 49 | 1 | 83 | 4/79 | 417 | 0 |
| OK | mobile-390x844 | /managers | 63 | 41 | 13 | 39 | 60 | 0 | 0/0 | 32 | 1 | 30 | 0/0 | 420 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 116 | 54 | 14 | 52 | 76 | 0 | 0/0 | 47 | 1 | 54 | 0/0 | 432 | 0 |
| OK | mobile-390x844 | /squads | 124 | 41 | 9 | 39 | 316 | 0 | 0/0 | 50 | 1 | 39 | 0/0 | 308 | 0 |
| OK | mobile-390x844 | /best-xi | 116 | 44 | 7 | 21 | 56 | 0 | 0/0 | 58 | 0 | 42 | 0/0 | 412 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10688, 12845, 12847, 12847, 12847, 12863, 12848, 12848, 12835, 12849

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
