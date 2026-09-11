import { describe, it, expect } from "vitest";
import {
  isDisplayableWorldImageUrl,
  isEfhubImageId,
  resolveCardImageSources,
  WORLD_IMAGE_HOST,
} from "./image";

describe("isDisplayableWorldImageUrl", () => {
  it("既知ホストの https 画像 URL は true", () => {
    expect(
      isDisplayableWorldImageUrl(`https://${WORLD_IMAGE_HOST}/player_88043608522894_1787815095927.webp`),
    ).toBe(true);
    expect(isDisplayableWorldImageUrl(`https://${WORLD_IMAGE_HOST}/player_mobile_89136409091415.webp`)).toBe(true);
  });
  it("別ホスト・http・クエリ付き・拡張子なしは false", () => {
    expect(isDisplayableWorldImageUrl("https://evil.example.com/player_1.webp")).toBe(false);
    expect(isDisplayableWorldImageUrl(`http://${WORLD_IMAGE_HOST}/x.webp`)).toBe(false);
    expect(isDisplayableWorldImageUrl(`https://${WORLD_IMAGE_HOST}/x.webp?a=1`)).toBe(false);
    expect(isDisplayableWorldImageUrl(`https://${WORLD_IMAGE_HOST}/x`)).toBe(false);
    expect(isDisplayableWorldImageUrl(null)).toBe(false);
    expect(isDisplayableWorldImageUrl("")).toBe(false);
  });
});

describe("isEfhubImageId", () => {
  it("数字のみを許可", () => {
    expect(isEfhubImageId("89138556575063")).toBe(true);
    expect(isEfhubImageId("abc")).toBe(false);
    expect(isEfhubImageId(null)).toBe(false);
    expect(isEfhubImageId("12/34")).toBe(false);
  });
});

describe("resolveCardImageSources", () => {
  const world = "89138556575063";
  const efhub = "89136409091415";

  it("優先1: eFHUB 高信頼リンク → eFHUB プロキシが先頭", () => {
    const s = resolveCardImageSources({
      worldCardId: world,
      efhubCardId: efhub,
      hasEfhubLink: true,
      hasWorldImage: true,
      hasWorldMobileImage: false,
    });
    expect(s[0]).toBe(`/api/player-image/${efhub}`);
    expect(s[1]).toBe(`/api/world/player-image/${world}`);
  });

  it("優先2: eFHUB リンクなしでも World 画像があれば World プロキシを返す（NO IMAGE へ即断しない）", () => {
    const s = resolveCardImageSources({
      worldCardId: world,
      efhubCardId: null,
      hasEfhubLink: false,
      hasWorldImage: true,
      hasWorldMobileImage: false,
    });
    expect(s).toEqual([`/api/world/player-image/${world}`]);
  });

  it("優先3: 通常画像がなくモバイル画像だけある → mobile variant", () => {
    const s = resolveCardImageSources({
      worldCardId: world,
      efhubCardId: null,
      hasEfhubLink: false,
      hasWorldImage: false,
      hasWorldMobileImage: true,
    });
    expect(s).toEqual([`/api/world/player-image/${world}?variant=mobile`]);
  });

  it("優先4: 画像がまったく無ければ空配列（→ プレースホルダー）", () => {
    const s = resolveCardImageSources({
      worldCardId: world,
      efhubCardId: null,
      hasEfhubLink: false,
      hasWorldImage: false,
      hasWorldMobileImage: false,
    });
    expect(s).toEqual([]);
  });

  it("eFHUB リンクありでも ID が不正なら eFHUB プロキシは入れない", () => {
    const s = resolveCardImageSources({
      worldCardId: world,
      efhubCardId: "bad-id",
      hasEfhubLink: true,
      hasWorldImage: true,
      hasWorldMobileImage: false,
    });
    expect(s).toEqual([`/api/world/player-image/${world}`]);
  });

  it("worldCardId が不正なら World プロキシは入れない", () => {
    const s = resolveCardImageSources({
      worldCardId: "abc",
      efhubCardId: null,
      hasEfhubLink: false,
      hasWorldImage: true,
      hasWorldMobileImage: true,
    });
    expect(s).toEqual([]);
  });
});
