import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadTextFile } from "./browser-download";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser-download: SSR / 非ブラウザー安全性", () => {
  it("window 不在では何もせず { ok: false, reason: 'ssr' }", () => {
    // 既定の vitest 環境（node）は window / document がない
    expect(typeof window).toBe("undefined");
    const r = downloadTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "ssr" });
  });

  it("URL.createObjectURL がなければ { ok: false, reason: 'ssr' }", () => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    vi.stubGlobal("document", { createElement: () => ({}), body: {} });
    vi.stubGlobal("URL", {}); // createObjectURL なし
    expect(downloadTextFile("x.json", "{}")).toEqual({ ok: false, reason: "ssr" });
  });
});

describe("browser-download: ブラウザー相当環境での成功パス", () => {
  function stubBrowser() {
    const created: string[] = [];
    const revoked: string[] = [];
    const appended: unknown[] = [];
    const removed: unknown[] = [];
    let clicked = 0;
    const timers: Array<() => void> = [];

    const anchor: Record<string, unknown> = { style: {} };
    anchor.click = () => {
      clicked++;
    };

    vi.stubGlobal("window", {
      setTimeout: (fn: () => void) => {
        timers.push(fn);
        return timers.length;
      },
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        expect(tag).toBe("a");
        return anchor;
      },
      body: {
        appendChild: (n: unknown) => {
          appended.push(n);
          (n as Record<string, unknown>).parentNode = { removeChild: (c: unknown) => removed.push(c) };
        },
      },
    });
    vi.stubGlobal("URL", {
      createObjectURL: (b: unknown) => {
        expect(b).toBeInstanceOf(Blob);
        const u = `blob:mock/${created.length}`;
        created.push(u);
        return u;
      },
      revokeObjectURL: (u: string) => revoked.push(u),
    });

    return { anchor, created, revoked, appended, removed, get clicked() { return clicked; }, runTimers: () => timers.forEach((t) => t()) };
  }

  it("Blob を作り、a[download] をクリックし、要素を外して Object URL を後で解放する", () => {
    const env = stubBrowser();
    const r = downloadTextFile("efootball-team-ai-builds-2026-09-02-000000-000Z.json", '{"a":1}', "application/json");
    expect(r).toEqual({ ok: true });
    expect(env.clicked).toBe(1);
    expect(env.anchor.download).toBe("efootball-team-ai-builds-2026-09-02-000000-000Z.json");
    expect(env.anchor.rel).toBe("noopener");
    expect(env.created).toHaveLength(1);
    // クリック直後は revoke しない（ダウンロード開始前の revoke を避ける）
    expect(env.revoked).toHaveLength(0);
    // 一時要素は同期で除去済み
    expect(env.removed).toHaveLength(1);
    // タイマー発火後に解放
    env.runTimers();
    expect(env.revoked).toEqual(["blob:mock/0"]);
  });

  it("複数回呼んでも Object URL を残さない（各回それぞれ解放）", () => {
    const env = stubBrowser();
    downloadTextFile("a.json", "{}");
    downloadTextFile("b.json", "{}");
    expect(env.created).toHaveLength(2);
    env.runTimers();
    expect(env.revoked.sort()).toEqual(["blob:mock/0", "blob:mock/1"]);
  });

  it("createObjectURL が投げても { ok: false, reason: 'error' }（成功表示しない）", () => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    vi.stubGlobal("document", {
      createElement: () => ({ style: {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("boom");
      },
      revokeObjectURL: () => {},
    });
    const r = downloadTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "error" });
  });

  it("ダウンロード内容を console へ出さない", () => {
    const env = stubBrowser();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    downloadTextFile("x.json", '{"secret":"do-not-log"}');
    for (const c of [...spy.mock.calls, ...errSpy.mock.calls].flat()) {
      expect(String(c)).not.toContain("do-not-log");
    }
    spy.mockRestore();
    errSpy.mockRestore();
    env.runTimers();
  });
});
