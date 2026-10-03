/**
 * TeamAIXI v1.0 Release Validator（判定は純関数。live の確認は fetch を引数で受け取る）。
 *
 * - TEAMAIXI_V1_RELEASE_BLOCKED: 自動の確認のどれかが不合格。
 * - TEAMAIXI_V1_MANUAL_REVIEW_REQUIRED: 自動の確認はすべて合格だが、本人の最終確認（素材の権利・法務・名称・窓口・URL）が残る。
 * - TEAMAIXI_V1_RELEASE_READY: すべて合格し、本人の確認も記録済み。
 * このコードは何も公開しない（tag・Release・noindex の解除・新規登録の開放をしない）。
 */

export const PUBLIC_ROUTES = ["/", "/players", "/managers", "/compare", "/squads", "/best-xi", "/my-team", "/my-builds", "/favorites", "/build-inventory", "/diagnosis-history", "/data-management", "/about", "/terms", "/privacy", "/disclaimer", "/support"];
export const HIDDEN_ROUTES = ["/account/rls-test", "/release-readiness", "/community/local-posts", "/account/public-id-preview", "/tier-pack-preview", "/community", "/tier-lists", "/packs"];
export const MANUAL_REVIEW_ITEMS = ["assetRights", "legalDocuments", "serviceName", "supportContact", "publicUrl"];
export const REQUIRED_GATES = ["ciPassed", "codeqlPassed", "verifyPassed", "productionBuildPassed", "postgresValidationPassed", "npmAuditNotWorse", "secretScanClean", "blackBoxPassed", "allViewportsPassed", "accessibilityPassed", "performancePassed", "securityPassed"];

/** リポジトリ内の文書・設定の確認（入力は読み込んだファイルの内容）。 */
export function checkRepo(files) {
  const problems = [];
  const has = (k) => typeof files[k] === "string";
  if (!has("layout") || !/title: "TeamAIXI"/.test(files.layout)) problems.push("brand_title_missing");
  if (!has("layout") || !/SITE_ROBOTS_METADATA/.test(files.layout)) problems.push("noindex_metadata_missing");
  for (const d of ["ja", "en"]) {
    const s = files[`dict_${d}`] ?? "";
    if (/eFootball Team AI/.test(s)) problems.push(`old_brand_in_dictionary:${d}`);
    if (!/TeamAIXI/.test(s)) problems.push(`brand_missing_in_dictionary:${d}`);
  }
  const ja = files.dict_ja ?? "";
  const en = files.dict_en ?? "";
  for (const phrase of ["公式サービスではなく", "公認・提携・運営を受けていません", "各権利者に帰属", "誤りや遅延"]) if (!ja.includes(phrase)) problems.push(`unofficial_notice_missing:ja:${phrase}`);
  for (const phrase of ["not an official KONAMI or eFootball™ service", "endorsed by, affiliated with or operated by KONAMI", "respective owners", "errors or delays"]) if (!en.includes(phrase)) problems.push(`unofficial_notice_missing:en:${phrase}`);
  for (const forbidden of [/KONAMI AI/i, /Official Team AI/i, /Official database/i]) if (forbidden.test(ja) || forbidden.test(en)) problems.push(`forbidden_claim:${forbidden.source}`);
  if (!/TeamAIXI v1\.0はログイン不要で利用できます。アカウント機能は今後のアップデートで提供予定です/.test(ja)) problems.push("account_notice_missing:ja");
  if (!/TeamAIXI v1\.0 can be used without signing in\. Account features are planned for a future update/.test(en)) problems.push("account_notice_missing:en");
  if (!has("accountAvailability") || !/ACCOUNT_SIGNUP_MODE: AccountSignupMode = "limited"/.test(files.accountAvailability)) problems.push("signup_not_limited");
  if (!has("sidebar") || /status: "soon"\s*\}/.test(files.sidebar)) problems.push("unreleased_nav_items_present");
  if (!has("internalPages") || !HIDDEN_ROUTES.slice(0, 5).every((r) => files.internalPages.includes(`"${r}"`))) problems.push("internal_pages_list_incomplete");
  try {
    if (JSON.parse(files.packageJson ?? "{}").version !== "1.0.0") problems.push("version_not_1_0_0");
  } catch {
    problems.push("package_json_invalid");
  }
  for (const doc of ["changelog", "releaseNotes", "releaseDoc"]) if (!has(doc) || !/TeamAIXI v1\.0/.test(files[doc])) problems.push(`release_doc_missing:${doc}`);
  return problems;
}

/** 公開サイトの読み取りだけの確認。fetchText(path) → { status, headers, body }。 */
export async function checkLive(fetchText, appliedState) {
  const problems = [];
  for (const r of PUBLIC_ROUTES) {
    const res = await fetchText(r);
    if (res.status !== 200) problems.push(`public_route_not_200:${r}:${res.status}`);
  }
  for (const r of HIDDEN_ROUTES) {
    const res = await fetchText(r);
    if (res.status !== 404) problems.push(`hidden_route_not_404:${r}:${res.status}`);
  }
  const home = await fetchText("/");
  const h = home.headers ?? {};
  if (!/noindex/i.test(h["x-robots-tag"] ?? "")) problems.push("x_robots_tag_missing");
  if (!/TeamAIXI/.test(home.body ?? "")) problems.push("brand_not_on_home");
  if (/eFootball Team AI/.test(home.body ?? "")) problems.push("old_brand_on_home");
  if (!/content-security-policy/i.test(Object.keys(h).join(" "))) problems.push("csp_missing");
  if ((h["x-content-type-options"] ?? "") !== "nosniff") problems.push("nosniff_missing");
  if (!/DENY|SAMEORIGIN/i.test(h["x-frame-options"] ?? "") && !/frame-ancestors/i.test(h["content-security-policy"] ?? "")) problems.push("frame_protection_missing");
  const robots = await fetchText("/robots.txt");
  if (!/Disallow:\s*\/\s*$/m.test(robots.body ?? "")) problems.push("robots_not_disallow_all");
  const sitemap = await fetchText("/sitemap.xml");
  if (sitemap.status === 200) problems.push("sitemap_exposed");
  const signup = await fetchText("/auth/sign-up");
  if (/type="password"/.test(signup.body ?? "")) problems.push("signup_form_exposed");
  const world = await fetchText("/api/world/players?pageSize=1");
  const managers = await fetchText("/api/managers?pageSize=1");
  const count = (r) => {
    try {
      return JSON.parse(r.body).totalCount;
    } catch {
      return null;
    }
  };
  const w = count(world);
  const m = count(managers);
  if (w !== appliedState?.world) problems.push(`world_count_not_applied_state:${w}`);
  if (m !== appliedState?.managers) problems.push(`managers_count_not_applied_state:${m}`);
  return { problems, counts: { world: w, managers: m } };
}

/** 判定（自動の確認・品質ゲート・本人の確認）。 */
export function decideRelease({ repoProblems, liveProblems, gates, ownerConfirmations }) {
  const gateProblems = REQUIRED_GATES.filter((g) => gates?.[g] !== true).map((g) => `gate_not_passed:${g}`);
  const blocked = [...repoProblems, ...liveProblems, ...gateProblems];
  const manual = MANUAL_REVIEW_ITEMS.filter((k) => ownerConfirmations?.[k] !== true);
  const verdict = blocked.length ? "TEAMAIXI_V1_RELEASE_BLOCKED" : manual.length ? "TEAMAIXI_V1_MANUAL_REVIEW_REQUIRED" : "TEAMAIXI_V1_RELEASE_READY";
  return { verdict, blocked, manualReview: manual };
}
