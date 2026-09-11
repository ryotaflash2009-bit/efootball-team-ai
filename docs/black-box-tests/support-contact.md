# 問い合わせ窓口(公開専用メールアドレス)有効化 ブラックボックステスト結果

実行日時: 2026-09-11T12:12:14.237Z
対象: http://localhost:3000（Production Build上の隔離ヘッドレスChrome確認。実機ではない）

実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | [日本語] 一般問い合わせの案内が表示される |  |
| PASS | [日本語] 不具合報告の案内が表示される |  |
| PASS | [日本語] 権利者からの連絡の案内が表示される |  |
| PASS | [日本語] プライバシー問い合わせの案内が表示される |  |
| PASS | [日本語] 正しいメールアドレスが表示される |  |
| PASS | [日本語] 準備中表示が消えている |  |
| PASS | [日本語] mailtoリンクが正しい宛先を持つ | ["mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E4%B8%80%E8%88%AC%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E4%B8%8D%E5%85%B7%E5%90%88%E5%A0%B1%E5%91%8A","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E6%A8%A9%E5%88%A9%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E9%80%A3%E7%B5%A1","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"] |
| PASS | [日本語] 本名・住所・電話番号が表示されない |  |
| PASS | [日本語] 未置換変数・架空メールが表示されない |  |
| PASS | [英語] すべての問い合わせ用途が表示される |  |
| PASS | [英語] 日本語固定文が残らない |  |
| PASS | [英語] メールアドレスは日本語版と同一 |  |
| PASS | [英語] mailtoリンクの宛先は日本語版と同一 | ["mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20General%20Inquiry","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20Bug%20Report","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20Rights-Related%20Contact","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20Privacy%20Inquiry"] |
| PASS | [関係ページ] /termsは問い合わせ先を断定せず「問い合わせ」ページへ誘導する |  |
| PASS | [関係ページ] /termsに架空の準拠法・裁判管轄を追加していない |  |
| PASS | [関係ページ] /privacyの内容が現行実装と矛盾しない(ブラウザー内保存の明示) |  |
| PASS | [関係ページ] /disclaimerに権利者向け連絡導線(「問い合わせ」ページへのリンク)がある |  |
| PASS | [関係ページ] /disclaimerから/supportへのリンクが実在する |  |
| PASS | [関係ページ] /release-readinessで問い合わせ窓口項目が完了として表示される |  |
| PASS | [関係ページ] 認証・同期・課金は完了扱いになっていない |  |
| PASS | [関係ページ] 一般ベータ公開可能・正式公開可能と誤表示していない |  |
| PASS | [関係ページ] フッターに問い合わせ用メールアドレスを直接露出していない(/supportへの導線のみ) |  |
| PASS | [セキュリティ] javascript:スキームのリンクが存在しない |  |
| PASS | [セキュリティ] data:スキームのリンクが存在しない |  |
| PASS | [セキュリティ] mailtoリンクは正しいスキームのみ |  |
| PASS | [セキュリティ] コンソールへ問い合わせ関連情報が出力されていない |  |
| PASS | [セキュリティ] 新規の外部API通信が発生していない |  |
| PASS | [レスポンシブ1280px] /supportで横スクロールが発生しない | overflow=-10 |
| PASS | [レスポンシブ1280px] フッターのリンクが操作可能 |  |
| PASS | [レスポンシブ390px] /supportで横スクロールが発生しない | overflow=0 |
| PASS | [レスポンシブ390px] フッターのリンクが操作可能 |  |
| PASS | [スモーク回帰] /players が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /my-team が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /my-builds が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /build-inventory が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /best-xi が引き続き200 | HTTP 200 |
| PASS | [スモーク回帰] /squads が引き続き200 | HTTP 200 |
| PASS | ページ内でJS例外が発生していない(全シナリオ通算) |  |
| PASS | コンソールエラーが発生していない(全シナリオ通算) |  |

## 判定: 全項目 PASS

