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
