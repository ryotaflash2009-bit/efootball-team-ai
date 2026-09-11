import { describe, it, expect } from "vitest";
import { rowToListItem, rowsToStats, rowToAppearance } from "./mappers";
import { WORLD_STAT_KEYS } from "./stats";

describe("rowToListItem", () => {
  const row = {
    world_card_id: "88043608522894",
    name_en: "Burchet",
    name_ja: "バーチャット",
    card_type: "EPIC",
    registered_position: "RWF",
    nationality: "Australia",
    region: "Asia-Oceania",
    league: "Other",
    team: "EFB United",
    ovr_base: 84,
    ovr_max: 94,
    maximum_level: 19,
    card_rating: "B",
    playing_style: "Prolific Winger",
    playing_style_def: "Basic",
    preferred_foot: "Right foot",
    age: 25,
    height: 178,
    weight: 70,
    image_url: "https://d1zxa6glxh8sq9.cloudfront.net/player_88043608522894_1787815095927.webp",
    mobile_image_url: null,
    boost1: 159,
    boost2: 0,
    appearance_updated_at: "2026-08-27T16:09:08.972164",
    efhub_card_id: null,
  };

  it("snake_case を camelCase へ写す", () => {
    const item = rowToListItem(row);
    expect(item.worldCardId).toBe("88043608522894");
    expect(item.nameJa).toBe("バーチャット");
    expect(item.ovrMax).toBe(94);
    expect(item.preferredFoot).toBe("Right foot");
  });

  it("eFHUB リンクがなければ hasEfhubLink=false / efhubCardId=null", () => {
    const item = rowToListItem(row);
    expect(item.hasEfhubLink).toBe(false);
    expect(item.efhubCardId).toBeNull();
  });

  it("数字の eFHUB ID があればリンク扱い", () => {
    const item = rowToListItem({ ...row, efhub_card_id: "89138556575063" });
    expect(item.hasEfhubLink).toBe(true);
    expect(item.efhubCardId).toBe("89138556575063");
  });

  it("不正な eFHUB ID はリンク扱いにしない", () => {
    const item = rowToListItem({ ...row, efhub_card_id: "not-a-number" });
    expect(item.hasEfhubLink).toBe(false);
  });

  it("既知ホストの画像 URL は候補として返す", () => {
    expect(rowToListItem(row).imageUrlCandidate).toContain("cloudfront.net");
  });
  it("別ホストの画像 URL は候補にしない", () => {
    const item = rowToListItem({ ...row, image_url: "https://evil.example.com/x.webp" });
    expect(item.imageUrlCandidate).toBeNull();
  });
});

describe("rowsToStats", () => {
  it("常に 26 項目そろえる（欠損は value: null）", () => {
    const stats = rowsToStats([{ stat_key: "speed", value: 92 }]);
    expect(stats).toHaveLength(26);
    expect(stats.find((s) => s.key === "speed")?.value).toBe(92);
    expect(stats.find((s) => s.key === "finishing")?.value).toBeNull();
  });

  it("キーは World の 26 キーのみ", () => {
    const keys = rowsToStats([]).map((s) => s.key);
    expect(keys.sort()).toEqual([...WORLD_STAT_KEYS].sort());
  });

  it("想定外キーの行は無視する", () => {
    const stats = rowsToStats([{ stat_key: "__weird__", value: 5 }]);
    expect(stats).toHaveLength(26);
    expect(stats.some((s) => s.key === "__weird__")).toBe(false);
  });
});

describe("rowToAppearance", () => {
  it("null/undefined は null", () => {
    expect(rowToAppearance(null)).toBeNull();
    expect(rowToAppearance(undefined)).toBeNull();
  });
  it("数値項目を数値化する", () => {
    const a = rowToAppearance({ position: "RWF", leg_coverage_radius: 171.77, updated_at: "2026-08-27T16:09:08" });
    expect(a?.position).toBe("RWF");
    expect(a?.legCoverageRadius).toBeCloseTo(171.77);
  });
});
