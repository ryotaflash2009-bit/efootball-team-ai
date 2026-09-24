# 監督選択UI ブラックボックステスト結果

実行日時: 2026-09-24T11:07:57.987Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | 並べ替え sort=name: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=released_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=released_asc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=possession_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=quick_counter_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=long_ball_counter_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=out_wide_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=long_ball_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=overload_desc: HTTP 200 + 監督が返る | n=67 |
| PASS | 並べ替え sort=possession_desc: 該当適性が降順 |  |
| PASS | 並べ替え sort=quick_counter_desc: 該当適性が降順 |  |
| PASS | 並べ替え sort=long_ball_counter_desc: 該当適性が降順 |  |
| PASS | 並べ替え sort=out_wide_desc: 該当適性が降順 |  |
| PASS | 並べ替え sort=long_ball_desc: 該当適性が降順 |  |
| PASS | 並べ替え sort=overload_desc: 該当適性が降順 |  |
| PASS | 並べ替え released_desc: リリース日が新しい順 |  |
| PASS | フィルタ hasBooster=1: 全件ブースターあり | n=65 |
| PASS | フィルタ hasBooster=0: 全件ブースターなし | n=2 |
| PASS | フィルタ hasLinkUpPlay=1: 全件 Link-Up あり | n=26 |
| PASS | フィルタ合算: あり + なし = 総数 | 65+2 vs 67 |
| PASS | 検索: 補助的な絞り込みとして機能（総数 > 一致件数） | 2/67 |
| PASS | 詳細API: 6戦術適性 + ブースター + Link-Up + リリース + ID を返す |  |
| PASS | 詳細API: ブースターは confirmed のみ statKey 付き（未確認は適用しない前提） |  |
| PASS | 育成: 「監督なし（managerBoosterDelta = 0）」を初期表示 |  |
| PASS | 育成: 「監督一覧から選択」ボタン（検索ボックスではなく一覧が主操作） |  |
| PASS | 育成: 監督なし要約カードは「監督を選ぶと確認済みブースターが対象能力へ適用」と案内 |  |
| PASS | 育成: 監督補正は独立レイヤー（managerBoosterDelta）として能力値比較に列がある |  |
| PASS | 比較: 「監督一覧から選択」ボタンがある |  |
| PASS | 比較: インラインの監督検索入力を撤去（主操作は一覧） |  |
| PASS | 比較: URL の監督指定 (m=) が SSR に反映される | HTTP 200 |
| PASS | スカッド: 監督パネルが 200 で描画（クラッシュしない） | HTTP 200 |
| PASS | スカッド: 監督なし時の案内 or 監督一覧ボタン（ヘッドレス実描画検証） | notfound(ja)=OK / ready(ja)=OK / ready(en)=OK |
| PASS | 回帰: /managers 一覧 200 | HTTP 200 |
| PASS | 回帰: /managers/{id} 詳細 200 | HTTP 200 |
| PASS | 回帰: 監督画像は使わずイニシャルアバターのみ（<img> の監督写真なし） |  |

## 判定: 全項目 PASS

