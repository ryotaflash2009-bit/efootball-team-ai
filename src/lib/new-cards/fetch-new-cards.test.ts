import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetNewCardsCache, fetchNewCardsOnce } from "./fetch-new-cards";

afterEach(() => {
  vi.unstubAllGlobals();
  _resetNewCardsCache();
});

describe("新しいカードの一覧の読み込み（1 ページで 1 回）", () => {
  it("同時に 2 つの欄が呼んでも要求は 1 回", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ cards: [{ worldCardId: "1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const [a, b] = await Promise.all([fetchNewCardsOnce(), fetchNewCardsOnce()]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.map((c) => c.worldCardId)).toEqual(["1"]);
  });

  it("失敗は空の一覧で、次の呼び出しで読み直す", async () => {
    const f = vi.fn(async () => new Response("", { status: 500 }));
    vi.stubGlobal("fetch", f);
    expect(await fetchNewCardsOnce()).toEqual([]);
    await fetchNewCardsOnce();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("別のページの読み込み（メモリが空）でも、5 分以内ならタブの保存から読み、要求しない", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const f = vi.fn(async () => new Response(JSON.stringify({ cards: [{ worldCardId: "7" }] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    await fetchNewCardsOnce();
    const saved = [...store.entries()];
    _resetNewCardsCache(); // メモリとタブの保存を消す → 保存だけ戻して「次のページの読み込み」を再現
    for (const [k, v] of saved) store.set(k, v);
    expect((await fetchNewCardsOnce()).map((c) => c.worldCardId)).toEqual(["7"]);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
