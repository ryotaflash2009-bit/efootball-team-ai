# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-25T15:44:30.424Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.22)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 643 | 76 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 631 | 94 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 625 | 92 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 625 | 79 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 620 | 69 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 618 | 86 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 618 | 90 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 620 | 85 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 615 | 89 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 619 | 82 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 622 | 81 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 617 | 82 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 618 | 108 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 616 | 69 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 615 | 82 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 615 | 82 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 617 | 82 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 624 | 82 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 619 | 69 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 618 | 69 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 619 | 69 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 613 | 71 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 615 | 70 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 615 | 69 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 862 | 82 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 616 | 84 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 613 | 84 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 616 | 83 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 868 | 83 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 615 | 85 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 619 | 87 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 628 | 97 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 617 | 86 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 618 | 88 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 762 | 97 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1243 | 119 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1246 | 119 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1240 | 123 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1249 | 114 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 997 | 101 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 621 | 85 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1003 | 119 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1002 | 119 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 997 | 111 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 998 | 123 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1240 | 162 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1273 | 134 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 628 | 77 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 866 | 81 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 623 | 83 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1242 | 97 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1000 | 85 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 883 | 98 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1368 | 85 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 625 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1726 | 179 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2251 | 381 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 619 | 86 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 609 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 610 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1180 | 89 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1714 | 259 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1031 | 157 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1189 | 175 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 616 | 88 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 617 | 87 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1825 | 246 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 635 | 88 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2245 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 821 | 86 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 619 | 87 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 630 | 96 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 628 | 95 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 624 | 84 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 629 | 71 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 624 | 88 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 631 | 92 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 621 | 87 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 624 | 92 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 620 | 84 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 627 | 82 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 621 | 84 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 622 | 134 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 623 | 71 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 619 | 84 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 621 | 84 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 622 | 84 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 629 | 84 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 620 | 73 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 620 | 71 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 622 | 71 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 620 | 73 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 619 | 72 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 621 | 71 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 871 | 84 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 627 | 86 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 620 | 86 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 621 | 85 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 876 | 85 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 623 | 85 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 622 | 87 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 634 | 97 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 642 | 86 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 625 | 88 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 693 | 97 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1256 | 119 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1258 | 119 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1259 | 123 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1255 | 114 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1005 | 111 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 625 | 85 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1013 | 119 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1012 | 119 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1262 | 123 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1017 | 123 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1022 | 162 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1306 | 135 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 643 | 77 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 638 | 81 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 635 | 83 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1250 | 100 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1020 | 88 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 899 | 101 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1390 | 85 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 641 | 86 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1765 | 179 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2285 | 381 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 704 | 86 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 614 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 614 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 616 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 625 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 615 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 613 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 615 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 614 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1200 | 89 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1040 | 171 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1203 | 175 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 630 | 88 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 657 | 88 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2246 | 86 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 628 | 87 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 908 | 114 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 645 | 94 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 642 | 87 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 629 | 86 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 626 | 88 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 636 | 94 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 622 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 626 | 91 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 623 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 643 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 626 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 630 | 138 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 627 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 620 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 623 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 623 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 627 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 627 | 73 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 625 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 624 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 628 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 627 | 72 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 625 | 71 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 879 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 623 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 623 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 625 | 85 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 876 | 85 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 619 | 85 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 621 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 632 | 115 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 620 | 86 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 618 | 88 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 667 | 115 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1252 | 153 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1251 | 153 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1248 | 150 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1269 | 132 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 999 | 129 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 620 | 85 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1003 | 153 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1004 | 143 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1106 | 145 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 998 | 156 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 205 | 3 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1004 | 174 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1295 | 142 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 630 | 77 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 626 | 81 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 632 | 83 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1249 | 103 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1000 | 91 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 883 | 104 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1367 | 85 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 621 | 86 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1738 | 179 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2256 | 385 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 615 | 86 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 609 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 610 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1174 | 89 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1027 | 171 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1180 | 175 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 620 | 88 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 627 | 88 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2238 | 86 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 616 | 56 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 624 | 60 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 625 | 63 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 622 | 38 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 620 | 28 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 619 | 56 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 618 | 61 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 616 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 616 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 615 | 60 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 617 | 49 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 616 | 50 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 619 | 97 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 615 | 27 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 614 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 616 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 617 | 62 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 615 | 62 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 614 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 617 | 27 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 618 | 27 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 617 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 618 | 28 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 614 | 47 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 856 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 617 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 614 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 618 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 863 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 617 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 615 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 622 | 61 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 617 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 651 | 61 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1244 | 81 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1251 | 81 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1257 | 85 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1259 | 79 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1012 | 82 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 628 | 48 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1031 | 81 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1022 | 81 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1033 | 73 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1012 | 85 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1005 | 116 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1294 | 96 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 633 | 43 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 633 | 45 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 633 | 47 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1498 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1007 | 40 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 894 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1378 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 628 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1724 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2265 | 253 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 622 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 610 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 612 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 610 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 612 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1198 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1043 | 105 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1202 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 629 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 645 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2258 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 631 | 64 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 638 | 60 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 636 | 63 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 645 | 40 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 632 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 633 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 632 | 63 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 626 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 631 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 629 | 60 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 635 | 53 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 632 | 50 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 624 | 106 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 622 | 27 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 626 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 622 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 625 | 62 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 625 | 62 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 628 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 625 | 27 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 624 | 27 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 626 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 622 | 28 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 627 | 47 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 875 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 622 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 627 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 627 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 878 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 628 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 630 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 645 | 61 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 623 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 630 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 694 | 61 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1273 | 81 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1271 | 81 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1280 | 85 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1272 | 79 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1018 | 88 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 629 | 48 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1016 | 81 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1059 | 81 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1040 | 73 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1017 | 85 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1021 | 103 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1309 | 96 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 639 | 43 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 889 | 45 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 651 | 47 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1267 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1014 | 42 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 900 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1267 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 625 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1726 | 99 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2256 | 257 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 607 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1182 | 51 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1030 | 113 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1180 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 620 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 632 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2238 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 618 | 45 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 627 | 44 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 631 | 47 | identity ok |
| PASS | mobile-390x844 | /managers | view | 624 | 33 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 619 | 28 | identity ok |
| PASS | mobile-390x844 | /compare | view | 618 | 56 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 622 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 616 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 615 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 614 | 60 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 620 | 45 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 615 | 50 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 618 | 76 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 617 | 27 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 613 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 617 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 616 | 55 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 616 | 62 | h1 ok |
| PASS | mobile-390x844 | /support | view | 616 | 27 | legal links present |
| PASS | mobile-390x844 | /terms | view | 614 | 27 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 615 | 27 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 616 | 29 | h1 ok |
| PASS | mobile-390x844 | /about | view | 614 | 28 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 614 | 47 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 857 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 614 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 615 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 616 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 865 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 617 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 625 | 45 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 619 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 619 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 643 | 45 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1241 | 49 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1246 | 49 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1245 | 53 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1239 | 63 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 994 | 59 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 618 | 48 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1004 | 49 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1005 | 49 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1005 | 45 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1006 | 53 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 998 | 71 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1271 | 67 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 625 | 43 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 627 | 43 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1239 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 997 | 34 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 879 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1247 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 618 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1720 | 99 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2244 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 615 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 606 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 610 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1181 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1699 | 161 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1028 | 94 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1178 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 617 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 614 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1706 | 163 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 627 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2237 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 771 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 621 | 45 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 632 | 44 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 631 | 46 | identity ok |
| PASS | mobile-393x852 | /managers | view | 629 | 33 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 629 | 28 | identity ok |
| PASS | mobile-393x852 | /compare | view | 623 | 56 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 624 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 620 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 620 | 56 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 619 | 60 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 623 | 45 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 616 | 50 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 625 | 76 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 622 | 27 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 618 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 621 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 618 | 55 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 620 | 62 | h1 ok |
| PASS | mobile-393x852 | /support | view | 619 | 27 | legal links present |
| PASS | mobile-393x852 | /terms | view | 620 | 27 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 622 | 27 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 624 | 29 | h1 ok |
| PASS | mobile-393x852 | /about | view | 621 | 28 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 622 | 47 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 864 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 619 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 617 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 633 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 874 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 621 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 618 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 632 | 45 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 622 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 618 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 663 | 45 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1254 | 49 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1254 | 49 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1255 | 53 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1255 | 63 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1018 | 59 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 625 | 48 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1014 | 49 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1031 | 49 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1028 | 45 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1015 | 53 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1011 | 71 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1308 | 67 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 633 | 43 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 634 | 43 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 636 | 43 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1252 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1012 | 34 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 894 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1263 | 44 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 632 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1736 | 99 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2281 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 628 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 615 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 614 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 616 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 614 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 624 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1321 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1045 | 94 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1232 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 629 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 649 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2254 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 634 | 51 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 640 | 44 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 635 | 46 | identity ok |
| PASS | mobile-430x932 | /managers | view | 645 | 33 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 629 | 28 | identity ok |
| PASS | mobile-430x932 | /compare | view | 634 | 56 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 639 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 628 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 625 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 623 | 60 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 630 | 45 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 643 | 50 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 634 | 78 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 625 | 27 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 624 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 622 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 627 | 62 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 630 | 62 | h1 ok |
| PASS | mobile-430x932 | /support | view | 628 | 27 | legal links present |
| PASS | mobile-430x932 | /terms | view | 627 | 27 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 627 | 27 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 621 | 29 | h1 ok |
| PASS | mobile-430x932 | /about | view | 622 | 28 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 621 | 47 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 864 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 616 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 622 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 617 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 871 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 624 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 618 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 631 | 45 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 621 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 619 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 761 | 45 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1247 | 49 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1246 | 49 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1247 | 53 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1246 | 63 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 996 | 65 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 620 | 48 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1004 | 49 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1012 | 53 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1007 | 49 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1003 | 53 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 999 | 53 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1275 | 65 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 623 | 43 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 622 | 43 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 623 | 43 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1242 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1000 | 34 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 881 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1255 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 620 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1724 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2252 | 228 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 618 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 611 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 606 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 609 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1180 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1028 | 100 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1181 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 617 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2238 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 196 | 25 | 4 | 17 | 40 | 0 | 0/0 | 74 | 2 | 182 | 4/182 | 403 | 0 |
| OK | desktop-1280x720 | /players | 124 | 36 | 10 | 33 | 60 | 0 | 0/0 | 94 | 0 | 105 | 4/79 | 408 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 135 | 36 | 12 | 33 | 48 | 0 | 0/0 | 92 | 0 | 398 | 4/398 | 406 | 0 |
| OK | desktop-1280x720 | /managers | 40 | 32 | 9 | 30 | 52 | 0 | 0/0 | 79 | 0 | 21 | 0/0 | 396 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 57 | 35 | 9 | 33 | 56 | 0 | 0/0 | 75 | 0 | 79 | 0/0 | 409 | 0 |
| OK | desktop-1280x720 | /squads | 118 | 27 | 7 | 25 | 316 | 0 | 0/0 | 93 | 3 | 24 | 0/0 | 288 | 0 |
| OK | desktop-1280x720 | /best-xi | 50 | 29 | 4 | 12 | 40 | 0 | 0/0 | 82 | 0 | 28 | 0/0 | 292 | 0 |
| OK | mobile-390x844 | / | 83 | 24 | 4 | 13 | 36 | 0 | 0/0 | 46 | 0 | 69 | 4/69 | 401 | 0 |
| OK | mobile-390x844 | /players | 83 | 34 | 11 | 32 | 48 | 0 | 0/0 | 43 | 2 | 59 | 4/59 | 408 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 70 | 38 | 14 | 36 | 48 | 0 | 0/0 | 46 | 1 | 405 | 4/405 | 407 | 0 |
| OK | mobile-390x844 | /managers | 38 | 28 | 10 | 26 | 44 | 0 | 0/0 | 33 | 1 | 17 | 0/0 | 402 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 64 | 37 | 10 | 35 | 52 | 0 | 0/0 | 43 | 1 | 55 | 0/0 | 409 | 0 |
| OK | mobile-390x844 | /squads | 45 | 27 | 7 | 26 | 312 | 0 | 0/0 | 48 | 1 | 22 | 0/0 | 288 | 0 |
| OK | mobile-390x844 | /best-xi | 67 | 26 | 4 | 12 | 32 | 0 | 0/0 | 60 | 1 | 28 | 0/0 | 285 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10778, 13140, 13134, 13139, 13134, 13138, 13137, 13138, 13136, 13143

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
