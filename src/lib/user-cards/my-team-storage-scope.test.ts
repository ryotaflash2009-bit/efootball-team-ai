import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addToMyTeam,
  getMyTeam,
  getActiveMyTeamStorageKey,
  __invalidateMyTeamSnapshotForTests,
  __resetMyTeamWindowListenerForTests,
} from "./my-team-storage";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * My Teamのアカウント別スコープ対応(Stage 2)専用のテスト。
 * 既存の`user-cards.test.ts`(guestスコープ固定での通常動作)とは別に、
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

beforeEach(() => {
  // 注意: __resetCurrentScopeForTests()はcurrent-scope-storeの購読者一覧そのものを
  // 空にしてしまうため、ここでは使わない(my-team-storage.tsがモジュール読込時に
  // 登録した「スコープ変更時にキャッシュを破棄する」購読が失われてしまうため)。
  // 値だけをnull(未解決)へ戻す。
  setCurrentScope(null);
  __invalidateMyTeamSnapshotForTests();
  __resetMyTeamWindowListenerForTests();
});

describe("スコープ未解決(認証状態確認中)", () => {
  it("読み込みは空(安全な既定値)", () => {
    installMemoryStorage();
    // スコープを一切設定しない = 未解決のまま
    expect(getMyTeam()).toEqual([]);
  });

  it("書き込みは拒否される", () => {
    installMemoryStorage();
    const result = addToMyTeam({ worldCardId: "123456" });
    expect(result.ok).toBe(false);
  });

  it("getActiveMyTeamStorageKeyはnullを返す", () => {
    installMemoryStorage();
    expect(getActiveMyTeamStorageKey()).toBeNull();
  });
});

describe("guestスコープ", () => {
  it("guest領域のキーへ読み書きする", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    const result = addToMyTeam({ worldCardId: "1" });
    expect(result.ok).toBe(true);
    const guestKey = buildScopedStorageKey({ kind: "guest" }, "myTeam");
    expect(map.has(guestKey)).toBe(true);
    expect(getActiveMyTeamStorageKey()).toBe(guestKey);
  });
});

describe("アカウント別スコープの分離", () => {
  it("ユーザーAで追加したMy TeamはユーザーBのスコープからは見えない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addToMyTeam({ worldCardId: "1" });
    expect(getMyTeam().map((r) => r.worldCardId)).toEqual(["1"]);

    // ユーザーBへ切り替え
    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(getMyTeam()).toEqual([]);
  });

  it("ユーザーBのMy TeamはユーザーAのスコープへ戻っても混ざらない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addToMyTeam({ worldCardId: "1" });

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    addToMyTeam({ worldCardId: "2" });
    expect(getMyTeam().map((r) => r.worldCardId)).toEqual(["2"]);

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(getMyTeam().map((r) => r.worldCardId)).toEqual(["1"]);
  });

  it("guest領域とaccount領域は独立している", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    addToMyTeam({ worldCardId: "9" });

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(getMyTeam()).toEqual([]);

    setCurrentScope({ kind: "guest" });
    expect(getMyTeam().map((r) => r.worldCardId)).toEqual(["9"]);
  });

  it("ログアウト(account→null→guest)でaccount領域のデータは削除されない", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addToMyTeam({ worldCardId: "1" });
    const accountKey = buildScopedStorageKey({ kind: "account", scopeId: "a".repeat(64) }, "myTeam");

    setCurrentScope(null); // セッション確認中相当
    setCurrentScope({ kind: "guest" }); // ログアウト後

    expect(map.has(accountKey)).toBe(true);
    expect(JSON.parse(map.get(accountKey)!).records).toHaveLength(1);
    expect(getMyTeam()).toEqual([]); // guestスコープからは見えない
  });
});

describe("storageイベントの扱い", () => {
  it("現在アクティブなスコープのキーのstorageイベントはキャッシュを破棄する", () => {
    const { map, dispatchStorageEvent } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addToMyTeam({ worldCardId: "1" });
    const key = getActiveMyTeamStorageKey()!;
    // 別タブで同じキーへ書き込まれた想定
    map.set(key, JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: "", records: [{ localRecordId: "myt_xxxx", teamCardId: "tc_xxxx", worldCardId: "2", ownershipStatus: "owned", usageStatus: "unknown", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: "t", updatedAt: "t", deletedAt: null, source: "local", syncStatus: "local_only" }] }));
    dispatchStorageEvent(key);
    expect(getMyTeam().map((r) => r.worldCardId)).toEqual(["2"]);
  });

  it("別スコープのキーのstorageイベントは無視する(現在のキャッシュのスナップショット参照が変わらない)", () => {
    const { dispatchStorageEvent } = installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addToMyTeam({ worldCardId: "1" });
    const before = getMyTeam(); // スナップショットを確定させる

    const otherKey = buildScopedStorageKey({ kind: "account", scopeId: "b".repeat(64) }, "myTeam");
    dispatchStorageEvent(otherKey); // 現在のスコープとは無関係なキーのイベント
    const after = getMyTeam();
    expect(after).toBe(before); // キャッシュが破棄されていなければ同一参照のまま
  });
});

describe("スコープ切り替え自体の通知", () => {
  it("スコープが切り替わると自動的にキャッシュが破棄され、新スコープの内容を返す", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    addToMyTeam({ worldCardId: "1" });
    getMyTeam(); // キャッシュ確定

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    // invalidateされているはずなので、再度getMyTeam()を呼ぶと新スコープ(空)を返す
    expect(getMyTeam()).toEqual([]);
  });
});
