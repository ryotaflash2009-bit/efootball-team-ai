import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkOperations, checkRepoV1_1, decideV1_1, V1_1_MANUAL_REVIEW_ITEMS, V1_1_REQUIRED_GATES } from "../../../scripts/lib/teamaixi-v1-1-release.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const repoFiles = () => ({
  layout: read("src/app/layout.tsx"),
  localeStatus: read("docs/i18n/locale-status.json"),
  registry: read("src/lib/i18n/locale-registry.ts"),
  fixedTerms: read("scripts/lib/fixed-terms.mjs"),
  navigationWatchdog: read("src/lib/navigation/navigation-watchdog.ts"),
  analyticsSanitizer: read("src/lib/analytics/sanitize-analytics-event.ts"),
  npmAuditDoc: read("docs/production-readiness/npm-audit-2026-10-07.md"),
  improvementSimulation: read("src/lib/squad/improvement-simulation.ts"),
  publicIdSql: read("docs/production-readiness/sql/create-public-profiles-schema.sql"),
  publicIdPgTest: read("src/lib/profile/public-profiles.postgres.test.ts"),
  photoStage2Sql: read("docs/production-readiness/sql/create-photo-posts-stage2-schema.sql"),
});
const allGates = Object.fromEntries(V1_1_REQUIRED_GATES.map((g: string) => [g, true]));
const allOwner = Object.fromEntries(V1_1_MANUAL_REVIEW_ITEMS.map((k: string) => [k, true]));

describe("TeamAIXI v1.1 Release Validator", () => {
  it("現在のリポジトリはリポジトリの確認に合格する（10 言語 RC・未レビューの公開なし・契約・提案がそろう）", () => {
    expect(checkRepoV1_1(repoFiles())).toEqual([]);
  });

  it("追加の言語を未レビューで公開すると不合格", () => {
    const f = repoFiles();
    const status = JSON.parse(f.localeStatus);
    status.locales.es.state = "PUBLISHED";
    expect(checkRepoV1_1({ ...f, localeStatus: JSON.stringify(status) })).toContain("unreviewed_locale_published:es");
    expect(checkRepoV1_1({ ...f, registry: f.registry.replace(/(\{ code: "es",[^}]*state: )"RELEASE_CANDIDATE"/, '$1"PUBLISHED"') })).toContain("registry_publishes_added_locale");
  });

  it("運用: 自動更新が復旧していない・Backup が 30 日より古いと BLOCKED", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    expect(checkOperations({ autoUpdate: { state: "VERIFIED_BLOCKED_OWNER_ACTION" }, backup: { lastVerifiedAt: "2026-10-03T00:00:00Z" } }, now)).toEqual(["auto_update_not_restored:VERIFIED_BLOCKED_OWNER_ACTION"]);
    expect(checkOperations({ autoUpdate: { state: "FULLY_AUTOMATED_UPDATE_RESTORED" }, backup: { lastVerifiedAt: "2026-08-01T00:00:00Z" } }, now)).toEqual(["backup_not_verified_within_30_days"]);
    expect(checkOperations({ autoUpdate: { state: "FULLY_AUTOMATED_UPDATE_RESTORED" }, backup: { lastVerifiedAt: "2026-10-05T00:00:00Z" } }, now)).toEqual([]);
  });

  it("判定: BLOCKED → MANUAL_REVIEW → READY", () => {
    const base = { repoProblems: [], liveProblems: [], operationProblems: [] };
    expect(decideV1_1({ ...base, operationProblems: ["auto_update_not_restored:x"], gates: allGates, ownerConfirmations: allOwner }).verdict).toBe("TEAMAIXI_V1_1_BLOCKED");
    expect(decideV1_1({ ...base, gates: { ...allGates, accessibilityPassed: false }, ownerConfirmations: allOwner }).verdict).toBe("TEAMAIXI_V1_1_BLOCKED");
    const manual = decideV1_1({ ...base, gates: allGates, ownerConfirmations: {} });
    expect(manual.verdict).toBe("TEAMAIXI_V1_1_MANUAL_REVIEW_REQUIRED");
    expect(manual.manualReview).toEqual(V1_1_MANUAL_REVIEW_ITEMS);
    expect(decideV1_1({ ...base, gates: allGates, ownerConfirmations: allOwner }).verdict).toBe("TEAMAIXI_V1_1_READY");
  });

  it("gates の JSON は本人の確認を勝手に true にしていない", () => {
    const g = JSON.parse(read("docs/release/teamaixi-v1-1-gates.json"));
    expect(Object.values(g.ownerConfirmations).every((v) => v === false)).toBe(true);
  });
});
