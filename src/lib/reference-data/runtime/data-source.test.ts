import { describe, it, expect } from "vitest";
import { resolveWorldDataSource, DEFAULT_WORLD_DATA_SOURCE, InvalidWorldDataSourceError } from "./data-source";

describe("resolveWorldDataSource", () => {
  it("未設定(undefined)は既定値(sqlite)を返す", () => {
    expect(resolveWorldDataSource(undefined)).toBe("sqlite");
    expect(resolveWorldDataSource(undefined)).toBe(DEFAULT_WORLD_DATA_SOURCE);
  });

  it("null は既定値(sqlite)を返す", () => {
    expect(resolveWorldDataSource(null)).toBe("sqlite");
  });

  it("空文字は既定値(sqlite)として扱う(未設定と同じ)", () => {
    expect(resolveWorldDataSource("")).toBe("sqlite");
  });

  it("前後の空白のみは既定値(sqlite)として扱う", () => {
    expect(resolveWorldDataSource("   ")).toBe("sqlite");
  });

  it('"sqlite"を返す', () => {
    expect(resolveWorldDataSource("sqlite")).toBe("sqlite");
  });

  it('"supabase"を返す', () => {
    expect(resolveWorldDataSource("supabase")).toBe("supabase");
  });

  it("前後の空白は許容してtrimする", () => {
    expect(resolveWorldDataSource("  supabase  ")).toBe("supabase");
  });

  it("大文字小文字を曖昧に処理しない(Sqlite/SUPABASEは不正値)", () => {
    expect(() => resolveWorldDataSource("Sqlite")).toThrow(InvalidWorldDataSourceError);
    expect(() => resolveWorldDataSource("SUPABASE")).toThrow(InvalidWorldDataSourceError);
  });

  it("未知の値は例外を投げる(黙って既定値へフォールバックしない)", () => {
    expect(() => resolveWorldDataSource("postgres")).toThrow(InvalidWorldDataSourceError);
    expect(() => resolveWorldDataSource("sqlite ")).not.toThrow(); // trim後は正常値
    expect(() => resolveWorldDataSource("sqllite")).toThrow(InvalidWorldDataSourceError);
  });

  it("例外メッセージに入力値そのものを含めない", () => {
    try {
      resolveWorldDataSource("some-invalid-value-with-secret-looking-text");
      expect.unreachable();
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("some-invalid-value-with-secret-looking-text");
    }
  });
});
