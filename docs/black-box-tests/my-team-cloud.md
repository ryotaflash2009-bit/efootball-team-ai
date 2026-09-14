# My Teamクラウド保存(PoC) ブラックボックステスト結果

実行日時: 2026-09-14T08:51:41.370Z
対象: http://localhost:3001（Production Build上の隔離ヘッドレスChrome確認。ブラウザー側Supabaseクライアント(auth・DBとも)はテストダブルへ差し替え、実Supabaseへは接続しない）

実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。RLS自体の分離証明は実Supabase上のSQL監査・手動検証で別途行う。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | [未認証] クラッシュせず表示される |  |
| PASS | [未認証] ログイン必須の案内が表示される |  |
| PASS | [未認証] ログイン導線がある |  |
| PASS | [未認証] クラウド操作ボタンを表示しない |  |
| PASS | [未認証] ローカルMy Teamは変更されない |  |
| PASS | [未認証] 内部UUIDを表示しない |  |
| PASS | [未認証] Secret key/service_role等を表示しない |  |
| PASS | [未認証] ブラウザー共通データである旨が表示される |  |
| PASS | [未認証] My Builds等が未同期である旨が表示される |  |
| PASS | [認証済み/初期] ログインだけでは自動送信されない旨が表示される |  |
| PASS | [認証済み/初期] クラウド保存は任意である旨が表示される |  |
| PASS | [認証済み/初期] ローカル件数0が表示される |  |
| PASS | [認証済み/初期] クラウドデータなしと表示される |  |
| PASS | [認証済み/初期] ブラウザー共通データである旨が表示される |  |
| PASS | [認証済み/初期] My Builds等が未同期である旨が表示される |  |
| PASS | [保存確認/空] 保存前の確認画面が表示される |  |
| PASS | [保存確認/空] 保存対象件数が表示される |  |
| PASS | [保存確認/空] 空のMy Teamを保存する警告が表示される |  |
| PASS | [保存確認/空] ローカルは削除されない旨が表示される |  |
| PASS | [保存キャンセル] キャンセル後もクラウドデータなしのまま |  |
| PASS | [ローカル2件] ローカル件数2が表示される |  |
| PASS | [保存確認/2件] 保存対象件数2が表示される |  |
| PASS | [保存確認/2件] お気に入り等は含まれない旨が表示される |  |
| PASS | [保存/2件] 保存成功メッセージが表示される |  |
| PASS | [保存/2件] クラウド件数2が表示される |  |
| PASS | [保存/2件] 保存成功後もローカルデータは変更されない |  |
| PASS | [プレビュー/一致] 追加候補なしメッセージが表示される |  |
| PASS | [プレビュー/一致] 反映ボタンは表示されない |  |
| PASS | [再保存確認] 既存データの上書き警告が表示される |  |
| PASS | [直接注入] クラウドのみのカードを注入できる(検証用) | {"data":[{"id":"efb-test-mt-row-1","schema_version":"my-team-cloud/2026-09-12.v1","team_data":{"items":[{"worldCardId":"10001","ownershipStatus":"owned","usageStatus":"main","selectedBuildId":null,"favoriteBuildId":null,"note":"","tags":[],"addedAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"},{"worldCardId":"10002","ownershipStatus":"owned","usageStatus":"main","selectedBuildId":null,"favoriteBuildId":null,"note":"","tags":[],"addedAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"},{"worldCardId":"99999","ownershipStatus":"owned","usageStatus":"main","selectedBuildId":null,"favoriteBuildId":null,"note":"","tags":[],"addedAt":"2026-09-05T00:00:00.000Z","updatedAt":"2026-09-05T00:00:00.000Z"}]},"item_count":3,"payload_hash":"0000000000000000000000000000000000000000000000000000000000000000","client_updated_at":"2026-09-14T08:51:33.469Z","created_at":"2026-09-14T08:51:33.285Z","updated_at":"2026-09-14T08:51:33.469Z"}],"error":null} |
| PASS | [プレビュー/差分] クラウドのみカードが検出され反映ボタンが表示される |  |
| PASS | [プレビュー/差分] 確認しただけではローカル未変更の旨が表示される |  |
| PASS | [プレビュー/差分] プレビュー表示だけではローカルが変化しない |  |
| PASS | [反映確認] 反映前の確認画面が表示される |  |
| PASS | [反映確認] 追加件数が案内される |  |
| PASS | [反映/実行] クラウド専用カードがローカルへ追加される |  |
| PASS | [反映/実行] 既存のローカルレコード(10001/10002)は変更されない |  |
| PASS | [反映/実行] 反映成功メッセージが表示される |  |
| PASS | [削除確認] 削除前の確認画面が表示される |  |
| PASS | [削除確認] ローカルは削除されない旨が表示される |  |
| PASS | [削除/実行] 削除成功メッセージが表示される |  |
| PASS | [削除/実行] クラウドデータなし表示に戻る |  |
| PASS | [削除/実行] クラウド削除後もローカルMy Team(3件)は保持される |  |
| PASS | [異常系] 存在しないIDへの削除は0件になる(成功として誤扱いしない) | {"data":[],"error":null} |
| PASS | [異常系] 複数行検知時もクラッシュしない |  |
| PASS | [異常系] 複数行検知時に安全なエラー文言が表示される |  |
| PASS | [二重送信防止] 保存処理中はボタンが無効化される | disabled=true |
| PASS | [由来/MATCH] 一致時は別アカウント警告バナーが表示されない |  |
| PASS | [由来/MATCH] 一致時は由来確認チェックボックス自体が表示されない |  |
| PASS | [由来/MATCH] 一致時は保存ボタンが最初から有効 | disabled=false |
| PASS | [由来/UNKNOWN] 初回利用相当の穏やかな注記が表示される |  |
| PASS | [由来/UNKNOWN] 強い警告(別アカウント文言)は表示されない |  |
| PASS | [由来/UNKNOWN] 保存確認でも由来確認チェックボックスが表示される |  |
| PASS | [由来/UNKNOWN] チェック前は保存ボタンが無効化される | disabled=true |
| PASS | [由来/UNKNOWN] disabledなボタンを直接.click()しても保存処理は実行されない(書込み試行0回) | before=0 after=0 |
| PASS | [由来/UNKNOWN] 直接クリック後もクラウド保存済み表示にならない |  |
| PASS | [由来/UNKNOWN] disabledなボタンへEnterキーを送っても保存処理は実行されない | focused=false calls=0 |
| PASS | [由来/UNKNOWN] disabledなボタンへSpaceキーを送っても保存処理は実行されない | focused=false calls=0 |
| PASS | [由来/UNKNOWN] キーボード操作後もクラウド保存済み表示にならない |  |
| PASS | [由来/UNKNOWN] チェック操作自体は反映される(前提確認) |  |
| PASS | [由来/再表示] ダイアログを閉じて再度開くとチェックはfalseへ戻る |  |
| PASS | [由来/再表示] 再表示時は保存ボタンが再び無効化される | disabled=true |
| PASS | [由来/旧形式] 旧形式の値はMATCHとして扱われない(強い警告は出ないが穏やかな注記が出る) |  |
| PASS | [由来/旧形式] 旧形式の値だけでは保存ボタンが有効化されない(自動保存の根拠にしない) | disabled=true |
| PASS | [由来/MISMATCH] 別アカウント由来の可能性がある警告バナーが表示される |  |
| PASS | [由来/MISMATCH] 保存確認画面に由来不明の警告が表示される |  |
| PASS | [由来/MISMATCH] 由来確認チェックボックスが表示される |  |
| PASS | [由来/MISMATCH] チェック前は保存ボタンが無効化される(誤保存防止) | disabled=true |
| PASS | [由来/MISMATCH] 未チェックでは保存が実行されない |  |
| PASS | [由来/MISMATCH] チェック後は保存ボタンが有効になる | disabled=false |
| PASS | [由来/MISMATCH確認後] 明示チェック後は保存できる |  |
| PASS | [由来/MISMATCH確認後] 保存操作自体はローカルデータを変更しない |  |
| PASS | [由来/更新後] 保存成功後は目印が更新され、以後は警告が出ない |  |
| PASS | [セッション] ログアウト後はログイン要求表示に戻る |  |
| PASS | [セッション] ログアウトしてもローカルMy Teamは維持される |  |
| PASS | [英語] 画面が英語表示される |  |
| PASS | [英語] 日本語固定文が残らない |  |
| PASS | [i18n] 未置換の変数プレースホルダーが残っていない |  |
| PASS | [セキュリティ] Secret key/service_role等の実値が混入していない |  |
| PASS | [セキュリティ] 実際のメールアドレス形式の値を表示しない |  |
| PASS | [セキュリティ] 内部UUID/レコードIDを表示しない |  |
| PASS | [セキュリティ] javascript:/data:スキームのリンクが存在しない |  |
| PASS | [セキュリティ] 新規の外部通信が発生していない(実Supabaseを含む) |  |
| PASS | [レスポンシブ1280px] 横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ390px] 横スクロールが発生しない | overflow=0 |
| PASS | [スモーク回帰] / が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /players が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /my-team が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /my-builds が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /build-inventory が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /best-xi が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /squads が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /favorites が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /account が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /account/rls-test が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /auth/sign-in が引き続き200 | HTTP 200 |
| PASS | ページ内でJS例外が発生していない(全シナリオ通算) |  |
| PASS | コンソールエラーが発生していない(全シナリオ通算) |  |

## 判定: 全項目 PASS

