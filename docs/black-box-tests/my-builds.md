# My Builds 画面 ブラックボックステスト結果

実行日時: 2026-09-12T10:00:15.381Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

注: 保存ビルドは localStorage 保存のため、SSR では「空状態シェル」までを検証。
一覧 / 検索 / 絞り込み / 並び替え / 名前変更 / 複製 / 使用状況 / 安全な1件削除 / storage イベント /
My Team 新規登録・selectedBuildId・favoriteBuildId 連携は
src/lib/progression/my-builds.test.ts + src/lib/progression/build-storage.test.ts（vitest）で担保。
保存ビルド分析（/build-inventory・旧称「保存ビルド棚卸し」）と旧規則ビルド確認ガイドの集計・分類・絞り込みは
src/lib/progression/build-inventory.test.ts（vitest）で担保。

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | My Builds: /my-builds が 200 | HTTP 200 |
| PASS | My Builds: 見出し（h1）は 1 つ |  |
| PASS | My Builds: 見出し「My Builds」 |  |
| PASS | My Builds: 空状態「保存ビルドがありません」 |  |
| PASS | My Builds: 空状態の説明「この育成を保存」から追加 |  |
| PASS | My Builds: ローカル保存の明示（このブラウザにのみ） |  |
| PASS | My Builds: ログイン/クラウド同期を「済み」と誤表示しない |  |
| PASS | My Builds: 内部情報/SQL/絶対パスを含まない |  |
| PASS | My Builds: 空状態から 選手を探す / 選手比較 / My Team / スカッド への導線 |  |
| PASS | My Builds: ポジション別OVRを新設していない（説明にも断定表示なし） |  |
| PASS | My Builds: 説明に「このブラウザにのみ保存」で新規登録を約束しない（My Team自動登録なし） |  |
| PASS | My Builds: 架空の所有/使用状態や既定値を SSR で断定表示しない（登録は確認ダイアログ経由） |  |
| PASS | 書き出し: 「保存ビルドを書き出す」入口がある |  |
| PASS | 書き出し: ローカルの JSON ファイルとして保存する説明 |  |
| PASS | 書き出し: サーバー / 外部サービスへ送信しない説明 |  |
| PASS | 書き出し: 書き出しても元データを変更しない説明 |  |
| PASS | 書き出し: 全件エクスポート・選択エクスポートの両方に触れている |  |
| PASS | 書き出し: 「書き出す」と「読み込む」が別の入口として区別されている |  |
| PASS | 書き出し: 架空のポジション別 OVR を SSR で断定表示しない |  |
| PASS | 書き出し: 内部情報 / server.pid / dev-err.log / 環境変数を含まない |  |
| PASS | 書き出し: 対応ブラウザーで保存場所の選択画面が表示される旨とドキュメントフォルダーの案内 |  |
| PASS | 書き出し: 非対応ブラウザーは通常のダウンロード先へ保存する旨（実際の保存先選択・write/close/AbortError 処理は browser-save-file.test.ts で担保） |  |
| PASS | 書き出し: 「必ずドキュメントへ保存される」と断定していない |  |
| PASS | 読み込み: 「保存ビルドを読み込む」入口がある |  |
| PASS | 読み込み: 前回書き出したローカル JSON ファイルが対象という説明 |  |
| PASS | 読み込み: サーバー / 外部サービスへ送信しない説明 |  |
| PASS | 読み込み: ファイル選択だけ・プレビューだけでは保存されない説明 |  |
| PASS | 読み込み: 既存ビルドを上書き・削除しない説明 |  |
| PASS | 読み込み: buildId 衝突時は新しい buildId で追加する説明 |  |
| PASS | 読み込み: My Team / スカッド / カードお気に入りへ自動適用しない説明 |  |
| PASS | 読み込み: 未対応 formatVersion を変換せず拒否する説明 |  |
| PASS | 読み込み: 内容を検証してプレビューし最終確認のうえ追加する説明 |  |
| PASS | 読み込み: selectedBuildId / favoriteBuildId へ自動設定しない説明 |  |
| PASS | 読み込み: localStorage 全体 / My Team / スカッド / SQLite のインポートではない |  |
| PASS | 読み込み: SSR シェルにファイル入力・外部アップロード UI を常設しない（Modal 内のみ） |  |
| PASS | 読み込み: 自動上書き / 一括削除 / 自動参照作成 を SSR で謳わない |  |
| PASS | 読み込み: 架空のポジション別 OVR を SSR で断定表示しない |  |
| PASS | 読み込み: 内部情報 / server.pid / dev-err.log / 環境変数 / SQL を含まない |  |
| PASS | My Team: /my-team が 200（My Builds 連携追加後も回帰なし） | HTTP 200 |
| PASS | My Team: 空状態シェル（カードなし） |  |
| PASS | My Team: 選択中ビルド select が残る（既存機能・回帰なし） |  |
| PASS | My Team: 架空のポジション別 OVR を SSR で断定表示しない |  |
| PASS | My Team: 英語育成カテゴリ名を主表示へ出さない（Shooting/Passing/Dribbling…） |  |
| PASS | My Team: 内部情報/SQL/絶対パスを含まない |  |
| PASS | お気に入り: /favorites が 200（My Builds のお気に入りビルド連携と別機能・回帰なし） | HTTP 200 |
| PASS | お気に入り: 空状態シェル |  |
| PASS | 分析: /build-inventory が 200（URL 不変） | HTTP 200 |
| PASS | 分析: 見出し（h1）は 1 つ |  |
| PASS | 分析: 見出し「保存ビルド分析」（旧「保存ビルド棚卸し」は主表示に残さない） |  |
| PASS | 分析: 読み取り専用の明示 |  |
| PASS | 分析: ローカル保存の明示（このブラウザにのみ） |  |
| PASS | 分析: 空状態「保存ビルドがありません」 |  |
| PASS | 分析: 空状態から My Builds / My Team / スカッド への導線 |  |
| PASS | 分析: 一括削除/一括解除/一括適用/自動修復を SSR で謳わない |  |
| PASS | 分析: 架空のポジション別 OVR を SSR で断定表示しない |  |
| PASS | 分析: 英語育成カテゴリ名を主表示へ出さない（Shooting/Passing/Dribbling…） |  |
| PASS | 分析: 内部情報/SQL/絶対パスを含まない |  |
| PASS | サイドメニューに「ビルド分析」（準備中ではない・旧「ビルド棚卸し」は残さない） |  |
| PASS | サイドメニュー: /build-inventory へのリンク（URL 不変） |  |
| PASS | 旧規則ガイド: 見出し「旧規則ビルド確認ガイド」 |  |
| PASS | 旧規則ガイド: 新しい専用ページを増やしていない（/build-inventory 内のセクション） |  |
| PASS | 旧規則ガイド: 読み取り専用・自動移行機能ではないと明示 |  |
| PASS | 旧規則ガイド: 旧規則ビルドの説明（旧 rulesVersion / 現行規則へ調整し直す） |  |
| PASS | 旧規則ガイド: 既存の旧規則ビルドはそのまま保持されると明示 |  |
| PASS | 旧規則ガイド: 空状態「旧規則ビルドはありません」 |  |
| PASS | 旧規則ガイド: 空状態で「移行済み」と断定しない（§13） |  |
| PASS | 旧規則ガイド: 個別確認の導線（My Builds / My Team / スカッド） |  |
| PASS | 旧規則ガイド: ビルドを変換/移行/更新「しました」と完了形で断定しない |  |
| PASS | 重複候補: 見出し「保存ビルド重複候補」 |  |
| PASS | 重複候補: 完全一致候補の説明（World ID・rulesVersion・育成配分・選手ブースター試算・Power of Many指定が一致） |  |
| PASS | 重複候補: 類似候補の説明（安全な範囲に限定・未対応の場合も 0 件と誤表示しない） |  |
| PASS | 重複候補: 自動削除しない説明 |  |
| PASS | 重複候補: 自動統合しない説明 |  |
| PASS | 重複候補: 一括処理しない説明 |  |
| PASS | 重複候補: My Team 参照を変更しない説明 |  |
| PASS | 重複候補: スカッド参照を変更しない説明 |  |
| PASS | 重複候補: 空状態「完全一致する保存ビルド候補はありません」 |  |
| PASS | 重複候補: My Builds への導線 |  |
| PASS | 重複候補: Build Inventory（本ページ）への導線がサイドメニューから確認できる |  |
| PASS | 重複候補: 架空のポジション別 OVR を SSR で断定表示しない |  |
| PASS | 重複候補: 内部情報/SQL/絶対パスを含まない |  |
| PASS | 重複候補: My Builds 画面に Build Inventory への導線（重複候補の案内） |  |
| PASS | 重複候補: My Builds 側の案内も削除・統合・上書きしないと明示 |  |
| PASS | サイドメニューに「My Builds」（準備中ではない） |  |
| PASS | サイドメニュー: /my-builds へのリンク |  |
| PASS | by-ids API: 200 + 指定 ID を解決（全13,009走査なし） | found=2 |
| PASS | by-ids API: 返り値は要求した ID の範囲内 |  |
| PASS | by-ids API: 不正 ID は除外（クラッシュしない） | HTTP 200 |
| PASS | 回帰: ホーム 200 |  |
| PASS | 回帰: プレイヤー一覧 200 + 詳細リンク |  |
| PASS | 回帰: World 選手詳細 200 + 育成タブ |  |
| PASS | 回帰: 比較 /compare 2人 200 + 26能力値 |  |
| PASS | 回帰: My Team 200 + 空状態 |  |
| PASS | 回帰: お気に入り 200 + 空状態 |  |
| PASS | 回帰: スカッド 200 | HTTP 200 |
| PASS | 回帰: スカッド比較 200 | HTTP 200 |
| PASS | 回帰: 監督一覧 200 |  |
| PASS | 回帰: 選手詳細API 26能力値 |  |

## 判定: 全項目 PASS

