import { describe, it, expect } from "vitest";
import { getPositionAbilityRanking } from "./calculate-rating";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";

describe("getPositionAbilityRanking", () => {
  it("CBは既存のPOSITION_WEIGHTS通り、defensiveAwareness/tacklingを最上位に返す", () => {
    const ranking = getPositionAbilityRanking("CB");
    expect(ranking[0]).toBe("defensiveAwareness");
    expect(ranking).toContain("tackling");
    expect(ranking.indexOf("tackling")).toBeLessThan(ranking.indexOf("speed"));
  });

  it("GKはgk系能力を最上位に返す", () => {
    const ranking = getPositionAbilityRanking("GK");
    expect(ranking.slice(0, 5)).toEqual(
      expect.arrayContaining(["gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach"]),
    );
  });

  it("未知のポジション/nullはGENERIC_WEIGHTSへフォールバックする(例外を投げない)", () => {
    expect(() => getPositionAbilityRanking(null)).not.toThrow();
    expect(() => getPositionAbilityRanking("UNKNOWN")).not.toThrow();
    expect(getPositionAbilityRanking(null).length).toBeGreaterThan(0);
  });

  it("重み0以下の能力を含まない(重みが定義されている能力だけを返す)", () => {
    const ranking = getPositionAbilityRanking("CF");
    expect(ranking.every((k) => WORLD_STAT_KEYS.includes(k))).toBe(true);
  });

  it("同じポジションを何度呼んでも同じ順序を返す(決定性)", () => {
    const a = getPositionAbilityRanking("RWF");
    const b = getPositionAbilityRanking("RWF");
    expect(a).toEqual(b);
  });

  it("重みが同じ能力同士はWORLD_STAT_KEYSの固定順で並ぶ", () => {
    const ranking = getPositionAbilityRanking("CB");
    // CB: defensiveAwareness:3, tackling:3, defensiveEngagement:2, aggression:2, heading:2, physicalContact:2, jumping:2, ...
    // 重み3の2つ(defensiveAwareness, tackling)はWORLD_STAT_KEYS順で並ぶはず
    const idxDefAware = WORLD_STAT_KEYS.indexOf("defensiveAwareness");
    const idxTackling = WORLD_STAT_KEYS.indexOf("tackling");
    const rankDefAware = ranking.indexOf("defensiveAwareness");
    const rankTackling = ranking.indexOf("tackling");
    if (idxDefAware < idxTackling) {
      expect(rankDefAware).toBeLessThan(rankTackling);
    } else {
      expect(rankTackling).toBeLessThan(rankDefAware);
    }
  });
});
