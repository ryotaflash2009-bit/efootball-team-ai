/**
 * Google OAuth の公開のゲート（pure・2026-10-11）。docs/production-readiness/google-oauth-release-gate.md。
 *
 * 2 段階（本人の方針 2026-10-11: 設定と限定の本番の確認が済めば、すぐ有効にしてよい。アカウントの削除の完成は待たない）:
 *  1. 有効化の前（preEnable）: 本人の Google Cloud・Supabase の設定の記録 ＋ コードの自動の確認 → READY_TO_ENABLE / BLOCKED
 *  2. 有効化の後（postEnable）: 限定の本番の確認 → GO（有効のまま）/ NO-GO（入口を閉じる）/ PENDING（確認中）
 * 同じメールの自動の統合は推測で保証しない: prodExistingEmailConflictRecorded は「観測した結果を記録した」ことを求め、
 * 観測の値（linked | separate）は判定に使わない（どちらでも、記録して文書と一致させる）。
 */

export const PRE_ENABLE_ITEMS = [
  "googleConsentScreenConfigured",
  "googleWebClientCreated",
  "googleRedirectUriExact",
  "supabaseGoogleProviderEnabled",
  "supabaseRedirectUrlsExact",
  "supabaseConfirmEmailOn",
  "supabaseManualLinkingOff",
  "secretNotInRepoOrChat",
  "privacyPolicyGoogleReviewed",
];
export const POST_ENABLE_ITEMS = [
  "prodNewGoogleLogin",
  "prodCallbackSuccess",
  "prodAccountRecordCreated",
  "prodSessionRestore",
  "prodLogoutAndRelogin",
  "prodGuestCarryOver",
  "prodPcBrowser",
  "prodIphoneSafari",
  "prodAndroidChrome",
  "prodOauthCancel",
  "prodExistingEmailConflictRecorded",
  "prodRlsIsolationAB",
];
/** 失敗したら直ちに入口を閉じる項目（他人のデータ・既存のアカウントを壊しうる）。 */
export const ROLLBACK_ITEMS = ["prodRlsIsolationAB", "prodExistingEmailConflictRecorded", "prodCallbackSuccess", "prodGuestCarryOver"];

const STATUSES = new Set(["pending", "pass", "fail", "n/a"]);
/** 個人情報・秘密情報らしい値（メール・UUID・Google の client ID / secret・JWT）を Evidence に書かせない。 */
const SENSITIVE_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|apps\.googleusercontent\.com|GOCSPX-|eyJ[A-Za-z0-9_-]{10,}\./i;

/**
 * コードの自動の確認。
 * @param {{ oauthSource: string, dictJa: string, dictEn: string, accountViewSource: string, callbackSource: string }} src
 */
export function codeChecks(src) {
  const mode = /export const GOOGLE_OAUTH_MODE: GoogleOAuthMode = "(\w+)"/.exec(src.oauthSource)?.[1] ?? null;
  return {
    oauthModeExplicit: mode === "disabled" || mode === "enabled",
    oauthMode: mode,
    // 不明な値は無効（isGoogleOAuthAvailable は "enabled" のときだけ true）
    unknownModeFailsClosed: /if \(mode === "enabled"\) return true;/.test(src.oauthSource),
    callbackSeparatesGoogleFlow: /oauthCallbackFailure\(url\.search\)/.test(src.callbackSource) && /exchangeCodeForSession\(code\)/.test(src.callbackSource),
    manualDeletionNoticeJa: /deletionManualBody: "[^"]*運営/.test(src.dictJa),
    manualDeletionNoticeEn: /deletionManualBody: "[^"]*operator/.test(src.dictEn),
    accountPageLinksDeletion: /href="\/account\/delete"/.test(src.accountViewSource),
  };
}

function evaluateGroup(group, items) {
  const problems = [];
  const counts = { pending: 0, pass: 0, fail: 0, "n/a": 0 };
  for (const key of items) {
    const item = group?.[key];
    if (!item || !STATUSES.has(item.status)) {
      problems.push(`${key}: missing or invalid status`);
      counts.pending += 1;
      continue;
    }
    counts[item.status] += 1;
    if (typeof item.evidence === "string" && SENSITIVE_RE.test(item.evidence)) problems.push(`${key}: evidence looks like personal or secret data`);
    if (item.status === "pass" && !item.checkedAt) problems.push(`${key}: pass without checkedAt`);
  }
  return { counts, problems };
}

/**
 * @param {{ checklist: any, code: ReturnType<typeof codeChecks> }} p
 */
export function evaluateOAuthReleaseGate({ checklist, code }) {
  const pre = evaluateGroup(checklist?.preEnable, PRE_ENABLE_ITEMS);
  const post = evaluateGroup(checklist?.postEnable, POST_ENABLE_ITEMS);
  const codeFailures = Object.entries(code)
    .filter(([k, v]) => k !== "oauthMode" && v !== true)
    .map(([k]) => k);
  const preReady = codeFailures.length === 0 && pre.problems.length === 0 && pre.counts.pass + pre.counts["n/a"] === PRE_ENABLE_ITEMS.length;
  const preEnableVerdict = preReady ? "READY_TO_ENABLE" : "BLOCKED";

  const rollbackFailed = ROLLBACK_ITEMS.filter((k) => checklist?.postEnable?.[k]?.status === "fail");
  const conflict = checklist?.postEnable?.prodExistingEmailConflictRecorded;
  const conflictRecorded = conflict?.status !== "pass" || conflict?.observedLinking === "linked" || conflict?.observedLinking === "separate";
  let postEnableVerdict = "NOT_STARTED";
  if (code.oauthMode === "enabled" || post.counts.pass + post.counts.fail > 0) {
    if (rollbackFailed.length > 0 || post.counts.fail > 0) postEnableVerdict = "NO_GO";
    else if (!conflictRecorded || post.problems.length > 0) postEnableVerdict = "PENDING";
    else if (post.counts.pass + post.counts["n/a"] === POST_ENABLE_ITEMS.length) postEnableVerdict = "GO";
    else postEnableVerdict = "PENDING";
  }
  // 有効のコードなのに有効化の前の条件がそろっていない（設定の前に PR がマージされた）→ 入口を閉じる
  const enabledWithoutReadiness = code.oauthMode === "enabled" && !preReady;
  return {
    preEnableVerdict,
    postEnableVerdict: enabledWithoutReadiness ? "NO_GO" : postEnableVerdict,
    rollbackRequired: enabledWithoutReadiness || postEnableVerdict === "NO_GO",
    codeFailures,
    preEnable: pre,
    postEnable: post,
    rollbackFailed,
    conflictRecorded,
  };
}
