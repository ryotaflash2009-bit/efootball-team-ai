import { describe, it, expect } from "vitest";
import { preferredFootKey } from "./use-preferred-foot";

describe("preferredFootKey", () => {
  it("World の英語の値を辞書のキーにする（大文字小文字・前後の空白は問わない）", () => {
    expect(preferredFootKey("Left foot")).toBe("footLeft");
    expect(preferredFootKey("Right foot")).toBe("footRight");
    expect(preferredFootKey("  right FOOT ")).toBe("footRight");
    expect(preferredFootKey("left")).toBe("footLeft");
  });

  it("知らない値・空は null（推測で書き換えない）", () => {
    expect(preferredFootKey("Both")).toBeNull();
    expect(preferredFootKey("")).toBeNull();
    expect(preferredFootKey(null)).toBeNull();
    expect(preferredFootKey(undefined)).toBeNull();
  });
});
