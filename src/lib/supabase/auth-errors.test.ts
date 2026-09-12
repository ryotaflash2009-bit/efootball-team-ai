import { describe, it, expect } from "vitest";
import { classifySignInFailure, classifySignUpFailure, classifyPasswordResetFailure } from "./auth-errors";

describe("classifySignInFailure", () => {
  it("status 429はRATE_LIMITEDになる", () => {
    expect(classifySignInFailure({ status: 429 })).toBe("RATE_LIMITED");
  });

  it("invalid_credentialsやstatus 400はINVALID_CREDENTIALSになる(メール/パスワードどちらが誤りかは区別しない)", () => {
    expect(classifySignInFailure({ code: "invalid_credentials" })).toBe("INVALID_CREDENTIALS");
    expect(classifySignInFailure({ status: 400 })).toBe("INVALID_CREDENTIALS");
  });

  it("未知のエラーはUNKNOWNになる", () => {
    expect(classifySignInFailure({ status: 500, message: "internal error detail that must not leak" })).toBe("UNKNOWN");
  });
});

describe("classifySignUpFailure", () => {
  it("レート制限コードはRATE_LIMITEDになる", () => {
    expect(classifySignUpFailure({ code: "over_email_send_rate_limit" })).toBe("RATE_LIMITED");
  });

  it("weak_passwordはWEAK_PASSWORDになる", () => {
    expect(classifySignUpFailure({ code: "weak_password" })).toBe("WEAK_PASSWORD");
  });

  it("invalid_email系はINVALID_EMAILになる", () => {
    expect(classifySignUpFailure({ code: "invalid_email" })).toBe("INVALID_EMAIL");
    expect(classifySignUpFailure({ code: "email_address_invalid" })).toBe("INVALID_EMAIL");
  });

  it("未知のエラーはUNKNOWNになる(既存アカウント有無の判定はしない)", () => {
    expect(classifySignUpFailure({ code: "user_already_exists" })).toBe("UNKNOWN");
  });
});

describe("classifyPasswordResetFailure", () => {
  it("レート制限はRATE_LIMITEDになる", () => {
    expect(classifyPasswordResetFailure({ status: 429 })).toBe("RATE_LIMITED");
  });

  it("それ以外はUNKNOWNになる", () => {
    expect(classifyPasswordResetFailure({ status: 500 })).toBe("UNKNOWN");
  });
});
