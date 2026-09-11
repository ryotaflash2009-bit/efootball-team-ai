import { describe, it, expect } from "vitest";
import { resolvePlayerDisplayName } from "./display-name";

describe("resolvePlayerDisplayName", () => {
  it("ja: prefers confirmed Japanese name", () => {
    expect(resolvePlayerDisplayName({ nameJa: "リオネル メッシ", nameEn: "Lionel Messi" }, "ja")).toBe("リオネル メッシ");
  });

  it("ja: falls back to English name when Japanese name is missing", () => {
    expect(resolvePlayerDisplayName({ nameJa: null, nameEn: "Lionel Messi" }, "ja")).toBe("Lionel Messi");
  });

  it("ja: falls back to caller-supplied fallback when neither name exists", () => {
    expect(resolvePlayerDisplayName({ nameJa: null, nameEn: null }, "ja", "カード 12345")).toBe("カード 12345");
  });

  it("ja: falls back to localized unknown label when nothing else exists", () => {
    expect(resolvePlayerDisplayName({ nameJa: null, nameEn: null }, "ja")).toBe("名前不明");
  });

  it("en: prefers confirmed English name", () => {
    expect(resolvePlayerDisplayName({ nameJa: "リオネル メッシ", nameEn: "Lionel Messi" }, "en")).toBe("Lionel Messi");
  });

  it("en: prefers caller-supplied fallback over the Japanese name when English name is missing", () => {
    expect(resolvePlayerDisplayName({ nameJa: "リオネル メッシ", nameEn: null }, "en", "Card 12345")).toBe("Card 12345");
  });

  it("en: falls back to the Japanese name when English name and fallback are both missing", () => {
    expect(resolvePlayerDisplayName({ nameJa: "リオネル メッシ", nameEn: null }, "en")).toBe("リオネル メッシ");
  });

  it("en: falls back to localized Unknown Player label when nothing else exists", () => {
    expect(resolvePlayerDisplayName({ nameJa: null, nameEn: null }, "en")).toBe("Unknown Player");
  });

  it("treats empty strings the same as null", () => {
    expect(resolvePlayerDisplayName({ nameJa: "", nameEn: "" }, "ja", "")).toBe("名前不明");
  });

  it("does not mutate the input object", () => {
    const names = { nameJa: "リオネル メッシ", nameEn: "Lionel Messi" };
    const snapshot = { ...names };
    resolvePlayerDisplayName(names, "en");
    expect(names).toEqual(snapshot);
  });
});
