import { describe, it, expect } from "vitest";
import { canChangePublicId, deobfuscate, normalizePublicId, validateDisplayName, validatePublicId } from "./public-id";

const problem = (s: string) => {
  const r = validatePublicId(s);
  return r.ok ? "ok" : r.problem;
};

describe("公開 ID の規則", () => {
  it("NFKC・前後の空白・大文字を正規化する（全角・大文字は同じ ID）", () => {
    expect(normalizePublicId("  Ｔａｒｏ_01 ")).toBe("taro_01");
    expect(validatePublicId("Taro_01")).toEqual({ ok: true, normalized: "taro_01" });
  });

  it("形式: 3〜20 文字・英小文字で始まる・英数字と _ だけ・_ の連続と末尾を拒否", () => {
    expect(problem("")).toBe("empty");
    expect(problem("ab")).toBe("too_short");
    expect(problem("a".repeat(21))).toBe("too_long");
    expect(problem("a".repeat(20))).toBe("ok");
    expect(problem("1abc")).toBe("must_start_with_letter");
    expect(problem("_abc")).toBe("must_start_with_letter");
    expect(problem("ab-c")).toBe("invalid_chars");
    expect(problem("たろう")).toBe("invalid_chars");
    expect(problem("ab c")).toBe("invalid_chars");
    expect(problem("abc_")).toBe("edge_underscore");
    expect(problem("ab__c")).toBe("consecutive_underscores");
  });

  it("予約語は完全一致で拒否し、含むだけなら使える", () => {
    for (const r of ["admin", "api", "settings", "squads", "null", "Login"]) expect(problem(r)).not.toBe("ok");
    expect(problem("squads")).toBe("reserved");
    expect(problem("my_squads_fan")).toBe("ok");
  });

  it("なりすまし・不適切な語は置き換えを戻した部分一致で拒否する", () => {
    expect(deobfuscate("adm1n_01")).toBe("adminoi");
    for (const s of ["konami_jp", "efootball_official", "adm1n_taro", "team_ai_staff", "x_0fficial", "k0nami"]) expect(problem(s), s).toBe("banned");
    expect(problem("taro_77")).toBe("ok");
  });

  it("メールアドレス・電話番号らしい並び・URL を拒否する", () => {
    expect(problem("taro@example.com")).toBe("personal_info");
    expect(problem("a09012345678")).toBe("personal_info");
    expect(problem("www.example")).toBe("personal_info");
    expect(problem("player123456")).toBe("ok");
  });

  it("変更は 30 日に 1 回。初回は変更でき、読めない日時では変更させない", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    expect(canChangePublicId(null, now)).toEqual({ ok: true });
    expect(canChangePublicId("2026-09-01T00:00:00Z", now)).toEqual({ ok: true });
    expect(canChangePublicId("2026-09-20T00:00:00Z", now)).toEqual({ ok: false, nextAt: "2026-10-20T00:00:00.000Z" });
    expect(canChangePublicId("garbage", now)).toEqual({ ok: false, nextAt: "" });
  });
});

describe("表示名の規則", () => {
  it("かな・漢字を使え、前後の空白と連続空白を整える", () => {
    expect(validateDisplayName("  たろう  FC ")).toEqual({ ok: true, normalized: "たろう FC" });
  });
  it("空・21 文字以上・制御文字や方向を変える文字・なりすまし・連絡先を拒否する", () => {
    expect(validateDisplayName(" ")).toEqual({ ok: false, problem: "empty" });
    expect(validateDisplayName("あ".repeat(21))).toEqual({ ok: false, problem: "too_long" });
    expect(validateDisplayName("ab‮cd")).toEqual({ ok: false, problem: "control_chars" });
    expect(validateDisplayName("Team AI 公式")).toEqual({ ok: false, problem: "banned" });
    expect(validateDisplayName("KONAMI")).toEqual({ ok: false, problem: "banned" });
    expect(validateDisplayName("連絡 090-1234-5678")).toEqual({ ok: false, problem: "personal_info" });
  });
});
