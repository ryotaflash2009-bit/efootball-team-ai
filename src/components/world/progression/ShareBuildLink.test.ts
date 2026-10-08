import { describe, expect, it } from "vitest";
import { buildShareHref } from "./ShareBuildLink";
import { parseComparisonState } from "@/lib/comparison/schemas";

describe("配分の共有リンク（2026-10-09）", () => {
  it("比較の画面の URL（ids・al）で、読み戻すと同じ配分になる", () => {
    const href = buildShareHref("89136409091415", { shooting: 8, dexterity: 4, passing: 0 })!;
    expect(decodeURIComponent(href)).toBe("/compare?ids=89136409091415&al=dexterity~4.shooting~8");
    const sp = new URLSearchParams(href.split("?")[1]);
    const st = parseComparisonState({ ids: sp.get("ids"), al: sp.get("al") });
    expect(st.ids).toEqual(["89136409091415"]);
    expect(st.allocations?.[0]).toEqual({ dexterity: 4, shooting: 8 });
  });
  it("配分が無ければリンクを作らない・カードの ID と配分以外は入れない", () => {
    expect(buildShareHref("1", {})).toBeNull();
    expect(buildShareHref("1", { shooting: 0 })).toBeNull();
    expect(buildShareHref("1", { shooting: 3 })).not.toMatch(/name|note|build|cost/i);
  });
});
