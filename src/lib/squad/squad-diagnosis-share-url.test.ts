import { describe, it, expect } from "vitest";
import {
  SHARE_CATEGORY_IDS,
  SHARE_MAX_TOKEN_LENGTH,
  buildSharePayload,
  buildShareUrl,
  decodeShareToken,
  encodeSharePayload,
  fnv1a32,
  isCurrentRulesVersion,
  type SquadDiagnosisSharePayloadV1,
} from "./squad-diagnosis-share-url";
import { SQUAD_DIAGNOSIS_RULES_VERSION, determineDiagnosisGrade, type SquadDiagnosisResult } from "./squad-diagnosis";

function result(over: Partial<SquadDiagnosisResult> = {}): SquadDiagnosisResult {
  const cats = SHARE_CATEGORY_IDS.map((id, i) => {
    const score = 40 + i * 7;
    return { id, label: id, score, tier: determineDiagnosisGrade(score), visibility: "free", sampleSize: 11, note: "", evidence: [] };
  });
  return {
    rulesVersion: SQUAD_DIAGNOSIS_RULES_VERSION,
    squadId: "squad-internal-123456789",
    squadName: "My Squad",
    overall: { score: 71, tier: "A", note: "" },
    categories: [...cats, { id: "squadCompleteness", label: "完成度", score: 90, tier: "S", visibility: "free", sampleSize: 11, note: "", evidence: [] }],
    strengths: [{ id: "s", kind: "ability", categoryId: "counterAttack", label: "カウンター", detail: "…" }],
    weaknesses: [{ id: "w", kind: "compatibility", categoryId: null, label: "Lionel Messiの配置適性", detail: "worldCardId 89138556575063" }],
    suggestions: [],
    dataQuality: {} as SquadDiagnosisResult["dataQuality"],
    disclaimer: "",
    basicSummary: {} as SquadDiagnosisResult["basicSummary"],
    ...over,
  } as unknown as SquadDiagnosisResult;
}

const DATE = new Date(2026, 8, 27, 13, 5);
const payload = (over: Partial<SquadDiagnosisSharePayloadV1> = {}) => ({ ...buildSharePayload(result(), { date: DATE, formationLabel: "4-3-3" }), ...over });

/** 検証を通さずに値をトークンへ（改ざん・不正値のテスト用）。 */
function rawToken(value: unknown): string {
  const json = JSON.stringify(value);
  const body = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `sd1.${body}.${fnv1a32(body)}`;
}
const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("共有URLの作成と復元（正常系）", () => {
  it("往復で同じpayloadが得られる。URLは /share/diagnosis#sd1.… 形式", () => {
    const p = payload();
    const url = buildShareUrl("https://example.invalid/", p);
    expect(url).toMatch(/^https:\/\/example\.invalid\/share\/diagnosis#sd1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(decodeShareToken(new URL(url).hash)).toEqual({ ok: true, payload: p });
  });

  it("選手名・内部ID・スカッドID・スカッド名・文章を含めない（種別とカテゴリIDだけ）", () => {
    const p = payload() as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(["c", "d", "f", "k", "o", "r", "s", "v", "w"]);
    expect(JSON.stringify(p)).not.toMatch(/Messi|89138556575063|squad-internal|My Squad|worldCardId|detail|label/);
    expect(p.w).toEqual(["compatibility", null]);
    expect(p.s).toEqual(["ability", "counterAttack"]);
    expect(p.d).toBe("2026-09-27");
  });

  it("空データ（未評価のカテゴリ・強み弱点なし）も共有できる", () => {
    const empty = result({
      overall: { score: null, tier: null, note: "" },
      categories: SHARE_CATEGORY_IDS.map((id) => ({ id, label: id, score: null, tier: null, visibility: "free", sampleSize: 0, note: "", evidence: [] })) as never,
      strengths: [],
      weaknesses: [],
    });
    const r = decodeShareToken(encodeSharePayload(buildSharePayload(empty, { date: DATE })));
    expect(r.ok && r.payload.s).toBeNull();
    expect(r.ok && r.payload.o).toEqual([null, null]);
  });

  it("最大サイズ（全カテゴリ100点・最長のフォーメーション）でも上限内。規則版が現行か判定できる", () => {
    const max = { ...payload({ f: "4-2-1-3" }), o: [100, "S"] as const, c: Object.fromEntries(SHARE_CATEGORY_IDS.map((id) => [id, [100, "S"]])) as unknown as SquadDiagnosisSharePayloadV1["c"] };
    const token = encodeSharePayload(max);
    expect(token.length).toBeLessThanOrEqual(SHARE_MAX_TOKEN_LENGTH);
    const r = decodeShareToken(token);
    expect(r.ok).toBe(true);
    expect(r.ok && isCurrentRulesVersion(r.payload)).toBe(true);
  });

  it("フォーメーションは英数字とハイフンだけを載せ、それ以外は載せない", () => {
    expect(buildSharePayload(result(), { date: DATE, formationLabel: "<b>4-3-3</b>" }).f).toBeUndefined();
    expect(buildSharePayload(result(), { date: DATE, formationLabel: "4-3-3" }).f).toBe("4-3-3");
  });
});

describe("安全でない文字列の混入を拒否（どのフィールドでも）", () => {
  const cases: [string, string][] = [
    ["script", "<script>alert(1)</script>"],
    ["HTML", "<b>bold</b>"],
    ["URL", "https://evil.example"],
    ["javascript:", "javascript:alert(1)"],
    ["email", "taro@example.com"],
    ["internal ID", "89138556575063"],
    ["secret-like", "sb_secret_abcdefgh12345"],
    ["JWT-like", "eyJhbGciOiJIUzI1NiJ9"],
    ["control", `a${String.fromCharCode(7)}b`],
    ["NUL", `a${String.fromCharCode(0)}b`],
    ["Unicode", "Müller 🦁"],
    ["Japanese", "最強の攻撃陣"],
  ];
  it.each(cases)("%s: フォーメーション・規則版・名前フィールドのいずれでも拒否", (_label, value) => {
    const p = payload() as Record<string, unknown>;
    expect(decodeShareToken(rawToken({ ...p, f: value }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, r: value }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, n: value }))).toEqual({ ok: false, reason: "invalid_payload" });
  });
});

describe("不正なURLの安全な拒否（復元）", () => {
  it("空・長すぎ・形式不正・未知の版", () => {
    expect(decodeShareToken("")).toEqual({ ok: false, reason: "empty" });
    expect(decodeShareToken("#")).toEqual({ ok: false, reason: "empty" });
    expect(decodeShareToken(`sd1.${"A".repeat(SHARE_MAX_TOKEN_LENGTH)}.00000000`)).toEqual({ ok: false, reason: "too_long" });
    expect(decodeShareToken("hello")).toEqual({ ok: false, reason: "bad_format" });
    expect(decodeShareToken("sd1.abc")).toEqual({ ok: false, reason: "bad_format" });
    expect(decodeShareToken("sd1.<script>.00000000")).toEqual({ ok: false, reason: "bad_format" });
    expect(decodeShareToken(`sd2.${"A".repeat(8)}.${fnv1a32("A".repeat(8))}`)).toEqual({ ok: false, reason: "unsupported_version" });
    expect(decodeShareToken(rawToken({ ...payload(), v: 2 }))).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("改ざん（本文だけ変更）はchecksumで、checksumも合わせた改ざんは整合性検証で拒否", () => {
    const token = encodeSharePayload(payload());
    const [pre, body, sum] = token.split(".");
    const flipped = body.slice(0, -2) + (body.at(-2) === "A" ? "B" : "A") + body.at(-1);
    expect(decodeShareToken(`${pre}.${flipped}.${sum}`)).toEqual({ ok: false, reason: "checksum_mismatch" });
    expect(decodeShareToken(rawToken({ ...payload(), o: [99, "D"] }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...payload(), o: [101, "S"] }))).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("欠損field・unknown field・型違い・範囲外", () => {
    const p = payload() as Record<string, unknown>;
    const { s: _s, ...missingS } = p;
    expect(decodeShareToken(rawToken(missingS))).toEqual({ ok: false, reason: "invalid_payload" });
    const { c: _c, ...missingC } = p;
    expect(decodeShareToken(rawToken(missingC))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, extra: 1 }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, c: { ...(p.c as object), bogus: [1, "D"] } }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, d: "2026-13-01" }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, s: ["ability", "squadCompleteness"] }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken({ ...p, w: ["compatibility", "attack"] }))).toEqual({ ok: false, reason: "invalid_payload" });
    expect(decodeShareToken(rawToken([1, 2]))).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("user/auth data・内部ID・email・Secret風のfieldを拒否", () => {
    const p = payload() as Record<string, unknown>;
    for (const extra of [
      { userId: "u1" }, { profileId: "p" }, { accountId: "a" }, { email: "a@b.c" }, { password: "x" }, { token: "eyJabc" }, { secret: "s" },
      { batchId: "b" }, { managerId: 65 }, { worldCardId: "89138556575063" }, { objectKey: "pre-apply/x.age" }, { session: {} }, { publicId: "x" },
    ]) {
      expect(decodeShareToken(rawToken({ ...p, ...extra }))).toEqual({ ok: false, reason: "invalid_payload" });
    }
  });

  it("壊れた符号化・JSONでない本文・上限超過", () => {
    const bad = "____";
    expect(decodeShareToken(`sd1.${bad}.${fnv1a32(bad)}`).ok).toBe(false);
    const notJson = b64url("not json");
    expect(decodeShareToken(`sd1.${notJson}.${fnv1a32(notJson)}`)).toEqual({ ok: false, reason: "bad_json" });
    const invalidUtf8 = b64url(String.fromCharCode(0xff, 0xfe, 0xfd));
    expect(decodeShareToken(`sd1.${invalidUtf8}.${fnv1a32(invalidUtf8)}`)).toEqual({ ok: false, reason: "bad_encoding" });
    expect(decodeShareToken(rawToken({ ...payload(), pad: "x".repeat(1100) })).ok).toBe(false);
    expect(() => encodeSharePayload({ ...payload(), f: "x".repeat(2000) })).toThrow("share_payload_too_large");
  });

  it("古い規則版のpayloadは復元できるが、現行版ではないと判定される", () => {
    const r = decodeShareToken(rawToken({ ...payload(), r: "squad-diagnosis/2026-01-01.v0" }));
    expect(r.ok).toBe(true);
    expect(r.ok && isCurrentRulesVersion(r.payload)).toBe(false);
  });
});
