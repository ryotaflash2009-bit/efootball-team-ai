import { describe, it, expect } from "vitest";
import { squadCompareHref } from "./to-compare";
import { parseComparisonState } from "@/lib/comparison/schemas";

function parse(href: string) {
  const q = href.split("?")[1] ?? "";
  const sp = Object.fromEntries(new URLSearchParams(q));
  return parseComparisonState(sp);
}

describe("squadCompareHref", () => {
  it("選手なしは /compare", () => {
    expect(squadCompareHref([], null)).toBe("/compare");
  });

  it("buildMode を b= に反映", () => {
    const href = squadCompareHref(
      [
        { worldCardId: "1", buildMode: "attack" },
        { worldCardId: "2", buildMode: "none" },
      ],
      null,
    );
    const s = parse(href);
    expect(s.ids).toEqual(["1", "2"]);
    expect(s.buildModes).toEqual(["attack", "none"]);
    expect(s.managerIds).toEqual([null, null]);
  });

  it("スカッド監督を全選手の m= に反映", () => {
    const s = parse(squadCompareHref([{ worldCardId: "10", buildMode: "gk" }], 42));
    expect(s.managerIds).toEqual([42]);
  });

  it("重複カードを除去し最大4人", () => {
    const s = parse(
      squadCompareHref(
        [
          { worldCardId: "1", buildMode: "none" },
          { worldCardId: "1", buildMode: "attack" },
          { worldCardId: "2", buildMode: "none" },
          { worldCardId: "3", buildMode: "none" },
          { worldCardId: "4", buildMode: "none" },
          { worldCardId: "5", buildMode: "none" },
        ],
        null,
      ),
    );
    expect(s.ids).toEqual(["1", "2", "3", "4"]);
  });

  it("不正なworldCardIdは除外", () => {
    const s = parse(squadCompareHref([{ worldCardId: "abc", buildMode: "none" }, { worldCardId: "7", buildMode: "none" }], null));
    expect(s.ids).toEqual(["7"]);
  });
});
