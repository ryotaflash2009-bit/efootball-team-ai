# World データ UI 接続 ブラックボックステスト結果

実行日時: 2026-09-24T11:07:46.032Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: 0 回

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | 一覧API: HTTP 200 | HTTP 200 |
| PASS | 一覧API: 総件数がおよそ 13,009 | totalCount=13009 |
| PASS | 一覧API: 1ページ 24 件前後 | players=24 |
| PASS | 一覧API: totalPages 計算 | totalPages=543 |
| PASS | 一覧API: source=eFootball World | eFootball World |
| PASS | 一覧API: 要素は必須フィールドを持つ |  |
| PASS | 一覧API: 26能力値やスキルを含めない（軽量） |  |
| PASS | 一覧API: 内部情報/パス/SQLを含まない |  |
| PASS | ページ2へ移動できる | page=2 |
| PASS | 最終ページを表示できる | page=543/543 |
| PASS | 範囲外ページはクラッシュせず最終ページへ丸める | page=543 |
| PASS | 不正な page/pageSize でも 200（既定へ丸め） | page=1 size=24 |
| PASS | pageSize 上限 100 に丸める | pageSize=100 |
| PASS | 日本語名検索 | total=44 |
| PASS | 英語名検索（部分一致） | total=44 |
| PASS | 英語検索は大文字小文字を無視 | 44 vs 44 |
| PASS | World ID 検索で 1 件 | total=1 |
| PASS | 存在しない検索は 0 件（200） | total=0 |
| PASS | 空検索は全件 | total=13009 |
| PASS | 記号入力でクラッシュしない | HTTP 200 |
| PASS | 非常に長い入力を制限（クラッシュしない） | HTTP 200 |
| PASS | SQLインジェクション風入力でテーブルが無事 | HTTP 400 after=13009 |
| PASS | フィルター: GK | total=962 |
| PASS | フィルター: CB | total=1919 |
| PASS | フィルター: CMF | total=1456 |
| PASS | フィルター: AMF | total=1281 |
| PASS | フィルター: CF | total=2175 |
| PASS | フィルター: カードタイプ EPIC | total=867 |
| PASS | フィルター: 攻撃プレースタイル | total=1105 |
| PASS | フィルター: 複数条件の組み合わせ | total=208 |
| PASS | フィルター解除で全件へ戻る | total=13009 |
| PASS | 並べ替え: 最大OVR降順 |  |
| PASS | 並べ替え: 最大OVR昇順 |  |
| PASS | 並べ替え: 基礎OVR降順 |  |
| PASS | 並べ替え: 名前順 |  |
| PASS | 並べ替え: 更新順 | HTTP 200 |
| PASS | 不正な sort 値は既定へ（クラッシュしない） | HTTP 200 |
| PASS | 詳細API: 正常な World ID | HTTP 200 |
| PASS | 詳細API: 26 能力値 | stats=26 |
| PASS | 詳細API: 能力値キーが26種のみ |  |
| PASS | 詳細API: 選手スキル配列 | skills=10 |
| PASS | 詳細API: AIスキル配列 | ai=5 |
| PASS | 詳細API: 基本情報（国籍/リーグ/チーム/身長/体重/年齢/利き足） |  |
| PASS | 詳細API: 最大レベル | maxLv=32 |
| PASS | 詳細API: スキルは重複なし |  |
| PASS | 詳細API: 存在しない World ID は 404 | HTTP 404 |
| PASS | 詳細API: 不正な World ID は 400 | HTTP 400 |
| PASS | 詳細API: SQL風 ID でクラッシュしない | HTTP 400 |
| PASS | 詳細API: エラー本文に内部情報を含まない |  |
| PASS | 画面: /players が 200 | HTTP 200 |
| PASS | 画面: World 総件数を表示 |  |
| PASS | 画面: 詳細リンクが /players/world/ 形式 |  |
| PASS | 画面: ページネーション表示（件を表示） |  |
| PASS | 画面: データソース表示（eFootball World） |  |
| PASS | 画面: World 選手詳細が 200 | HTTP 200 |
| PASS | 画面: 詳細に「能力値（26 項目」表示 |  |
| PASS | 画面: 詳細に「Player Skills」「AI Playing Styles」 |  |
| PASS | 画面: 未取得項目を「追加調査中」表示 |  |
| PASS | 画面: 未取得項目を 0/空で偽装しない（Tier: 追加調査中） |  |
| PASS | 画面: 詳細に 26 能力値の内容が描画される（有効IDのみ） |  |
| PASS | 画面: 不正 World ID の詳細はクラッシュせず not-found（詳細本文を描画しない） | HTTP 200 |
| PASS | 画面: 存在しない World ID の詳細はクラッシュせず not-found | HTTP 200 |
| PASS | 画像: eFHUB リンクなし World カードに World 画像プロキシ src が配線（NO_EXTERNAL） |  |
| PASS | 画像: 取得不可時はローカル SVG プレースホルダー（外部アクセス0） | 200 placeholder=true |
| PASS | 画像: 不正な World ID は 400（外部アクセス0） | HTTP 400 |
| PASS | 画像: 検索後も World 画像プロキシ src が配線されている |  |
| PASS | 画像: 並べ替え後も画像 src が配線されている |  |
| PASS | 画像: ページ移動後も画像 src が配線されている |  |
| PASS | 画像: 一覧 HTML は loading="lazy" を使う（プリロードしない） |  |
| PASS | 画像: 一覧カードレイアウトが崩れない（aspect-[3/4] 枠 + OVR/名前を保持） |  |
| PASS | 回帰: ホーム 200 | HTTP 200 |
| PASS | 回帰: ホームにサイドメニュー |  |
| PASS | 回帰: 旧サンプル詳細（ローカルサンプルあり）: 旧APIと同じ選手を表示 #1 | HTTP 200 |
| PASS | 回帰: 旧サンプル詳細（ローカルサンプルあり）: 旧APIと同じ選手を表示 #2 | HTTP 200 |
| PASS | 回帰: 旧 /api/players（サンプル）維持 | HTTP 200 |
| PASS | 回帰: 画像プロキシの不正IDは 400 | HTTP 400 |
| PASS | 回帰: ブラウザへ渡す src は同一オリジンのみ（cloudfront URL を露出しない） |  |
| PASS | 画像取得の外部 GET が 0（NO_EXTERNAL モード） | external=0 |

## 判定: 全項目 PASS

