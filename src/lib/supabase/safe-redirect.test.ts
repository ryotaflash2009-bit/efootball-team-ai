import { describe, it, expect } from "vitest";
import { resolveSafeInternalPath } from "./safe-redirect";

describe("resolveSafeInternalPath", () => {
  it("通常の内部パスはそのまま返す", () => {
    expect(resolveSafeInternalPath("/account")).toBe("/account");
    expect(resolveSafeInternalPath("/my-team")).toBe("/my-team");
    expect(resolveSafeInternalPath("/players?q=abc")).toBe("/players?q=abc");
  });

  it("nullやundefinedは既定値へフォールバックする", () => {
    expect(resolveSafeInternalPath(null)).toBe("/account");
    expect(resolveSafeInternalPath(undefined)).toBe("/account");
  });

  it("空文字は既定値へフォールバックする", () => {
    expect(resolveSafeInternalPath("")).toBe("/account");
  });

  it("外部の絶対URL(https)は拒否して既定値を返す", () => {
    expect(resolveSafeInternalPath("https://evil.example.com")).toBe("/account");
  });

  it("プロトコル相対URL(//)は拒否して既定値を返す", () => {
    expect(resolveSafeInternalPath("//evil.example.com")).toBe("/account");
  });

  it("javascript:スキームは拒否して既定値を返す", () => {
    expect(resolveSafeInternalPath("javascript:alert(1)")).toBe("/account");
  });

  it("先頭が/でない相対パスは拒否して既定値を返す", () => {
    expect(resolveSafeInternalPath("evil.example.com")).toBe("/account");
  });

  it("空白混入は拒否して既定値を返す", () => {
    expect(resolveSafeInternalPath("/account \n")).toBe("/account");
  });

  it("バックスラッシュを使った回避策(/\\)は拒否して既定値を返す", () => {
    expect(resolveSafeInternalPath("/\\evil.example.com")).toBe("/account");
  });

  it("呼び出し側指定のfallbackを使える", () => {
    expect(resolveSafeInternalPath("https://evil.example.com", "/auth/sign-in")).toBe("/auth/sign-in");
  });
});
