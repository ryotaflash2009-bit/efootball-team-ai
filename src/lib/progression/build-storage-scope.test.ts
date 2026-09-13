import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveBuild,
  renameBuild,
  duplicateBuild,
  deleteBuild,
  listBuilds,
  listAllBuilds,
  getActiveBuildsStorageKey,
} from "./build-storage";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * My Buildsのアカウント別スコープ対応(Stage 3)専用のテスト。
 * 既存の`build-storage.test.ts`(guestスコープ固定での通常動作の網羅)とは別に、
 * スコープの解決状況そのものが挙動へ与える影響だけを検証する。
 */
function installMemoryStorage() {
  const map = new Map<string, string>();
  const listeners = new Set<(e: { key: string | null }) => void>();
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
    addEventListener: (type: string, cb: (e: { key: string | null }) => void) => {
      if (type === "storage") listeners.add(cb);
    },
    removeEventListener: (type: string, cb: (e: { key: string | null }) => void) => {
      if (type === "storage") listeners.delete(cb);
    },
  });
  return { map, dispatchStorageEvent: (key: string | null) => listeners.forEach((cb) => cb({ key })) };
}

const base = {
  worldCardId: "89138556575063",
  buildName: "テストビルド",
  progressionAllocation: { finishing: 5 },
  selectedPlayerBooster: null,
  calculatedStats: { finishing: 85 },
  calculatedOvr: 91,
  calculationMode: "provisional" as const,
  rulesVersion: "progression/2026-08-28.provisional-1",
};

beforeEach(() => {
  setCurrentScope(null);
});

describe("スコープ未解決(認証状態確認中)", () => {
  it("読み込みは空(安全な既定値)", () => {
    installMemoryStorage();
    expect(listAllBuilds()).toEqual([]);
    expect(listBuilds(base.worldCardId)).toEqual([]);
  });

  it("書き込みは拒否される", () => {
    installMemoryStorage();
    const result = saveBuild(base);
    expect(result.ok).toBe(false);
  });

  it("getActiveBuildsStorageKeyはnullを返す", () => {
    installMemoryStorage();
    expect(getActiveBuildsStorageKey()).toBeNull();
  });
});

describe("guestスコープ", () => {
  it("guest領域のキーへ読み書きする", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    const result = saveBuild(base);
    expect(result.ok).toBe(true);
    const guestKey = buildScopedStorageKey({ kind: "guest" }, "myBuilds");
    expect(map.has(guestKey)).toBe(true);
    expect(getActiveBuildsStorageKey()).toBe(guestKey);
  });
});

describe("アカウント別スコープの分離", () => {
  it("ユーザーAで保存したMy BuildsはユーザーBのスコープからは見えない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveBuild({ ...base, buildName: "Aのビルド" });
    expect(listAllBuilds().map((b) => b.buildName)).toEqual(["Aのビルド"]);

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listAllBuilds()).toEqual([]);
  });

  it("ユーザーBのMy BuildsはユーザーAのスコープへ戻っても混ざらない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveBuild({ ...base, buildName: "Aのビルド" });

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    saveBuild({ ...base, buildName: "Bのビルド" });
    expect(listAllBuilds().map((b) => b.buildName)).toEqual(["Bのビルド"]);

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listAllBuilds().map((b) => b.buildName)).toEqual(["Aのビルド"]);
  });

  it("guest領域とaccount領域は独立している", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    saveBuild({ ...base, buildName: "guestビルド" });

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listAllBuilds()).toEqual([]);

    setCurrentScope({ kind: "guest" });
    expect(listAllBuilds().map((b) => b.buildName)).toEqual(["guestビルド"]);
  });

  it("ログアウト(account→null→guest)でaccount領域のデータは削除されない", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveBuild({ ...base, buildName: "Aのビルド" });
    const accountKey = buildScopedStorageKey({ kind: "account", scopeId: "a".repeat(64) }, "myBuilds");

    setCurrentScope(null);
    setCurrentScope({ kind: "guest" });

    expect(map.has(accountKey)).toBe(true);
    const stored = JSON.parse(map.get(accountKey)!);
    expect(Object.values(stored).flat()).toHaveLength(1);
    expect(listAllBuilds()).toEqual([]);
  });

  it("更新・名前変更・複製・削除もすべて現在のスコープだけを操作する", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    const saved = saveBuild({ ...base, buildName: "元" });
    if (!saved.ok) throw new Error();
    renameBuild(base.worldCardId, saved.build.buildId, "改名後");
    expect(listBuilds(base.worldCardId)[0].buildName).toBe("改名後");

    const dup = duplicateBuild(base.worldCardId, saved.build.buildId);
    expect(dup.ok).toBe(true);
    expect(listBuilds(base.worldCardId)).toHaveLength(2);

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listBuilds(base.worldCardId)).toEqual([]);
    // Bのスコープから、Aのビルドを操作しようとしても対象が見つからず失敗する(誤って別アカウントを触らない)
    expect(deleteBuild(base.worldCardId, saved.build.buildId).ok).toBe(true); // 存在しない削除は成功扱い(既存仕様どおり)
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listBuilds(base.worldCardId)).toHaveLength(2); // Aのビルドは無事残っている
  });
});

describe("storageイベントの扱い", () => {
  it("現在アクティブなスコープのキーのstorageイベントを無視せず検出できる(getActiveBuildsStorageKeyが動的キーを返す)", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveBuild(base);
    const key = getActiveBuildsStorageKey();
    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    const otherKey = getActiveBuildsStorageKey();
    expect(key).not.toBe(otherKey);
  });
});
