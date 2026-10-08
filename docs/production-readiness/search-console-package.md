# Google Search Console の登録（本人の操作・2026-10-09）

Claude Code は Search Console へのログイン・所有権の確認を代行しない。下の順に本人が操作する。

前提: Production で `NEXT_PUBLIC_SEARCH_INDEXING=enabled` を設定して再デプロイ済みで、
`BASE_URL=https://efootball-team-ai.vercel.app node scripts/validate-search-indexing.mjs` が `SEARCH_INDEXING_ENABLED`。

## 1. プロパティの追加

1. https://search.google.com/search-console を開き、Google アカウントでログイン。
2. 左上のプロパティの選択 →「プロパティを追加」。
3. **「URL プレフィックス」** を選ぶ（ドメイン プロパティは DNS の設定が必要で、`vercel.app` では使えない）。
4. 入力: `https://efootball-team-ai.vercel.app/` →「続行」。

## 2. 所有権の確認（HTML タグ）

1. 確認方法の一覧から **「HTML タグ」** を開く。`<meta name="google-site-verification" content="XXXX" />` の **content の値（XXXX）だけ** をコピー。
2. Vercel → Project（efootball-team-ai）→ Settings → Environment Variables →「Add New」:
   - Key: `GOOGLE_SITE_VERIFICATION`
   - Value: コピーした値（引用符・空白・改行を入れない）
   - Environments: **Production だけ** にチェック
3. Vercel → Deployments → 最新の Production →「…」→「Redeploy」。
4. 再デプロイが終わったら Search Console に戻り「確認」。

## 3. サイトマップの送信

1. 左のメニュー「サイトマップ」。
2. 「新しいサイトマップの追加」に `sitemap.xml` と入力（先頭の URL は自動で入る）→「送信」。
3. 状態が「成功しました」になり、検出された URL の数が表示される（固定の画面 15 件＋監督の詳細＋選手の詳細）。

## 4. URL 検査とインデックス登録のリクエスト

1. 上の検索欄（「URL 検査」）に `https://efootball-team-ai.vercel.app/` を入力して Enter。
2. 「公開 URL をテスト」→「ページはインデックスに登録できます」を確認 →「インデックス登録をリクエスト」。
3. 同じ手順で数件:
   - `https://efootball-team-ai.vercel.app/players`
   - `https://efootball-team-ai.vercel.app/managers`
   - `https://efootball-team-ai.vercel.app/squads`
   - `https://efootball-team-ai.vercel.app/best-xi`
4. 1 日に送れるリクエストの数には上限がある。選手の詳細は sitemap に任せ、個別に送らない。

## 5. その後

- 数日〜数週間で「ページ」（インデックス作成）に登録の状況が出る。「noindex タグによって除外されました」に出るのは非公開の画面（想定どおり）。
- 公開の画面が除外されていたら、URL と理由を Claude Code に伝える。
