import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeMigrationForKind } from "./migration-execute";
import { readPersistedBackup } from "./backup";

const LEGACY_KEY = "efootball-team-ai:my-team:v1";
const TARGET_KEY = "efootball-team-ai:local:account:deadbeef:my-team:v1";

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

describe("executeMigrationForKind: 不足分だけ追加", () => {
  it("対象が空の場合、レガシー全件が追加される", async () => {
    const map = installMemoryStorage({
      [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1", updatedAt: "t1" }] }),
    });
    const result = await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(result).toMatchObject({ ok: true, addedCount: 1, duplicateCount: 0, conflictCount: 0, rolledBack: false });
    const target = JSON.parse(map.get(TARGET_KEY)!);
    expect(target.records).toEqual([{ worldCardId: "1", updatedAt: "t1" }]);
  });

  it("レガシーキーは一切変更されない(削除・上書き・空化しない)", async () => {
    const legacyValue = JSON.stringify({ records: [{ worldCardId: "1", updatedAt: "t1" }] });
    const map = installMemoryStorage({ [LEGACY_KEY]: legacyValue });
    await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(map.get(LEGACY_KEY)).toBe(legacyValue);
  });

  it("既存の対象領域にあるレコードは維持され、不足分だけが追加される", async () => {
    const map = installMemoryStorage({
      [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1" }, { worldCardId: "2" }] }),
      [TARGET_KEY]: JSON.stringify({ records: [{ worldCardId: "2" }] }),
    });
    const result = await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(result.addedCount).toBe(1);
    const target = JSON.parse(map.get(TARGET_KEY)!);
    expect(target.records.map((r: { worldCardId: string }) => r.worldCardId).sort()).toEqual(["1", "2"]);
  });

  it("同じIDで内容が異なる場合(競合)は対象へ書き込まれない", async () => {
    const map = installMemoryStorage({
      [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1", note: "legacy" }] }),
      [TARGET_KEY]: JSON.stringify({ records: [{ worldCardId: "1", note: "target" }] }),
    });
    const result = await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(result).toMatchObject({ ok: true, addedCount: 0, conflictCount: 1 });
    const target = JSON.parse(map.get(TARGET_KEY)!);
    expect(target.records).toEqual([{ worldCardId: "1", note: "target" }]);
  });

  it("別のアカウント領域キーは変更されない", async () => {
    const OTHER_ACCOUNT_KEY = "efootball-team-ai:local:account:other:my-team:v1";
    const map = installMemoryStorage({
      [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1" }] }),
      [OTHER_ACCOUNT_KEY]: JSON.stringify({ records: [{ worldCardId: "9" }] }),
    });
    await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(JSON.parse(map.get(OTHER_ACCOUNT_KEY)!).records).toEqual([{ worldCardId: "9" }]);
  });

  it("guest領域キーは変更されない(account領域への移行時)", async () => {
    const GUEST_KEY = "efootball-team-ai:local:guest:my-team:v1";
    const map = installMemoryStorage({
      [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1" }] }),
      [GUEST_KEY]: JSON.stringify({ records: [{ worldCardId: "5" }] }),
    });
    await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(JSON.parse(map.get(GUEST_KEY)!).records).toEqual([{ worldCardId: "5" }]);
  });

  it("移行成功後、バックアップ(legacy/account)が一時キーへ残る", async () => {
    installMemoryStorage({ [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1" }] }) });
    await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(readPersistedBackup("myTeam", "legacy")).not.toBeNull();
    expect(readPersistedBackup("myTeam", "account")).not.toBeNull();
  });

  it("レガシー・対象ともに空でも安全に成功し、0件のまま", async () => {
    installMemoryStorage();
    const result = await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(result).toMatchObject({ ok: true, addedCount: 0 });
  });
});

describe("executeMigrationForKind: 検証失敗時のロールバック", () => {
  it("書き込み後の再読込がおかしい場合、ロールバックして対象領域を元へ戻す", async () => {
    const map = installMemoryStorage({
      [LEGACY_KEY]: JSON.stringify({ records: [{ worldCardId: "1" }] }),
      [TARGET_KEY]: JSON.stringify({ records: [{ worldCardId: "9" }] }),
    });
    // setItemを差し替えて「書き込んだはずが実際には反映されない」異常を模擬する。
    // バックアップキーへの書き込みは許可し、実際の移行先キー(TARGET_KEY)への
    // 書き込みだけを握りつぶすことで、書き込み後の再読込検証を確実に失敗させる。
    const original = map.set.bind(map);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => {
          if (k === TARGET_KEY) return; // 移行実行時の書き込みだけ握りつぶす
          original(k, String(v));
        },
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
        key: (i: number) => [...map.keys()][i] ?? null,
        get length() {
          return map.size;
        },
      },
    });
    const result = await executeMigrationForKind("myTeam", LEGACY_KEY, TARGET_KEY);
    expect(result.ok).toBe(false);
    expect(result.errorReason).toBe("VERIFICATION_FAILED");
    expect(result.rolledBack).toBe(true);
    // ロールバック後、対象領域は元の内容に戻っている。
    expect(JSON.parse(map.get(TARGET_KEY)!).records).toEqual([{ worldCardId: "9" }]);
  });
});
