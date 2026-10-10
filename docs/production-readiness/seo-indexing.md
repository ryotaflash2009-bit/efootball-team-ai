# 検索エンジンへの登録（SEO）（2026-10-08 準備・2026-10-09 公開の決定）

- 2026-10-08 本人の判断: SEO の仕組みをすべて用意し、noindex は維持する。
- **2026-10-09 本人の正式決定: TeamAIXI を Google 検索へ公開する**。公開する画面だけを検索に出し、非公開・共有・認証・内部・下書き・
  未レビューの言語・将来の機能は出さない。独自ドメインが無いことを理由に止めない（今の Vercel の Production URL を正式な URL にする）。

正式な URL（canonical の基準）: `https://efootball-team-ai.vercel.app`（`NEXT_PUBLIC_SITE_URL` が無いときの既定。`src/lib/public-info/search-indexing.ts`）

## 1. 切り替え

| 状態 | 条件 | robots.txt | meta robots | X-Robots-Tag | canonical・OGP | sitemap.xml |
|---|---|---|---|---|---|---|
| 公開しない（既定） | `NEXT_PUBLIC_SEARCH_INDEXING` が無い | `Disallow: /` | 全ページ noindex | 全応答 noindex | 出さない | 404 |
| **公開** | Production に `NEXT_PUBLIC_SEARCH_INDEXING=enabled` | `Allow: /`・非公開を disallow・`Sitemap:` | 公開の画面は `index, follow`・非公開は個別に noindex | 公開の画面は無し・非公開と正式な URL 以外のホストは `noindex, nofollow` | 公開の画面だけ | 200 |

`NEXT_PUBLIC_*` は build のときに埋め込まれるため、設定の後に **Production の再デプロイ** が必要。

## 2. 検索に出す画面・出さない画面

| 出す（sitemap に載せる） | 出さない（個別に noindex・または 404） |
|---|---|
| `/`・`/players`・選手の詳細 `/players/world/<ID>`（World の全カード）・`/managers`・監督の詳細 `/managers/<ID>`・`/compare`・`/squads`・`/squads/templates`・`/squads/compare`・`/best-xi`・`/boosters`・`/managers/compare`・`/about`・`/support`・`/terms`・`/privacy`・`/disclaimer`・`published: true` の選手の解説 | `/api/`・`/auth/*`（ログイン・新規登録・パスワードの再設定・メールの確認）・`/account*`・`/share/*`（共有のリンク）・端末だけの画面（`/my-team`・`/my-builds`・`/favorites`・`/build-inventory`・`/diagnosis-history`・`/data-management`）・端末のスカッド `/squads/<ID>`・旧形式の選手の画面 `/players/<ID>`・下書きの記事・内部の画面（本番は 404: `/release-readiness`・`/tier-pack-preview`・`/community/*`・`/account/rls-test`・`/account/public-id-preview`）・404 の画面 |

- 判定の一か所: `noindexReasonForPath`（`search-indexing.ts`）。middleware が X-Robots-Tag を付け、各ページの metadata も noindex（`PRIVATE_PAGE_ROBOTS`）。
- 正式な URL 以外のホスト（デプロイごとの `*-<hash>.vercel.app`・Preview）は全て `noindex, nofollow`（`isCanonicalHost`）。
- robots.txt だけで守らない: 認証・404（内部の画面）・個別の noindex をそのまま保つ。
- 未レビューの追加 10 言語は公開していない（言語は URL を分けず、本番で選べるのは ja・en だけ）。言語ごとの URL・hreflang は作らない。
- sitemap に入れないもの: 共有のリンク・トークン・メールアドレス・利用者の ID・内部の ID・診断の内容・クエリ付きの URL・重複・下書き。

## 3. canonical

- 各画面の canonical は `NEXT_PUBLIC_SITE_URL`（既定は上の正式な URL）＋ 経路。クエリ（`?tab=`・`utm_*` など）は含めない。
- 選手・監督の詳細は ID ごとの URL。共有のリンク・Preview・デプロイごとの URL は canonical にならない。

### 独自ドメインへ移るときの canonical の移行（将来）

1. ドメインを Vercel の Project に追加し、Production に割り当てる（旧 `efootball-team-ai.vercel.app` は残す）。
2. Production の環境変数 `NEXT_PUBLIC_SITE_URL=https://<ドメイン>` を設定して再デプロイ → canonical・Open Graph・robots.txt の Sitemap・sitemap.xml の URL が一括で新しいドメインになる（コードの変更は不要）。
3. 旧 URL から新しいドメインへ 301 で転送する（Vercel の Domains で `efootball-team-ai.vercel.app` → Redirect）。旧ホストは `isCanonicalHost` で noindex になる。
4. Search Console に新しいドメインのプロパティを追加し、sitemap を送信。旧プロパティで「アドレス変更」は独自ドメイン同士でしか使えないため、301 と canonical で移す。
5. `node scripts/validate-search-indexing.mjs`（BASE_URL・ORIGIN を新しいドメイン）で SEARCH_INDEXING_ENABLED を確認。

## 4. metadata

- title・description は全ての公開の画面で一意（選手・監督の詳細は名前入り・データの表記のまま翻訳しない）。日本語・TeamAIXI を含む。キーワードを詰め込まない。
- Open Graph・Twitter カード（`summary_large_image`）・既定の画像 `/og-image`（自前で生成・第三者の画像を使わない）。
- 非公式の表記（フッター・免責事項・利用規約）: 非公式・KONAMI の公式／公認／提携ではない・商標は各権利者・誤りや遅延の可能性・結果を保証しない。
- 構造化データ（JSON-LD・2026-10-09）: 公開中だけ、ホームに `WebSite`、選手・監督の詳細に `BreadcrumbList`（ホーム > 一覧 > 名前）。事実だけで、評価・価格・レビュー・公式を名乗る項目は出さない。`<` を逃がして出力（`structured-data.ts`）。Validator が JSON として読めること・種類・パンくずの最後が canonical と同じことを確かめる。

## 5. 選手の解説の記事

- URL: `/players/guide/<slug>`。記事は `src/content/player-guides.json` に人が書く。
- `published: false` は noindex・sitemap に入れない・ナビゲーションに出さない・「下書き」と表示。今の 2 件（メッシ・マルディーニ）は下書きのまま。
- `published: true` にできるのは、事実の確認・独自の分析・利用者の価値・内部のリンク・出典・更新日が揃った記事だけ。大量の自動生成はしない。

## 6. 確認（Indexing Release Validator）

```
BASE_URL=https://efootball-team-ai.vercel.app node scripts/validate-search-indexing.mjs
```

- `SEARCH_INDEXING_ENABLED`: 公開中で、robots・meta・X-Robots-Tag・sitemap・canonical・metadata・非公開・共有・下書き・内部・法務の表示・5xx が全て合格。
- `SEARCH_INDEXING_READY`: コードは準備済みで、切り替え（環境変数）だけが残る（全体が noindex のまま矛盾なし）。
- `SEARCH_INDEXING_BLOCKED`: どれかが不合格（`blocked` に理由）。
- v1・v1.1 の Release Validator の live の確認は、robots.txt から状態を読み、公開中は「公開の契約」を確かめる（2026-10-09 に更新）。

戻す場合: Production の `NEXT_PUBLIC_SEARCH_INDEXING` を消して再デプロイ（Search Console の「削除」で一時的に検索結果から外せる）。

Search Console の登録の手順: `search-console-package.md`

## 7. 完了（2026-10-10・本人の判断）

本人の操作（2026-10-10）: Production に `NEXT_PUBLIC_SEARCH_INDEXING=enabled` を設定して再デプロイ（Ready / Current）・
Search Console の URL プレフィックスの所有権の確認（HTML タグ）・sitemap.xml の送信（「サイトマップは正常に処理されました」）。

読み取りだけの最終の確認（Evidence `evidence/search-indexing-enabled-2026-10-10.json`）:
**SEARCH_INDEXING_ENABLED**（問題 0 件・要求 59 件）・sitemap.xml 13,456 URL（重複 0）・本番の総合 black-box 576/576・
端末の保存データありの hydration の確認 95/95。本人の判断で**検索への公開は完了**。追加の SEO の修正はしない。

経過の確認: 数日〜数週間後に Search Console の「ページ」を見る。非公開の画面の除外は想定どおり。公開の画面の予期しない除外だけを調べる。
