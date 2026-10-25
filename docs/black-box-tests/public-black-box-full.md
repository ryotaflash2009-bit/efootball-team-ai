# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-25T19:18:47.124Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.22)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 645 | 75 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 625 | 93 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 626 | 91 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 624 | 78 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 621 | 68 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 618 | 85 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 617 | 88 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 617 | 83 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 616 | 87 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 616 | 81 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 623 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 617 | 81 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 618 | 107 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 617 | 68 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 619 | 81 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 618 | 81 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 618 | 81 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 626 | 81 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 618 | 68 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 618 | 68 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 619 | 68 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 617 | 70 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 614 | 69 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 617 | 68 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 872 | 81 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 616 | 83 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 620 | 83 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 618 | 82 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 864 | 82 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 615 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 618 | 86 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 627 | 96 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 616 | 85 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 621 | 87 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 803 | 96 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1252 | 118 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1247 | 118 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1245 | 122 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1245 | 113 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1010 | 100 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 617 | 84 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1002 | 118 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 997 | 118 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 997 | 110 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 997 | 122 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1004 | 137 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1270 | 121 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 626 | 76 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 622 | 80 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 626 | 82 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1244 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 2724 | 180 | booster=1, 0 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 886 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1372 | 84 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 624 | 83 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1729 | 177 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2255 | 375 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 619 | 85 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 606 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 613 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 611 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1179 | 88 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1710 | 241 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1030 | 155 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1185 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 630 | 87 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 617 | 86 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1817 | 242 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 629 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2240 | 83 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 816 | 85 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 616 | 86 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 624 | 95 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 624 | 94 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 625 | 83 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 618 | 70 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 618 | 87 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 619 | 90 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 614 | 85 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 619 | 90 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 614 | 83 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 619 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 613 | 83 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 615 | 133 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 617 | 70 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 614 | 83 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 614 | 83 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 614 | 83 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 620 | 83 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 616 | 72 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 614 | 70 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 616 | 70 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 615 | 72 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 618 | 71 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 617 | 70 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 860 | 83 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 618 | 85 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 614 | 85 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 616 | 84 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 867 | 84 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 620 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 618 | 86 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 626 | 96 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 618 | 85 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 619 | 87 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 659 | 96 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1244 | 118 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1245 | 118 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1248 | 122 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1242 | 113 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 996 | 110 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 617 | 84 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1005 | 118 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 999 | 118 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 999 | 110 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 999 | 122 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1001 | 161 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1276 | 134 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 626 | 76 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 622 | 80 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 622 | 82 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1241 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 996 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 1124 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1366 | 84 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 620 | 85 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1724 | 177 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2257 | 375 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 617 | 85 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 609 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1177 | 88 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1026 | 169 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1185 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 617 | 87 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 628 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2232 | 85 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 619 | 86 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 630 | 113 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 623 | 93 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 626 | 86 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 620 | 85 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 618 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 619 | 92 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 616 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 615 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 617 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 620 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 617 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 617 | 137 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 614 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 614 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 613 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 615 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 616 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 614 | 72 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 614 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 621 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 614 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 615 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 619 | 70 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 859 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 616 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 616 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 616 | 84 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 862 | 84 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 615 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 619 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 629 | 114 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 617 | 85 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 618 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 673 | 114 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1253 | 152 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1246 | 152 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1244 | 152 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1247 | 131 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1002 | 128 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 618 | 84 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1000 | 152 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1003 | 148 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1002 | 144 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 999 | 158 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1000 | 179 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1279 | 141 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 625 | 76 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 623 | 80 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 625 | 82 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1240 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 996 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 879 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1371 | 84 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 620 | 85 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1720 | 177 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2252 | 379 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 617 | 85 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 611 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1179 | 88 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1030 | 169 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1183 | 173 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 619 | 87 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 627 | 87 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2231 | 85 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 616 | 57 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 626 | 63 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 624 | 63 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 623 | 38 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 618 | 28 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 619 | 56 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 620 | 60 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 616 | 47 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 615 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 612 | 59 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 624 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 616 | 50 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 616 | 101 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 617 | 27 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 614 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 617 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 617 | 61 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 617 | 61 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 612 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 614 | 27 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 616 | 27 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 616 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 614 | 28 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 617 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 866 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 614 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 615 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 617 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 862 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 616 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 615 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 627 | 64 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 619 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 616 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 757 | 64 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1250 | 84 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1245 | 84 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1243 | 88 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1241 | 82 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 993 | 83 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 614 | 51 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 999 | 84 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1009 | 76 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1006 | 68 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1008 | 88 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1000 | 106 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1272 | 95 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 627 | 43 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 623 | 45 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 624 | 47 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1240 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 997 | 40 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 880 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1254 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 620 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1721 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2252 | 251 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 614 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 606 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 606 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 607 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1175 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1027 | 106 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1180 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 617 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 624 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2233 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 617 | 65 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 624 | 63 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 622 | 64 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 624 | 40 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 620 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 616 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 619 | 62 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 614 | 47 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 616 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 614 | 59 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 619 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 612 | 50 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 617 | 110 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 615 | 27 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 615 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 614 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 616 | 61 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 614 | 61 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 617 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 617 | 27 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 619 | 27 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 614 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 616 | 28 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 615 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 859 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 614 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 615 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 617 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 864 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 616 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 624 | 64 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 617 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 617 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 651 | 64 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1247 | 84 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1244 | 84 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1246 | 88 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1244 | 82 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 996 | 89 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 617 | 51 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 999 | 84 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1007 | 84 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1009 | 76 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1007 | 88 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1000 | 88 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1269 | 95 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 629 | 43 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 624 | 45 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 625 | 47 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1483 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 994 | 42 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 880 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1369 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 618 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1722 | 99 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2253 | 255 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 618 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 609 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 610 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 611 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1301 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1027 | 116 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1177 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 619 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2241 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 615 | 45 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 623 | 47 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 625 | 47 | identity ok |
| PASS | mobile-390x844 | /managers | view | 620 | 33 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 618 | 28 | identity ok |
| PASS | mobile-390x844 | /compare | view | 617 | 56 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 618 | 47 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 615 | 47 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 614 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 613 | 59 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 619 | 44 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 612 | 50 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 616 | 80 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 619 | 27 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 614 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 613 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 613 | 54 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 616 | 61 | h1 ok |
| PASS | mobile-390x844 | /support | view | 613 | 27 | legal links present |
| PASS | mobile-390x844 | /terms | view | 616 | 27 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 617 | 27 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 619 | 29 | h1 ok |
| PASS | mobile-390x844 | /about | view | 612 | 28 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 613 | 46 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 859 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 616 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 616 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 621 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 864 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 619 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 615 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 625 | 48 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 615 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 617 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 759 | 48 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1250 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1246 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1248 | 56 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1240 | 66 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1000 | 60 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 619 | 51 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 998 | 52 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1006 | 52 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1007 | 48 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1002 | 56 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 205 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1000 | 56 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1271 | 66 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 624 | 43 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 625 | 43 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1241 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 994 | 34 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 880 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1365 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 616 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1724 | 99 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2247 | 242 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 614 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 606 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 611 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1177 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1700 | 165 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1024 | 94 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1179 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 619 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 618 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1702 | 164 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2235 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 757 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 616 | 45 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 620 | 47 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 623 | 46 | identity ok |
| PASS | mobile-393x852 | /managers | view | 624 | 33 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 618 | 28 | identity ok |
| PASS | mobile-393x852 | /compare | view | 619 | 56 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 616 | 47 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 615 | 47 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 615 | 55 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 616 | 59 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 618 | 44 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 612 | 50 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 616 | 80 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 613 | 27 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 617 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 615 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 614 | 54 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 620 | 61 | h1 ok |
| PASS | mobile-393x852 | /support | view | 616 | 27 | legal links present |
| PASS | mobile-393x852 | /terms | view | 616 | 27 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 612 | 27 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 615 | 29 | h1 ok |
| PASS | mobile-393x852 | /about | view | 614 | 28 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 617 | 46 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 857 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 618 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 613 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 616 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 864 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 616 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 617 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 625 | 48 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 615 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 614 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 646 | 48 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1245 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1241 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1245 | 56 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1243 | 66 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 991 | 60 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 618 | 51 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1002 | 52 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1012 | 52 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1011 | 48 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 999 | 56 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 998 | 78 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1274 | 66 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 624 | 43 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 625 | 43 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 629 | 43 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1238 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 997 | 34 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 877 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1363 | 45 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 619 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1720 | 99 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2250 | 242 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 608 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 613 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 606 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 607 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1177 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1024 | 94 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1182 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 618 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 623 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2231 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 616 | 51 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 624 | 47 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 627 | 46 | identity ok |
| PASS | mobile-430x932 | /managers | view | 619 | 33 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 622 | 28 | identity ok |
| PASS | mobile-430x932 | /compare | view | 617 | 56 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 619 | 47 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 614 | 47 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 615 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 617 | 59 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 617 | 46 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 613 | 50 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 614 | 82 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 615 | 27 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 615 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 615 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 617 | 61 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 617 | 61 | h1 ok |
| PASS | mobile-430x932 | /support | view | 615 | 27 | legal links present |
| PASS | mobile-430x932 | /terms | view | 616 | 27 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 617 | 27 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 614 | 29 | h1 ok |
| PASS | mobile-430x932 | /about | view | 614 | 28 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 616 | 46 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 859 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 617 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 616 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 617 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 863 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 616 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 615 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 624 | 48 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 616 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 614 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 655 | 48 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1244 | 52 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1239 | 52 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1241 | 56 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1244 | 66 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 999 | 66 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 621 | 51 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 997 | 52 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1006 | 52 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1005 | 48 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1006 | 56 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1000 | 56 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1271 | 65 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 625 | 43 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 621 | 43 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 621 | 43 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1240 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 994 | 34 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 878 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1366 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 617 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1720 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2246 | 226 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 616 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 607 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 607 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 607 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 605 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1178 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1026 | 100 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1181 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 615 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 626 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2230 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 191 | 23 | 4 | 13 | 44 | 0 | 0/0 | 73 | 2 | 166 | 4/166 | 286 | 0 |
| OK | desktop-1280x720 | /players | 71 | 35 | 10 | 32 | 56 | 0 | 0/0 | 93 | 0 | 122 | 4/43 | 409 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 124 | 37 | 12 | 34 | 52 | 0 | 0/0 | 91 | 0 | 334 | 4/334 | 411 | 0 |
| OK | desktop-1280x720 | /managers | 39 | 32 | 9 | 30 | 48 | 0 | 0/0 | 78 | 0 | 18 | 0/0 | 404 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 74 | 36 | 10 | 34 | 56 | 0 | 0/0 | 74 | 0 | 76 | 0/0 | 411 | 0 |
| OK | desktop-1280x720 | /squads | 45 | 26 | 6 | 24 | 316 | 0 | 0/0 | 91 | 3 | 21 | 0/0 | 288 | 0 |
| OK | desktop-1280x720 | /best-xi | 45 | 26 | 4 | 12 | 36 | 0 | 0/0 | 81 | 0 | 26 | 0/0 | 286 | 0 |
| OK | mobile-390x844 | / | 81 | 23 | 4 | 14 | 36 | 0 | 0/0 | 46 | 0 | 70 | 4/70 | 393 | 0 |
| OK | mobile-390x844 | /players | 60 | 39 | 11 | 36 | 56 | 0 | 0/0 | 46 | 2 | 45 | 4/45 | 413 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 66 | 35 | 11 | 33 | 44 | 0 | 0/0 | 46 | 1 | 330 | 4/330 | 404 | 0 |
| OK | mobile-390x844 | /managers | 37 | 25 | 8 | 24 | 40 | 0 | 0/0 | 33 | 1 | 16 | 0/0 | 399 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 58 | 34 | 9 | 33 | 52 | 0 | 0/0 | 43 | 1 | 61 | 0/0 | 409 | 0 |
| OK | mobile-390x844 | /squads | 42 | 25 | 7 | 24 | 312 | 0 | 0/0 | 47 | 1 | 19 | 0/0 | 287 | 0 |
| OK | mobile-390x844 | /best-xi | 43 | 25 | 4 | 12 | 36 | 0 | 0/0 | 59 | 0 | 26 | 0/0 | 286 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10791, 13190, 13189, 13188, 13192, 13191, 13195, 13188, 13192, 13186

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
