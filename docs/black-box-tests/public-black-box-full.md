# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-11-03T19:27:54.589Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,009 / Managers 66

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.2)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 657 | 78 | World 13,009 |
| PASS | desktop-1280x720 | /players | view | 653 | 82 | 36 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 668 | 94 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 654 | 78 | managers 66 |
| PASS | desktop-1280x720 | /managers/65 | view | 639 | 67 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 638 | 88 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 654 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 653 | 83 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 638 | 88 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 653 | 80 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 719 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 650 | 80 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 653 | 104 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 654 | 67 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 640 | 80 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 658 | 82 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 651 | 80 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 656 | 82 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 650 | 67 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 650 | 67 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 639 | 67 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 653 | 69 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 650 | 68 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 657 | 67 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 891 | 80 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 635 | 82 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 640 | 82 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 652 | 81 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 902 | 81 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 654 | 83 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 641 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 668 | 85 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 657 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 653 | 86 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 809 | 85 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1305 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1309 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1294 | 110 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1306 | 98 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1059 | 85 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 651 | 83 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1043 | 113 | 36 cards |
| PASS | desktop-1280x720 | /players | position filter | 1059 | 97 | position set, 36 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1041 | 100 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1046 | 103 | sort set, 36 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1048 | 153 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1369 | 98 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 642 | 82 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 894 | 86 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 656 | 88 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1305 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1039 | 84 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 1143 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1420 | 83 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 653 | 82 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1774 | 175 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2607 | 393 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 653 | 84 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 638 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 632 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 626 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 625 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 638 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1246 | 87 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1786 | 255 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1079 | 157 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1217 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 636 | 86 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 651 | 85 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1905 | 256 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 649 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2322 | 82 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 842 | 84 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 654 | 89 | World 13,009 |
| PASS | desktop-1440x900 | /players | view | 654 | 87 | 36 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 652 | 98 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 655 | 83 | managers 66 |
| PASS | desktop-1440x900 | /managers/65 | view | 651 | 69 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 653 | 90 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 654 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 654 | 85 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 638 | 91 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 652 | 82 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 705 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 638 | 82 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 643 | 130 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 638 | 69 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 641 | 82 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 654 | 84 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 640 | 82 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 654 | 84 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 655 | 71 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 637 | 69 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 651 | 69 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 641 | 71 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 642 | 70 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 647 | 69 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 900 | 82 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 639 | 84 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 638 | 84 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 654 | 83 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 892 | 83 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 650 | 83 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 625 | 85 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 655 | 88 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 637 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 638 | 86 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 700 | 88 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1304 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1310 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1291 | 134 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1305 | 125 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1057 | 103 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 652 | 83 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1029 | 101 | 36 cards |
| PASS | desktop-1440x900 | /players | position filter | 1040 | 100 | position set, 36 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1046 | 112 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1041 | 106 | sort set, 36 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1045 | 153 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1326 | 116 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 653 | 82 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 627 | 86 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 650 | 88 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1276 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1042 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 918 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1417 | 83 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 654 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1789 | 175 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2601 | 393 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 654 | 84 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 612 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 626 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 625 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 618 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 626 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 640 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 640 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1215 | 87 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1082 | 171 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1230 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 653 | 86 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 654 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2308 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 640 | 89 | World 13,009 |
| PASS | desktop-1920x1080 | /players | view | 638 | 87 | 36 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 625 | 98 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 657 | 86 | managers 66 |
| PASS | desktop-1920x1080 | /managers/65 | view | 638 | 84 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 628 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 650 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 651 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 642 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 636 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 706 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 637 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 640 | 136 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 640 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 638 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 633 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 624 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 654 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 653 | 71 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 655 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 640 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 641 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 638 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 638 | 69 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 890 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 640 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 652 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 656 | 83 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 903 | 83 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 653 | 83 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 637 | 85 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 656 | 88 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 635 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 655 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 690 | 88 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1306 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1290 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1310 | 150 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1302 | 129 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1293 | 117 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 636 | 83 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1040 | 117 | 36 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1044 | 100 | position set, 36 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1045 | 116 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1043 | 106 | sort set, 36 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1044 | 181 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1327 | 118 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 652 | 82 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 658 | 86 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 653 | 88 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1299 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1049 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 900 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1414 | 83 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 653 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1776 | 175 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2588 | 397 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 649 | 84 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 640 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 624 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 625 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 622 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 622 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 638 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 623 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1227 | 87 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1061 | 171 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1213 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 639 | 86 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 687 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2321 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 635 | 59 | World 13,009 |
| PASS | tablet-768x1024 | /players | view | 651 | 48 | 36 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 640 | 67 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 654 | 36 | managers 66 |
| PASS | tablet-768x1024 | /managers/65 | view | 640 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 637 | 57 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 653 | 61 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 651 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 654 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 638 | 57 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 703 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 650 | 48 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 655 | 100 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 653 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 651 | 51 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 653 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 648 | 60 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 635 | 62 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 649 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 635 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 641 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 654 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 641 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 639 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 887 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 638 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 657 | 46 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 641 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 899 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 639 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 640 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 653 | 49 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 637 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 637 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 793 | 49 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1314 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1304 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1316 | 90 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1317 | 84 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1044 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 637 | 48 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1028 | 61 | 36 cards |
| PASS | tablet-768x1024 | /players | position filter | 1060 | 76 | position set, 36 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1044 | 68 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1042 | 65 | sort set, 36 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 204 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1056 | 110 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1319 | 88 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 655 | 47 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 647 | 49 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 654 | 51 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1301 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1019 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 899 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1291 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 650 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1778 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2605 | 267 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 656 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 625 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 622 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 626 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 625 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 624 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 624 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1260 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1075 | 108 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1204 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 629 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 640 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2306 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 655 | 67 | World 13,009 |
| PASS | tablet-820x1180 | /players | view | 654 | 48 | 36 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 655 | 67 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 651 | 38 | managers 66 |
| PASS | tablet-820x1180 | /managers/65 | view | 642 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 639 | 57 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 652 | 63 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 649 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 653 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 639 | 57 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 684 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 635 | 48 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 641 | 105 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 648 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 639 | 51 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 651 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 642 | 60 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 649 | 62 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 639 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 640 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 638 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 636 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 650 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 651 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 888 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 655 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 641 | 46 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 641 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 884 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 639 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 654 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 657 | 49 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 638 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 651 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 685 | 49 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1311 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1304 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1311 | 90 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1305 | 84 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1056 | 85 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 637 | 48 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1043 | 69 | 36 cards |
| PASS | tablet-820x1180 | /players | position filter | 1042 | 66 | position set, 36 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1056 | 79 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1050 | 65 | sort set, 36 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 210 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1043 | 109 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1308 | 89 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 653 | 47 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 654 | 49 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 652 | 51 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1276 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1026 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 916 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1434 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 639 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1753 | 101 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2601 | 271 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 639 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 620 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 625 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 635 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 639 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1214 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1074 | 116 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1226 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 638 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 653 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2317 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 647 | 48 | World 13,009 |
| PASS | mobile-390x844 | /players | view | 654 | 40 | 36 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 637 | 52 | identity ok |
| PASS | mobile-390x844 | /managers | view | 641 | 32 | managers 66 |
| PASS | mobile-390x844 | /managers/65 | view | 651 | 27 | identity ok |
| PASS | mobile-390x844 | /compare | view | 641 | 57 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 653 | 50 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 640 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 641 | 56 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 635 | 58 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 685 | 45 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 636 | 49 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 639 | 76 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 639 | 26 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 639 | 51 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 638 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 638 | 55 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 654 | 62 | h1 ok |
| PASS | mobile-390x844 | /support | view | 637 | 26 | legal links present |
| PASS | mobile-390x844 | /terms | view | 639 | 26 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 652 | 26 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 638 | 28 | h1 ok |
| PASS | mobile-390x844 | /about | view | 648 | 27 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 652 | 47 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 905 | 45 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 635 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 642 | 47 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 637 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 897 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 653 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 654 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 655 | 41 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 638 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 638 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 782 | 41 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1310 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1301 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1300 | 60 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1272 | 70 | 0 results |
| PASS | mobile-390x844 | header search | search button opens /players | 1433 | 70 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 639 | 48 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1044 | 53 | 36 cards |
| PASS | mobile-390x844 | /players | position filter | 1053 | 52 | position set, 36 cards |
| PASS | mobile-390x844 | /players | card type filter | 1051 | 50 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1033 | 49 | sort set, 36 cards |
| PASS | mobile-390x844 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1027 | 76 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1327 | 60 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 656 | 47 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 624 | 47 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 626 | 47 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1290 | 54 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1030 | 33 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 902 | 53 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1413 | 46 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 652 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1784 | 101 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2596 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 640 | 49 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 633 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 622 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 621 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 622 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 608 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 623 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 635 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1220 | 50 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1789 | 182 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1072 | 98 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1234 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 653 | 52 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 627 | 51 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1771 | 179 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 639 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2315 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 781 | 52 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 647 | 48 | World 13,009 |
| PASS | mobile-393x852 | /players | view | 653 | 40 | 36 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 639 | 51 | identity ok |
| PASS | mobile-393x852 | /managers | view | 640 | 32 | managers 66 |
| PASS | mobile-393x852 | /managers/65 | view | 654 | 27 | identity ok |
| PASS | mobile-393x852 | /compare | view | 636 | 57 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 655 | 50 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 641 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 636 | 57 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 641 | 58 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 703 | 45 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 638 | 49 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 639 | 76 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 650 | 26 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 652 | 51 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 638 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 635 | 55 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 655 | 62 | h1 ok |
| PASS | mobile-393x852 | /support | view | 638 | 26 | legal links present |
| PASS | mobile-393x852 | /terms | view | 641 | 26 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 650 | 26 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 629 | 28 | h1 ok |
| PASS | mobile-393x852 | /about | view | 640 | 27 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 651 | 47 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 888 | 45 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 652 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 639 | 47 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 654 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 891 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 640 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 653 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 656 | 41 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 636 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 639 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 781 | 41 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1293 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1322 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1287 | 60 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1293 | 70 | 0 results |
| PASS | mobile-393x852 | header search | search button opens /players | 1426 | 70 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 633 | 48 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1044 | 53 | 36 cards |
| PASS | mobile-393x852 | /players | position filter | 1049 | 48 | position set, 36 cards |
| PASS | mobile-393x852 | /players | card type filter | 1068 | 50 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1048 | 49 | sort set, 36 cards |
| PASS | mobile-393x852 | /players | nationality filter | 212 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1029 | 76 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1337 | 60 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 655 | 47 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 655 | 47 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 650 | 47 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1286 | 54 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1036 | 33 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 911 | 53 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1422 | 46 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 654 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1761 | 101 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2586 | 262 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 653 | 49 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 639 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 622 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 627 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 625 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 622 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 640 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 637 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1216 | 50 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1065 | 98 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1206 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 642 | 52 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 642 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2328 | 50 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 650 | 54 | World 13,009 |
| PASS | mobile-430x932 | /players | view | 657 | 40 | 36 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 654 | 51 | identity ok |
| PASS | mobile-430x932 | /managers | view | 644 | 32 | managers 66 |
| PASS | mobile-430x932 | /managers/65 | view | 652 | 27 | identity ok |
| PASS | mobile-430x932 | /compare | view | 653 | 57 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 637 | 50 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 638 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 655 | 56 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 638 | 58 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 685 | 47 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 634 | 49 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 639 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 636 | 26 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 637 | 51 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 638 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 655 | 60 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 639 | 62 | h1 ok |
| PASS | mobile-430x932 | /support | view | 653 | 26 | legal links present |
| PASS | mobile-430x932 | /terms | view | 649 | 26 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 654 | 26 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 638 | 28 | h1 ok |
| PASS | mobile-430x932 | /about | view | 653 | 27 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 639 | 47 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 883 | 45 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 639 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 655 | 47 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 641 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 912 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 637 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 635 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 656 | 41 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 651 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 639 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 795 | 41 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1310 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1306 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1312 | 60 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1316 | 70 | 0 results |
| PASS | mobile-430x932 | header search | search button opens /players | 1419 | 76 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 643 | 48 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1041 | 53 | 36 cards |
| PASS | mobile-430x932 | /players | position filter | 1051 | 43 | position set, 36 cards |
| PASS | mobile-430x932 | /players | card type filter | 1053 | 50 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1049 | 49 | sort set, 36 cards |
| PASS | mobile-430x932 | /players | nationality filter | 209 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1055 | 76 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1325 | 61 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 653 | 47 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 639 | 47 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 897 | 47 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1314 | 54 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1047 | 33 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 917 | 53 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1418 | 46 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 654 | 49 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1780 | 101 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2556 | 245 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 652 | 49 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 637 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 626 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 622 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 623 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1222 | 50 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1089 | 104 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1242 | 103 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 648 | 52 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 648 | 52 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2333 | 50 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 124 | 22 | 4 | 15 | 44 | 0 | 0/0 | 76 | 2 | 109 | 4/109 | 418 | 0 |
| OK | desktop-1280x720 | /players | 65 | 39 | 11 | 36 | 56 | 0 | 0/0 | 82 | 0 | 33 | 4/20 | 433 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 63 | 33 | 10 | 31 | 48 | 0 | 0/0 | 94 | 0 | 43 | 4/41 | 433 | 0 |
| OK | desktop-1280x720 | /managers | 39 | 27 | 8 | 25 | 44 | 0 | 0/0 | 78 | 0 | 22 | 0/0 | 420 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 51 | 36 | 10 | 34 | 56 | 0 | 0/0 | 80 | 0 | 27 | 0/0 | 434 | 0 |
| OK | desktop-1280x720 | /squads | 46 | 29 | 6 | 27 | 324 | 0 | 0/0 | 92 | 3 | 24 | 0/0 | 295 | 0 |
| OK | desktop-1280x720 | /best-xi | 51 | 25 | 4 | 12 | 36 | 0 | 0/0 | 80 | 0 | 30 | 0/0 | 418 | 0 |
| OK | mobile-390x844 | / | 55 | 21 | 4 | 13 | 32 | 0 | 0/0 | 49 | 0 | 24 | 4/11 | 296 | 0 |
| OK | mobile-390x844 | /players | 61 | 37 | 11 | 35 | 52 | 0 | 0/0 | 39 | 2 | 30 | 4/13 | 436 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 66 | 32 | 10 | 31 | 44 | 0 | 0/0 | 49 | 1 | 43 | 4/41 | 419 | 0 |
| OK | mobile-390x844 | /managers | 39 | 25 | 8 | 24 | 40 | 0 | 0/0 | 32 | 1 | 20 | 0/0 | 296 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 71 | 36 | 9 | 34 | 56 | 0 | 0/0 | 47 | 1 | 30 | 0/0 | 436 | 0 |
| OK | mobile-390x844 | /squads | 50 | 25 | 6 | 24 | 320 | 0 | 0/0 | 50 | 1 | 25 | 0/0 | 292 | 0 |
| OK | mobile-390x844 | /best-xi | 46 | 23 | 4 | 11 | 32 | 0 | 0/0 | 58 | 0 | 26 | 0/0 | 295 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10708, 12824, 12825, 12826, 12825, 12825, 12825, 12826, 12824, 12831

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
