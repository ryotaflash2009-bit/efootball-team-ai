import { describe, it, expect } from "vitest";
import { squadAffiliationSummary } from "./affiliation-summary";

describe("スカッドの先発の所属の内訳（2026-10-11）", () => {
  it("2 人以上の値だけを多い順（同数は名前順）・最大 3 件。所属が分からない選手は unknown", () => {
    const jp = { nationality: "Japan", league: "2026/27 MEIJI YASUDA J1 LEAGUE", team: "Kashima" };
    const r = squadAffiliationSummary([
      jp,
      jp,
      { ...jp, team: "Urawa" },
      { nationality: "Brazil", league: "English League", team: "Liverpool R" },
      { nationality: "Brazil", league: "English League", team: "Liverpool R" },
      { nationality: "Spain", league: "English League", team: "Arsenal FC" },
      { nationality: "France", league: null, team: null },
      null,
      null,
    ]);
    expect(r.known).toBe(7);
    expect(r.unknown).toBe(2);
    expect(r.groups.nationality).toEqual([{ value: "Japan", count: 3 }, { value: "Brazil", count: 2 }]);
    expect(r.groups.league).toEqual([{ value: "2026/27 MEIJI YASUDA J1 LEAGUE", count: 3 }, { value: "English League", count: 3 }]);
    expect(r.groups.team).toEqual([{ value: "Kashima", count: 2 }, { value: "Liverpool R", count: 2 }]);
  });
  it("全員が別の値・空のスカッドは groups が空", () => {
    expect(squadAffiliationSummary([{ nationality: "A" }, { nationality: "B" }]).groups.nationality).toEqual([]);
    expect(squadAffiliationSummary([])).toEqual({ known: 0, unknown: 0, groups: { nationality: [], league: [], team: [] } });
  });
  it("最大 3 件", () => {
    const rows = ["A", "A", "B", "B", "C", "C", "D", "D"].map((n) => ({ nationality: n }));
    expect(squadAffiliationSummary(rows).groups.nationality.map((g) => g.value)).toEqual(["A", "B", "C"]);
  });
});
