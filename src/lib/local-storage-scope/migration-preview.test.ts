import { describe, it, expect } from "vitest";
import { previewMigration } from "./migration-preview";

describe("previewMigration: myTeam", () => {
  it("対象領域が空の場合、レガシー全件がaddになる", () => {
    const legacy = { records: [{ worldCardId: "1", updatedAt: "t1" }, { worldCardId: "2", updatedAt: "t1" }] };
    const preview = previewMigration("myTeam", legacy, null);
    expect(preview.addCount).toBe(2);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.conflictCount).toBe(0);
    expect(preview.resultCountIfApplied).toBe(2);
  });

  it("同じID・同じ内容はduplicateとして扱う(add対象にしない)", () => {
    const item = { worldCardId: "1", updatedAt: "t1", note: "x" };
    const preview = previewMigration("myTeam", { records: [item] }, { records: [item] });
    expect(preview.duplicateCount).toBe(1);
    expect(preview.addCount).toBe(0);
    expect(preview.resultCountIfApplied).toBe(1);
  });

  it("同じID・異なる内容はconflictとして扱う(自動解決しない)", () => {
    const legacy = { records: [{ worldCardId: "1", updatedAt: "t1", note: "legacy" }] };
    const target = { records: [{ worldCardId: "1", updatedAt: "t2", note: "target" }] };
    const preview = previewMigration("myTeam", legacy, target);
    expect(preview.conflictCount).toBe(1);
    expect(preview.addCount).toBe(0);
    expect(preview.duplicateCount).toBe(0);
    // 競合は追加されないため、結果件数は対象側の1件のまま。
    expect(preview.resultCountIfApplied).toBe(1);
  });

  it("追加・重複・競合が混在するケースを正しく分類する", () => {
    const legacy = {
      records: [
        { worldCardId: "1", note: "same" }, // duplicate
        { worldCardId: "2", note: "legacy-version" }, // conflict
        { worldCardId: "3", note: "new" }, // add
      ],
    };
    const target = {
      records: [
        { worldCardId: "1", note: "same" },
        { worldCardId: "2", note: "target-version" },
      ],
    };
    const preview = previewMigration("myTeam", legacy, target);
    expect(preview.legacyCount).toBe(3);
    expect(preview.targetCount).toBe(2);
    expect(preview.addCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.conflictCount).toBe(1);
    expect(preview.resultCountIfApplied).toBe(3);
  });

  it("不正データ(id抽出不可)はinvalidCountへ計上され、add/duplicate/conflictには含まれない", () => {
    const legacy = { records: [{ worldCardId: "1" }, { note: "no id" }, "not-an-object"] };
    const preview = previewMigration("myTeam", legacy, null);
    expect(preview.invalidCount).toBe(2);
    expect(preview.addCount).toBe(1);
  });

  it("レガシー・対象ともに空の場合はすべて0", () => {
    const preview = previewMigration("myTeam", null, null);
    expect(preview).toMatchObject({ legacyCount: 0, targetCount: 0, addCount: 0, duplicateCount: 0, conflictCount: 0, invalidCount: 0, resultCountIfApplied: 0 });
  });
});

describe("previewMigration: squads(プレーン配列)/myBuilds(マップ)でも同じ分類ロジックが動く", () => {
  it("squads", () => {
    const legacy = [{ squadId: "sq_1", updatedAt: "t1" }];
    const preview = previewMigration("squads", legacy, []);
    expect(preview.addCount).toBe(1);
  });

  it("myBuilds", () => {
    const legacy = { "111": [{ buildId: "b1", worldCardId: "111" }] };
    const preview = previewMigration("myBuilds", legacy, {});
    expect(preview.addCount).toBe(1);
  });
});

describe("previewMigration: myBuilds(実データ相当4件・重複/競合を含む)", () => {
  function build(buildId: string, worldCardId: string, updatedAt: string, buildName = "x") {
    return { buildId, worldCardId, buildName, updatedAt };
  }

  it("4件のレガシーMy Buildsのうち、新規2件・重複1件・競合1件を正しく分類する", () => {
    const legacy = {
      "1": [build("b1", "1", "t1", "A"), build("b2", "1", "t1", "B")],
      "2": [build("b3", "2", "t1", "C"), build("b4", "2", "t1", "D")],
    };
    const target = {
      "1": [build("b2", "1", "t1", "B")], // b2は完全一致(重複)
      "2": [build("b4", "2", "t1", "D-changed")], // b4は内容が異なる(競合)
    };
    const preview = previewMigration("myBuilds", legacy, target);
    expect(preview.legacyCount).toBe(4);
    expect(preview.addCount).toBe(2); // b1, b3
    expect(preview.duplicateCount).toBe(1); // b2
    expect(preview.conflictCount).toBe(1); // b4
    expect(preview.resultCountIfApplied).toBe(preview.targetCount + preview.addCount);
  });
});

describe("previewMigration: favorites", () => {
  function fav(worldCardId: string, updatedAt: string) {
    return { worldCardId, updatedAt };
  }

  it("2件のレガシーお気に入りが新規追加候補になる(移行先が空の場合)", () => {
    const legacy = { records: [fav("10001", "t1"), fav("10002", "t1")] };
    const preview = previewMigration("favorites", legacy, { records: [] });
    expect(preview.legacyCount).toBe(2);
    expect(preview.addCount).toBe(2);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.conflictCount).toBe(0);
  });

  it("移行先に同じworldCardIdが既に存在する場合は重複として扱い、追加しない", () => {
    const legacy = { records: [fav("10001", "t1")] };
    const preview = previewMigration("favorites", legacy, { records: [fav("10001", "t1")] });
    expect(preview.addCount).toBe(0);
    expect(preview.duplicateCount).toBe(1);
  });

  it("レガシー・対象ともに空の場合はすべて0", () => {
    const preview = previewMigration("favorites", null, null);
    expect(preview).toMatchObject({ legacyCount: 0, targetCount: 0, addCount: 0, duplicateCount: 0, conflictCount: 0, invalidCount: 0, resultCountIfApplied: 0 });
  });
});
