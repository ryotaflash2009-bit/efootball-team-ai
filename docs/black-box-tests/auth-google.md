# Google OAuth の準備 ブラックボックステスト結果

実行日時: 2026-10-10T14:53:45.096Z
対象: http://localhost:3000（Production Build 上の隔離ヘッドレス Chrome・認証のテストダブル。実 Supabase・Google へは接続しない）

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | [既定・無効] Google のボタンを出さない |  |
| PASS | [既定・無効] パスワードの再設定の導線は従来どおり |  |
| PASS | [プレビュー] Google のボタン「Google で続ける」を出す |  |
| PASS | [プレビュー] パスワードの再設定の導線を出さない（パスワードでのログインを一般に提供しないため） |  |
| PASS | [プレビュー] メール＋パスワードは以前のアカウント用と示す |  |
| PASS | [プレビュー] ゲストのまま使える・自動では統合しない旨 |  |
| PASS | [プレビュー] signInWithOAuth は provider google・redirect 方式（popup の指定なし） | "google" |
| PASS | [プレビュー] redirectTo は自サイトの /auth/callback?flow=google&next=%2Fsquads | http://localhost:3000/auth/callback?flow=google&next=%2Fsquads |
| PASS | [プレビュー] 毎回アカウントを選ばせる（prompt=select_account） |  |
| PASS | [プレビュー] 開始の失敗は一般化した文で表示（生の文なし） |  |
| PASS | [ja] Google の画面でキャンセル → ログイン画面に案内（生の文なし） |  |
| PASS | [ja] Google の失敗 → ログイン画面に案内 |  |
| PASS | [en] Google の画面でキャンセル → ログイン画面に案内（生の文なし） |  |
| PASS | [en] Google の失敗 → ログイン画面に案内 |  |
| PASS | [プレビュー] 新規登録は Google だけ（メールとパスワードの入力欄なし・確認メールなし） |  |
| PASS | [既定・無効] 新規登録は従来どおり「限定テスト中」 |  |
| PASS | [390px] Google のボタンを表示・横のはみ出しなし | overflow=0 |
| PASS | [引き継ぎ] ログイン中のアカウントの画面にゲストのデータの件数と導線（自動ではコピーしない） |  |
| PASS | [引き継ぎ] ?source=guest でゲストのデータを選んだ状態で開く |  |
| PASS | [引き継ぎ] 開いただけではアカウントの領域へコピーしない | keys=0 |
| PASS | [引き継ぎ] プレビューで追加の件数を表示 |  |
| PASS | [引き継ぎ] ゲストのデータは変わらない |  |
| PASS | ページ内で JS の例外が起きない |  |

## 判定: 全項目 PASS

