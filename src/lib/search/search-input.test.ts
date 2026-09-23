import { describe, it, expect } from "vitest";
import {
  MAX_RAW_SEARCH_INPUT_LENGTH,
  SEARCH_INPUT_REJECTED_CODE,
  SearchInputRejectedError,
  checkSearchInput,
  isSearchInputRejectedResponse,
  localeFromAcceptLanguage,
  searchInputRejectedBody,
} from "./search-input";

const EXACT_WORLD_PAYLOAD = "'; DROP TABLE world_player_cards;--";
const EXACT_MANAGER_PAYLOAD = "'; DROP TABLE managers; --";

describe("検索入力の境界: 正当な検索語は拒否しない", () => {
  it("SQLインジェクション風の文字列・記号・引用符・セミコロンは入力検査では拒否しない(値として安全に扱う)", () => {
    for (const q of [EXACT_WORLD_PAYLOAD, EXACT_MANAGER_PAYLOAD, "'; DROP", "TABLE world", ";", "'", '"', ";--", "@@@###%%%__", "a,b", "x.y"]) {
      expect(checkSearchInput(q), q).toEqual({ ok: true });
    }
  });

  it("アポストロフィを含む名前・Unicode・日本語・絵文字", () => {
    for (const q of ["O'Neil", "D'Alessandro", "N'Golo Kanté", "Müller", "Ødegaard", "Đorđević", "三笘 薫", "メッシ", "⚽ goal"]) expect(checkSearchInput(q), q).toEqual({ ok: true });
  });

  it("空・空白・null・タブ/改行(既存どおり空白へ正規化)は通す", () => {
    for (const q of [null, undefined, "", "   ", "　", "a\tb", "a\nb", "a\r\nb"]) expect(checkSearchInput(q)).toEqual({ ok: true });
  });

  it("長い入力は既存どおり切り詰めて検索し、異常な長さだけ拒否する", () => {
    expect(checkSearchInput("あ".repeat(500))).toEqual({ ok: true });
    expect(checkSearchInput("a".repeat(MAX_RAW_SEARCH_INPUT_LENGTH))).toEqual({ ok: true });
    expect(checkSearchInput("a".repeat(MAX_RAW_SEARCH_INPUT_LENGTH + 1))).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("検索入力の境界: 制御文字は拒否する", () => {
  it("NUL・C0制御文字・DEL・C1制御文字", () => {
    for (const ch of ["\u0000", "\u0001", "\u0008", "\u001b", "\u007f", "\u0085", "\u009f"]) {
      expect(checkSearchInput(`messi${ch}`), JSON.stringify(ch)).toEqual({ ok: false, reason: "invalid_characters" });
    }
  });
});

describe("安全なエラー契約", () => {
  it("code・reason・定型文だけを返し、SQL・filter構文・上流情報を含まない", () => {
    for (const reason of ["invalid_characters", "too_long", "rejected_by_upstream"] as const) {
      const body = searchInputRejectedBody(new SearchInputRejectedError(reason), "ja");
      expect(Object.keys(body.error).sort()).toEqual(["code", "message", "reason"]);
      expect(body.error.code).toBe(SEARCH_INPUT_REJECTED_CODE);
      expect(JSON.stringify(body)).not.toMatch(/drop|table|select|ilike|\.or|postgrest|supabase|http|stack|world_player_cards|managers/i);
    }
  });

  it("日本語UIは日本語、英語UIは英語(Accept-Language)", () => {
    expect(localeFromAcceptLanguage("ja,en-US;q=0.9")).toBe("ja");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,ja;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("ja");
    expect(localeFromAcceptLanguage("")).toBe("ja");
    expect(searchInputRejectedBody(new SearchInputRejectedError("too_long"), "ja").error.message).toMatch(/検索できません/);
    expect(searchInputRejectedBody(new SearchInputRejectedError("too_long"), "en-GB").error.message).toMatch(/cannot be used/);
  });

  it("クライアント側の判定は400と契約codeの両方を要求する", () => {
    expect(isSearchInputRejectedResponse(400, { error: { code: SEARCH_INPUT_REJECTED_CODE } })).toBe(true);
    expect(isSearchInputRejectedResponse(500, { error: { code: SEARCH_INPUT_REJECTED_CODE } })).toBe(false);
    expect(isSearchInputRejectedResponse(400, { error: { code: "OTHER" } })).toBe(false);
    expect(isSearchInputRejectedResponse(400, null)).toBe(false);
  });
});
