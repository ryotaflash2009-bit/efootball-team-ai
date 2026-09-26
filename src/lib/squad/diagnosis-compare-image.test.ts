import { describe, it, expect } from "vitest";
import { COMPARE_IMAGE_HEIGHT, COMPARE_IMAGE_WIDTH, drawDiagnosisComparisonImage, type CompareImageTexts } from "./diagnosis-compare-image";
import { compareDiagnoses } from "./diagnosis-compare";
import type { SquadDiagnosisSharePayloadV1 } from "./squad-diagnosis-share-url";

/** vitest は node 環境（jsdom なし）。描画命令を記録する最小のcanvasスタブで、描画内容（テキスト）を検証する。 */
function fakeCanvas() {
  const texts: string[] = [];
  const ctx = {
    fillStyle: "", font: "", textAlign: "left", textBaseline: "alphabetic",
    fillRect: () => undefined,
    fillText: (s: string) => texts.push(s),
    measureText: (s: string) => ({ width: s.length * 14 }),
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, texts };
}

const P = (o: number, attack: number | null, d: string): SquadDiagnosisSharePayloadV1 => ({
  v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d, f: "4-3-3",
  o: [o, o >= 70 ? "A" : "B"],
  c: { attack: attack == null ? [null, null] : [attack, attack >= 70 ? "A" : attack >= 55 ? "B" : "C"], defense: [47, "C"], aerial: [54, "C"], speed: [61, "B"], passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"] },
  s: null, w: null,
});

const TEXTS: CompareImageTexts = {
  serviceName: "eFootball Team AI", title: "改善前後の比較", before: "改善前", after: "改善後", overall: "総合評価",
  trend: { improved: "改善", worsened: "悪化", unchanged: "変化なし", not_comparable: "比較不可" },
  notRated: "判定対象外", summary: "改善 1・悪化 0・変化なし 6・比較不可 1", disclaimer: "差だけを示します。原因は判定していません。",
  categoryLabel: (id) => `cat:${id}`,
};

describe("改善前後カードの画像", () => {
  it("サイズ・日付・総合の変化・全カテゴリ・免責を描き、名前やIDを描かない", () => {
    const r = compareDiagnoses({ payload: P(60, 50, "2026-09-01"), at: "1" }, { payload: P(72, null, "2026-09-10"), at: "2" });
    if (!r.ok) throw new Error("compare");
    const { canvas, texts } = fakeCanvas();
    drawDiagnosisComparisonImage(canvas, r.comparison, TEXTS);
    expect([canvas.width, canvas.height]).toEqual([COMPARE_IMAGE_WIDTH, COMPARE_IMAGE_HEIGHT]);
    const all = texts.join("\n");
    expect(all).toContain("改善前 2026-09-01  →  改善後 2026-09-10");
    expect(all).toContain("60 B  →  72 A");
    expect(all).toContain("+12");
    expect(all).toContain("比較不可");
    for (const id of ["attack", "defense", "aerial", "speed", "passBuildUp", "dribblePossession", "pressResistance", "counterAttack"]) expect(all).toContain(`cat:${id}`);
    expect(all).toContain("原因は判定していません");
    expect(all).not.toMatch(/sq_|dh_|worldCardId/);
  });
});
