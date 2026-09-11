import { describe, it, expect, vi, afterEach } from "vitest";
import { readUploadedTextFile } from "./browser-upload";

afterEach(() => vi.unstubAllGlobals());

/** file.text() を持つ最小のフェイク File。 */
function fakeFile(content: string, opts: { size?: number; noText?: boolean } = {}) {
  const f: Record<string, unknown> = {
    name: "x.json",
    size: opts.size ?? content.length,
  };
  if (!opts.noText) f.text = async () => content;
  return f as unknown as File;
}

describe("browser-upload: SSR / 非ブラウザー安全性", () => {
  it("window 不在 → { ok:false, reason:'ssr' }（読み込まない）", async () => {
    expect(typeof window).toBe("undefined");
    const r = await readUploadedTextFile(fakeFile("{}"), 1000);
    expect(r).toEqual({ ok: false, reason: "ssr" });
  });

  it("file.text が無い（File API 不在相当）→ no-file-api", async () => {
    vi.stubGlobal("window", {});
    expect(await readUploadedTextFile(fakeFile("{}", { noText: true }), 1000)).toEqual({
      ok: false,
      reason: "no-file-api",
    });
    expect(await readUploadedTextFile(null, 1000)).toEqual({ ok: false, reason: "no-file-api" });
  });
});

describe("browser-upload: 読み込み", () => {
  it("size が上限超なら読み込む前に too-large", async () => {
    vi.stubGlobal("window", {});
    let called = false;
    const f = { name: "big.json", size: 5000, text: async () => { called = true; return "x"; } } as unknown as File;
    expect(await readUploadedTextFile(f, 1000)).toEqual({ ok: false, reason: "too-large" });
    expect(called).toBe(false);
  });

  it("正常なテキストを返す", async () => {
    vi.stubGlobal("window", {});
    const r = await readUploadedTextFile(fakeFile('{"a":1}'), 1000);
    expect(r).toEqual({ ok: true, text: '{"a":1}' });
  });

  it("size が無くても本文バイト数で上限判定する", async () => {
    vi.stubGlobal("window", {});
    const big = "あ".repeat(500); // UTF-8 で 1500 バイト
    const f = { name: "x.json", text: async () => big } as unknown as File;
    expect(await readUploadedTextFile(f, 1000)).toEqual({ ok: false, reason: "too-large" });
  });

  it("text() が投げたら read-error（内容を漏らさない）", async () => {
    vi.stubGlobal("window", {});
    const f = { name: "x.json", size: 10, text: async () => { throw new Error("boom secret"); } } as unknown as File;
    const r = await readUploadedTextFile(f, 1000);
    expect(r).toEqual({ ok: false, reason: "read-error" });
  });

  it("text() が文字列以外を返したら read-error", async () => {
    vi.stubGlobal("window", {});
    const f = { name: "x.json", size: 10, text: async () => 42 } as unknown as File;
    expect(await readUploadedTextFile(f, 1000)).toEqual({ ok: false, reason: "read-error" });
  });
});
