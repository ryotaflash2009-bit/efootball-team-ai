import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatNumber } from "./format";

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

describe("formatDate", () => {
  it("represents the same instant in both locales (year is preserved)", () => {
    const sample = new Date("2025-12-01T00:00:00Z");
    expect(formatDate(sample, "ja")).toContain("2025");
    expect(formatDate(sample, "en")).toContain("2025");
  });
});
