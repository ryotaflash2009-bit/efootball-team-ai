/**
 * TeamAIXI v1.1 Release Validator（2026-10-07・判定は純関数）。何も公開しない（tag・Release・noindex・登録・言語の公開を変えない）。
 *
 * - TEAMAIXI_V1_1_BLOCKED: 自動の確認・品質ゲート・必須の運用の状態のどれかが不合格。
 * - TEAMAIXI_V1_1_MANUAL_REVIEW_REQUIRED: 自動の確認は合格だが、本人の判断・確認が残る。
 * - TEAMAIXI_V1_1_READY: すべて合格し、本人の確認も記録済み。
 * live の確認は v1.0 の `checkLive`（公開の画面・404・noindex・セキュリティヘッダー・件数 = applied-state）をそのまま使う。
 */

export const V1_1_REQUIRED_GATES = [
  "ciPassed", "codeqlPassed", "verifyPassed", "productionBuildPassed", "postgresValidationPassed", "secretScanClean",
  "blackBoxPassed", "multilingualBlackBoxPassed", "accessibilityPassed", "performancePassed", "securityPassed", "react418Zero",
];

/** 必須の運用の状態（evidence で確認する。満たさないと BLOCKED）。 */
export const V1_1_REQUIRED_OPERATIONS = ["autoUpdateRestored", "backupVerifiedWithin30Days"];

/** 本人の判断・確認（MANUAL_REVIEW）。 */
export const V1_1_MANUAL_REVIEW_ITEMS = [
  "hourlyDetectionDecision", "f045Decision", "f070Decision", "publicIdApplyDecision", "photoStage2ApplyDecision",
  "communitySafetyPackage", "domainAndSmtp", "legalReview", "nextjs16MigrationPlan", "npmAuditMajorUpgrades",
];

/**
 * 確認に使うリポジトリのファイル（CLI とテストで共通・2026-10-08 に一覧をここへ移した）。
 */
export const V1_1_REPO_FILES = Object.freeze({
  layout: "src/app/layout.tsx",
  localeStatus: "docs/i18n/locale-status.json",
  registry: "src/lib/i18n/locale-registry.ts",
  fixedTerms: "scripts/lib/fixed-terms.mjs",
  navigationWatchdog: "src/lib/navigation/navigation-watchdog.ts",
  analyticsSanitizer: "src/lib/analytics/sanitize-analytics-event.ts",
  npmAuditDoc: "docs/production-readiness/npm-audit-2026-10-07.md",
  improvementSimulation: "src/lib/squad/improvement-simulation.ts",
  publicIdSql: "docs/production-readiness/sql/create-public-profiles-schema.sql",
  publicIdPgTest: "src/lib/profile/public-profiles.postgres.test.ts",
  photoStage2Sql: "docs/production-readiness/sql/create-photo-posts-stage2-schema.sql",
  hourlyDetectionPackage: "docs/production-readiness/hourly-detection-decision-package.md",
  growthProfile: "src/lib/squad/growth-profile.ts",
  diagnosisHistory: "src/lib/squad/diagnosis-history.ts",
  shareImage: "src/lib/share-image.ts",
  bestXiBench: "src/lib/best-xi/bench.ts",
  gamePlan: "src/lib/squad/game-plan.ts",
  communitySafety: "src/lib/community/moderation.ts",
  domainSmtpAuthPackage: "docs/production-readiness/domain-smtp-auth-resume-package-2026-10-07.md",
  accountAvailability: "src/lib/supabase/account-availability.ts",
  authEmailChecklist: "docs/production-readiness/auth-email-release-checklist.json",
  dbLoginProbe: "scripts/lib/db-login-probe.mjs",
  incidentResponse: "docs/production-readiness/auto-update-incident-response.md",
  rightsAudit: "docs/production-readiness/data-distribution-rights-audit.md",
  legalChecklist: "docs/release/legal-review-checklist.md",
});

/** リポジトリの確認（入力は読み込んだファイルの内容・JSON は文字列）。 */
export function checkRepoV1_1(files) {
  const problems = [];
  const has = (k) => typeof files[k] === "string" && files[k].length > 0;
  // 多言語: ja・en だけ公開・追加の 10 言語は RC（未レビューの公開なし）
  try {
    const status = JSON.parse(files.localeStatus ?? "{}");
    const L = status.locales ?? {};
    for (const [code, s] of Object.entries(L)) {
      if (s.state === "PUBLISHED" && !["ja", "en"].includes(code) && !(s.reviewedBy && s.quality && String(s.quality).startsWith("VERIFIED"))) problems.push(`unreviewed_locale_published:${code}`);
    }
    for (const code of ["es", "pt-BR", "fr", "de", "it", "ko", "zh-CN", "zh-TW", "id", "tr"]) {
      if (L[code]?.state !== "RELEASE_CANDIDATE" && L[code]?.state !== "PUBLISHED") problems.push(`locale_not_release_candidate:${code}`);
    }
  } catch {
    problems.push("locale_status_invalid");
  }
  if (!has("registry") || /state: "PUBLISHED"/.test((files.registry ?? "").replace(/\{ code: "(ja|en)"[^}]*\}/g, ""))) problems.push("registry_publishes_added_locale");
  if (!has("fixedTerms") || !/linkUpPlay/.test(files.fixedTerms) || !/ovr/.test(files.fixedTerms)) problems.push("fixed_terms_contract_missing");
  if (!has("navigationWatchdog") || !/NAVIGATION_EARLY_GRACE_MS/.test(files.navigationWatchdog)) problems.push("navigation_early_fallback_missing");
  if (!has("analyticsSanitizer") || !/searchParams|\?|fragment/.test(files.analyticsSanitizer) || !/\/auth/.test(files.analyticsSanitizer)) problems.push("analytics_sanitizer_missing");
  if (!has("npmAuditDoc")) problems.push("npm_audit_classification_missing");
  if (!has("improvementSimulation")) problems.push("improvement_simulation_missing");
  if (!has("publicIdSql") || !has("publicIdPgTest")) problems.push("public_id_proposal_missing");
  if (!has("photoStage2Sql")) problems.push("photo_stage2_proposal_missing");
  if (!has("layout") || !/SITE_ROBOTS_METADATA/.test(files.layout)) problems.push("noindex_metadata_missing");
  // 2026-10-08 に追加した確認（毎時の検出・成長・履歴・共有・Best XI・ゲームプラン・コミュニティ・Domain/SMTP/Auth・権利・法務・障害対応）
  if (!has("hourlyDetectionPackage")) problems.push("hourly_detection_decision_package_missing");
  if (!has("growthProfile") || !has("diagnosisHistory")) problems.push("growth_or_history_missing");
  if (!has("shareImage") || !/AbortError/.test(files.shareImage) || !/revokeObjectURL/.test(files.shareImage)) problems.push("share_safeguards_missing");
  if (!has("bestXiBench")) problems.push("best_xi_bench_missing");
  if (!has("gamePlan") || !/GAME_PLAN_SCHEMA/.test(files.gamePlan)) problems.push("game_plan_missing");
  if (!has("communitySafety")) problems.push("community_safety_contract_missing");
  if (!has("domainSmtpAuthPackage")) problems.push("domain_smtp_auth_package_missing");
  if (!has("dbLoginProbe")) problems.push("auto_apply_db_login_probe_missing");
  if (!has("incidentResponse")) problems.push("incident_response_missing");
  if (!has("rightsAudit")) problems.push("rights_audit_missing");
  if (!has("legalChecklist")) problems.push("legal_checklist_missing");
  // 新規登録の公開は、メールの公開の判定の本人の承認が記録されている場合だけ（自動では開かない）
  if (!has("accountAvailability")) problems.push("account_availability_missing");
  else if (/ACCOUNT_SIGNUP_MODE:\s*AccountSignupMode\s*=\s*"open"/.test(files.accountAvailability)) {
    let approved = false;
    try {
      approved = Boolean(JSON.parse(files.authEmailChecklist ?? "{}").ownerApprovedAt);
    } catch {
      approved = false;
    }
    if (!approved) problems.push("public_signup_open_without_owner_approval");
  }
  return problems;
}

/** 運用の状態（evidence の JSON）。 */
export function checkOperations(ops, now = new Date()) {
  const problems = [];
  if (ops?.autoUpdate?.state !== "FULLY_AUTOMATED_UPDATE_RESTORED") problems.push(`auto_update_not_restored:${ops?.autoUpdate?.state ?? "unknown"}`);
  const last = ops?.backup?.lastVerifiedAt ? Date.parse(ops.backup.lastVerifiedAt) : NaN;
  if (!Number.isFinite(last) || now.getTime() - last > 30 * 86_400_000) problems.push("backup_not_verified_within_30_days");
  return problems;
}

export function decideV1_1({ repoProblems, liveProblems, operationProblems, gates, ownerConfirmations }) {
  const gateProblems = V1_1_REQUIRED_GATES.filter((g) => gates?.[g] !== true).map((g) => `gate_not_passed:${g}`);
  const blocked = [...repoProblems, ...liveProblems, ...operationProblems, ...gateProblems];
  const manual = V1_1_MANUAL_REVIEW_ITEMS.filter((k) => ownerConfirmations?.[k] !== true);
  const verdict = blocked.length ? "TEAMAIXI_V1_1_BLOCKED" : manual.length ? "TEAMAIXI_V1_1_MANUAL_REVIEW_REQUIRED" : "TEAMAIXI_V1_1_READY";
  return { verdict, blocked, manualReview: manual };
}
