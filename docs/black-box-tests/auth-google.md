# Google OAuth の準備 ブラックボックステスト結果

実行日時: 2026-10-10T15:36:28.668Z
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
| PASS | [引き継ぎ] 実行するとアカウントの領域へ追加・ゲストのデータは残る | keys=1 |
| PASS | [引き継ぎ] 同じ ID で内容が違う記録は「競合」として数える |  |
| PASS | [引き継ぎ] 競合はアカウントの側を上書きしない |  |
| PASS | [アプリ内 iosLine] 案内を出し、Google のボタンは残す（遮断しない） |  |
| PASS | [アプリ内 iosLine] LINE は openExternalBrowser=1・認証のエラー等の値を含めない | http://localhost:3000/auth/sign-in?next=%2Fsquads&openExternalBrowser=1 |
| PASS | [アプリ内 iosLine] 390px で横のはみ出しなし | overflow=0 |
| PASS | [アプリ内 androidX] 案内を出し、Google のボタンは残す（遮断しない） |  |
| PASS | [アプリ内 androidX] Android は Chrome の intent・Android の手順 | intent://localhost:3000/auth/sign-in?next=%2Fsquads#Intent;s |
| PASS | [アプリ内 androidX] 390px で横のはみ出しなし | overflow=0 |
| PASS | [アプリ内 iosX] 案内を出し、Google のボタンは残す（遮断しない） |  |
| PASS | [アプリ内 iosX] iPhone では「Chrome で開く」を出さない・Safari の手順とコピー |  |
| PASS | [アプリ内 iosX] 390px で横のはみ出しなし | overflow=0 |
| PASS | [アプリ内] 通常の Safari では案内を出さない |  |
| PASS | [失敗の後] 通常のブラウザーでも開き直しの案内を出す |  |
| PASS | [緊急停止] Provider が無効なら Google へ移らず「一時的に停止」の案内 |  |
| PASS | [削除] アカウントの画面に削除の入口と、運営への連絡の案内 |  |
| PASS | [削除・無効] 削除されるもの・されないもの・再登録の扱い・手動の削除（サポート）の案内だけ（実行の欄なし） |  |
| PASS | [削除] 最初はボタンを押せない（1 クリックで消さない） |  |
| PASS | [削除] 確認のチェックだけでは押せない |  |
| PASS | [削除] 確認の語が違えば押せない |  |
| PASS | [削除] チェックと確認の語がそろうと押せる |  |
| PASS | [削除] 最近の認証が無ければ再認証を求める |  |
| PASS | [削除] 関数が無い・障害は「何も削除されていません」と案内（生の文なし） |  |
| PASS | [削除] 成功: 完了を表示・関数は DELETE で 1 回だけ（二重の押下でも 1 回） | calls=1 |
| PASS | [削除] 成功: この端末のゲストのデータは残す |  |
| PASS | ページ内で JS の例外が起きない |  |

## 判定: 全項目 PASS

