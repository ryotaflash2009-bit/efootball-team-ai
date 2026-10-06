import { describe, expect, it } from "vitest";
import {
  LOCALES,
  isSelectableLocale,
  localeInfo,
  negotiateDisplayLocale,
  parseLanguageTag,
  readStoredDisplayLocale,
  resolveLanguageTag,
  selectableLocales,
} from "./locale-registry";

const prod = { internalPreview: false };
const internal = { internalPreview: true };

describe("表示言語の契約: 一覧", () => {
  it("候補の 18 言語と疑似 2 つを、BCP 47 の正式な表記・自身の言語の名前で持つ（国旗は使わない）", () => {
    const codes = LOCALES.map((l) => l.code);
    expect(codes).toEqual(["ja", "en", "es", "pt-BR", "fr", "de", "it", "ko", "zh-CN", "zh-TW", "id", "tr", "ar", "th", "vi", "nl", "pl", "ru", "en-XA", "ar-XB"]);
    expect(new Set(codes).size).toBe(codes.length);
    for (const l of LOCALES) {
      expect(l.nativeName.length).toBeGreaterThan(0);
      expect(l.nativeName).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u); // 国旗の絵文字なし
      expect(() => new Intl.NumberFormat(l.intl)).not.toThrow();
    }
    expect(localeInfo("ar").dir).toBe("rtl");
    expect(localeInfo("ar-XB").dir).toBe("rtl");
    expect(localeInfo("ko").dir).toBe("ltr");
  });

  it("日本語以外の言語の基本の言語は English（日本語を世界向けの最後の代わりにしない）", () => {
    for (const l of LOCALES) expect(l.base).toBe(l.code === "ja" ? "ja" : "en");
  });

  it("Production で選べるのは PUBLISHED（日本語・English）だけ。確認中・疑似は内部の確認だけ", () => {
    expect(selectableLocales(prod).map((l) => l.code)).toEqual(["ja", "en"]);
    expect(isSelectableLocale("es", prod)).toBe(false);
    expect(isSelectableLocale("en-XA", prod)).toBe(false);
    expect(isSelectableLocale("es", internal)).toBe(true);
    expect(isSelectableLocale("ar-XB", internal)).toBe(true);
    for (const l of LOCALES) if (l.state === "PUBLISHED") expect(["ja", "en"]).toContain(l.code);
  });
});

describe("表示言語の契約: 言語タグの解決", () => {
  it("大文字・小文字・_ を正規化し、言語-文字-地域を読む", () => {
    expect(parseLanguageTag("zh_hant_tw")).toEqual({ language: "zh", script: "Hant", region: "TW" });
    expect(parseLanguageTag("EN-gb")).toEqual({ language: "en", script: null, region: "GB" });
    expect(parseLanguageTag("es-419")).toEqual({ language: "es", script: null, region: "419" });
    for (const bad of ["", "e", "english!", "12-34", null, 42, "a".repeat(40)]) expect(parseLanguageTag(bad)).toBeNull();
  });

  it("完全一致 → 同じ言語の対応する形。en-US / en-GB → en、es-ES / es-MX → es、pt / pt-PT → pt-BR", () => {
    expect(resolveLanguageTag("ja-JP")).toBe("ja");
    expect(resolveLanguageTag("en-US")).toBe("en");
    expect(resolveLanguageTag("en-GB")).toBe("en");
    expect(resolveLanguageTag("es-ES")).toBe("es");
    expect(resolveLanguageTag("es-MX")).toBe("es");
    expect(resolveLanguageTag("PT-br")).toBe("pt-BR");
    expect(resolveLanguageTag("pt")).toBe("pt-BR");
    expect(resolveLanguageTag("pt-PT")).toBe("pt-BR");
    expect(resolveLanguageTag("de-AT")).toBe("de");
    expect(resolveLanguageTag("in")).toBe("id"); // 古いコード
  });

  it("中国語は文字・地域で簡体字・繁体字を分け、zh だけの曖昧なタグは解決しない", () => {
    expect(resolveLanguageTag("zh-CN")).toBe("zh-CN");
    expect(resolveLanguageTag("zh-SG")).toBe("zh-CN");
    expect(resolveLanguageTag("zh-Hans")).toBe("zh-CN");
    expect(resolveLanguageTag("zh-TW")).toBe("zh-TW");
    expect(resolveLanguageTag("zh-HK")).toBe("zh-TW");
    expect(resolveLanguageTag("zh-Hant-HK")).toBe("zh-TW");
    expect(resolveLanguageTag("zh")).toBeNull();
  });

  it("疑似ロケールは完全一致だけ。未対応・不正な言語は null", () => {
    expect(resolveLanguageTag("en-XA")).toBe("en-XA");
    expect(resolveLanguageTag("en-xa")).toBe("en-XA");
    expect(resolveLanguageTag("sv-SE")).toBeNull();
    expect(resolveLanguageTag("he")).toBeNull();
    expect(resolveLanguageTag("<script>")).toBeNull();
  });
});

describe("表示言語の契約: 初期の言語と保存値", () => {
  it("Production: ブラウザーの言語の優先の順に、選べる言語（ja・en）から決める。どれも無ければ English", () => {
    expect(negotiateDisplayLocale(["ja-JP", "en-US"], prod)).toBe("ja");
    expect(negotiateDisplayLocale(["en-GB", "ja"], prod)).toBe("en");
    expect(negotiateDisplayLocale(["es-ES", "ja-JP"], prod)).toBe("ja"); // es はまだ選べない → 次の候補
    expect(negotiateDisplayLocale(["es-ES"], prod)).toBe("en");
    expect(negotiateDisplayLocale(["zh"], prod)).toBe("en");
    expect(negotiateDisplayLocale([], prod)).toBe("en");
    expect(negotiateDisplayLocale([null, undefined, "x"], prod)).toBe("en");
  });

  it("内部の確認: 確認中の言語も選ばれる（疑似ロケールは明示の選択だけ）", () => {
    expect(negotiateDisplayLocale(["es-ES"], internal)).toBe("es");
    expect(negotiateDisplayLocale(["zh-Hant-TW"], internal)).toBe("zh-TW");
    expect(negotiateDisplayLocale(["en-XA"], internal)).toBe("en-XA");
  });

  it("保存値: 選べる言語の正式な表記だけ。古い値（ja / en）はそのまま。不正・壊れた値は null", () => {
    expect(readStoredDisplayLocale("en", prod)).toBe("en");
    expect(readStoredDisplayLocale("ja", prod)).toBe("ja");
    expect(readStoredDisplayLocale("es", prod)).toBeNull();
    expect(readStoredDisplayLocale("es", internal)).toBe("es");
    expect(readStoredDisplayLocale("PT-BR", internal)).toBe("pt-BR");
    for (const bad of ["", "xx", "{}", null, 1, '"en"']) expect(readStoredDisplayLocale(bad, internal)).toBeNull();
  });
});
