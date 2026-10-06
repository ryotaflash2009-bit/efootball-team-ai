# Vercel Web Analytics（2026-10-07 導入）

| 項目 | 内容 |
|---|---|
| プラン | Hobby（本人が有効化）。課金プランへは変更しない。上限は月 50,000 イベント |
| 計測 | Page Views と Visitors だけ。Custom Event は追加していない |
| 実装 | `@vercel/analytics` 2.0.1（`@vercel/analytics/next`）。root layout に `<SiteAnalytics />` を 1 回だけ。本体は `next/dynamic`（`ssr: false`）で別の chunk |
| 通信 | 同じオリジンの `/_vercel/insights/script.js`・`/_vercel/insights/view`（Vercel の本番・preview でだけ動く。ローカルの `next start` では送らない） |
| Cookie | 使わない（Vercel Web Analytics は Cookie を使わない。追加の Cookie なし） |
| CSP | 変更なし（`'self'` で足りる） |

## 送る前の整理（`src/lib/analytics/sanitize-analytics-event.ts`・テストあり）

- URL の `?` 以降と `#` 以降は必ず落とす（共有の payload・token・認証の code・reset の link・検索語・タブの指定を送らない）。
- 送らない画面: `/auth/*`（callback・password の再設定を含む）・`/account*`・`/api/*`・内部ページ（`internal-pages.ts`）・`/__*`（非公開ページの置き換え先）。
- 利用者が作ったスカッドの ID は `/squads/[id]` に置き換える。
- 送らない端末: `navigator.webdriver`・User-Agent が HeadlessChrome / Lighthouse / Playwright / Puppeteer・Do Not Track・Global Privacy Control・
  `localStorage["efootball-team-ai:analytics-opt-out:v1"] = "1"`（運営者自身の端末の除外に使える）。
- 個人を識別する情報は送らない（送るのは整理したパス・参照元・国・ブラウザー・OS・端末の種類。集計は Vercel 側）。

## 数字の読み方の注意

- このリポジトリの black-box・本番の読み取りの確認・性能の計測は headless の Chrome（User-Agent に HeadlessChrome）で動くため送らない。
  ローカル（localhost）の確認はそもそも送らない。
- Do Not Track・Global Privacy Control・広告ブロッカーの利用者は数に入らない（実際の利用者より少なく出る）。
- 2026-10-07 の導入より前の期間は 0（それ以前の利用は計測していない）。noindex の間は検索からの流入はほぼ無い。
- 内部ページ・認証の画面は数に入らない。共有の URL は `/share/diagnosis` 等のパスだけで数える。
- Visitors は Vercel の日ごとの識別子（Cookie なし）で数えるため、日をまたいだ同じ人の重複は区別しない。

## 確認の画面

Vercel Dashboard → Team → Project `efootball-team-ai` → 上部の **Analytics** タブ。
期間（Last 24 hours 等）を選ぶと Visitors・Page Views・Bounce Rate、下に Pages（Top Pages）・Referrers・Countries・Devices・Browsers・OS。
反映は通常数分以内（最大 30 分程度）。Hobby の利用量は **Settings → Billing → Usage**（Web Analytics Events）で確認する。

## 上限の見積もり

招待制の間の想定（1 日数十〜数百の Page View）では月 50,000 を大きく下回る。上限に近づいた場合は計測が止まるだけで、サイトは動く。
Custom Event を追加する場合はイベント数が増えるため、本人の判断の後に行う。
