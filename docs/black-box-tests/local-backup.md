# F-023b 現在の領域のデータ（書き出し・読み込み・削除） ブラックボックス

実行日時: 2026-10-04T15:30:37.075Z
対象: localhost（Production Build）・隔離ブラウザーの localStorage の合成データだけ。サーバー・DB・Production へは書き込まない。

| 結果 | viewport | locale | 確認 | 詳細 |
|---|---|---|---|---|
| PASS | desktop-1280x720 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | desktop-1280x720 | ja | export → delete → import → restored after reload | My Team 1 \| 診断履歴 1 |
| PASS | desktop-1280x720 | ja | invalid file changes nothing | rejected |
| PASS | desktop-1280x720 | ja | signed-in area (test double) does not show guest data | account counts=0 |
| PASS | desktop-1280x720 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | desktop-1280x720 | en | export → delete → import → restored after reload | My Team 1 \| Diagnosis history 1 |
| PASS | desktop-1280x720 | en | invalid file changes nothing | rejected |
| PASS | desktop-1280x720 | en | signed-in area (test double) does not show guest data | account counts=0 |
| PASS | desktop-1440x900 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | desktop-1440x900 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | desktop-1920x1080 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | desktop-1920x1080 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | tablet-768x1024 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | tablet-768x1024 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | tablet-820x1180 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | tablet-820x1180 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | mobile-390x844 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | mobile-390x844 | ja | export → delete → import → restored after reload | My Team 1 \| 診断履歴 1 |
| PASS | mobile-390x844 | ja | invalid file changes nothing | rejected |
| PASS | mobile-390x844 | ja | signed-in area (test double) does not show guest data | account counts=0 |
| PASS | mobile-390x844 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | mobile-390x844 | en | export → delete → import → restored after reload | My Team 1 \| Diagnosis history 1 |
| PASS | mobile-390x844 | en | invalid file changes nothing | rejected |
| PASS | mobile-390x844 | en | signed-in area (test double) does not show guest data | account counts=0 |
| PASS | mobile-393x852 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | mobile-393x852 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |
| PASS | mobile-430x932 | ja | panel shows current guest data with counts; controls usable | My Team 1 \| 診断履歴 1 |
| PASS | mobile-430x932 | en | panel shows current guest data with counts; controls usable | My Team 1 \| Diagnosis history 1 |

## 判定: 28/28 PASS
