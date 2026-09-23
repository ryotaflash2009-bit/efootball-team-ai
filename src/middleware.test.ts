import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Supabase環境変数を空にし、middlewareがSupabase Authへ通信しない状態でだけ検証する(外部通信なし)。
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubGlobal("fetch", () => {
    throw new Error("network access is not allowed in this test");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("middleware: 内部ページのfail-closed", () => {
  it("表示不可の環境では内部ページをレンダリング前に404へrewriteする", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_EFTA_INTERNAL_PAGES", "");
    for (const p of ["/release-readiness", "/account/rls-test", "/release-readiness/"]) {
      const res = await middleware(new NextRequest(`http://localhost:3000${p}`));
      expect(res.status, p).toBe(404);
      expect(res.headers.get("x-middleware-rewrite"), p).toContain("/__internal-page-not-available");
    }
  });

  it("通常ページ・データ管理ページは404にしない", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const p of ["/", "/data-management", "/account", "/release-readiness-other"]) {
      const res = await middleware(new NextRequest(`http://localhost:3000${p}`));
      expect(res.status, p).not.toBe(404);
    }
  });

  it("明示のenabledでは内部ページを通す", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_EFTA_INTERNAL_PAGES", "enabled");
    const res = await middleware(new NextRequest("http://localhost:3000/release-readiness"));
    expect(res.status).not.toBe(404);
  });
});
