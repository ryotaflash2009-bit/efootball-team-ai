# F-084 写真付き投稿（ローカル試作）・F-056 安全機能（モック） ブラックボックス

実行日時: 2026-10-01T18:23:02.068Z
対象: localhost（内部ページを有効にした Production Build）。画像はブラウザー内で作った合成（GPS 入りの EXIF を差し込んだ縦長 JPEG）。保存は隔離ブラウザーの IndexedDB / localStorage だけ。外部通信・書き込み通信 0 を確認。

| 結果 | viewport | locale | 確認 | 詳細 |
|---|---|---|---|---|
| PASS | desktop-1280x720 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | desktop-1280x720 | ja | photo: GPS/EXIF removed, re-encoded, portrait kept, rotate, post, reload, delete | stored WebP 17KB, no GPS/EXIF |
| PASS | desktop-1280x720 | ja | disguised files rejected (SVG as .png, executable as .jpg, GIF); nothing stored | 3 rejected |
| PASS | desktop-1280x720 | ja | draft: save, reload, still listed; delete draft | draft round trip |
| PASS | desktop-1280x720 | ja | F-056 mock: block/mute hide, own post cannot be reported, duplicate report refused, admin-hidden | reports=1 |
| PASS | desktop-1280x720 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | desktop-1280x720 | en | photo: GPS/EXIF removed, re-encoded, portrait kept, rotate, post, reload, delete | stored WebP 17KB, no GPS/EXIF |
| PASS | desktop-1280x720 | en | disguised files rejected (SVG as .png, executable as .jpg, GIF); nothing stored | 3 rejected |
| PASS | desktop-1280x720 | en | draft: save, reload, still listed; delete draft | draft round trip |
| PASS | desktop-1280x720 | en | F-056 mock: block/mute hide, own post cannot be reported, duplicate report refused, admin-hidden | reports=1 |
| PASS | desktop-1440x900 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | desktop-1440x900 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | desktop-1920x1080 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | desktop-1920x1080 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | tablet-768x1024 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | tablet-768x1024 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | tablet-820x1180 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | tablet-820x1180 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | mobile-390x844 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | mobile-390x844 | ja | photo: GPS/EXIF removed, re-encoded, portrait kept, rotate, post, reload, delete | stored WebP 17KB, no GPS/EXIF |
| PASS | mobile-390x844 | ja | disguised files rejected (SVG as .png, executable as .jpg, GIF); nothing stored | 3 rejected |
| PASS | mobile-390x844 | ja | draft: save, reload, still listed; delete draft | draft round trip |
| PASS | mobile-390x844 | ja | F-056 mock: block/mute hide, own post cannot be reported, duplicate report refused, admin-hidden | reports=1 |
| PASS | mobile-390x844 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | mobile-390x844 | en | photo: GPS/EXIF removed, re-encoded, portrait kept, rotate, post, reload, delete | stored WebP 17KB, no GPS/EXIF |
| PASS | mobile-390x844 | en | disguised files rejected (SVG as .png, executable as .jpg, GIF); nothing stored | 3 rejected |
| PASS | mobile-390x844 | en | draft: save, reload, still listed; delete draft | draft round trip |
| PASS | mobile-390x844 | en | F-056 mock: block/mute hide, own post cannot be reported, duplicate report refused, admin-hidden | reports=1 |
| PASS | mobile-393x852 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | mobile-393x852 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | mobile-430x932 | ja | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |
| PASS | mobile-430x932 | en | page: local-only banner, camera and library inputs, visibility marked as mock | capture=environment |

## 判定: 32/32 PASS
