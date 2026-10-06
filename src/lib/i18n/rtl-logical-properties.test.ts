import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// RTL の準備（2026-10-06）: 余白・文字の揃え・枠線・角丸は論理プロパティ（ms/me/ps/pe・text-start/end・border-s/e・rounded-s/e）を使う。
// LTR の表示は物理（ml/mr・text-left 等）と同じ。位置（left-/right-・translate-x）は場面ごとに確認するため対象外。
const PHYSICAL = [
  /(?<=[\s"'`{(:])-?m[lr]-(?=\d|px\b|auto\b|\[|full\b)/,
  /(?<=[\s"'`{(:])p[lr]-(?=\d|px\b|auto\b|\[|full\b)/,
  /(?<=[\s"'`{(:])text-(left|right)(?=[\s"'`}])/,
  /(?<=[\s"'`{(:])border-[lr](?=[\s"'`}]|-\d|-\[|-[a-z])/,
  /(?<=[\s"'`{(:])rounded-([lr]|[tb][lr])(?=[\s"'`}]|-)/,
];

describe("RTL の準備: 論理プロパティ", () => {
  it("src の UI は余白・揃え・枠線・角丸に物理的な左右の指定を使わない", () => {
    const files = globSync("src/**/*.{ts,tsx}").filter((f) => !f.includes(".test.") && !f.endsWith("locale-registry.ts"));
    const hits: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const rx of PHYSICAL) if (rx.test(line)) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("表の見出しの行は、th に start を直接付ける（th の既定の center が継承の start を上書きするため）", () => {
    const files = globSync("src/components/**/*.tsx");
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/<(tr|thead)\b[^>]*\btext-(start|end)\b[^>]*>/g)) {
        expect(m[0], f).toMatch(/\[:where\(&\)_th\]:text-(start|end)/);
      }
    }
  });
});
