import { describe, it, expect } from "vitest";
import { authErrorMessageKey, callbackErrorFromQuery, classifyEmailLinkFailure, parseConfirmParams } from "./email-link";

const HASH = "a".repeat(56);

describe("/auth/confirm のパラメーター検証", () => {
  it("許可した種類と正しい形式の token hash だけを受け付け、戻り先は種類ごとの固定の内部パス", () => {
    expect(parseConfirmParams(`?token_hash=${HASH}&type=email`)).toEqual({ ok: true, tokenHash: HASH, type: "email", next: "/account" });
    expect(parseConfirmParams(`?token_hash=pkce_${HASH}&type=recovery`)).toMatchObject({ ok: true, next: "/auth/update-password" });
    expect(parseConfirmParams(`?token_hash=${HASH}&type=invite`)).toMatchObject({ ok: true, next: "/auth/update-password" });
    expect(parseConfirmParams(`?token_hash=${HASH}&type=email_change`)).toMatchObject({ ok: true, next: "/account" });
    expect(parseConfirmParams(`?token_hash=${HASH}&type=magiclink`)).toMatchObject({ ok: true, next: "/account" });
  });

  it("欠落・未知の種類・不正な文字・短すぎ／長すぎ・任意の戻り先の指定は拒否（リダイレクト先を受け取らない）", () => {
    for (const q of [
      "",
      `?type=email`,
      `?token_hash=${HASH}`,
      `?token_hash=${HASH}&type=signup_admin`,
      `?token_hash=abc&type=email`,
      `?token_hash=${"a".repeat(300)}&type=email`,
      `?token_hash=${HASH}<script>&type=email`,
      `?token_hash=${HASH}%0d%0aSet-Cookie:x&type=email`,
      `?token_hash=../../x${HASH}&type=email`,
    ]) {
      expect(parseConfirmParams(q), q).toEqual({ ok: false, reason: "link_invalid" });
    }
    const withNext = parseConfirmParams(`?token_hash=${HASH}&type=email&next=https://evil.example`);
    expect(withNext.ok && withNext.next).toBe("/account");
  });
});

describe("リンクの失敗理由の一般化（生のエラー文を出さない）", () => {
  it("期限切れ・使用済みは同じ理由、レート制限、無効、その他", () => {
    expect(classifyEmailLinkFailure({ code: "otp_expired", status: 403 })).toBe("link_expired");
    expect(classifyEmailLinkFailure({ code: "flow_state_expired" })).toBe("link_expired");
    expect(classifyEmailLinkFailure({ status: 403 })).toBe("link_expired");
    expect(classifyEmailLinkFailure({ code: "bad_code_verifier" })).toBe("link_invalid");
    expect(classifyEmailLinkFailure({ status: 429 })).toBe("rate_limited");
    expect(classifyEmailLinkFailure({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(classifyEmailLinkFailure({ status: 500 })).toBe("unavailable");
    expect(classifyEmailLinkFailure({ status: 503, code: "unexpected_failure" })).toBe("unavailable");
    expect(classifyEmailLinkFailure({ status: 400 })).toBe("unknown");
    expect(classifyEmailLinkFailure(null)).toBe("unknown");
  });

  it("コールバックへ付いた error / error_code（error_description は使わない）", () => {
    expect(callbackErrorFromQuery("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")).toBe("link_expired");
    expect(callbackErrorFromQuery("?error=server_error&error_code=unexpected")).toBe("link_invalid");
    expect(callbackErrorFromQuery("?code=abc")).toBeNull();
  });

  it("サインイン画面の authError → 表示キー（未知は一般的な失敗）", () => {
    expect(authErrorMessageKey("link_expired")).toBe("authErrorLinkExpired");
    expect(authErrorMessageKey("callback_failed")).toBe("authErrorLinkInvalid");
    expect(authErrorMessageKey("missing_code")).toBe("authErrorLinkInvalid");
    expect(authErrorMessageKey("rate_limited")).toBe("authErrorRateLimited");
    expect(authErrorMessageKey("not_configured")).toBe("authErrorNotConfigured");
    expect(authErrorMessageKey("unavailable")).toBe("authErrorServiceUnavailable");
    expect(authErrorMessageKey("<script>")).toBe("signInFailedMessage");
    expect(authErrorMessageKey(null)).toBeNull();
  });
});
