# Phase: サイト全体 UI/UX 刷新

作成日: 2026-08-28 / 外部アクセス: **0 リクエスト** / SQLite: **読み取りのみ・書き込み 0**

機能追加ではなく、既存機能を維持したまま操作性・視認性・情報設計・レスポンシブ・デザイン品質を刷新。

## 参照したスクリーンショット（読み取り専用）

| 相対パス | 種別 | 用途 |
|---|---|---|
| `./screenshots/image.png` / `image (1).png` | 参考UI | eFHUB 育成画面（左=配分/ポイント/監督、中央=能力値3列+デルタ、下/右=スキル/モデル/身体） |
| `./screenshots/current-ui-squads-empty.png.png` | 現在UI | スカッド空状態（狭い中央カラム・下部の大空白・簡素な空状態） |
| `./screenshots/current-ui-compare-empty.png.png` | 現在UI | 比較空状態（空きスロットが見えない・横長ボタンのみ） |
| `./screenshots/current-ui-managers-list.png.png` | 現在UI | 監督一覧（情報過密・略称のみ・優先順位が弱い） |
| `./screenshots/スクリーンショット 2026-08-28 020921.png` | 参考UI | SQUAD BUILDER（ピッチ中心・左に監督/チーム評価・右にベンチ） |
| `./screenshots/スクリーンショット 2026-08-28 015851/015907/020007/020026.png` | 参考UI | 比較・監督一覧・選手一覧・選手ビルド画面 |

**採用**: 育成の3カラム情報配置 / ピッチ中心のスカッド / 監督カードの「得意戦術を大きく」/ 比較の空きスロット可視化 / データ指標のダッシュボード化。
**不採用**: 外部サイトのナビゲーション・ブランド・広告・スポンサー枠・eFHUB 固有の「私のビルド/REVIEWS/POST TO FEED」等。参考画像の配色そのままの複製もしない。

## デザインシステム

### トークン（`src/app/globals.css` + `tailwind.config.ts`）

- 色は **RGB 三つ組**（`--color-x-rgb: "R G B"`）で定義 → Tailwind から `rgb(var(--color-x-rgb) / <alpha-value>)`。`bg-surface/40` のような不透明度修飾が確実に効く。
- 背景の階層: `bg #090c0f` → `surface #12171c` → `surface-2 #1a2129` → `surface-3 #232d37`。境界 `border` / `border-strong`。
- テキスト: `text` / `text-dim` / `text-muted`（無効）。
- ブランド: `accent`（ライム #c7f000）/ `accent-ink` / `accent-soft`。
- セマンティック: `success` / `warning` / `danger` / `info`。
- 能力値段階色 `--stat-*`（elite/high/mid/low/poor）は数値と併用（色のみに依存しない）。
- 角丸 `sm/md/lg/pill`、シャドウ `card/pop`、レイアウト寸法 `--header-h 56px` / `--sidebar-w 244px` / `--content-{regular 880, wide 1200, xwide 1440, full 1720}`。
- `.pitch-turf`（CSS のみの芝）、`prefers-reduced-motion` 尊重、暗背景向けスクロールバー。

### 共通コンポーネント（`src/components/ui/`）

`Icon`（インライン SVG 40種・外部パッケージなし）/ `PageContainer`（幅バリアント）/ `PageHeader` / `SectionHeader` /
`Surface`（base/raised/inset/outline）/ `Button` + `buttonClasses`（primary/secondary/ghost/danger/outline × sm/md/lg）/
`IconButton` / `Badge`（7トーン）/ `Input` + `Select`（ラベル/ヒント/エラー/フォーカス/無効）/ `StatValue` + `DeltaValue` /
`EmptyState`（empty / no-results / error を区別・アイコン + 見出し + 説明 + 次の操作 + プリセット枠）/
`LoadingState`（cards/list/detail/table/pitch/compare の骨格）/ `ErrorState`（再試行 / 戻る / ホーム / コード）/
`Tabs`（role=tablist・矢印キー・全パネル DOM 保持）/ `Modal` + `Drawer`（フォーカストラップ・Esc・背景クリック）/
`Tooltip` / `Skeleton` / `Divider`。

`src/components/StateViews.tsx` は上記 ui への後方互換再エクスポートに変更。

## 全体レイアウト（`AppShell` / `Header` / `Sidebar`）

- **サイドバーを画面左端に固定**（旧: `mx-auto max-w-[1200px]` で全体が中央寄せ → 1920px で左右に巨大な余白）。
- PC: `<aside>` 244px（折りたたみ 64px・localStorage `efb:sidebar-collapsed` で保持）。狭い画面: ドロワー。
- ヘッダー: 高さ 56px・本文カラム上部にスティッキー。ブランドマーク「27」/ グローバル検索（`role=search` → `/players?q=`）/ データ指標 / モバイルメニュー。
- 本文は各ページが `PageContainer` で最大幅を制御: 一覧・詳細 = wide / 比較 = xwide / スカッド編集 = full / 文章 = regular。

## サイドバー

- アイコン付き。グループ分け（メイン / 分析 / コミュニティ）。
- 現在位置: `aria-current="page"` + 左端のアクセントバー + `bg-accent-soft` + アクセント文字。
- 準備中ページ: 淡色 + 「準備中」バッジ・非クリック。

## タイポグラフィ

- h1: `text-2xl`〜`text-3xl` / セクション: `text-lg`（h2）・`text-sm`（h3） / 本文 14–16px / 補助 `text-2xs`（11px）。
- 説明文は `max-w-2xl` で 2 行程度に自然に回り込む（旧: 1 行に押し込み）。数値は `tabular-nums`。

## 空状態 / ローディング / エラー

- 空状態: `EmptyState` に統一。`empty`（未作成）と `no-results`（検索0件）を区別し、次の操作 CTA を必ず提示。
  - 比較の空: 2〜4 の空きスロット枠 + 「n人目を選択」+ 検索。
  - スカッドの空: CSS ミニピッチ + 「最初のスカッドを作成」+ 10 テンプレート。
- ローディング: `LoadingState` の骨格でページ構造と高さを維持。
- エラー: `ErrorState` に統一。SQL 全文・スタックトレース・パス・秘密情報は出さない（`error.tsx` も刷新）。

## 各ページ

| ページ | 主な変更 |
|---|---|
| ホーム | ダッシュボード化。ヒーロー（検索 + CTA）/ 実データ指標カード（World 13,009・eFHUB 47,479・監督 66・取り込み日時）/ 高OVRカード・最近更新カードの横スクロール / できること 4 枚 / 開発中バッジ。架空の利用者数・評価は出さない。 |
| プレイヤー一覧 | `PageHeader` + 件数。グリッド列数を拡大（`2xl:grid-cols-7`）。カードは OVR/ポジション/名前の階層を整理、ホバーで比較追加。`no-data` と `no-results` を区別。画像比率（3:4）維持。 |
| 選手詳細 | `WorldPlayerHero`（画像 + 名前 + 最大 OVR + ポジション/PS バッジ + 主要ファクト + 比較追加）。タブは共通 `Tabs`（矢印キー対応・スティッキー）。 |
| 育成 | 2 カラム化（PC）: 左 = ポイントバー（スティッキー）・配分方針・10グループ・監督・選手ブースター・ビルド保存 / 右 = 能力値の育成前後。confirmed/provisional/unresolved と rulesVersion の区別は維持。 |
| 監督一覧 | `ManagerCard` に刷新: イニシャルアバター + 名前（大）+ リリース/Link-Up バッジ + **得意戦術を大きく** + ブースターチップ + 残り適性のコンパクト表示。略称の凡例（PG=Possession Game 等）をページ上部に常時表示。監督画像は架空生成せずイニシャルで代替。同名別カードは ID で区別。 |
| 監督詳細 | ヒーロー（イニシャル + 名前 + バッジ + 得意戦術）。戦術適性 = 数値 + バー + 順位（#1…）。ブースター = 対象能力/上昇量/適用条件/確認状態。Link-Up = Center Piece / Key Man 条件。非収録は「追加調査中」。 |
| 選手比較 | `PageContainer` xwide。空状態で 2〜4 の空きスロットと検索を提示。共有コントロールを `Surface` 化。ヘッダー列 + 空きスロットを横スクロールグリッドに。 |
| スカッド一覧 | ヒーロー（ミニピッチ + 説明 + 作成 CTA）/ 「新しいスカッドを作成」を専用カード（名前 + フォーメーション select + 10 テンプレートのミニピッチ）/ 保存済みカードにミニピッチ・フォーメーション・監督有無・先発人数・更新日時・開く/複製/名前変更/削除（確認）。 |
| スカッド編集 | `PageContainer` full。スティッキーヘッダー（名前 + フォーメーション + 保存）。ピッチを拡大（最大 600px・`.pitch-turf`）。右レール（監督/ベンチ/サマリー/Link-Up/警告）。モバイルはタブ切替。SSR は空ピッチの骨格 + Skeleton。 |

## レスポンシブ確認（ブラックボックス `scripts/black-box-ui.mjs` の DOM/クラス検証）

各ページに「ページ全体を割る固定 px 幅（`w-[1xxxpx]` / `min-w-[1xxxpx]`）がない」ことを 9 ページで自動検証。
サイドバーが `<aside sticky lg:flex>` で画面左端固定・旧 `max-w-[1200px]` 中央枠を撤去。
横スクロールは各テーブル・ストリップの `overflow-x-auto` 内に閉じ込め。

> 実ブラウザでの 375 / 430 / 768 / 1024 / 1280 / 1440 / 1920px の見た目・重なり・余白バランス、ホバーの浮き上がり、
> Primary ボタンのコントラスト、ピッチ上の実データ配置時の可読性、モーダル/ドロワーのフォーカストラップ実挙動は**目視確認が必要**（`docs/black-box-tests/ui.md` に明記）。

## テスト

- `src/components/ui/ui.test.ts`（7）: `buttonClasses` の variant/size/フォーカス/無効/追加クラス、`CONTAINER_MAXW` の4幅、Icon 名の定義。
- `src/components/managers/tactics.test.ts`（4）: 6戦術メタ、`tacticTier` の数値帯、`topTactic`、`managerInitials`。
- `vitest.config.ts` に `esbuild.jsx = "automatic"` を追加（`.tsx` を import する UI ヘルパーテスト向け）。
- `scripts/black-box-ui.mjs`（69）: シェル・トークン・幅・見出し・空状態・ローディング・A11y・各ページ・レスポンシブ構造・回帰。

## 品質ゲート（個別実行・全 PASS）

typecheck / lint（警告0）/ test（**313**・UI +11）/ build / SQLite 整合性 OK。
回帰ブラックボックス: compare 36 / progression 63 / managers 41 / world-ui 78 / world-sync 35 / phase-c 17 / phase-b5 23 — 全 PASS。
データ件数（World 13,009 / eFHUB 索引 47,479 / eFHUB 詳細 19 / 監督 66）不変。外部アクセス 0。
