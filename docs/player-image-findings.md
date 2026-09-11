# 選手画像の配信方法 調査結果

調査日時: 2026-08-27T19:24:09.231Z
対象: Lionel Messi (89138556575063) / Fabio Cannavaro (88041460996837)

## 実行した外部リクエスト（合計4回）

- 個別ページ GET × 2（scripts/investigate-player-images.mjs）
- efimg.com への HEAD × 2（scripts/head-check-images.mjs）
- 画像バイナリのダウンロード・保存: 0。GET / Range GET: 未使用。

## 1. 個別ページ

| 選手 | ページURL | HTTP | 本文サイズ | 抽出候補数 |
|---|---|---|---|---|
| Lionel Messi | https://efhub.com/players/89138556575063 | 200 | 207529 bytes | 72 |
| Fabio Cannavaro | https://efhub.com/players/88041460996837 | 200 | 194816 bytes | 37 |

- リダイレクト / ログイン要求 / Cookie 要求 / CAPTCHA: なし

## 2. 抽出できた選手カード画像URL（ページ本文に実在。推測なし）

| 選手 | 画像URL |
|---|---|
| Messi | https://efimg.com/efootballhub22/images/player_cards/89138556575063_l.png |
| Cannavaro | https://efimg.com/efootballhub22/images/player_cards/88041460996837_l.png |

関連パターン（同一ページに多数の他選手カードで確認）:

- カード画像: `https://efimg.com/efootballhub22/images/player_cards/{playerId}_l.png`
- ミニカード: `https://efimg.com/efootballhub22/images/mini-cards/mini-cards/{playerId}_l.png`
- 国籍アイコン: `https://efimg.com/efootballhub22/images/symbol/Nationality/{code}.png`（Messi=144 / Cannavaro=215）
- エンブレム: `https://efimg.com/efootballhub22/images/symbol/Emblem/e_XXXXXX.png` / `.../symbol/EmblemLC/emb_XXXX.png`
- eFHUB 自身の UI 画像は別ホスト: `https://efhub.com/icons/*`, `https://efhub.com/_next/image?url=...`
- 広告バッジ: `https://www.playwire.com/hubfs/...`（広告。対象外）

## 3. efimg.com への HEAD 結果（実測）

### https://efimg.com/efootballhub22/images/player_cards/89138556575063_l.png

- HTTP: 200
- content-type: image/png
- content-length: 191865
- etag: "a90a26ba605ca32fa3aa453301247f47"
- last-modified: Sun, 26 Jul 2026 13:28:09 GMT
- cf-cache-status: DYNAMIC
- cf-ray: a31d727988c2fcb8-KIX
- server: cloudflare
- accept-ranges: bytes
- 画像形式（Content-Type から）: PNG

### https://efimg.com/efootballhub22/images/player_cards/88041460996837_l.png

- HTTP: 200
- content-type: image/png
- content-length: 177194
- etag: "e89fa092cba81e737162b5c60365d60c"
- last-modified: Thu, 16 Jul 2026 17:02:57 GMT
- cf-cache-status: DYNAMIC
- cf-ray: a31d727faa6efc67-KIX
- server: cloudflare
- accept-ranges: bytes
- 画像形式（Content-Type から）: PNG

## 4. 判定

| 項目 | 結果 |
|---|---|
| 画像ホスト | **efimg.com**（eFHUB 本体 efhub.com とは別ドメイン） |
| URL テンプレート | `https://efimg.com/efootballhub22/images/player_cards/{playerId}_l.png` |
| 2選手で同一テンプレート | はい |
| 画像URLに選手ID（= player-index.json の i）が含まれるか | **はい** |
| カード違いの区別 | **カードごとに一意な選手ID を使うため、別カード = 別URL**（追加のカード種別コード不要） |
| 画像URLの自動生成 | **可能**（保存済み id をテンプレートに差し込む） |
| 個別ページからの抽出は必須か | **必須ではない**（id から組み立て可能。特殊カードの確認時のみ抽出が有用） |

### 確認済み事項
- 上記 HEAD のステータス・ヘッダー（実測）。
- 選手カード画像URLのテンプレートと、2選手での一致。
- 個別ページ（efhub.com）に選手画像が efimg.com の絶対URLで直接記載されていること。

### 推測事項
- `_l` は large（大サイズ）の意味。他サイズ（`_m` など）の有無は未確認。
- efimg.com は eFHUB の画像配信専用ドメイン（パスに `efootballhub22` を含むため）。

### 未確認事項
- 画像が存在しないカードの応答（404 か 既定シルエット画像か）。
- efimg.com / efhub.com の画像利用に関する規約・robots.txt。
- 同一選手の複数カードでのミニカード/シンボルの挙動。
- HEAD で得られなかったヘッダー（あれば）。

## 5. 推奨する Next.js 表示方式

本プロジェクトの原則「画面は外部を直接呼ばない / 通常表示は自前データ」を踏まえた推奨:

- **案A（推奨）: 自前プロキシ** — `/api/player-image/[id]` を作り、サーバー側で efimg.com から取得→キャッシュ→返す。
  - 画面（クライアント）は自前URLのみ参照。配信元を晒さない。
  - `next.config.mjs` の `images.remotePatterns` 変更が不要（同一オリジン扱い）。
  - 取得失敗時にプロキシがプレースホルダーを返せる。
- 案B: `next/image` 直リンク + `images.remotePatterns` に `efimg.com` のみ追加。最小実装だがクライアントが外部ホストへアクセス。
- 案C: 選手同期時に画像を自前ストレージへ事前ダウンロード。10万人規模に最適だが今回スコープ外（大量DL）。

> 注: 今回のフェーズでは next.config.mjs / package.json / src/ を変更していません。次フェーズで案Aの実装計画を作成する想定。

## 6. 推奨するキャッシュ方式

- efimg.com の `Cache-Control` / `ETag`（上記実測値）を尊重。
- 案A採用時: プロキシ応答に `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` を付与。
  任意で `src/data/image-cache/`（.gitignore 対象）へディスクキャッシュ。ETag による条件付きリクエストで再取得を最小化。
- `next/image` は最適化後の画像を `.next/cache/images` に自動キャッシュ（WebP/AVIF 変換込み）。

## 7. プレースホルダー設計

- ローカルの SVG シルエット部品を1つ用意（eFHUB の画像なしカードが白いシルエットだったのに合わせる）。
- 表示条件: 画像URL不明 / 取得失敗 / 404 / 画像でない Content-Type / タイムアウト。
- 案A: プロキシが配信元エラー時にプレースホルダー画像バイトを返す（サーバー側で完結）。
- 案B: `next/image` の `onError` でクライアント側フォールバック。
- 画像の読み込み失敗でカード描画をブロックしない（固定アスペクト比の枠 + `loading="lazy"`）。

## 8. 次の調査（今回スコープ外）

- 同一選手の複数カード（例: Messi の 107/106/105）でURLを比較し、カード識別子の規則を確定。
- 画像が存在しないカードの応答確認。
- 他サイズ（`_m` など）の有無。
- eFHUB / efimg.com の規約・robots.txt 確認。

