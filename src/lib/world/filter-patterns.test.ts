import { describe, it, expect } from "vitest";
import { playersFilterHref } from "./filter-patterns";
import { parseWorldListQuery } from "./schemas";

describe("選手の詳細から選手一覧の絞り込みへのリンク（2026-10-11）", () => {
  it("一覧が受け付ける値だけをリンクにし、リンク先の一覧は同じ値で絞り込む", () => {
    const cases: [Parameters<typeof playersFilterHref>[0], string, keyof ReturnType<typeof parseWorldListQuery>][] = [
      ["nationality", "Côte d'Ivoire", "nationality"],
      ["league", "2026/27 MEIJI YASUDA J1 LEAGUE", "league"],
      ["team", "München RW", "team"],
      ["playingStyle", "Box-to-Box", "playingStyle"],
      ["playingStyleDef", "Anchor Man", "playingStyleDefensive"],
    ];
    for (const [param, value, field] of cases) {
      const href = playersFilterHref(param, value);
      expect(href).toMatch(/^\/players\?/);
      const sp = new URLSearchParams(href!.split("?")[1]);
      const q = parseWorldListQuery({ [param]: sp.get(param) });
      expect(q[field]).toBe(value);
    }
  });
  it("空・前後の空白・長すぎる・許さない文字は null（絞り込まれない一覧へ誘導しない）", () => {
    expect(playersFilterHref("nationality", null)).toBeNull();
    expect(playersFilterHref("nationality", "")).toBeNull();
    expect(playersFilterHref("nationality", " Japan")).toBeNull();
    expect(playersFilterHref("team", "x".repeat(61))).toBeNull();
    expect(playersFilterHref("playingStyle", "Côte")).toBeNull();
    expect(playersFilterHref("league", "a=eq.b")).toBeNull();
  });
});
