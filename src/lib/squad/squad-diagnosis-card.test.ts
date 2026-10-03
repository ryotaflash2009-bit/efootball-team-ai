import { describe, it, expect, vi, afterEach } from "vitest";
import { drawSquadDiagnosisCard, SQUAD_CARD_RATIOS, SQUAD_CARD_SIZES, withRatioSuffix, type SquadCardRatio } from "./squad-diagnosis-card";
import { drawSquadDiagnosisImage, SQUAD_DIAGNOSIS_IMAGE_SCALE } from "./squad-diagnosis-image";
import type { SquadDiagnosisShareData } from "./squad-diagnosis-share";
import { shareOrSaveImage, canShareImageFiles } from "@/lib/share-image";

afterEach(() => vi.unstubAllGlobals());

const LONG = "とても長いチーム名".repeat(14);
const DATA: SquadDiagnosisShareData = {
  serviceName: "TeamAIXI",
  squadName: LONG,
  formationLabel: "4-2-1-3",
  generatedAtIso: "2026-10-01T12:00:00.000Z",
  overallScore: 78,
  overallTier: "A",
  ratedCategoryCount: 8,
  totalCategoryCount: 8,
  categories: [
    { id: "attack", label: "攻撃", score: 80, tier: "A" },
    { id: "defense", label: "守備", score: 60, tier: "B" },
    { id: "aerial", label: "空中戦", score: null, tier: null },
    { id: "speed", label: "スピード", score: 90, tier: "S" },
    { id: "passBuildUp", label: "パス・ビルドアップ", score: 55, tier: "B" },
    { id: "dribblePossession", label: "ドリブル・ボール保持", score: 65, tier: "B" },
    { id: "pressResistance", label: "プレス適性", score: 30, tier: "D" },
    { id: "counterAttack", label: "カウンター適性", score: 88, tier: "S" },
  ],
  topStrength: { label: "スピード", detail: "", categoryId: "speed" },
  topWeakness: { label: "選手名が入る可能性のある長い弱点の説明".repeat(4), detail: "", categoryId: null },
  disclaimer: "登録データにもとづく構成評価です。試合結果、全国順位、勝率を保証するものではありません。",
};

/** fillText の位置と、その時点の文字幅（1文字 = フォントサイズ × 0.6 の近似）を記録するフェイク。 */
function recordingCanvas() {
  const texts: { text: string; x: number; y: number; width: number; align: string }[] = [];
  const state: Record<string, unknown> = { font: "10px sans-serif", textAlign: "left" };
  const size = () => Number(/(\d+)px/.exec(String(state.font))?.[1] ?? 10);
  const ctx = new Proxy(state, {
    get(t, p: string) {
      if (p === "measureText") return (s: string) => ({ width: String(s).length * size() * 0.6 });
      if (p === "fillText") return (s: string, x: number, y: number) => texts.push({ text: String(s), x, y, width: String(s).length * size() * 0.6, align: String(state.textAlign) });
      if (p in t) return t[p];
      return () => undefined;
    },
    set(t, p: string, v) {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, texts };
}

describe("F-041b 診断カードの比率", () => {
  for (const ratio of SQUAD_CARD_RATIOS) {
    for (const locale of ["ja", "en"] as const) {
      it(`${ratio} ${locale}: 大きさ・文字がカードの内側に収まる・長い名前は省略する`, () => {
        const { canvas, texts } = recordingCanvas();
        drawSquadDiagnosisCard(canvas, DATA, locale, ratio, { titles: { primary: "カウンター型", badges: ["ビルドアップ型", "プレス耐性型", "とても長いバッジの名前".repeat(5)] } });
        const { width: W, height: H } = SQUAD_CARD_SIZES[ratio];
        expect(canvas.width).toBe(W * SQUAD_DIAGNOSIS_IMAGE_SCALE);
        expect(canvas.height).toBe(H * SQUAD_DIAGNOSIS_IMAGE_SCALE);
        expect(texts.length).toBeGreaterThan(20);
        if (ratio !== "3:4") {
          for (const t of texts) {
            const left = t.align === "right" ? t.x - t.width : t.align === "center" ? t.x - t.width / 2 : t.x;
            const right = left + t.width;
            expect(left, `${t.text} left`).toBeGreaterThanOrEqual(16);
            expect(right, `${t.text} right`).toBeLessThanOrEqual(W - 16 + 1);
            expect(t.y, `${t.text} y`).toBeGreaterThan(0);
            expect(t.y, `${t.text} y`).toBeLessThan(H);
          }
          expect(texts.some((t) => t.text.endsWith("…"))).toBe(true);
          expect(texts.some((t) => t.text.includes("カウンター型"))).toBe(true);
        }
        // ID・URL・Token は描かない。
        expect(texts.map((t) => t.text).join(" ")).not.toMatch(/https?:|sd1\.|squad_|sq_[A-Za-z0-9]|@/);
      });
    }
  }

  it("3:4 は既存の描画と同じ（共有カードの互換）", () => {
    const a = recordingCanvas();
    const b = recordingCanvas();
    drawSquadDiagnosisCard(a.canvas, DATA, "ja", "3:4", { titles: { primary: "x", badges: [] } });
    drawSquadDiagnosisImage(b.canvas, DATA, "ja");
    expect(a.texts).toEqual(b.texts);
  });

  it("ファイル名へ比率を付ける（3:4 は既存の名前のまま）", () => {
    expect(withRatioSuffix("efootball-team-ai-squad-diagnosis-a-20261001.png", "3:4")).toBe("efootball-team-ai-squad-diagnosis-a-20261001.png");
    expect(withRatioSuffix("x.png", "9:16")).toBe("x-9x16.png");
    expect(withRatioSuffix("x.png", "1:1" as SquadCardRatio)).toBe("x-1x1.png");
  });
});

describe("F-041b OS 共有と保存", () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const createFile = (b: Blob, n: string) => ({ name: n, size: b.size }) as unknown as File;

  it("ファイル共有ができれば共有する", async () => {
    const share = vi.fn(async () => undefined);
    const download = vi.fn(() => true);
    expect(await shareOrSaveImage(blob, "a.png", "t", { navigator: { share, canShare: () => true }, createFile, download })).toEqual({ ok: true, method: "share" });
    expect(download).not.toHaveBeenCalled();
  });

  it("共有シートを閉じたら取り消し（エラーにしない・保存もしない）", async () => {
    const download = vi.fn(() => true);
    const share = vi.fn(async () => {
      throw Object.assign(new Error("x"), { name: "AbortError" });
    });
    expect(await shareOrSaveImage(blob, "a.png", "t", { navigator: { share, canShare: () => true }, createFile, download })).toEqual({ ok: false, reason: "cancelled" });
    expect(download).not.toHaveBeenCalled();
  });

  it("ファイル共有に対応していない・共有が失敗した・navigator が無いときは保存へ切り替える", async () => {
    const download = vi.fn(() => true);
    expect(await shareOrSaveImage(blob, "a.png", "t", { navigator: { share: vi.fn(), canShare: () => false }, createFile, download })).toEqual({ ok: true, method: "download" });
    const failing = vi.fn(async () => {
      throw Object.assign(new Error("x"), { name: "NotAllowedError" });
    });
    expect(await shareOrSaveImage(blob, "a.png", "t", { navigator: { share: failing, canShare: () => true }, createFile, download })).toEqual({ ok: true, method: "download" });
    expect(await shareOrSaveImage(blob, "a.png", "t", { navigator: null, createFile, download })).toEqual({ ok: true, method: "download" });
    expect(await shareOrSaveImage(blob, "a.png", "t", { navigator: null, createFile, download: () => false })).toEqual({ ok: false, reason: "unsupported" });
  });

  it("共有ボタンの表示判定（Safari・Chrome 相当は true、PC の未対応は false）", () => {
    expect(canShareImageFiles({ navigator: { share: vi.fn(), canShare: () => true }, createFile })).toBe(true);
    expect(canShareImageFiles({ navigator: { share: vi.fn(), canShare: () => false }, createFile })).toBe(false);
    expect(canShareImageFiles({ navigator: {}, createFile })).toBe(false);
  });
});
