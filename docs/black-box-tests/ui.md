# サイト全体 UI 刷新 ブラックボックステスト結果

実行日時: 2026-09-12T07:50:20.337Z
対象: http://localhost:3000（localhost のみ）  外部アクセス: **0 回**

SSR / DOM / スタイルクラス / レスポンシブ構造の自動検証。

## 目視確認が必要な項目（自動検証の対象外）
- 実ブラウザ 375 / 430 / 768 / 1024 / 1280 / 1440 / 1920px での見た目・重なり・余白バランス
- ホバー時の浮き上がり／境界色変化、トランジションの体感
- ライムアクセントと文字のコントラスト（Primary ボタン）
- ピッチ上の選手カードの重なり・可読性（実データ配置後）
- ドロワー／モーダルのフォーカストラップの実挙動

| 結果 | 項目 | 詳細 |
|---|---|---|
| PASS | home: HTTP 200 | HTTP 200 |
| PASS | players: HTTP 200 | HTTP 200 |
| PASS | detail: HTTP 200 | HTTP 200 |
| PASS | managers: HTTP 200 | HTTP 200 |
| PASS | managerDetail: HTTP 200 | HTTP 200 |
| PASS | compare: HTTP 200 | HTTP 200 |
| PASS | compare2: HTTP 200 | HTTP 200 |
| PASS | squads: HTTP 200 | HTTP 200 |
| PASS | squadEditor: HTTP 200 | HTTP 200 |
| PASS | 共通: ヘッダーにブランドマーク「27」 |  |
| PASS | 共通: ヘッダーにグローバル検索（role=search） |  |
| PASS | 共通: サイドバーにグループ見出し（メイン/分析/コミュニティ） |  |
| PASS | 共通: サイドバーの全メニュー項目 |  |
| PASS | 共通: 準備中ページはバッジで区別（ティアリスト/パック/コミュニティ） |  |
| PASS | 共通: 現在位置を aria-current=page で示す |  |
| PASS | 共通: モバイルメニューボタン（aria-label=メニューを開く） |  |
| PASS | 共通: サイドバー折りたたみボタン |  |
| PASS | 共通: フォーカスリング CSS（:focus-visible の outline）が globals にある | globals.css で定義 |
| PASS | トークン: CSS 変数（--color-*-rgb / --content-* / --header-h）が読める |  |
| PASS | トークン: 背景階層（bg と surface が別色） |  |
| PASS | 幅: 一覧は wide コンテナ（max-w-content-wide） |  |
| PASS | 幅: 比較は xwide コンテナ |  |
| PASS | 幅: スカッド編集は full コンテナ |  |
| PASS | 幅: 旧 max-w-[1200px] の中央固定枠を使っていない |  |
| PASS | 幅: サイドバーは画面左端に固定（lg:flex の aside・mx-auto ではない） |  |
| PASS | 見出し: 各ページに h1（text-2xl 以上） |  |
| PASS | 見出し: PageHeader に説明文と主要CTA |  |
| PASS | 空状態: 比較の空はスロット枠＋アイコン＋案内＋次の操作 |  |
| PASS | 空状態: スカッドの空はピッチプレビュー＋作成CTA |  |
| PASS | 空状態: 破線枠＋アイコン＋見出し（EmptyState 構造） |  |
| PASS | ローディング: Skeleton クラスを使う（スカッド編集シェル） |  |
| PASS | エラー: 404 でも安全なガイド（SQL/パスなし） |  |
| PASS | ホーム: ヒーロー＋検索フォーム |  |
| PASS | ホーム: 実データ指標（World カード / 監督 66） |  |
| PASS | ホーム: 高OVRカードのストリップ（横スクロール） |  |
| PASS | ホーム: できること（クイックリンク4種） |  |
| PASS | ホーム: 架空の利用者数・評価を出さない |  |
| PASS | 一覧: PC で多列グリッド（2xl:grid-cols-7 まで） |  |
| PASS | 一覧: 画像比率を維持（aspect-[3/4]） |  |
| PASS | 一覧: フィルターチップ + すべて解除 |  |
| PASS | 一覧: カードに比較追加ボタン |  |
| PASS | 詳細: ヒーロー（画像 + 名前 + 最大OVR + ポジション + 比較追加） |  |
| PASS | 詳細: タブ（role=tablist・矢印キー対応の Tabs） |  |
| PASS | 詳細: 育成タブが参考画像の配置（左=配分/監督, 右=能力値比較） |  |
| PASS | 監督一覧: カードに得意戦術・イニシャルアバター・略称凡例 |  |
| PASS | 監督一覧: 画像を架空生成しない（img タグを監督カードに使わない） |  |
| PASS | 監督詳細: ヒーロー + 戦術適性バー（順位付き） + ブースター + Link-Up |  |
| PASS | 比較: 追加後は 26 能力値テーブル + カテゴリ + スキル |  |
| PASS | 比較: xwide 幅で横スクロール可能なテーブル |  |
| PASS | スカッド編集: ピッチが主要要素（pitch-turf・11スロット） |  |
| PASS | スカッド編集: SSR は骨格（Skeleton）を描画し高さを確保 | （スカッド名/保存/タブは localStorage 読込後にクライアント描画 → src/lib/squad テストで担保） |
| PASS | スカッド編集: クライアントバンドルに sticky ヘッダー・モバイルタブ・保存が含まれる |  |
| PASS | A11y: アイコンのみボタンに aria-label |  |
| PASS | A11y: 画像に alt |  |
| PASS | A11y: フォーム要素に aria-label / label |  |
| PASS | A11y: 色だけに依存しない（能力値バッジは数値を持つ） |  |
| PASS | レスポンシブ: home にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: players にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: detail にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: managers にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: managerDetail にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: compare にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: compare2 にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: squads にページ全体を割る固定 px 幅がない |  |
| PASS | レスポンシブ: squadEditor にページ全体を割る固定 px 幅がない |  |
| PASS | 回帰: 比較の URL 育成方針・監督が SSR 反映 |  |
| PASS | 回帰: 監督総数 66 / World 13,009 表示 |  |
| PASS | 回帰: 旧 eFHUB サンプル詳細 |  |
| PASS | 回帰: 画像プロキシ不正IDは 400（外部アクセスなし） |  |

## 判定: 全項目 PASS

