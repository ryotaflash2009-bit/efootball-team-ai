# お気に入り / My Team 基盤 ブラックボックステスト結果

実行日時: 2026-09-24T11:07:48.003Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

注: お気に入り / My Team は localStorage 保存のため、SSR では「空状態シェル」までを検証。
追加/解除/重複防止/同名別カード/タグ/メモ/ビルド関連付け/お気に入りと My Team の独立性の操作は
src/lib/user-cards/user-cards.test.ts（vitest 28件）で担保。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | お気に入り: /favorites が 200 | HTTP 200 |
| PASS | お気に入り: 見出し「お気に入り」 |  |
| PASS | お気に入り: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない) |  |
| PASS | お気に入り: 空状態「お気に入りはまだありません」の文言は辞書に存在する |  |
| PASS | お気に入り: ローカル保存の明示（このブラウザにのみ）の文言は辞書に存在する |  |
| PASS | お気に入り: ログイン/クラウド同期を「済み」と誤表示しない |  |
| PASS | お気に入り: 内部情報/SQL/絶対パスを含まない |  |
| PASS | My Team: /my-team が 200 | HTTP 200 |
| PASS | My Team: 見出し「My Team」 |  |
| PASS | My Team: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない) |  |
| PASS | サイドメニューに「お気に入り」（準備中ではない） |  |
| PASS | サイドメニューに「My Team」（準備中ではない） |  |
| PASS | by-ids API: 200 + 指定 ID を解決 | found=2 |
| PASS | by-ids API: 返り値は要求した ID の範囲内 |  |
| PASS | by-ids API: ids 空 → players:[]（500ではない） | HTTP 200 |
| PASS | by-ids API: 不正 ID は除外（クラッシュしない） | HTTP 200 |
| PASS | by-ids API: 大量 ID でも 500 にならない（上限で頭打ち） | HTTP 200 |
| PASS | プレイヤー一覧カードにお気に入りボタン（aria-label） |  |
| PASS | 選手詳細にお気に入り追加ボタン |  |
| PASS | 選手詳細に My Team へ追加ボタン |  |
| PASS | お気に入り = 色だけに依存しない（aria-pressed を持つ） |  |
| PASS | ?tab=progression: 育成タブが初期選択（育成ポイント表示） |  |
| PASS | /squads?card=<id>: クラッシュしない | HTTP 200 |
| PASS | /squads?card=<id>: My Team カードの案内バナー文言は辞書に存在する |  |
| PASS | /squads（card なし）: バナーを出さない・回帰なし |  |
| PASS | 回帰: ホーム 200 |  |
| PASS | 回帰: プレイヤー一覧 200 + 詳細リンク |  |
| PASS | 回帰: 比較 /compare 2人 200 + 26能力値 |  |
| PASS | 回帰: World 選手詳細 200 + 育成タブ |  |
| PASS | 回帰: 監督一覧 200 |  |
| PASS | 回帰: 選手検索API 到達・件数あり | total=44 |
| PASS | 回帰: 選手詳細API 26能力値 |  |

## 判定: 全項目 PASS

