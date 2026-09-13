import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectLegacyDataForKind, detectAllLegacyData, hasAnyLegacyData } from "./legacy-detect";
import { LEGACY_KEYS } from "./keys";
import { DATA_KINDS } from "./types";

function installMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    },
  });
  return map;
}

describe("detectLegacyDataForKind", () => {
  it("旧My Teamキーにデータがある場合を検出する", () => {
    installMemoryStorage({ [LEGACY_KEYS.myTeam]: JSON.stringify({ records: [{ worldCardId: "1" }, { worldCardId: "2" }] }) });
    const summary = detectLegacyDataForKind("myTeam");
    expect(summary).toEqual({ kind: "myTeam", hasData: true, itemCount: 2 });
  });

  it("旧My Buildsキーにデータがある場合を検出する", () => {
    installMemoryStorage({ [LEGACY_KEYS.myBuilds]: JSON.stringify({ "111": [{ buildId: "b1" }] }) });
    expect(detectLegacyDataForKind("myBuilds")).toEqual({ kind: "myBuilds", hasData: true, itemCount: 1 });
  });

  it("旧お気に入りキーにデータがある場合を検出する", () => {
    installMemoryStorage({ [LEGACY_KEYS.favorites]: JSON.stringify({ records: [{ worldCardId: "1" }] }) });
    expect(detectLegacyDataForKind("favorites")).toEqual({ kind: "favorites", hasData: true, itemCount: 1 });
  });

  it("旧保存スカッドキーにデータがある場合を検出する", () => {
    installMemoryStorage({ [LEGACY_KEYS.squads]: JSON.stringify([{ squadId: "sq_1" }]) });
    expect(detectLegacyDataForKind("squads")).toEqual({ kind: "squads", hasData: true, itemCount: 1 });
  });

  it("旧スカッドテンプレートキーにデータがある場合を検出する", () => {
    installMemoryStorage({ [LEGACY_KEYS.squadTemplates]: JSON.stringify({ templates: [{ templateId: "tpl_abc123" }] }) });
    expect(detectLegacyDataForKind("squadTemplates")).toEqual({ kind: "squadTemplates", hasData: true, itemCount: 1 });
  });

  it("データが無い場合はhasData:false, itemCount:0", () => {
    installMemoryStorage();
    expect(detectLegacyDataForKind("myTeam")).toEqual({ kind: "myTeam", hasData: false, itemCount: 0 });
  });

  it("壊れたJSONは安全にデータなし扱いになる", () => {
    installMemoryStorage({ [LEGACY_KEYS.myTeam]: "{not valid json" });
    expect(detectLegacyDataForKind("myTeam")).toEqual({ kind: "myTeam", hasData: false, itemCount: 0 });
  });

  it("未知バージョン/構造でも例外を投げず安全に処理する", () => {
    installMemoryStorage({ [LEGACY_KEYS.myTeam]: JSON.stringify({ storageVersion: "unknown/v99", records: "not-an-array" }) });
    expect(() => detectLegacyDataForKind("myTeam")).not.toThrow();
    expect(detectLegacyDataForKind("myTeam").itemCount).toBe(0);
  });

  it("データ本文を返り値へ含めない(件数だけ)", () => {
    installMemoryStorage({ [LEGACY_KEYS.myTeam]: JSON.stringify({ records: [{ worldCardId: "1", note: "secret note" }] }) });
    const summary = detectLegacyDataForKind("myTeam");
    expect(JSON.stringify(summary)).not.toContain("secret note");
  });
});

describe("detectAllLegacyData / hasAnyLegacyData", () => {
  it("5種類すべてを返す", () => {
    installMemoryStorage();
    const all = detectAllLegacyData();
    expect(Object.keys(all).sort()).toEqual([...DATA_KINDS].sort());
  });

  it("いずれかにデータがあればtrueを返す", () => {
    installMemoryStorage({ [LEGACY_KEYS.favorites]: JSON.stringify({ records: [{ worldCardId: "1" }] }) });
    expect(hasAnyLegacyData(detectAllLegacyData())).toBe(true);
  });

  it("すべて空ならfalseを返す", () => {
    installMemoryStorage();
    expect(hasAnyLegacyData(detectAllLegacyData())).toBe(false);
  });
});
