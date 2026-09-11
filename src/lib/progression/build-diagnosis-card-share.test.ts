import { describe, it, expect } from "vitest";
import { safePlayerNameForImage, sanitizeFileNameFragment, buildDiagnosisImageFileName } from "./build-diagnosis-card-share";

describe("safePlayerNameForImage", () => {
  it("通常の選手名はそのまま返す", () => {
    expect(safePlayerNameForImage("Lionel Messi")).toBe("Lionel Messi");
    expect(safePlayerNameForImage("リオネル メッシ")).toBe("リオネル メッシ");
  });

  it("既存のcardFallbackNameTemplate('カード {id}')に一致する場合はnullを返す(worldCardIdの数値表示を許可しない)", () => {
    expect(safePlayerNameForImage("カード 89138556575063")).toBeNull();
  });

  it("既存のcardFallbackNameTemplate('Card {id}')に一致する場合はnullを返す", () => {
    expect(safePlayerNameForImage("Card 89138556575063")).toBeNull();
  });

  it("空文字・空白のみはnullを返す", () => {
    expect(safePlayerNameForImage("")).toBeNull();
    expect(safePlayerNameForImage("   ")).toBeNull();
  });

  it("「カード」を含むが接頭辞ではない通常名は安全に扱う", () => {
    expect(safePlayerNameForImage("カードキャプター")).toBe("カードキャプター");
  });
});

describe("sanitizeFileNameFragment", () => {
  it("危険なパス文字を除去する", () => {
    const r = sanitizeFileNameFragment('a/b\\c:d*e?f"g<h>i|j');
    expect(r).not.toMatch(/[\\/:*?"<>|]/);
  });

  it("スラッシュ・バックスラッシュ・コロンを含まない", () => {
    const r = sanitizeFileNameFragment("path/to\\file:name");
    expect(r).not.toContain("/");
    expect(r).not.toContain("\\");
    expect(r).not.toContain(":");
  });

  it("空白を安全な区切り文字へ変換する", () => {
    const r = sanitizeFileNameFragment("Lionel Messi");
    expect(r).not.toContain(" ");
  });

  it("連続ハイフンを1つへ統合する", () => {
    const r = sanitizeFileNameFragment("a---b___c");
    expect(r).not.toMatch(/-{2,}/);
  });

  it("先頭・末尾のピリオド/ハイフンを除去する", () => {
    const r = sanitizeFileNameFragment("-.build.-");
    expect(r.startsWith(".")).toBe(false);
    expect(r.startsWith("-")).toBe(false);
    expect(r.endsWith(".")).toBe(false);
    expect(r.endsWith("-")).toBe(false);
  });

  it("非常に長い名前を制限する", () => {
    const r = sanitizeFileNameFragment("a".repeat(200), 30);
    expect(r.length).toBeLessThanOrEqual(30);
  });

  it("空文字になる場合はフォールバック値を返す", () => {
    expect(sanitizeFileNameFragment("///\\\\:::")).toBe("build");
  });

  it("同じ入力からは常に同じ結果を返す(決定的)", () => {
    expect(sanitizeFileNameFragment("Lionel Messi")).toBe(sanitizeFileNameFragment("Lionel Messi"));
  });
});

describe("buildDiagnosisImageFileName", () => {
  it("末尾が.pngになる", () => {
    const name = buildDiagnosisImageFileName({ playerName: "Lionel Messi", buildName: "Build 1", goalLabel: "Dribbling", mode: "normal", orientation: "portrait" });
    expect(name.endsWith(".png")).toBe(true);
  });

  it("通常/辛口を区別する", () => {
    const normal = buildDiagnosisImageFileName({ playerName: "Messi", buildName: "B1", goalLabel: "Dribbling", mode: "normal", orientation: "portrait" });
    const harsh = buildDiagnosisImageFileName({ playerName: "Messi", buildName: "B1", goalLabel: "Dribbling", mode: "harsh", orientation: "portrait" });
    expect(normal).not.toBe(harsh);
    expect(normal).toContain("normal");
    expect(harsh).toContain("harsh");
  });

  it("縦長/横長を区別する", () => {
    const portrait = buildDiagnosisImageFileName({ playerName: "Messi", buildName: "B1", goalLabel: "Dribbling", mode: "normal", orientation: "portrait" });
    const landscape = buildDiagnosisImageFileName({ playerName: "Messi", buildName: "B1", goalLabel: "Dribbling", mode: "normal", orientation: "landscape" });
    expect(portrait).not.toBe(landscape);
    expect(portrait).toContain("portrait");
    expect(landscape).toContain("landscape");
  });

  it("同じ入力から同じファイル名を返す(決定的)", () => {
    const opts = { playerName: "Messi", buildName: "B1", goalLabel: "Dribbling", mode: "normal" as const, orientation: "portrait" as const };
    expect(buildDiagnosisImageFileName(opts)).toBe(buildDiagnosisImageFileName(opts));
  });

  it("内部ID(worldCardId/buildId/presetId)らしき値を渡していないため、ファイル名にも含まれない", () => {
    const name = buildDiagnosisImageFileName({ playerName: "Messi", buildName: "B1", goalLabel: "Dribbling", mode: "normal", orientation: "portrait" });
    expect(name).not.toMatch(/\d{10,}/);
  });

  it("選手名が安全に解決できない(null)場合でも安全なファイル名を生成する", () => {
    const name = buildDiagnosisImageFileName({ playerName: null, buildName: "B1", goalLabel: "Dribbling", mode: "normal", orientation: "portrait" });
    expect(name.endsWith(".png")).toBe(true);
    expect(name).not.toContain("null");
  });

  it("危険な文字を含む表示名でも安全なファイル名になる", () => {
    const name = buildDiagnosisImageFileName({
      playerName: '../../etc/passwd:"<script>"',
      buildName: "b\\uild",
      goalLabel: "goal",
      mode: "harsh",
      orientation: "landscape",
    });
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
    expect(name).not.toContain("..");
    expect(name).not.toContain("<script>");
  });
});
