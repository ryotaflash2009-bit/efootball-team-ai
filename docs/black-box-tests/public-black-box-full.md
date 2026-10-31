# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-31T14:44:18.810Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.22)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 856 | 82 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 639 | 96 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 634 | 96 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 628 | 82 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 636 | 71 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 633 | 91 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 627 | 93 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 622 | 87 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 617 | 91 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 620 | 84 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 922 | 84 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 618 | 84 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 636 | 112 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 623 | 71 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 618 | 84 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 618 | 84 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 620 | 84 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 621 | 85 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 620 | 71 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 623 | 71 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 621 | 71 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 619 | 73 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 622 | 72 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 622 | 71 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 865 | 84 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 617 | 86 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 620 | 85 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 618 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 872 | 85 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 619 | 87 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 619 | 89 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 634 | 99 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 624 | 88 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 621 | 90 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 775 | 99 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1260 | 103 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1254 | 103 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1257 | 125 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1496 | 116 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1010 | 88 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 621 | 87 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1012 | 122 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1007 | 121 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1008 | 113 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1010 | 125 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1015 | 164 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1299 | 126 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 651 | 85 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 633 | 89 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 636 | 91 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1247 | 100 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1003 | 88 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 894 | 101 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1378 | 87 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 622 | 86 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1729 | 183 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2272 | 403 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 623 | 88 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 611 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 615 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 613 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 612 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1192 | 91 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1733 | 263 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1035 | 165 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1195 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 624 | 90 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 623 | 89 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1840 | 264 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 643 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2258 | 86 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 865 | 88 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 619 | 93 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 636 | 98 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 629 | 99 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 631 | 87 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 624 | 73 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 623 | 93 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 621 | 95 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 617 | 89 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 618 | 94 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 618 | 86 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 784 | 85 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 618 | 86 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 631 | 138 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 621 | 73 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 622 | 86 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 618 | 86 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 621 | 86 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 629 | 87 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 619 | 75 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 621 | 73 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 621 | 73 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 621 | 75 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 619 | 74 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 617 | 73 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 860 | 86 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 620 | 88 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 618 | 87 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 620 | 87 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 871 | 87 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 625 | 87 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 619 | 89 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 635 | 99 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 621 | 88 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 623 | 90 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 701 | 99 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1256 | 110 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1255 | 110 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1255 | 125 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1257 | 116 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1006 | 106 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 626 | 87 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1011 | 122 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1012 | 121 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1010 | 113 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1008 | 125 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1009 | 164 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1302 | 139 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 629 | 85 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 631 | 89 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 632 | 91 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1253 | 103 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1014 | 91 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 890 | 104 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1375 | 87 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 625 | 88 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1751 | 183 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2268 | 403 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 623 | 88 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 614 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 614 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 613 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 613 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 612 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 610 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1190 | 91 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1032 | 179 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1192 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 625 | 90 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 639 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2243 | 88 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 623 | 93 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 641 | 116 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 633 | 98 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 636 | 90 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 626 | 88 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 623 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 623 | 97 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 620 | 89 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 620 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 621 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 795 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 619 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 633 | 142 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 619 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 621 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 618 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 619 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 624 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 622 | 75 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 618 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 620 | 73 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 621 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 619 | 74 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 619 | 73 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 867 | 86 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 619 | 88 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 616 | 87 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 622 | 87 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 873 | 87 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 623 | 87 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 623 | 89 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 638 | 117 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 622 | 88 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 621 | 90 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 692 | 117 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1258 | 128 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1255 | 128 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1259 | 155 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1258 | 134 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1004 | 108 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 623 | 87 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1010 | 142 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1009 | 151 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1012 | 147 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1013 | 161 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1007 | 180 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1296 | 146 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 631 | 85 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 631 | 89 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 636 | 91 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1247 | 106 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1004 | 94 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 892 | 107 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1369 | 87 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 627 | 88 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1722 | 183 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2269 | 407 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 620 | 88 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 614 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 612 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 607 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 612 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 610 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1309 | 91 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1039 | 179 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1194 | 179 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 623 | 90 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 639 | 90 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2239 | 88 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 620 | 63 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 635 | 60 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 629 | 66 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 630 | 36 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 628 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 629 | 59 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 627 | 64 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 618 | 49 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 618 | 57 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 620 | 62 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 809 | 54 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 618 | 49 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 633 | 99 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 618 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 620 | 52 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 620 | 59 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 621 | 65 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 619 | 66 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 619 | 34 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 617 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 617 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 620 | 45 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 619 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 621 | 48 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 860 | 45 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 620 | 48 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 620 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 622 | 47 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 869 | 47 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 620 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 623 | 47 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 634 | 61 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 620 | 48 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 622 | 48 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 683 | 61 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1257 | 66 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1263 | 66 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1253 | 85 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1253 | 80 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1000 | 74 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 622 | 49 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1010 | 66 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1018 | 73 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1019 | 65 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1004 | 85 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1006 | 104 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1294 | 98 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 635 | 48 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 626 | 50 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 627 | 52 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1252 | 59 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 999 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 888 | 58 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1265 | 46 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 624 | 49 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1724 | 101 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2270 | 273 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 621 | 49 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 612 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 608 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 613 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 611 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1186 | 50 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1034 | 113 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1190 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 621 | 52 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 639 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2238 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 622 | 71 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 638 | 60 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 629 | 66 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 628 | 38 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 628 | 48 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 622 | 59 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 624 | 66 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 619 | 49 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 619 | 57 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 618 | 62 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 771 | 54 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 630 | 49 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 631 | 108 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 621 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 616 | 52 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 619 | 59 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 619 | 65 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 623 | 66 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 617 | 34 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 620 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 621 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 620 | 45 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 618 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 621 | 48 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 864 | 45 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 619 | 48 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 616 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 621 | 47 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 867 | 47 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 620 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 620 | 47 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 631 | 61 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 620 | 48 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 618 | 48 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 777 | 61 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1259 | 74 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1270 | 74 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1254 | 85 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1251 | 80 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1000 | 88 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 620 | 49 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1010 | 74 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1037 | 81 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1019 | 73 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1007 | 85 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1006 | 117 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1294 | 98 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 633 | 48 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 630 | 50 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 634 | 52 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1243 | 61 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1005 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 887 | 60 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1367 | 46 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 621 | 49 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1722 | 101 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2267 | 277 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 618 | 49 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 616 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 611 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 611 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 611 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 614 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1190 | 52 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1033 | 121 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1192 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 623 | 52 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 635 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2237 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 620 | 52 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 632 | 44 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 633 | 50 | identity ok |
| PASS | mobile-390x844 | /managers | view | 629 | 31 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 623 | 26 | identity ok |
| PASS | mobile-390x844 | /compare | view | 626 | 59 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 622 | 50 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 614 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 618 | 57 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 617 | 62 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 765 | 48 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 626 | 49 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 630 | 78 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 616 | 25 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 618 | 52 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 621 | 59 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 617 | 56 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 619 | 66 | h1 ok |
| PASS | mobile-390x844 | /support | view | 619 | 25 | legal links present |
| PASS | mobile-390x844 | /terms | view | 618 | 25 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 620 | 25 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 618 | 27 | h1 ok |
| PASS | mobile-390x844 | /about | view | 617 | 26 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 621 | 48 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 862 | 45 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 617 | 48 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 618 | 46 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 625 | 47 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 874 | 47 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 617 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 619 | 47 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 635 | 45 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 622 | 48 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 624 | 48 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 678 | 45 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1256 | 47 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1254 | 47 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1257 | 53 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1251 | 64 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1009 | 65 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 623 | 49 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1010 | 50 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1024 | 49 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1009 | 45 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1005 | 53 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 201 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1004 | 72 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1288 | 69 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 631 | 48 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 630 | 48 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 632 | 48 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1242 | 54 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1006 | 32 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 888 | 53 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1374 | 46 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 627 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1729 | 101 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2265 | 264 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 620 | 49 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 612 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 608 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 611 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 608 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 613 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1188 | 50 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1720 | 183 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1032 | 102 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1190 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 621 | 52 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 621 | 51 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1716 | 178 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 633 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2240 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 775 | 52 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 621 | 52 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 629 | 44 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 630 | 49 | identity ok |
| PASS | mobile-393x852 | /managers | view | 627 | 31 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 623 | 26 | identity ok |
| PASS | mobile-393x852 | /compare | view | 620 | 59 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 622 | 50 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 617 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 618 | 58 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 617 | 62 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 757 | 48 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 617 | 49 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 635 | 78 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 620 | 25 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 618 | 52 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 617 | 59 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 622 | 56 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 620 | 66 | h1 ok |
| PASS | mobile-393x852 | /support | view | 622 | 25 | legal links present |
| PASS | mobile-393x852 | /terms | view | 617 | 25 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 620 | 25 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 619 | 27 | h1 ok |
| PASS | mobile-393x852 | /about | view | 619 | 26 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 619 | 48 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 860 | 45 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 619 | 48 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 617 | 46 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 619 | 47 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 869 | 47 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 622 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 618 | 47 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 628 | 45 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 618 | 48 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 620 | 48 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 772 | 45 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1251 | 47 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1254 | 47 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1254 | 53 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1250 | 64 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1007 | 65 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 625 | 49 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1011 | 49 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1021 | 49 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1012 | 45 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1009 | 53 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1006 | 72 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1287 | 69 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 630 | 48 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 632 | 48 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 632 | 48 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1253 | 54 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1006 | 32 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 883 | 53 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1259 | 46 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 622 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1731 | 101 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2262 | 264 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 620 | 49 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 611 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 609 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 609 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 610 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 611 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1187 | 50 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1033 | 102 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1193 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 621 | 52 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 638 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2239 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 620 | 58 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 629 | 44 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 627 | 49 | identity ok |
| PASS | mobile-430x932 | /managers | view | 632 | 31 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 623 | 26 | identity ok |
| PASS | mobile-430x932 | /compare | view | 624 | 59 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 623 | 50 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 619 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 617 | 57 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 617 | 62 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 777 | 50 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 627 | 49 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 633 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 619 | 25 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 618 | 52 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 620 | 59 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 620 | 65 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 620 | 66 | h1 ok |
| PASS | mobile-430x932 | /support | view | 619 | 25 | legal links present |
| PASS | mobile-430x932 | /terms | view | 620 | 25 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 619 | 25 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 621 | 27 | h1 ok |
| PASS | mobile-430x932 | /about | view | 618 | 26 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 620 | 48 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 868 | 45 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 617 | 48 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 617 | 46 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 623 | 47 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 875 | 47 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 622 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 622 | 47 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 633 | 45 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 622 | 48 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 620 | 48 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 670 | 45 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1252 | 47 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1254 | 47 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1251 | 53 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1249 | 64 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1003 | 71 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 618 | 49 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1012 | 50 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1011 | 49 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1027 | 45 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1007 | 53 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 201 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1017 | 72 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1291 | 69 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 630 | 48 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 631 | 48 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 632 | 48 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1246 | 54 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1005 | 32 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 887 | 53 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1373 | 46 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 623 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1729 | 101 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2265 | 264 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 619 | 49 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 610 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 610 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 610 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 611 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 612 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 609 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 607 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 613 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 609 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1190 | 50 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1035 | 108 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1190 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 620 | 52 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 633 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2244 | 50 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 243 | 35 | 6 | 21 | 56 | 0 | 0/0 | 80 | 2 | 222 | 4/222 | 409 | 0 |
| OK | desktop-1280x720 | /players | 195 | 47 | 13 | 42 | 84 | 0 | 0/0 | 96 | 0 | 172 | 4/97 | 422 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 239 | 50 | 16 | 47 | 72 | 0 | 0/0 | 96 | 0 | 386 | 4/386 | 419 | 0 |
| OK | desktop-1280x720 | /managers | 57 | 35 | 11 | 33 | 60 | 0 | 0/0 | 82 | 0 | 38 | 0/0 | 409 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 102 | 51 | 14 | 48 | 80 | 0 | 0/0 | 83 | 0 | 73 | 0/0 | 428 | 0 |
| OK | desktop-1280x720 | /squads | 71 | 37 | 10 | 35 | 324 | 0 | 0/0 | 96 | 0 | 42 | 0/0 | 303 | 0 |
| OK | desktop-1280x720 | /best-xi | 189 | 35 | 6 | 16 | 48 | 0 | 0/0 | 84 | 0 | 42 | 0/0 | 414 | 0 |
| OK | mobile-390x844 | / | 127 | 30 | 6 | 18 | 44 | 0 | 0/0 | 53 | 0 | 114 | 4/114 | 407 | 0 |
| OK | mobile-390x844 | /players | 125 | 45 | 13 | 42 | 68 | 0 | 0/0 | 43 | 2 | 91 | 4/91 | 419 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 118 | 45 | 15 | 43 | 60 | 0 | 0/0 | 49 | 1 | 407 | 4/407 | 414 | 0 |
| OK | mobile-390x844 | /managers | 60 | 35 | 11 | 33 | 52 | 0 | 0/0 | 31 | 1 | 28 | 0/0 | 411 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 87 | 51 | 14 | 49 | 76 | 0 | 0/0 | 48 | 1 | 77 | 0/0 | 425 | 0 |
| OK | mobile-390x844 | /squads | 69 | 36 | 9 | 34 | 316 | 0 | 0/0 | 50 | 1 | 33 | 0/0 | 297 | 0 |
| OK | mobile-390x844 | /best-xi | 121 | 33 | 6 | 16 | 44 | 0 | 0/0 | 62 | 0 | 43 | 0/0 | 300 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10860, 13163, 13276, 13276, 13275, 13280, 13271, 13274, 13277, 13295

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
