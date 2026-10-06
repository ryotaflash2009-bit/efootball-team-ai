import { describe, expect, it } from "vitest";
import { coreTitleFor, formatPageTitle } from "./page-titles";

const nav: Record<string, string> = { players: "Players", managers: "Managers", compare: "Compare", squads: "Squads" };
const t = ((_ns: "nav", key: string) => nav[key]) as never;

describe("タブの題名", () => {
  it("「<題名> | TeamAIXI」にそろえる・すでに付いていればそのまま・空は null", () => {
    expect(formatPageTitle("Squads")).toBe("Squads | TeamAIXI");
    expect(formatPageTitle("About | TeamAIXI")).toBe("About | TeamAIXI");
    expect(formatPageTitle("TeamAIXI")).toBe("TeamAIXI");
    expect(formatPageTitle("")).toBeNull();
    expect(formatPageTitle(null)).toBeNull();
  });

  it("核の画面だけを決め、他の画面（view が設定）と詳細の画面は null", () => {
    expect(coreTitleFor("/", t)).toBe("TeamAIXI");
    expect(coreTitleFor("/players/", t)).toBe("Players | TeamAIXI");
    expect(coreTitleFor("/managers", t)).toBe("Managers | TeamAIXI");
    expect(coreTitleFor("/compare", t)).toBe("Compare | TeamAIXI");
    expect(coreTitleFor("/squads/sq_123", t)).toBe("Squads | TeamAIXI");
    expect(coreTitleFor("/squads/compare", t)).toBeNull();
    expect(coreTitleFor("/squads/templates", t)).toBeNull();
    expect(coreTitleFor("/players/world/123", t)).toBeNull();
    expect(coreTitleFor("/managers/65", t)).toBeNull();
    expect(coreTitleFor("/about", t)).toBeNull();
  });
});
