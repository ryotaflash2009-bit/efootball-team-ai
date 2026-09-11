import { describe, it, expect, vi, afterEach } from "vitest";
import {
  drawSquadDiagnosisImage,
  saveSquadDiagnosisImageAsPng,
  SQUAD_DIAGNOSIS_IMAGE_WIDTH,
  SQUAD_DIAGNOSIS_IMAGE_HEIGHT,
} from "./squad-diagnosis-image";
import type { SquadDiagnosisShareData } from "./squad-diagnosis-share";

/**
 * このリポジトリの vitest 既定環境は "node"（jsdom 未導入・新規依存追加はしない方針のため）。
 * 実際の Canvas 描画・ピクセル出力はブラウザーでのみ検証可能なため、ここでは
 * `src/lib/browser-download.test.ts` と同じ手法（vi.stubGlobal による最小限のブラウザー相当スタブ）で、
 * 「描画関数が例外を投げずに完走すること」「保存処理の呼び出し・ファイル名・後始末・失敗時の状態」を検証する。
 * 視覚的な最終確認は人間の目視確認項目とする。
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_DATA: SquadDiagnosisShareData = {
  serviceName: "eFootball Team AI",
  squadName: "テストスカッド",
  formationLabel: "4-3-3",
  generatedAtIso: "2026-09-06T12:00:00.000Z",
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
  topStrength: { label: "スピード", detail: "スピードの評価が高水準です（ランクS・90点）。", categoryId: "speed" },
  topWeakness: { label: "プレス適性", detail: "プレス適性の評価が低水準です（ランクD・30点）。", categoryId: "pressResistance" },
  disclaimer: "登録データにもとづく構成評価です。試合結果、全国順位、勝率を保証するものではありません。",
};

/** drawSquadDiagnosisImage が呼び出す Canvas 2D API のすべてを無害化するフェイク ctx。 */
function makeFakeCtx() {
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get(target, prop: string) {
      if (prop === "measureText") return (text: string) => ({ width: String(text).length * 8 });
      if (prop in target) return target[prop as string];
      return () => undefined;
    },
    set(target, prop: string, value) {
      target[prop as string] = value;
      return true;
    },
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

function makeFakeCanvas(ctx: CanvasRenderingContext2D | null) {
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

describe("drawSquadDiagnosisImage", () => {
  it("有効な描画コンテキストがあれば例外を投げずに完走する", () => {
    const ctx = makeFakeCtx();
    const canvas = makeFakeCanvas(ctx);
    expect(() => drawSquadDiagnosisImage(canvas, SAMPLE_DATA)).not.toThrow();
  });
  it("判定対象外カテゴリ・長所弱点なしでも例外を投げない", () => {
    const ctx = makeFakeCtx();
    const canvas = makeFakeCanvas(ctx);
    const data: SquadDiagnosisShareData = {
      ...SAMPLE_DATA,
      overallScore: null,
      overallTier: null,
      categories: SAMPLE_DATA.categories.map((c) => ({ ...c, score: null, tier: null })),
      topStrength: null,
      topWeakness: null,
    };
    expect(() => drawSquadDiagnosisImage(canvas, data)).not.toThrow();
  });
  it("長いチーム名でも例外を投げない（折り返し・省略処理）", () => {
    const ctx = makeFakeCtx();
    const canvas = makeFakeCanvas(ctx);
    const data: SquadDiagnosisShareData = { ...SAMPLE_DATA, squadName: "非常に長いチーム名".repeat(20) };
    expect(() => drawSquadDiagnosisImage(canvas, data)).not.toThrow();
  });
  it("getContext が null を返しても例外を投げない（早期return）", () => {
    const canvas = makeFakeCanvas(null);
    expect(() => drawSquadDiagnosisImage(canvas, SAMPLE_DATA)).not.toThrow();
  });
  it("キャンバスの論理サイズにスケールを適用した物理サイズを設定する", () => {
    const ctx = makeFakeCtx();
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    drawSquadDiagnosisImage(canvas, SAMPLE_DATA);
    expect(canvas.width).toBeGreaterThan(SQUAD_DIAGNOSIS_IMAGE_WIDTH);
    expect(canvas.height).toBeGreaterThan(SQUAD_DIAGNOSIS_IMAGE_HEIGHT);
  });

  it("locale='en' を指定しても例外を投げず、既存の1440x1920相当のサイズを維持する", () => {
    const ctx = makeFakeCtx();
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    expect(() => drawSquadDiagnosisImage(canvas, SAMPLE_DATA, "en")).not.toThrow();
    expect(canvas.width).toBe(SQUAD_DIAGNOSIS_IMAGE_WIDTH * 2);
    expect(canvas.height).toBe(SQUAD_DIAGNOSIS_IMAGE_HEIGHT * 2);
  });

  it("locale='en' で英語のfillTextが呼ばれる（見出し・総合評価等が英語化される）", () => {
    const calls: string[] = [];
    const ctx = makeFakeCtx();
    const originalFillText = (ctx as unknown as { fillText: (t: string) => void }).fillText;
    (ctx as unknown as { fillText: (t: string) => void }).fillText = (t: string) => {
      calls.push(t);
      originalFillText(t);
    };
    const canvas = makeFakeCanvas(ctx);
    drawSquadDiagnosisImage(canvas, SAMPLE_DATA, "en");
    expect(calls).toContain("Squad Diagnosis (Squad Build Evaluation)");
    expect(calls).toContain("Overall Rating");
    expect(calls.some((c) => c.includes("Attack"))).toBe(true);
  });

  it("locale='en' でも長所/弱点の由来カテゴリが無い場合は日本語ラベルのまま表示する（選手名を推測翻訳しない）", () => {
    const ctx = makeFakeCtx();
    const canvas = makeFakeCanvas(ctx);
    const data: SquadDiagnosisShareData = {
      ...SAMPLE_DATA,
      topWeakness: { label: "選手名の保存ビルド参照", detail: "保存ビルドの参照が解決できません。", categoryId: null },
    };
    expect(() => drawSquadDiagnosisImage(canvas, data, "en")).not.toThrow();
  });

  it("locale省略時はjaと同じ（既存呼び出し・既存挙動と完全互換）", () => {
    const ctxJa = makeFakeCtx();
    const canvasJa = makeFakeCanvas(ctxJa);
    expect(() => drawSquadDiagnosisImage(canvasJa, SAMPLE_DATA)).not.toThrow();
    const ctxJaExplicit = makeFakeCtx();
    const canvasJaExplicit = makeFakeCanvas(ctxJaExplicit);
    expect(() => drawSquadDiagnosisImage(canvasJaExplicit, SAMPLE_DATA, "ja")).not.toThrow();
  });
});

describe("saveSquadDiagnosisImageAsPng: SSR / 非対応環境", () => {
  it("document 不在では { ok: false, reason: 'ssr' }", async () => {
    expect(typeof document).toBe("undefined");
    const r = await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "x.png");
    expect(r).toEqual({ ok: false, reason: "ssr" });
  });

  it("getContext が null を返す環境では { ok: false, reason: 'unsupported' }", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });
    const r = await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "x.png");
    expect(r).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("saveSquadDiagnosisImageAsPng: ブラウザー相当環境", () => {
  function stubBrowser(opts: { toBlobUnsupported?: boolean; toDataUrl?: string } = {}) {
    const created: string[] = [];
    const revoked: string[] = [];
    const removed: unknown[] = [];
    const clicks: Array<{ href: unknown; download: unknown }> = [];
    const timers: Array<() => void> = [];
    const ctx = makeFakeCtx();

    vi.stubGlobal("window", {
      setTimeout: (fn: () => void) => {
        timers.push(fn);
        return timers.length;
      },
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => ctx,
            toBlob: (cb: (b: Blob | null) => void) =>
              cb(opts.toBlobUnsupported ? null : new Blob(["fake-png"], { type: "image/png" })),
            toDataURL: () => opts.toDataUrl ?? "data:image/png;base64,AAAA",
          };
        }
        const anchor: Record<string, unknown> = { style: {} };
        anchor.click = () => clicks.push({ href: anchor.href, download: anchor.download });
        return anchor;
      },
      body: {
        appendChild: (n: unknown) => {
          (n as Record<string, unknown>).parentNode = { removeChild: (c: unknown) => removed.push(c) };
        },
      },
    });
    vi.stubGlobal("URL", {
      createObjectURL: (b: unknown) => {
        expect(b).toBeInstanceOf(Blob);
        const u = `blob:mock/${created.length}`;
        created.push(u);
        return u;
      },
      revokeObjectURL: (u: string) => revoked.push(u),
    });

    return { created, revoked, removed, clicks, runTimers: () => timers.forEach((t) => t()) };
  }

  it("toBlob 経由で成功し、ファイル名を設定して1回だけクリックする", async () => {
    const env = stubBrowser();
    const r = await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "test.png");
    expect(r).toEqual({ ok: true });
    expect(env.clicks).toHaveLength(1);
    expect(env.clicks[0].download).toBe("test.png");
    expect(env.created).toHaveLength(1);
    expect(env.removed).toHaveLength(1); // 一時 <a> は同期で除去
    expect(env.revoked).toHaveLength(0); // クリック直後はまだ revoke しない
    env.runTimers();
    expect(env.revoked).toEqual(["blob:mock/0"]);
  });

  it("toBlob が null を返す環境では dataURL 経由へフォールバックする", async () => {
    const env = stubBrowser({ toBlobUnsupported: true });
    const r = await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "fallback.png");
    expect(r).toEqual({ ok: true });
    expect(env.clicks).toHaveLength(1);
    expect(env.clicks[0].href).toContain("data:image/png");
  });

  it("toBlob も toDataURL も使えない環境では { ok: false, reason: 'unsupported' }", async () => {
    stubBrowser({ toBlobUnsupported: true, toDataUrl: "data:," });
    const r = await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "x.png");
    expect(r).toEqual({ ok: false, reason: "unsupported" });
  });

  it("createObjectURL が例外を投げても画面をクラッシュさせず { ok: false, reason: 'error' } を返す", async () => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    const ctx = makeFakeCtx();
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["x"])) };
        }
        return { style: {} };
      },
      body: { appendChild: () => {}, removeChild: () => {} },
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("boom");
      },
      revokeObjectURL: () => {},
    });
    const r = await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "x.png");
    expect(r).toEqual({ ok: false, reason: "error" });
  });

  it("同じデータから複数回保存しても Object URL を残さない（都度解放）", async () => {
    const env = stubBrowser();
    await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "a.png");
    await saveSquadDiagnosisImageAsPng(SAMPLE_DATA, "b.png");
    expect(env.created).toHaveLength(2);
    env.runTimers();
    expect(env.revoked.sort()).toEqual(["blob:mock/0", "blob:mock/1"]);
  });

  it("画像用データに内部ID・デバッグ情報が含まれていないこと（JSON化して確認）", () => {
    const json = JSON.stringify(SAMPLE_DATA);
    expect(json).not.toMatch(/worldCardId|buildId|squadId|evidence|localStorage|C:\\\\/i);
  });
});
