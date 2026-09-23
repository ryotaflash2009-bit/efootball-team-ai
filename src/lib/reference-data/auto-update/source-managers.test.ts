import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MANAGER_SOURCE_COLUMNS,
  ManagersSourceParseError,
  buildManagersRequest,
  collectUnmappedBoosterStats,
  parseBoosterDelta,
  parseManagersDocument,
  toManagerSourceRow,
  type ManagerSourceRow,
} from "./source-managers";
import { UPDATE_TABLE_CONTRACTS, managerIdentity } from "./update-contract";

const body = readFileSync(path.join(__dirname, "__fixtures__", "source", "managers-synthetic.json"), "utf8");
const FETCHED_AT = "2026-09-23T00:00:00.000Z";

describe("managers.json parser", () => {
  it("配列を読み、本文のSHA-256を記録する", () => {
    const doc = parseManagersDocument(body);
    expect(doc.managers.length).toBe(5);
    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("JSONでない本文はparse_error、配列でなければschema_drift", () => {
    expect(() => parseManagersDocument("not json")).toThrow(ManagersSourceParseError);
    try {
      parseManagersDocument('{"managers":[]}');
    } catch (e) {
      expect((e as ManagersSourceParseError).reason).toBe("schema_drift");
    }
  });

  it("requestはGET・bodyなし", () => {
    const req = buildManagersRequest();
    expect(req.method).toBe("GET");
    expect(req.body).toBeNull();
  });
});

describe("managers source row", () => {
  const results = parseManagersDocument(body).managers.map((m) => toManagerSourceRow(m, FETCHED_AT));
  const rows = results.filter((r) => r.ok).map((r) => (r.ok ? r.row : null)!) as ManagerSourceRow[];

  it("正常な3件を受理し、id不正・名前空の2件をrejectする", () => {
    expect(rows.length).toBe(3);
    const rejected = results.filter((r) => !r.ok).map((r) => (r.ok ? null : r.rejection)!);
    expect(rejected[0].identity).toBeNull();
    expect(rejected[0].reasons.join()).toMatch(/id/);
    expect(rejected[1].identity).toBe(managerIdentity("amine250", "synthetic-manager-5"));
    expect(rejected[1].reasons.join()).toMatch(/name/);
  });

  it("列集合は契約のProduction列の部分集合で、保持列(internal_manager_id等)を含まない", () => {
    const contract = UPDATE_TABLE_CONTRACTS.managers;
    for (const col of MANAGER_SOURCE_COLUMNS) expect(contract.productionColumns).toContain(col);
    for (const col of contract.preserveOnUpdateColumns) expect(MANAGER_SOURCE_COLUMNS).not.toContain(col);
    expect(Object.keys(rows[0]).sort()).toEqual([...MANAGER_SOURCE_COLUMNS, "fetched_at"].sort());
  });

  it("既存syncと同じ変換: 名前trim・適性trunc(数値以外はnull)・ブースター・Link-up", () => {
    const [one, two, three] = rows;
    expect(one.possession_game).toBe(88);
    expect(one.quick_counter).toBe(75);
    expect(one.out_wide).toBe(-3);
    expect(one.overload).toBeNull(); // 文字列"70"は既存syncでもnull
    expect(one.released_at).toBe("2026-01-15");
    expect(one.has_booster).toBe(true);
    expect(one.booster_confirmation).toBe("confirmed");
    expect(one.has_link_up_play).toBe(true);
    expect(two.name_en).toBe("Synthetic Manager Two");
    expect(two.name_sort_key).toBe("synthetic manager two");
    expect(two.has_booster).toBe(false);
    expect(two.booster_confirmation).toBe("unresolved");
    expect(two.link_up_plays).toEqual([{ name: "Singular Link", centerPiece: null, keyMan: { role: "keyMan", playingStyle: "Anchor Man", positions: [] }, confirmationStatus: "provisional" }]);
    expect(three.source_manager_id).toBe("3");
    expect(three.boosters).toEqual([]);
    expect(three.link_up_plays).toEqual([]);
    expect(three.has_link_up_play).toBe(false);
    expect(Object.keys(one)).not.toContain("photo_path");
  });

  it("deltaの抽出と未対応ブースター名の収集", () => {
    expect(parseBoosterDelta("+2")).toBe(2);
    expect(parseBoosterDelta("-1 when trailing")).toBe(-1);
    expect(parseBoosterDelta("plus two")).toBe(0);
    expect(parseBoosterDelta(null)).toBe(0);
    expect(collectUnmappedBoosterStats(rows)).toEqual(["Unknown Future Stat"]);
  });

  it("不正なfetchedAtはreject", () => {
    expect(toManagerSourceRow({ id: "a", name: "b" }, "yesterday").ok).toBe(false);
  });
});
