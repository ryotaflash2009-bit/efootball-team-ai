/**
 * sitemap.xml に載せる公開の画面（2026-10-08・配信は src/app/sitemap.xml/route.ts・登録しない間は 404）。新しい画面を足したら、ここ（載せる）か `SITEMAP_EXCLUDED_ROUTES`（載せない理由つき）の
 * どちらかへ入れる。`sitemap-routes.test.ts` が src/app の全ての page.tsx を調べ、どちらにも無い画面があれば失敗する
 * （ページが増えたときに載せ忘れない・載せてはいけない画面を載せない）。
 */
export interface SitemapRoute {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}

export const SITEMAP_ROUTES: readonly SitemapRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/players", changeFrequency: "daily", priority: 0.9 },
  { path: "/managers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/compare", changeFrequency: "weekly", priority: 0.7 },
  { path: "/squads", changeFrequency: "weekly", priority: 0.8 },
  { path: "/squads/templates", changeFrequency: "monthly", priority: 0.5 },
  { path: "/squads/compare", changeFrequency: "monthly", priority: 0.5 },
  { path: "/best-xi", changeFrequency: "weekly", priority: 0.7 },
  { path: "/boosters", changeFrequency: "weekly", priority: 0.6 },
  { path: "/managers/compare", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/support", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.2 },
];

/** 載せない画面と理由（動的な画面は別に扱う）。 */
export const SITEMAP_EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  "/my-team": "端末に保存した利用者の個人データの画面（検索から来ても空）",
  "/my-builds": "同上",
  "/favorites": "同上",
  "/build-inventory": "同上",
  "/diagnosis-history": "同上",
  "/data-management": "端末のデータの管理の画面",
  "/account": "アカウント（ログインが必要）",
  "/account/local-data-migration": "アカウント",
  "/account/my-team-cloud": "アカウント",
  "/account/public-id-preview": "内部の確認の画面（本番は 404）",
  "/account/rls-test": "内部の確認の画面（本番は 404）",
  "/auth/confirm": "認証",
  "/auth/forgot-password": "認証",
  "/auth/sign-in": "認証",
  "/auth/sign-up": "認証",
  "/auth/update-password": "認証",
  "/share/compare": "利用者が作った共有のリンク",
  "/share/diagnosis": "利用者が作った共有のリンク",
  "/community/local-posts": "内部の確認の画面（本番は 404）",
  "/release-readiness": "内部の確認の画面（本番は 404）",
  "/tier-pack-preview": "内部の確認の画面（本番は 404）",
};

/** 動的な画面（[id] など）の扱い。 */
export const SITEMAP_DYNAMIC_ROUTES: Readonly<Record<string, string>> = {
  "/players/[id]": "旧形式の選手の画面（載せない）",
  "/players/world/[worldCardId]": "13,000 件以上のデータの画面。載せるかは本人の判断（大量の薄い画面と見なされないか確認してから）",
  "/managers/[managerId]": "同上（69 件）。本人の判断",
  "/squads/[squadId]": "端末のスカッド（個人データ）",
  "/players/guide/[slug]": "選手の解説（公開にした記事だけを載せる・player-guides）",
};
