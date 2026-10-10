import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";
import { setSupabaseServerClientForTesting } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * このテストは実際のSupabaseへ一切接続しない。`setSupabaseServerClientForTesting`で
 * `next/headers`のCookie APIも実Supabase通信も使わないテストダブルへ差し替え、
 * ルートハンドラーの分岐(コード交換の成否・遷移先の安全性)だけを決定的に検証する。
 */

function makeFakeClient(exchangeResult: { error: { message: string } | null }, currentUser: { id: string } | null = null): SupabaseClient {
  return {
    auth: {
      exchangeCodeForSession: async () => exchangeResult,
      getUser: async () => ({ data: { user: currentUser }, error: null }),
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

  it("期限切れ・無効なリンク（Supabase の error_code 付き）は理由だけを付けてサインイン画面へ（error_description は含めない）", async () => {
    const res = await GET(makeRequest("/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"));
    const location = res.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/auth/sign-in");
    expect(location).toContain("authError=link_expired");
    expect(location).not.toMatch(/invalid+or|has+expired|error_description/);
  });

  it("コード交換が期限切れ（otp_expired）なら link_expired、レート制限なら rate_limited", async () => {
    setSupabaseServerClientForTesting(async () => ({ auth: { exchangeCodeForSession: async () => ({ error: { message: "x", code: "otp_expired", status: 403 } }) } }) as unknown as SupabaseClient);
    expect((await GET(makeRequest("/auth/callback?code=abc123"))).headers.get("location")).toContain("authError=link_expired");
    setSupabaseServerClientForTesting(async () => ({ auth: { exchangeCodeForSession: async () => ({ error: { message: "x", status: 429 } }) } }) as unknown as SupabaseClient);
    expect((await GET(makeRequest("/auth/callback?code=abc123"))).headers.get("location")).toContain("authError=rate_limited");
  });
});

describe("GET /auth/callback: Google OAuth（flow=google・2026-10-11）", () => {
  afterEach(() => {
    setSupabaseServerClientForTesting(null);
  });
  const loc = async (path: string) => (await GET(makeRequest(path))).headers.get("location") ?? "";

  it("Google の画面でキャンセル（error=access_denied）→ oauth_cancelled（メールのリンクの「期限切れ」とは区別）", async () => {
    expect(await loc("/auth/callback?flow=google&next=%2Faccount&error=access_denied&error_description=secret-detail")).toContain("authError=oauth_cancelled");
    // flow=google が無い access_denied（メールのリンクの期限切れ等）は従来どおり
    expect(await loc("/auth/callback?error=access_denied&error_code=otp_expired")).toContain("authError=link_expired");
  });
  it("Google 側の一時的な障害 → unavailable・その他 → oauth_failed・生の文は含めない", async () => {
    expect(await loc("/auth/callback?flow=google&error=temporarily_unavailable")).toContain("authError=unavailable");
    const l = await loc("/auth/callback?flow=google&error=invalid_request&error_description=secret-detail");
    expect(l).toContain("authError=oauth_failed");
    expect(l).not.toContain("secret-detail");
  });
  it("code が無い・交換に失敗 → oauth_failed／成功 → 安全な next へ（外部 URL は /account）", async () => {
    expect(await loc("/auth/callback?flow=google")).toContain("authError=oauth_failed");
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: { message: "bad" } }));
    expect(await loc("/auth/callback?flow=google&code=abc123")).toContain("authError=oauth_failed");
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: null }));
    expect(new URL(await loc("/auth/callback?flow=google&code=abc123&next=%2Fsquads")).pathname).toBe("/squads");
    expect(new URL(await loc("/auth/callback?flow=google&code=abc123&next=https%3A%2F%2Fevil.example")).pathname).toBe("/account");
  });
});

describe("GET /auth/callback: 二重の callback・再読み込み・戻るボタン（2026-10-11）", () => {
  afterEach(() => {
    setSupabaseServerClientForTesting(null);
  });
  it("交換に失敗しても、既にセッションがあれば next へ進む（同じ code の 2 回目）・無ければ失敗の表示", async () => {
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: { message: "code already used" } }, { id: "u1" }));
    const ok = (await GET(makeRequest("/auth/callback?flow=google&code=used&next=%2Fsquads"))).headers.get("location") ?? "";
    expect(new URL(ok).pathname).toBe("/squads");
    setSupabaseServerClientForTesting(async () => makeFakeClient({ error: { message: "code already used" } }, null));
    expect((await GET(makeRequest("/auth/callback?flow=google&code=used"))).headers.get("location")).toContain("authError=oauth_failed");
  });
});

