# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-10-08T16:31:26.944Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,372 / Managers 69

**画面・操作: 576/576 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.24)**  **公開範囲・セキュリティ: 20/20 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 650 | 61 | World 13,372 |
| PASS | desktop-1280x720 | /players | view | 648 | 80 | 24 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 666 | 74 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 646 | 66 | managers 69 |
| PASS | desktop-1280x720 | /managers/65 | view | 650 | 55 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 649 | 71 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 647 | 73 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 649 | 68 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 647 | 72 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 648 | 65 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 649 | 65 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 651 | 65 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 651 | 65 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 647 | 65 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 649 | 55 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 646 | 55 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 649 | 55 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 654 | 57 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 648 | 55 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 644 | 55 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 649 | 70 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 655 | 67 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 644 | 67 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 652 | 66 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 882 | 66 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 649 | 66 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 633 | 66 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 669 | 81 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 644 | 67 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 649 | 67 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 779 | 81 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1286 | 101 | 24 results |
| PASS | desktop-1280x720 | /players | search en | 1300 | 101 | 24 results |
| PASS | desktop-1280x720 | /players | search unicode | 1303 | 105 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1301 | 93 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1047 | 86 | 24 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 651 | 66 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1051 | 101 | 24 cards |
| PASS | desktop-1280x720 | /players | position filter | 1033 | 101 | position set, 24 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1046 | 93 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1036 | 105 | sort set, 24 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1050 | 141 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1314 | 112 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 653 | 63 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 661 | 65 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 667 | 67 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1308 | 79 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1035 | 68 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 900 | 78 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1306 | 66 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 651 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1765 | 137 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2357 | 303 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 650 | 67 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 630 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 635 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 646 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 632 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1214 | 68 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 2049 | 200 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1334 | 125 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 652 | 67 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 641 | 65 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1795 | 203 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 666 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2323 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 899 | 67 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 647 | 72 | World 13,372 |
| PASS | desktop-1440x900 | /players | view | 647 | 92 | 24 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 669 | 74 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 653 | 69 | managers 69 |
| PASS | desktop-1440x900 | /managers/65 | view | 650 | 55 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 650 | 71 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 637 | 73 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 636 | 68 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 649 | 73 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 651 | 65 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 648 | 65 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 650 | 65 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 652 | 65 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 653 | 65 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 652 | 57 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 654 | 55 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 646 | 55 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 646 | 57 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 651 | 55 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 650 | 55 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 635 | 70 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 653 | 67 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 650 | 67 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 655 | 66 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 899 | 66 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 647 | 66 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 653 | 66 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 667 | 93 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 654 | 67 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 641 | 67 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 697 | 93 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1318 | 125 | 24 results |
| PASS | desktop-1440x900 | /players | search en | 1291 | 125 | 24 results |
| PASS | desktop-1440x900 | /players | search unicode | 1304 | 129 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1299 | 105 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1056 | 108 | 24 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 646 | 66 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1036 | 125 | 24 cards |
| PASS | desktop-1440x900 | /players | position filter | 1033 | 121 | position set, 24 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1050 | 117 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1055 | 129 | sort set, 24 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1041 | 153 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1316 | 112 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 665 | 63 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 646 | 65 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 648 | 67 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1283 | 82 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1049 | 71 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 899 | 81 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1292 | 66 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 654 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1779 | 137 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2348 | 303 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 646 | 67 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 649 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 644 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 625 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 628 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 625 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 631 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1211 | 68 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1087 | 137 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1229 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 653 | 67 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 681 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2322 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 648 | 88 | World 13,372 |
| PASS | desktop-1920x1080 | /players | view | 651 | 98 | 24 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 669 | 74 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 666 | 72 | managers 69 |
| PASS | desktop-1920x1080 | /managers/65 | view | 650 | 67 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 638 | 71 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 646 | 75 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 653 | 68 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 648 | 72 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 636 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 655 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 650 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 651 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 649 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 653 | 57 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 652 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 637 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 649 | 65 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 648 | 55 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 650 | 55 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 650 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 651 | 67 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 652 | 67 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 648 | 66 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 887 | 66 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 650 | 66 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 639 | 66 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 651 | 99 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 650 | 67 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 636 | 67 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 673 | 99 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1279 | 135 | 24 results |
| PASS | desktop-1920x1080 | /players | search en | 1300 | 135 | 24 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1301 | 135 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1295 | 111 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1048 | 130 | 24 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 646 | 66 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1036 | 135 | 24 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1062 | 131 | position set, 24 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1037 | 127 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1043 | 141 | sort set, 24 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1049 | 159 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1342 | 118 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 650 | 63 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 649 | 65 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 654 | 67 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1295 | 85 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1057 | 74 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 913 | 84 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1303 | 66 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 651 | 67 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1784 | 137 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2348 | 307 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 652 | 67 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 621 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 624 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 640 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 623 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 640 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1364 | 68 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1073 | 153 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1214 | 133 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 654 | 67 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 655 | 67 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2327 | 67 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 662 | 57 | World 13,372 |
| PASS | tablet-768x1024 | /players | view | 652 | 52 | 24 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 651 | 52 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 652 | 31 | managers 69 |
| PASS | tablet-768x1024 | /managers/65 | view | 653 | 21 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 649 | 49 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 637 | 54 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 636 | 41 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 647 | 48 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 635 | 52 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 653 | 44 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 624 | 48 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 639 | 54 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 650 | 54 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 652 | 29 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 647 | 20 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 652 | 20 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 634 | 37 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 651 | 20 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 658 | 42 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 647 | 42 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 654 | 40 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 647 | 39 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 645 | 39 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 892 | 39 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 636 | 39 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 636 | 39 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 654 | 53 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 650 | 40 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 650 | 40 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 667 | 53 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1300 | 73 | 24 results |
| PASS | tablet-768x1024 | /players | search en | 1292 | 73 | 24 results |
| PASS | tablet-768x1024 | /players | search unicode | 1292 | 77 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1294 | 68 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1040 | 81 | 24 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 643 | 40 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1034 | 73 | 24 cards |
| PASS | tablet-768x1024 | /players | position filter | 1057 | 73 | position set, 24 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1064 | 65 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1041 | 77 | sort set, 24 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 214 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1052 | 77 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1329 | 79 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 648 | 38 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 651 | 40 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 659 | 42 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1281 | 51 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1050 | 33 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 915 | 50 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 2219 | 38 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 854 | 41 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1789 | 85 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2424 | 223 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 651 | 41 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 642 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 648 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 642 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 648 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 652 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 634 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 642 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 654 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 652 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 653 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1380 | 42 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1134 | 99 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1242 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 656 | 44 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 679 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2361 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 666 | 57 | World 13,372 |
| PASS | tablet-820x1180 | /players | view | 658 | 60 | 24 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 697 | 52 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 670 | 33 | managers 69 |
| PASS | tablet-820x1180 | /managers/65 | view | 671 | 40 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 679 | 49 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 670 | 56 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 649 | 41 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 652 | 48 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 652 | 52 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 654 | 44 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 651 | 48 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 650 | 54 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 637 | 54 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 656 | 29 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 658 | 20 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 646 | 20 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 652 | 37 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 656 | 20 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 668 | 42 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 654 | 42 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 666 | 40 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 652 | 39 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 654 | 39 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 920 | 39 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 659 | 39 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 665 | 39 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 653 | 61 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 648 | 40 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 656 | 40 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 702 | 61 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1336 | 89 | 24 results |
| PASS | tablet-820x1180 | /players | search en | 1314 | 89 | 24 results |
| PASS | tablet-820x1180 | /players | search unicode | 1316 | 93 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1312 | 76 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1071 | 89 | 24 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 673 | 40 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1060 | 89 | 24 cards |
| PASS | tablet-820x1180 | /players | position filter | 1069 | 79 | position set, 24 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1072 | 73 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1058 | 93 | sort set, 24 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1073 | 124 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1352 | 87 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 673 | 38 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 652 | 40 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 674 | 42 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1354 | 53 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1083 | 35 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 910 | 52 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1419 | 38 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 654 | 41 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1794 | 85 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2350 | 227 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 650 | 41 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 642 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 657 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 654 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 647 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 640 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 642 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 655 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 652 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 640 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 650 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1229 | 42 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1092 | 99 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1258 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 672 | 44 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 666 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2345 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 646 | 42 | World 13,372 |
| PASS | mobile-390x844 | /players | view | 652 | 36 | 24 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 674 | 39 | identity ok |
| PASS | mobile-390x844 | /managers | view | 668 | 26 | managers 69 |
| PASS | mobile-390x844 | /managers/65 | view | 657 | 21 | identity ok |
| PASS | mobile-390x844 | /compare | view | 639 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 652 | 41 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 653 | 41 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 655 | 48 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 654 | 52 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 648 | 44 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 650 | 48 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 637 | 47 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 648 | 54 | h1 ok |
| PASS | mobile-390x844 | /support | view | 648 | 20 | legal links present |
| PASS | mobile-390x844 | /terms | view | 652 | 20 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 642 | 20 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 655 | 22 | h1 ok |
| PASS | mobile-390x844 | /about | view | 650 | 20 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 649 | 42 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 654 | 42 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 649 | 40 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 653 | 39 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 669 | 39 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 793 | 39 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 653 | 39 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 650 | 39 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 641 | 37 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 647 | 40 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 669 | 40 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 688 | 37 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1310 | 41 | 24 results |
| PASS | mobile-390x844 | /players | search en | 1321 | 41 | 24 results |
| PASS | mobile-390x844 | /players | search unicode | 1309 | 45 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1325 | 52 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1060 | 52 | 24 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 653 | 40 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1059 | 41 | 24 cards |
| PASS | mobile-390x844 | /players | position filter | 1056 | 45 | position set, 24 cards |
| PASS | mobile-390x844 | /players | card type filter | 1060 | 41 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1034 | 45 | sort set, 24 cards |
| PASS | mobile-390x844 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1051 | 68 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1315 | 53 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 651 | 38 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 656 | 38 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 669 | 38 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1289 | 46 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1064 | 27 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 934 | 45 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1453 | 38 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 662 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1795 | 85 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2378 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 654 | 41 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 642 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 656 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 656 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 656 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 650 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 649 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 640 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 638 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 641 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1237 | 42 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1788 | 143 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1086 | 84 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1240 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 650 | 44 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 648 | 42 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1770 | 144 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 665 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2317 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 836 | 44 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 655 | 42 | World 13,372 |
| PASS | mobile-393x852 | /players | view | 678 | 36 | 24 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 670 | 38 | identity ok |
| PASS | mobile-393x852 | /managers | view | 654 | 26 | managers 69 |
| PASS | mobile-393x852 | /managers/65 | view | 647 | 21 | identity ok |
| PASS | mobile-393x852 | /compare | view | 651 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 656 | 41 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 653 | 41 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 667 | 49 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 639 | 52 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 656 | 44 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 657 | 48 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 638 | 47 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 654 | 54 | h1 ok |
| PASS | mobile-393x852 | /support | view | 657 | 20 | legal links present |
| PASS | mobile-393x852 | /terms | view | 651 | 20 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 654 | 20 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 651 | 22 | h1 ok |
| PASS | mobile-393x852 | /about | view | 655 | 20 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 656 | 42 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 651 | 42 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 657 | 40 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 669 | 39 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 663 | 39 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 809 | 39 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 656 | 39 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 655 | 39 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 666 | 37 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 656 | 40 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 669 | 40 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 672 | 37 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1326 | 41 | 24 results |
| PASS | mobile-393x852 | /players | search en | 1326 | 41 | 24 results |
| PASS | mobile-393x852 | /players | search unicode | 1305 | 45 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1326 | 52 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1069 | 52 | 24 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 650 | 40 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1067 | 41 | 24 cards |
| PASS | mobile-393x852 | /players | position filter | 1085 | 45 | position set, 24 cards |
| PASS | mobile-393x852 | /players | card type filter | 1071 | 41 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1063 | 45 | sort set, 24 cards |
| PASS | mobile-393x852 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1070 | 64 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1368 | 53 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 670 | 38 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 673 | 38 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 660 | 38 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1303 | 46 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1073 | 27 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 953 | 45 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1451 | 38 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 657 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1796 | 85 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2372 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 664 | 41 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 641 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 652 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 652 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 641 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 652 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 640 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 654 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 651 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1233 | 42 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1093 | 84 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1260 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 671 | 44 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 672 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2385 | 42 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 657 | 48 | World 13,372 |
| PASS | mobile-430x932 | /players | view | 669 | 36 | 24 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 684 | 38 | identity ok |
| PASS | mobile-430x932 | /managers | view | 656 | 26 | managers 69 |
| PASS | mobile-430x932 | /managers/65 | view | 654 | 21 | identity ok |
| PASS | mobile-430x932 | /compare | view | 659 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 665 | 41 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 660 | 41 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 666 | 48 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 652 | 52 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 651 | 44 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 655 | 48 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 653 | 47 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 653 | 54 | h1 ok |
| PASS | mobile-430x932 | /support | view | 658 | 20 | legal links present |
| PASS | mobile-430x932 | /terms | view | 651 | 20 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 652 | 20 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 656 | 22 | h1 ok |
| PASS | mobile-430x932 | /about | view | 646 | 20 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 656 | 42 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 656 | 42 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 653 | 40 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 656 | 39 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 639 | 39 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 807 | 39 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 655 | 39 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 652 | 39 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 656 | 37 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 656 | 40 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 665 | 40 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 667 | 37 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1321 | 41 | 24 results |
| PASS | mobile-430x932 | /players | search en | 1310 | 41 | 24 results |
| PASS | mobile-430x932 | /players | search unicode | 1313 | 45 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1322 | 52 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1059 | 58 | 24 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 652 | 40 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1062 | 41 | 24 cards |
| PASS | mobile-430x932 | /players | position filter | 1064 | 45 | position set, 24 cards |
| PASS | mobile-430x932 | /players | card type filter | 1068 | 41 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1052 | 45 | sort set, 24 cards |
| PASS | mobile-430x932 | /players | nationality filter | 218 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1073 | 45 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1357 | 53 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 664 | 38 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 671 | 38 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 667 | 38 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1328 | 46 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1070 | 27 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 943 | 45 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1448 | 38 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 655 | 41 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1805 | 85 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2384 | 214 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 669 | 41 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 640 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 641 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 640 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 660 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1242 | 42 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1089 | 90 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1252 | 87 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 665 | 44 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 670 | 44 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2365 | 42 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 193 | 29 | 11 | 27 | 48 | 0 | 0/0 | 61 | 0 | 150 | 4/150 | 308 | 0 |
| OK | desktop-1280x720 | /players | 107 | 56 | 13 | 40 | 84 | 0 | 0/0 | 81 | 0 | 160 | 4/68 | 436 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 98 | 46 | 20 | 44 | 68 | 0 | 0/0 | 75 | 0 | 50 | 2/47 | 449 | 0 |
| OK | desktop-1280x720 | /managers | 109 | 40 | 23 | 37 | 64 | 0 | 0/0 | 67 | 0 | 52 | 0/0 | 318 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 111 | 51 | 18 | 49 | 80 | 0 | 0/0 | 64 | 0 | 70 | 0/0 | 335 | 0 |
| OK | desktop-1280x720 | /squads | 86 | 32 | 9 | 30 | 364 | 0 | 0/0 | 77 | 0 | 37 | 0/0 | 312 | 0 |
| OK | desktop-1280x720 | /best-xi | 77 | 27 | 6 | 14 | 40 | 0 | 0/0 | 66 | 0 | 47 | 0/0 | 294 | 0 |
| OK | mobile-390x844 | / | 174 | 43 | 11 | 41 | 60 | 0 | 0/0 | 43 | 0 | 138 | 4/138 | 450 | 0 |
| OK | mobile-390x844 | /players | 125 | 43 | 14 | 41 | 64 | 0 | 0/0 | 37 | 0 | 108 | 4/108 | 445 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 121 | 63 | 31 | 61 | 76 | 0 | 0/0 | 39 | 0 | 58 | 2/57 | 467 | 0 |
| OK | mobile-390x844 | /managers | 79 | 55 | 32 | 53 | 88 | 0 | 0/0 | 27 | 0 | 20 | 0/0 | 329 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 76 | 51 | 33 | 50 | 148 | 0 | 82/82 | 39 | 0 | 92 | 0/0 | 418 | 0 |
| OK | mobile-390x844 | /squads | 112 | 56 | 34 | 54 | 328 | 0 | 0/0 | 42 | 0 | 43 | 0/0 | 435 | 0 |
| OK | mobile-390x844 | /best-xi | 64 | 50 | 18 | 37 | 52 | 0 | 0/0 | 53 | 0 | 34 | 0/0 | 453 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 9433, 11711, 11718, 11695, 11738, 11739, 11721, 11736, 11723, 11717

## 公開範囲・セキュリティ

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | indexing: home index, follow |  |
| PASS | indexing: home canonical + OG |  |
| PASS | indexing: robots.txt disallows private |  |
| PASS | indexing: sitemap 200 |  |
| PASS | indexing: /my-team noindex (meta + header) | status 200 |
| PASS | indexing: /share/diagnosis noindex (meta + header) | status 200 |
| PASS | indexing: /auth/sign-in noindex (meta + header) | status 200 |
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
