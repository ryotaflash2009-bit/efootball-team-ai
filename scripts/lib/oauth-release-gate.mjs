/**
 * Google OAuth の公開のゲート（pure・2026-10-11 改訂: 2 段階）。docs/production-readiness/google-oauth-release-gate.md。
 *
 * A. LIMITED_OAUTH_TEST_READY — コードを "limited" にしてよい（本番でも `?oauthPreview=1` のときだけボタン・Google 側は Testing）。
 *    条件: コードの確認＋ `limitedTest` の全項目（TeamAIXI 専用の Google Cloud プロジェクトであること・Test user・3 スコープ・
 *    Supabase の設定・プライバシーポリシーの Google の節の公開）。
 * B. PUBLIC_GOOGLE_OAUTH_READY — コードを "enabled" にしてよい（全員にボタン）。
 *    条件: A ＋ 限定テストの結果（`postEnable` の 12 項目がすべて pass・同じメールの観測を記録）＋ `publicRelease`（Google 側の本番公開・
 *    ポリシーの一般公開の記述）。
 * 限定テストの結果の判定: GO / NO_GO / PENDING / NOT_STARTED。NO_GO は直ちに入口を閉じる。
 * 同じメールの自動の統合は推測で保証しない（observedLinking を記録しない限り GO にしない）。
 */

export const LIMITED_TEST_ITEMS = [
  "googleProjectDedicatedToTeamAixi",
  "googleConsentScreenExternalTesting",
  "googleTestUserRegistered",
  "googleScopesBasicOnly",
  "googleWebClientCreated",
  "googleRedirectUriExact",
  "supabaseGoogleProviderEnabled",
  "supabaseCredentialsFromDedicatedProject",
  "supabaseRedirectUrlsExact",
  "supabaseConfirmEmailOn",
  "supabaseManualLinkingOff",
  "secretNotInRepoOrChat",
  "privacyPolicyGoogleSectionLive",
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
export const PUBLIC_RELEASE_ITEMS = ["googleConsentPublishedProduction", "privacyPolicyGeneralAvailability"];
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
    entryModeExplicit: mode === "disabled" || mode === "limited" || mode === "enabled",
    entryMode: mode,
    // 不明な値は無効（"enabled" と "limited"＋preview 以外は false）
    unknownModeFailsClosed: /if \(mode === "enabled"\) return true;/.test(src.oauthSource),
    limitedModeNeedsPreview: /if \(mode === "limited"\) return preview;/.test(src.oauthSource),
    callbackSeparatesGoogleFlow: /oauthCallbackFailure\(url\.search\)/.test(src.callbackSource) && /exchangeCodeForSession\(code\)/.test(src.callbackSource),
    callbackIgnoresPreviewFlag: !/oauthPreview/.test(src.callbackSource),
    manualDeletionNoticeJa: /deletionManualBody: "[^"]*運営/.test(src.dictJa),
    manualDeletionNoticeEn: /deletionManualBody: "[^"]*operator/.test(src.dictEn),
    limitedTestNoticeJa: /googleLimitedTestNotice: "[^"]*限定テスト/.test(src.dictJa),
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
const allPassed = (g, items) => g.problems.length === 0 && g.counts.pass + g.counts["n/a"] === items.length;

/**
 * @param {{ checklist: any, code: ReturnType<typeof codeChecks> }} p
 */
export function evaluateOAuthReleaseGate({ checklist, code }) {
  const limited = evaluateGroup(checklist?.limitedTest, LIMITED_TEST_ITEMS);
  const post = evaluateGroup(checklist?.postEnable, POST_ENABLE_ITEMS);
  const pub = evaluateGroup(checklist?.publicRelease, PUBLIC_RELEASE_ITEMS);
  const codeFailures = Object.entries(code)
    .filter(([k, v]) => k !== "entryMode" && v !== true)
    .map(([k]) => k);

  const limitedReady = codeFailures.length === 0 && allPassed(limited, LIMITED_TEST_ITEMS);
  const limitedVerdict = limitedReady ? "LIMITED_OAUTH_TEST_READY" : "BLOCKED";

  const rollbackFailed = ROLLBACK_ITEMS.filter((k) => checklist?.postEnable?.[k]?.status === "fail");
  const conflict = checklist?.postEnable?.prodExistingEmailConflictRecorded;
  const conflictRecorded = conflict?.status !== "pass" || conflict?.observedLinking === "linked" || conflict?.observedLinking === "separate";
  let postEnableVerdict = "NOT_STARTED";
  if (code.entryMode === "limited" || code.entryMode === "enabled" || post.counts.pass + post.counts.fail > 0) {
    if (rollbackFailed.length > 0 || post.counts.fail > 0) postEnableVerdict = "NO_GO";
    else if (!conflictRecorded || post.problems.length > 0) postEnableVerdict = "PENDING";
    else if (allPassed(post, POST_ENABLE_ITEMS)) postEnableVerdict = "GO";
    else postEnableVerdict = "PENDING";
  }
  const publicReady = limitedReady && postEnableVerdict === "GO" && allPassed(pub, PUBLIC_RELEASE_ITEMS);
  const publicVerdict = publicReady ? "PUBLIC_GOOGLE_OAUTH_READY" : "BLOCKED";

  // コードが条件より先に進んでいる（設定・確認の前にマージした）→ 入口を閉じる
  const modeAhead = (code.entryMode === "limited" && !limitedReady) || (code.entryMode === "enabled" && !publicReady);
  return {
    limitedVerdict,
    publicVerdict,
    postEnableVerdict: modeAhead ? "NO_GO" : postEnableVerdict,
    rollbackRequired: modeAhead || postEnableVerdict === "NO_GO",
    modeAhead,
    codeFailures,
    limitedTest: limited,
    postEnable: post,
    publicRelease: pub,
    rollbackFailed,
    conflictRecorded,
  };
}
