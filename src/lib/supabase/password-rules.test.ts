import { describe, it, expect } from "vitest";
import { validatePasswordRules, isPasswordValid, isValidEmailFormat, PASSWORD_MIN_LENGTH } from "./password-rules";

describe("validatePasswordRules", () => {
  it("12文字未満はTOO_SHORTを含む", () => {
    expect(validatePasswordRules("Aa1!aaa")).toContain("TOO_SHORT");
  });

  it("小文字が無い場合はMISSING_LOWERCASEを含む", () => {
    expect(validatePasswordRules("AAAAAAAAAA1!")).toContain("MISSING_LOWERCASE");
  });

  it("大文字が無い場合はMISSING_UPPERCASEを含む", () => {
    expect(validatePasswordRules("aaaaaaaaaa1!")).toContain("MISSING_UPPERCASE");
  });

  it("数字が無い場合はMISSING_DIGITを含む", () => {
    expect(validatePasswordRules("Aaaaaaaaaaa!")).toContain("MISSING_DIGIT");
  });

  it("記号が無い場合はMISSING_SYMBOLを含む", () => {
    expect(validatePasswordRules("Aaaaaaaaaa11")).toContain("MISSING_SYMBOL");
  });

  it(`${PASSWORD_MIN_LENGTH}文字以上・4種類すべて含む場合は合格(空配列)`, () => {
    expect(validatePasswordRules("Aa1!Aa1!Aa1!")).toEqual([]);
  });

  it("失敗理由に入力したパスワードの値そのものは含まれない", () => {
    const failures = validatePasswordRules("short");
    for (const f of failures) {
      expect(typeof f).toBe("string");
      expect(f).not.toContain("short");
    }
  });
});

describe("isPasswordValid", () => {
  it("ルールを満たさない場合はfalse", () => {
    expect(isPasswordValid("weak")).toBe(false);
  });

  it("ルールを満たす場合はtrue", () => {
    expect(isPasswordValid("Aa1!Aa1!Aa1!")).toBe(true);
  });
});

describe("isValidEmailFormat", () => {
  it("空文字は無効", () => {
    expect(isValidEmailFormat("")).toBe(false);
  });

  it("@が無い文字列は無効", () => {
    expect(isValidEmailFormat("not-an-email")).toBe(false);
  });

  it("ドメイン部にドットが無い場合は無効", () => {
    expect(isValidEmailFormat("user@localhost")).toBe(false);
  });

  it("空白を含む場合は無効", () => {
    expect(isValidEmailFormat("user name@example.com")).toBe(false);
  });

  it("254文字を超える場合は無効", () => {
    const longLocal = "a".repeat(250);
    expect(isValidEmailFormat(`${longLocal}@example.com`)).toBe(false);
  });

  it("一般的な形式のメールアドレスは有効", () => {
    expect(isValidEmailFormat("user@example.com")).toBe(true);
  });
});
