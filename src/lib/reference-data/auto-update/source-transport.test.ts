import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  REAL_NETWORK_ACCESS_ENABLED,
  SOURCE_ENDPOINTS,
  SourceFetchError,
  assertAcceptableSourceResponse,
  buildSourceRequest,
  createDisabledSourceTransport,
  createRecordedFixtureTransport,
  fetchSourceWithRetry,
  sourceRequestKey,
  type SourceResponse,
} from "./source-transport";

const WORLD = SOURCE_ENDPOINTS["efootball-world"];
const ok = (bodyText = '{"players":[]}', headers: Record<string, string> = { "content-type": "application/json" }): SourceResponse => ({ status: 200, headers, bodyText });
const noSleep = async () => {};

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof SourceFetchError ? e.code : "other";
  }
}

describe("source transport: 応答の判定", () => {
  it("200+JSONは受理", () => {
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, ok()))).toBeNull();
  });

  it("redirect・429・403・401・5xx・その他statusを区別して拒否する", () => {
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 302, headers: { location: "https://elsewhere.invalid" }, bodyText: "" }))).toBe("redirect");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 429, headers: {}, bodyText: "" }))).toBe("http_429");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 403, headers: {}, bodyText: "denied" }))).toBe("http_403");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 403, headers: {}, bodyText: "<html>Attention Required! captcha</html>" }))).toBe("captcha");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 401, headers: {}, bodyText: "" }))).toBe("http_401");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 503, headers: {}, bodyText: "" }))).toBe("http_5xx");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, { status: 204, headers: {}, bodyText: "" }))).toBe("unexpected_status");
  });

  it("200でもSet-Cookie・CAPTCHAページ・機微情報・空本文・サイズ超過は拒否する", () => {
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, ok("{}", { "Set-Cookie": "a=b" })))).toBe("set_cookie");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, ok("<html>cf-challenge</html>", { "content-type": "text/html; charset=utf-8" })))).toBe("captcha");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, ok('{"players":[],"access_token":"x"}')))).toBe("sensitive_content");
    expect(codeOf(() => assertAcceptableSourceResponse(WORLD, ok("   ")))).toBe("empty_body");
    const small = { ...WORLD, maxResponseBytes: 10 };
    expect(codeOf(() => assertAcceptableSourceResponse(small, ok('{"players":[1,2,3,4,5]}')))).toBe("response_too_large");
  });

  it("エラーメッセージに応答本文・ヘッダー値を含めない", () => {
    try {
      assertAcceptableSourceResponse(WORLD, { status: 302, headers: { location: "https://secret-host.invalid/?token=abc" }, bodyText: "SECRET-BODY" });
    } catch (e) {
      expect(String((e as Error).message)).not.toMatch(/secret-host|token=abc|SECRET-BODY/);
    }
  });
});

describe("source transport: request組み立てとtransport", () => {
  it("許可済みendpointだけを固定URL・固定methodで組み立てる", () => {
    const w = buildSourceRequest("efootball-world", "{}");
    expect(w.method).toBe("POST");
    expect(w.url).toBe(WORLD.url);
    expect(w.headers["Content-Type"]).toBe("application/json");
    const m = buildSourceRequest("managers-json", null);
    expect(m.method).toBe("GET");
    expect(() => buildSourceRequest("managers-json", "{}")).toThrow(SourceFetchError);
    expect(() => buildSourceRequest("unknown" as never, null)).toThrow(SourceFetchError);
    for (const ep of Object.values(SOURCE_ENDPOINTS)) {
      expect(new URL(ep.url).protocol).toBe("https:");
      expect(new URL(ep.url).host).toBe(ep.host);
    }
  });

  it("Cookie・Authorizationヘッダーを送らない", () => {
    for (const id of ["efootball-world", "managers-json"] as const) {
      const req = buildSourceRequest(id, id === "efootball-world" ? "{}" : null);
      const names = Object.keys(req.headers).map((h) => h.toLowerCase());
      expect(names).not.toContain("cookie");
      expect(names).not.toContain("authorization");
    }
  });

  it("既定transportは何も送らずにnetwork_disabledで拒否する。実ネットワークは無効", async () => {
    expect(REAL_NETWORK_ACCESS_ENABLED).toBe(false);
    await expect(createDisabledSourceTransport().request(buildSourceRequest("managers-json", null))).rejects.toMatchObject({ code: "network_disabled" });
  });

  it("fixture transportは記録済みrequestだけに応答し、未記録はfixture_missing", async () => {
    const req = buildSourceRequest("managers-json", null);
    const t = createRecordedFixtureTransport([{ request: req, responses: [ok("[]")] }]);
    expect((await t.request(req)).bodyText).toBe("[]");
    await expect(t.request(req)).rejects.toMatchObject({ code: "fixture_missing" });
    await expect(t.request(buildSourceRequest("efootball-world", "{}"))).rejects.toMatchObject({ code: "fixture_missing" });
    expect(t.calls.length).toBe(3);
    expect(() => createRecordedFixtureTransport([{ request: req, responses: [] }, { request: req, responses: [] }])).toThrow(/重複/);
    expect(sourceRequestKey(req)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("source transport: retry", () => {
  const worldReq = buildSourceRequest("efootball-world", '{"page":1}');

  it("World: 5xx/network/timeoutは最大3回まで試行し、backoffは5秒→15秒", async () => {
    const waits: number[] = [];
    const t = createRecordedFixtureTransport([{ request: worldReq, responses: [{ status: 502, headers: {}, bodyText: "" }, { error: "timeout" }, ok()] }]);
    const r = await fetchSourceWithRetry(t, worldReq, { sleep: async (ms) => void waits.push(ms), now: () => new Date("2026-09-23T00:00:00Z") });
    expect(r.attempts.map((a) => a.code)).toEqual(["http_5xx", "timeout", "ok"]);
    expect(waits).toEqual([5000, 15000]);
    expect(r.attempts.every((a) => a.stage === "source_fetch" && a.at === "2026-09-23T00:00:00.000Z")).toBe(true);
  });

  it("World: 3回とも失敗したら停止し、試行記録を添える", async () => {
    const t = createRecordedFixtureTransport([{ request: worldReq, responses: [{ error: "network_error" }, { error: "network_error" }, { error: "network_error" }, ok()] }]);
    const err = await fetchSourceWithRetry(t, worldReq, { sleep: noSleep }).catch((e) => e);
    expect(err).toBeInstanceOf(SourceFetchError);
    expect(err.attempts.length).toBe(3);
    expect(t.calls.length).toBe(3);
  });

  it("429・403・CAPTCHA・redirect・Set-Cookieは1回で即停止(retryしない)", async () => {
    for (const res of [
      { status: 429, headers: {}, bodyText: "" },
      { status: 403, headers: {}, bodyText: "" },
      { status: 403, headers: {}, bodyText: "captcha" },
      { status: 301, headers: {}, bodyText: "" },
      ok("{}", { "set-cookie": "x=y" }),
    ]) {
      const t = createRecordedFixtureTransport([{ request: worldReq, responses: [res, ok()] }]);
      const err = await fetchSourceWithRetry(t, worldReq, { sleep: noSleep }).catch((e) => e);
      expect(err).toBeInstanceOf(SourceFetchError);
      expect(t.calls.length).toBe(1);
    }
  });

  it("managers.json: 既存syncと同じく再試行しない(5xxでも1回で停止)", async () => {
    const req = buildSourceRequest("managers-json", null);
    const t = createRecordedFixtureTransport([{ request: req, responses: [{ status: 500, headers: {}, bodyText: "" }, ok("[]")] }]);
    await expect(fetchSourceWithRetry(t, req, { sleep: noSleep })).rejects.toMatchObject({ code: "http_5xx" });
    expect(t.calls.length).toBe(1);
  });

  it("許可済みendpointと一致しないrequestは送信前に拒否する", async () => {
    const t = createRecordedFixtureTransport([]);
    await expect(fetchSourceWithRetry(t, { ...worldReq, url: "https://evil.invalid/" }, { sleep: noSleep })).rejects.toMatchObject({ code: "endpoint_not_allowed" });
    await expect(fetchSourceWithRetry(t, { ...worldReq, method: "GET" }, { sleep: noSleep })).rejects.toMatchObject({ code: "endpoint_not_allowed" });
    expect(t.calls.length).toBe(0);
  });
});

describe("source層: 実ネットワークAPIを使っていないことの静的監査", () => {
  const files = readdirSync(__dirname)
    .filter((f) => f.startsWith("source-") && f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => [f, readFileSync(path.join(__dirname, f), "utf8")] as const);

  it("対象が4ファイル以上ある", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it("fetch・http(s)・net・undici・child_process・process.envを使わない", () => {
    for (const [name, src] of files) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, name).not.toMatch(/\bfetch\s*\(|from\s+["'](node:)?(https?|net|tls|dgram|child_process)["']|undici|XMLHttpRequest|WebSocket|process\.env/);
    }
  });
});
