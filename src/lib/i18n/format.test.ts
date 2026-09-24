import { describe, it, expect } from "vitest";
import { DISPLAY_TIME_ZONE, formatDate, formatDateTime, formatNumber } from "./format";

describe("formatNumber", () => {
  it("formats the same underlying value in both locales (only separators may differ)", () => {
    const ja = formatNumber(13009, "ja");
    const en = formatNumber(13009, "en");
    expect(ja.replace(/[,，]/g, "")).toBe("13009");
    expect(en.replace(/,/g, "")).toBe("13009");
  });

  it("does not change the numeric magnitude across locales", () => {
    expect(Number(formatNumber(66, "ja").replace(/[^0-9]/g, ""))).toBe(66);
    expect(Number(formatNumber(66, "en").replace(/[^0-9]/g, ""))).toBe(66);
  });
});

describe("formatDateTime", () => {
  const sample = new Date("2026-01-15T09:30:00Z");

  it("renders a non-empty, locale-appropriate string for both locales", () => {
    const ja = formatDateTime(sample, "ja");
    const en = formatDateTime(sample, "en");
    expect(ja.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });

  it("represents the same instant in both locales (year is preserved)", () => {
    expect(formatDateTime(sample, "ja")).toContain("2026");
    expect(formatDateTime(sample, "en")).toContain("2026");
  });
});

describe("表示用の時間帯は固定(日本時間)で、時間帯名を付ける(hydration不一致の防止)", () => {
  it("UTCの2026-08-27 22:59は日本時間の2026年8月28日 07:59として表示し、時間帯名(JST)を含む", () => {
    const d = new Date("2026-08-27T22:59:00Z");
    const ja = formatDateTime(d, "ja");
    expect(ja).toContain("2026年8月28日");
    expect(ja).toContain("07:59");
    expect(ja).toMatch(/JST/);
    expect(formatDateTime(d, "en")).toMatch(/August 28, 2026.*07:59.*(JST|GMT\+9)/);
    expect(formatDate(d, "ja")).toBe("2026年8月28日");
  });

  it("実行環境(サーバー)の時間帯を変えても同じ文字列になる", () => {
    const d = new Date("2026-09-24T10:31:18.602Z");
    const expected = formatDateTime(d, "ja");
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        expect(formatDateTime(d, "ja"), tz).toBe(expected);
      }
    } finally {
      process.env.TZ = original;
    }
    expect(DISPLAY_TIME_ZONE).toBe("Asia/Tokyo");
  });
});

describe("formatDate", () => {
  it("represents the same instant in both locales (year is preserved)", () => {
    const sample = new Date("2025-12-01T00:00:00Z");
    expect(formatDate(sample, "ja")).toContain("2025");
    expect(formatDate(sample, "en")).toContain("2025");
  });
});
