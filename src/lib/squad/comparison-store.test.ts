import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getComparisonPref,
  setComparisonPref,
  SQUAD_COMPARISON_STORE_KEY,
  SQUAD_COMPARISON_STORAGE_VERSION,
} from "./comparison-store";

function installMemoryStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    },
  });
  return map;
}

describe("comparison-store", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("既定は squadId 両方 null", () => {
    const p = getComparisonPref();
    expect(p.squadIdA).toBeNull();
    expect(p.squadIdB).toBeNull();
    expect(p.storageVersion).toBe(SQUAD_COMPARISON_STORAGE_VERSION);
  });

  it("有効な ID を保存 → 取得", () => {
    setComparisonPref("sq_abc123def456", "sq_zzz999yyy888");
    const p = getComparisonPref();
    expect(p.squadIdA).toBe("sq_abc123def456");
    expect(p.squadIdB).toBe("sq_zzz999yyy888");
    expect(p.updatedAt).not.toBe("");
  });

  it("不正な ID は null 化して保存する", () => {
    setComparisonPref("../secret", "not an id!!");
    const p = getComparisonPref();
    expect(p.squadIdA).toBeNull();
    expect(p.squadIdB).toBeNull();
  });

  it("スカッド本体などの余計なキーを保存しない", () => {
    const map = installMemoryStorage();
    setComparisonPref("sq_abc123def456", "sq_zzz999yyy888");
    const raw = JSON.parse(map.get(SQUAD_COMPARISON_STORE_KEY)!);
    expect(Object.keys(raw).sort()).toEqual(["squadIdA", "squadIdB", "storageVersion", "updatedAt"].sort());
  });

  it("壊れた JSON は既定へフォールバック", () => {
    const map = installMemoryStorage();
    map.set(SQUAD_COMPARISON_STORE_KEY, "{ broken");
    expect(getComparisonPref().squadIdA).toBeNull();
  });

  it("localStorage 不可でもクラッシュしない", () => {
    vi.unstubAllGlobals();
    expect(() => setComparisonPref("sq_abc123def456", null)).not.toThrow();
    expect(getComparisonPref().squadIdA).toBeNull();
  });
});
