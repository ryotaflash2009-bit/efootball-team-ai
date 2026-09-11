# Phase: 選手比較機能（/compare）

作成日: 2026-08-28 / 外部アクセス: **0 リクエスト**（SQLite・既存エンジン・既存監督データ・既存画像プロキシのみ）

## 目的

2〜4 人の World カードを横並びで比較する。基本情報・26 能力値・スキル・AI スキル・
育成ビルド適用後・監督補正適用後を、既存の育成計算エンジン（`calculateBuild`）をそのまま
再利用して算出する。**比較専用の計算式は作らない。**

## 画面 / ルート

| ルート | 種別 | 説明 |
|---|---|---|
| `/compare` | Server Component（`runtime=nodejs`, `dynamic=force-dynamic`） | `?ids=&b=&m=` を parse → `getPlayerByWorldId` / `getManagerById` で入力を組み立て → `<ComparisonBoard>` へ |
| サイドメニュー「選手比較」 | — | `status: "ready"` でマネージャーの下に追加 |
| 「比較へ追加」ボタン | Client | 選手一覧カード（`variant="card"`）と選手詳細ヘッダー（`variant="detail"`）。既存カードは作り替えず最小追加 |

## 比較状態（URL / ストレージ）

- URL クエリ: `?ids=<worldCardId,...>&b=<none|attack|defense|balance|gk,...>&m=<internalManagerId,...>`
  - `ids`: 数字 1〜20 桁・**重複除去**・**最大 4**。不正/存在しない ID は安全に除外（クラッシュしない）。
  - `b` / `m`: `ids` と同順、不足分は `none` / `null`。デフォルトなら URL から省略。
  - **育成ビルド配分（`progressionAllocation`）は URL に入れない**（長くなる・ブラウザ依存）。保存ビルドの選択は UI 状態のみ。
- クライアントは `window.history.replaceState` で URL を同期（履歴を汚さない）。
- 「比較へ追加」カートは `sessionStorage`（`efb:compare-ids:v1`）。全アクセス try/catch でガード。
- 個人情報・秘密情報は一切保存しない（World カード ID と表示設定のみ）。

## 計算エンジンの再利用

`src/lib/comparison/build-comparison.ts` の `buildComparison(inputs)`:

1. 各選手の配分を解決: `savedAllocation`（あれば）> `autoAllocate(card, buildMode)` > `{}`
2. `calculateBuild({ card, allocation, manager })` を呼ぶ（既存 v2 エンジン）
3. レイヤー（`baseValue` / `progressionDelta` / `playerBoosterDelta` / `managerBoosterDelta` / `finalValue`）を
   そのまま `StatComparisonRow.perPlayer` に載せる

- **選手ブースター**は「効果未確認」のためエンジンが常に ±0 を返す。比較表でも `選+N` は出ない（注記あり）。
- **監督ブースター**は `confirmationStatus === "confirmed"` かつ `statKey` があるものだけ適用。
  未確認監督は `manager.applied === false`、`managerBoosterDelta` 全 0（表示のみ）。
- 適用順序（育成前/後）は unresolved。エンジンの固定加算順に従う。

## 比較ロジック（`src/lib/comparison/`）

| ファイル | 役割 |
|---|---|
| `types.ts` | `COMPARISON_MIN=2` / `COMPARISON_MAX=4`、`ComparisonPlayerInput` / `ComparisonResult` / `ComparisonState` など |
| `schemas.ts` | `parseComparisonState` / `serializeComparisonState` / `comparisonHref`（URL ⇄ 状態、round-trip） |
| `categories.ts` | `COMPARE_CATEGORIES`（攻撃/ドリブル/パス/守備/フィジカル/スピード/GK の 7 分類）、`categoryForStat` |
| `build-comparison.ts` | `buildComparison`（中核） |
| `from-world.ts` | `worldDetailToComparisonInput`（`WorldPlayerDetail` → `toProgressionCard` + 表示フィールド） |
| `compare-cart.ts` | sessionStorage カート（`getCompareIds` / `addCompareId` → `added\|already\|full\|invalid` / `removeCompareId`） |
| `index.ts` | バレル |

`ComparisonResult` が持つ計算結果: `basicInfo` / `stats`（26 行、`highestPlayerIdx` / `lowestPlayerIdx` / `spread`）/
`playerSkills` / `aiStyles`（`shared` / `partial` / `uniqueByPlayer` / `countByPlayer`）/ `categories`（単純合計・平均・spread）/
`totalStatByPlayer` / `positionMatch` / `estimatedOvrByPlayer` / `warnings` / `rulesVersion`。

- **カテゴリ合計・平均・総合は単純計算**。`warnings` に必ず
  「カテゴリ合計・平均・総合は単純計算です（eFootball の公式カテゴリ重み・総合評価とは異なります）。」を追加。
- 独自総合を「公式評価」として表示しない。推定 OVR は「検証中」表記。

## UI（`src/components/compare/`）

| コンポーネント | 説明 |
|---|---|
| `ComparisonBoard` | 状態の保持、選手の追加/削除、育成方針・監督の個別/一括適用、URL 同期。5 人目は追加せず案内、既存選手は消さない。重複 `worldCardId` は追加不可。別カード（ID 違い）は可 |
| `PlayerControlColumn` | 1 選手ぶんのヘッダー（画像・名前・ポジション・OVR・Lv・ID）＋ 育成方針 `<select>` ＋ 保存ビルド `<select>` ＋ インライン監督検索（解除/変更） |
| `AddPlayerSearch` | `/api/world/players?q=` を 300ms デバウンス、20 件、4 人時は無効化、追加済みは「追加済み」表示 |
| `ComparisonTables` | 規則メタ、基本情報（sticky 先頭列）、カテゴリ比較、能力値 26（グループ折りたたみ）、スキル比較 |
| `CompareAddButton` | カート読み書き。`<Link>` 内でも動くよう `preventDefault`/`stopPropagation`。「比較へ追加」/「比較中 ✓」/「比較満員」＋「比較を見る (N)」 |

### 差分表示

- 能力値セル: `StatBadge`（最終値）＋ `DeltaBits`（`育N` / `選N` / `監N` を分けて表示）。**選手ブースターと監督補正は別々**。
- 最高の最終値: 背景ハイライト（`bg-accent/15`）＋ 緑文字。加えて全行に「差」列で **数値の spread** を表示（色だけに依存しない）。
- カテゴリ表: 各選手の合計＋（平均）＋「差」列、最後に「総合（単純合計）」行。

### レスポンシブ

- 各テーブルは `overflow-x-auto` の中で横スクロール、先頭列は `sticky left-0`。
- ヘッダー列 grid は `repeat(N, minmax(150px, 1fr))`。
- 能力値グループは折りたたみ可能（`GroupBlock`）。

## 既存機能の保護

- 既存ページ（ホーム / 一覧 / 検索 / フィルタ / 並べ替え / ページネーション / World 詳細 / 画像 /
  育成 / ビルド保存 / 監督一覧・詳細・選択 / eFHUB サンプル）は未改修。
- `WorldPlayerCard` と World 詳細ページは「比較へ追加」ボタンを 1 箇所足しただけ（骨格は不変）。

## テスト

### ユニット（vitest）— 25 件、全 224 件 PASS

- `schemas.test.ts`（9）: dedup / max4 / 不正 ID 除外、`b` は ids と同順、`m` は正整数のみ、serialize round-trip、空 → `/compare`。
- `build-comparison.test.ts`（16）: 2/3/4 人、highest/lowest/spread（Messi dribbling 87 vs Cannavaro 62 → spread 25）、
  同値 → 両方 highest+lowest、buildMode 適用、savedAllocation > buildMode、個別ビルド、
  監督なし → 全 0、同一 Conte 両者 → `defensiveAwareness +1` 両方（育成/選手は 0）、異なる監督個別、
  未確認監督は非適用、スキル shared/partial/unique/count、スキルなしでも安全、7 カテゴリ＋警告、
  rulesVersion、推定 OVR、positionMatch、同一人物の別カード（ID 違い）→ 別選手・基礎 OVR [90, 89]。

### ブラックボックス — `scripts/black-box-compare.mjs`（36 件 PASS）

`/compare?ids=…` の SSR で: 2/3/4 人の描画、基本情報・26 能力値・カテゴリ・スキル、
5 件 URL でも 4 人まで（既存を消さない）、1 人以下は案内、重複 ID は 1 人、
不正/存在しない ID は安全に除外、`b=` / `m=` が SSR に反映（育成デルタ・監督デルタ・監督名）、
不正監督 ID は無視、GK 対 GK、一覧/詳細の「比較へ追加」、サイドメニュー、既存機能の回帰。

> クリック操作（追加/削除/育成変更/監督変更）は JS 実行が必要なため、URL 状態からの
> SSR 描画で確認し、対話ロジックは vitest で担保。

### 回帰ブラックボックス（全 PASS）

`black-box-progression`（63）/ `black-box-managers`（41）/ `black-box-world-ui`（78, `NO_EXTERNAL=1`, 外部 0）/
`black-box-world-sync`（35）/ `black-box-phase-c`（17）/ `black-box-phase-b5`（23）。

- `phase-c` / `phase-b5` の「一覧から詳細へ移動できる（href=/players/{id}）」は World UI 移行以前の
  古い前提。`/players/world/{id}` も許容するようアサーションを更新（アプリ側は正しい）。
- 画像回帰の `verify-world-images.mjs` は実際に cloudfront へ GET するため、本マイルストーンの
  「外部アクセス 0」方針に従い実行せず。画像挙動は `black-box-world-ui` の `NO_EXTERNAL` 検証
  （プロキシ配線・SVG プレースホルダー・400・cloudfront 非露出）でカバー。

## 品質ゲート（個別実行・全 PASS）

`npm run typecheck` / `npm run lint`（警告 0）/ `npm run test`（224）/ `npm run build`
（`/compare` 7.73 kB / First Load 141 kB）/ SQLite 整合性チェック（`整合性 OK`）。

## データ整合性

World 13,009 / eFHUB 索引 47,479 / eFHUB 詳細 19 / 監督 66 — いずれも不変。破壊的 SQL なし（読み取りのみ）。
