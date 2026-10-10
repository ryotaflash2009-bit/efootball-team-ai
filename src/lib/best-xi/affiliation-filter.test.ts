import { describe, it, expect } from "vitest";
import {
  affiliationOptions,
  applyAffiliationFilter,
  decodeAffiliationFilter,
  encodeAffiliationFilter,
  type BestXiAffiliation,
} from "./affiliation-filter";
import type { BestXiCandidate } from "./types";

const aff = new Map<string, BestXiAffiliation>([
  ["1", { nationality: "Japan", league: "2026/27 MEIJI YASUDA J1 LEAGUE", team: "Kashima" }],
  ["2", { nationality: "Japan", league: "English League", team: "Liverpool R" }],
  ["3", { nationality: "Côte d'Ivoire", league: "English League", team: "Liverpool R" }],
  ["4", { nationality: null, league: null, team: null }],
]);
const cand = (id: string, buildId: string | null = null) => ({ worldCardId: id, candidateKey: `${id}:${buildId ?? "base"}`, buildId }) as unknown as BestXiCandidate;

describe("AIベストイレブンの縛り（2026-10-11）", () => {
  it("選択肢は自分のカードにある値だけ・枚数の多い順・同じカードは 1 枚と数える", () => {
    const o = affiliationOptions(["1", "2", "3", "3", "4", "9"], aff);
    expect(o.nationality).toEqual([
      { kind: "nationality", value: "Japan", cardCount: 2 },
      { kind: "nationality", value: "Côte d'Ivoire", cardCount: 1 },
    ]);
    expect(o.league.map((x) => [x.value, x.cardCount])).toEqual([["English League", 2], ["2026/27 MEIJI YASUDA J1 LEAGUE", 1]]);
    expect(o.team[0]).toEqual({ kind: "team", value: "Liverpool R", cardCount: 2 });
  });
  it("縛りに合う候補だけ（同じカードの複数のビルドも残す）・所属が分からないカードは入れない・縛りなしはそのまま", () => {
    const input = { candidates: [cand("1"), cand("1", "b1"), cand("2"), cand("3"), cand("4"), cand("9")], unavailableCards: [{ worldCardId: "2", reason: "noWorldCardData" as const }, { worldCardId: "9", reason: "noWorldCardData" as const }] };
    const jp = applyAffiliationFilter(input, aff, { kind: "nationality", value: "Japan" });
    expect(jp.candidates.map((c) => c.candidateKey)).toEqual(["1:base", "1:b1", "2:base"]);
    expect(jp.unavailableCards.map((u) => u.worldCardId)).toEqual(["2"]);
    expect(applyAffiliationFilter(input, aff, { kind: "team", value: "Liverpool R" }).candidates.map((c) => c.worldCardId)).toEqual(["2", "3"]);
    expect(applyAffiliationFilter(input, aff, null)).toBe(input);
  });
  it("select の値の変換（値にコロンを含んでもよい）・不正な値は縛りなし", () => {
    const f = { kind: "team" as const, value: "A: B" };
    expect(decodeAffiliationFilter(encodeAffiliationFilter(f))).toEqual(f);
    expect(encodeAffiliationFilter(null)).toBe("");
    for (const bad of ["", "team:", "club:Japan", ":Japan", "Japan"]) expect(decodeAffiliationFilter(bad)).toBeNull();
  });
});
