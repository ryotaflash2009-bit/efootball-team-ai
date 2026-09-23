# 監督機能 ブラックボックステスト結果

実行日時: 2026-09-23T13:17:15.349Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | 監督一覧API: HTTP 200 | HTTP 200 |
| PASS | 監督一覧API: 総数 > 0 | total=66 |
| PASS | 監督一覧API: source = amine250 | amine250/efootball-managers |
| PASS | 監督一覧API: 各行に戦術適性6項目 |  |
| PASS | 監督一覧API: 内部情報/SQLを含まない |  |
| PASS | 検索: Antonio Conte が見つかる | total=1 |
| PASS | 検索: 大文字小文字を無視 |  |
| FAIL | 検索: SQLインジェクション風でもテーブルが無事 | after=66 |
| PASS | フィルタ: ブースターあり | total=64 |
| PASS | フィルタ: Link-Up Play あり | total=25 |
| PASS | 同名別カード: Guardiola が複数・全部別 ID | total=2 |
| PASS | 詳細API: 正常な ID → 200 | HTTP 200 |
| PASS | 詳細API: Conte のブースター = Defensive Awareness +1 / Kicking Power +1 |  |
| PASS | 詳細API: ブースターは confirmed・statKey あり |  |
| PASS | 詳細API: Link-Up Play の Center Piece / Key Man 条件 |  |
| PASS | 詳細API: ソース非収録項目は null（age/国籍/チーム等） |  |
| PASS | 詳細API: 不正 ID → 400 | HTTP 400 |
| PASS | 詳細API: 存在しない ID → 404 | HTTP 404 |
| PASS | 詳細API: エラー本文に内部情報なし |  |
| PASS | 画面: /managers が 200 | HTTP 200 |
| PASS | 画面: 監督総数を表示 |  |
| PASS | 画面: 監督詳細へのリンク（/managers/{id}） |  |
| PASS | 画面: 戦術適性・ブースター要約が一覧に出る |  |
| PASS | 画面: データ提供元の明示（amine250/efootball-managers・内部ファイルパスは非表示） |  |
| PASS | 画面: 監督詳細が 200 | HTTP 200 |
| PASS | 画面: 詳細に「戦術適性」「監督ブースター」「Link-Up Play」 |  |
| PASS | 画面: 詳細に Center Piece / Key Man 条件 |  |
| PASS | 画面: ソース非収録は「追加調査中」表示 |  |
| PASS | 画面: 不正 ID の詳細はクラッシュせず not-found | HTTP 200 |
| PASS | 画面: 存在しない ID の詳細はクラッシュせず not-found | HTTP 200 |
| PASS | サイドメニュー: マネージャーが有効リンク |  |
| PASS | 育成タブ: 監督補正セクション（監督を選択）がある |  |
| PASS | 育成タブ: 監督なし時 managerBoosterDelta=0 の注記 |  |
| PASS | 統合検算: Messi の基礎 Defensive Awareness に Conte の +1 を足すと最終値 | base=44 +1 |
| PASS | 回帰: ホーム 200 + サイドメニュー |  |
| PASS | 回帰: プレイヤー一覧 200 + 総件数 + 詳細リンク |  |
| PASS | 回帰: World 日本語検索 |  |
| PASS | 回帰: World ページネーション |  |
| PASS | 回帰: World 選手詳細 26能力値 + スキル + 育成タブ |  |
| PASS | 回帰: World 画像プロキシ 不正IDは 400（外部アクセスなし） | HTTP 400 |
| PASS | 回帰: 旧 eFHUB サンプル詳細（Messi） | HTTP 200 |

## 判定: 1 件 FAIL

