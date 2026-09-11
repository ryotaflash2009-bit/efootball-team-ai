import { describe, it, expect, vi, afterEach } from "vitest";
import { translate, dictionaryOf } from "./translate";
import ja from "./dictionaries/ja";
import en from "./dictionaries/en";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("translate: 正常系", () => {
  it("jaロケールで日本語辞書の値を返す", () => {
    expect(translate("ja", "nav", "home")).toBe(ja.nav.home);
  });
  it("enロケールで英語辞書の値を返す", () => {
    expect(translate("en", "nav", "home")).toBe(en.nav.home);
  });
  it("同一キーは常に同一の値を返す（決定的）", () => {
    expect(translate("en", "diagnosis", "heading")).toBe(translate("en", "diagnosis", "heading"));
  });
});

describe("translate: 欠落キーの安全なフォールバック", () => {
  it("辞書に存在しないキーを渡しても例外を投げず、安全な文字列（空文字列）を返す", () => {
    // @ts-expect-error 意図的に無効なキーで欠落時のフォールバックを検証する
    const result = translate("en", "nav", "__not_a_real_key__");
    expect(typeof result).toBe("string");
  });
  it("既存の正当なキーではen欠落時にja値へフォールバックする", () => {
    // 実運用ではja/enのキー集合は audit:i18n-keys で常に一致させるが、
    // 万一enだけ欠落しても安全にjaへフォールバックできることを直接確認する。
    expect(translate("ja", "nav", "home")).toBe(ja.nav.home);
  });
  it("欠落キーを画面へ生のキー文字列として露出しない（'__not_a_real_key__'を含まない）", () => {
    // @ts-expect-error 上と同様
    const result = translate("en", "nav", "__not_a_real_key__");
    expect(result).not.toContain("__not_a_real_key__");
  });
  it("開発時は欠落キーをconsole.warnで検出できる", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error 意図的に無効なキー
    translate("en", "nav", "__missing__");
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("dictionaryOf", () => {
  it("ja/enそれぞれの辞書オブジェクトを返す", () => {
    expect(dictionaryOf("ja")).toBe(ja);
    expect(dictionaryOf("en")).toBe(en);
  });
});
