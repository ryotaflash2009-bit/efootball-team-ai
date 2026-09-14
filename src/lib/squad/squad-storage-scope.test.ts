import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveSquad, renameSquad, duplicateSquad, deleteSquad, listSquads, emptySquad, getActiveSquadsStorageKey } from "./squad-storage";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * 保存スカッドのアカウント別スコープ対応(Stage 4)専用のテスト。
 * 既存の`squad-storage.test.ts`(guestスコープ固定での通常動作の網羅)とは別に、
 * スコープの解決状況そのものが挙動へ与える影響だけを検証する(build-storage-scope.test.tsと同じ方針)。
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

beforeEach(() => {
  setCurrentScope(null);
});

describe("スコープ未解決(認証状態確認中)", () => {
  it("読み込みは空(安全な既定値)", () => {
    installMemoryStorage();
    expect(listSquads()).toEqual([]);
  });

  it("書き込みは拒否される", () => {
    installMemoryStorage();
    const result = saveSquad(emptySquad("未解決中"));
    expect(result.ok).toBe(false);
  });

  it("getActiveSquadsStorageKeyはnullを返す", () => {
    installMemoryStorage();
    expect(getActiveSquadsStorageKey()).toBeNull();
  });
});

describe("guestスコープ", () => {
  it("guest領域のキーへ読み書きする", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    const result = saveSquad(emptySquad("guestスカッド"));
    expect(result.ok).toBe(true);
    const guestKey = buildScopedStorageKey({ kind: "guest" }, "squads");
    expect(map.has(guestKey)).toBe(true);
    expect(getActiveSquadsStorageKey()).toBe(guestKey);
  });
});

describe("アカウント別スコープの分離", () => {
  it("ユーザーAで保存したスカッドはユーザーBのスコープからは見えない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveSquad(emptySquad("Aのスカッド"));
    expect(listSquads().map((s) => s.squadName)).toEqual(["Aのスカッド"]);

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listSquads()).toEqual([]);
  });

  it("ユーザーBのスカッドはユーザーAのスコープへ戻っても混ざらない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveSquad(emptySquad("Aのスカッド"));

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    saveSquad(emptySquad("Bのスカッド"));
    expect(listSquads().map((s) => s.squadName)).toEqual(["Bのスカッド"]);

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listSquads().map((s) => s.squadName)).toEqual(["Aのスカッド"]);
  });

  it("guest領域とaccount領域は独立している", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    saveSquad(emptySquad("guestスカッド"));

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listSquads()).toEqual([]);

    setCurrentScope({ kind: "guest" });
    expect(listSquads().map((s) => s.squadName)).toEqual(["guestスカッド"]);
  });

  it("ログアウト(account→null→guest)でaccount領域のデータは削除されない", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveSquad(emptySquad("Aのスカッド"));
    const accountKey = buildScopedStorageKey({ kind: "account", scopeId: "a".repeat(64) }, "squads");

    setCurrentScope(null);
    setCurrentScope({ kind: "guest" });

    expect(map.has(accountKey)).toBe(true);
    const stored = JSON.parse(map.get(accountKey)!);
    expect(stored).toHaveLength(1);
    expect(listSquads()).toEqual([]);
  });

  it("名前変更・複製・削除もすべて現在のスコープだけを操作する", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    const saved = saveSquad(emptySquad("元"));
    if (!saved.ok) throw new Error();
    renameSquad(saved.squad.squadId, "改名後");
    expect(listSquads()[0].squadName).toBe("改名後");

    const dup = duplicateSquad(saved.squad.squadId);
    expect(dup.ok).toBe(true);
    expect(listSquads()).toHaveLength(2);

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listSquads()).toEqual([]);
    // Bのスコープから、Aのスカッドを操作しようとしても対象が見つからず失敗する(誤って別アカウントを触らない)
    expect(deleteSquad(saved.squad.squadId).ok).toBe(true); // 存在しない削除は成功扱い(既存仕様どおり)
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listSquads()).toHaveLength(2); // Aのスカッドは無事残っている
  });
});

describe("storageイベントの扱い", () => {
  it("現在アクティブなスコープのキーのstorageイベントを無視せず検出できる(getActiveSquadsStorageKeyが動的キーを返す)", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    saveSquad(emptySquad("x"));
    const key = getActiveSquadsStorageKey();
    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    const otherKey = getActiveSquadsStorageKey();
    expect(key).not.toBe(otherKey);
  });
});
