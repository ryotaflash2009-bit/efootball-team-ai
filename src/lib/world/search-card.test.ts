import { describe, it, expect } from "vitest";
import { buildPlayerSearchCardView, boosterChipsForCard } from "./search-card";
import type { WorldPlayerListItem } from "./types";

function card(over: Partial<WorldPlayerListItem>): WorldPlayerListItem {
  return {
    worldCardId: "89138556575063",
    nameEn: "Lionel Messi",
    nameJa: "リオネル メッシ",
    cardType: "BIG TIME",
    registeredPosition: "SS",
    ovrBase: 90,
    ovrMax: 105,
    maximumLevel: 32,
    cardRating: null,
    playingStyle: "Creative Playmaker",
    playingStyleDefensive: null,
    nationality: "Argentina",
    region: null,
    league: null,
    team: "Inter Miami",
    preferredFoot: null,
    age: 37,
    height: 170,
    weight: 72,
    boost1: 0,
    boost2: 0,
    appearanceUpdatedAt: null,
    imageUrlCandidate: null,
    mobileImageUrlCandidate: null,
    hasEfhubLink: false,
    efhubCardId: null,
    ...over,
  };
}

describe("buildPlayerSearchCardView", () => {
  it("ja: 表示名は nameJa → nameEn → フォールバック", () => {
    expect(buildPlayerSearchCardView(card({}), "ja").name).toBe("リオネル メッシ");
    expect(buildPlayerSearchCardView(card({ nameJa: null }), "ja").name).toBe("Lionel Messi");
    expect(buildPlayerSearchCardView(card({ nameJa: null, nameEn: null, worldCardId: "42" }), "ja").name).toBe("カード 42");
  });

  it("en: 表示名は nameEn → フォールバック → nameJa", () => {
    expect(buildPlayerSearchCardView(card({}), "en").name).toBe("Lionel Messi");
    expect(buildPlayerSearchCardView(card({ nameEn: null, worldCardId: "42" }), "en").name).toBe("Card 42");
    expect(buildPlayerSearchCardView(card({ nameEn: null, nameJa: null, worldCardId: "42" }), "en").name).toBe("Card 42");
  });

  it("同一カードの ID・OVR・能力値は locale で変化しない", () => {
    const ja = buildPlayerSearchCardView(card({}), "ja");
    const en = buildPlayerSearchCardView(card({}), "en");
    expect(ja.worldCardId).toBe(en.worldCardId);
    expect(ja.ovr).toBe(en.ovr);
    expect(ja.ovrMax).toBe(en.ovrMax);
    expect(ja.ovrBase).toBe(en.ovrBase);
  });

  it("OVR は ovrMax 優先・無ければ ovrBase・両方 null なら null", () => {
    expect(buildPlayerSearchCardView(card({}), "ja").ovr).toBe(105);
    expect(buildPlayerSearchCardView(card({ ovrMax: null }), "ja").ovr).toBe(90);
    expect(buildPlayerSearchCardView(card({ ovrMax: null, ovrBase: null }), "ja").ovr).toBeNull();
  });

  it("0 を欠損扱いしない", () => {
    const v = buildPlayerSearchCardView(card({ ovrMax: null, ovrBase: 0 }), "ja");
    expect(v.ovr).toBe(0);
  });

  it("teamLine はチーム・国籍を連結、両方無ければ null", () => {
    expect(buildPlayerSearchCardView(card({}), "ja").teamLine).toBe("Inter Miami · Argentina");
    expect(buildPlayerSearchCardView(card({ team: null, nationality: null }), "ja").teamLine).toBeNull();
  });

  it("欠損値は別カードから補完しない（null のまま）", () => {
    const v = buildPlayerSearchCardView(card({ cardType: null, registeredPosition: null, maximumLevel: null, playingStyle: null }), "ja");
    expect(v.cardType).toBeNull();
    expect(v.registeredPosition).toBeNull();
    expect(v.maximumLevel).toBeNull();
    expect(v.playingStyle).toBeNull();
  });

  it("identityLabel が同名別カードの識別情報を含む（タイプ / 位置 / OVR / World ID）", () => {
    const v = buildPlayerSearchCardView(card({ worldCardId: "12345678901234567890", cardType: "EPIC", registeredPosition: "RWF" }), "ja");
    expect(v.identityLabel).toContain("EPIC");
    expect(v.identityLabel).toContain("RWF");
    expect(v.identityLabel).toContain("最大OVR 105");
    expect(v.identityLabel).toContain("World ID 12345678901234567890");
  });

  it("identityLabel と imageAlt は locale に応じて切り替わる（欠損時ラベルも含む）", () => {
    const ja = buildPlayerSearchCardView(card({ cardType: null, registeredPosition: null }), "ja");
    const en = buildPlayerSearchCardView(card({ cardType: null, registeredPosition: null }), "en");
    expect(ja.identityLabel).toContain("カードタイプ不明");
    expect(ja.identityLabel).toContain("ポジション不明");
    expect(en.identityLabel).toContain("Unknown card type");
    expect(en.identityLabel).toContain("Unknown position");
    expect(ja.imageAlt).toContain("カード画像");
    expect(en.imageAlt).toContain("card image");
  });

  it("画像候補なしのカードでも view を返す（imageSources は空配列）", () => {
    const v = buildPlayerSearchCardView(card({ hasEfhubLink: false, imageUrlCandidate: null, mobileImageUrlCandidate: null }), "ja");
    expect(Array.isArray(v.imageSources)).toBe(true);
    expect(v.imageSources).toHaveLength(0);
    expect(v.imageAlt).toContain("カード画像");
  });

  it("World 保存画像がある場合は同一オリジンのプロキシ URL を返す", () => {
    const v = buildPlayerSearchCardView(card({ imageUrlCandidate: "https://example.com/x.webp" }), "ja");
    expect(v.imageSources[0]).toBe("/api/world/player-image/89138556575063");
  });
});

describe("boosterChipsForCard", () => {
  it("boost なしは空", () => {
    expect(boosterChipsForCard({ boost1: 0, boost2: 0 })).toEqual([]);
    expect(boosterChipsForCard({ boost1: null, boost2: null })).toEqual([]);
  });

  it("対応表に無い ID は unresolved（fixed へ確定しない）", () => {
    expect(boosterChipsForCard({ boost1: 999999, boost2: 0 })).toEqual([{ kind: "unresolved" }]);
  });

  it("解決できると fixed（provisional フラグ付き）か pom・nameEn / level を持つ", () => {
    const chips = boosterChipsForCard({ boost1: 999999, boost2: 999998 });
    expect(chips).toHaveLength(2);
    for (const c of chips) {
      if (c.kind === "unresolved") continue;
      expect(["fixed", "pom"]).toContain(c.kind);
      expect(typeof c.nameEn).toBe("string");
      expect(c.level).toBeGreaterThanOrEqual(1);
      if (c.kind === "fixed") expect(typeof c.provisional).toBe("boolean");
    }
  });
});
