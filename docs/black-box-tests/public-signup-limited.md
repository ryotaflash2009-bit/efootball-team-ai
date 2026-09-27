# 新規登録の限定テスト 公開ブラックボックス

実行日時: 2026-09-27T10:45:27.754Z
対象: localhost（Production Build）  viewport: 8  locale: ja, en

フォームは送信しない（ログイン・新規登録・再設定メール・リンク確認を実行しない。本番メール送信 0・書き込み 0）。

| 結果 | viewport | locale | route | 確認 | 詳細 |
|---|---|---|---|---|---|
| PASS | desktop-1280x720 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | desktop-1280x720 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | desktop-1280x720 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | desktop-1280x720 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | desktop-1280x720 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | desktop-1280x720 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | desktop-1280x720 | ja | /account | signed-out view | sign-in prompt |
| PASS | desktop-1280x720 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | desktop-1280x720 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | desktop-1280x720 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | desktop-1280x720 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | desktop-1280x720 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | desktop-1280x720 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | desktop-1280x720 | en | /account | signed-out view | sign-in prompt |
| PASS | desktop-1440x900 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | desktop-1440x900 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | desktop-1440x900 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | desktop-1440x900 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | desktop-1440x900 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | desktop-1440x900 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | desktop-1440x900 | ja | /account | signed-out view | sign-in prompt |
| PASS | desktop-1440x900 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | desktop-1440x900 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | desktop-1440x900 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | desktop-1440x900 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | desktop-1440x900 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | desktop-1440x900 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | desktop-1440x900 | en | /account | signed-out view | sign-in prompt |
| PASS | desktop-1920x1080 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | desktop-1920x1080 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | desktop-1920x1080 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | desktop-1920x1080 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | desktop-1920x1080 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | desktop-1920x1080 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | desktop-1920x1080 | ja | /account | signed-out view | sign-in prompt |
| PASS | desktop-1920x1080 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | desktop-1920x1080 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | desktop-1920x1080 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | desktop-1920x1080 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | desktop-1920x1080 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | desktop-1920x1080 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | desktop-1920x1080 | en | /account | signed-out view | sign-in prompt |
| PASS | tablet-768x1024 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | tablet-768x1024 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | tablet-768x1024 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | tablet-768x1024 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | tablet-768x1024 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | tablet-768x1024 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | tablet-768x1024 | ja | /account | signed-out view | sign-in prompt |
| PASS | tablet-768x1024 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | tablet-768x1024 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | tablet-768x1024 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | tablet-768x1024 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | tablet-768x1024 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | tablet-768x1024 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | tablet-768x1024 | en | /account | signed-out view | sign-in prompt |
| PASS | tablet-820x1180 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | tablet-820x1180 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | tablet-820x1180 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | tablet-820x1180 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | tablet-820x1180 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | tablet-820x1180 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | tablet-820x1180 | ja | /account | signed-out view | sign-in prompt |
| PASS | tablet-820x1180 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | tablet-820x1180 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | tablet-820x1180 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | tablet-820x1180 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | tablet-820x1180 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | tablet-820x1180 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | tablet-820x1180 | en | /account | signed-out view | sign-in prompt |
| PASS | mobile-390x844 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | mobile-390x844 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | mobile-390x844 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | mobile-390x844 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | mobile-390x844 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | mobile-390x844 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | mobile-390x844 | ja | /account | signed-out view | sign-in prompt |
| PASS | mobile-390x844 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | mobile-390x844 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | mobile-390x844 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | mobile-390x844 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | mobile-390x844 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | mobile-390x844 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | mobile-390x844 | en | /account | signed-out view | sign-in prompt |
| PASS | mobile-393x852 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | mobile-393x852 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | mobile-393x852 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | mobile-393x852 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | mobile-393x852 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | mobile-393x852 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | mobile-393x852 | ja | /account | signed-out view | sign-in prompt |
| PASS | mobile-393x852 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | mobile-393x852 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | mobile-393x852 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | mobile-393x852 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | mobile-393x852 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | mobile-393x852 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | mobile-393x852 | en | /account | signed-out view | sign-in prompt |
| PASS | mobile-430x932 | ja | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | mobile-430x932 | ja | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | mobile-430x932 | ja | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | mobile-430x932 | ja | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | mobile-430x932 | ja | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | mobile-430x932 | ja | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | mobile-430x932 | ja | /account | signed-out view | sign-in prompt |
| PASS | mobile-430x932 | en | /auth/sign-up | limited notice, no form | limited, noindex |
| PASS | mobile-430x932 | en | /auth/sign-up?signupPreview=1 | preview opens on localhost only | password inputs=2 |
| PASS | mobile-430x932 | en | /auth/sign-in | sign-in usable (not submitted) | form ready |
| PASS | mobile-430x932 | en | /auth/forgot-password | reset notice (not submitted) | notices shown |
| PASS | mobile-430x932 | en | /auth/confirm | token removed from URL, not verified automatically | waiting for click |
| PASS | mobile-430x932 | en | /auth/confirm (bad type) | rejected without verification | invalid link view |
| PASS | mobile-430x932 | en | /account | signed-out view | sign-in prompt |
| PASS | desktop-1280x720 | ja | /account/rls-test | internal page is 404 | 404 |
| PASS | desktop-1280x720 | ja | /release-readiness | internal page is 404 | 404 |

## 判定: 114/114 PASS
