import { describe, it, expect } from "vitest";
import { validateSupabaseEnv } from "./env";

const VALID_URL = "https://example-project-ref.supabase.co";
const VALID_PUBLISHABLE_KEY = "sb_publishable_abcDEF123-_xyz";

describe("validateSupabaseEnv", () => {
  it("URL未設定はMISSING_URLを返す", () => {
    const r = validateSupabaseEnv({ url: undefined, publishableKey: VALID_PUBLISHABLE_KEY });
    expect(r).toEqual({ ok: false, error: "MISSING_URL" });
  });

  it("URLが空文字でもMISSING_URLを返す", () => {
    const r = validateSupabaseEnv({ url: "", publishableKey: VALID_PUBLISHABLE_KEY });
    expect(r).toEqual({ ok: false, error: "MISSING_URL" });
  });

  it("Publishable key未設定はMISSING_PUBLISHABLE_KEYを返す", () => {
    const r = validateSupabaseEnv({ url: VALID_URL, publishableKey: undefined });
    expect(r).toEqual({ ok: false, error: "MISSING_PUBLISHABLE_KEY" });
  });

  it("無効なURL形式(https以外・不正な文字列)はINVALID_URLを返す", () => {
    expect(validateSupabaseEnv({ url: "not a url", publishableKey: VALID_PUBLISHABLE_KEY })).toEqual({
      ok: false,
      error: "INVALID_URL",
    });
    expect(validateSupabaseEnv({ url: "http://example.supabase.co", publishableKey: VALID_PUBLISHABLE_KEY })).toEqual({
      ok: false,
      error: "INVALID_URL",
    });
    expect(validateSupabaseEnv({ url: "ftp://example.supabase.co", publishableKey: VALID_PUBLISHABLE_KEY })).toEqual({
      ok: false,
      error: "INVALID_URL",
    });
  });

  it("URLに空白・改行が混入している場合はINVALID_URLを返す", () => {
    expect(validateSupabaseEnv({ url: "https://example.supabase.co \n", publishableKey: VALID_PUBLISHABLE_KEY }).ok).toBe(false);
  });

  it("Secret key形式(sb_secret_接頭辞)を明示的に拒否する", () => {
    const r = validateSupabaseEnv({ url: VALID_URL, publishableKey: "sb_secret_abcDEF123" });
    expect(r).toEqual({ ok: false, error: "SECRET_KEY_DETECTED" });
  });

  it("service_role/旧anon形式(JWT、eyJで始まる)を明示的に拒否する", () => {
    const fakeJwtShapedValue = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signatureplaceholder";
    const r = validateSupabaseEnv({ url: VALID_URL, publishableKey: fakeJwtShapedValue });
    expect(r).toEqual({ ok: false, error: "SERVICE_ROLE_KEY_DETECTED" });
  });

  it("Publishable key形式(sb_publishable_接頭辞)を正しく受理する", () => {
    const r = validateSupabaseEnv({ url: VALID_URL, publishableKey: VALID_PUBLISHABLE_KEY });
    expect(r).toEqual({ ok: true, config: { url: VALID_URL, publishableKey: VALID_PUBLISHABLE_KEY } });
  });

  it("Publishable keyに空白・改行が混入している場合は拒否する", () => {
    const r = validateSupabaseEnv({ url: VALID_URL, publishableKey: "sb_publishable_abc 123" });
    expect(r.ok).toBe(false);
  });

  it("接頭辞が正しくない不正な形式はINVALID_PUBLISHABLE_KEY_FORMATを返す", () => {
    const r = validateSupabaseEnv({ url: VALID_URL, publishableKey: "totally-invalid-key" });
    expect(r).toEqual({ ok: false, error: "INVALID_PUBLISHABLE_KEY_FORMAT" });
  });

  it("失敗時、エラーオブジェクトへ実際の入力値(URL・鍵)を一切含めない", () => {
    const r = validateSupabaseEnv({ url: "https://leaked-value-should-not-appear.example.com", publishableKey: "sb_secret_should-not-leak" });
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("leaked-value-should-not-appear");
    expect(serialized).not.toContain("should-not-leak");
    expect(r).toEqual({ ok: false, error: "SECRET_KEY_DETECTED" });
  });

  it("nullを渡してもクラッシュせず、未設定として扱う", () => {
    expect(validateSupabaseEnv({ url: null, publishableKey: null })).toEqual({ ok: false, error: "MISSING_URL" });
  });
});
