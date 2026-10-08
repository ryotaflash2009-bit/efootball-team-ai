/**
 * Indexing Release Validator（2026-10-09・本人の正式決定「TeamAIXI を Google 検索へ公開」）。
 *
 * - SEARCH_INDEXING_ENABLED: robots.txt が公開の状態で、公開・非公開・下書き・sitemap・canonical・metadata・法務の表示がすべて矛盾しない。
 * - SEARCH_INDEXING_READY: コードは公開の準備ができており、切り替え（NEXT_PUBLIC_SEARCH_INDEXING=enabled）だけが残る。
 *   まだ全体が noindex で、その状態でも矛盾が無い。
 * - SEARCH_INDEXING_BLOCKED: どれかが不合格。
 *
 * 判定は純関数。live の確認は fetchText(path) → { status, headers(小文字), body } を引数で受け取る（GET だけ・何も変えない）。
 * 環境変数の値は読めないため、本番の応答（robots.txt・meta・X-Robots-Tag）から状態を判断する。
 */

/** 検索に出す固定の画面（sitemap-routes.ts の SITEMAP_ROUTES と同じ）。 */
export const INDEXED_ROUTES = ["/", "/players", "/managers", "/compare", "/squads", "/squads/templates", "/squads/compare", "/best-xi", "/boosters", "/managers/compare", "/about", "/support", "/terms", "/privacy", "/disclaimer"];

/** 検索に出さない画面（200 なら meta と X-Robots-Tag の両方で noindex、または 404）。 */
export const NOINDEX_ROUTES = [
  "/my-team", "/my-builds", "/favorites", "/build-inventory", "/diagnosis-history", "/data-management",
  "/account", "/account/my-team-cloud", "/account/local-data-migration",
  "/auth/sign-in", "/auth/sign-up", "/auth/forgot-password", "/auth/update-password", "/auth/confirm",
  "/share/diagnosis", "/share/compare", "/squads/sample-squad",
];

/** 本番では到達できない画面（404）。 */
export const UNREACHABLE_ROUTES = ["/account/rls-test", "/release-readiness", "/community/local-posts", "/account/public-id-preview", "/tier-pack-preview", "/community"];

const PRIVATE_PATH_RE = /^\/(api|auth|account|share|community|my-team|my-builds|favorites|build-inventory|diagnosis-history|data-management|release-readiness|tier-pack-preview)(\/|$)|^\/squads\/(?!templates$|compare$)[^/]+|^\/players\/(?!world\/[0-9]+$|guide\/)[^/]+/;

const metaRobots = (body) => (body ?? "").match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "";
const canonicalOf = (body) => (body ?? "").match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
const titleOf = (body) => (body ?? "").match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
const descriptionOf = (body) => (body ?? "").match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
/** ページの JSON-LD をすべて読む（読めないものは null）。 */
export function jsonLdOf(body) {
  return [...(body ?? "").matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  });
}
const isNoindex = (res) => /noindex/i.test(res.headers?.["x-robots-tag"] ?? "") || /noindex/i.test(metaRobots(res.body));
const bothNoindex = (res) => /noindex/i.test(res.headers?.["x-robots-tag"] ?? "") && /noindex/i.test(metaRobots(res.body));

/** sitemap.xml の <loc> を読む（XML として最低限の形も確かめる）。 */
export function parseSitemap(body) {
  const xmlOk = /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/.test(body ?? "");
  const locs = [...(body ?? "").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  return { xmlOk, locs };
}

/**
 * 公開サイトの確認（GET だけ）。
 * @param {(p: string) => Promise<{status:number, headers:Record<string,string>, body:string}>} fetchText
 * @param {{ origin: string, draftGuideSlugs?: string[], sampleDetailCount?: number }} opts
 */
export async function checkIndexingLive(fetchText, opts) {
  const origin = opts.origin.replace(/\/+$/, "");
  const problems = [];
  const fivexx = [];
  const get = async (p) => {
    const r = await fetchText(p);
    if (r.status >= 500) fivexx.push(`${p}:${r.status}`);
    return r;
  };

  const robots = await get("/robots.txt");
  const robotLines = (robots.body ?? "").split(/\r?\n/).map((l) => l.trim());
  const state = robotLines.includes("Allow: /") && robotLines.some((l) => l.startsWith("Sitemap:")) ? "enabled" : robotLines.includes("Disallow: /") ? "disabled" : "inconsistent";
  if (robots.status !== 200) problems.push(`robots_status:${robots.status}`);
  if (state === "inconsistent") problems.push("robots_inconsistent");

  const home = await get("/");
  const sitemap = await get("/sitemap.xml");
  const facts = { state, sitemapUrlCount: 0, checkedIndexed: 0, checkedNoindex: 0, checkedDetails: 0 };

  // 法務の表示（公開の前に最低限）
  for (const phrase of ["非公式", "KONAMI", "各権利者に帰属", "誤りや遅延"]) if (!(home.body ?? "").includes(phrase)) problems.push(`legal_notice_missing:${phrase}`);
  if (!/<html[^>]* lang="ja"/.test(home.body ?? "")) problems.push("html_lang_not_ja");

  if (state === "disabled") {
    if (!/noindex/i.test(home.headers?.["x-robots-tag"] ?? "")) problems.push("disabled_but_x_robots_missing");
    if (!/noindex/i.test(metaRobots(home.body))) problems.push("disabled_but_meta_index");
    if (sitemap.status === 200) problems.push("disabled_but_sitemap_200");
    if (canonicalOf(home.body)) problems.push("disabled_but_canonical");
    if (jsonLdOf(home.body).length > 0) problems.push("disabled_but_jsonld");
  }

  if (state === "enabled") {
    for (const d of ["/api/", "/auth/", "/account", "/share/", "/release-readiness", "/tier-pack-preview", "/community/"]) if (!robotLines.includes(`Disallow: ${d}`)) problems.push(`robots_not_disallowed:${d}`);
    if (!robotLines.includes(`Sitemap: ${origin}/sitemap.xml`)) problems.push("robots_sitemap_url_not_canonical");

    // sitemap
    if (sitemap.status !== 200) problems.push(`sitemap_status:${sitemap.status}`);
    const { xmlOk, locs } = parseSitemap(sitemap.body);
    facts.sitemapUrlCount = locs.length;
    if (!xmlOk) problems.push("sitemap_xml_invalid");
    if (new Set(locs).size !== locs.length) problems.push("sitemap_duplicate_urls");
    for (const u of locs) {
      if (/[?#]/.test(u)) problems.push(`sitemap_query_or_fragment:${u}`);
      let path = "/";
      try {
        const parsed = new URL(u);
        path = parsed.pathname;
        if (parsed.origin !== new URL(origin).origin) problems.push(`sitemap_non_canonical_origin:${u}`);
      } catch {
        problems.push(`sitemap_bad_url:${u}`);
      }
      if (PRIVATE_PATH_RE.test(path)) problems.push(`sitemap_private_url:${path}`);
      for (const s of opts.draftGuideSlugs ?? []) if (path === `/players/guide/${s}`) problems.push(`sitemap_draft_url:${path}`);
    }
    for (const r of INDEXED_ROUTES) if (!locs.includes(r === "/" ? origin : `${origin}${r}`)) problems.push(`sitemap_missing_route:${r}`);
    const players = locs.filter((u) => /\/players\/world\/[0-9]+$/.test(u));
    const managers = locs.filter((u) => /\/managers\/[0-9]+$/.test(u));
    if (players.length === 0) problems.push("sitemap_no_player_details");
    if (managers.length === 0) problems.push("sitemap_no_manager_details");

    // 公開する画面: 200・index・canonical・OGP・Twitter・題名と説明が一意
    const n = opts.sampleDetailCount ?? 3;
    const pick = (arr) => (arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.floor((i * (arr.length - 1)) / Math.max(1, n - 1))]));
    const detailPaths = [...pick(players), ...pick(managers)].map((u) => new URL(u).pathname);
    const titles = new Map();
    const descriptions = new Map();
    for (const p of [...INDEXED_ROUTES, ...detailPaths]) {
      const res = await get(p);
      if (detailPaths.includes(p)) facts.checkedDetails++;
      else facts.checkedIndexed++;
      if (res.status !== 200) {
        problems.push(`indexed_route_status:${p}:${res.status}`);
        continue;
      }
      if (isNoindex(res)) problems.push(`indexed_route_noindex:${p}`);
      const expected = p === "/" ? origin : `${origin}${p}`;
      if (canonicalOf(res.body) !== expected) problems.push(`canonical_mismatch:${p}:${canonicalOf(res.body)}`);
      for (const tag of ['property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:url"', 'name="twitter:card"']) if (!(res.body ?? "").includes(tag)) problems.push(`og_missing:${p}:${tag}`);
      const ld = jsonLdOf(res.body);
      if (ld.some((x) => x === null)) problems.push(`jsonld_invalid:${p}`);
      if (p === "/" && !ld.some((x) => x?.["@type"] === "WebSite")) problems.push("jsonld_website_missing");
      if (detailPaths.includes(p) && !ld.some((x) => x?.["@type"] === "BreadcrumbList" && x.itemListElement?.at(-1)?.item === expected)) problems.push(`jsonld_breadcrumb_missing:${p}`);
      const t = titleOf(res.body);
      const d = descriptionOf(res.body);
      if (!/TeamAIXI/.test(t)) problems.push(`title_without_brand:${p}`);
      if (!d) problems.push(`description_missing:${p}`);
      if (titles.has(t)) problems.push(`title_duplicate:${p}=${titles.get(t)}`);
      if (d && descriptions.has(d)) problems.push(`description_duplicate:${p}=${descriptions.get(d)}`);
      titles.set(t, p);
      if (d) descriptions.set(d, p);
    }

    // クエリ・トラッキングは canonical から除く
    const q = await get("/players?utm_source=x&ref=y");
    if (q.status === 200 && canonicalOf(q.body) !== `${origin}/players`) problems.push(`canonical_keeps_query:${canonicalOf(q.body)}`);

    // 検索に出さない画面: 200 なら meta と X-Robots-Tag の両方で noindex・canonical/OGP を出さない
    for (const p of [...NOINDEX_ROUTES, ...(opts.draftGuideSlugs ?? []).map((s) => `/players/guide/${s}`)]) {
      const res = await get(p);
      facts.checkedNoindex++;
      if (res.status === 404) continue;
      if (res.status !== 200 && !(res.status >= 300 && res.status < 400)) problems.push(`noindex_route_status:${p}:${res.status}`);
      if (res.status === 200 && !bothNoindex(res)) problems.push(`noindex_route_indexable:${p}`);
      if (res.status === 200 && canonicalOf(res.body)) problems.push(`noindex_route_has_canonical:${p}`);
    }
  }

  // どちらの状態でも
  for (const p of UNREACHABLE_ROUTES) {
    const res = await get(p);
    if (res.status !== 404) problems.push(`internal_route_reachable:${p}:${res.status}`);
  }
  const signup = await get("/auth/sign-up");
  if (/type="password"/.test(signup.body ?? "")) problems.push("signup_form_exposed");
  const notFound = await get("/this-page-does-not-exist-teamaixi");
  if (notFound.status !== 404) problems.push(`not_found_status:${notFound.status}`);
  else if (state === "enabled" && !isNoindex(notFound)) problems.push("not_found_indexable");
  if (fivexx.length) problems.push(...fivexx.map((x) => `http_5xx:${x}`));
  return { problems, facts };
}

/** リポジトリの確認（Search Console の案内・正式 URL の移行の手順・公開の記録）。 */
export function checkIndexingRepo(files) {
  const problems = [];
  if (!files.searchConsolePackage || !/sitemap\.xml/.test(files.searchConsolePackage) || !/URL 検査/.test(files.searchConsolePackage)) problems.push("search_console_package_missing");
  if (!files.indexingDoc || !/canonical/.test(files.indexingDoc) || !/独自ドメイン/.test(files.indexingDoc)) problems.push("canonical_migration_doc_missing");
  if (!files.guides) problems.push("player_guides_missing");
  else {
    try {
      const g = JSON.parse(files.guides).guides ?? [];
      // 大量の自動生成をしない（公開の記事は人が確認したものだけ）。
      if (g.filter((x) => x.published).length > 20) problems.push("too_many_published_guides");
    } catch {
      problems.push("player_guides_invalid");
    }
  }
  return problems;
}

/** 判定。 */
export function decideIndexing({ live, repoProblems, analytics }) {
  const blocked = [...(live?.problems ?? ["live_check_not_run"]), ...repoProblems];
  if (analytics === false) blocked.push("analytics_not_loaded");
  const verdict = blocked.length ? "SEARCH_INDEXING_BLOCKED" : live.facts.state === "enabled" ? "SEARCH_INDEXING_ENABLED" : "SEARCH_INDEXING_READY";
  return { verdict, blocked, facts: live?.facts ?? null };
}
