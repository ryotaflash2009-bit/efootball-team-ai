# Phase: 監督画像の取得可能性 調査 その2（eFootball DB 最優先）

作成日: 2026-08-28 / 外部アクセス: **11 リクエスト**（GET のみ・逐次・間隔3秒・20秒・再試行なし・Cookie/認証/APIキーなし・UA偽装なし・redirect 非追跡・未確認API総当たりなし）

## 結論

**監督画像は実装しない。現在のイニシャルアバターを維持する。**（前回 [[phase-manager-photos]] の結論を維持）

判定カテゴリ: **C / E**（技術的には取得可能だが再利用許可を確認できない／ゲーム内レンダー＝KONAMI の著作物で権利者の再配布許諾がない）。
ユーザー指定の実装必須条件「ゲーム内レンダーの無断再配布にならない」「透かし付き第三者画像ではない」を満たせない。

## eFootball DB（efootballdb.com）— 確認内容 1〜25

| # | 項目 | 結果 |
|---|---|---|
| 1 | robots.txt | `https://www.efootballdb.com/robots.txt` → 200・`User-agent: *` / `Allow: /*`（23バイト・全許可・AI/bot 制限なし）。**crawl は禁止されていない** |
| 2 | 公開利用規約 | `/ja/terms` → **404**。フッターに規約リンクなし |
| 3 | プライバシーポリシー | `/ja/privacy` → **404** |
| 4 | 著作権・ライセンス表記 | ページ内に **`Copyright 2021, 2022 - eFootball assets property of KONAMI.`** のみ。これは「アセットは KONAMI の所有物」という**免責表示**であり、第三者への再利用許諾ではない。`/ja/about` → 404 |
| 5 | 監督一覧の公開構造 | `/ja/managers` → 200・**Next.js SPA**。初期 HTML は「Loading」状態。`__NEXT_DATA__` に監督データなし（i18n 文字列のみ・21KB）。監督一覧はクライアント JS が `api.efootballdb.com` から取得 |
| 6 | 監督個別プロフィールの公開構造 | 同様に SPA（`/ja/managers/profile?id={efdbId}` 形式）。`{efdbId}` は efootballdb 独自 ID で、本アプリの `internal_manager_id` / `source_manager_id` との対応表なし。ID を得るには非公開 API を叩く必要があり **未確認 API 総当たり = 禁止** のため未取得 |
| 7 | 監督画像の有無 | ページ JS チャンク（`pages/managers-5ea4c73914423555.js`）は画像ホストとして `api.efootballdb.com` を参照。監督画像は存在するとみられるが、**URL パターンはページレベルのコードに露出せず**（API レスポンス依存）。ページから直接見える画像は静的 UI のみ（`/img/app-logo.png` 等） |
| 8 | 画像URL | ページから直接特定できず（API 経由）。特定には非公開 API へのアクセスが必要 → 実施せず |
| 9 | 画像ホスト | `api.efootballdb.com`（efootballdb 自身の API ホスト）。API ベース: `https://api.efootballdb.com/api/2022/` |
| 10 | Content-Type | 未確認（画像 URL を特定できず取得せず） |
| 11 | 画像形式 | 未確認 |
| 12 | 画像サイズ | 未確認 |
| 13 | リダイレクト | 一覧ページ・data エンドポイント・チャンクとも redirect なし（200 直返し） |
| 14 | Cookie / 認証の必要性 | `www.efootballdb.com` は set-cookie を返さない。ログイン不要。画像特定のための API アクセス自体は未実施 |
| 15 | 透かしの有無 | 未確認（画像未取得）。ただし前回調査の amine250 経由 `deschamps.png` / `beckenbauer.png` は efootballdb 由来とみられるピンク/紫のレーティングボール要素を含んでいた |
| 16 | ゲーム内レンダーか | サイト説明「Search managers from eFootball 2022 **by KONAMI**」＋「eFootball assets **property of KONAMI**」より、監督画像は **KONAMI のゲーム内アセット（レンダー）**とみて確実 |
| 17 | eFootball DB 独自画像か | いいえ。KONAMI アセットの再掲 |
| 18 | 第三者サイト由来か | 一次的には KONAMI。efootballdb はファンによる集約サイト |
| 19 | 外部サイトでの埋め込み可否 | **明記なし**（規約ページ自体が存在しない）→ ユーザー規定により「再利用許可を確認できない」と判断 |
| 20 | 自前プロキシによる再配信可否 | **不可**（KONAMI アセットの無断再配布になる。efootballdb に許諾する立場もない） |
| 21 | キャッシュ可否 | 同上・不可 |
| 22 | 出典表記の条件 | 明記なし。出典表記で解決できる性質の許諾も見当たらない |
| 23 | 商用・非商用利用条件 | 明記なし。efootballdb 自体は広告収益あり（Google AdSense / DoubleClick） |
| 24 | 監督ID ↔ 画像URL の対応 | 未確立（efdb 独自 ID との対応表なし・API 依存） |
| 25 | 同名別カード ↔ 画像 | 未確認（efootballdb 側で個別カードを持つかも未確認）。本アプリ側は `source_manager_id` で別カードを保持済み（前回調査） |

## 他候補サイト（eFootball DB で明示利用可能画像を確認できなかったため最小確認）

| サイト | 結果 | 判定 |
|---|---|---|
| eFootBase（`efootbase.com`） | HTTP **429**（レート制限）→ **停止条件に該当し即中止** | 深掘りせず |
| EFScout（`efscout.com`） | `fetch failed`（DNS/接続不可・サイト不在の可能性） | 深掘りせず |
| eFootBox（`efootbox.com`） | 301 → `www.efootbox.com`（redirect 非追跡）。ファンサイトで KONAMI アセットを扱う点は共通と推定 | 深掘りせず |

いずれも eFootball（KONAMI）のゲームアセットを扱うファンサイトで、明示的な再利用ライセンスは見込めない。

## 外部アクセス記録（合計 11 回）

| # | URL | 結果 |
|---|---|---|
| 1 | `www.efootballdb.com/robots.txt` | 200・`Allow: /*` |
| 2 | `www.efootballdb.com/ja/terms` | 404 |
| 3 | `www.efootballdb.com/ja/privacy` | 404 |
| 4 | `www.efootballdb.com/ja/about` | 404 |
| 5 | `www.efootballdb.com/ja/managers` | 200・SPA・監督画像なし |
| 6 | `www.efootballdb.com/_next/data/{buildId}/ja/managers.json` | 200・i18n 文字列のみ（監督データ・画像なし） |
| 7 | `www.efootballdb.com/ja/managers`（フッター確認の再取得・67KB） | 200・`Copyright ... eFootball assets property of KONAMI.` |
| 8 | `www.efootballdb.com/_next/static/chunks/pages/managers-*.js` | 200・画像ホスト `api.efootballdb.com`・API ベース `/api/2022/` |
| 9 | `efootbase.com/` | **429** → 中止 |
| 10 | `efscout.com/` | fetch failed |
| 11 | `efootbox.com/` | 301（非追跡） |

429 以外の 403 / CAPTCHA / ログイン要求 / Cookie 必須 / 認証系リダイレクト: なし。`www.efootballdb.com` は set-cookie を返さない。

## 実装 / 非実装

**非実装。** 理由:
1. eFootball DB に**利用規約・ライセンスページが存在しない**（404）。唯一の権利表記は「eFootball assets property of KONAMI」＝ KONAMI 所有物の免責であり、第三者への再配布許諾ではない。ユーザー規定「明記なし → 再利用許可を確認できない」に該当。
2. 監督画像は **KONAMI のゲーム内レンダー**（サイト説明・著作権表記から確実）。自前プロキシでの再配信は**無断再配布**になる。ユーザーの実装必須条件「ゲーム内レンダーの無断再配布にならない」を満たせない。
3. 画像 URL の特定には efootballdb の**非公開 API（`api.efootballdb.com/api/2022/`）へのアクセスが必要**で、これは「未確認 API の総当たり」に当たるため実施しない。
4. 他候補（eFootBase / EFScout / eFootBox）も同種のファンサイトで、明示ライセンスは見込めず（eFootBase は 429 で即中止）。

## 変更なし

- 監督カード・監督詳細ともに現在のイニシャルアバター（`managerInitials()` — `src/components/managers/tactics.ts`）を維持。
- `managers.photo_path`（既存・amine250 由来のリポジトリ内相対パス）は UI 未使用のまま非破壊で保持。
- SQLite への書き込みなし。ソースコード変更なし。
