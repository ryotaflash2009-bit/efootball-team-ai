import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addFavorite,
  getFavorites,
  getActiveFavoritesStorageKey,
  __invalidateFavoritesSnapshotForTests,
  __resetFavoritesWindowListenerForTests,
} from "./favorites-storage";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * お気に入りのアカウント別スコープ対応(Stage 3)専用のテスト。
 * my-team-storage-scope.test.tsと同じ方針で、既存の`user-cards.test.ts`(guestスコープ固定)
 * とは別に、スコープの解決状況そのものが挙動へ与える影響だけを検証する。
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
  // __resetCurrentScopeForTests()はcurrent-scope-storeの購読者一覧そのものを空にしてしまうため
  // ここでは使わない(favorites-storage.tsがモジュール読込時に登録した購読が失われるため)。
  setCurrentScope(null);
  __invalidateFavoritesSnapshotForTests();
  __resetFavoritesWindowListenerForTests();
});

describe("スコープ未解決(認証状態確認中)", () => {
  it("読み込みは空(安全な既定値)", () => {
    installMemoryStorage();
    expect(getFavorites()).toEqual([]);
  });

  it("書き込みは拒否される", () => {
    installMemoryStorage();
    const result = addFavorite("123456");
    expect(result.ok).toBe(false);
  });

  it("getActiveFavoritesStorageKeyはnullを返す", () => {
    installMemoryStorage();
    expect(getActiveFavoritesStorageKey()).toBeNull();
  });
});

describe("guestスコープ", () => {
  it("guest領域のキーへ読み書きする", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    const result = addFavorite("1");
    expect(result.ok).toBe(true);
    const guestKey = buildScopedStorageKey({ kind: "guest" }, "favorites");
    expect(map.has(guestKey)).toBe(true);
    expect(getActiveFavoritesStorageKey()).toBe(guestKey);
  });
});

describe("アカウント別スコープの分離", () => {
  it("ユーザーAで追加したお気に入りはユーザーBのスコープからは見えない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addFavorite("1");
    expect(getFavorites().map((r) => r.worldCardId)).toEqual(["1"]);

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(getFavorites()).toEqual([]);
  });

  it("ユーザーBのお気に入りはユーザーAのスコープへ戻っても混ざらない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addFavorite("1");

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    addFavorite("2");
    expect(getFavorites().map((r) => r.worldCardId)).toEqual(["2"]);

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(getFavorites().map((r) => r.worldCardId)).toEqual(["1"]);
  });

  it("guest領域とaccount領域は独立している", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    addFavorite("9");

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(getFavorites()).toEqual([]);

    setCurrentScope({ kind: "guest" });
    expect(getFavorites().map((r) => r.worldCardId)).toEqual(["9"]);
  });

  it("ログアウト(account→null→guest)でaccount領域のデータは削除されない", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addFavorite("1");
    const accountKey = buildScopedStorageKey({ kind: "account", scopeId: "a".repeat(64) }, "favorites");

    setCurrentScope(null); // セッション確認中相当
    setCurrentScope({ kind: "guest" }); // ログアウト後

    expect(map.has(accountKey)).toBe(true);
    expect(JSON.parse(map.get(accountKey)!).records).toHaveLength(1);
    expect(getFavorites()).toEqual([]); // guestスコープからは見えない
  });
});

describe("重複判定", () => {
  it("同じworldCardIdを重複追加しない(既存レコードを返す)", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    const first = addFavorite("1");
    const second = addFavorite("1");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(getFavorites()).toHaveLength(1);
  });
});

describe("storageイベントの扱い", () => {
  it("現在アクティブなスコープのキーのstorageイベントはキャッシュを破棄する", () => {
    const { map, dispatchStorageEvent } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addFavorite("1");
    const key = getActiveFavoritesStorageKey()!;
    map.set(
      key,
      JSON.stringify({
        storageVersion: "favorites-storage/2026-08-30.v1",
        updatedAt: "",
        records: [
          {
            localRecordId: "fav_xxxx",
            worldCardId: "2",
            note: "",
            tags: [],
            addedAt: "t",
            updatedAt: "t",
            source: "local",
            syncStatus: "local_only",
          },
        ],
      }),
    );
    dispatchStorageEvent(key);
    expect(getFavorites().map((r) => r.worldCardId)).toEqual(["2"]);
  });

  it("別スコープのキーのstorageイベントは無視する(現在のキャッシュのスナップショット参照が変わらない)", () => {
    const { dispatchStorageEvent } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addFavorite("1");
    const before = getFavorites();

    const otherKey = buildScopedStorageKey({ kind: "account", scopeId: "b".repeat(64) }, "favorites");
    dispatchStorageEvent(otherKey);
    const after = getFavorites();
    expect(after).toBe(before);
  });
});

describe("スコープ切り替え自体の通知", () => {
  it("スコープが切り替わると自動的にキャッシュが破棄され、新スコープの内容を返す", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addFavorite("1");
    getFavorites(); // キャッシュ確定

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(getFavorites()).toEqual([]);
  });
});
