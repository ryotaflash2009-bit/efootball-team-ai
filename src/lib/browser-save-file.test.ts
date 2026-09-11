import { describe, it, expect, vi, afterEach } from "vitest";
import { isSaveFilePickerSupported, saveTextFile } from "./browser-save-file";

afterEach(() => vi.unstubAllGlobals());

function fakeAbortError(): { name: string; message: string } {
  return { name: "AbortError", message: "The user aborted a request." };
}

describe("browser-save-file: isSaveFilePickerSupported", () => {
  it("window 不在 → false", () => {
    expect(typeof window).toBe("undefined");
    expect(isSaveFilePickerSupported()).toBe(false);
  });

  it("showSaveFilePicker が関数 → true / 関数でない・不在 → false", () => {
    vi.stubGlobal("window", { showSaveFilePicker: () => {} });
    expect(isSaveFilePickerSupported()).toBe(true);
    vi.stubGlobal("window", { showSaveFilePicker: "not-a-function" });
    expect(isSaveFilePickerSupported()).toBe(false);
    vi.stubGlobal("window", {});
    expect(isSaveFilePickerSupported()).toBe(false);
  });
});

describe("browser-save-file: saveTextFile（SSR 安全性）", () => {
  it("window 不在 → { ok:false, reason:'ssr' }（何もしない）", async () => {
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "ssr", method: "picker" });
  });
});

describe("browser-save-file: showSaveFilePicker 経由（対応ブラウザー）", () => {
  function stubPicker(handleFactory: (suggested: unknown) => unknown) {
    const picker = vi.fn(async (opts: unknown) => handleFactory(opts));
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    return picker;
  }

  it("suggestedName・MIME type・.json 拡張子を正しく渡す", async () => {
    let capturedOpts: unknown = null;
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    stubPicker((opts) => {
      capturedOpts = opts as Record<string, unknown>;
      return { createWritable: async () => writable };
    });

    const r = await saveTextFile("efootball-team-ai-builds-2026-09-05-000000-000Z.json", '{"a":1}');
    expect(r).toEqual({ ok: true, method: "picker" });
    expect(capturedOpts).not.toBeNull();
    expect((capturedOpts as Record<string, unknown>).suggestedName).toBe(
      "efootball-team-ai-builds-2026-09-05-000000-000Z.json",
    );
    const types = (capturedOpts as { types: Array<{ description: string; accept: Record<string, string[]> }> }).types;
    expect(types[0].accept["application/json"]).toEqual([".json"]);
    expect(types[0].description).toContain("JSON");
    expect(writable.write).toHaveBeenCalledWith('{"a":1}');
    expect(writable.close).toHaveBeenCalledOnce();
  });

  it("startIn を渡すと候補ディレクトリとして反映される（絶対パスは渡さない）", async () => {
    let capturedOpts: unknown = null;
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    stubPicker((opts) => {
      capturedOpts = opts as Record<string, unknown>;
      return { createWritable: async () => writable };
    });
    await saveTextFile("x.json", "{}", { startIn: "documents" });
    expect((capturedOpts as Record<string, unknown>).startIn).toBe("documents");
  });

  it("write 失敗 → { ok:false, reason:'error' }・close は試みる", async () => {
    const writable = {
      write: vi.fn(async () => {
        throw new Error("disk full");
      }),
      close: vi.fn(async () => {}),
    };
    stubPicker(() => ({ createWritable: async () => writable }));
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "error", method: "picker" });
    expect(writable.close).toHaveBeenCalledOnce();
  });

  it("write 成功・close 失敗 → { ok:false, reason:'error' }（成功表示しない）", async () => {
    const writable = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {
        throw new Error("close failed");
      }),
    };
    stubPicker(() => ({ createWritable: async () => writable }));
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "error", method: "picker" });
  });

  it("ユーザーキャンセル（AbortError）→ { ok:false, reason:'cancelled' }（エラー表示しない）", async () => {
    const picker = vi.fn(async () => {
      throw fakeAbortError();
    });
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "cancelled", method: "picker" });
  });

  it("DOMException の AbortError もキャンセル扱い", async () => {
    const picker = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "cancelled", method: "picker" });
  });

  it("AbortError 以外の例外（権限拒否など）は error 扱い（キャンセルと誤表示しない）", async () => {
    const picker = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "error", method: "picker" });
  });

  it("createWritable が例外 → error 扱い", async () => {
    stubPicker(() => ({
      createWritable: async () => {
        throw new Error("no permission");
      },
    }));
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "error", method: "picker" });
  });

  it("ファイルハンドルをどこにも永続化しない（localStorage / IndexedDB へ触れない）", async () => {
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const setItem = vi.fn();
    const picker = vi.fn(async () => ({ createWritable: async () => writable }));
    vi.stubGlobal("window", {
      showSaveFilePicker: picker,
      localStorage: { setItem, getItem: () => null },
      indexedDB: { open: vi.fn() },
    });
    await saveTextFile("x.json", "{}");
    expect(setItem).not.toHaveBeenCalled();
    const idb = (window as unknown as { indexedDB: { open: ReturnType<typeof vi.fn> } }).indexedDB;
    expect(idb.open).not.toHaveBeenCalled();
  });

  it("ファイル内容を console へ出さない", async () => {
    const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    vi.stubGlobal("window", { showSaveFilePicker: vi.fn(async () => ({ createWritable: async () => writable })) });
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await saveTextFile("x.json", '{"secret":"do-not-log"}');
    for (const c of [...spy.mock.calls, ...errSpy.mock.calls].flat()) {
      expect(String(c)).not.toContain("do-not-log");
    }
    spy.mockRestore();
    errSpy.mockRestore();
  });
});

describe("browser-save-file: フォールバック（showSaveFilePicker 非対応）", () => {
  function stubDownloadEnv() {
    const anchor: Record<string, unknown> = { style: {} };
    let clicked = 0;
    anchor.click = () => {
      clicked++;
    };
    vi.stubGlobal("window", { setTimeout: () => 0 }); // showSaveFilePicker なし
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: {
        appendChild: (n: unknown) => {
          (n as Record<string, unknown>).parentNode = { removeChild: () => {} };
        },
      },
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:mock/0",
      revokeObjectURL: () => {},
    });
    return { get clicked() { return clicked; }, anchor };
  }

  it("showSaveFilePicker が無い環境では既存 downloadTextFile 方式を使う", async () => {
    const env = stubDownloadEnv();
    const r = await saveTextFile("x.json", '{"a":1}');
    expect(r).toEqual({ ok: true, method: "download" });
    expect(env.clicked).toBe(1);
    expect(env.anchor.download).toBe("x.json");
  });

  it("URL API 不在（createObjectURL なし）→ download 側も ssr 扱いで失敗", async () => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    vi.stubGlobal("document", { createElement: () => ({ style: {} }), body: { appendChild: () => {} } });
    vi.stubGlobal("URL", {});
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "ssr", method: "download" });
  });

  it("document 不在 → download 側も ssr 扱いで失敗", async () => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "ssr", method: "download" });
  });

  it("Blob 生成が例外を投げたら download 側で error", async () => {
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
    const r = await saveTextFile("x.json", "{}");
    expect(r).toEqual({ ok: false, reason: "error", method: "download" });
  });
});
