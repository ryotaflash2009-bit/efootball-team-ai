import { describe, expect, it } from "vitest";
import { sameNameGroups } from "./same-name";

const c = (worldCardId: string, nameEn: string | null, nameJa: string | null = null) => ({ worldCardId, nameEn, nameJa });

describe("同じ名前のカード（NEW-25）", () => {
  it("英語名が同じ別のカードを 1 つにまとめる（大文字・空白の違いは同じ）", () => {
    expect(sameNameGroups([c("1", "Lionel Messi"), c("2", "lionel  messi"), c("3", "Xavi")])).toEqual([{ name: "Lionel Messi", worldCardIds: ["1", "2"] }]);
  });
  it("同じカード（同じ ID）は 1 枚・名前が無いカードは比べない・英語名が無ければ日本語名", () => {
    expect(sameNameGroups([c("1", "Messi"), c("1", "Messi")])).toEqual([]);
    expect(sameNameGroups([c("1", null), c("2", null)])).toEqual([]);
    expect(sameNameGroups([c("1", null, "メッシ"), c("2", null, "メッシ")])).toEqual([{ name: "メッシ", worldCardIds: ["1", "2"] }]);
  });
  it("決定的（名前の順）", () => {
    const g = sameNameGroups([c("4", "B"), c("3", "B"), c("2", "A"), c("1", "A")]);
    expect(g.map((x) => x.name)).toEqual(["A", "B"]);
    expect(g[1].worldCardIds).toEqual(["3", "4"]);
  });
});
