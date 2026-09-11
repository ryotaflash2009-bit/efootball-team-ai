import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  detectLocaleFromBrowserLanguage,
  normalizeLocale,
} from "./locale";

describe("対応言語の定義", () => {
  it("ja/enの2言語のみ対応する", () => {
    expect(SUPPORTED_LOCALES).toEqual(["ja", "en"]);
  });
  it("既定言語はja（既存の日本語表示を維持）", () => {
    expect(DEFAULT_LOCALE).toBe("ja");
  });
  it("localStorageキーは保存スカッド・保存ビルドと異なる専用キーである", () => {
    expect(LOCALE_STORAGE_KEY).not.toMatch(/squad|build|my-team|favorites/i);
    expect(LOCALE_STORAGE_KEY).toContain("locale");
  });
});

describe("isSupportedLocale", () => {
  it("ja/enはtrue", () => {
    expect(isSupportedLocale("ja")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
  });
  it("不正・未対応の値はfalse", () => {
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale("JA")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(123)).toBe(false);
    expect(isSupportedLocale({})).toBe(false);
  });
});

describe("detectLocaleFromBrowserLanguage: 決定的な初期言語判定", () => {
  it("ja / ja-JP はja", () => {
    expect(detectLocaleFromBrowserLanguage("ja")).toBe("ja");
    expect(detectLocaleFromBrowserLanguage("ja-JP")).toBe("ja");
  });
  it("大文字小文字を無視する", () => {
    expect(detectLocaleFromBrowserLanguage("JA-jp")).toBe("ja");
  });
  it("en / en-US はen", () => {
    expect(detectLocaleFromBrowserLanguage("en")).toBe("en");
    expect(detectLocaleFromBrowserLanguage("en-US")).toBe("en");
  });
  it("未対応言語（fr, de, zh 等）は推測でjaに寄せず、enへフォールバックする", () => {
    expect(detectLocaleFromBrowserLanguage("fr")).toBe("en");
    expect(detectLocaleFromBrowserLanguage("de-DE")).toBe("en");
    expect(detectLocaleFromBrowserLanguage("zh-CN")).toBe("en");
  });
  it("null/undefined/空文字は既定言語（ja）", () => {
    expect(detectLocaleFromBrowserLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(detectLocaleFromBrowserLanguage(undefined)).toBe(DEFAULT_LOCALE);
    expect(detectLocaleFromBrowserLanguage("")).toBe(DEFAULT_LOCALE);
  });
  it("同一入力から常に同一結果を返す（決定的）", () => {
    const a = detectLocaleFromBrowserLanguage("ja-JP");
    const b = detectLocaleFromBrowserLanguage("ja-JP");
    expect(a).toBe(b);
  });
});

describe("normalizeLocale: 不正値の安全なフォールバック", () => {
  it("正当な値はそのまま返す", () => {
    expect(normalizeLocale("ja")).toBe("ja");
    expect(normalizeLocale("en")).toBe("en");
  });
  it("不正値・破損したlocalStorage値は既定言語へフォールバックする", () => {
    expect(normalizeLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale("")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(42)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale({ malicious: true })).toBe(DEFAULT_LOCALE);
  });
});
