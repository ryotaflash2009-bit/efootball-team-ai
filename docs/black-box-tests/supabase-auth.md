# Supabase Auth 技術検証(PoC) ブラックボックステスト結果

実行日時: 2026-09-12T03:26:10.972Z
対象: http://localhost:3000（Production Build上の隔離ヘッドレスChrome確認。実Supabaseへは接続していない）

実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。実際のメール送信・実サインアップは行わない。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | [未設定環境] /accountがクラッシュせず表示される |  |
| PASS | [未設定環境] /accountがSecret keyの入力を要求しない |  |
| PASS | [未設定環境] /accountに内部UUID/トークンを表示しない |  |
| PASS | [未設定環境] /auth/sign-upがクラッシュせず表示される |  |
| PASS | [未設定環境] 既存機能 /players が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [未設定環境] 既存機能 /my-team が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [未設定環境] 既存機能 /my-builds が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [未設定環境] 既存機能 /build-inventory が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [未設定環境] 既存機能 /best-xi が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [未設定環境] 既存機能 /squads が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [未設定環境] 既存機能 /favorites が引き続き200(ログイン不要) | HTTP 200 |
| PASS | [サインアップ] タイトルが表示される |  |
| PASS | [サインアップ] メールアドレス・パスワード・パスワード確認の入力欄がある |  |
| PASS | [サインアップ] パスワード要件の案内が表示される |  |
| PASS | [サインアップ] ログインへのリンクがある |  |
| PASS | [サインアップ] パスワード・パスワード確認の2つの入力欄が存在する |  |
| PASS | [サインアップ] 不正なメール形式で安全なエラーが表示される |  |
| PASS | [サインアップ] パスワード不一致で安全なエラーが表示される |  |
| PASS | [サインアップ] パスワードの値そのものは画面に表示されない |  |
| PASS | [ログイン] タイトルが表示される |  |
| PASS | [ログイン] 新規登録へのリンクがある |  |
| PASS | [ログイン] パスワードをお忘れの方へのリンクがある |  |
| PASS | [ログイン] パスワード入力欄がtype=passwordである(値を隠す) |  |
| PASS | [ログイン] コールバック失敗クエリで安全な一般化メッセージが表示される(生のエラー詳細を含まない) |  |
| PASS | [セキュリティ] next=外部URLでも/auth/sign-inが正常表示される(遷移は起きない) |  |
| PASS | [パスワード再設定] タイトルと説明が表示される |  |
| PASS | [パスワード再設定] メールアドレス入力欄が1つだけ |  |
| PASS | [パスワード更新] クラッシュせず表示される |  |
| PASS | [パスワード更新] パスワード要件の案内が表示される |  |
| PASS | [コールバック] codeが無い場合は3xxで内部のsign-inへ遷移する | HTTP 307 |
| PASS | [コールバック] 遷移先が同一オリジンの内部パスである(外部URLではない) | http://localhost:3000/auth/sign-in?authError=missing_code |
| PASS | [コールバック] 遷移先URLにトークン・セッション情報を含まない |  |
| PASS | [セキュリティ] コールバックのnextへ外部URLを渡しても外部へリダイレクトしない | http://localhost:3000/auth/sign-in?authError=not_configured |
| PASS | [アカウント/未設定環境] ログイン中である旨を誤って表示しない |  |
| PASS | [アカウント/未設定環境] 内部UUID・トークンを表示しない |  |
| PASS | [ナビゲーション/未設定環境] Supabase未設定時はヘッダーにログイン導線を表示しない | link=false |
| PASS | [英語] サインアップ画面が英語表示される |  |
| PASS | [英語] 日本語固定文が残らない(サインアップ) |  |
| PASS | [英語] ログイン画面が英語表示される |  |
| PASS | [英語] アカウント画面が英語表示される |  |
| PASS | [i18n] 未置換の変数プレースホルダーが残っていない |  |
| PASS | [セキュリティ] ページソースにSecret key/service_role等の実値が混入していない |  |
| PASS | [セキュリティ] javascript:/data:スキームのリンクが存在しない |  |
| PASS | [セキュリティ] 新規の外部通信が発生していない |  |
| PASS | [レスポンシブ1280px] /auth/sign-upで横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ1280px] /auth/sign-inで横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ1280px] /accountで横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ390px] /auth/sign-upで横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ390px] /auth/sign-inで横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ390px] /accountで横スクロールが発生しない | overflow=0 |
| PASS | [スモーク回帰] / が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /players が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /my-team が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /my-builds が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /build-inventory が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /best-xi が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /squads が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /favorites が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /managers が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /compare が引き続き200 | HTTP 200 |
| PASS | ページ内でJS例外が発生していない(全シナリオ通算) |  |
| PASS | コンソールエラーが発生していない(全シナリオ通算) |  |

## 判定: 全項目 PASS

