import { describe, it, expect } from "vitest";
import { benchSuggestions } from "./bench-suggestions";

const RC_A = "88039581945292";
const RC_B = "88033139494348"; // RC_A と同じ選手
const c = (worldCardId: string, registeredPosition: string, ovrMax: number) => ({ worldCardId, registeredPosition, ovrMax, ovrBase: null });

describe("benchSuggestions", () => {
  it("控えにいないポジションごとに、スカッドにいない所持のカードで最も強いもの", () => {
    const out = benchSuggestions({
      starterPositions: ["GK", "CB", "CB", "CF"],
      benchPositions: ["CF"],
      inSquad: new Set(["s1"]),
      owned: [c("1", "GK", 80), c("2", "GK", 85), c("3", "CB", 90), c("4", "CF", 99)],
    });
    expect(out.map((x) => [x.position, x.card.worldCardId])).toEqual([["GK", "2"], ["CB", "3"]]);
  });
  it("スカッドにいるカード・スカッドにいる選手の別のカードは出さない", () => {
    const out = benchSuggestions({ starterPositions: ["LB"], benchPositions: [], inSquad: new Set([RC_A]), owned: [c(RC_A, "LB", 99), c(RC_B, "LB", 98), c("5", "LB", 80)] });
    expect(out.map((x) => x.card.worldCardId)).toEqual(["5"]);
  });
  it("候補が無いポジションは出さない・最大の数", () => {
    expect(benchSuggestions({ starterPositions: ["GK", "CB"], benchPositions: [], inSquad: new Set(), owned: [c("1", "CB", 80)] }).map((x) => x.position)).toEqual(["CB"]);
    const many = benchSuggestions({ starterPositions: ["GK", "CB", "LB"], benchPositions: [], inSquad: new Set(), owned: [c("1", "GK", 80), c("2", "CB", 80), c("3", "LB", 80)], limit: 2 });
    expect(many.length).toBe(2);
  });
});
