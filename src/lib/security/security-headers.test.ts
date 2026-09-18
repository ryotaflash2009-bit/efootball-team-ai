import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./security-headers.mjs";

describe("buildSecurityHeaders", () => {
  it("常時付与する低リスクヘッダーを含む", () => {
    const headers = buildSecurityHeaders(false);
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Permissions-Policy"]).toContain("camera=()");
  });

  it("Content-Security-Policyヘッダーを含む", () => {
    const headers = buildSecurityHeaders(false);
    expect(headers.some((h) => h.key === "Content-Security-Policy")).toBe(true);
  });
});

describe("buildContentSecurityPolicy(本番)", () => {
  const csp = buildContentSecurityPolicy(false);

  it("既定はselfのみに制限する", () => {
    expect(csp).toContain("default-src 'self'");
  });

  it("Supabaseへの接続のみを許可する(connect-src)", () => {
    expect(csp).toContain("connect-src 'self' https://*.supabase.co");
  });

  it("開発用のeval/WebSocket許可を含まない", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("ws://localhost");
  });

  it("iframeへの埋め込みを禁止する(frame-ancestors 'none')", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("object-srcを禁止する", () => {
    expect(csp).toContain("object-src 'none'");
  });

  it("画像はselfとdata:のみ許可する(自ドメインの画像プロキシ経路のみ)", () => {
    expect(csp).toContain("img-src 'self' data:");
  });
});

describe("buildContentSecurityPolicy(開発)", () => {
  const csp = buildContentSecurityPolicy(true);

  it("Fast Refresh用のunsafe-evalを含む", () => {
    expect(csp).toContain("unsafe-eval");
  });

  it("HMR用WebSocket接続を許可する", () => {
    expect(csp).toContain("ws://localhost:*");
    expect(csp).toContain("wss://localhost:*");
  });

  it("Supabaseへの接続は本番と同様に許可する", () => {
    expect(csp).toContain("https://*.supabase.co");
  });
});
