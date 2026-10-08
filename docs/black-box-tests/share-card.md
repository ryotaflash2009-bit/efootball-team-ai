# F-041b 診断カード（比率・プレビュー・保存・OS 共有） ブラックボックス

実行日時: 2026-10-08T18:27:12.218Z
対象: localhost（Production Build）。隔離ブラウザーの guest 領域の合成スカッドだけ。Web Share はページ内の模擬。

| 結果 | viewport | locale | 確認 | 詳細 |
|---|---|---|---|---|
| PASS | desktop-1280x720 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | desktop-1280x720 | ja | save downloads a PNG with the ratio in the file name; share hidden when unsupported | efootball-team-ai-squad-diagnosis-BB Share Card とても長いスカッド名のテスト用の名前です… |
| PASS | desktop-1280x720 | ja | OS share: success shows shared; cancel is not an error | shared once; cancel silent |
| PASS | desktop-1280x720 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | desktop-1280x720 | en | save downloads a PNG with the ratio in the file name; share hidden when unsupported | efootball-team-ai-squad-diagnosis-BB Share Card とても長いスカッド名のテスト用の名前です… |
| PASS | desktop-1280x720 | en | OS share: success shows shared; cancel is not an error | shared once; cancel silent |
| PASS | desktop-1440x900 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | desktop-1440x900 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | desktop-1920x1080 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | desktop-1920x1080 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | tablet-768x1024 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | tablet-768x1024 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | tablet-820x1180 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | tablet-820x1180 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | mobile-390x844 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | mobile-390x844 | ja | save downloads a PNG with the ratio in the file name; share hidden when unsupported | efootball-team-ai-squad-diagnosis-BB Share Card とても長いスカッド名のテスト用の名前です… |
| PASS | mobile-390x844 | ja | OS share: success shows shared; cancel is not an error | shared once; cancel silent |
| PASS | mobile-390x844 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | mobile-390x844 | en | save downloads a PNG with the ratio in the file name; share hidden when unsupported | efootball-team-ai-squad-diagnosis-BB Share Card とても長いスカッド名のテスト用の名前です… |
| PASS | mobile-390x844 | en | OS share: success shows shared; cancel is not an error | shared once; cancel silent |
| PASS | mobile-393x852 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | mobile-393x852 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | mobile-430x932 | ja | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |
| PASS | mobile-430x932 | en | 4 ratios: preview pixel sizes, selection state, URLs revoked | 3:4=1440x1920 1:1=1920x1920 9:16=1440x2560 16:9=2560x1440; urls 4/4 |

## 判定: 24/24 PASS
