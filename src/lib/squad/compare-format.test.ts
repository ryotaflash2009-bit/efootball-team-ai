import { describe, it, expect } from "vitest";
import { roundTo, fmt, fmtInt, fmtDiff, diffValue, diffSide, finiteOrNull } from "./compare-format";

describe("compare-format", () => {
  it("finiteOrNull は NaN / Infinity / 非数値を弾く", () => {
    expect(finiteOrNull(3.2)).toBe(3.2);
    expect(finiteOrNull(NaN)).toBeNull();
    expect(finiteOrNull(Infinity)).toBeNull();
    expect(finiteOrNull("x")).toBeNull();
    expect(finiteOrNull(null)).toBeNull();
  });

  it("roundTo は小数第1位・-0 を 0 に正規化", () => {
    expect(roundTo(82.44)).toBe(82.4);
    expect(roundTo(-0.02)).toBe(0);
    expect(Object.is(roundTo(-0.02), -0)).toBe(false);
    expect(roundTo(NaN)).toBeNull();
  });

  it("fmt / fmtInt は欠損を dash", () => {
    expect(fmt(82.44)).toBe("82.4");
    expect(fmt(null)).toBe("—");
    expect(fmtInt(90.6)).toBe("91");
    expect(fmtInt(null)).toBe("—");
  });

  it("fmtDiff は符号付き・0 は 0.0・欠損は dash", () => {
    expect(fmtDiff(82.4, 78.8)).toBe("+3.6");
    expect(fmtDiff(78.8, 82.4)).toBe("-3.6");
    expect(fmtDiff(80, 80)).toBe("0.0");
    expect(fmtDiff(null, 80)).toBe("—");
  });

  it("diffValue と diffSide", () => {
    expect(diffValue(5, 3)).toBe(2);
    expect(diffValue(5, null)).toBeNull();
    expect(diffSide(5, 3)).toBe("a");
    expect(diffSide(3, 5)).toBe("b");
    expect(diffSide(5, 5)).toBe("equal");
    expect(diffSide(5, null)).toBe("na");
  });
});
