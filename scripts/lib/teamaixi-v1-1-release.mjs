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
