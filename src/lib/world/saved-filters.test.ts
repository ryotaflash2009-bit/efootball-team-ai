import { describe, expect, it } from "vitest";
import {
  cleanFilterName,
  deleteFilter,
  loadSavedFilters,
  MAX_SAVED_FILTERS,
  newSavedFilterId,
  normalizeFilterQuery,
  saveFilter,
  savedFiltersStorageKey,
  SAVED_FILTERS_SCHEMA,
} from "./saved-filters";

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const KEY = savedFiltersStorageKey({ kind: "guest" });
let n = 0;
const id = () => `sf_test${String(++n).padStart(4, "0")}`;

describe("保存した絞り込み（NEW-31）", () => {
  it("クエリは決まった項目だけ（ページ番号・未知の項目は除く）・決まった並び", () => {
    expect(normalizeFilterQuery("?page=3&position=CF&evil=1&q=messi&sort=name")).toBe("q=messi&position=CF&sort=name");
    expect(normalizeFilterQuery("page=2")).toBe("");
    expect(normalizeFilterQuery(`q=${"a".repeat(200)}`)).toBe(`q=${"a".repeat(60)}`);
  });

  it("名前は制御文字・双方向の制御文字を除き、30 文字まで・空は不可", () => {
    expect(cleanFilterName("  CF‮  の\n候補 ")).toBe("CF の 候補");
    expect(cleanFilterName("   ")).toBeNull();
    expect(cleanFilterName("あ".repeat(50))).toHaveLength(30);
  });

  it("保存・同じ名前は上書き・削除・最大 10 件・空の条件は保存しない", () => {
    const ls = memory();
    const now = "2026-10-09T00:00:00.000Z";
    expect(saveFilter(ls, KEY, "CF", "position=CF", now, id)).toMatchObject({ ok: true, replaced: false });
    expect(saveFilter(ls, KEY, "CF", "position=CF&minOvr=90", now, id)).toMatchObject({ ok: true, replaced: true });
    expect(loadSavedFilters(ls, KEY)).toHaveLength(1);
    expect(loadSavedFilters(ls, KEY)[0].query).toBe("position=CF&minOvr=90");
    expect(saveFilter(ls, KEY, "空", "page=2", now, id)).toEqual({ ok: false, reason: "empty_query" });
    expect(saveFilter(ls, KEY, " ", "q=a", now, id)).toEqual({ ok: false, reason: "invalid_name" });
    for (let i = 2; i <= MAX_SAVED_FILTERS; i++) expect(saveFilter(ls, KEY, `F${i}`, "q=a", now, id).ok).toBe(true);
    expect(saveFilter(ls, KEY, "11", "q=a", now, id)).toEqual({ ok: false, reason: "full" });
    const first = loadSavedFilters(ls, KEY)[0];
    expect(deleteFilter(ls, KEY, first.id)).toHaveLength(MAX_SAVED_FILTERS - 1);
  });

  it("壊れた保存・別の形・不正な項目は読み飛ばす（例外を出さない）", () => {
    const ls = memory();
    ls.setItem(KEY, "{broken");
    expect(loadSavedFilters(ls, KEY)).toEqual([]);
    ls.setItem(KEY, JSON.stringify({ schema: "other", items: [] }));
    expect(loadSavedFilters(ls, KEY)).toEqual([]);
    ls.setItem(KEY, JSON.stringify({ schema: SAVED_FILTERS_SCHEMA, items: [{ id: "bad", name: "x", query: "q=a", createdAt: "" }, { id: "sf_abcdef", name: "ok", query: "page=1&q=b", createdAt: "t" }] }));
    expect(loadSavedFilters(ls, KEY)).toEqual([{ id: "sf_abcdef", name: "ok", query: "q=b", createdAt: "t" }]);
    expect(loadSavedFilters(null, KEY)).toEqual([]);
    expect(saveFilter(null, KEY, "a", "q=a", "t", id)).toEqual({ ok: false, reason: "storage" });
  });

  it("キーはスコープごと・ID の形", () => {
    expect(savedFiltersStorageKey({ kind: "account", scopeId: "abc" })).toBe("efootball-team-ai:local:account:abc:saved-player-filters:v1");
    expect(newSavedFilterId()).toMatch(/^sf_[a-z0-9]{6,16}$/);
  });
});
