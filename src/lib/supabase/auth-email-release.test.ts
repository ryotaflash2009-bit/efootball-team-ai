import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateAuthEmailRelease, REQUIRED_CHECKS } from "../../../scripts/lib/auth-email-release.mjs";
import { ACCOUNT_SIGNUP_MODE, AUTH_EMAIL_DELIVERY, isSignupOpen } from "./account-availability";

/** 認証メール公開前の Release Validator（scripts/lib/auth-email-release.mjs）。 */
function readyInput() {
  return {
    metadata: {
      siteUrl: "https://example.app",
      senderDomain: "auth.example.app",
      fromAddress: "no-reply@auth.example.app",
      smtpHost: "smtp.resend.com",
      redirectAllowlist: ["https://example.app/auth/callback**"],
    },
    checks: Object.fromEntries(REQUIRED_CHECKS.map((c: string) => [c, true])),
    ownerApprovedAt: "2026-10-01",
  };
}

describe("認証メール Release Validator", () => {
  it("すべての要件がそろったときだけ READY", () => {
    const r = evaluateAuthEmailRelease(readyInput());
    expect(r.verdict).toBe("AUTH_EMAIL_RELEASE_READY");
    expect(r.missing).toEqual([]);
    expect(r.problems).toEqual([]);
  });

  it("要件が1つでも false なら BLOCKED で、足りない項目を返す", () => {
    for (const c of REQUIRED_CHECKS) {
      const input = readyInput();
      (input.checks as Record<string, boolean>)[c] = false;
      const r = evaluateAuthEmailRelease(input);
      expect(r.verdict, c).toBe("AUTH_EMAIL_RELEASE_BLOCKED");
      expect(r.missing).toEqual([c]);
    }
  });

  it("Secret らしき項目名・値、個人のメールアドレスは BLOCKED（値そのものは出力しない）", () => {
    const withKey = { ...readyInput(), smtpPassword: "x" };
    const withValue = readyInput();
    withValue.metadata.smtpHost = "re_" + "A".repeat(20);
    const withEmail = { ...readyInput(), note: "owner@example.com" };
    for (const input of [withKey, withValue, withEmail]) {
      const r = evaluateAuthEmailRelease(input);
      expect(r.verdict).toBe("AUTH_EMAIL_RELEASE_BLOCKED");
      expect(JSON.stringify(r)).not.toContain("AAAAAAAA");
      expect(JSON.stringify(r)).not.toContain("owner@example.com");
    }
  });

  it("Site URL・送信元・許可リストの誤りを BLOCKED にする", () => {
    const cases: [(i: ReturnType<typeof readyInput>) => void, string][] = [
      [(i) => (i.metadata.siteUrl = "http://example.app"), "site_url_not_https_origin"],
      [(i) => (i.metadata.siteUrl = "https://efootball-team-ai.vercel.app"), "site_url_is_vercel_default_domain"],
      [(i) => (i.metadata.fromAddress = "no-reply@other.app"), "from_address_not_on_sender_domain"],
      [(i) => (i.metadata.redirectAllowlist = []), "redirect_allowlist_empty"],
      [(i) => i.metadata.redirectAllowlist.push("https://*.vercel.app/**"), "redirect_allowlist_contains_preview_domain"],
      [(i) => i.metadata.redirectAllowlist.push("https://evil.example/auth/callback"), "redirect_allowlist_entry_not_on_site_auth_path"],
      [(i) => (i.ownerApprovedAt = ""), "owner_approval_date_missing"],
    ];
    for (const [mutate, problem] of cases) {
      const input = readyInput();
      mutate(input);
      const r = evaluateAuthEmailRelease(input);
      expect(r.verdict, problem).toBe("AUTH_EMAIL_RELEASE_BLOCKED");
      expect(r.problems).toContain(problem);
    }
  });

  it("リポジトリの現在のチェックリストは BLOCKED（ドメイン購入の保留中）で、Secret を含まない", () => {
    const file = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "auth-email-release-checklist.json");
    const r = evaluateAuthEmailRelease(JSON.parse(readFileSync(file, "utf8")));
    expect(r.verdict).toBe("AUTH_EMAIL_RELEASE_BLOCKED");
    expect(r.problems.filter((p: string) => p.startsWith("secret_like") || p.startsWith("personal_email"))).toEqual([]);
  });

  it("Validator は新規登録を自動で開かない（2つの Gate は閉じたまま）", () => {
    evaluateAuthEmailRelease(readyInput());
    expect(ACCOUNT_SIGNUP_MODE).toBe("limited");
    expect(AUTH_EMAIL_DELIVERY).toBe("builtin_members_only");
    expect(isSignupOpen()).toBe(false);
  });
});
