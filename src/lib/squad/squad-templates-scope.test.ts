import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createEmptyTemplate,
  renameTemplate,
  deleteTemplate,
  listTemplates,
  createSquadFromTemplate,
  getActiveTemplatesStorageKey,
} from "./templates";
import { listSquads, getActiveSquadsStorageKey } from "./squad-storage";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * スカッドテンプレートのアカウント別スコープ対応(Stage 4)専用のテスト。
 * squad-storage-scope.test.tsと同じ方針。
 */
function installMemoryStorage() {
  const map = new Map<string, string>();
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
  return { map };
}

beforeEach(() => {
  setCurrentScope(null);
});

describe("スコープ未解決(認証状態確認中)", () => {
  it("読み込みは空(安全な既定値)", () => {
    installMemoryStorage();
    expect(listTemplates()).toEqual([]);
  });

  it("書き込みは拒否される", () => {
    installMemoryStorage();
    const result = createEmptyTemplate("未解決中", "4-3-3");
    expect(result.ok).toBe(false);
  });

  it("getActiveTemplatesStorageKeyはnullを返す", () => {
    installMemoryStorage();
    expect(getActiveTemplatesStorageKey()).toBeNull();
  });
});

describe("guestスコープ", () => {
  it("guest領域のキーへ読み書きする", () => {
    const { map } = installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    const result = createEmptyTemplate("guestテンプレート", "4-3-3");
    expect(result.ok).toBe(true);
    const guestKey = buildScopedStorageKey({ kind: "guest" }, "squadTemplates");
    expect(map.has(guestKey)).toBe(true);
    expect(getActiveTemplatesStorageKey()).toBe(guestKey);
  });
});

describe("アカウント別スコープの分離", () => {
  it("ユーザーAで保存したテンプレートはユーザーBのスコープからは見えない", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    createEmptyTemplate("Aのテンプレート", "4-3-3");
    expect(listTemplates().map((t) => t.templateName)).toEqual(["Aのテンプレート"]);

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listTemplates()).toEqual([]);
  });

  it("guest領域とaccount領域は独立している", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "guest" });
    createEmptyTemplate("guestテンプレート", "4-3-3");

    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listTemplates()).toEqual([]);

    setCurrentScope({ kind: "guest" });
    expect(listTemplates().map((t) => t.templateName)).toEqual(["guestテンプレート"]);
  });

  it("名前変更・削除もすべて現在のスコープだけを操作する", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    const saved = createEmptyTemplate("元", "4-3-3");
    if (!saved.ok) throw new Error();
    renameTemplate(saved.template.templateId, "改名後");
    expect(listTemplates()[0].templateName).toBe("改名後");

    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listTemplates()).toEqual([]);
    expect(deleteTemplate(saved.template.templateId).ok).toBe(true); // 存在しない削除は成功扱い(既存仕様どおり)
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    expect(listTemplates()).toHaveLength(1); // Aのテンプレートは無事残っている
  });

  it("テンプレートから作成したスカッドは、テンプレート適用時点の現在スコープの保存スカッド領域へ書き込まれる", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    const saved = createEmptyTemplate("元", "4-3-3");
    if (!saved.ok) throw new Error();

    const created = createSquadFromTemplate(saved.template.templateId, "新規スカッド");
    expect(created.ok).toBe(true);
    expect(listSquads().map((s) => s.squadName)).toEqual(["新規スカッド"]);

    // Bのスコープに切り替えても、Aで作成したスカッド・テンプレートは見えない。
    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    expect(listSquads()).toEqual([]);
    expect(listTemplates()).toEqual([]);
  });
});

describe("storageイベントの扱い", () => {
  it("現在アクティブなスコープのキーのstorageイベントを無視せず検出できる(getActiveTemplatesStorageKeyが動的キーを返す)", () => {
    installMemoryStorage();
    setCurrentScope({ kind: "account", scopeId: "a".repeat(64) });
    createEmptyTemplate("x", "4-3-3");
    const key = getActiveTemplatesStorageKey();
    setCurrentScope({ kind: "account", scopeId: "b".repeat(64) });
    const otherKey = getActiveTemplatesStorageKey();
    expect(key).not.toBe(otherKey);
    expect(getActiveSquadsStorageKey()).not.toBeNull();
  });
});
