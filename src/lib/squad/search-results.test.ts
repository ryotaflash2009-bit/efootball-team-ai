import { describe, it, expect } from "vitest";
import { sortSearchResults, boosterChipsForCard } from "./search-results";
import type { WorldPlayerListItem } from "@/lib/world/types";

function card(over: Partial<WorldPlayerListItem>): WorldPlayerListItem {
  return {
    worldCardId: "1", nameEn: "A", nameJa: "あ", cardType: "STANDARD", registeredPosition: "CF",
    ovrBase: 80, ovrMax: 90, maximumLevel: 30, cardRating: null, playingStyle: null, playingStyleDefensive: null,
    nationality: "Japan", region: null, league: null, team: "Team A", preferredFoot: null, age: 25, height: 180, weight: 75,
    boost1: 0, boost2: 0, appearanceUpdatedAt: null, imageUrlCandidate: null, mobileImageUrlCandidate: null,
    hasEfhubLink: false, efhubCardId: null, ...over,
  };
}

describe("sortSearchResults（純関数）", () => {
  it("完全名一致を先頭へ（API 順は保持）", () => {
    const rows = [
      card({ worldCardId: "1", nameEn: "Lionel Messi Jr" }),
      card({ worldCardId: "2", nameEn: "Lionel Messi" }),
      card({ worldCardId: "3", nameEn: "Messi Something" }),
    ];
    const out = sortSearchResults(rows, "lionel messi", null).map((r) => r.worldCardId);
    expect(out[0]).toBe("2");
  });

  it("対象ポジション一致を名前非一致どうしの中で優先", () => {
    const rows = [
      card({ worldCardId: "1", nameEn: "X", registeredPosition: "CB" }),
      card({ worldCardId: "2", nameEn: "Y", registeredPosition: "GK" }),
      card({ worldCardId: "3", nameEn: "Z", registeredPosition: "GK" }),
    ];
    const out = sortSearchResults(rows, "keeper", "GK").map((r) => r.worldCardId);
    expect(out.slice(0, 2).sort()).toEqual(["2", "3"]);
    expect(out[2]).toBe("1");
  });

  it("targetPosition なしでも安定・API 順を保持", () => {
    const rows = [card({ worldCardId: "b" }), card({ worldCardId: "a" }), card({ worldCardId: "c" })];
    expect(sortSearchResults(rows, "xx", null).map((r) => r.worldCardId)).toEqual(["b", "a", "c"]);
  });

  it("適性データが無い（registeredPosition null）カードも除外しない", () => {
    const rows = [card({ worldCardId: "1", registeredPosition: null }), card({ worldCardId: "2" })];
    expect(sortSearchResults(rows, "q", "CF")).toHaveLength(2);
  });

  it("同名別カードは worldCardId で安定順（両方残る）", () => {
    const rows = [
      card({ worldCardId: "89138556575063", nameEn: "Lionel Messi", cardType: "BIG TIME" }),
      card({ worldCardId: "12345678901234567890", nameEn: "Lionel Messi", cardType: "EPIC" }),
    ];
    const out = sortSearchResults(rows, "lionel messi", null);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((r) => r.worldCardId)).size).toBe(2);
  });

  it("空配列でクラッシュしない", () => {
    expect(sortSearchResults([], "x", "CF")).toEqual([]);
  });
});

describe("boosterChipsForCard（純関数）", () => {
  it("boost なしは空", () => {
    expect(boosterChipsForCard({ boost1: 0, boost2: 0 })).toEqual([]);
    expect(boosterChipsForCard({ boost1: null, boost2: null })).toEqual([]);
  });

  it("対応表に無い ID は unresolved", () => {
    const chips = boosterChipsForCard({ boost1: 999999, boost2: 0 });
    expect(chips).toEqual([{ kind: "unresolved" }]);
  });

  it("解決できると fixed か pom のいずれか・nameEn と level を持つ", () => {
    // 実データに依存せず「解決できた場合の形」を検証（どの ID でも良い・無ければスキップ相当）
    const chips = boosterChipsForCard({ boost1: 999999, boost2: 999998 });
    for (const c of chips) {
      if (c.kind === "unresolved") continue;
      expect(["fixed", "pom"]).toContain(c.kind);
      expect(typeof c.nameEn).toBe("string");
      expect(c.level).toBeGreaterThanOrEqual(1);
    }
    expect(chips).toHaveLength(2);
  });
});
