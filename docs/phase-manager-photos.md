# Phase: 監督画像の取得可能性 調査

作成日: 2026-08-28 / 外部アクセス: **10 リクエスト**（`github.com` / `raw.githubusercontent.com` への GET のみ・逐次・間隔3秒・20秒・再試行なし・Cookie/認証/APIキーなし・redirect 非追跡）

## 結論

**監督画像は実装しない。現在のイニシャルアバターを維持する。**

理由:
1. **再配布ライセンスがない** — 唯一到達できる画像ソース（amine250/efootball-managers 公開リポジトリ）に **LICENSE ファイルが存在しない**（`main/LICENSE` → HTTP 404）。README にもライセンス記載なし。GitHub の既定では「All rights reserved」= 我々のプロキシ経由で再配布する法的根拠がない。
2. **第三者の著作物・出所が混在** — 画像は (a) eFootball ゲーム内の監督レンダー（Konami の著作物・e⚽ ヘキサゴンバッジ入り）と (b) 別サイト（efootballdb.com とみられる）のレーティングボール透かし入りクロップ が混在。別プロダクトのブランド要素を自前プロキシで再配信することになり、出所を偽ることにもなる。
3. **一次ソースではない** — World の**選手**画像は eFootball World 自身の公式 API/CDN（`d1zxa6glxh8sq9.cloudfront.net`）から同期しているが、**監督**画像に相当する一次ソースへは到達できない（efootballdb は同様に第三者著作物、eFHUB は robots.txt でブロック済み [[efhub-detail-sync-blocked]]）。
4. **URL が不安定** — ファンリポジトリの `main` ブランチ HEAD。コミットで写真ファイルの差し替え・リネームが起こり得る。content-addressed ではない。

robots.txt 上は取得自体を禁止していない（下記）。停止の根拠は**ライセンス欠如と出所の不安定さ**（ユーザー指定の停止条件「利用条件で画像取得が禁止」「画像ホスト（＝出所）を安全に固定できない」に該当）。

## 調査の詳細（完了報告の 1〜13 項目に対応）

### 1. 現在の managers.json に画像関連フィールドがあるか

**ある。** `managers.json` の各要素に `photo` フィールド（README のデータモデルにも "Photo URL" と記載）。
本アプリの `scripts/sync-managers.mjs` は既にこれを `managers.photo_path` へ保存済み（`schema.sql:424` — コメントに「画像取得はしない」）。

| 状態 | 件数 |
|---|---|
| `managers` 総数 | 66 |
| `photo_path` あり | 66 / 66 |
| `photo_path` の種類 | 65（`nophoto.png` が 2 件で重複） |

### 2〜3. 画像の所在

`data/photos/{slug}.png`（リポジトリ内相対パス）。公開 JSON（`managers.json`）の `photo` フィールドに記載。
raw 取得 URL: `https://raw.githubusercontent.com/amine250/efootball-managers/main/data/photos/{slug}.png`。
HTML パース・未確認 API の総当たりは不要（公開 JSON に直接記載）。

### 4. 監督ID ↔ 画像URL の対応

`managers.internal_manager_id` → `photo_path`（`data/photos/{slug}.png`）。slug は `source_manager_id` とほぼ対応（例外あり: `cfabregas`→`fabregas.png`、`dstojkovic`→`stojkovic.png`）。

### 5. 画像ホスト

`raw.githubusercontent.com`（固定・単一）。redirect なし（今回の 5 画像すべて 200 直返し）。
（`github.com` はレスポンスに set-cookie を付けるが、`raw.githubusercontent.com` は付けない。Cookie は送らず保存もしない。）

### 6. 画像形式

すべて `image/png`（PNG マジックバイト `89504e470d0a1a0a` 確認）。

| ファイル | Content-Length | 形式 | 内容 |
|---|---|---|---|
| `conte.png` | 127,123 B | PNG | eFootball ゲーム内監督レンダー（e⚽ バッジ） |
| `deschamps.png` | 232,396 B | PNG | 別サイト風クロップ（ピンクのボール透かし1個） |
| `deschamps2.png` | 140,749 B | PNG | eFootball ゲーム内監督レンダー（e⚽ バッジ） |
| `beckenbauer.png` | 231,973 B | PNG | 別サイト風クロップ（紫のボール透かし2個） |
| `nophoto.png` | 29,156 B | PNG | グレーのシルエット（ソース側のプレースホルダー） |

いずれも 3MB 以下・HTTPS・トークン/署名/Cookie なし。

### 7. 総取得可能件数

`photo_path` が `data/photos/nophoto.png` 以外のもの = **64 件**（66 − `nophoto` 2 件）。ただし前項のとおり内容の出所が混在。

### 8. 同名別カードの画像対応

**別カードは別画像。** 人物名だけで統合していないことを再確認:

| 人物 | カードA | カードB |
|---|---|---|
| D. Deschamps | `deschamps.png`（232KB・別サイト風） | `deschamps2.png`（141KB・ゲーム内） |
| F. Beckenbauer | `beckenbauer.png`（232KB・別サイト風） | `beckenbauer2.png` |
| Frank Lampard | `lampard.png` | `lampard2.png` |
| Johan Cruyff | `cruyff.png` | `cruyff2.png` |
| Hansi Flick | `flick1.png` | `flick2.png` |
| José Mourinho | `mourinho1.png` | `mourinho2.png` |
| Frank Rijkaard | `rijkaard1.png` | `rijkaard2.png` |

サイズが異なり内容も異なる。名前での自動統合はしていない（`source_manager_id` で区別）。

### 9. robots.txt と利用条件

- `raw.githubusercontent.com/robots.txt` → **404**（root に robots.txt なし。raw コンテンツ CDN）。
- `github.com/robots.txt` → 200。`User-agent: *` は `/*/tree/` `/*/*/commits/` `/*/*/compare` 等の **github.com の HTML ビュー**を Disallow。`/*/blob/` や raw コンテンツ、`/amine250/` への言及なし。ClaudeBot ルールなし。
  → **取得（crawl）自体は robots.txt 上は禁止されていない。**
- amine250 リポジトリ: **LICENSE なし（404）**。README にライセンス記載なし。→ **再配布の許諾がない。**

### 10. 表示・キャッシュ方法（実装するなら、の想定）

自前プロキシ `/api/manager-image/{internalManagerId}` + 許可ホスト `raw.githubusercontent.com` 限定 + 3MB 上限 + `Content-Type` 検証 + redirect 非追跡 + メモリキャッシュ + `Cache-Control: public, max-age=86400`。→ **技術的には可能だが、上記ライセンス上の理由で実装しない。**

### 11. robots.txt と利用条件（再掲・9 参照）

robots.txt: 禁止なし。利用条件: 明示ライセンスなし = 再配布不可。

### 12. 自前プロキシで表示可能か

技術的には可能（ホスト固定・PNG・3MB以下・署名なし）。**ライセンス上は不可**。

### 13. 画像がない監督のフォールバック

ソース側に `data/photos/nophoto.png`（グレーシルエット）。本アプリでは現在の **イニシャルアバター**を継続使用（`managerInitials()` — `src/components/managers/tactics.ts`）。

## 代表監督3件の確認結果

| 監督 | ID | photo_path | 取得 | 内容 |
|---|---|---|---|---|
| Antonio Conte | 65 | `data/photos/conte.png` | 200 / image/png / 127KB | ゲーム内レンダー |
| D. Deschamps | 23 / 64 | `deschamps.png` / `deschamps2.png` | 両方 200 / image/png | A=別サイト風, B=ゲーム内（別画像） |
| F. Beckenbauer | 30 / 57 | `beckenbauer.png` / `beckenbauer2.png` | 30 は 200 / image/png / 232KB | 別サイト風（2個目は未取得・予算節約） |

## 実装

**なし。** 監督カード・監督詳細ともに現在のイニシャルアバターを維持。`managers.photo_path` は既存データのまま（UI では未使用・非破壊）。

## 外部アクセス記録（合計 10 回）

| # | URL | 結果 |
|---|---|---|
| 1 | `raw.githubusercontent.com/robots.txt` | 404（root に robots なし） |
| 2 | `github.com/robots.txt` | 200 / 623B |
| 3 | `github.com/robots.txt`（本文取得の再取得） | 200 |
| 4 | `raw.../amine250/efootball-managers/main/README.md` | 200 |
| 5 | `.../data/photos/conte.png` | 200 / image/png / 127KB |
| 6 | `.../data/photos/deschamps.png` | 200 / image/png / 232KB |
| 7 | `.../data/photos/deschamps2.png` | 200 / image/png / 141KB |
| 8 | `.../data/photos/beckenbauer.png` | 200 / image/png / 232KB |
| 9 | `.../data/photos/nophoto.png` | 200 / image/png / 29KB |
| 10 | `.../amine250/efootball-managers/main/LICENSE` | 404（ライセンスなし） |

429 / 403 / CAPTCHA / ログイン要求 / 認証系リダイレクト: **なし**。

## 再調査するなら

将来 eFootball World の公式 API に監督データ（画像 URL 含む）が見つかれば、選手画像と同じ一次ソース方針で再検討可能。その場合も出所の一次性・ホスト固定・署名なしを確認してから。
