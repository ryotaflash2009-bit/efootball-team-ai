# Phase: World 選手画像の修正

作成日: 2026-08-28 / 原因調査時の外部アクセス: **0 回**（SQLite のみ）

## 1. 原因

一覧の 91% のカードが NO IMAGE になっていた直接原因は、
**World 側に保存済みの画像 URL（13,009 件すべてに存在）を一切使っていなかった**こと。

修正前の `src/lib/world/image.ts` の `resolveCardImage()` は
「eFHUB 高信頼リンクがある → eFHUB 画像プロキシ / それ以外 → プレースホルダー」
の 2 択で、World 画像プロキシが存在しなかった。

## 2. SQLite の実データ（`scripts/investigate-world-images.mjs`）

| 項目 | 値 |
|---|---|
| `world_player_cards.image_url` あり | **13,009 / 13,009**（null 0 件） |
| `world_player_cards.mobile_image_url` あり | 6,918 / 13,009 |
| image も mobile も無い | 0 件 |
| URL 形式 | すべて絶対 `https://` |
| ホスト（image_url） | `d1zxa6glxh8sq9.cloudfront.net` × 13,009（100%） |
| ホスト（mobile_image_url） | `d1zxa6glxh8sq9.cloudfront.net` × 6,918（100%） |
| 拡張子 | すべて `.webp` |
| `world_player_appearances` の画像列 | なし |
| eFHUB 高信頼リンクあり | 1,138 件（残り 11,871 件はリンクなし） |
| 先頭ページ 24 件 | World 画像 URL あり 24 / eFHUB リンクあり 2 → 修正前は 22 件が NO IMAGE |

URL テンプレート:
- 通常: `https://d1zxa6glxh8sq9.cloudfront.net/player_<worldCardId>_<timestamp>.webp`
- モバイル: `https://d1zxa6glxh8sq9.cloudfront.net/player_mobile_<worldCardId>.webp`

## 3. 代表カード

| 種別 | worldCardId | 選手 | eFHUB リンク | 保存 image_url | 保存 mobile_url | 修正前 | 修正後の src |
|---|---|---|---|---|---|---|---|
| A: リンクあり・画像あり | `89136409091415` | Lionel Messi | あり(`89136409091415`) | `…/player_89136409091415_1776633342634.webp` | `…/player_mobile_89136409091415.webp` | eFHUB 画像表示 | `/api/player-image/89136409091415`（従来どおり） |
| B: リンクなし・World 画像あり | `89138556575063` | Lionel Messi (BIGTIME) | なし | `…/player_89138556575063_1785079036465.webp` | (null) | **NO IMAGE** | `/api/world/player-image/89138556575063` |
| C: World 画像 URL 自体が無い | — | — | — | — | — | — | 該当カードなし（全 13,009 件に image_url あり） |

## 4. 修正内容（実装済み・外部アクセス 0）

### 新規

- `src/lib/world/player-image.ts` — World 画像プロキシのロジック（純関数 + メモリキャッシュ）。
  許可ホスト `d1zxa6glxh8sq9.cloudfront.net` のみ / GET / redirect 追跡なし / 20 秒 / `image/*` かつ 3MB 以内 /
  正常画像のみメモリキャッシュ（最大 32 件・TTL 1 時間・古いものから破棄。ディスク保存なし）。
- `src/app/api/world/player-image/[worldCardId]/route.ts` — 内部プロキシ。
  1. worldCardId 検証（数字 1〜20 桁、それ以外 400）
  2. SQLite から保存済み URL を取得（`getWorldImageUrls`）
  3. 許可ホストか確認（保存値でも他ホストは弾く）
  4. `?variant=mobile` はモバイル URL のみ / 既定は 通常 → モバイル の順に試行
  5. 取得成功 → 画像を返す（`Cache-Control: public, max-age=86400, stale-while-revalidate=604800`）
  6. 失敗・URL なし・カード無し → ローカル SVG プレースホルダーを 200 で返す
     （`Cache-Control: public, max-age=300`、`X-Image-Placeholder: 1`）
- `src/lib/world/repository.ts` に `getWorldImageUrls(worldCardId)` を追加（読み取り専用）。
- テスト: `src/lib/world/player-image.test.ts`（12 件・fetch モック）、`image.test.ts` 更新、`repository.test.ts` に 2 件追加。

### 変更

- `src/lib/world/image.ts` — `resolveCardImage()` を `resolveCardImageSources()` へ。
  優先順位: **1) eFHUB 高信頼リンク → 2) World 通常画像プロキシ → 3) World モバイル画像プロキシ → 4) プレースホルダー**。
  eFHUB リンクが無いことだけを理由に NO IMAGE へ即断しない。
- `src/components/world/WorldCardImage.tsx` — `sources: string[]` を優先順で受け取り、
  読み込み失敗ごとに次候補へ。すべて失敗/候補なしで `PlayerSilhouette`。3:4 枠固定（CLS 0）、一覧は `loading="lazy"`。
- `src/components/world/WorldPlayerCard.tsx` / `src/app/players/world/[worldCardId]/page.tsx` — 新 API に追従。

### 変更なし

- カード縦横比・OVR/カードタイプ/ポジション/名前/基礎OVR/最大レベル/eFHUB表示・グリッド列数・
  サイドメニュー・検索・フィルター・ページネーション。
- `next.config.mjs`（プレーン `<img>` + 同一オリジンプロキシのため `images.remotePatterns` 不要）。
- CSP は本アプリ未設定 → 同一オリジン `<img>` に制限なし。
- SQLite（13,009 / 47,479 / 19 すべて不変、readOnly 接続）。

## 5. 品質確認（個別実行）

| コマンド | 結果 | 時間 |
|---|---|---|
| `npm run typecheck` | exit 0 | 1.7s |
| `npm run lint` | exit 0（警告0） | 2.4s |
| `npm run test` | exit 0 / **123 passed**（+17） | 2.2s |
| `npm run build` | exit 0（全12ルート） | 9.9s |
| `check-world-sync-integrity.mjs` | exit 0 / 整合性 OK | 0.8s |
| `black-box-world-ui.mjs` | exit 0 / **71/71 PASS** | 1.4s |

## 6. 外部アクセスの状況（重要）

- `/players` の SSR は画像を取得しない（`<img loading="lazy">` を出力するだけ）。確認済み:
  先頭 24 カードに `/api/world/player-image/…` × 46、`loading="lazy"` × 24、
  `cloudfront` 文字列はブラウザへ露出せず（src は同一オリジンプロキシ）。
- プロキシの非外部パスも確認済み: 不正 ID → 400、存在しない ID → SVG プレースホルダー 200（外部アクセスなし）。
- **画像バイトの実取得検証（正常画像が複数表示される 等）は、新規外部ホスト `d1zxa6glxh8sq9.cloudfront.net`
  への GET が必要なため未実施。承認待ち。**

## 7. 承認後の実取得検証（`scripts/verify-world-images.mjs`）

承認範囲: `d1zxa6glxh8sq9.cloudfront.net` へ GET のみ・合計10回まで・同時1・20秒・再試行なし・リダイレクト非追跡。

- **実際の外部 GET: 9 回 / 上限 10**（cloudfront 8 + efimg 1）。429/403/リダイレクト/認証要求なし。
- 代表1（eFHUB リンクなし Messi `89138556575063`）: **IMAGE 241KB** ← 修正前に NO IMAGE だったカード
- 代表2a（eFHUB リンクあり Messi `89136409091415` / efimg 経路）: IMAGE 45KB
- 代表2b（同カード / World プロキシ経路）: IMAGE 76KB
- 代表3（World 通常画像 Eden Hazard `88045755863174`）: IMAGE 264KB
- 代表4（World モバイル画像 `?variant=mobile`）: IMAGE 6KB
- 代表5（存在しない ID `99999999999999`）: **PLACEHOLDER・外部 GET 0**
- 代表6（不正 ID `abc` / `1;DROP`）: **HTTP 400・外部 GET 0**
- 一覧先頭ページのサンプル 4/4（Maldini / Cannavaro / Ibrahimović / Best）すべて IMAGE
- 先頭24件: World 画像 URL 24/24（NO IMAGE 0）。取得画像はすべて 3MB 以内（最大 266KB）
- `scripts/verify-world-images.mjs` → **13/13 PASS**、`scripts/black-box-world-ui.mjs` → **82/82 PASS**（画像表示検証を追加。追加の外部 GET 0＝キャッシュ HIT）

### 品質確認（承認後・各コマンド個別）

| コマンド | 結果 | 時間 |
|---|---|---|
| `npm run typecheck` | exit 0 | 1.7s |
| `npm run lint` | exit 0（警告0） | 2.3s |
| `npm run test` | exit 0 / 123 passed | 2.1s |
| `npm run build` | exit 0（全12ルート） | 9.3s |
| `check-world-sync-integrity.mjs` | exit 0 / 整合性 OK（13,009 / 47,479 / 19 不変） | 0.8s |
| `black-box-world-ui.mjs` | exit 0 / **82/82 PASS** | 1.2s |
| `black-box-world-sync.mjs`（eFHUB 回帰） | exit 0 / 35/35 PASS | 0.9s |
