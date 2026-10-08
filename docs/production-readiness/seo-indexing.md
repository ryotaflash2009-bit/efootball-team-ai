# 検索エンジンへの登録（SEO）の準備と切り替え（2026-10-08）

本人の判断（2026-10-08）: **SEO の仕組みはすべて用意し、noindex は維持する**。公開は本人が環境変数で切り替える。

## 1. 今の状態（既定・何も設定しない場合）

| 項目 | 内容 |
|---|---|
| robots.txt | `User-Agent: *` / `Disallow: /`（今までと同じ） |
| meta robots | 全ページ `noindex, nofollow, nocache` |
| X-Robots-Tag | 全応答 `noindex, nofollow, noarchive` |
| canonical・Open Graph・Twitter カード | 出さない（noindex を打ち消さないため） |
| title・description | 全ての公開の画面に設定済み（イーフト・eFootball・チーム診断・AI・戦術 などを自然に含む） |
| sitemap.xml | **404**（noindex の間は配信しない・v1 の公開の契約）。登録を許可すると公開の画面 15 件＋公開にした選手の解説を返す |
| html lang | `ja` |
| トップの本文 | サーバーで HTML に含まれる（h1 は 1 つ）。フッターに非公式・KONAMI と無関係である旨を明記 |

## 2. 公開に切り替える手順（本人の操作）

1. 公開の前の確認: `data-distribution-rights-audit.md`（データ・画像の権利）・`legal-review-checklist.md`（法務）・独自ドメインへ移るかどうか。
2. Vercel → Project → Settings → Environment Variables（Production）に追加:
   - `NEXT_PUBLIC_SEARCH_INDEXING` = `enabled`
   - （独自ドメインへ移る場合）`NEXT_PUBLIC_SITE_URL` = `https://<ドメイン>`
   - （Search Console の HTML タグで確認する場合）`GOOGLE_SITE_VERIFICATION` = Search Console が示す `content` の値
3. 再デプロイ（`NEXT_PUBLIC_*` は build のときに埋め込まれるため、設定の後に Redeploy が必要）。
4. 確認: `/robots.txt` が `Allow: /`・`Disallow: /api/` などと `Sitemap:` を返す。ページの HTML に `index, follow`・canonical・`og:*` がある。
   応答に `X-Robots-Tag` が無い。
5. Google Search Console: プロパティを追加 → HTML タグで所有権を確認（上の環境変数）→ サイトマップ `https://<サイト>/sitemap.xml` を送信。
6. TeamAIXI の Release Validator の live の確認は「noindex であること」を確かめているため、公開に切り替えたら同時に更新する（Claude Code に依頼）。

戻す場合は `NEXT_PUBLIC_SEARCH_INDEXING` を消して再デプロイ（Search Console の「削除」で一時的に検索結果から外せる）。

## 3. 公開に切り替えた後の動き

| 項目 | 内容 |
|---|---|
| robots.txt | 全て許可。`/api/`（API の無駄な呼び出しを防ぐ）・`/auth/`・`/account/`・`/share/`（利用者の共有のリンク）は disallow。Sitemap を記載 |
| meta robots | `index, follow`（下書きの選手の解説は `noindex, follow` のまま） |
| X-Robots-Tag | 出さない |
| canonical | 各画面の正式な URL（`NEXT_PUBLIC_SITE_URL` が基準） |
| Open Graph・Twitter カード | 画面の title・description・既定の画像（`/og-image`・1200×630） |

## 4. 選手の解説の記事（土台）

- URL: `/players/guide/<slug>`（`/players/[id]` は既存の旧形式の選手の画面が使っているため、別の階層にした）。
- 記事は `src/content/player-guides.json` に人が書く（slug・worldCardId・title・description・published・updatedAt・sections）。
- `published: false` は noindex で sitemap に載せない。サンプル 2 件（メッシ BIG TIME・マルディーニ）は「ここに分析を書く」などの仮の構成で下書き。
- 記事から選手の詳細（能力値・育成計算）とチーム診断（スカッド）へ案内する。大量の自動生成はしない。

## 5. 載せない・判断が必要な画面

- 個人データの画面（My Team・My Builds・お気に入り・診断履歴・データ管理）・アカウント・認証・共有のリンク・内部の画面は sitemap に載せない。
- 選手の詳細（13,000 件以上）・監督の詳細（69 件）を sitemap に載せるかは本人の判断（大量のデータの画面が薄い内容と見なされないかを確認してから）。
  title・description は選手名・監督名（データの表記のまま）で設定済み。
- 新しい画面を足したら `src/lib/seo/sitemap-routes.ts` のどちらかへ入れる（入れないとテストが失敗する）。
