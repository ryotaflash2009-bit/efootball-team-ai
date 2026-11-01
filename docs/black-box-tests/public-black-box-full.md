# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-11-01T07:23:00.109Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.21)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 667 | 78 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 666 | 82 | 36 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 654 | 95 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 649 | 78 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 652 | 67 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 654 | 88 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 653 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 641 | 83 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 649 | 87 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 629 | 80 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 703 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 638 | 80 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 636 | 108 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 645 | 67 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 653 | 80 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 650 | 82 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 652 | 80 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 652 | 81 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 652 | 67 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 654 | 67 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 655 | 67 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 649 | 69 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 653 | 68 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 649 | 67 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 902 | 80 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 638 | 82 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 652 | 82 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 640 | 81 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 899 | 81 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 655 | 83 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 636 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 666 | 85 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 651 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 654 | 86 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 810 | 85 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1302 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1312 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1304 | 110 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1298 | 98 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1050 | 85 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 635 | 83 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1054 | 113 | 36 cards |
| PASS | desktop-1280x720 | /players | position filter | 1043 | 97 | position set, 36 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1040 | 100 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1043 | 103 | sort set, 36 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1040 | 153 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1321 | 99 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 650 | 82 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 649 | 86 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 652 | 88 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 2821 | 170 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1044 | 84 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 1147 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1432 | 83 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 656 | 82 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1780 | 175 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2341 | 387 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 651 | 84 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 633 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 631 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 624 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 624 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 622 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 663 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1231 | 87 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1771 | 251 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1086 | 157 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1241 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 653 | 86 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 650 | 85 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1883 | 255 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 669 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2339 | 82 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 852 | 84 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 650 | 89 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 668 | 87 | 36 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 651 | 98 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 654 | 83 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 653 | 69 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 639 | 90 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 651 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 652 | 85 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 653 | 90 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 650 | 82 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 701 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 634 | 82 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 639 | 134 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 648 | 69 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 641 | 82 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 650 | 84 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 656 | 82 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 653 | 83 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 638 | 71 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 649 | 69 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 652 | 69 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 650 | 71 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 653 | 70 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 652 | 69 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 886 | 82 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 651 | 84 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 640 | 83 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 651 | 83 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 899 | 83 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 636 | 83 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 653 | 85 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 653 | 88 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 649 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 652 | 86 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 685 | 88 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1309 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1297 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1310 | 134 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1547 | 125 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1058 | 103 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 633 | 83 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1055 | 113 | 36 cards |
| PASS | desktop-1440x900 | /players | position filter | 1055 | 100 | position set, 36 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1044 | 112 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1042 | 106 | sort set, 36 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1043 | 153 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1371 | 117 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 649 | 82 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 651 | 86 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 652 | 88 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1317 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1047 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 917 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1429 | 83 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 993 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1776 | 175 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2379 | 387 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 652 | 84 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 636 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 633 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 637 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1202 | 87 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1067 | 171 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 658 | 86 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 662 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2325 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 649 | 89 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 656 | 87 | 36 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 666 | 97 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 673 | 86 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 653 | 84 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 653 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 653 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 641 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 638 | 89 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 1291 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 732 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 634 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 641 | 138 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 647 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 652 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 654 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 637 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 638 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 652 | 71 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 653 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 641 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 652 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 654 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 651 | 69 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 900 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 651 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 651 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 654 | 83 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 899 | 83 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 650 | 83 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 651 | 85 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 653 | 88 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 639 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 649 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 699 | 88 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1314 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1321 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1297 | 150 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1314 | 129 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1043 | 105 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 640 | 83 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1051 | 103 | 36 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1040 | 100 | position set, 36 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1302 | 131 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1052 | 106 | sort set, 36 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 215 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1051 | 168 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1337 | 119 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 653 | 82 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 649 | 86 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 640 | 88 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1296 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1035 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 915 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1442 | 83 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 647 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1817 | 175 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2387 | 391 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 637 | 84 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 634 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 634 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 620 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 633 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1355 | 87 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1087 | 171 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1252 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 655 | 86 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 653 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2327 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 649 | 59 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 670 | 48 | 36 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 646 | 67 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 667 | 36 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 647 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 625 | 57 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 642 | 62 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 651 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 649 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 647 | 57 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 762 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 651 | 48 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 643 | 99 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 648 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 651 | 51 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 648 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 641 | 60 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 653 | 61 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 648 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 637 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 652 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 650 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 643 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 652 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 900 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 647 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 649 | 45 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 651 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 899 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 649 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 637 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 661 | 49 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 649 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 649 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 716 | 49 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1319 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1320 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1299 | 90 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1308 | 84 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1050 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 646 | 48 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1047 | 61 | 36 cards |
| PASS | tablet-768x1024 | /players | position filter | 1068 | 73 | position set, 36 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1047 | 74 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1038 | 65 | sort set, 36 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1073 | 78 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1380 | 89 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 664 | 47 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 650 | 49 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 667 | 51 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1549 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1056 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 913 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1444 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 648 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1783 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2350 | 248 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 640 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 636 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 632 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 639 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 639 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1219 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1066 | 108 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1231 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 652 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 648 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2322 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 650 | 67 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 654 | 48 | 36 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 651 | 67 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 652 | 38 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 653 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 640 | 57 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 652 | 64 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 635 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 636 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 648 | 57 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 716 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 643 | 48 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 637 | 108 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 635 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 634 | 51 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 635 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 633 | 60 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 650 | 61 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 649 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 652 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 650 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 634 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 651 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 648 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 886 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 651 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 645 | 45 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 651 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 883 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 647 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 640 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 651 | 49 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 651 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 649 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 696 | 49 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1297 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1310 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1315 | 90 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1325 | 84 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1050 | 85 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 636 | 48 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1044 | 69 | 36 cards |
| PASS | tablet-820x1180 | /players | position filter | 1054 | 73 | position set, 36 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1047 | 80 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1039 | 65 | sort set, 36 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1038 | 109 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1348 | 90 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 638 | 47 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 656 | 49 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 653 | 51 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1281 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1040 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 913 | 61 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1419 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 648 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1785 | 99 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2356 | 269 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 654 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 635 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 641 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 641 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 622 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 639 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1212 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1088 | 116 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1242 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 639 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 663 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2319 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 647 | 48 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 667 | 40 | 36 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 662 | 52 | identity ok |
| PASS | mobile-390x844 | /managers | view | 649 | 31 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 641 | 26 | identity ok |
| PASS | mobile-390x844 | /compare | view | 648 | 57 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 648 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 648 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 639 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 636 | 57 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 685 | 44 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 648 | 48 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 634 | 78 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 642 | 25 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 652 | 51 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 652 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 652 | 54 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 637 | 61 | h1 ok |
| PASS | mobile-390x844 | /support | view | 652 | 25 | legal links present |
| PASS | mobile-390x844 | /terms | view | 647 | 25 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 635 | 25 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 653 | 27 | h1 ok |
| PASS | mobile-390x844 | /about | view | 649 | 26 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 652 | 46 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 897 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 652 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 650 | 45 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 655 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 898 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 653 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 648 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 653 | 41 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 636 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 639 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 687 | 41 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1311 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1315 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1315 | 60 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1309 | 70 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1039 | 60 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 650 | 48 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1044 | 53 | 36 cards |
| PASS | mobile-390x844 | /players | position filter | 1064 | 52 | position set, 36 cards |
| PASS | mobile-390x844 | /players | card type filter | 1057 | 50 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1035 | 49 | sort set, 36 cards |
| PASS | mobile-390x844 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1055 | 54 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1342 | 61 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 650 | 47 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 646 | 47 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 649 | 47 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1299 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1039 | 32 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 929 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1409 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 650 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1784 | 79 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2362 | 239 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 656 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 635 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 625 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 623 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 641 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1238 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1787 | 176 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1073 | 97 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1236 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 655 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 651 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1783 | 176 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2314 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 796 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 653 | 48 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 651 | 40 | 36 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 654 | 51 | identity ok |
| PASS | mobile-393x852 | /managers | view | 654 | 31 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 653 | 26 | identity ok |
| PASS | mobile-393x852 | /compare | view | 651 | 57 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 652 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 639 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 636 | 56 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 637 | 57 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 698 | 44 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 638 | 48 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 652 | 78 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 639 | 25 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 648 | 51 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 647 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 639 | 54 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 638 | 61 | h1 ok |
| PASS | mobile-393x852 | /support | view | 652 | 25 | legal links present |
| PASS | mobile-393x852 | /terms | view | 652 | 25 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 648 | 25 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 652 | 27 | h1 ok |
| PASS | mobile-393x852 | /about | view | 652 | 26 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 649 | 46 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 883 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 650 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 631 | 45 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 633 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 900 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 649 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 650 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 647 | 41 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 649 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 650 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 792 | 41 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1320 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1307 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1315 | 60 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1308 | 70 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1040 | 60 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 651 | 48 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1056 | 49 | 36 cards |
| PASS | mobile-393x852 | /players | position filter | 1047 | 52 | position set, 36 cards |
| PASS | mobile-393x852 | /players | card type filter | 1062 | 48 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1051 | 49 | sort set, 36 cards |
| PASS | mobile-393x852 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1047 | 80 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1341 | 61 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 654 | 47 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 654 | 47 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 651 | 47 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1283 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1029 | 32 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 902 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1424 | 45 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 648 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1781 | 99 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2346 | 256 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 652 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 621 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 632 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 633 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 632 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1223 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1074 | 97 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1243 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 654 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2315 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 653 | 54 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 663 | 40 | 36 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 652 | 51 | identity ok |
| PASS | mobile-430x932 | /managers | view | 653 | 31 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 652 | 26 | identity ok |
| PASS | mobile-430x932 | /compare | view | 651 | 57 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 654 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 650 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 650 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 652 | 57 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 702 | 46 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 648 | 48 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 652 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 650 | 25 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 651 | 51 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 651 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 651 | 60 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 651 | 61 | h1 ok |
| PASS | mobile-430x932 | /support | view | 636 | 25 | legal links present |
| PASS | mobile-430x932 | /terms | view | 637 | 25 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 637 | 25 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 652 | 27 | h1 ok |
| PASS | mobile-430x932 | /about | view | 650 | 26 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 650 | 46 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 888 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 627 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 651 | 45 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 654 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 900 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 652 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 638 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 654 | 41 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 650 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 645 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 683 | 41 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1304 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1299 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1303 | 60 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1322 | 70 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1046 | 68 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 651 | 48 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1047 | 53 | 36 cards |
| PASS | mobile-430x932 | /players | position filter | 1066 | 48 | position set, 36 cards |
| PASS | mobile-430x932 | /players | card type filter | 1047 | 50 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1048 | 49 | sort set, 36 cards |
| PASS | mobile-430x932 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1053 | 54 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1344 | 62 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 649 | 47 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 647 | 47 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 653 | 47 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1299 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1036 | 32 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 914 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1305 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 652 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1749 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2331 | 239 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 655 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 651 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 636 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 624 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 635 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1212 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1088 | 103 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1226 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 649 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 661 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2329 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 176 | 26 | 6 | 17 | 48 | 0 | 0/0 | 76 | 2 | 159 | 4/159 | 294 | 0 |
| OK | desktop-1280x720 | /players | 94 | 37 | 11 | 34 | 56 | 0 | 0/0 | 82 | 0 | 71 | 4/71 | 433 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 153 | 38 | 11 | 35 | 52 | 0 | 0/0 | 95 | 0 | 386 | 4/386 | 434 | 0 |
| OK | desktop-1280x720 | /managers | 58 | 30 | 9 | 28 | 48 | 0 | 0/0 | 78 | 0 | 27 | 0/0 | 417 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 66 | 36 | 10 | 34 | 56 | 0 | 0/0 | 80 | 0 | 69 | 0/0 | 436 | 0 |
| OK | desktop-1280x720 | /squads | 59 | 30 | 7 | 28 | 320 | 0 | 0/0 | 92 | 3 | 28 | 0/0 | 307 | 0 |
| OK | desktop-1280x720 | /best-xi | 58 | 25 | 4 | 13 | 36 | 0 | 0/0 | 80 | 0 | 32 | 0/0 | 293 | 0 |
| OK | mobile-390x844 | / | 276 | 21 | 4 | 14 | 36 | 0 | 0/0 | 49 | 0 | 266 | 4/266 | 295 | 0 |
| OK | mobile-390x844 | /players | 124 | 40 | 11 | 38 | 56 | 0 | 0/0 | 39 | 2 | 98 | 4/98 | 431 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 80 | 35 | 12 | 34 | 44 | 0 | 0/0 | 50 | 1 | 381 | 4/381 | 430 | 0 |
| OK | mobile-390x844 | /managers | 42 | 25 | 8 | 24 | 40 | 0 | 0/0 | 31 | 1 | 21 | 0/0 | 417 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 70 | 36 | 10 | 35 | 56 | 0 | 0/0 | 47 | 1 | 62 | 0/0 | 431 | 0 |
| OK | mobile-390x844 | /squads | 54 | 31 | 8 | 29 | 320 | 0 | 0/0 | 49 | 1 | 27 | 0/0 | 296 | 0 |
| OK | mobile-390x844 | /best-xi | 60 | 26 | 5 | 13 | 36 | 0 | 0/0 | 57 | 0 | 35 | 0/0 | 293 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10602, 12870, 12874, 12875, 12873, 12875, 12873, 12894, 12873, 12877

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
