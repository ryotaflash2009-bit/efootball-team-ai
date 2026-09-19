# 招待制アルファ表示修正 ブラックボックステスト結果

実行日時: 2026-09-19T01:29:20.311Z
対象: http://localhost:3001（Production Build上の隔離ヘッドレスChrome確認。Supabase Authはテストダブルへ差し替え、実Supabaseへは接続しない）

実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | [共通] / がHTTP 200 | status=200 |
| PASS | [共通] / は1280px幅で横スクロールが発生しない | overflow=-10 |
| PASS | [共通] / は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /managers がHTTP 200 | status=200 |
| PASS | [共通] /managers は1280px幅で横スクロールが発生しない | overflow=-10 |
| PASS | [共通] /managers は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /my-team がHTTP 200 | status=200 |
| PASS | [共通] /my-team は1280px幅で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /my-team は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /account がHTTP 200 | status=200 |
| PASS | [共通] /account は1280px幅で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /account は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /privacy がHTTP 200 | status=200 |
| PASS | [共通] /privacy は1280px幅で横スクロールが発生しない | overflow=-10 |
| PASS | [共通] /privacy は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /terms がHTTP 200 | status=200 |
| PASS | [共通] /terms は1280px幅で横スクロールが発生しない | overflow=-10 |
| PASS | [共通] /terms は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [共通] /support がHTTP 200 | status=200 |
| PASS | [共通] /support は1280px幅で横スクロールが発生しない | overflow=-10 |
| PASS | [共通] /support は390x844で横スクロールが発生しない | overflow=0 |
| PASS | [トップ] SQLiteという語が表示されない |  |
| PASS | [トップ] 13,009件相当の件数表記が維持されている(数字が表示される) |  |
| PASS | [マネージャー一覧] data/managers.jsonという内部パスが表示されない |  |
| PASS | [マネージャー一覧] GitHubという語が本文に露出しない |  |
| PASS | [マネージャー詳細] raw.githubusercontent.comが本文テキストに露出しない |  |
| PASS | [マネージャー詳細] 出典リンク(生URLはhref属性のみ、target=_blank+rel=noopener) |  |
| PASS | [マネージャー詳細] 「出典を開く」リンクの文言がある |  |
| PASS | [My Team] 「サーバーへの保存には未対応」という古い断定が表示されない |  |
| PASS | [アカウント] 未ログイン時はログイン必須の案内が表示される |  |
| PASS | [英語] トップページが英語表示される |  |
| PASS | [英語] SQLiteという語が表示されない |  |
| PASS | [セキュリティ] コンソールエラーが発生していない(全シナリオ通算) |  |
| PASS | [セキュリティ] 実Supabaseを含む新規の外部通信が発生していない |  |

## 判定: 34/34 PASS
