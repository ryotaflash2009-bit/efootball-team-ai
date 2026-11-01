# 総合ブラックボックス(公開範囲・全viewport・操作・性能)

実行日時: 2026-11-01T12:58:27.662Z  対象: http://localhost:3000
viewport: desktop-1280x720, desktop-1440x900, desktop-1920x1080, tablet-768x1024, tablet-820x1180, mobile-390x844, mobile-393x852, mobile-430x932  期待件数: World 13,517 / Managers 71

**画面・操作: 608/608 PASS** (console error 0, warning 0, network error 0, 5xx 0, 想定外4xx 0, overflow 0)
**性能: 14/14 OK**  **メモリ: OK (growth 1.21)**  **公開範囲・セキュリティ: 18/18 PASS**

## 失敗

なし

## 画面・操作

| 結果 | viewport | route | 操作 | ms | requests | 詳細 |
|---|---|---|---|---|---|---|
| PASS | desktop-1280x720 | / | view | 643 | 78 | World 13,517 |
| PASS | desktop-1280x720 | /players | view | 651 | 82 | 36 cards |
| PASS | desktop-1280x720 | /players/world/<id> | view | 639 | 95 | identity ok |
| PASS | desktop-1280x720 | /managers | view | 653 | 78 | managers 71 |
| PASS | desktop-1280x720 | /managers/65 | view | 652 | 67 | identity ok |
| PASS | desktop-1280x720 | /compare | view | 639 | 88 | h1 ok |
| PASS | desktop-1280x720 | /squads | view | 639 | 89 | h1 ok |
| PASS | desktop-1280x720 | /squads/templates | view | 637 | 83 | h1 ok |
| PASS | desktop-1280x720 | /squads/compare | view | 642 | 87 | h1 ok |
| PASS | desktop-1280x720 | /best-xi | view | 639 | 80 | h1 ok |
| PASS | desktop-1280x720 | /players/new | view | 706 | 80 | h1 ok |
| PASS | desktop-1280x720 | /pack-check | view | 635 | 80 | h1 ok |
| PASS | desktop-1280x720 | /tier/CF | view | 640 | 104 | h1 ok |
| PASS | desktop-1280x720 | /glossary | view | 636 | 67 | h1 ok |
| PASS | desktop-1280x720 | /favorites | view | 639 | 80 | h1 ok |
| PASS | desktop-1280x720 | /my-team | view | 646 | 82 | h1 ok |
| PASS | desktop-1280x720 | /my-builds | view | 631 | 80 | h1 ok |
| PASS | desktop-1280x720 | /build-inventory | view | 655 | 82 | h1 ok |
| PASS | desktop-1280x720 | /support | view | 652 | 67 | legal links present |
| PASS | desktop-1280x720 | /terms | view | 637 | 67 | h1 ok |
| PASS | desktop-1280x720 | /privacy | view | 653 | 67 | h1 ok |
| PASS | desktop-1280x720 | /disclaimer | view | 637 | 69 | h1 ok |
| PASS | desktop-1280x720 | /about | view | 637 | 68 | h1 ok |
| PASS | desktop-1280x720 | /data-management | view | 652 | 67 | local data management only |
| PASS | desktop-1280x720 | /auth/sign-in | view | 889 | 80 | h1 ok |
| PASS | desktop-1280x720 | /auth/sign-up | view | 640 | 82 | h1 ok |
| PASS | desktop-1280x720 | /auth/forgot-password | view | 652 | 81 | h1 ok |
| PASS | desktop-1280x720 | /this-page-does-not-exist | view | 654 | 81 | not-found view |
| PASS | desktop-1280x720 | /players/world/<id> | view | 903 | 81 | not-found view |
| PASS | desktop-1280x720 | /account/rls-test | view | 655 | 83 | not-found view |
| PASS | desktop-1280x720 | /release-readiness | view | 654 | 85 | not-found view |
| PASS | desktop-1280x720 | /players/ | trailing slash | 669 | 85 | → /players |
| PASS | desktop-1280x720 | /account/rls-test/ | trailing slash | 638 | 84 | not-found view |
| PASS | desktop-1280x720 | /release-readiness/ | trailing slash | 637 | 86 | not-found view |
| PASS | desktop-1280x720 | /players | language ja→en→ja | 794 | 85 | switched and restored |
| PASS | desktop-1280x720 | /players | search ja | 1308 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search en | 1305 | 100 | 25 results |
| PASS | desktop-1280x720 | /players | search unicode | 1303 | 110 | 18 results |
| PASS | desktop-1280x720 | /players | search symbols | 1306 | 98 | 0 results |
| PASS | desktop-1280x720 | header search | submit with Enter | 1039 | 85 | 25 results |
| PASS | desktop-1280x720 | /players | search control-character rejected safely | 652 | 83 | rejection view |
| PASS | desktop-1280x720 | /players | search clear | 1031 | 113 | 36 cards |
| PASS | desktop-1280x720 | /players | position filter | 1045 | 97 | position set, 36 cards |
| PASS | desktop-1280x720 | /players | card type filter | 1041 | 100 | cardType set, 24 cards |
| PASS | desktop-1280x720 | /players | sort | 1034 | 103 | sort set, 36 cards |
| PASS | desktop-1280x720 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1280x720 | /players | pagination | 1275 | 153 | page 2 differs |
| PASS | desktop-1280x720 | /players → detail → back | navigate and back | 1343 | 99 | detail and back ok |
| PASS | desktop-1280x720 | /compare | compare 2 players | 652 | 82 | 2 identities shown |
| PASS | desktop-1280x720 | /compare | compare 3 players | 652 | 86 | 3 identities shown |
| PASS | desktop-1280x720 | /compare | compare 4 players | 647 | 88 | 4 identities shown |
| PASS | desktop-1280x720 | /managers | manager search | 1288 | 96 | 2 results |
| PASS | desktop-1280x720 | /managers | manager filter | 1042 | 84 | booster=1, 25 results |
| PASS | desktop-1280x720 | /managers → detail | open manager | 1151 | 97 | manager detail |
| PASS | desktop-1280x720 | /support → /terms → /privacy | legal navigation | 1441 | 83 | support → terms → privacy |
| PASS | desktop-1280x720 | /share/diagnosis | share view (ja) | 655 | 82 | ok state, 8 categories, noindex |
| PASS | desktop-1280x720 | /share/diagnosis | share view (en) and back to ja | 1771 | 175 | English labels, restored to Japanese |
| PASS | desktop-1280x720 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2362 | 387 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1280x720 | /share/diagnosis | share: older rules noted | 651 | 84 | older-rules note |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: checksum mismatch | 638 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: unknown version | 636 | 0 | safe error (unsupported_version) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: script string | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: URL string | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: control/NUL | 626 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: user field | 635 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: missing field | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: malformed encoding | 636 | 0 | safe error (bad_format) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: over limit | 640 | 0 | safe error (too_long) |
| PASS | desktop-1280x720 | /share/diagnosis | share rejected: empty | 639 | 0 | safe error (empty) |
| PASS | desktop-1280x720 | /share/diagnosis | share: hashchange, back/forward, reload | 1211 | 87 | state follows the URL |
| PASS | desktop-1280x720 | /squads/<fixture> | share link: preview, copy, open | 1800 | 253 | copy: manual fallback; Web Share: available |
| PASS | desktop-1280x720 | /diagnosis-history | history: empty state | 1089 | 157 | empty state |
| PASS | desktop-1280x720 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1240 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1280x720 | /diagnosis-history | history: maximum 50 entries | 641 | 86 | 50 entries rendered |
| PASS | desktop-1280x720 | /diagnosis-history | history: storage unavailable degrades safely | 638 | 85 | unavailable message, no success |
| PASS | desktop-1280x720 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1891 | 254 | saved once, duplicate skipped, listed, share link opens |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 665 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1280x720 | /share/compare | comparison share link opens; bad links rejected | 2334 | 82 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1280x720 | /diagnosis-history | before/after: save image | 873 | 84 | PNG generated and handed to the browser |
| PASS | desktop-1440x900 | / | view | 652 | 89 | World 13,517 |
| PASS | desktop-1440x900 | /players | view | 654 | 87 | 36 cards |
| PASS | desktop-1440x900 | /players/world/<id> | view | 650 | 98 | identity ok |
| PASS | desktop-1440x900 | /managers | view | 649 | 83 | managers 71 |
| PASS | desktop-1440x900 | /managers/65 | view | 653 | 69 | identity ok |
| PASS | desktop-1440x900 | /compare | view | 625 | 90 | h1 ok |
| PASS | desktop-1440x900 | /squads | view | 653 | 91 | h1 ok |
| PASS | desktop-1440x900 | /squads/templates | view | 639 | 85 | h1 ok |
| PASS | desktop-1440x900 | /squads/compare | view | 641 | 90 | h1 ok |
| PASS | desktop-1440x900 | /best-xi | view | 650 | 82 | h1 ok |
| PASS | desktop-1440x900 | /players/new | view | 706 | 81 | h1 ok |
| PASS | desktop-1440x900 | /pack-check | view | 649 | 82 | h1 ok |
| PASS | desktop-1440x900 | /tier/CF | view | 639 | 130 | h1 ok |
| PASS | desktop-1440x900 | /glossary | view | 653 | 69 | h1 ok |
| PASS | desktop-1440x900 | /favorites | view | 640 | 82 | h1 ok |
| PASS | desktop-1440x900 | /my-team | view | 637 | 84 | h1 ok |
| PASS | desktop-1440x900 | /my-builds | view | 626 | 82 | h1 ok |
| PASS | desktop-1440x900 | /build-inventory | view | 635 | 84 | h1 ok |
| PASS | desktop-1440x900 | /support | view | 640 | 71 | legal links present |
| PASS | desktop-1440x900 | /terms | view | 640 | 69 | h1 ok |
| PASS | desktop-1440x900 | /privacy | view | 639 | 69 | h1 ok |
| PASS | desktop-1440x900 | /disclaimer | view | 639 | 71 | h1 ok |
| PASS | desktop-1440x900 | /about | view | 637 | 70 | h1 ok |
| PASS | desktop-1440x900 | /data-management | view | 651 | 69 | local data management only |
| PASS | desktop-1440x900 | /auth/sign-in | view | 904 | 82 | h1 ok |
| PASS | desktop-1440x900 | /auth/sign-up | view | 648 | 84 | h1 ok |
| PASS | desktop-1440x900 | /auth/forgot-password | view | 653 | 83 | h1 ok |
| PASS | desktop-1440x900 | /this-page-does-not-exist | view | 639 | 83 | not-found view |
| PASS | desktop-1440x900 | /players/world/<id> | view | 899 | 83 | not-found view |
| PASS | desktop-1440x900 | /account/rls-test | view | 640 | 83 | not-found view |
| PASS | desktop-1440x900 | /release-readiness | view | 652 | 85 | not-found view |
| PASS | desktop-1440x900 | /players/ | trailing slash | 669 | 88 | → /players |
| PASS | desktop-1440x900 | /account/rls-test/ | trailing slash | 650 | 84 | not-found view |
| PASS | desktop-1440x900 | /release-readiness/ | trailing slash | 653 | 86 | not-found view |
| PASS | desktop-1440x900 | /players | language ja→en→ja | 687 | 88 | switched and restored |
| PASS | desktop-1440x900 | /players | search ja | 1305 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search en | 1309 | 119 | 25 results |
| PASS | desktop-1440x900 | /players | search unicode | 1303 | 134 | 18 results |
| PASS | desktop-1440x900 | /players | search symbols | 1298 | 125 | 0 results |
| PASS | desktop-1440x900 | header search | submit with Enter | 1060 | 103 | 25 results |
| PASS | desktop-1440x900 | /players | search control-character rejected safely | 635 | 83 | rejection view |
| PASS | desktop-1440x900 | /players | search clear | 1054 | 113 | 36 cards |
| PASS | desktop-1440x900 | /players | position filter | 1041 | 100 | position set, 36 cards |
| PASS | desktop-1440x900 | /players | card type filter | 1045 | 112 | cardType set, 24 cards |
| PASS | desktop-1440x900 | /players | sort | 1045 | 106 | sort set, 36 cards |
| PASS | desktop-1440x900 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1440x900 | /players | pagination | 1041 | 153 | page 2 differs |
| PASS | desktop-1440x900 | /players → detail → back | navigate and back | 1354 | 117 | detail and back ok |
| PASS | desktop-1440x900 | /compare | compare 2 players | 656 | 82 | 2 identities shown |
| PASS | desktop-1440x900 | /compare | compare 3 players | 649 | 86 | 3 identities shown |
| PASS | desktop-1440x900 | /compare | compare 4 players | 652 | 88 | 4 identities shown |
| PASS | desktop-1440x900 | /managers | manager search | 1302 | 99 | 2 results |
| PASS | desktop-1440x900 | /managers | manager filter | 1044 | 87 | booster=1, 25 results |
| PASS | desktop-1440x900 | /managers → detail | open manager | 900 | 100 | manager detail |
| PASS | desktop-1440x900 | /support → /terms → /privacy | legal navigation | 1414 | 83 | support → terms → privacy |
| PASS | desktop-1440x900 | /share/diagnosis | share view (ja) | 651 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1440x900 | /share/diagnosis | share view (en) and back to ja | 1775 | 175 | English labels, restored to Japanese |
| PASS | desktop-1440x900 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2348 | 387 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1440x900 | /share/diagnosis | share: older rules noted | 650 | 84 | older-rules note |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: checksum mismatch | 634 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: script string | 640 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: URL string | 637 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | desktop-1440x900 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | desktop-1440x900 | /share/diagnosis | share: hashchange, back/forward, reload | 1228 | 87 | state follows the URL |
| PASS | desktop-1440x900 | /diagnosis-history | history: empty state | 1087 | 171 | empty state |
| PASS | desktop-1440x900 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1235 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1440x900 | /diagnosis-history | history: maximum 50 entries | 643 | 86 | 50 entries rendered |
| PASS | desktop-1440x900 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 654 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1440x900 | /share/compare | comparison share link opens; bad links rejected | 2334 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | desktop-1920x1080 | / | view | 649 | 89 | World 13,517 |
| PASS | desktop-1920x1080 | /players | view | 657 | 87 | 36 cards |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 652 | 97 | identity ok |
| PASS | desktop-1920x1080 | /managers | view | 652 | 86 | managers 71 |
| PASS | desktop-1920x1080 | /managers/65 | view | 652 | 84 | identity ok |
| PASS | desktop-1920x1080 | /compare | view | 639 | 90 | h1 ok |
| PASS | desktop-1920x1080 | /squads | view | 655 | 93 | h1 ok |
| PASS | desktop-1920x1080 | /squads/templates | view | 651 | 85 | h1 ok |
| PASS | desktop-1920x1080 | /squads/compare | view | 634 | 89 | h1 ok |
| PASS | desktop-1920x1080 | /best-xi | view | 636 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /players/new | view | 701 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /pack-check | view | 652 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /tier/CF | view | 641 | 136 | h1 ok |
| PASS | desktop-1920x1080 | /glossary | view | 648 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /favorites | view | 650 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /my-team | view | 651 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /my-builds | view | 654 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /build-inventory | view | 637 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /support | view | 652 | 71 | legal links present |
| PASS | desktop-1920x1080 | /terms | view | 641 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /privacy | view | 636 | 69 | h1 ok |
| PASS | desktop-1920x1080 | /disclaimer | view | 651 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /about | view | 655 | 70 | h1 ok |
| PASS | desktop-1920x1080 | /data-management | view | 654 | 69 | local data management only |
| PASS | desktop-1920x1080 | /auth/sign-in | view | 887 | 82 | h1 ok |
| PASS | desktop-1920x1080 | /auth/sign-up | view | 650 | 84 | h1 ok |
| PASS | desktop-1920x1080 | /auth/forgot-password | view | 645 | 83 | h1 ok |
| PASS | desktop-1920x1080 | /this-page-does-not-exist | view | 645 | 83 | not-found view |
| PASS | desktop-1920x1080 | /players/world/<id> | view | 888 | 83 | not-found view |
| PASS | desktop-1920x1080 | /account/rls-test | view | 653 | 83 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness | view | 650 | 85 | not-found view |
| PASS | desktop-1920x1080 | /players/ | trailing slash | 652 | 88 | → /players |
| PASS | desktop-1920x1080 | /account/rls-test/ | trailing slash | 653 | 84 | not-found view |
| PASS | desktop-1920x1080 | /release-readiness/ | trailing slash | 640 | 86 | not-found view |
| PASS | desktop-1920x1080 | /players | language ja→en→ja | 812 | 88 | switched and restored |
| PASS | desktop-1920x1080 | /players | search ja | 1307 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search en | 1300 | 125 | 25 results |
| PASS | desktop-1920x1080 | /players | search unicode | 1306 | 142 | 18 results |
| PASS | desktop-1920x1080 | /players | search symbols | 1384 | 129 | 0 results |
| PASS | desktop-1920x1080 | header search | submit with Enter | 1046 | 105 | 25 results |
| PASS | desktop-1920x1080 | /players | search control-character rejected safely | 648 | 83 | rejection view |
| PASS | desktop-1920x1080 | /players | search clear | 1043 | 117 | 36 cards |
| PASS | desktop-1920x1080 | /players | position filter | 1039 | 100 | position set, 36 cards |
| PASS | desktop-1920x1080 | /players | card type filter | 1042 | 116 | cardType set, 24 cards |
| PASS | desktop-1920x1080 | /players | sort | 1041 | 106 | sort set, 36 cards |
| PASS | desktop-1920x1080 | /players | nationality filter | 202 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | desktop-1920x1080 | /players | pagination | 1030 | 162 | page 2 differs |
| PASS | desktop-1920x1080 | /players → detail → back | navigate and back | 1338 | 119 | detail and back ok |
| PASS | desktop-1920x1080 | /compare | compare 2 players | 653 | 82 | 2 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 3 players | 651 | 86 | 3 identities shown |
| PASS | desktop-1920x1080 | /compare | compare 4 players | 651 | 88 | 4 identities shown |
| PASS | desktop-1920x1080 | /managers | manager search | 1545 | 102 | 2 results |
| PASS | desktop-1920x1080 | /managers | manager filter | 1041 | 90 | booster=1, 25 results |
| PASS | desktop-1920x1080 | /managers → detail | open manager | 1148 | 103 | manager detail |
| PASS | desktop-1920x1080 | /support → /terms → /privacy | legal navigation | 1421 | 83 | support → terms → privacy |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (ja) | 651 | 84 | ok state, 8 categories, noindex |
| PASS | desktop-1920x1080 | /share/diagnosis | share view (en) and back to ja | 1759 | 175 | English labels, restored to Japanese |
| PASS | desktop-1920x1080 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2351 | 391 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | desktop-1920x1080 | /share/diagnosis | share: older rules noted | 643 | 84 | older-rules note |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: checksum mismatch | 634 | 0 | safe error (checksum_mismatch) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: script string | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: URL string | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: missing field | 636 | 0 | safe error (invalid_payload) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: malformed encoding | 637 | 0 | safe error (bad_format) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: over limit | 637 | 0 | safe error (too_long) |
| PASS | desktop-1920x1080 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | desktop-1920x1080 | /share/diagnosis | share: hashchange, back/forward, reload | 1230 | 87 | state follows the URL |
| PASS | desktop-1920x1080 | /diagnosis-history | history: empty state | 1073 | 171 | empty state |
| PASS | desktop-1920x1080 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1229 | 171 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | desktop-1920x1080 | /diagnosis-history | history: maximum 50 entries | 656 | 86 | 50 entries rendered |
| PASS | desktop-1920x1080 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 654 | 86 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | desktop-1920x1080 | /share/compare | comparison share link opens; bad links rejected | 2334 | 84 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-768x1024 | / | view | 648 | 59 | World 13,517 |
| PASS | tablet-768x1024 | /players | view | 652 | 48 | 36 cards |
| PASS | tablet-768x1024 | /players/world/<id> | view | 653 | 67 | identity ok |
| PASS | tablet-768x1024 | /managers | view | 649 | 36 | managers 71 |
| PASS | tablet-768x1024 | /managers/65 | view | 654 | 26 | identity ok |
| PASS | tablet-768x1024 | /compare | view | 652 | 57 | h1 ok |
| PASS | tablet-768x1024 | /squads | view | 651 | 62 | h1 ok |
| PASS | tablet-768x1024 | /squads/templates | view | 641 | 48 | h1 ok |
| PASS | tablet-768x1024 | /squads/compare | view | 641 | 55 | h1 ok |
| PASS | tablet-768x1024 | /best-xi | view | 652 | 57 | h1 ok |
| PASS | tablet-768x1024 | /players/new | view | 702 | 50 | h1 ok |
| PASS | tablet-768x1024 | /pack-check | view | 634 | 48 | h1 ok |
| PASS | tablet-768x1024 | /tier/CF | view | 636 | 100 | h1 ok |
| PASS | tablet-768x1024 | /glossary | view | 650 | 25 | h1 ok |
| PASS | tablet-768x1024 | /favorites | view | 638 | 51 | h1 ok |
| PASS | tablet-768x1024 | /my-team | view | 652 | 56 | h1 ok |
| PASS | tablet-768x1024 | /my-builds | view | 651 | 60 | h1 ok |
| PASS | tablet-768x1024 | /build-inventory | view | 652 | 62 | h1 ok |
| PASS | tablet-768x1024 | /support | view | 652 | 33 | legal links present |
| PASS | tablet-768x1024 | /terms | view | 634 | 25 | h1 ok |
| PASS | tablet-768x1024 | /privacy | view | 648 | 25 | h1 ok |
| PASS | tablet-768x1024 | /disclaimer | view | 640 | 44 | h1 ok |
| PASS | tablet-768x1024 | /about | view | 636 | 26 | h1 ok |
| PASS | tablet-768x1024 | /data-management | view | 652 | 46 | local data management only |
| PASS | tablet-768x1024 | /auth/sign-in | view | 888 | 44 | h1 ok |
| PASS | tablet-768x1024 | /auth/sign-up | view | 638 | 47 | h1 ok |
| PASS | tablet-768x1024 | /auth/forgot-password | view | 654 | 45 | h1 ok |
| PASS | tablet-768x1024 | /this-page-does-not-exist | view | 653 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/world/<id> | view | 884 | 46 | not-found view |
| PASS | tablet-768x1024 | /account/rls-test | view | 639 | 46 | not-found view |
| PASS | tablet-768x1024 | /release-readiness | view | 650 | 46 | not-found view |
| PASS | tablet-768x1024 | /players/ | trailing slash | 652 | 49 | → /players |
| PASS | tablet-768x1024 | /account/rls-test/ | trailing slash | 651 | 47 | not-found view |
| PASS | tablet-768x1024 | /release-readiness/ | trailing slash | 652 | 47 | not-found view |
| PASS | tablet-768x1024 | /players | language ja→en→ja | 793 | 49 | switched and restored |
| PASS | tablet-768x1024 | /players | search ja | 1290 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search en | 1305 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search unicode | 1298 | 90 | 18 results |
| PASS | tablet-768x1024 | /players | search symbols | 1308 | 84 | 0 results |
| PASS | tablet-768x1024 | header search | submit with Enter | 1055 | 71 | 25 results |
| PASS | tablet-768x1024 | /players | search control-character rejected safely | 653 | 48 | rejection view |
| PASS | tablet-768x1024 | /players | search clear | 1042 | 61 | 36 cards |
| PASS | tablet-768x1024 | /players | position filter | 1054 | 76 | position set, 36 cards |
| PASS | tablet-768x1024 | /players | card type filter | 1059 | 68 | cardType set, 24 cards |
| PASS | tablet-768x1024 | /players | sort | 1040 | 65 | sort set, 36 cards |
| PASS | tablet-768x1024 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-768x1024 | /players | pagination | 1043 | 78 | page 2 differs |
| PASS | tablet-768x1024 | /players → detail → back | navigate and back | 1341 | 89 | detail and back ok |
| PASS | tablet-768x1024 | /compare | compare 2 players | 656 | 47 | 2 identities shown |
| PASS | tablet-768x1024 | /compare | compare 3 players | 653 | 49 | 3 identities shown |
| PASS | tablet-768x1024 | /compare | compare 4 players | 651 | 51 | 4 identities shown |
| PASS | tablet-768x1024 | /managers | manager search | 1271 | 58 | 2 results |
| PASS | tablet-768x1024 | /managers | manager filter | 1030 | 38 | booster=1, 25 results |
| PASS | tablet-768x1024 | /managers → detail | open manager | 916 | 57 | manager detail |
| PASS | tablet-768x1024 | /support → /terms → /privacy | legal navigation | 1426 | 45 | support → terms → privacy |
| PASS | tablet-768x1024 | /share/diagnosis | share view (ja) | 653 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-768x1024 | /share/diagnosis | share view (en) and back to ja | 1773 | 99 | English labels, restored to Japanese |
| PASS | tablet-768x1024 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2328 | 246 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-768x1024 | /share/diagnosis | share: older rules noted | 649 | 48 | older-rules note |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: checksum mismatch | 636 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: script string | 633 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: URL string | 635 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: user field | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: missing field | 640 | 0 | safe error (invalid_payload) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: malformed encoding | 621 | 0 | safe error (bad_format) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: over limit | 636 | 0 | safe error (too_long) |
| PASS | tablet-768x1024 | /share/diagnosis | share rejected: empty | 634 | 0 | safe error (empty) |
| PASS | tablet-768x1024 | /share/diagnosis | share: hashchange, back/forward, reload | 1351 | 49 | state follows the URL |
| PASS | tablet-768x1024 | /diagnosis-history | history: empty state | 1065 | 108 | empty state |
| PASS | tablet-768x1024 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1233 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-768x1024 | /diagnosis-history | history: maximum 50 entries | 642 | 51 | 50 entries rendered |
| PASS | tablet-768x1024 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 654 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-768x1024 | /share/compare | comparison share link opens; bad links rejected | 2304 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | tablet-820x1180 | / | view | 653 | 67 | World 13,517 |
| PASS | tablet-820x1180 | /players | view | 658 | 48 | 36 cards |
| PASS | tablet-820x1180 | /players/world/<id> | view | 668 | 67 | identity ok |
| PASS | tablet-820x1180 | /managers | view | 656 | 38 | managers 71 |
| PASS | tablet-820x1180 | /managers/65 | view | 638 | 47 | identity ok |
| PASS | tablet-820x1180 | /compare | view | 628 | 57 | h1 ok |
| PASS | tablet-820x1180 | /squads | view | 655 | 64 | h1 ok |
| PASS | tablet-820x1180 | /squads/templates | view | 654 | 48 | h1 ok |
| PASS | tablet-820x1180 | /squads/compare | view | 641 | 55 | h1 ok |
| PASS | tablet-820x1180 | /best-xi | view | 651 | 57 | h1 ok |
| PASS | tablet-820x1180 | /players/new | view | 717 | 50 | h1 ok |
| PASS | tablet-820x1180 | /pack-check | view | 634 | 48 | h1 ok |
| PASS | tablet-820x1180 | /tier/CF | view | 638 | 105 | h1 ok |
| PASS | tablet-820x1180 | /glossary | view | 647 | 25 | h1 ok |
| PASS | tablet-820x1180 | /favorites | view | 651 | 51 | h1 ok |
| PASS | tablet-820x1180 | /my-team | view | 638 | 56 | h1 ok |
| PASS | tablet-820x1180 | /my-builds | view | 651 | 60 | h1 ok |
| PASS | tablet-820x1180 | /build-inventory | view | 636 | 62 | h1 ok |
| PASS | tablet-820x1180 | /support | view | 638 | 33 | legal links present |
| PASS | tablet-820x1180 | /terms | view | 652 | 25 | h1 ok |
| PASS | tablet-820x1180 | /privacy | view | 640 | 25 | h1 ok |
| PASS | tablet-820x1180 | /disclaimer | view | 650 | 44 | h1 ok |
| PASS | tablet-820x1180 | /about | view | 639 | 26 | h1 ok |
| PASS | tablet-820x1180 | /data-management | view | 654 | 46 | local data management only |
| PASS | tablet-820x1180 | /auth/sign-in | view | 900 | 44 | h1 ok |
| PASS | tablet-820x1180 | /auth/sign-up | view | 656 | 47 | h1 ok |
| PASS | tablet-820x1180 | /auth/forgot-password | view | 638 | 45 | h1 ok |
| PASS | tablet-820x1180 | /this-page-does-not-exist | view | 653 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/world/<id> | view | 901 | 46 | not-found view |
| PASS | tablet-820x1180 | /account/rls-test | view | 637 | 46 | not-found view |
| PASS | tablet-820x1180 | /release-readiness | view | 641 | 46 | not-found view |
| PASS | tablet-820x1180 | /players/ | trailing slash | 654 | 49 | → /players |
| PASS | tablet-820x1180 | /account/rls-test/ | trailing slash | 653 | 47 | not-found view |
| PASS | tablet-820x1180 | /release-readiness/ | trailing slash | 640 | 47 | not-found view |
| PASS | tablet-820x1180 | /players | language ja→en→ja | 685 | 49 | switched and restored |
| PASS | tablet-820x1180 | /players | search ja | 1294 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search en | 1304 | 79 | 25 results |
| PASS | tablet-820x1180 | /players | search unicode | 1317 | 90 | 18 results |
| PASS | tablet-820x1180 | /players | search symbols | 1311 | 84 | 0 results |
| PASS | tablet-820x1180 | header search | submit with Enter | 1053 | 85 | 25 results |
| PASS | tablet-820x1180 | /players | search control-character rejected safely | 654 | 48 | rejection view |
| PASS | tablet-820x1180 | /players | search clear | 1048 | 69 | 36 cards |
| PASS | tablet-820x1180 | /players | position filter | 1068 | 76 | position set, 36 cards |
| PASS | tablet-820x1180 | /players | card type filter | 1068 | 76 | cardType set, 24 cards |
| PASS | tablet-820x1180 | /players | sort | 1043 | 65 | sort set, 36 cards |
| PASS | tablet-820x1180 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | tablet-820x1180 | /players | pagination | 1044 | 78 | page 2 differs |
| PASS | tablet-820x1180 | /players → detail → back | navigate and back | 1322 | 90 | detail and back ok |
| PASS | tablet-820x1180 | /compare | compare 2 players | 656 | 47 | 2 identities shown |
| PASS | tablet-820x1180 | /compare | compare 3 players | 654 | 49 | 3 identities shown |
| PASS | tablet-820x1180 | /compare | compare 4 players | 654 | 51 | 4 identities shown |
| PASS | tablet-820x1180 | /managers | manager search | 1303 | 60 | 2 results |
| PASS | tablet-820x1180 | /managers | manager filter | 1044 | 40 | booster=1, 25 results |
| PASS | tablet-820x1180 | /managers → detail | open manager | 901 | 59 | manager detail |
| PASS | tablet-820x1180 | /support → /terms → /privacy | legal navigation | 1292 | 45 | support → terms → privacy |
| PASS | tablet-820x1180 | /share/diagnosis | share view (ja) | 655 | 48 | ok state, 8 categories, noindex |
| PASS | tablet-820x1180 | /share/diagnosis | share view (en) and back to ja | 1775 | 101 | English labels, restored to Japanese |
| PASS | tablet-820x1180 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2315 | 267 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | tablet-820x1180 | /share/diagnosis | share: older rules noted | 652 | 48 | older-rules note |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: checksum mismatch | 639 | 0 | safe error (checksum_mismatch) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: unknown version | 639 | 0 | safe error (unsupported_version) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: script string | 636 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: URL string | 623 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: control/NUL | 628 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: malformed encoding | 639 | 0 | safe error (bad_format) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: over limit | 637 | 0 | safe error (too_long) |
| PASS | tablet-820x1180 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | tablet-820x1180 | /share/diagnosis | share: hashchange, back/forward, reload | 1227 | 49 | state follows the URL |
| PASS | tablet-820x1180 | /diagnosis-history | history: empty state | 1086 | 116 | empty state |
| PASS | tablet-820x1180 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1228 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | tablet-820x1180 | /diagnosis-history | history: maximum 50 entries | 655 | 51 | 50 entries rendered |
| PASS | tablet-820x1180 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 656 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | tablet-820x1180 | /share/compare | comparison share link opens; bad links rejected | 2316 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | / | view | 650 | 48 | World 13,517 |
| PASS | mobile-390x844 | /players | view | 650 | 40 | 36 cards |
| PASS | mobile-390x844 | /players/world/<id> | view | 651 | 53 | identity ok |
| PASS | mobile-390x844 | /managers | view | 651 | 31 | managers 71 |
| PASS | mobile-390x844 | /managers/65 | view | 627 | 26 | identity ok |
| PASS | mobile-390x844 | /compare | view | 622 | 57 | h1 ok |
| PASS | mobile-390x844 | /squads | view | 640 | 49 | h1 ok |
| PASS | mobile-390x844 | /squads/templates | view | 639 | 48 | h1 ok |
| PASS | mobile-390x844 | /squads/compare | view | 655 | 55 | h1 ok |
| PASS | mobile-390x844 | /best-xi | view | 654 | 57 | h1 ok |
| PASS | mobile-390x844 | /players/new | view | 702 | 44 | h1 ok |
| PASS | mobile-390x844 | /pack-check | view | 637 | 48 | h1 ok |
| PASS | mobile-390x844 | /tier/CF | view | 652 | 76 | h1 ok |
| PASS | mobile-390x844 | /glossary | view | 635 | 25 | h1 ok |
| PASS | mobile-390x844 | /favorites | view | 639 | 51 | h1 ok |
| PASS | mobile-390x844 | /my-team | view | 654 | 56 | h1 ok |
| PASS | mobile-390x844 | /my-builds | view | 653 | 54 | h1 ok |
| PASS | mobile-390x844 | /build-inventory | view | 640 | 62 | h1 ok |
| PASS | mobile-390x844 | /support | view | 653 | 25 | legal links present |
| PASS | mobile-390x844 | /terms | view | 648 | 25 | h1 ok |
| PASS | mobile-390x844 | /privacy | view | 654 | 25 | h1 ok |
| PASS | mobile-390x844 | /disclaimer | view | 634 | 27 | h1 ok |
| PASS | mobile-390x844 | /about | view | 638 | 26 | h1 ok |
| PASS | mobile-390x844 | /data-management | view | 652 | 46 | local data management only |
| PASS | mobile-390x844 | /auth/sign-in | view | 887 | 44 | h1 ok |
| PASS | mobile-390x844 | /auth/sign-up | view | 654 | 47 | h1 ok |
| PASS | mobile-390x844 | /auth/forgot-password | view | 653 | 45 | h1 ok |
| PASS | mobile-390x844 | /this-page-does-not-exist | view | 656 | 46 | not-found view |
| PASS | mobile-390x844 | /players/world/<id> | view | 897 | 46 | not-found view |
| PASS | mobile-390x844 | /account/rls-test | view | 638 | 46 | not-found view |
| PASS | mobile-390x844 | /release-readiness | view | 651 | 46 | not-found view |
| PASS | mobile-390x844 | /players/ | trailing slash | 654 | 41 | → /players |
| PASS | mobile-390x844 | /account/rls-test/ | trailing slash | 637 | 47 | not-found view |
| PASS | mobile-390x844 | /release-readiness/ | trailing slash | 657 | 47 | not-found view |
| PASS | mobile-390x844 | /players | language ja→en→ja | 793 | 41 | switched and restored |
| PASS | mobile-390x844 | /players | search ja | 1310 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search en | 1320 | 54 | 25 results |
| PASS | mobile-390x844 | /players | search unicode | 1313 | 60 | 18 results |
| PASS | mobile-390x844 | /players | search symbols | 1303 | 70 | 0 results |
| PASS | mobile-390x844 | header search | submit with Enter | 1057 | 60 | 25 results |
| PASS | mobile-390x844 | /players | search control-character rejected safely | 654 | 48 | rejection view |
| PASS | mobile-390x844 | /players | search clear | 1056 | 52 | 36 cards |
| PASS | mobile-390x844 | /players | position filter | 1070 | 52 | position set, 36 cards |
| PASS | mobile-390x844 | /players | card type filter | 1050 | 50 | cardType set, 24 cards |
| PASS | mobile-390x844 | /players | sort | 1052 | 49 | sort set, 36 cards |
| PASS | mobile-390x844 | /players | nationality filter | 216 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-390x844 | /players | pagination | 1041 | 54 | page 2 differs |
| PASS | mobile-390x844 | /players → detail → back | navigate and back | 1335 | 61 | detail and back ok |
| PASS | mobile-390x844 | /compare | compare 2 players | 655 | 47 | 2 identities shown |
| PASS | mobile-390x844 | /compare | compare 3 players | 655 | 47 | 3 identities shown |
| PASS | mobile-390x844 | /compare | compare 4 players | 652 | 47 | 4 identities shown |
| PASS | mobile-390x844 | /managers | manager search | 1289 | 53 | 2 results |
| PASS | mobile-390x844 | /managers | manager filter | 1033 | 32 | booster=1, 25 results |
| PASS | mobile-390x844 | /managers → detail | open manager | 891 | 52 | manager detail |
| PASS | mobile-390x844 | /support → /terms → /privacy | legal navigation | 1415 | 45 | support → terms → privacy |
| PASS | mobile-390x844 | /share/diagnosis | share view (ja) | 654 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-390x844 | /share/diagnosis | share view (en) and back to ja | 1754 | 99 | English labels, restored to Japanese |
| PASS | mobile-390x844 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2352 | 237 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-390x844 | /share/diagnosis | share: older rules noted | 650 | 48 | older-rules note |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: checksum mismatch | 635 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: unknown version | 626 | 0 | safe error (unsupported_version) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: script string | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: URL string | 634 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: control/NUL | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: user field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: missing field | 638 | 0 | safe error (invalid_payload) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: malformed encoding | 640 | 0 | safe error (bad_format) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: over limit | 624 | 0 | safe error (too_long) |
| PASS | mobile-390x844 | /share/diagnosis | share rejected: empty | 638 | 0 | safe error (empty) |
| PASS | mobile-390x844 | /share/diagnosis | share: hashchange, back/forward, reload | 1225 | 49 | state follows the URL |
| PASS | mobile-390x844 | /squads/<fixture> | share link: preview, copy, open | 1787 | 173 | copy: manual fallback; Web Share: available |
| PASS | mobile-390x844 | /diagnosis-history | history: empty state | 1084 | 97 | empty state |
| PASS | mobile-390x844 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1227 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-390x844 | /diagnosis-history | history: maximum 50 entries | 652 | 51 | 50 entries rendered |
| PASS | mobile-390x844 | /diagnosis-history | history: storage unavailable degrades safely | 652 | 50 | unavailable message, no success |
| PASS | mobile-390x844 | /squads/<fixture> | history: save from diagnosis, duplicate, list, open as share link | 1775 | 177 | saved once, duplicate skipped, listed, share link opens |
| PASS | mobile-390x844 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 657 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-390x844 | /share/compare | comparison share link opens; bad links rejected | 2337 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-390x844 | /diagnosis-history | before/after: save image | 806 | 51 | PNG generated and handed to the browser |
| PASS | mobile-393x852 | / | view | 635 | 48 | World 13,517 |
| PASS | mobile-393x852 | /players | view | 652 | 40 | 36 cards |
| PASS | mobile-393x852 | /players/world/<id> | view | 639 | 51 | identity ok |
| PASS | mobile-393x852 | /managers | view | 652 | 31 | managers 71 |
| PASS | mobile-393x852 | /managers/65 | view | 654 | 26 | identity ok |
| PASS | mobile-393x852 | /compare | view | 639 | 57 | h1 ok |
| PASS | mobile-393x852 | /squads | view | 650 | 49 | h1 ok |
| PASS | mobile-393x852 | /squads/templates | view | 654 | 48 | h1 ok |
| PASS | mobile-393x852 | /squads/compare | view | 639 | 56 | h1 ok |
| PASS | mobile-393x852 | /best-xi | view | 651 | 57 | h1 ok |
| PASS | mobile-393x852 | /players/new | view | 688 | 44 | h1 ok |
| PASS | mobile-393x852 | /pack-check | view | 650 | 48 | h1 ok |
| PASS | mobile-393x852 | /tier/CF | view | 653 | 76 | h1 ok |
| PASS | mobile-393x852 | /glossary | view | 652 | 25 | h1 ok |
| PASS | mobile-393x852 | /favorites | view | 655 | 51 | h1 ok |
| PASS | mobile-393x852 | /my-team | view | 651 | 56 | h1 ok |
| PASS | mobile-393x852 | /my-builds | view | 625 | 54 | h1 ok |
| PASS | mobile-393x852 | /build-inventory | view | 637 | 62 | h1 ok |
| PASS | mobile-393x852 | /support | view | 652 | 25 | legal links present |
| PASS | mobile-393x852 | /terms | view | 637 | 25 | h1 ok |
| PASS | mobile-393x852 | /privacy | view | 652 | 25 | h1 ok |
| PASS | mobile-393x852 | /disclaimer | view | 653 | 27 | h1 ok |
| PASS | mobile-393x852 | /about | view | 655 | 26 | h1 ok |
| PASS | mobile-393x852 | /data-management | view | 652 | 46 | local data management only |
| PASS | mobile-393x852 | /auth/sign-in | view | 903 | 44 | h1 ok |
| PASS | mobile-393x852 | /auth/sign-up | view | 649 | 47 | h1 ok |
| PASS | mobile-393x852 | /auth/forgot-password | view | 637 | 45 | h1 ok |
| PASS | mobile-393x852 | /this-page-does-not-exist | view | 651 | 46 | not-found view |
| PASS | mobile-393x852 | /players/world/<id> | view | 887 | 46 | not-found view |
| PASS | mobile-393x852 | /account/rls-test | view | 654 | 46 | not-found view |
| PASS | mobile-393x852 | /release-readiness | view | 639 | 46 | not-found view |
| PASS | mobile-393x852 | /players/ | trailing slash | 653 | 41 | → /players |
| PASS | mobile-393x852 | /account/rls-test/ | trailing slash | 652 | 47 | not-found view |
| PASS | mobile-393x852 | /release-readiness/ | trailing slash | 653 | 47 | not-found view |
| PASS | mobile-393x852 | /players | language ja→en→ja | 793 | 41 | switched and restored |
| PASS | mobile-393x852 | /players | search ja | 1300 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search en | 1309 | 54 | 25 results |
| PASS | mobile-393x852 | /players | search unicode | 1312 | 60 | 18 results |
| PASS | mobile-393x852 | /players | search symbols | 1299 | 70 | 0 results |
| PASS | mobile-393x852 | header search | submit with Enter | 1061 | 60 | 25 results |
| PASS | mobile-393x852 | /players | search control-character rejected safely | 640 | 48 | rejection view |
| PASS | mobile-393x852 | /players | search clear | 1035 | 49 | 36 cards |
| PASS | mobile-393x852 | /players | position filter | 1067 | 52 | position set, 36 cards |
| PASS | mobile-393x852 | /players | card type filter | 1048 | 50 | cardType set, 24 cards |
| PASS | mobile-393x852 | /players | sort | 1051 | 49 | sort set, 36 cards |
| PASS | mobile-393x852 | /players | nationality filter | 203 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-393x852 | /players | pagination | 1043 | 72 | page 2 differs |
| PASS | mobile-393x852 | /players → detail → back | navigate and back | 1321 | 61 | detail and back ok |
| PASS | mobile-393x852 | /compare | compare 2 players | 630 | 47 | 2 identities shown |
| PASS | mobile-393x852 | /compare | compare 3 players | 654 | 47 | 3 identities shown |
| PASS | mobile-393x852 | /compare | compare 4 players | 636 | 47 | 4 identities shown |
| PASS | mobile-393x852 | /managers | manager search | 1285 | 53 | 2 results |
| PASS | mobile-393x852 | /managers | manager filter | 1029 | 32 | booster=1, 25 results |
| PASS | mobile-393x852 | /managers → detail | open manager | 915 | 52 | manager detail |
| PASS | mobile-393x852 | /support → /terms → /privacy | legal navigation | 1417 | 45 | support → terms → privacy |
| PASS | mobile-393x852 | /share/diagnosis | share view (ja) | 639 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-393x852 | /share/diagnosis | share view (en) and back to ja | 1768 | 99 | English labels, restored to Japanese |
| PASS | mobile-393x852 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2334 | 254 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-393x852 | /share/diagnosis | share: older rules noted | 650 | 48 | older-rules note |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: checksum mismatch | 638 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: unknown version | 637 | 0 | safe error (unsupported_version) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: script string | 640 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: URL string | 625 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: control/NUL | 636 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: user field | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: missing field | 624 | 0 | safe error (invalid_payload) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: malformed encoding | 634 | 0 | safe error (bad_format) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: over limit | 653 | 0 | safe error (too_long) |
| PASS | mobile-393x852 | /share/diagnosis | share rejected: empty | 636 | 0 | safe error (empty) |
| PASS | mobile-393x852 | /share/diagnosis | share: hashchange, back/forward, reload | 1216 | 49 | state follows the URL |
| PASS | mobile-393x852 | /diagnosis-history | history: empty state | 1073 | 97 | empty state |
| PASS | mobile-393x852 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1216 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-393x852 | /diagnosis-history | history: maximum 50 entries | 658 | 51 | 50 entries rendered |
| PASS | mobile-393x852 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 650 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-393x852 | /share/compare | comparison share link opens; bad links rejected | 2328 | 49 | opens with card and noindex; 4 bad links rejected |
| PASS | mobile-430x932 | / | view | 654 | 54 | World 13,517 |
| PASS | mobile-430x932 | /players | view | 651 | 40 | 36 cards |
| PASS | mobile-430x932 | /players/world/<id> | view | 653 | 51 | identity ok |
| PASS | mobile-430x932 | /managers | view | 654 | 31 | managers 71 |
| PASS | mobile-430x932 | /managers/65 | view | 654 | 26 | identity ok |
| PASS | mobile-430x932 | /compare | view | 639 | 57 | h1 ok |
| PASS | mobile-430x932 | /squads | view | 639 | 49 | h1 ok |
| PASS | mobile-430x932 | /squads/templates | view | 641 | 48 | h1 ok |
| PASS | mobile-430x932 | /squads/compare | view | 640 | 55 | h1 ok |
| PASS | mobile-430x932 | /best-xi | view | 650 | 57 | h1 ok |
| PASS | mobile-430x932 | /players/new | view | 698 | 46 | h1 ok |
| PASS | mobile-430x932 | /pack-check | view | 651 | 48 | h1 ok |
| PASS | mobile-430x932 | /tier/CF | view | 648 | 80 | h1 ok |
| PASS | mobile-430x932 | /glossary | view | 638 | 25 | h1 ok |
| PASS | mobile-430x932 | /favorites | view | 653 | 51 | h1 ok |
| PASS | mobile-430x932 | /my-team | view | 641 | 56 | h1 ok |
| PASS | mobile-430x932 | /my-builds | view | 636 | 60 | h1 ok |
| PASS | mobile-430x932 | /build-inventory | view | 637 | 62 | h1 ok |
| PASS | mobile-430x932 | /support | view | 653 | 25 | legal links present |
| PASS | mobile-430x932 | /terms | view | 655 | 25 | h1 ok |
| PASS | mobile-430x932 | /privacy | view | 652 | 25 | h1 ok |
| PASS | mobile-430x932 | /disclaimer | view | 652 | 27 | h1 ok |
| PASS | mobile-430x932 | /about | view | 637 | 26 | h1 ok |
| PASS | mobile-430x932 | /data-management | view | 653 | 46 | local data management only |
| PASS | mobile-430x932 | /auth/sign-in | view | 898 | 44 | h1 ok |
| PASS | mobile-430x932 | /auth/sign-up | view | 641 | 47 | h1 ok |
| PASS | mobile-430x932 | /auth/forgot-password | view | 651 | 45 | h1 ok |
| PASS | mobile-430x932 | /this-page-does-not-exist | view | 652 | 46 | not-found view |
| PASS | mobile-430x932 | /players/world/<id> | view | 901 | 46 | not-found view |
| PASS | mobile-430x932 | /account/rls-test | view | 640 | 46 | not-found view |
| PASS | mobile-430x932 | /release-readiness | view | 654 | 46 | not-found view |
| PASS | mobile-430x932 | /players/ | trailing slash | 667 | 41 | → /players |
| PASS | mobile-430x932 | /account/rls-test/ | trailing slash | 648 | 47 | not-found view |
| PASS | mobile-430x932 | /release-readiness/ | trailing slash | 652 | 47 | not-found view |
| PASS | mobile-430x932 | /players | language ja→en→ja | 811 | 41 | switched and restored |
| PASS | mobile-430x932 | /players | search ja | 1309 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search en | 1305 | 54 | 25 results |
| PASS | mobile-430x932 | /players | search unicode | 1296 | 60 | 18 results |
| PASS | mobile-430x932 | /players | search symbols | 1302 | 70 | 0 results |
| PASS | mobile-430x932 | header search | submit with Enter | 1061 | 68 | 25 results |
| PASS | mobile-430x932 | /players | search control-character rejected safely | 652 | 48 | rejection view |
| PASS | mobile-430x932 | /players | search clear | 1043 | 52 | 36 cards |
| PASS | mobile-430x932 | /players | position filter | 1068 | 52 | position set, 36 cards |
| PASS | mobile-430x932 | /players | card type filter | 1045 | 48 | cardType set, 24 cards |
| PASS | mobile-430x932 | /players | sort | 1037 | 49 | sort set, 36 cards |
| PASS | mobile-430x932 | /players | nationality filter | 217 | 0 | not a feature of this site (no nationality filter exists); skipped by design |
| PASS | mobile-430x932 | /players | pagination | 1042 | 54 | page 2 differs |
| PASS | mobile-430x932 | /players → detail → back | navigate and back | 1330 | 62 | detail and back ok |
| PASS | mobile-430x932 | /compare | compare 2 players | 655 | 47 | 2 identities shown |
| PASS | mobile-430x932 | /compare | compare 3 players | 654 | 47 | 3 identities shown |
| PASS | mobile-430x932 | /compare | compare 4 players | 652 | 47 | 4 identities shown |
| PASS | mobile-430x932 | /managers | manager search | 1289 | 53 | 2 results |
| PASS | mobile-430x932 | /managers | manager filter | 1023 | 32 | booster=1, 25 results |
| PASS | mobile-430x932 | /managers → detail | open manager | 892 | 52 | manager detail |
| PASS | mobile-430x932 | /support → /terms → /privacy | legal navigation | 1460 | 45 | support → terms → privacy |
| PASS | mobile-430x932 | /share/diagnosis | share view (ja) | 654 | 48 | ok state, 8 categories, noindex |
| PASS | mobile-430x932 | /share/diagnosis | share view (en) and back to ja | 1785 | 99 | English labels, restored to Japanese |
| PASS | mobile-430x932 | /squads/compare?a=&b= | squad compare with query parameters (ja, en) | 2315 | 254 | two squads in browser storage only; ja and en with ?a=&b= |
| PASS | mobile-430x932 | /share/diagnosis | share: older rules noted | 653 | 48 | older-rules note |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: checksum mismatch | 638 | 0 | safe error (checksum_mismatch) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: unknown version | 638 | 0 | safe error (unsupported_version) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: script string | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: URL string | 635 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: control/NUL | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: user field | 637 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: missing field | 639 | 0 | safe error (invalid_payload) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: malformed encoding | 626 | 0 | safe error (bad_format) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: over limit | 634 | 0 | safe error (too_long) |
| PASS | mobile-430x932 | /share/diagnosis | share rejected: empty | 635 | 0 | safe error (empty) |
| PASS | mobile-430x932 | /share/diagnosis | share: hashchange, back/forward, reload | 1218 | 49 | state follows the URL |
| PASS | mobile-430x932 | /diagnosis-history | history: empty state | 1075 | 103 | empty state |
| PASS | mobile-430x932 | /diagnosis-history | history: corrupted item skipped, delete one, delete all, reload | 1240 | 101 | 3 shown, 1 corrupted skipped, delete one/all verified |
| PASS | mobile-430x932 | /diagnosis-history | history: maximum 50 entries | 653 | 51 | 50 entries rendered |
| PASS | mobile-430x932 | /diagnosis-history | before/after: order by date, trends, rules mismatch refused | 651 | 51 | older=before, +17 improved, 1 improved row, rules mismatch refused |
| PASS | mobile-430x932 | /share/compare | comparison share link opens; bad links rejected | 2329 | 49 | opens with card and noindex; 4 bad links rejected |

## 性能

| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OK | desktop-1280x720 | / | 187 | 24 | 4 | 13 | 44 | 0 | 0/0 | 76 | 2 | 171 | 4/171 | 295 | 0 |
| OK | desktop-1280x720 | /players | 83 | 36 | 11 | 33 | 56 | 0 | 0/0 | 82 | 0 | 61 | 4/61 | 421 | 0 |
| OK | desktop-1280x720 | /players/world/<id> | 160 | 36 | 11 | 33 | 48 | 0 | 0/0 | 95 | 0 | 462 | 4/462 | 433 | 0 |
| OK | desktop-1280x720 | /managers | 40 | 27 | 11 | 25 | 48 | 0 | 0/0 | 78 | 0 | 25 | 0/0 | 418 | 0 |
| OK | desktop-1280x720 | /compare?ids=<2> | 119 | 36 | 10 | 34 | 56 | 0 | 0/0 | 80 | 0 | 145 | 0/0 | 433 | 0 |
| OK | desktop-1280x720 | /squads | 47 | 26 | 7 | 24 | 324 | 0 | 0/0 | 92 | 3 | 25 | 0/0 | 296 | 0 |
| OK | desktop-1280x720 | /best-xi | 52 | 25 | 4 | 13 | 36 | 0 | 0/0 | 80 | 0 | 33 | 0/0 | 405 | 0 |
| OK | mobile-390x844 | / | 87 | 23 | 6 | 14 | 40 | 0 | 0/0 | 49 | 0 | 76 | 4/76 | 418 | 0 |
| OK | mobile-390x844 | /players | 109 | 37 | 14 | 34 | 52 | 0 | 0/0 | 39 | 2 | 87 | 4/87 | 434 | 0 |
| OK | mobile-390x844 | /players/world/<id> | 82 | 37 | 13 | 36 | 48 | 0 | 0/0 | 50 | 1 | 402 | 4/402 | 435 | 0 |
| OK | mobile-390x844 | /managers | 45 | 29 | 10 | 27 | 44 | 0 | 0/0 | 31 | 1 | 22 | 0/0 | 420 | 0 |
| OK | mobile-390x844 | /compare?ids=<2> | 74 | 35 | 10 | 34 | 52 | 0 | 0/0 | 47 | 1 | 70 | 0/0 | 435 | 0 |
| OK | mobile-390x844 | /squads | 52 | 28 | 7 | 27 | 320 | 0 | 0/0 | 49 | 1 | 27 | 0/0 | 294 | 0 |
| OK | mobile-390x844 | /best-xi | 79 | 24 | 5 | 12 | 32 | 0 | 0/0 | 57 | 0 | 33 | 0/0 | 296 | 0 |

メモリ(一覧⇔詳細10往復・GC後JS heap KB): 10569, 12817, 12824, 12820, 12822, 12820, 12822, 12821, 12820, 12825

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
