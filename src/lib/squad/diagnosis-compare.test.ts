import { describe, it, expect } from "vitest";
import { buildCompareShareUrl, compareDiagnoses, decodeCompareShare } from "./diagnosis-compare";
import { encodeSharePayload, fnv1a32, type SquadDiagnosisSharePayloadV1 } from "./squad-diagnosis-share-url";

const tierOf = (s: number): "S" | "A" | "B" | "C" | "D" => (s >= 85 ? "S" : s >= 70 ? "A" : s >= 55 ? "B" : s >= 40 ? "C" : "D");
function P(over: { o?: number | null; attack?: number | null; aerial?: number; d?: string; r?: string; w?: SquadDiagnosisSharePayloadV1["w"] } = {}): SquadDiagnosisSharePayloadV1 {
  const st = (n: number | null) => (n == null ? ([null, null] as const) : ([n, tierOf(n)] as const));
  return {
    v: 1, k: "sd", r: over.r ?? "squad-diagnosis/2026-09-06.v1", d: over.d ?? "2026-09-20", f: "4-3-3",
    o: st(over.o === undefined ? 60 : over.o),
    c: {
      attack: st(over.attack === undefined ? 50 : over.attack), defense: [47, "C"], aerial: st(over.aerial ?? 54), speed: [61, "B"],
      passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"],
    },
    s: ["ability", "counterAttack"], w: over.w ?? ["ability", "defense"],
  };
}

describe("改善前後の比較", () => {
  it("カテゴリ別に改善・悪化・変化なし・比較不可を判定し、件数を数える", () => {
    const r = compareDiagnoses({ payload: P({ o: 60, attack: 50, aerial: 54 }), at: "2026-09-20T00:00:00Z" }, { payload: P({ o: 72, attack: null, aerial: 50, d: "2026-09-27" }), at: "2026-09-27T00:00:00Z" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.comparison;
    expect(c.overall).toMatchObject({ before: 60, after: 72, delta: 12, trend: "improved", beforeTier: "B", afterTier: "A" });
    expect(c.categories.find((x) => x.id === "attack")!.change.trend).toBe("not_comparable");
    expect(c.categories.find((x) => x.id === "aerial")!.change).toMatchObject({ delta: -4, trend: "worsened" });
    expect(c.categories.find((x) => x.id === "defense")!.change.trend).toBe("unchanged");
    expect(c.counts).toEqual({ improved: 0, worsened: 1, unchanged: 6, notComparable: 1 });
  });

  it("選択順に関係なく古い方を before にする（取り違え防止）", () => {
    const older = { payload: P({ o: 50, d: "2026-09-01" }), at: "2026-09-01T00:00:00Z" };
    const newer = { payload: P({ o: 80, d: "2026-09-10" }), at: "2026-09-10T00:00:00Z" };
    for (const [a, b] of [[older, newer], [newer, older]]) {
      const r = compareDiagnoses(a, b);
      expect(r.ok && [r.comparison.beforeDate, r.comparison.afterDate, r.comparison.overall.trend]).toEqual(["2026-09-01", "2026-09-10", "improved"]);
    }
  });

  it("規則の版が違う・同じ項目・不正なデータは比較しない", () => {
    expect(compareDiagnoses({ payload: P(), at: "1" }, { payload: P({ r: "squad-diagnosis/2026-10-01.v2" }), at: "2" })).toEqual({ ok: false, reason: "rules_mismatch" });
    expect(compareDiagnoses({ payload: P(), at: "1", key: "dh_x" }, { payload: P(), at: "2", key: "dh_x" })).toEqual({ ok: false, reason: "same_entry" });
    expect(compareDiagnoses({ payload: { ...P(), o: [99, "D"] }, at: "1" }, { payload: P(), at: "2" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("強み・弱点の種類の変化を示す（原因は判定しない）", () => {
    const r = compareDiagnoses({ payload: P({ w: ["ability", "defense"] }), at: "1" }, { payload: P({ w: ["compatibility", null] }), at: "2" });
    expect(r.ok && r.comparison.weakness).toEqual({ before: ["ability", "defense"], after: ["compatibility", null], changed: true });
    expect(r.ok && r.comparison.strength.changed).toBe(false);
  });
});

describe("比較の共有URL", () => {
  it("before~after の2トークンで往復できる。URLの順番を before/after とする", () => {
    const url = buildCompareShareUrl("https://example.invalid", P({ o: 50, d: "2026-09-01" }), P({ o: 80, d: "2026-09-10" }));
    expect(url).toMatch(/^https:\/\/example\.invalid\/share\/compare#sd1\.[\w-]+\.[0-9a-f]{8}~sd1\.[\w-]+\.[0-9a-f]{8}$/);
    const r = decodeCompareShare(new URL(url).hash);
    expect(r.ok && [r.comparison.beforeDate, r.comparison.overall.delta]).toEqual(["2026-09-01", 30]);
  });

  it("形式不正・片方が不正・版の違い・未知の版・空を安全に拒否", () => {
    const t = encodeSharePayload(P());
    expect(decodeCompareShare("")).toEqual({ ok: false, reason: "empty" });
    expect(decodeCompareShare(t)).toEqual({ ok: false, reason: "bad_format" });
    expect(decodeCompareShare(`${t}~${t}~${t}`)).toEqual({ ok: false, reason: "bad_format" });
    expect(decodeCompareShare(`${t}~garbage`)).toEqual({ ok: false, reason: "invalid" });
    expect(decodeCompareShare(`${t}~${encodeSharePayload(P({ r: "squad-diagnosis/2026-10-01.v2" }))}`)).toEqual({ ok: false, reason: "rules_mismatch" });
    expect(decodeCompareShare(`${t}~sd2.AAAAAAAA.${fnv1a32("AAAAAAAA")}`)).toEqual({ ok: false, reason: "unsupported_version" });
  });
});
