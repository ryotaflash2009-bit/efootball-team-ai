/**
 * 認証メール（新規登録の一般公開）前の Release Validator（純関数・外部アクセスなし）。
 *
 * - 入力は **公開してよいメタデータと、本人が確認した結果（true/false）だけ**。
 *   SMTP のパスワード・API キー・メールアドレス・メール本文・リンクは受け付けない（それらしき値があれば即 BLOCKED）。
 * - すべての要件がそろったときだけ AUTH_EMAIL_RELEASE_READY。それでも**新規登録は自動では開かない**
 *   （src/lib/supabase/account-availability.ts の2つの Gate を PR で変える必要がある）。
 */

export const REQUIRED_CHECKS = Object.freeze([
  "domainVerified", // Resend で送信ドメインが Verified
  "vercelDomainActive", // Vercel で独自ドメインが Valid Configuration・SSL 有効
  "siteUrlUpdated", // Supabase Site URL を独自ドメインへ
  "redirectAllowlistUpdated", // Supabase Redirect URLs を最小に
  "customSmtpEnabled", // Supabase Custom SMTP 有効
  "rateLimitConfigured", // メール送信のレート制限を上げていない
  "templatesInstalled", // 6種類のテンプレートを貼り付け済み
  "spfPass",
  "dkimPass",
  "dmarcConfigured",
  "gmailDelivered",
  "icloudDelivered",
  "outlookDelivered",
  "signupConfirmationPassed",
  "passwordResetPassed",
  "emailChangePassed",
  "securityTestsPassed", // 公開サイトの認証 black-box
  "supportReady",
  "privacyReady",
  "termsReady",
  "ownerApproval",
]);

const SECRET_LIKE = [
  /^re_[A-Za-z0-9_]{8,}$/, // Resend API キー
  /^sb_secret_/i,
  /^eyJ[A-Za-z0-9_-]{10,}\./, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^(postgres|postgresql):\/\//i,
];
// checks.* の項目名は REQUIRED_CHECKS と完全一致で検査するため、ここでは対象外（spfPass 等の誤検知を避ける）。
const SECRET_KEYS = /password|passwd|^pass$|secret|api[_-]?key|token|credential|private|cookie/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpsOrigin(v) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash && !u.username && !u.password && u.origin === v.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

/** @returns {{ verdict: "AUTH_EMAIL_RELEASE_READY" | "AUTH_EMAIL_RELEASE_BLOCKED", missing: string[], problems: string[] }} */
export function evaluateAuthEmailRelease(input) {
  const missing = [];
  const problems = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { verdict: "AUTH_EMAIL_RELEASE_BLOCKED", missing: [...REQUIRED_CHECKS], problems: ["input_not_object"] };
  }

  // Secret らしき値・項目名があれば即停止（値そのものは出力しない）。
  const walk = (obj, pathKey) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = pathKey ? `${pathKey}.${k}` : k;
      if (key !== `checks.${k}` && SECRET_KEYS.test(k)) problems.push(`secret_like_field:${key}`);
      if (typeof v === "string") {
        if (SECRET_LIKE.some((re) => re.test(v))) problems.push(`secret_like_value:${key}`);
        if (EMAIL_RE.test(v) && k !== "fromAddress") problems.push(`personal_email_not_allowed:${key}`);
      } else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, key);
    }
  };
  walk(input, "");

  const checks = input.checks && typeof input.checks === "object" ? input.checks : {};
  for (const c of REQUIRED_CHECKS) if (checks[c] !== true) missing.push(c);
  for (const k of Object.keys(checks)) if (!REQUIRED_CHECKS.includes(k)) problems.push(`unknown_check:${k}`);

  const meta = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const siteUrl = typeof meta.siteUrl === "string" ? meta.siteUrl.trim() : "";
  if (!isHttpsOrigin(siteUrl)) problems.push("site_url_not_https_origin");
  else if (/\.vercel\.app$/i.test(new URL(siteUrl).hostname)) problems.push("site_url_is_vercel_default_domain");

  const senderDomain = typeof meta.senderDomain === "string" ? meta.senderDomain.trim().toLowerCase() : "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(senderDomain)) problems.push("sender_domain_invalid");
  const from = typeof meta.fromAddress === "string" ? meta.fromAddress.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(from) || !from.endsWith(`@${senderDomain}`)) problems.push("from_address_not_on_sender_domain");
  if (typeof meta.smtpHost !== "string" || !/^[a-z0-9.-]+$/i.test(meta.smtpHost)) problems.push("smtp_host_invalid");

  const allow = Array.isArray(meta.redirectAllowlist) ? meta.redirectAllowlist : [];
  if (allow.length === 0) problems.push("redirect_allowlist_empty");
  for (const entry of allow) {
    if (typeof entry !== "string") {
      problems.push("redirect_allowlist_entry_not_string");
      continue;
    }
    if (!siteUrl || !entry.startsWith(`${siteUrl.replace(/\/+$/, "")}/auth/`)) problems.push("redirect_allowlist_entry_not_on_site_auth_path");
    if (/vercel\.app/i.test(entry)) problems.push("redirect_allowlist_contains_preview_domain");
    if (/^https?:\/\/\*|:\/\/[^/]*\*/.test(entry)) problems.push("redirect_allowlist_wildcard_host");
  }

  if (checks.ownerApproval === true && !(typeof input.ownerApprovedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.ownerApprovedAt))) {
    problems.push("owner_approval_date_missing");
  }

  const ready = missing.length === 0 && problems.length === 0;
  return { verdict: ready ? "AUTH_EMAIL_RELEASE_READY" : "AUTH_EMAIL_RELEASE_BLOCKED", missing, problems: [...new Set(problems)] };
}
