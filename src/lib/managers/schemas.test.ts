import { describe, it, expect } from "vitest";
import {
  parseManagerListQuery,
  normalizeManagerQuery,
  MANAGER_ID_RE,
  MANAGER_MAX_PAGE_SIZE,
  MANAGER_DEFAULT_PAGE_SIZE,
} from "./schemas";

describe("normalizeManagerQuery", () => {
  it("前後空白除去・連続空白正規化・全角スペース変換・長さ制限", () => {
    expect(normalizeManagerQuery("  Antonio　　Conte  ")).toBe("Antonio Conte");
    expect(normalizeManagerQuery("a".repeat(200)).length).toBe(80);
  });
});

describe("parseManagerListQuery", () => {
  it("page/pageSize の既定と丸め", () => {
    expect(parseManagerListQuery({}).pageSize).toBe(MANAGER_DEFAULT_PAGE_SIZE);
    expect(parseManagerListQuery({ pageSize: "9999" }).pageSize).toBe(MANAGER_MAX_PAGE_SIZE);
    expect(parseManagerListQuery({ page: "0" }).page).toBe(1);
    expect(parseManagerListQuery({ page: "x" }).page).toBe(1);
  });
  it("sort 許可リスト（不正はフォールバック）", () => {
    expect(parseManagerListQuery({ sort: "released_desc" }).sort).toBe("released_desc");
    expect(parseManagerListQuery({ sort: "DROP; --" }).sort).toBe("name");
  });
  it("sort: 6戦術適性すべての降順キーを受け付ける（監督選択UIの並べ替え）", () => {
    for (const k of [
      "possession_desc",
      "quick_counter_desc",
      "long_ball_counter_desc",
      "out_wide_desc",
      "long_ball_desc",
      "overload_desc",
    ] as const) {
      expect(parseManagerListQuery({ sort: k }).sort).toBe(k);
    }
  });
  it("hasBooster / hasLinkUpPlay の解釈", () => {
    expect(parseManagerListQuery({ hasBooster: "1" }).hasBooster).toBe(true);
    expect(parseManagerListQuery({ hasBooster: "0" }).hasBooster).toBe(false);
    expect(parseManagerListQuery({ hasBooster: "maybe" }).hasBooster).toBeNull();
    expect(parseManagerListQuery({ hasLinkUpPlay: "true" }).hasLinkUpPlay).toBe(true);
  });
});

describe("MANAGER_ID_RE", () => {
  it("正の整数のみ", () => {
    expect(MANAGER_ID_RE.test("42")).toBe(true);
    expect(MANAGER_ID_RE.test("abc")).toBe(false);
    expect(MANAGER_ID_RE.test("1; DROP")).toBe(false);
    expect(MANAGER_ID_RE.test("")).toBe(false);
    expect(MANAGER_ID_RE.test("-1")).toBe(false);
  });
});
