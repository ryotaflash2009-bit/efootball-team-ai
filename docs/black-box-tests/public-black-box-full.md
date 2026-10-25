# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-25T18:32:32.340Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.24)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 648 | 75 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 625 | 93 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 626 | 91 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 624 | 78 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 619 | 68 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 620 | 85 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 620 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 697 | 84 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 638 | 88 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 620 | 81 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 624 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 617 | 81 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 619 | 107 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 624 | 68 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 622 | 81 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 613 | 81 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 615 | 81 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 629 | 81 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 616 | 68 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 617 | 68 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 619 | 68 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 617 | 70 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 614 | 69 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 618 | 68 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 863 | 81 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 618 | 83 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 616 | 83 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 614 | 82 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 863 | 82 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 616 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 616 | 86 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 628 | 96 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 619 | 85 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 619 | 87 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 771 | 96 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1253 | 118 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1249 | 118 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1249 | 122 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1250 | 113 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1001 | 100 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 620 | 84 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1007 | 118 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1004 | 118 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1001 | 110 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1001 | 122 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1000 | 161 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1282 | 121 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 628 | 76 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 620 | 80 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 631 | 82 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1246 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1002 | 84 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 885 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1614 | 84 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 621 | 83 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1725 | 177 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2257 | 377 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 620 | 85 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 613 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 606 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1180 | 88 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1767 | 257 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1030 | 155 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1186 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 631 | 87 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 625 | 86 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1828 | 243 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 637 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2241 | 83 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 825 | 85 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 617 | 86 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 633 | 95 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 628 | 94 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 623 | 83 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 620 | 70 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 624 | 87 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 625 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 616 | 86 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 617 | 91 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 621 | 83 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 626 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 621 | 83 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 622 | 133 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 619 | 70 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 618 | 83 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 618 | 83 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 618 | 83 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 624 | 83 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 620 | 72 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 616 | 70 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 615 | 70 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 617 | 72 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 618 | 71 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 617 | 70 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 861 | 83 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 618 | 85 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 618 | 85 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 619 | 84 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 870 | 84 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 620 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 620 | 86 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 630 | 96 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 620 | 85 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 619 | 87 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 667 | 96 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1249 | 118 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1252 | 118 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1259 | 122 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1491 | 113 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1003 | 110 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 623 | 84 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1008 | 118 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1004 | 118 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1004 | 110 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1001 | 122 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 206 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1245 | 161 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1297 | 133 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 625 | 76 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 626 | 80 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 630 | 82 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1242 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 995 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 885 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1368 | 84 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 617 | 85 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1725 | 177 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2252 | 377 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 617 | 85 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 610 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 608 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1180 | 88 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1032 | 169 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1183 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 621 | 87 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 636 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2245 | 85 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 621 | 86 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 633 | 113 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 625 | 94 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 627 | 86 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 622 | 85 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 618 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 619 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 618 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 618 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 616 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 621 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 617 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 617 | 137 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 614 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 614 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 618 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 617 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 618 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 616 | 72 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 620 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 613 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 615 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 616 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 620 | 70 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 859 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 616 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 619 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 616 | 84 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 862 | 84 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 617 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 618 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 626 | 114 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 616 | 85 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 616 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 665 | 114 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1243 | 152 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1244 | 152 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1244 | 152 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1248 | 131 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 997 | 128 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 619 | 84 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1004 | 152 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 998 | 148 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1000 | 144 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1006 | 158 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 201 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1001 | 179 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1286 | 139 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 626 | 76 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 625 | 80 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 628 | 82 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1246 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1239 | 105 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 878 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1365 | 84 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 621 | 85 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1740 | 177 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2250 | 381 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 617 | 85 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1178 | 88 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1028 | 169 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1177 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 618 | 87 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2233 | 85 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 618 | 57 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 626 | 63 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 624 | 64 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 624 | 38 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 618 | 28 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 617 | 56 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 618 | 61 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 615 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 612 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 615 | 59 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 620 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 617 | 50 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 618 | 101 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 612 | 27 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 616 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 615 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 617 | 61 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 614 | 61 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 616 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 615 | 27 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 614 | 27 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 613 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 618 | 28 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 618 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 859 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 616 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 614 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 613 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 862 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 617 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 626 | 64 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 616 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 651 | 64 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1244 | 84 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1242 | 84 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1243 | 88 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1247 | 82 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 997 | 83 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 618 | 51 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1004 | 84 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1004 | 76 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1004 | 68 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1008 | 88 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1003 | 130 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1279 | 94 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 622 | 43 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 623 | 45 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 624 | 47 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1242 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 998 | 40 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 880 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1251 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 619 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1723 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2249 | 253 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 615 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 608 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 607 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 606 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 608 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1172 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1026 | 106 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1177 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 617 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 624 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2234 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 617 | 65 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 627 | 63 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 622 | 63 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 623 | 40 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 617 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 621 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 621 | 63 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 614 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 615 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 615 | 59 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 623 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 614 | 50 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 615 | 110 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 617 | 27 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 614 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 615 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 615 | 61 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 617 | 61 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 618 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 613 | 27 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 619 | 27 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 615 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 617 | 28 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 618 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 860 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 614 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 613 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 615 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 868 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 617 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 614 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 625 | 64 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 617 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 615 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 649 | 64 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1249 | 84 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1246 | 84 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1241 | 88 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1240 | 82 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1000 | 89 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 619 | 51 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 999 | 84 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1011 | 84 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1004 | 76 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 998 | 88 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 999 | 88 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1277 | 95 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 623 | 45 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 626 | 47 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1240 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 998 | 42 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 878 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1365 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 618 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1723 | 99 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2250 | 257 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 609 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 608 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1179 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1027 | 114 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1178 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 618 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2237 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 615 | 45 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 624 | 47 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 624 | 48 | identity ok |
| PASS | mobile-390x844 | /managers | view | 621 | 33 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 624 | 28 | identity ok |
| PASS | mobile-390x844 | /compare | view | 618 | 56 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 620 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 614 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 615 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 619 | 59 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 619 | 44 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 615 | 50 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 616 | 80 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 615 | 27 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 614 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 614 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 613 | 54 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 615 | 61 | h1 ok |
| PASS | mobile-390x844 | /support | view | 615 | 27 | legal links present |
| PASS | mobile-390x844 | /terms | view | 614 | 27 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 619 | 27 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 613 | 29 | h1 ok |
| PASS | mobile-390x844 | /about | view | 611 | 28 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 615 | 46 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 856 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 616 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 616 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 618 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 871 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 620 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 616 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 625 | 48 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 615 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 648 | 48 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1241 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1244 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1241 | 56 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1244 | 66 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 998 | 60 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 620 | 51 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1000 | 52 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1009 | 52 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1008 | 48 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1006 | 56 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1000 | 56 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1269 | 66 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 625 | 43 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 625 | 43 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1246 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 999 | 34 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 881 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1366 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 619 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1725 | 99 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2250 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 615 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 613 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 606 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 605 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1178 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1704 | 166 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1027 | 94 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1178 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 617 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 616 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1705 | 161 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 625 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2236 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 761 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 616 | 45 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 623 | 47 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 623 | 46 | identity ok |
| PASS | mobile-393x852 | /managers | view | 620 | 33 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 621 | 28 | identity ok |
| PASS | mobile-393x852 | /compare | view | 620 | 56 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 617 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 614 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 617 | 56 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 615 | 59 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 617 | 44 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 616 | 50 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 616 | 80 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 617 | 27 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 616 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 614 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 612 | 54 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 618 | 61 | h1 ok |
| PASS | mobile-393x852 | /support | view | 615 | 27 | legal links present |
| PASS | mobile-393x852 | /terms | view | 616 | 27 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 614 | 27 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 611 | 29 | h1 ok |
| PASS | mobile-393x852 | /about | view | 614 | 28 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 619 | 46 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 858 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 614 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 615 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 617 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 861 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 616 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 626 | 48 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 615 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 649 | 48 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1246 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1247 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1245 | 56 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1244 | 66 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1000 | 60 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 620 | 51 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 999 | 52 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1009 | 52 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1012 | 48 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 995 | 56 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 998 | 82 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1274 | 67 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 621 | 43 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 624 | 43 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1236 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 997 | 34 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 881 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1363 | 45 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 618 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1722 | 99 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2258 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 609 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 606 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1181 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1026 | 94 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1177 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 616 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 625 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2232 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 617 | 51 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 624 | 47 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 625 | 46 | identity ok |
| PASS | mobile-430x932 | /managers | view | 623 | 33 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 617 | 28 | identity ok |
| PASS | mobile-430x932 | /compare | view | 618 | 56 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 617 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 613 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 618 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 615 | 59 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 619 | 46 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 616 | 50 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 616 | 82 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 616 | 27 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 617 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 619 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 614 | 61 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 616 | 61 | h1 ok |
| PASS | mobile-430x932 | /support | view | 615 | 27 | legal links present |
| PASS | mobile-430x932 | /terms | view | 618 | 27 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 613 | 27 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 614 | 29 | h1 ok |
| PASS | mobile-430x932 | /about | view | 616 | 28 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 616 | 46 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 857 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 657 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 617 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 615 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 865 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 617 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 624 | 48 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 759 | 48 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1245 | 52 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1245 | 52 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1241 | 56 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1242 | 66 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1002 | 66 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 616 | 51 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1003 | 52 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1008 | 52 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1013 | 48 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1000 | 56 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1000 | 74 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1276 | 67 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 623 | 43 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 625 | 43 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1484 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 995 | 34 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 880 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1363 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 621 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1722 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2248 | 228 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 615 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 606 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1179 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1027 | 100 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1179 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 618 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 624 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2235 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 208 | 26 | 4 | 14 | 40 | 0 | 0/0 | 73 | 0 | 195 | 4/195 | 402 | 0 |
| OK | desktop-1280x720 | /players | 114 | 36 | 11 | 32 | 56 | 0 | 0/0 | 93 | 0 | 117 | 4/61 | 408 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 142 | 36 | 11 | 34 | 52 | 0 | 0/0 | 91 | 0 | 374 | 4/374 | 405 | 0 |
| OK | desktop-1280x720 | /managers | 51 | 30 | 8 | 27 | 44 | 0 | 0/0 | 78 | 0 | 22 | 0/0 | 403 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 68 | 36 | 10 | 33 | 56 | 0 | 0/0 | 74 | 0 | 67 | 0/0 | 411 | 0 |
| OK | desktop-1280x720 | /squads | 43 | 27 | 7 | 25 | 316 | 0 | 0/0 | 92 | 3 | 24 | 0/0 | 290 | 0 |
| OK | desktop-1280x720 | /best-xi | 49 | 29 | 4 | 12 | 40 | 0 | 0/0 | 81 | 0 | 28 | 0/0 | 291 | 0 |
| OK | mobile-390x844 | / | 81 | 24 | 4 | 13 | 44 | 0 | 0/0 | 46 | 0 | 71 | 4/71 | 399 | 0 |
| OK | mobile-390x844 | /players | 75 | 34 | 9 | 31 | 48 | 0 | 0/0 | 46 | 2 | 52 | 4/52 | 408 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 76 | 36 | 12 | 34 | 48 | 0 | 0/0 | 46 | 1 | 348 | 4/348 | 407 | 0 |
| OK | mobile-390x844 | /managers | 37 | 25 | 9 | 24 | 40 | 0 | 0/0 | 33 | 1 | 15 | 0/0 | 400 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 58 | 37 | 9 | 35 | 56 | 0 | 0/0 | 43 | 1 | 62 | 0/0 | 412 | 0 |
| OK | mobile-390x844 | /squads | 45 | 25 | 6 | 23 | 312 | 0 | 0/0 | 48 | 1 | 20 | 0/0 | 288 | 0 |
| OK | mobile-390x844 | /best-xi | 62 | 26 | 4 | 12 | 32 | 0 | 0/0 | 59 | 0 | 29 | 0/0 | 285 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10621, 13208, 13188, 13193, 13188, 13188, 13190, 13192, 13189, 13185

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
