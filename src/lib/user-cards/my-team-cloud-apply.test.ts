import { describe, it, expect, vi, beforeEach } from "vitest";
import { previewMyTeamCloudApply, applyAddMissingCloudItems } from "./my-team-cloud-apply";
import { __invalidateMyTeamSnapshotForTests, addToMyTeam, getMyTeam } from "./my-team-storage";
import type { MyTeamRecord } from "./types";
import type { CloudMyTeamItem } from "@/lib/supabase/my-team-cloud-schema";

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
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  __invalidateMyTeamSnapshotForTests();
  return map;
}

function makeRecord(overrides: Partial<MyTeamRecord> = {}): MyTeamRecord {
  return {
    localRecordId: "myt_abcd1234",
    teamCardId: "tc_abcd1234",
    worldCardId: "1",
    ownershipStatus: "owned",
    usageStatus: "main",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
    ...overrides,
  };
}

function makeCloudItem(overrides: Partial<CloudMyTeamItem> = {}): CloudMyTeamItem {
  return {
    worldCardId: "1",
    ownershipStatus: "owned",
    usageStatus: "main",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("previewMyTeamCloudApply", () => {
  it("ローカル・クラウド完全一致: matchingのみ、local-only/cloud-onlyは0", () => {
    const local = [makeRecord({ worldCardId: "1" })];
    const cloud = [makeCloudItem({ worldCardId: "1" })];
    const preview = previewMyTeamCloudApply(local, cloud);
    expect(preview).toEqual({ matchingCount: 1, localOnlyCount: 0, cloudOnlyItems: [], unknownCardWorldIds: [] });
  });

  it("ローカルのみ・クラウドのみが混在する場合を正しく分類する", () => {
    const local = [makeRecord({ worldCardId: "1" }), makeRecord({ worldCardId: "2" })];
    const cloud = [makeCloudItem({ worldCardId: "2" }), makeCloudItem({ worldCardId: "3" })];
    const preview = previewMyTeamCloudApply(local, cloud);
    expect(preview.matchingCount).toBe(1);
    expect(preview.localOnlyCount).toBe(1);
    expect(preview.cloudOnlyItems.map((i) => i.worldCardId)).toEqual(["3"]);
  });

  it("ローカルが空でクラウドにデータがある場合、全件がcloud-only", () => {
    const preview = previewMyTeamCloudApply([], [makeCloudItem({ worldCardId: "1" }), makeCloudItem({ worldCardId: "2" })]);
    expect(preview.matchingCount).toBe(0);
    expect(preview.localOnlyCount).toBe(0);
    expect(preview.cloudOnlyItems).toHaveLength(2);
  });

  it("クラウドが空の場合、cloud-onlyは0件", () => {
    const preview = previewMyTeamCloudApply([makeRecord({ worldCardId: "1" })], []);
    expect(preview.cloudOnlyItems).toEqual([]);
    expect(preview.localOnlyCount).toBe(1);
  });

  it("既知カードカタログを渡すと、未知カードをunknownCardWorldIdsへ分類する", () => {
    const preview = previewMyTeamCloudApply([], [makeCloudItem({ worldCardId: "1" }), makeCloudItem({ worldCardId: "999" })], new Set(["1"]));
    expect(preview.unknownCardWorldIds).toEqual(["999"]);
  });

  it("既知カードカタログを渡さない場合、unknownCardWorldIdsは常に空", () => {
    const preview = previewMyTeamCloudApply([], [makeCloudItem({ worldCardId: "999" })]);
    expect(preview.unknownCardWorldIds).toEqual([]);
  });
});

describe("applyAddMissingCloudItems", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("cloud-onlyの各カードをローカルへ追加する", () => {
    const result = applyAddMissingCloudItems([makeCloudItem({ worldCardId: "10" }), makeCloudItem({ worldCardId: "11" })]);
    expect(result).toEqual({ ok: true, addedCount: 2, failedCount: 0 });
    const ids = getMyTeam().map((r) => r.worldCardId);
    expect(ids.sort()).toEqual(["10", "11"]);
  });

  it("既にローカルに存在するカードは上書きしない(matchingは対象に含めない前提だが、念のため単体でも安全)", () => {
    addToMyTeam({ worldCardId: "10", note: "元のメモ", ownershipStatus: "wanted" });
    // apply対象はプレビューで既にcloud-onlyへ絞られている想定だが、
    // 万一matching分が混入しても addToMyTeam 自体が重複を拒否し、既存レコードを書き換えない。
    const result = applyAddMissingCloudItems([makeCloudItem({ worldCardId: "10", note: "クラウド側メモ", ownershipStatus: "owned" })]);
    expect(result).toEqual({ ok: false, addedCount: 0, failedCount: 1 });
    const rec = getMyTeam().find((r) => r.worldCardId === "10");
    expect(rec?.note).toBe("元のメモ");
    expect(rec?.ownershipStatus).toBe("wanted");
  });

  it("空配列を渡した場合は何も追加せず成功を返す", () => {
    const result = applyAddMissingCloudItems([]);
    expect(result).toEqual({ ok: true, addedCount: 0, failedCount: 0 });
    expect(getMyTeam()).toEqual([]);
  });

  it("favoriteBuildIdが設定されている場合、追加後にそれも反映する", () => {
    applyAddMissingCloudItems([makeCloudItem({ worldCardId: "20", favoriteBuildId: "build-abc" })]);
    const rec = getMyTeam().find((r) => r.worldCardId === "20");
    expect(rec?.favoriteBuildId).toBe("build-abc");
  });

  it("一部失敗しても、それまでに追加できた分はローカルへ残る(非破壊的)", () => {
    addToMyTeam({ worldCardId: "30" }); // 事前に存在させ、30の再追加を失敗させる
    const result = applyAddMissingCloudItems([makeCloudItem({ worldCardId: "31" }), makeCloudItem({ worldCardId: "30" })]);
    expect(result.addedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    const ids = getMyTeam().map((r) => r.worldCardId);
    expect(ids.sort()).toEqual(["30", "31"]);
  });
});
