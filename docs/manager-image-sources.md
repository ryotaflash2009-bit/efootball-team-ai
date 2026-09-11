# 監督画像ソース 候補サイト別調査（3回目・全候補）

作成日: 2026-08-28 / 今回の外部アクセス: **23 リクエスト**（上限40以内）。GET のみ・逐次・間隔3秒・20秒・再試行なし・Cookie/認証/APIキーなし・UA偽装なし・redirect 非追跡・未確認API総当たりなし・パス辞書なし。

## 結論

**監督画像は実装しない。現在のイニシャルアバターを維持する。**

候補 6 サイトすべてが **C / D / E** 判定（A・B なし）。ユーザー規定「全候補が利用不可または利用条件不明の場合は、イニシャルアバターを維持して停止」に該当。

| # | サイト | 判定 | 決定的理由 |
|---|---|---|---|
| 1 | eFootball DB（`efootballdb.com`） | **C / E** | 利用規約・プライバシー・About すべて 404。権利表記は「eFootball assets property of KONAMI」の免責のみ（再利用許諾ではない）。監督画像は非公開 API `api.efootballdb.com/api/2022/` 経由の KONAMI レンダー。監督 ID との対応表なし。（前回調査） |
| 2 | eFootBase（`efootbase.com`） | **E** | **robots.txt が `User-Agent: ClaudeBot` / `anthropic-ai` / `Claude-Web` に `Disallow: /`**。加えて `home` が HTTP 429。robots.txt 回避は停止条件 → これ以上アクセスしない |
| 3 | EFScout（`efscout.app`） | **D** | **監督/コーチのセクションが存在しない**。`/managers` 404・`/coaches` 404・`/data/boot.json` は選手カードのみ（`player_id` / `player_type` / `image_url`、`manager`/`coach` の文字列すら無し）。「eFootball Player Database & Tools」= 選手専用 |
| 4 | eFootBox（`www.efootbox.com`） | **D / E** | `/managers` 404・利用規約/プライバシー 404。robots.txt に **Content-Signal `ai-train=no, use=reference`（EU 指令 2019/790 第4条に基づく権利の明示的留保）**。トップに「not affiliated with or endorsed by KONAMI」 |
| 5 | amine250（リポジトリ + GitHub Pages） | **C** | `LICENSE` / `CREDITS.md` / `NOTICE` / `data/photos/README.md` すべて 404 → リポジトリに再配布許諾もクレジットも一切なし。画像は KONAMI レンダー + 他サイト透かし入りクロップの混在。同名別カードは別画像。（前回調査 + 今回の LICENSE/CREDITS/NOTICE 404 確認） |
| 6 | KONAMI eFootball 公式（`www.konami.com/efootball/`） | **D** | マーケティングサイト。**監督データベース・監督個別画像なし**。掲載ライセンスは楽曲・サッカー連盟（RFEF/KNVB）等の表示のみ。ゲームアセットは KONAMI の EULA 管理下（商用再配布不可） |

## サイト別の詳細（今回の追加確認）

### 2. eFootBase — robots.txt（抜粋・そのまま）

```
User-Agent: *
Disallow: /api/
Disallow: /*?*
Disallow: /en-US

User-Agent: GPTBot
Disallow: /

User-Agent: ClaudeBot
Disallow: /

User-Agent: anthropic-ai
Disallow: /
...
User-Agent: Claude-Web
Disallow: /
```

→ **ClaudeBot / anthropic-ai / Claude-Web を明示的に全面ブロック。** これ以上アクセスしない（robots.txt 回避はしない）。`home` は 429 も返した。

### 3. EFScout — robots.txt（抜粋）

```
User-agent: *
Allow: /
Disallow: /data/*.bin
Disallow: /data/seo.json
...
User-agent: ClaudeBot
Allow: /
...
User-agent: CCBot
Disallow: /
```

crawl は許可（ClaudeBot は Allow）。しかし:
- `/managers` → 404、`/coaches` → 404
- `/data/boot.json`（robots で Disallow 対象外）→ 200・`homePageData.konamiSections[].players[]` に **選手カードのみ**（`{"image_url":"https://images.efscout.app/cards-steam/f{playerId}.webp","player_id":"...","player_type":8,...}`）。`manager` / `coach` / `監督` の語は 0 件。

→ **監督セクションが無い（D）。**

### 4. eFootBox — robots.txt（Content-Signal）

```
# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ...

User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
```

`use=reference` = AI システムはコンテンツを「参照（リンク）」のみ可、取り込み・再配信は不可という明示的留保。加えて `/managers` 404・トップに「not affiliated with or endorsed by KONAMI」。→ **D/E。**

### 5. amine250 — 追加確認

`amine250.github.io/robots.txt` → 404（制限なし）。Pages トップ（`/efootball-managers/`）→ 200・GitHub リポジトリへのリンクのみ・著作権/ライセンス/クレジット文言なし。
`raw.githubusercontent.com/amine250/efootball-managers/main/{LICENSE, CREDITS.md, NOTICE, data/photos/README.md}` → **すべて 404**。
→ リポジトリに再配布許諾・帰属表記が一切ない（**C**・前回結論を強化）。

### 6. KONAMI 公式 — 追加確認

`www.konami.com/robots.txt` → 302（`img.konami.com/robots.txt` へ・非追跡）。`/efootball/ja/` → 200（マーケ）。`/efootball/ja/terms/` → 404、`legal.konami.com/games/` → 404。
掲載「Licenses」は `licence_rfef` / `licence_knvb`（サッカー連盟）等。フッターリンクは「クレジット（楽曲ライセンス）」「個人情報等保護方針」「DSA」。
→ **監督画像データベースは存在しない（D）。** eFootball のゲームアセット自体は KONAMI EULA 管理下。

## hotlink / proxy / cache / attribution / 商用条件

| 項目 | 結果 |
|---|---|
| hotlink 可否 | どのサイトも明示なし → ユーザー規定により「確認できない」＝不可 |
| proxy 再配信 可否 | 同上・不可。加えて eFootBox は Content-Signal で明示的留保 |
| cache 可否 | 同上・不可 |
| attribution（出典表記）条件 | 明示なし。出典表記で解決できる許諾（CC 等）も見当たらない |
| 商用/非商用 | 明示なし。eFootball DB / eFootBase 等は広告収益あり |

## 66監督との対応・取得可能件数

| 項目 | 値 |
|---|---|
| 現在の監督総数 | 66 |
| 高信頼で ID 対応でき **かつ** 利用可能（A/B）と確認できた画像 | **0** |
| （参考）amine250 経由で技術的に対応可能だが利用許可未確認（C） | 64（`nophoto.png` 2件除く） |
| 実装対象 | **0**（全件イニシャルアバター維持） |

## 実装

**なし。** 監督カード・監督詳細ともに現在のイニシャルアバター（`managerInitials()` — `src/components/managers/tactics.ts`）を維持。`managers.photo_path`（既存・amine250 由来の相対パス）は UI 未使用のまま非破壊で保持。SQLite への書き込みなし。ソースコード変更なし。

## 今回の全リクエストログ（23回）

| # | URL | 結果 |
|---|---|---|
| 1 | `efootbase.com/robots.txt` | 200（ClaudeBot Disallow / を確認） |
| 2 | `efootbase.com/` | 429 → 打ち切り |
| 3 | `efscout.app/robots.txt` | 200（ClaudeBot Allow /） |
| 4 | `efscout.app/` | 200 |
| 5 | `efscout.app/managers` | 404 |
| 6 | `efscout.app/terms` | 404 |
| 7 | `efscout.app/about` | 200（"Player Database & Tools"） |
| 8 | `www.efootbox.com/robots.txt` | 200（Content-Signal ai-train=no, use=reference） |
| 9 | `www.efootbox.com/` | 200（"not affiliated with KONAMI"） |
| 10 | `www.efootbox.com/managers` | 404 |
| 11 | `www.efootbox.com/terms` | 404 |
| 12 | `www.efootbox.com/privacy` | 404 |
| 13 | `amine250.github.io/robots.txt` | 404 |
| 14 | `amine250.github.io/efootball-managers/` | 200 |
| 15 | `raw.../amine250/.../data/photos/README.md` | 404 |
| 16 | `raw.../amine250/.../CREDITS.md` | 404 |
| 17 | `raw.../amine250/.../NOTICE` | 404 |
| 18 | `www.konami.com/robots.txt` | 302 → `img.konami.com`（非追跡） |
| 19 | `www.konami.com/efootball/ja/` | 200 |
| 20 | `www.konami.com/efootball/ja/terms/` | 404 |
| 21 | `legal.konami.com/games/` | 404 |
| 22 | `efscout.app/coaches` | 404 |
| 23 | `efscout.app/data/boot.json` | 200（選手カードのみ・監督なし） |

403 / CAPTCHA / ログイン要求: なし。429: eFootBase のみ（打ち切り）。robots.txt でのブロック: eFootBase（ClaudeBot）。

## 前回までの調査（再取得なし）

- `docs/phase-manager-photos.md` — amine250 リポジトリ（10 リクエスト）
- `docs/phase-manager-photos-efdb.md` — efootballdb.com（11 リクエスト）

3 回の調査・累計 44 外部リクエスト・6 サイトすべてで「eFootball 監督画像 = KONAMI のゲームアセット、ファンサイトに再配布許諾なし」を確認。一次ソース（eFootball World 公式 API）には選手画像しかなく、監督画像に相当する一次ソースは存在しない。
