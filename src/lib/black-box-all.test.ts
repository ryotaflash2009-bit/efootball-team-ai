import { describe, expect, it } from "vitest";
import { parseSummary, failLines, renderReadme, railNameOf, NEEDS_INTERNAL_PAGES } from "../../scripts/black-box-all.mjs";

describe("ブラックボックスの一括実行の一覧（2026-10-17）", () => {
  it("出力の最後の件数を読む（n/m PASS・rails の形）", () => {
    expect(parseSummary("PASS a\n[black-box-squads] 51/51 PASS\n")).toMatchObject({ passed: 51, total: 51 });
    expect(parseSummary("x\n[black-box-release-gate] FAIL (1/2 rails)")).toMatchObject({ passed: 1, total: 2 });
    expect(parseSummary("no numbers")).toMatchObject({ passed: null, total: null });
    expect(railNameOf("black-box-new-cards.mjs")).toBe("new-cards");
  });

  it("失敗の行は最大 5 件", () => {
    const out = Array.from({ length: 7 }, (_, i) => `FAIL  item ${i}`).join("\n") + "\nPASS  ok";
    expect(failLines(out)).toHaveLength(5);
  });

  it("一覧は失敗を先頭に・対象外を最後に。社内向けページの rail に印", () => {
    const md = renderReadme({
      rails: {
        a: { name: "a", status: "pass", passed: 3, total: 3, seconds: 1, ranAt: "2026-10-17T00:00:00Z", report: "a.md" },
        "local-posts": { name: "local-posts", status: "skip", passed: null, total: null, seconds: 0, ranAt: "2026-10-17T00:00:00Z", report: null },
        b: { name: "b", status: "fail", passed: 1, total: 2, seconds: 1, ranAt: "2026-10-17T00:00:00Z", fails: ["FAIL  x | y"], report: null },
      },
    });
    const rows = md.split("\n").filter((l) => /^\| (✅|❌|⏭)/.test(l));
    expect(rows.map((r) => r.split("|")[2].trim())).toEqual(["b", "a", "local-posts（社内向けページ）"]);
    expect(md).toContain("合格 **1** ・ 失敗 **1** ・ 対象外 **1**");
    expect(md).toContain("FAIL  x \\| y");
    expect(NEEDS_INTERNAL_PAGES.has("rls-test")).toBe(true);
  });
});
