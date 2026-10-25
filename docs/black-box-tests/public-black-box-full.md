# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-25T20:12:58.266Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.22)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 646 | 75 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 626 | 93 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 626 | 91 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 625 | 78 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 621 | 68 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 618 | 85 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 620 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 614 | 84 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 617 | 88 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 615 | 81 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 620 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 616 | 81 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 619 | 107 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 619 | 68 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 613 | 81 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 614 | 81 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 618 | 81 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 623 | 81 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 618 | 68 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 616 | 68 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 618 | 68 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 616 | 70 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 618 | 69 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 616 | 68 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 858 | 81 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 616 | 83 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 616 | 83 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 615 | 82 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 863 | 82 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 618 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 617 | 86 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 627 | 96 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 621 | 85 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 618 | 87 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 765 | 96 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1251 | 118 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1247 | 118 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1246 | 122 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1244 | 113 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 998 | 100 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 618 | 84 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1002 | 118 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1002 | 118 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1002 | 110 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1246 | 122 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 998 | 154 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1279 | 121 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 627 | 76 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 620 | 80 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 628 | 82 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1242 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1001 | 99 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 881 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1364 | 84 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 630 | 83 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1725 | 177 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2261 | 377 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 617 | 85 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 611 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1176 | 88 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1715 | 254 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1029 | 155 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1183 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 617 | 87 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 618 | 86 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1823 | 243 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 629 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2243 | 83 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 821 | 85 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 617 | 86 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 627 | 95 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 628 | 94 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 624 | 83 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 617 | 70 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 619 | 87 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 622 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 617 | 86 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 613 | 91 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 615 | 83 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 623 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 617 | 83 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 619 | 133 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 616 | 70 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 614 | 83 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 617 | 83 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 613 | 83 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 624 | 83 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 616 | 72 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 615 | 70 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 615 | 70 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 614 | 72 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 616 | 71 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 615 | 70 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 860 | 83 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 618 | 85 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 616 | 85 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 616 | 84 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 866 | 84 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 615 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 616 | 86 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 627 | 96 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 614 | 85 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 619 | 87 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 660 | 96 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1249 | 118 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1251 | 118 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1248 | 122 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1242 | 113 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 997 | 110 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 617 | 84 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 998 | 118 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1000 | 118 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1002 | 110 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 998 | 122 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1000 | 161 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1278 | 134 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 622 | 76 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 627 | 80 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 625 | 82 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1242 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 997 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 879 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1367 | 84 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 618 | 85 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1722 | 177 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2250 | 377 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 617 | 85 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 608 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 610 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 607 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 608 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1176 | 88 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1029 | 169 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1179 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 616 | 87 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 639 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2236 | 85 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 614 | 86 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 630 | 113 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 628 | 94 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 623 | 86 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 621 | 85 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 619 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 620 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 615 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 615 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 617 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 625 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 616 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 618 | 137 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 614 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 612 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 613 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 615 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 615 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 614 | 72 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 616 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 615 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 617 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 613 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 614 | 70 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 858 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 614 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 617 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 614 | 84 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 861 | 84 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 618 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 620 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 627 | 114 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 616 | 85 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 617 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 662 | 114 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1246 | 152 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1246 | 152 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1246 | 152 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1248 | 131 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 997 | 128 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 620 | 84 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1000 | 152 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1001 | 148 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1002 | 144 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1000 | 158 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1000 | 177 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1281 | 139 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 621 | 76 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 623 | 80 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 629 | 82 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1243 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 998 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 1127 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1367 | 84 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 618 | 85 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1746 | 177 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2251 | 381 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 615 | 85 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 608 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1176 | 88 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1027 | 169 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1179 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 617 | 87 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 625 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2234 | 85 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 616 | 57 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 625 | 63 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 623 | 65 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 621 | 38 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 618 | 28 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 619 | 56 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 622 | 61 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 616 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 617 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 616 | 59 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 624 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 613 | 50 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 618 | 101 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 615 | 27 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 612 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 616 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 613 | 61 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 615 | 61 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 615 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 614 | 27 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 613 | 27 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 614 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 616 | 28 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 616 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 861 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 616 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 616 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 619 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 865 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 620 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 614 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 626 | 64 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 616 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 655 | 64 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1243 | 84 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1244 | 84 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1246 | 88 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1243 | 82 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 993 | 83 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 617 | 51 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1001 | 84 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1005 | 76 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1006 | 68 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1007 | 88 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 995 | 88 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1272 | 94 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 620 | 43 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 627 | 45 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 623 | 47 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1240 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 995 | 40 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 877 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1252 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 618 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1722 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2251 | 253 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 617 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 607 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 607 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 606 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1173 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1042 | 106 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1188 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 617 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 642 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2231 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 617 | 65 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 625 | 63 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 624 | 63 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 626 | 40 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 620 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 617 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 618 | 63 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 613 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 618 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 616 | 59 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 620 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 613 | 50 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 616 | 110 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 615 | 27 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 615 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 617 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 613 | 61 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 614 | 61 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 616 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 614 | 27 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 614 | 27 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 615 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 614 | 28 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 616 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 857 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 612 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 613 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 618 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 864 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 618 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 615 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 625 | 64 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 618 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 620 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 652 | 64 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1249 | 84 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1245 | 84 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1246 | 88 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1245 | 82 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 996 | 89 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 616 | 51 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 995 | 84 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1009 | 84 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1005 | 76 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1006 | 88 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1000 | 88 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1272 | 95 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 626 | 43 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 624 | 45 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 624 | 47 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1480 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 997 | 42 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 878 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1250 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 619 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1720 | 99 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2248 | 257 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 605 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 612 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 609 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1173 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1046 | 114 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1212 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 616 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 624 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2234 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 615 | 45 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 620 | 47 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 625 | 48 | identity ok |
| PASS | mobile-390x844 | /managers | view | 621 | 33 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 619 | 28 | identity ok |
| PASS | mobile-390x844 | /compare | view | 620 | 56 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 618 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 612 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 613 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 615 | 59 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 616 | 44 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 617 | 50 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 613 | 80 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 617 | 27 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 616 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 615 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 617 | 54 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 615 | 61 | h1 ok |
| PASS | mobile-390x844 | /support | view | 614 | 27 | legal links present |
| PASS | mobile-390x844 | /terms | view | 614 | 27 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 615 | 27 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 617 | 29 | h1 ok |
| PASS | mobile-390x844 | /about | view | 615 | 28 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 612 | 46 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 857 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 616 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 617 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 615 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 866 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 615 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 615 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 623 | 48 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 613 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 760 | 48 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1245 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1245 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1241 | 56 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1247 | 66 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 995 | 60 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 618 | 51 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1000 | 52 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1005 | 52 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1013 | 48 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1003 | 56 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 205 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1000 | 82 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1274 | 66 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 622 | 43 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 624 | 43 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 627 | 43 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1237 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 995 | 34 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 880 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1366 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 621 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1728 | 99 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2250 | 228 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 608 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 606 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 608 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1177 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1701 | 165 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1026 | 94 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1179 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 616 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 617 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1705 | 161 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2233 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 762 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 618 | 45 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 621 | 47 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 625 | 49 | identity ok |
| PASS | mobile-393x852 | /managers | view | 621 | 33 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 618 | 28 | identity ok |
| PASS | mobile-393x852 | /compare | view | 618 | 56 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 619 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 615 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 616 | 56 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 614 | 59 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 618 | 44 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 615 | 50 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 616 | 80 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 616 | 27 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 617 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 615 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 615 | 54 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 615 | 61 | h1 ok |
| PASS | mobile-393x852 | /support | view | 617 | 27 | legal links present |
| PASS | mobile-393x852 | /terms | view | 616 | 27 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 615 | 27 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 615 | 29 | h1 ok |
| PASS | mobile-393x852 | /about | view | 612 | 28 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 618 | 46 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 857 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 619 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 615 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 616 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 865 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 617 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 630 | 48 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 619 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 614 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 756 | 48 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1246 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1247 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1245 | 56 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1238 | 66 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 992 | 60 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 618 | 51 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 998 | 52 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1009 | 52 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1015 | 48 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 996 | 56 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1000 | 78 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1274 | 66 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 623 | 43 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 622 | 43 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 626 | 43 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1238 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 996 | 34 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 876 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1369 | 45 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 617 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1719 | 81 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2253 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 615 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 608 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 610 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 607 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 607 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1175 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1025 | 94 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1181 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 616 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 631 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2235 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 618 | 51 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 623 | 47 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 622 | 47 | identity ok |
| PASS | mobile-430x932 | /managers | view | 624 | 33 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 616 | 28 | identity ok |
| PASS | mobile-430x932 | /compare | view | 617 | 56 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 616 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 617 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 613 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 615 | 59 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 620 | 46 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 617 | 50 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 619 | 82 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 614 | 27 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 616 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 614 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 614 | 61 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 616 | 61 | h1 ok |
| PASS | mobile-430x932 | /support | view | 614 | 27 | legal links present |
| PASS | mobile-430x932 | /terms | view | 618 | 27 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 617 | 27 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 615 | 29 | h1 ok |
| PASS | mobile-430x932 | /about | view | 614 | 28 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 613 | 46 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 856 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 613 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 616 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 615 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 864 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 618 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 614 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 623 | 48 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 756 | 48 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1241 | 52 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1244 | 52 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1247 | 56 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1243 | 66 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 999 | 66 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 616 | 51 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1003 | 52 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1004 | 52 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1014 | 48 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 998 | 56 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1005 | 78 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1278 | 66 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 628 | 43 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 623 | 43 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 623 | 43 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1239 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 994 | 34 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 876 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1368 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 619 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1721 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2242 | 244 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 607 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 608 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1177 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1025 | 100 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1183 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 616 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 631 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2236 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 226 | 25 | 5 | 14 | 40 | 0 | 0/0 | 73 | 2 | 201 | 4/201 | 400 | 0 |
| OK | desktop-1280x720 | /players | 119 | 36 | 10 | 33 | 56 | 0 | 0/0 | 93 | 0 | 103 | 4/62 | 411 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 127 | 36 | 11 | 34 | 52 | 0 | 0/0 | 91 | 0 | 343 | 4/343 | 404 | 0 |
| OK | desktop-1280x720 | /managers | 44 | 27 | 9 | 25 | 44 | 0 | 0/0 | 78 | 0 | 29 | 0/0 | 295 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 68 | 40 | 9 | 38 | 60 | 0 | 0/0 | 74 | 0 | 54 | 0/0 | 414 | 0 |
| OK | desktop-1280x720 | /squads | 45 | 28 | 7 | 25 | 316 | 0 | 0/0 | 92 | 3 | 22 | 0/0 | 291 | 0 |
| OK | desktop-1280x720 | /best-xi | 49 | 25 | 5 | 12 | 36 | 0 | 0/0 | 81 | 0 | 29 | 0/0 | 286 | 0 |
| OK | mobile-390x844 | / | 78 | 23 | 5 | 14 | 36 | 0 | 0/0 | 46 | 0 | 69 | 4/69 | 285 | 0 |
| OK | mobile-390x844 | /players | 65 | 34 | 10 | 31 | 48 | 0 | 0/0 | 46 | 2 | 43 | 4/43 | 402 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 72 | 37 | 12 | 35 | 48 | 0 | 0/0 | 47 | 1 | 320 | 4/320 | 405 | 0 |
| OK | mobile-390x844 | /managers | 37 | 26 | 8 | 25 | 40 | 0 | 0/0 | 33 | 1 | 17 | 0/0 | 395 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 61 | 36 | 9 | 34 | 52 | 0 | 0/0 | 43 | 1 | 55 | 0/0 | 410 | 0 |
| OK | mobile-390x844 | /squads | 42 | 27 | 7 | 26 | 312 | 0 | 0/0 | 48 | 1 | 24 | 0/0 | 288 | 0 |
| OK | mobile-390x844 | /best-xi | 67 | 25 | 4 | 12 | 32 | 0 | 0/0 | 59 | 0 | 27 | 0/0 | 285 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10884, 13236, 13229, 13231, 13235, 13231, 13231, 13232, 13234, 13233

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
