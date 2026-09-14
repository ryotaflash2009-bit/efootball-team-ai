import { describe, it, expect } from "vitest";
import { extractScopedItems, encodeScopedItems, countRawEntries, scopedItemsContentEqual } from "./adapters";

const NOW = "2026-09-13T00:00:00.000Z";

describe("extractScopedItems: myTeam/favorites(ラッパー付き配列)", () => {
  it("recordsからworldCardIdをidとして取り出す", () => {
    const raw = { storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: NOW, records: [{ worldCardId: "1", updatedAt: NOW }, { worldCardId: "2", updatedAt: NOW }] };
    const items = extractScopedItems("myTeam", raw);
    expect(items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("recordsが無い/配列でない場合は空配列", () => {
    expect(extractScopedItems("myTeam", {})).toEqual([]);
    expect(extractScopedItems("myTeam", { records: "not-array" })).toEqual([]);
    expect(extractScopedItems("myTeam", null)).toEqual([]);
    expect(extractScopedItems("myTeam", undefined)).toEqual([]);
  });

  it("idフィールドが無い/文字列でない要素は除外する(壊れた要素を静かに除外)", () => {
    const raw = { records: [{ worldCardId: "1" }, { worldCardId: 123 }, { note: "no id" }, "not-an-object"] };
    const items = extractScopedItems("myTeam", raw);
    expect(items.map((i) => i.id)).toEqual(["1"]);
  });
});

describe("extractScopedItems: squadTemplates", () => {
  it("templatesからtemplateIdを取り出す", () => {
    const raw = { templates: [{ templateId: "tpl_abc123", updatedAt: NOW }] };
    expect(extractScopedItems("squadTemplates", raw).map((i) => i.id)).toEqual(["tpl_abc123"]);
  });
});

describe("extractScopedItems: squads(プレーン配列)", () => {
  it("配列直下からsquadIdを取り出す", () => {
    const raw = [{ squadId: "sq_1", updatedAt: NOW }, { squadId: "sq_2", updatedAt: NOW }];
    expect(extractScopedItems("squads", raw).map((i) => i.id)).toEqual(["sq_1", "sq_2"]);
  });

  it("配列でない場合は空配列", () => {
    expect(extractScopedItems("squads", { squads: [] })).toEqual([]);
  });
});

describe("extractScopedItems: myBuilds(worldCardIdごとのマップ)", () => {
  it("すべてのworldCardIdのビルドを平坦化し、buildIdをidとして取り出す", () => {
    const raw = {
      "111": [{ buildId: "b1", worldCardId: "111", updatedAt: NOW }],
      "222": [{ buildId: "b2", worldCardId: "222", updatedAt: NOW }, { buildId: "b3", worldCardId: "222", updatedAt: NOW }],
    };
    const items = extractScopedItems("myBuilds", raw);
    expect(items.map((i) => i.id).sort()).toEqual(["b1", "b2", "b3"]);
  });

  it("マップでない場合は空配列", () => {
    expect(extractScopedItems("myBuilds", [])).toEqual([]);
    expect(extractScopedItems("myBuilds", null)).toEqual([]);
  });
});

describe("countRawEntries", () => {
  it("id抽出に失敗した要素も含めて、構造上の件数を数える", () => {
    const raw = { records: [{ worldCardId: "1" }, { worldCardId: 123 }, { broken: true }] };
    expect(countRawEntries("myTeam", raw)).toBe(3);
    expect(extractScopedItems("myTeam", raw).length).toBe(1);
  });

  it("myBuildsはマップ全体の合計件数を数える", () => {
    const raw = { "111": [{ buildId: "b1" }], "222": [{ buildId: "b2" }, {}] };
    expect(countRawEntries("myBuilds", raw)).toBe(3);
  });
});

describe("encodeScopedItems / round-trip", () => {
  it("myTeam: 復元した文字列を再度extractすると同じidが得られる", () => {
    const raw = { records: [{ worldCardId: "1", updatedAt: NOW }, { worldCardId: "2", updatedAt: NOW }] };
    const items = extractScopedItems("myTeam", raw);
    const encoded = encodeScopedItems("myTeam", items, NOW);
    const roundTrip = extractScopedItems("myTeam", JSON.parse(encoded));
    expect(roundTrip.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("squads: プレーン配列として再構成される", () => {
    const raw = [{ squadId: "sq_1", updatedAt: NOW }];
    const items = extractScopedItems("squads", raw);
    const encoded = encodeScopedItems("squads", items, NOW);
    expect(JSON.parse(encoded)).toEqual(raw);
  });

  it("myBuilds: worldCardIdごとに再グループ化される", () => {
    const raw = { "111": [{ buildId: "b1", worldCardId: "111" }], "222": [{ buildId: "b2", worldCardId: "222" }] };
    const items = extractScopedItems("myBuilds", raw);
    const encoded = encodeScopedItems("myBuilds", items, NOW);
    const parsed = JSON.parse(encoded);
    expect(parsed["111"]).toEqual([{ buildId: "b1", worldCardId: "111" }]);
    expect(parsed["222"]).toEqual([{ buildId: "b2", worldCardId: "222" }]);
  });

  it("squadTemplates: templatesラッパーへ再構成される", () => {
    const items = extractScopedItems("squadTemplates", { templates: [{ templateId: "tpl_abc123" }] });
    const encoded = encodeScopedItems("squadTemplates", items, NOW);
    const parsed = JSON.parse(encoded);
    expect(parsed.templates).toEqual([{ templateId: "tpl_abc123" }]);
    expect(parsed.storageVersion).toContain("squad-templates-storage/");
  });
});

describe("scopedItemsContentEqual", () => {
  it("同じ内容なら true", () => {
    const a = { id: "1", updatedAt: NOW, raw: { worldCardId: "1", note: "x" } };
    const b = { id: "1", updatedAt: NOW, raw: { worldCardId: "1", note: "x" } };
    expect(scopedItemsContentEqual("myTeam", a, b)).toBe(true);
  });

  it("異なる内容なら false", () => {
    const a = { id: "1", updatedAt: NOW, raw: { worldCardId: "1", note: "x" } };
    const b = { id: "1", updatedAt: NOW, raw: { worldCardId: "1", note: "y" } };
    expect(scopedItemsContentEqual("myTeam", a, b)).toBe(false);
  });

  it("squads: 先発スロットの配列順序が違うだけなら true(slotIdで正規化比較)", () => {
    const slotA = { slotId: "cf", worldCardId: "1", buildMode: "none", savedBuildId: null };
    const slotB = { slotId: "gk", worldCardId: "2", buildMode: "none", savedBuildId: null };
    const a = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "n", slots: [slotA, slotB], substitutes: [] } };
    const b = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "n", slots: [slotB, slotA], substitutes: [] } };
    expect(scopedItemsContentEqual("squads", a, b)).toBe(true);
  });

  it("squads: 選手ブースターの配列順序が違うだけなら true(slot/boosterKeyで正規化比較)", () => {
    const boosters = [
      { slot: 1, boosterKey: "speed", level: 3 },
      { slot: 2, boosterKey: "power", level: 2 },
    ];
    const slotWith = (bs: typeof boosters) => ({ slotId: "cf", worldCardId: "1", buildMode: "none", savedBuildId: null, boosters: bs });
    const a = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "n", slots: [slotWith(boosters)], substitutes: [] } };
    const b = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "n", slots: [slotWith([...boosters].reverse())], substitutes: [] } };
    expect(scopedItemsContentEqual("squads", a, b)).toBe(true);
  });

  it("squads: ベンチ(substitutes)の並び順が違えば false(表示順は仕様の一部・順序を変更しない)", () => {
    const sub1 = { subId: "sub_1", worldCardId: "1", buildMode: "none", savedBuildId: null };
    const sub2 = { subId: "sub_2", worldCardId: "2", buildMode: "none", savedBuildId: null };
    const a = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "n", slots: [], substitutes: [sub1, sub2] } };
    const b = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "n", slots: [], substitutes: [sub2, sub1] } };
    expect(scopedItemsContentEqual("squads", a, b)).toBe(false);
  });

  it("squads: 公式フィールド(squadName等)が異なれば false", () => {
    const a = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "A", slots: [], substitutes: [] } };
    const b = { id: "sq_1", updatedAt: NOW, raw: { squadId: "sq_1", squadName: "B", slots: [], substitutes: [] } };
    expect(scopedItemsContentEqual("squads", a, b)).toBe(false);
  });

  it("squadTemplates: 埋め込みスカッドの先発スロット順序だけが違うなら true", () => {
    const slotA = { slotId: "cf", worldCardId: "1", buildMode: "none", savedBuildId: null };
    const slotB = { slotId: "gk", worldCardId: "2", buildMode: "none", savedBuildId: null };
    const a = {
      id: "tpl_1",
      updatedAt: NOW,
      raw: { templateId: "tpl_1", templateName: "t", squad: { squadId: "sq_1", slots: [slotA, slotB], substitutes: [] } },
    };
    const b = {
      id: "tpl_1",
      updatedAt: NOW,
      raw: { templateId: "tpl_1", templateName: "t", squad: { squadId: "sq_1", slots: [slotB, slotA], substitutes: [] } },
    };
    expect(scopedItemsContentEqual("squadTemplates", a, b)).toBe(true);
  });

  it("squadTemplates: テンプレート名が異なれば false", () => {
    const a = { id: "tpl_1", updatedAt: NOW, raw: { templateId: "tpl_1", templateName: "A", squad: { squadId: "sq_1", slots: [], substitutes: [] } } };
    const b = { id: "tpl_1", updatedAt: NOW, raw: { templateId: "tpl_1", templateName: "B", squad: { squadId: "sq_1", slots: [], substitutes: [] } } };
    expect(scopedItemsContentEqual("squadTemplates", a, b)).toBe(false);
  });
});
