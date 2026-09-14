import { describe, it, expect } from "vitest";
import { checkMyTeamBuildReferences, checkSquadBuildReferences, checkSquadTemplateBuildReferences } from "./build-reference-check";

// checkMyTeamBuildReferences()は`readRawJson()`と同じく、JSON文字列ではなくパース済みの
// 値(または未取得時のnull)を受け取る(previewMigration()と同じ契約)。
function myTeamRaw(records: unknown[]) {
  return { storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: "2026-09-13T00:00:00.000Z", records };
}
function myBuildsRaw(map: Record<string, unknown[]>) {
  return map;
}
function myTeamRecord(worldCardId: string, over: Record<string, unknown> = {}) {
  return {
    localRecordId: `myt_${worldCardId}xx`,
    teamCardId: `tc_${worldCardId}xx`,
    worldCardId,
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
    ...over,
  };
}
function build(worldCardId: string, buildId: string) {
  return {
    buildId,
    worldCardId,
    buildName: "テスト",
    progressionAllocation: {},
    selectedPlayerBooster: null,
    calculatedStats: {},
    calculatedOvr: null,
    calculationMode: "provisional",
    rulesVersion: "x",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    schemaVersion: 1,
  };
}

describe("checkMyTeamBuildReferences", () => {
  it("参照が一つもなければ0/0", () => {
    const r = checkMyTeamBuildReferences(myTeamRaw([myTeamRecord("10001")]), myBuildsRaw({}));
    expect(r).toEqual({ totalReferencedCount: 0, brokenCount: 0 });
  });

  it("参照先が存在すれば参照切れ0", () => {
    const r = checkMyTeamBuildReferences(
      myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_1" })]),
      myBuildsRaw({ "10001": [build("10001", "b_1")] }),
    );
    expect(r).toEqual({ totalReferencedCount: 1, brokenCount: 0 });
  });

  it("参照先が存在しなければ参照切れとして数える(自動修正しない)", () => {
    const r = checkMyTeamBuildReferences(
      myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_missing" })]),
      myBuildsRaw({}),
    );
    expect(r).toEqual({ totalReferencedCount: 1, brokenCount: 1 });
  });

  it("selectedBuildIdとfavoriteBuildIdの両方を独立して数える(重複IDは1件扱い)", () => {
    const r = checkMyTeamBuildReferences(
      myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_1", favoriteBuildId: "b_2" })]),
      myBuildsRaw({ "10001": [build("10001", "b_1")] }),
    );
    expect(r.totalReferencedCount).toBe(2);
    expect(r.brokenCount).toBe(1); // b_2だけ参照切れ
  });

  it("複数レコードで同じbuildIdを参照していても重複カウントしない", () => {
    const r = checkMyTeamBuildReferences(
      myTeamRaw([
        myTeamRecord("10001", { selectedBuildId: "b_missing" }),
        myTeamRecord("10002", { favoriteBuildId: "b_missing" }),
      ]),
      myBuildsRaw({}),
    );
    expect(r).toEqual({ totalReferencedCount: 1, brokenCount: 1 });
  });

  it("My Buildsが移行前(空)でMy Teamが移行済みの場合、破損ではなく参照切れとして数える", () => {
    const r = checkMyTeamBuildReferences(
      myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_1" }), myTeamRecord("10002", { favoriteBuildId: "b_2" })]),
      myBuildsRaw({}),
    );
    expect(r.brokenCount).toBe(2);
  });

  it("My Builds移行後は参照が復旧する(brokenCountが減る)", () => {
    const before = checkMyTeamBuildReferences(
      myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_1" })]),
      myBuildsRaw({}),
    );
    expect(before.brokenCount).toBe(1);
    const after = checkMyTeamBuildReferences(
      myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_1" })]),
      myBuildsRaw({ "10001": [build("10001", "b_1")] }),
    );
    expect(after.brokenCount).toBe(0);
  });

  it("My Teamのデータが無い(null)場合は0/0", () => {
    const r = checkMyTeamBuildReferences(null, myBuildsRaw({ "10001": [build("10001", "b_1")] }));
    expect(r).toEqual({ totalReferencedCount: 0, brokenCount: 0 });
  });

  it("My Buildsのデータが無い(null)が参照があれば全件参照切れ", () => {
    const r = checkMyTeamBuildReferences(myTeamRaw([myTeamRecord("10001", { selectedBuildId: "b_1" })]), null);
    expect(r).toEqual({ totalReferencedCount: 1, brokenCount: 1 });
  });

  it("構造の合わない値を渡しても安全に0/0を返す(クラッシュしない)", () => {
    const r = checkMyTeamBuildReferences("not an object", 12345);
    expect(r).toEqual({ totalReferencedCount: 0, brokenCount: 0 });
  });
});

function squadsRaw(squads: unknown[]) {
  return squads;
}
function squadWith(over: { slots?: unknown[]; substitutes?: unknown[] } = {}) {
  return { squadId: "sq_1", squadName: "テスト", slots: over.slots ?? [], substitutes: over.substitutes ?? [] };
}
function slotWithBuild(savedBuildId: string | null) {
  return { slotId: "cf", worldCardId: "10001", buildMode: "none", savedBuildId };
}
function subWithBuild(savedBuildId: string | null) {
  return { subId: "sub_1", worldCardId: "10002", buildMode: "none", savedBuildId };
}
function templatesRaw(templates: unknown[]) {
  return { storageVersion: "squad-templates-storage/2026-08-30.v1", updatedAt: "2026-09-13T00:00:00.000Z", templates };
}
function templateWith(squad: unknown) {
  return { templateId: "tpl_1", templateName: "テスト", squad };
}

describe("checkSquadBuildReferences", () => {
  it("参照が一つもなければ0/0/null", () => {
    const r = checkSquadBuildReferences(squadsRaw([squadWith()]), {});
    expect(r).toEqual({ totalReferencedCount: 0, brokenCount: 0, resolvableOnlyInLegacyCount: null });
  });

  it("先発(slots)の参照先が存在すれば参照切れ0", () => {
    const r = checkSquadBuildReferences(
      squadsRaw([squadWith({ slots: [slotWithBuild("b_1")] })]),
      { "10001": [build("10001", "b_1")] },
    );
    expect(r.totalReferencedCount).toBe(1);
    expect(r.brokenCount).toBe(0);
  });

  it("ベンチ(substitutes)の参照も数える", () => {
    const r = checkSquadBuildReferences(
      squadsRaw([squadWith({ substitutes: [subWithBuild("b_missing")] })]),
      {},
    );
    expect(r).toEqual({ totalReferencedCount: 1, brokenCount: 1, resolvableOnlyInLegacyCount: null });
  });

  it("legacyMyBuildsRawを渡すと、対象領域では解決できないがレガシーには存在する参照数を報告する", () => {
    const r = checkSquadBuildReferences(
      squadsRaw([squadWith({ slots: [slotWithBuild("b_legacy_only")] })]),
      {},
      { "10001": [build("10001", "b_legacy_only")] },
    );
    expect(r).toEqual({ totalReferencedCount: 1, brokenCount: 1, resolvableOnlyInLegacyCount: 1 });
  });

  it("legacyMyBuildsRawを渡さない場合はresolvableOnlyInLegacyCountがnull(調べていないことを明示)", () => {
    const r = checkSquadBuildReferences(squadsRaw([squadWith({ slots: [slotWithBuild("b_missing")] })]), {});
    expect(r.resolvableOnlyInLegacyCount).toBeNull();
  });

  it("構造の合わない値を渡しても安全に0/0/nullを返す(クラッシュしない)", () => {
    const r = checkSquadBuildReferences("not an array", 12345);
    expect(r).toEqual({ totalReferencedCount: 0, brokenCount: 0, resolvableOnlyInLegacyCount: null });
  });
});

describe("checkSquadTemplateBuildReferences", () => {
  it("埋め込まれたスカッド本体のsavedBuildIdを先発・ベンチともに確認する", () => {
    const r = checkSquadTemplateBuildReferences(
      templatesRaw([
        templateWith(squadWith({ slots: [slotWithBuild("b_1")], substitutes: [subWithBuild("b_missing")] })),
      ]),
      { "10001": [build("10001", "b_1")] },
    );
    expect(r.totalReferencedCount).toBe(2);
    expect(r.brokenCount).toBe(1);
  });

  it("テンプレートが無い(null)場合は0/0/null", () => {
    const r = checkSquadTemplateBuildReferences(null, {});
    expect(r).toEqual({ totalReferencedCount: 0, brokenCount: 0, resolvableOnlyInLegacyCount: null });
  });
});
