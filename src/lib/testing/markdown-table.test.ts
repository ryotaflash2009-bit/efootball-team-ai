import { describe, it, expect } from "vitest";
import { escapeMarkdownCell } from "./markdown-table";

/**
 * Markdownの`\\`(バックスラッシュのエスケープ)・`\|`(パイプのエスケープ)だけを解釈する、
 * このテスト専用の最小限の「逆変換」。escapeMarkdownCellが実際に可逆(元の文字列を
 * 1セルとして正しく表現できている)ことを検証するために使う。
 */
function unescapeMarkdownCell(escaped: string): string {
  let out = "";
  for (let i = 0; i < escaped.length; i++) {
    if (escaped[i] === "\\" && (escaped[i + 1] === "\\" || escaped[i + 1] === "|")) {
      out += escaped[i + 1];
      i++;
    } else {
      out += escaped[i];
    }
  }
  return out;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ");
}

describe("escapeMarkdownCell", () => {
  const cases: Record<string, string> = {
    "通常のASCII文字列": "PASS players page loads",
    "シングルクォート": "it's a 'test'",
    "ダブルクォート": 'say "hello"',
    "バックスラッシュ単体": "C:\\Development\\eFootball-Team-AI",
    "連続するバックスラッシュ": "a\\\\b\\\\\\c",
    "パイプ単体": "a|b|c",
    "バックスラッシュ直後にパイプ": "a\\|b",
    "パイプの直前・直後がバックスラッシュ": "\\|\\|\\",
    "テンプレートリテラルのバッククォート": "`template`",
    "${...}に見える文字列": "${process.env.SECRET}",
    "script終了タグに見える文字列": "</script><script>alert(1)</script>",
    "HTML特殊文字": "<div class=\"x\">&amp;</div>",
    "Unicode文字": "こんにちは 🎉 café",
    "改行": "line1\nline2",
    "CRLF": "line1\r\nline2",
    "引用符とバックスラッシュの混在": "\"a\\b\" and 'c\\d'",
    "バックスラッシュと改行の混在": "a\\\nb\\\r\nc",
    "非常に長い文字列": "x".repeat(5000) + "\\|" + "y".repeat(5000),
  };

  for (const [label, input] of Object.entries(cases)) {
    it(`${label}: エスケープ後、逆変換すると改行を除いて元の文字列と一致する(表を壊さない)`, () => {
      const escaped = escapeMarkdownCell(input);
      expect(unescapeMarkdownCell(escaped)).toBe(normalizeNewlines(input));
    });
  }

  it("エスケープ後の文字列は、単独のバックスラッシュ(直後がバックスラッシュでもパイプでもない)を含まない", () => {
    for (const input of Object.values(cases)) {
      const escaped = escapeMarkdownCell(input);
      for (let i = 0; i < escaped.length; i++) {
        if (escaped[i] === "\\") {
          expect(escaped[i + 1] === "\\" || escaped[i + 1] === "|").toBe(true);
          i++;
        }
      }
    }
  });

  it("エスケープ後の文字列は、生の改行を含まない(テーブル行が崩れない)", () => {
    for (const input of Object.values(cases)) {
      expect(escapeMarkdownCell(input)).not.toMatch(/\r|\n/);
    }
  });

  it("エスケープ後の文字列に、エスケープされていない裸のパイプが残らない", () => {
    for (const input of Object.values(cases)) {
      const escaped = escapeMarkdownCell(input);
      for (let i = 0; i < escaped.length; i++) {
        if (escaped[i] === "|") {
          expect(escaped[i - 1]).toBe("\\");
        }
      }
    }
  });

  it("空文字列は空文字列のまま", () => {
    expect(escapeMarkdownCell("")).toBe("");
  });

  it("数値や真偽値を渡してもクラッシュせず文字列化する", () => {
    expect(escapeMarkdownCell(String(123))).toBe("123");
    expect(escapeMarkdownCell(String(true))).toBe("true");
  });
});
