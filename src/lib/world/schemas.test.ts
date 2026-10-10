import { describe, it, expect } from "vitest";
import {
  parseWorldListQuery,
  normalizeQuery,
  worldCardIdSchema,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_QUERY_LEN,
} from "./schemas";

describe("normalizeQuery", () => {
  it("前後空白の除去・連続空白の正規化・全角スペースの変換", () => {
    expect(normalizeQuery("  Lionel　　Messi  ")).toBe("Lionel Messi");
  });
  it("最大長で切り詰める", () => {
    expect(normalizeQuery("a".repeat(300))).toHaveLength(MAX_QUERY_LEN);
  });
});

describe("parseWorldListQuery: pageSize", () => {
  it("既定は 24", () => {
    expect(parseWorldListQuery({}).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
  it("100 を超える指定は 100 に丸める", () => {
    expect(parseWorldListQuery({ pageSize: "5000" }).pageSize).toBe(MAX_PAGE_SIZE);
  });
  it("不正な pageSize は既定値", () => {
    expect(parseWorldListQuery({ pageSize: "abc" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseWorldListQuery({ pageSize: "-3" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("parseWorldListQuery: page", () => {
  it("1 未満・非数値は 1", () => {
    expect(parseWorldListQuery({ page: "0" }).page).toBe(1);
    expect(parseWorldListQuery({ page: "-5" }).page).toBe(1);
    expect(parseWorldListQuery({ page: "x" }).page).toBe(1);
  });
  it("整数へ丸める", () => {
    expect(parseWorldListQuery({ page: "3.9" }).page).toBe(3);
  });
});

describe("parseWorldListQuery: sort 許可リスト", () => {
  it("既知の値はそのまま", () => {
    expect(parseWorldListQuery({ sort: "name" }).sort).toBe("name");
    expect(parseWorldListQuery({ sort: "ovr_base_asc" }).sort).toBe("ovr_base_asc");
  });
  it("未知の値は ovr_max_desc へフォールバック", () => {
    expect(parseWorldListQuery({ sort: "DROP TABLE" }).sort).toBe("ovr_max_desc");
    expect(parseWorldListQuery({ sort: "price; --" }).sort).toBe("ovr_max_desc");
  });
});

describe("parseWorldListQuery: フィルタトークン検証", () => {
  it("正常なポジション/タイプは通す", () => {
    const q = parseWorldListQuery({ position: "GK", cardType: "EPIC" });
    expect(q.position).toBe("GK");
    expect(q.cardType).toBe("EPIC");
  });
  it("スペースやハイフンを含むプレースタイルは通す", () => {
    expect(parseWorldListQuery({ playingStyle: "Box-to-Box" }).playingStyle).toBe("Box-to-Box");
    expect(parseWorldListQuery({ playingStyle: "Deep-lying Forward" }).playingStyle).toBe("Deep-lying Forward");
  });
  it("SQL インジェクション風の文字列は null に落とす", () => {
    expect(parseWorldListQuery({ position: "GK' OR '1'='1" }).position).toBeNull();
    expect(parseWorldListQuery({ cardType: "x); DROP TABLE world_player_cards;--" }).cardType).toBeNull();
    expect(parseWorldListQuery({ playingStyle: "a".repeat(80) }).playingStyle).toBeNull();
  });
});

describe("parseWorldListQuery: OVR 範囲", () => {
  it("min > max なら入れ替える", () => {
    const q = parseWorldListQuery({ minOvr: "100", maxOvr: "80" });
    expect(q.minOvr).toBe(80);
    expect(q.maxOvr).toBe(100);
  });
  it("範囲外・非数値は null", () => {
    expect(parseWorldListQuery({ minOvr: "0" }).minOvr).toBeNull();
    expect(parseWorldListQuery({ maxOvr: "999" }).maxOvr).toBeNull();
    expect(parseWorldListQuery({ minOvr: "abc" }).minOvr).toBeNull();
  });
});

describe("parseWorldListQuery: hasBooster", () => {
  it("1/true → true, 0/false → false, それ以外 → null", () => {
    expect(parseWorldListQuery({ hasBooster: "1" }).hasBooster).toBe(true);
    expect(parseWorldListQuery({ hasBooster: "false" }).hasBooster).toBe(false);
    expect(parseWorldListQuery({ hasBooster: "maybe" }).hasBooster).toBeNull();
  });
});

describe("worldCardIdSchema", () => {
  it("数字のみを許可", () => {
    expect(worldCardIdSchema.safeParse("89138556575063").success).toBe(true);
  });
  it("英字・記号・空を拒否", () => {
    expect(worldCardIdSchema.safeParse("abc").success).toBe(false);
    expect(worldCardIdSchema.safeParse("1; DROP").success).toBe(false);
    expect(worldCardIdSchema.safeParse("").success).toBe(false);
    expect(worldCardIdSchema.safeParse("../../etc").success).toBe(false);
  });
});

describe("parseWorldListQuery: 国籍（2026-10-11 F-001a）", () => {
  it("World の表記（アクセント・アポストロフィ・カンマ）のまま通す", () => {
    for (const n of ["Japan", "Côte d'Ivoire", "Hong Kong, China", "Türkiye", "Curaçao", "Bosnia and Herzegovina"]) {
      expect(parseWorldListQuery({ nationality: n }).nationality).toBe(n);
    }
  });
  it("未指定・空・記号での注入・長すぎる値は null", () => {
    expect(parseWorldListQuery({}).nationality).toBeNull();
    expect(parseWorldListQuery({ nationality: "" }).nationality).toBeNull();
    expect(parseWorldListQuery({ nationality: "Japan); DROP TABLE x;--" }).nationality).toBeNull();
    expect(parseWorldListQuery({ nationality: "a=eq.b" }).nationality).toBeNull();
    expect(parseWorldListQuery({ nationality: "x".repeat(41) }).nationality).toBeNull();
  });
});

describe("parseWorldListQuery: リーグ（2026-10-11）", () => {
  it("World の表記（数字・スラッシュ・右の引用符・アクセント）のまま通す", () => {
    for (const l of ["2026/27 MEIJI YASUDA J1 LEAGUE", "Ligue 1 McDonald’s", "Trendyol Süper Lig", "English League", "Other"]) {
      expect(parseWorldListQuery({ league: l }).league).toBe(l);
    }
  });
  it("注入・PostgREST の式・長すぎる値は null", () => {
    expect(parseWorldListQuery({ league: "x; DROP TABLE y" }).league).toBeNull();
    expect(parseWorldListQuery({ league: "a=eq.b" }).league).toBeNull();
    expect(parseWorldListQuery({ league: "L".repeat(61) }).league).toBeNull();
  });
});
