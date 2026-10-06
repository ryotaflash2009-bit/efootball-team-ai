import { describe, expect, it } from "vitest";
import { BOOSTER_CATALOG } from "./booster-catalog";
import { boosterStats, buildBoosterList, EVIDENCE_ORDER } from "./booster-list";

describe("ブースターの一覧", () => {
  it("全件を証拠の段階の順に並べ、件数はカタログと同じ", () => {
    const groups = buildBoosterList();
    expect(groups.reduce((n, g) => n + g.boosters.length, 0)).toBe(BOOSTER_CATALOG.length);
    const order = groups.map((g) => EVIDENCE_ORDER.indexOf(g.level));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const g of groups) {
      const names = g.boosters.map((b) => b.nameEn);
      expect([...names].sort((a, b) => a.localeCompare(b, "en"))).toEqual(names);
    }
  });

  it("能力で絞り込むと、その能力を上げるブースターだけ", () => {
    const groups = buildBoosterList({ stat: "speed" });
    const all = groups.flatMap((g) => g.boosters);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((b) => b.affectedStats.includes("speed"))).toBe(true);
  });

  it("名前の部分一致（大文字・小文字・アクセントを区別しない）・該当なしは空", () => {
    const first = BOOSTER_CATALOG[0];
    const hit = buildBoosterList({ query: first.nameEn.slice(0, 4).toUpperCase() }).flatMap((g) => g.boosters);
    expect(hit.some((b) => b.key === first.key)).toBe(true);
    expect(buildBoosterList({ query: "zzzz-no-such-booster" })).toEqual([]);
  });

  it("絞り込みの能力の一覧は重複なし・決まった順・カタログに出る能力だけ", () => {
    const stats = boosterStats();
    expect(new Set(stats).size).toBe(stats.length);
    expect([...stats].sort()).toEqual(stats);
    expect(stats.every((s) => BOOSTER_CATALOG.some((b) => b.affectedStats.includes(s)))).toBe(true);
  });
});

describe("F-029b: B2 の候補は育成と比較の画面で同じ", () => {
  it("候補は確認済みだけ・条件つき（Power of Many）を含まない", async () => {
    const { CONFIRMED_B2_CANDIDATES, isConfirmedB2Candidate } = await import("./booster-catalog");
    expect(CONFIRMED_B2_CANDIDATES.length).toBeGreaterThan(0);
    expect(CONFIRMED_B2_CANDIDATES.every((b) => b.confirmationStatus === "confirmed" && !b.conditional)).toBe(true);
    expect(CONFIRMED_B2_CANDIDATES.map((b) => b.key)).toEqual(BOOSTER_CATALOG.filter(isConfirmedB2Candidate).map((b) => b.key));
  });

  it("両方の画面が同じ一覧（CONFIRMED_B2_CANDIDATES）を使う", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "..", "..", "..");
    for (const f of ["src/components/compare/PlayerControlColumn.tsx", "src/components/world/progression/B2BoosterSelector.tsx"]) {
      expect(readFileSync(path.join(root, f), "utf8"), f).toMatch(/CONFIRMED_B2_CANDIDATES/);
    }
  });
});
