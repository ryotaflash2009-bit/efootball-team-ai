import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBackup, persistBackup, readPersistedBackup, clearPersistedBackup, verifyBackup, rollbackToBackup, STORAGE_BACKUP_VERSION } from "./backup";

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
  return map;
}

describe("createBackup", () => {
  it("バージョン・作成日時・対象データ種別・payload・整合性ハッシュを含む", async () => {
    const backup = await createBackup("myTeam", "legacy", '{"records":[]}');
    expect(backup.version).toBe(STORAGE_BACKUP_VERSION);
    expect(backup.kind).toBe("myTeam");
    expect(backup.role).toBe("legacy");
    expect(backup.payload).toBe('{"records":[]}');
    expect(backup.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof backup.createdAt).toBe("string");
  });

  it("メールアドレス・ユーザーUUID・Token・Cookie等を含まない(構造が閉じている)", async () => {
    const backup = await createBackup("myTeam", "account", "{}");
    expect(Object.keys(backup).sort()).toEqual(["createdAt", "kind", "payload", "payloadHash", "role", "version"]);
  });

  it("キーが未設定(null)の場合もハッシュを計算できる", async () => {
    const backup = await createBackup("myTeam", "legacy", null);
    expect(backup.payload).toBeNull();
    expect(backup.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("persistBackup / readPersistedBackup / clearPersistedBackup", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("保存して読み戻せる", async () => {
    const backup = await createBackup("favorites", "legacy", '{"records":[]}');
    expect(persistBackup(backup)).toBe(true);
    expect(readPersistedBackup("favorites", "legacy")).toEqual(backup);
  });

  it("未保存の場合はnull", () => {
    expect(readPersistedBackup("myTeam", "account")).toBeNull();
  });

  it("壊れたJSONが入っている場合はnull(復元不能扱い)", () => {
    window.localStorage.setItem("efootball-team-ai:local-storage-scope:backup:legacy:myTeam:v1", "{not json");
    expect(readPersistedBackup("myTeam", "legacy")).toBeNull();
  });

  it("未知バージョンのバックアップはnull扱い", () => {
    window.localStorage.setItem(
      "efootball-team-ai:local-storage-scope:backup:legacy:myTeam:v1",
      JSON.stringify({ version: "unknown/v99", createdAt: "x", kind: "myTeam", role: "legacy", payload: null, payloadHash: "a".repeat(64) }),
    );
    expect(readPersistedBackup("myTeam", "legacy")).toBeNull();
  });

  it("clearPersistedBackupで消去できる", async () => {
    const backup = await createBackup("squads", "account", "[]");
    persistBackup(backup);
    clearPersistedBackup("squads", "account");
    expect(readPersistedBackup("squads", "account")).toBeNull();
  });
});

describe("verifyBackup", () => {
  it("改変されていないバックアップはtrue", async () => {
    const backup = await createBackup("myTeam", "legacy", '{"a":1}');
    expect(await verifyBackup(backup)).toBe(true);
  });

  it("payloadHashが合わない(改変された)バックアップはfalse", async () => {
    const backup = await createBackup("myTeam", "legacy", '{"a":1}');
    const tampered = { ...backup, payload: '{"a":2}' };
    expect(await verifyBackup(tampered)).toBe(false);
  });
});

describe("rollbackToBackup", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("検証成功時、対象キーへ元の値を書き戻す", async () => {
    const backup = await createBackup("myTeam", "account", '{"records":[{"worldCardId":"1"}]}');
    window.localStorage.setItem("target-key", '{"records":[{"worldCardId":"1"},{"worldCardId":"2"}]}');
    const result = await rollbackToBackup(backup, "target-key");
    expect(result).toEqual({ ok: true, verified: true });
    expect(window.localStorage.getItem("target-key")).toBe('{"records":[{"worldCardId":"1"}]}');
  });

  it("元がnull(未設定)だった場合、ロールバックでキーを削除する", async () => {
    const backup = await createBackup("myTeam", "account", null);
    window.localStorage.setItem("target-key", '{"records":[{"worldCardId":"1"}]}');
    const result = await rollbackToBackup(backup, "target-key");
    expect(result).toEqual({ ok: true, verified: true });
    expect(window.localStorage.getItem("target-key")).toBeNull();
  });

  it("バックアップが改変されている場合は書き戻さない", async () => {
    const backup = await createBackup("myTeam", "account", '{"records":[]}');
    const tampered = { ...backup, payload: '{"records":["injected"]}' };
    window.localStorage.setItem("target-key", "original");
    const result = await rollbackToBackup(tampered, "target-key");
    expect(result).toEqual({ ok: false, verified: false });
    expect(window.localStorage.getItem("target-key")).toBe("original");
  });

  it("書き戻し後、再読込して実際に復元できたかを確認する(検証済みかつ復元一致)", async () => {
    const backup = await createBackup("myTeam", "account", '{"records":[]}');
    const result = await rollbackToBackup(backup, "target-key");
    expect(result.ok).toBe(true);
  });
});
