# 公開準備基盤フェーズ ブラックボックステスト結果

実行日時: 2026-09-12T07:50:14.433Z
対象: http://localhost:3000（Production Build上の隔離ヘッドレスChrome確認。実機ではない）

実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない(隔離プロファイルのlocalStorageのみ操作)。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | [シナリオ1] トップページにフッターリンクが表示される | links=7 |
| PASS | [シナリオ1] /about が正しいタイトルで表示される | title="サービス概要 \| eFootball Team AI" |
| PASS | [シナリオ1] /about のh1は1つ | count=1 |
| PASS | [シナリオ1] /about のh1が期待通り | h1="サービス概要" |
| PASS | [シナリオ1] /about に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /about に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] /terms が正しいタイトルで表示される | title="利用規約(草案) \| eFootball Team AI" |
| PASS | [シナリオ1] /terms のh1は1つ | count=1 |
| PASS | [シナリオ1] /terms のh1が期待通り | h1="利用規約(草案)" |
| PASS | [シナリオ1] /terms に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /terms に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] /privacy が正しいタイトルで表示される | title="プライバシーポリシー(草案) \| eFootball Team AI" |
| PASS | [シナリオ1] /privacy のh1は1つ | count=1 |
| PASS | [シナリオ1] /privacy のh1が期待通り | h1="プライバシーポリシー(草案)" |
| PASS | [シナリオ1] /privacy に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /privacy に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] /disclaimer が正しいタイトルで表示される | title="免責事項 \| eFootball Team AI" |
| PASS | [シナリオ1] /disclaimer のh1は1つ | count=1 |
| PASS | [シナリオ1] /disclaimer のh1が期待通り | h1="免責事項" |
| PASS | [シナリオ1] /disclaimer に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /disclaimer に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] /data-management が正しいタイトルで表示される | title="データ管理 \| eFootball Team AI" |
| PASS | [シナリオ1] /data-management のh1は1つ | count=1 |
| PASS | [シナリオ1] /data-management のh1が期待通り | h1="データ管理" |
| PASS | [シナリオ1] /data-management に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /data-management に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] /support が正しいタイトルで表示される | title="問い合わせ \| eFootball Team AI" |
| PASS | [シナリオ1] /support のh1は1つ | count=1 |
| PASS | [シナリオ1] /support のh1が期待通り | h1="問い合わせ" |
| PASS | [シナリオ1] /support に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /support に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] /release-readiness が正しいタイトルで表示される | title="公開準備状況 \| eFootball Team AI" |
| PASS | [シナリオ1] /release-readiness のh1は1つ | count=1 |
| PASS | [シナリオ1] /release-readiness のh1が期待通り | h1="公開準備状況" |
| PASS | [シナリオ1] /release-readiness に内部ID・内部情報が露出しない |  |
| PASS | [シナリオ1] /release-readiness に未置換変数・ダミー値が露出しない |  |
| PASS | [シナリオ1] ブラウザーの「戻る」で前のページに戻れる |  |
| PASS | [シナリオ2] AIベスト11の説明が「ルールベース」であることを明示 |  |
| PASS | [シナリオ2] 生成AI不使用の明示 |  |
| PASS | [シナリオ2] 外部AIへ送信しないことの明示 |  |
| PASS | [シナリオ2] 公式サービスではないことの明示 |  |
| PASS | [シナリオ2] 勝率保証をしないことの明示 |  |
| PASS | [シナリオ2] 未提供機能(アカウント・同期・課金等)が「未提供」として明示される |  |
| PASS | [シナリオ2] 未提供機能が「利用可能な機能」欄には含まれない |  |
| PASS | [シナリオ3] ブラウザー内保存(localStorage)の明示 |  |
| PASS | [シナリオ3] 端末間同期なしの明示 |  |
| PASS | [シナリオ3] クラウドバックアップなしの明示 |  |
| PASS | [シナリオ3] データ削除リスクの明示 |  |
| PASS | [シナリオ3] アクセス解析を使用していないことの明示 |  |
| PASS | [シナリオ3] 広告を表示していないことの明示 |  |
| PASS | [シナリオ3] 決済情報を保存しないことの明示 |  |
| PASS | [シナリオ3] Cookie不使用の明示 |  |
| PASS | [シナリオ4] JSONバックアップの説明がある |  |
| PASS | [シナリオ4] My Buildsへの導線がある(既存のJSONエクスポート・インポート機能) |  |
| PASS | [シナリオ5] 削除前に削除対象が事前表示される |  |
| PASS | [シナリオ5] 削除開始ボタンをクリックすると第一確認(確認ダイアログ)が表示される |  |
| PASS | [シナリオ5] 第一確認の見出しが表示される |  |
| PASS | [シナリオ5] キャンセルできる |  |
| PASS | [シナリオ5] キャンセル後もデータは変更されない |  |
| PASS | [シナリオ5] 第二確認(「削除する」)をクリックできる |  |
| PASS | [シナリオ5] 削除成功メッセージが表示される |  |
| PASS | [シナリオ5] My Teamが削除される |  |
| PASS | [シナリオ5] Favoritesが削除される |  |
| PASS | [シナリオ5] 保存スカッドが削除される |  |
| PASS | [シナリオ5] 表示言語設定(対象外キー)は削除されない |  |
| PASS | [シナリオ5] 再読み込み後も削除済みのまま(「削除できるデータはありません」表示) |  |
| PASS | [シナリオ6] 設定済みの公開専用メールアドレスが表示される |  |
| PASS | [シナリオ6] 「suport」の綴りが「support」へ自動修正されていない |  |
| PASS | [シナリオ6] 「公開前準備中」の旧表示が通常状態では出ない |  |
| PASS | [シナリオ6] 共通窓口である旨の案内が表示される |  |
| PASS | [シナリオ6] 架空のメールアドレスが表示されない |  |
| PASS | [シナリオ6] 未置換変数が表示されない |  |
| PASS | [シナリオ6] 本名・住所・電話番号等の個人情報が表示されない |  |
| PASS | [シナリオ6] mailtoリンクが少なくとも1つ表示される | count=4 |
| PASS | [シナリオ6] すべてのmailtoリンクの宛先が設定済みメールアドレスと一致する | ["mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E4%B8%80%E8%88%AC%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E4%B8%8D%E5%85%B7%E5%90%88%E5%A0%B1%E5%91%8A","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E6%A8%A9%E5%88%A9%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E9%80%A3%E7%B5%A1","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"] |
| PASS | [シナリオ6] 一般問い合わせ・不具合報告・権利者連絡・プライバシー問い合わせで用途別の件名(subject)が設定されている | ["mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E4%B8%80%E8%88%AC%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E4%B8%8D%E5%85%B7%E5%90%88%E5%A0%B1%E5%91%8A","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E6%A8%A9%E5%88%A9%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E9%80%A3%E7%B5%A1","mailto:efootballteamAIsuportteam@outlook.jp?subject=eFootball%20Team%20AI%20%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"] |
| PASS | [シナリオ6] 問い合わせ時の注意(パスワード等を送らない)が表示される |  |
| PASS | [シナリオ8] フッターに非公式サービス表記がある |  |
| PASS | [シナリオ8] 免責事項ページに非公式サービス表記がある |  |
| PASS | [シナリオ8] 「公式AI」「公認ツール」等の誇大・誤認表現を含まない |  |
| PASS | [シナリオ9] 認証は未着手として表示される |  |
| PASS | [シナリオ9] 決済・課金は未実装として表示される |  |
| PASS | [シナリオ9] 問い合わせ窓口の項目が完了として表示される |  |
| PASS | [シナリオ9] 問い合わせ窓口が設定済みでも、認証・同期・課金等の他のブロッカーは完了扱いにならない |  |
| PASS | [シナリオ9] 内部PID・テスト件数・SQLiteテーブル名等の開発者向け情報が表示されない |  |
| PASS | [シナリオ9] 生成AI不使用が明示される |  |
| PASS | [シナリオ10] /about が英語表示に切り替わる |  |
| PASS | [シナリオ10] /about (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ10] /terms が英語表示に切り替わる |  |
| PASS | [シナリオ10] /terms (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ10] /privacy が英語表示に切り替わる |  |
| PASS | [シナリオ10] /privacy (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ10] /disclaimer が英語表示に切り替わる |  |
| PASS | [シナリオ10] /disclaimer (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ10] /data-management が英語表示に切り替わる |  |
| PASS | [シナリオ10] /data-management (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ10] /support が英語表示に切り替わる |  |
| PASS | [シナリオ10] /support (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ10] /release-readiness が英語表示に切り替わる |  |
| PASS | [シナリオ10] /release-readiness (英語)に未置換辞書キー・変数が露出しない |  |
| PASS | [シナリオ11] /about は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ11] /terms は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ11] /privacy は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ11] /disclaimer は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ11] /data-management は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ11] /support は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ11] /release-readiness は390px幅で横スクロールが発生しない | overflow=0 |
| PASS | [シナリオ12] トップページが引き続き正常に表示される |  |
| PASS | [シナリオ12] 既存ページ /players が引き続き200 | HTTP 200 |
| PASS | [シナリオ12] 既存ページ /my-team が引き続き200 | HTTP 200 |
| PASS | [シナリオ12] 既存ページ /my-builds が引き続き200 | HTTP 200 |
| PASS | [シナリオ12] 既存ページ /squads が引き続き200 | HTTP 200 |
| PASS | [シナリオ12] 既存ページ /best-xi が引き続き200 | HTTP 200 |
| PASS | [共通] 外部通信が発生していない |  |
| PASS | [共通] ページ内でJS例外が発生していない(全シナリオ通算) |  |
| PASS | [共通] コンソールエラーが発生していない(全シナリオ通算) |  |

## 判定: 全項目 PASS

