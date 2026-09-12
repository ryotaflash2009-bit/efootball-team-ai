import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";
import { setSupabaseServerClientForTesting } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * このテストは実際のSupabaseへ一切接続しない。`setSupabaseServerClientForTesting`で
 * `next/headers`のCookie APIも実Supabase通信も使わないテストダブルへ差し替え、
 * ルートハンドラーの分岐(コード交換の成否・遷移先の安全性)だけを決定的に検証する。
 */

function makeFakeClient(exchangeResult: { error: { message: string } | null }): SupabaseClient {
  return {
    auth: {
      exchangeCodeForSession: async () => exchangeResult,
    },
  } as unknown as SupabaseClient;
}

function makeRequest(path: string): Request {
  return new Request(`http://localhost:3000${path}`);
}

describe("GET /auth/callback", () => {
  afterEach(() => {
    setSupabaseServerClientForTesting(null);
  });

  it("codeが無い場合はサインイン画面へ内部遷移する(セッション情報は含めない)", async () => {
    const res = await GET(makeRequest("/auth/callback"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/sign-in");
    expect(location).toContain("authError=missing_code");
  });

  it("Supabase未設定(nullクライアント)の場合は安全な内部遷移をする", async () => {
    setSupabaseServerClientForTesting(async () => null);
    const res = await GET(makeRequest("/auth/callback?code=abc123"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/sign-in");
    expect(location).toContain("authError=not_configured");
  });

  it("コード交換に失敗した場合は安全な内部遷移をする(生のエラー内容は含めない)", async () => {
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: { message: "invalid grant: secret-detail" } }));
    const res = await GET(makeRequest("/auth/callback?code=abc123"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/sign-in");
    expect(location).toContain("authError=callback_failed");
    expect(location).not.toContain("secret-detail");
  });

  it("コード交換に成功した場合は既定の内部パス(/account)へ遷移する", async () => {
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: null }));
    const res = await GET(makeRequest("/auth/callback?code=abc123"));
    const location = res.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/account");
  });

  it("許可された内部パス(next)を指定した場合はそこへ遷移する", async () => {
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: null }));
    const res = await GET(makeRequest("/auth/callback?code=abc123&next=%2Fauth%2Fupdate-password"));
    const location = res.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/auth/update-password");
  });

  it("外部URLをnextに指定しても外部へは遷移しない(既定の内部パスへフォールバック)", async () => {
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: null }));
    const res = await GET(makeRequest("/auth/callback?code=abc123&next=https%3A%2F%2Fevil.example.com"));
    const location = res.headers.get("location") ?? "";
    const resolved = new URL(location);
    expect(resolved.hostname).toBe("localhost");
    expect(resolved.pathname).toBe("/account");
  });

  it("トークンやセッション情報を遷移先URLへ一切含めない", async () => {
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: null }));
    const res = await GET(makeRequest("/auth/callback?code=abc123"));
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("access_token");
    expect(location).not.toContain("refresh_token");
    expect(location).not.toContain("abc123");
  });
});
