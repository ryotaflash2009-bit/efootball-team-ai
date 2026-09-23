import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STAGE1_APPROVAL_TOKEN, createUpstreamHttpTransport } from "./upstream-http-transport";
import { SOURCE_ENDPOINTS, buildSourceRequest, fetchSourceWithRetry } from "./source-transport";
import { buildWorldSearchRequest } from "./source-world";

interface Captured {
  url: string;
  init: RequestInit;
}

function fakeFetch(responses: (() => Response | Promise<Response>)[], captured: Captured[]): typeof fetch {
  let i = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    const next = responses[i++];
    if (!next) throw new Error("no more fake responses");
    return next();
  }) as typeof fetch;
}

const json = (body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) => () => new Response(JSON.stringify(body), { status: 200, headers });
const caps = { "efootball-world": 3, "managers-json": 1 } as const;

describe("upstream実HTTP transport", () => {
  it("承認tokenが無ければ作成できない", () => {
    expect(() => createUpstreamHttpTransport({ approval: "yes", maxRequests: caps })).toThrow();
  });

  it("許可済みendpointへ、Cookie・Authorizationなし・redirect追跡なし・credentials omit・timeout付きで送る", async () => {
    const captured: Captured[] = [];
    const t = createUpstreamHttpTransport({ approval: STAGE1_APPROVAL_TOKEN, maxRequests: caps, fetchImpl: fakeFetch([json({ players: [] })], captured) });
    const res = await t.request(buildWorldSearchRequest(1, "CREATED_AT"));
    expect(res.status).toBe(200);
    expect(captured[0].url).toBe(SOURCE_ENDPOINTS["efootball-world"].url);
    expect(captured[0].init.redirect).toBe("manual");
    expect(captured[0].init.credentials).toBe("omit");
    expect(captured[0].init.signal).toBeInstanceOf(AbortSignal);
    const names = Object.keys(captured[0].init.headers as Record<string, string>).map((h) => h.toLowerCase());
    expect(names).not.toContain("cookie");
    expect(names).not.toContain("authorization");
    expect(t.log[0]).toMatchObject({ sourceId: "efootball-world", status: 200, outcome: "response" });
    expect(JSON.stringify(t.log)).not.toMatch(/https?:|players/);
  });

  it("許可外URL・method・Cookie付きheaderは送信前に拒否する", async () => {
    const captured: Captured[] = [];
    const t = createUpstreamHttpTransport({ approval: STAGE1_APPROVAL_TOKEN, maxRequests: caps, fetchImpl: fakeFetch([], captured) });
    const req = buildWorldSearchRequest(1, "CREATED_AT");
    await expect(t.request({ ...req, url: "https://evil.invalid/" })).rejects.toMatchObject({ code: "endpoint_not_allowed" });
    await expect(t.request({ ...req, method: "GET" })).rejects.toMatchObject({ code: "endpoint_not_allowed" });
    await expect(t.request({ ...req, headers: { ...req.headers, Cookie: "a=b" } })).rejects.toMatchObject({ code: "endpoint_not_allowed" });
    await expect(t.request({ ...req, timeoutMs: 999999 })).rejects.toMatchObject({ code: "endpoint_not_allowed" });
    expect(captured).toEqual([]);
  });

  it("source別の最小間隔(World 3秒)を守り、request上限を超えたら送信しない", async () => {
    const captured: Captured[] = [];
    let clock = 0;
    const waits: number[] = [];
    const t = createUpstreamHttpTransport({
      approval: STAGE1_APPROVAL_TOKEN,
      maxRequests: { "efootball-world": 2, "managers-json": 1 },
      fetchImpl: fakeFetch([json({ players: [] }), json({ players: [] }), json([], { "content-type": "text/plain" })], captured),
      nowMs: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await t.request(buildWorldSearchRequest(1, "CREATED_AT"));
    clock += 1000;
    await t.request(buildWorldSearchRequest(2, "CREATED_AT"));
    expect(waits).toEqual([2000]);
    await expect(t.request(buildWorldSearchRequest(3, "CREATED_AT"))).rejects.toMatchObject({ code: "request_cap_exceeded" });
    await t.request(buildSourceRequest("managers-json", null));
    await expect(t.request(buildSourceRequest("managers-json", null))).rejects.toMatchObject({ code: "request_cap_exceeded" });
    expect(captured.length).toBe(3);
  });

  it("応答byte上限を超えたら読み込みを中断してresponse_too_large", async () => {
    const captured: Captured[] = [];
    const big = "x".repeat(SOURCE_ENDPOINTS["managers-json"].maxResponseBytes + 10);
    const t = createUpstreamHttpTransport({ approval: STAGE1_APPROVAL_TOKEN, maxRequests: caps, fetchImpl: fakeFetch([() => new Response(big, { status: 200, headers: { "content-type": "text/plain" } })], captured) });
    await expect(t.request(buildSourceRequest("managers-json", null))).rejects.toMatchObject({ code: "response_too_large" });
    expect(t.log[0].outcome).toBe("too_large");
  });

  it("timeout・通信失敗をSourceFetchErrorへ変換し、redirect・429はfetchSourceWithRetryで即停止", async () => {
    const captured: Captured[] = [];
    const timeoutErr = Object.assign(new Error("t"), { name: "TimeoutError" });
    const t = createUpstreamHttpTransport({
      approval: STAGE1_APPROVAL_TOKEN,
      maxRequests: { "efootball-world": 10, "managers-json": 1 },
      sleep: async () => undefined,
      fetchImpl: fakeFetch(
        [
          () => Promise.reject(timeoutErr),
          () => Promise.reject(new TypeError("fetch failed")),
          () => new Response(null, { status: 301, headers: { location: "https://elsewhere.invalid/" } }),
          () => new Response("", { status: 429, headers: { "retry-after": "30" } }),
        ],
        captured,
      ),
    });
    const req = buildWorldSearchRequest(1, "CREATED_AT");
    await expect(t.request(req)).rejects.toMatchObject({ code: "timeout" });
    await expect(t.request(req)).rejects.toMatchObject({ code: "network_error" });
    await expect(fetchSourceWithRetry(t, req, { sleep: async () => undefined })).rejects.toMatchObject({ code: "redirect" });
    await expect(fetchSourceWithRetry(t, req, { sleep: async () => undefined })).rejects.toMatchObject({ code: "http_429" });
    expect(captured.length).toBe(4);
  });

  it("このmoduleはファイル・ログ・環境変数へ触れない(静的監査)", () => {
    const src = readFileSync(path.join(__dirname, "upstream-http-transport.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/from\s+["'](node:)?fs["']|writeFile|console\.|process\.env|child_process/);
    expect(src).toMatch(/redirect: "manual"/);
    expect(src).toMatch(/credentials: "omit"/);
  });
});
