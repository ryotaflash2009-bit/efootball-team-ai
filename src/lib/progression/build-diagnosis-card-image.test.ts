import { describe, it, expect, vi, afterEach } from "vitest";
import { drawBuildDiagnosisCardImage, saveBuildDiagnosisCardImageAsPng, BUILD_DIAGNOSIS_IMAGE_SIZES } from "./build-diagnosis-card-image";
import type { BuildDiagnosisImageContent } from "./build-diagnosis-card-share";

/**
 * このリポジトリの vitest 既定環境は "node"(jsdom未導入)。squad-diagnosis-image.test.tsと同じ手法
 * (Proxyによる最小限のCanvas 2Dスタブ)で、「描画関数が例外を投げずに完走すること」と
 * 「保存処理の呼び出し・ファイル名・後始末・失敗時の挙動」を検証する。
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_CONTENT: BuildDiagnosisImageContent = {
  serviceName: "eFootball Team AI",
  modeLabel: "通常診断",
  playerName: "Lionel Messi",
  buildName: "Fixture Build",
  positionsText: "使用予定ポジション: CF",
  primaryGoalLabel: "ドリブル突破",
  subGoalLabels: ["ボールを失いにくくする", "狭い場所でボールを保持"],
  alignmentLabel: "おおむね一致",
  headlineText: "ドリブル突破の狙いは能力構成へ反映されています。",
  achievementItems: [
    { label: "ボールコントロール", valueText: "+10" },
    { label: "ドリブル", valueText: "+10" },
    { label: "ボールキープ", valueText: "+10" },
  ],
  noAchievementsText: null,
  concernLabel: "最大の注意点",
  concernText: "大きな目的上の問題は確認されていません。",
  improvementLabel: "改善候補",
  improvementText: "現在の配分で大きな見直しは必要ありません。",
  preserveLabel: "維持する長所",
  preserveText: "ドリブルで得られている能力上昇",
  comparison: {
    targetName: "ビルド2",
    purposeClosenessLabel: "用途の近さ",
    purposeClosenessValue: "かなり近い",
    differentiationLabel: "差別化",
    differentiationValue: "限定的",
    majorDiffText: "キック力 現在+2",
    notComparableText: null,
  },
  disclaimerTexts: [],
  footerText: "確定済みの設定に基づく分析結果です。",
};

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
  return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

describe("drawBuildDiagnosisCardImage", () => {
  it("縦長: 有効な描画コンテキストがあれば例外を投げずに完走する", () => {
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, SAMPLE_CONTENT, "portrait")).not.toThrow();
  });

  it("横長: 有効な描画コンテキストがあれば例外を投げずに完走する", () => {
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, SAMPLE_CONTENT, "landscape")).not.toThrow();
  });

  it("縦長キャンバスの物理サイズが正式仕様(540x960 論理 x 2倍)と一致する", () => {
    const canvas = { width: 0, height: 0, getContext: () => makeFakeCtx() } as unknown as HTMLCanvasElement;
    drawBuildDiagnosisCardImage(canvas, SAMPLE_CONTENT, "portrait");
    expect(canvas.width).toBe(BUILD_DIAGNOSIS_IMAGE_SIZES.portrait.width * BUILD_DIAGNOSIS_IMAGE_SIZES.portrait.scale);
    expect(canvas.height).toBe(BUILD_DIAGNOSIS_IMAGE_SIZES.portrait.height * BUILD_DIAGNOSIS_IMAGE_SIZES.portrait.scale);
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
  });

  it("横長キャンバスの物理サイズが正式仕様(960x540 論理 x 2倍)と一致する", () => {
    const canvas = { width: 0, height: 0, getContext: () => makeFakeCtx() } as unknown as HTMLCanvasElement;
    drawBuildDiagnosisCardImage(canvas, SAMPLE_CONTENT, "landscape");
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
  });

  it("getContextがnullを返しても例外を投げない(早期return)", () => {
    const canvas = makeFakeCanvas(null);
    expect(() => drawBuildDiagnosisCardImage(canvas, SAMPLE_CONTENT, "portrait")).not.toThrow();
  });

  it("成果0件(捏造せず「該当なし」表示のみ)でも例外を投げない", () => {
    const content: BuildDiagnosisImageContent = { ...SAMPLE_CONTENT, achievementItems: [], noAchievementsText: "現時点で目的に沿った明確な成果は確認できていません。" };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "portrait")).not.toThrow();
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "landscape")).not.toThrow();
  });

  it("比較なし(comparison=null)でも例外を投げない", () => {
    const content: BuildDiagnosisImageContent = { ...SAMPLE_CONTENT, comparison: null };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "portrait")).not.toThrow();
  });

  it("比較不能(notComparableText設定)でも例外を投げない", () => {
    const content: BuildDiagnosisImageContent = {
      ...SAMPLE_CONTENT,
      comparison: { ...SAMPLE_CONTENT.comparison!, notComparableText: "能力値データが不足しているため、詳細比較はできません。" },
    };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "portrait")).not.toThrow();
  });

  it("選手名が安全に解決できない(null)場合でも例外を投げず、選手名欄を省略できる", () => {
    const content: BuildDiagnosisImageContent = { ...SAMPLE_CONTENT, playerName: null };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "portrait")).not.toThrow();
  });

  it("非常に長い選手名・ビルド名・見出しでも例外を投げない(折り返し・省略処理)", () => {
    const content: BuildDiagnosisImageContent = {
      ...SAMPLE_CONTENT,
      playerName: "非常に長い選手名".repeat(20),
      buildName: "Extremely Long Build Name ".repeat(20),
      headlineText: "This is a very long English headline sentence. ".repeat(10),
    };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "portrait")).not.toThrow();
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "landscape")).not.toThrow();
  });

  it("サブ目的0件・維持する長所なしでも例外を投げない", () => {
    const content: BuildDiagnosisImageContent = { ...SAMPLE_CONTENT, subGoalLabels: [], preserveLabel: null, preserveText: null };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "portrait")).not.toThrow();
  });

  it("辛口モードのラベルでも例外を投げない", () => {
    const content: BuildDiagnosisImageContent = { ...SAMPLE_CONTENT, modeLabel: "Harsh Diagnosis" };
    const canvas = makeFakeCanvas(makeFakeCtx());
    expect(() => drawBuildDiagnosisCardImage(canvas, content, "landscape")).not.toThrow();
  });

  it("画像用データに内部ID・デバッグ情報が含まれていないこと(JSON化して確認)", () => {
    const json = JSON.stringify(SAMPLE_CONTENT);
    expect(json).not.toMatch(/worldCardId|buildId|presetId|abilityId|categoryId|localStorage|C:\\\\/i);
  });
});

describe("saveBuildDiagnosisCardImageAsPng: SSR / 非対応環境", () => {
  it("document不在では{ ok: false, reason: 'ssr' }", async () => {
    expect(typeof document).toBe("undefined");
    const r = await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "x.png", "portrait");
    expect(r).toEqual({ ok: false, reason: "ssr" });
  });

  it("getContextがnullを返す環境では{ ok: false, reason: 'unsupported' }", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    const r = await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "x.png", "portrait");
    expect(r).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("saveBuildDiagnosisCardImageAsPng: ブラウザー相当環境", () => {
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
            toBlob: (cb: (b: Blob | null) => void) => cb(opts.toBlobUnsupported ? null : new Blob(["fake-png"], { type: "image/png" })),
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

  it("toBlob経由で成功し、ファイル名を設定して1回だけクリックする", async () => {
    const env = stubBrowser();
    const r = await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "test.png", "portrait");
    expect(r).toEqual({ ok: true });
    expect(env.clicks).toHaveLength(1);
    expect(env.clicks[0].download).toBe("test.png");
    expect(env.created).toHaveLength(1);
    expect(env.removed).toHaveLength(1);
    expect(env.revoked).toHaveLength(0);
    env.runTimers();
    expect(env.revoked).toEqual(["blob:mock/0"]);
  });

  it("toBlobがnullを返す環境ではdataURL経由へフォールバックする", async () => {
    const env = stubBrowser({ toBlobUnsupported: true });
    const r = await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "fallback.png", "portrait");
    expect(r).toEqual({ ok: true });
    expect(env.clicks[0].href).toContain("data:image/png");
  });

  it("toBlobもtoDataURLも使えない環境では{ ok: false, reason: 'unsupported' }", async () => {
    stubBrowser({ toBlobUnsupported: true, toDataUrl: "data:," });
    const r = await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "x.png", "portrait");
    expect(r).toEqual({ ok: false, reason: "unsupported" });
  });

  it("createObjectURLが例外を投げても{ ok: false, reason: 'error' }を返す(生成失敗時の安全な後処理)", async () => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    const ctx = makeFakeCtx();
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "canvas") return { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["x"])) };
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
    const r = await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "x.png", "portrait");
    expect(r).toEqual({ ok: false, reason: "error" });
  });

  it("同じ内容から複数回保存してもObject URLを都度解放する(多重生成の後始末)", async () => {
    const env = stubBrowser();
    await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "a.png", "portrait");
    await saveBuildDiagnosisCardImageAsPng(SAMPLE_CONTENT, "b.png", "landscape");
    expect(env.created).toHaveLength(2);
    env.runTimers();
    expect(env.revoked.sort()).toEqual(["blob:mock/0", "blob:mock/1"]);
  });
});
