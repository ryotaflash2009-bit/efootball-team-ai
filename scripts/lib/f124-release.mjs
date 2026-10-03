/**
 * F-124（本人だけで検証する期間）を終えてよいかの Release Validator（純関数・外部アクセスなし）。
 *
 * - A 技術・B 設定・C 実運用を分けて判定する。どれか 1 つでも欠ければ F124_HOLD。
 * - すべてそろっても F124_READY_FOR_OWNER_DECISION まで。**解除は本人の判断**で、このコードは何も開かない。
 * - 入力は run id・件数・true/false だけ。Secret・接続文字列・個人情報らしき値があれば即 BLOCKED。
 */

export const F124_CHECKS = Object.freeze({
  A: ["autoUpdateTestsPassed", "ciAndCodeqlPassed", "failClosedVerified", "notificationsVerified", "evidenceVerified"],
  B: ["automationEnvironmentMainOnly", "automationSecretNames9", "pipelineVariableTrue", "applyEnvironmentReviewer"],
  C: ["orchestratedPlanSucceeded", "orchestratedBackupValid", "orchestratedDryRunSucceeded", "applyApprovedByOwner", "applyVerified", "appliedStateUpdated", "publicSiteMatchesAppliedState", "allDatasetsCurrent"],
});

/** 本人の判断（2026-10-03）: 招待制の少人数ベータだけを許可する。解除の範囲は記録の stillProhibited で固定する。 */
export const F124_RELEASE_VERDICT = "F124_RELEASED_FOR_LIMITED_INVITE_BETA";
export const F124_REQUIRED_PROHIBITIONS = Object.freeze([
  "public_signup", "account_signup_before_custom_smtp", "photo_posts_stage2_production", "production_schema_rls_storage_changes",
  "community_public", "photo_posts_public", "public_announcement", "noindex_removal", "search_engine_listing", "billing",
  "unapproved_production_apply", "automated_rollback_restore",
]);

const RUN_ID = /^[0-9]{1,20}$/;
const SECRET_LIKE = [/sb_secret_/i, /^eyJ[A-Za-z0-9_-]{10,}\./, /-----BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----/, /^(postgres|postgresql):\/\//i, /AGE-SECRET-KEY-/i, /@[a-z0-9-]+\.[a-z]{2,}/i];

function scanSecrets(value, pathName, problems) {
  if (typeof value === "string") {
    if (SECRET_LIKE.some((re) => re.test(value))) problems.push(`secret_like_value:${pathName}`);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) scanSecrets(v, `${pathName}.${k}`, problems);
  }
}

/**
 * @param {unknown} input { checks: Record<string, boolean>, evidence: { applyRunId?, planRunId?, backupRunId?, dryRunRunId? } }
 * @returns {{ verdict: "F124_HOLD" | "F124_READY_FOR_OWNER_DECISION" | "F124_RELEASED_FOR_LIMITED_INVITE_BETA" | "F124_BLOCKED", parts: Record<"A"|"B"|"C", { ok: boolean, missing: string[] }>, problems: string[] }}
 */
export function evaluateF124(input) {
  const problems = [];
  const parts = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { verdict: "F124_BLOCKED", parts: { A: { ok: false, missing: [] }, B: { ok: false, missing: [] }, C: { ok: false, missing: [] } }, problems: ["input_not_object"] };
  }
  scanSecrets(input, "input", problems);
  const checks = input.checks && typeof input.checks === "object" ? input.checks : {};
  const known = new Set(Object.values(F124_CHECKS).flat());
  for (const k of Object.keys(checks)) if (!known.has(k)) problems.push(`unknown_check:${k}`);
  for (const [part, keys] of Object.entries(F124_CHECKS)) {
    const missing = keys.filter((k) => checks[k] !== true);
    parts[part] = { ok: missing.length === 0, missing };
  }
  // C は run id の根拠が無いと true でも認めない（申告だけでは足りない）。
  const ev = input.evidence && typeof input.evidence === "object" ? input.evidence : {};
  if (parts.C.ok) {
    const needed = ["planRunId", "backupRunId", "dryRunRunId", "applyRunId"].filter((k) => !RUN_ID.test(String(ev[k] ?? "")));
    if (needed.length) {
      parts.C = { ok: false, missing: needed.map((k) => `evidence.${k}`) };
    }
  }
  // 本人の判断（ownerDecision）は記録を読むだけで、このコードが作ることはない。A・B・C が揃っていないのに
  // 解除の記録がある、または判断の値・範囲が契約と違う場合は BLOCKED（記録と事実の食い違い）。
  const decision = input.ownerDecision;
  if (decision !== undefined && decision !== null) {
    if (typeof decision !== "object" || decision.verdict !== F124_RELEASE_VERDICT || decision.decidedBy !== "owner" || !/^\d{4}-\d{2}-\d{2}$/.test(String(decision.date ?? ""))) {
      problems.push("owner_decision_invalid");
    } else {
      const forbidden = Array.isArray(decision.stillProhibited) ? decision.stillProhibited : [];
      const missingProhibitions = F124_REQUIRED_PROHIBITIONS.filter((x) => !forbidden.includes(x));
      if (missingProhibitions.length) problems.push(`owner_decision_missing_prohibitions:${missingProhibitions.join(",")}`);
    }
  }
  if (problems.length) return { verdict: "F124_BLOCKED", parts, problems };
  const ok = parts.A.ok && parts.B.ok && parts.C.ok;
  if (decision) return ok ? { verdict: F124_RELEASE_VERDICT, parts, problems } : { verdict: "F124_BLOCKED", parts, problems: ["owner_decision_without_verified_checks"] };
  return { verdict: ok ? "F124_READY_FOR_OWNER_DECISION" : "F124_HOLD", parts, problems };
}
