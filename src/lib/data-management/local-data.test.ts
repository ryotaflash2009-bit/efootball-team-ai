import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MANAGED_LOCAL_DATA_KEYS,
  isLocalDataStorageAvailable,
  getManagedKeysWithData,
  deleteAllManagedLocalData,
} from "./local-data";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";
import { DATA_KINDS } from "@/lib/local-storage-scope/types";

function installMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("window", { localStorage: storage });
  return { map, storage };
}

describe("MANAGED_LOCAL_DATA_KEYS", () => {
  it("My Team・お気に入り・保存ビルド・保存スカッド・テンプレート・編集設定・比較状態の既知キーだけを含む", () => {
    const keys = MANAGED_LOCAL_DATA_KEYS.map((e) => e.key);
    expect(keys).toEqual([
      "efootball-team-ai:favorites:v1",
      "efootball-team-ai:my-team:v1",
      "efootball-team-ai:progression-builds:v1",
      "efb:squads:v1",
      "efootball-team-ai:squad-templates:v1",
      "efootball-team-ai:squad-editor-preferences:v1",
      "efootball-team-ai:squad-comparison:v1",
    ]);
  });

  it("表示言語設定・サイドバー開閉状態のキーは含まない(UI設定と保存データを区別する)", () => {
    const keys = MANAGED_LOCAL_DATA_KEYS.map((e) => e.key);
    expect(keys).not.toContain("efootball-team-ai:locale:v1");
    expect(keys).not.toContain("efb:sidebar-collapsed");
  });

  it("アカウント別/guestスコープの新My Teamキー(local:guest:*・local:account:*)を誤って列挙しない", () => {
    // アカウント分離(Stage 2)導入後も、この一括削除機能はレガシー共通キーだけを
    // 対象にする設計を維持する(無断でアカウント別全対応へ変更しない)。
    const keys = MANAGED_LOCAL_DATA_KEYS.map((e) => e.key);
    const guestKeys = DATA_KINDS.map((k) => buildScopedStorageKey({ kind: "guest" }, k));
    const accountKeys = DATA_KINDS.map((k) => buildScopedStorageKey({ kind: "account", scopeId: "a".repeat(64) }, k));
    for (const scoped of [...guestKeys, ...accountKeys]) {
      expect(keys).not.toContain(scoped);
    }
  });
});

describe("local-data（メモリlocalStorage）", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("localStorageが使えない環境ではisLocalDataStorageAvailableがfalseを返す", () => {
    vi.stubGlobal("window", undefined);
    expect(isLocalDataStorageAvailable()).toBe(false);
  });

  it("localStorageが使える環境ではtrueを返す", () => {
    installMemoryStorage();
    expect(isLocalDataStorageAvailable()).toBe(true);
  });

  it("データが存在する管理対象キーだけをgetManagedKeysWithDataが返す", () => {
    installMemoryStorage({
      "efootball-team-ai:my-team:v1": "{}",
      "efb:squads:v1": "{}",
      "efootball-team-ai:locale:v1": "ja", // 管理対象外キー(存在しても含まれてはいけない)
    });
    const present = getManagedKeysWithData().map((e) => e.key);
    expect(present.sort()).toEqual(["efb:squads:v1", "efootball-team-ai:my-team:v1"].sort());
  });

  it("何もデータが無い場合は空配列を返す", () => {
    installMemoryStorage();
    expect(getManagedKeysWithData()).toEqual([]);
  });

  it("deleteAllManagedLocalData: 管理対象キーだけを削除し、対象外キーは変更しない", () => {
    const { map } = installMemoryStorage({
      "efootball-team-ai:favorites:v1": "fav",
      "efootball-team-ai:my-team:v1": "team",
      "efootball-team-ai:progression-builds:v1": "builds",
      "efb:squads:v1": "squads",
      "efootball-team-ai:locale:v1": "en",
      "efb:sidebar-collapsed": "1",
      "some-other-site-key": "untouched",
    });
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(true);
    expect(result.failedKeys).toEqual([]);
    expect(result.attemptedKeys.sort()).toEqual(
      ["efootball-team-ai:favorites:v1", "efootball-team-ai:my-team:v1", "efootball-team-ai:progression-builds:v1", "efb:squads:v1"].sort(),
    );
    // 管理対象は削除されている
    expect(map.has("efootball-team-ai:favorites:v1")).toBe(false);
    expect(map.has("efootball-team-ai:my-team:v1")).toBe(false);
    expect(map.has("efootball-team-ai:progression-builds:v1")).toBe(false);
    expect(map.has("efb:squads:v1")).toBe(false);
    // 言語設定・サイドバー状態・無関係キーは変更されない
    expect(map.get("efootball-team-ai:locale:v1")).toBe("en");
    expect(map.get("efb:sidebar-collapsed")).toBe("1");
    expect(map.get("some-other-site-key")).toBe("untouched");
  });

  it("deleteAllManagedLocalData: アカウント別/guestスコープのMy Teamキーは変更されない", () => {
    const guestMyTeamKey = buildScopedStorageKey({ kind: "guest" }, "myTeam");
    const accountMyTeamKey = buildScopedStorageKey({ kind: "account", scopeId: "b".repeat(64) }, "myTeam");
    const { map } = installMemoryStorage({
      "efootball-team-ai:my-team:v1": "legacy-team",
      [guestMyTeamKey]: "guest-team",
      [accountMyTeamKey]: "account-team",
    });
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(true);
    expect(result.attemptedKeys).toEqual(["efootball-team-ai:my-team:v1"]);
    expect(map.has("efootball-team-ai:my-team:v1")).toBe(false);
    expect(map.get(guestMyTeamKey)).toBe("guest-team");
    expect(map.get(accountMyTeamKey)).toBe("account-team");
  });

  it("deleteAllManagedLocalData: アカウント別/guestスコープのMy Buildsキーは変更されない", () => {
    const guestBuildsKey = buildScopedStorageKey({ kind: "guest" }, "myBuilds");
    const accountBuildsKey = buildScopedStorageKey({ kind: "account", scopeId: "c".repeat(64) }, "myBuilds");
    const { map } = installMemoryStorage({
      "efootball-team-ai:progression-builds:v1": "legacy-builds",
      [guestBuildsKey]: "guest-builds",
      [accountBuildsKey]: "account-builds",
    });
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(true);
    expect(result.attemptedKeys).toEqual(["efootball-team-ai:progression-builds:v1"]);
    expect(map.has("efootball-team-ai:progression-builds:v1")).toBe(false);
    expect(map.get(guestBuildsKey)).toBe("guest-builds");
    expect(map.get(accountBuildsKey)).toBe("account-builds");
  });

  it("deleteAllManagedLocalData: アカウント別/guestスコープのお気に入りキーは変更されない", () => {
    const guestFavKey = buildScopedStorageKey({ kind: "guest" }, "favorites");
    const accountFavKey = buildScopedStorageKey({ kind: "account", scopeId: "d".repeat(64) }, "favorites");
    const { map } = installMemoryStorage({
      "efootball-team-ai:favorites:v1": "legacy-fav",
      [guestFavKey]: "guest-fav",
      [accountFavKey]: "account-fav",
    });
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(true);
    expect(result.attemptedKeys).toEqual(["efootball-team-ai:favorites:v1"]);
    expect(map.has("efootball-team-ai:favorites:v1")).toBe(false);
    expect(map.get(guestFavKey)).toBe("guest-fav");
    expect(map.get(accountFavKey)).toBe("account-fav");
  });

  it("削除対象データが何も無い場合、attemptedKeysは空でokはtrue(何もしないことに成功する)", () => {
    installMemoryStorage();
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(true);
    expect(result.attemptedKeys).toEqual([]);
    expect(result.failedKeys).toEqual([]);
  });

  it("localStorageが使えない環境ではok:falseを返し、何も削除を試みない", () => {
    vi.stubGlobal("window", undefined);
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(false);
    expect(result.attemptedKeys).toEqual([]);
  });

  it("removeItemが例外を投げるキーはfailedKeysへ記録し、他のキーの削除は継続する", () => {
    const map = new Map<string, string>([
      ["efootball-team-ai:my-team:v1", "team"],
      ["efb:squads:v1", "squads"],
    ]);
    const storage = {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => {
        if (k === "efb:squads:v1") throw new Error("simulated failure");
        map.delete(k);
      },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    };
    vi.stubGlobal("window", { localStorage: storage });
    const result = deleteAllManagedLocalData();
    expect(result.ok).toBe(false);
    expect(result.failedKeys).toEqual(["efb:squads:v1"]);
    expect(map.has("efootball-team-ai:my-team:v1")).toBe(false); // 成功した方は削除済み
    expect(map.has("efb:squads:v1")).toBe(true); // 失敗した方は残る
  });
});
