import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { checkRepo, checkLive, decideRelease, PUBLIC_ROUTES, HIDDEN_ROUTES, REQUIRED_GATES, MANUAL_REVIEW_ITEMS } from "../../../scripts/lib/teamaixi-v1-release.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const repoFiles = () => ({
  layout: read("src/app/layout.tsx"), dict_ja: [read("src/lib/i18n/dictionaries/ja.ts"), ...readdirSync(path.join(ROOT, "src/lib/i18n/dictionaries/ja-ns")).map((f) => read(`src/lib/i18n/dictionaries/ja-ns/${f}`))].join("\n"), dict_en: read("src/lib/i18n/dictionaries/en.ts"),
  accountAvailability: read("src/lib/supabase/account-availability.ts"), sidebar: read("src/components/Sidebar.tsx"),
  internalPages: read("src/lib/public-info/internal-pages.ts"), packageJson: read("package.json"),
  changelog: read("CHANGELOG.md"), releaseNotes: read("RELEASE_NOTES.md"), releaseDoc: read("docs/release/teamaixi-v1.md"), legalChecklist: read("docs/release/legal-review-checklist.md"),
});

describe("TeamAIXI v1.0 Release Validator", () => {
  it("リポジトリの現在の状態は、ブランド・非公式の表記・新規登録の制限・ナビ・版・文書の確認に合格する", () => {
    expect(checkRepo(repoFiles())).toEqual([]);
  });

  it("旧ブランド・非公式の表記の欠落・新規登録の開放・準備中のナビ・版の不一致を見つける", () => {
    const f = repoFiles();
    expect(checkRepo({ ...f, dict_ja: f.dict_ja + "\neFootball Team AI" })).toContain("old_brand_in_dictionary:ja");
    expect(checkRepo({ ...f, dict_en: f.dict_en.replace(/respective owners/g, "x") })).toContain("unofficial_notice_missing:en:respective owners");
    expect(checkRepo({ ...f, accountAvailability: f.accountAvailability.replace('ACCOUNT_SIGNUP_MODE: AccountSignupMode = "limited"', 'ACCOUNT_SIGNUP_MODE: AccountSignupMode = "open"') })).toContain("signup_not_limited");
    expect(checkRepo({ ...f, sidebar: f.sidebar + '\n{ href: "/community", labelKey: "community", icon: "community", status: "soon" },' })).toContain("unreleased_nav_items_present");
    expect(checkRepo({ ...f, packageJson: '{"version":"0.9.0"}' })).toContain("version_not_1_0_0");
    expect(checkRepo({ ...f, dict_en: f.dict_en + "\nKONAMI AI" })).toContain("forbidden_claim:KONAMI AI");
    expect(checkRepo({ ...f, dict_ja: f.dict_ja + "\n準拠法は日本法とすることを想定" })).toContain("governing_law_guess_in_public_text");
    expect(checkRepo({ ...f, dict_ja: f.dict_ja.replace(/safetyNoApiKey: "/g, "x: \"") })).toContain("required_public_text_missing:safetyNoApiKey");
    expect(checkRepo({ ...f, legalChecklist: undefined as unknown as string })).toContain("legal_review_checklist_missing");
    expect(checkRepo({ ...f, layout: f.layout + '\nopenGraph: { title: "TeamAIXI" },' })).toContain("og_or_canonical_with_noindex");
  });

  it("公開サイトの確認: 公開する画面は 200、未公開の画面は 404、noindex・robots・sitemap・セキュリティ・件数", async () => {
    const ok = async (p: string) => {
      if (HIDDEN_ROUTES.includes(p) || p === "/sitemap.xml") return { status: 404, headers: {}, body: "" };
      if (p === "/robots.txt") return { status: 200, headers: {}, body: "User-Agent: *\nDisallow: /\n" };
      if (p.startsWith("/api/world")) return { status: 200, headers: {}, body: JSON.stringify({ totalCount: 13372 }) };
      if (p.startsWith("/api/managers")) return { status: 200, headers: {}, body: JSON.stringify({ totalCount: 69 }) };
      return { status: 200, headers: { "x-robots-tag": "noindex, nofollow", "content-security-policy": "frame-ancestors 'none'", "x-content-type-options": "nosniff", "x-frame-options": "DENY" }, body: "<html>TeamAIXI</html>" };
    };
    expect((await checkLive(ok, { world: 13372, managers: 69 })).problems).toEqual([]);
    const og = async (p: string) => (p === "/" ? { ...(await ok(p)), body: '<html>TeamAIXI<meta property="og:title" content="x"></html>' } : ok(p));
    expect((await checkLive(og, { world: 13372, managers: 69 })).problems).toContain("og_or_canonical_on_home");
    const bad = async (p: string) => (p === "/community" ? { status: 200, headers: {}, body: "" } : p === "/auth/sign-up" ? { status: 200, headers: {}, body: '<input type="password">' } : ok(p));
    const r = await checkLive(bad, { world: 13372, managers: 70 });
    expect(r.problems).toEqual(expect.arrayContaining(["hidden_route_not_404:/community:200", "signup_form_exposed", "managers_count_not_applied_state:69"]));
    expect(PUBLIC_ROUTES).toContain("/data-management");
  });

  it("判定: 自動の確認の不合格は BLOCKED、本人の確認が残れば MANUAL_REVIEW_REQUIRED、すべて揃えば READY（何も公開しない）", () => {
    const gates = Object.fromEntries(REQUIRED_GATES.map((g: string) => [g, true]));
    const owner = Object.fromEntries(MANUAL_REVIEW_ITEMS.map((k: string) => [k, true]));
    expect(decideRelease({ repoProblems: ["x"], liveProblems: [], gates, ownerConfirmations: owner }).verdict).toBe("TEAMAIXI_V1_RELEASE_BLOCKED");
    expect(decideRelease({ repoProblems: [], liveProblems: [], gates: { ...gates, codeqlPassed: false }, ownerConfirmations: owner }).blocked).toEqual(["gate_not_passed:codeqlPassed"]);
    expect(decideRelease({ repoProblems: [], liveProblems: [], gates, ownerConfirmations: {} })).toMatchObject({ verdict: "TEAMAIXI_V1_MANUAL_REVIEW_REQUIRED", manualReview: MANUAL_REVIEW_ITEMS });
    expect(decideRelease({ repoProblems: [], liveProblems: [], gates, ownerConfirmations: owner }).verdict).toBe("TEAMAIXI_V1_RELEASE_READY");
  });
});
