import { describe, it, expect } from "vitest";
import { buildScopedStorageKey, listScopedStorageKeys, getLegacyStorageKey, LEGACY_KEYS } from "./keys";
import { DATA_KINDS, type DataKind } from "./types";

const SCOPE_A = { kind: "account", scopeId: "a".repeat(64) } as const;
const SCOPE_B = { kind: "account", scopeId: "b".repeat(64) } as const;
const GUEST = { kind: "guest" } as const;

describe("buildScopedStorageKey", () => {
  it("guest領域は5種類ともefootball-team-ai:local:guest:<kind>:v1の形式になる", () => {
    expect(buildScopedStorageKey(GUEST, "myTeam")).toBe("efootball-team-ai:local:guest:my-team:v1");
    expect(buildScopedStorageKey(GUEST, "myBuilds")).toBe("efootball-team-ai:local:guest:progression-builds:v1");
    expect(buildScopedStorageKey(GUEST, "favorites")).toBe("efootball-team-ai:local:guest:favorites:v1");
    expect(buildScopedStorageKey(GUEST, "squads")).toBe("efootball-team-ai:local:guest:squads:v1");
    expect(buildScopedStorageKey(GUEST, "squadTemplates")).toBe("efootball-team-ai:local:guest:squad-templates:v1");
  });

  it("account領域はefootball-team-ai:local:account:<scopeId>:<kind>:v1の形式になる", () => {
    expect(buildScopedStorageKey(SCOPE_A, "myTeam")).toBe(`efootball-team-ai:local:account:${SCOPE_A.scopeId}:my-team:v1`);
  });

  it("スキーマバージョン(:v1)を含む", () => {
    expect(buildScopedStorageKey(GUEST, "myTeam")).toMatch(/:v1$/);
    expect(buildScopedStorageKey(SCOPE_A, "myTeam")).toMatch(/:v1$/);
  });

  it("同一アカウントでは常に同じキーになる(安定)", () => {
    expect(buildScopedStorageKey(SCOPE_A, "myTeam")).toBe(buildScopedStorageKey(SCOPE_A, "myTeam"));
  });

  it("別アカウントでは衝突しない", () => {
    expect(buildScopedStorageKey(SCOPE_A, "myTeam")).not.toBe(buildScopedStorageKey(SCOPE_B, "myTeam"));
  });

  it("guestとaccountは衝突しない", () => {
    expect(buildScopedStorageKey(GUEST, "myTeam")).not.toBe(buildScopedStorageKey(SCOPE_A, "myTeam"));
  });

  it("5種類すべてで互いに異なるキーになる(同一スコープ内)", () => {
    const keys = DATA_KINDS.map((k) => buildScopedStorageKey(SCOPE_A, k));
    expect(new Set(keys).size).toBe(DATA_KINDS.length);
  });

  it("危険な文字(改行・引用符・スクリプトタグ風)がキーへ混入しない(スコープIDは常にhex文字列のため)", () => {
    const key = buildScopedStorageKey(SCOPE_A, "myTeam");
    expect(key).not.toMatch(/[<>"'\n\r]/);
  });

  it("未知のデータ種別は拒否する(実行時エラー)", () => {
    expect(() => buildScopedStorageKey(GUEST, "unknown" as DataKind)).toThrow();
  });
});

describe("listScopedStorageKeys", () => {
  it("5種類すべてのキーを返す", () => {
    const keys = listScopedStorageKeys(SCOPE_A);
    expect(Object.keys(keys).sort()).toEqual([...DATA_KINDS].sort());
  });

  it("各値がbuildScopedStorageKeyと一致する", () => {
    const keys = listScopedStorageKeys(GUEST);
    for (const kind of DATA_KINDS) {
      expect(keys[kind]).toBe(buildScopedStorageKey(GUEST, kind));
    }
  });
});

describe("getLegacyStorageKey / LEGACY_KEYS", () => {
  it("既存の実際のキーと完全に一致する(重複ハードコードなく単一の真実源から取得)", () => {
    expect(getLegacyStorageKey("myTeam")).toBe("efootball-team-ai:my-team:v1");
    expect(getLegacyStorageKey("myBuilds")).toBe("efootball-team-ai:progression-builds:v1");
    expect(getLegacyStorageKey("favorites")).toBe("efootball-team-ai:favorites:v1");
    expect(getLegacyStorageKey("squads")).toBe("efb:squads:v1");
    expect(getLegacyStorageKey("squadTemplates")).toBe("efootball-team-ai:squad-templates:v1");
  });

  it("LEGACY_KEYSは5種類すべてを持つ", () => {
    expect(Object.keys(LEGACY_KEYS).sort()).toEqual([...DATA_KINDS].sort());
  });

  it("未知のデータ種別は拒否する", () => {
    expect(() => getLegacyStorageKey("unknown" as DataKind)).toThrow();
  });
});
