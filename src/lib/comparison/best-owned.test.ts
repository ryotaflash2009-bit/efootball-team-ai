import { describe, it, expect } from "vitest";
import { bestOwnedForPosition } from "./best-owned";

const RC_A = "88039581945292";
const RC_B = "88033139494348"; // RC_A と同じ選手
const c = (worldCardId: string, registeredPosition: string, ovrMax: number | null, ovrBase: number | null = null) => ({ worldCardId, registeredPosition, ovrMax, ovrBase });

describe("bestOwnedForPosition", () => {
  it("同じポジションで最大 OVR が最も高い所持のカード", () => {
    const owned = [c("1", "LB", 90), c("2", "LB", 95), c("3", "CB", 99)];
    expect(bestOwnedForPosition({ worldCardId: "9", registeredPosition: "LB" }, owned)?.worldCardId).toBe("2");
  });
  it("比べるカードそのもの・同じ選手の別のカードは除く", () => {
    const owned = [c(RC_A, "LB", 99), c(RC_B, "LB", 98), c("5", "LB", 80)];
    expect(bestOwnedForPosition({ worldCardId: RC_A, registeredPosition: "LB" }, owned)?.worldCardId).toBe("5");
  });
  it("ovrMax が無ければ ovrBase・同じなら World ID の順・無ければ null", () => {
    expect(bestOwnedForPosition({ worldCardId: "9", registeredPosition: "LB" }, [c("7", "LB", null, 85), c("6", "LB", 85)])?.worldCardId).toBe("6");
    expect(bestOwnedForPosition({ worldCardId: "9", registeredPosition: "GK" }, [c("1", "LB", 90)])).toBeNull();
    expect(bestOwnedForPosition({ worldCardId: "9", registeredPosition: null }, [c("1", "LB", 90)])).toBeNull();
  });
});
