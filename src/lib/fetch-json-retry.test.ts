import { describe, it, expect, vi } from "vitest";
import { fetchJsonRetry } from "./fetch-json-retry";

const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("fetchJsonRetry", () => {
  it("成功ならそのまま返す", async () => {
    const f = vi.fn(async () => res(200, { a: 1 }));
    expect(await fetchJsonRetry("/x", { fetchImpl: f as unknown as typeof fetch, delayMs: 0 })).toEqual({ a: 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("500 は 1 回だけやり直す", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(200, { ok: true }));
    expect(await fetchJsonRetry("/x", { fetchImpl: f as unknown as typeof fetch, delayMs: 0 })).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("通信の失敗もやり直す・2 回目も失敗なら null", async () => {
    const f = vi.fn().mockRejectedValue(new Error("net"));
    expect(await fetchJsonRetry("/x", { fetchImpl: f as unknown as typeof fetch, delayMs: 0 })).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("4xx はやり直さない", async () => {
    const f = vi.fn(async () => res(400));
    expect(await fetchJsonRetry("/x", { fetchImpl: f as unknown as typeof fetch, delayMs: 0 })).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("中断はそのまま投げる", async () => {
    const c = new AbortController();
    const f = vi.fn(async () => {
      c.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(fetchJsonRetry("/x", { fetchImpl: f as unknown as typeof fetch, signal: c.signal, delayMs: 0 })).rejects.toThrow();
  });
});
