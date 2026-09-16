import { describe, it, expect } from "vitest";
import { asciiNocaseFold, computeNameSortKey, compareNocaseCompatible } from "./name-sort-key";

describe("asciiNocaseFold", () => {
  it("ASCIIの大文字だけを小文字へ畳み込む", () => {
    expect(asciiNocaseFold("ABCxyz")).toBe("abcxyz");
  });
  it("非ASCII文字(ダイアクリティカルマーク付き)は一切変更しない(SQLiteのNOCASE仕様どおり)", () => {
    // "å"はASCII範囲外のため畳み込み対象外(元の大文字小文字のまま)。ASCII部分の"St"→"st"だけ畳み込まれる。
    expect(asciiNocaseFold("Ståle")).toBe("ståle");
    expect(asciiNocaseFold("STÅLE")).toBe("stÅle");
    expect(asciiNocaseFold("Aarón")).toBe("aarón");
  });
  it("記号・空白・数字はそのまま", () => {
    expect(asciiNocaseFold("O'Brien-123 Jr.")).toBe("o'brien-123 jr.");
  });
  it("空文字はそのまま", () => {
    expect(asciiNocaseFold("")).toBe("");
  });
});

describe("computeNameSortKey", () => {
  it("null/undefinedはnullを返す", () => {
    expect(computeNameSortKey(null)).toBeNull();
    expect(computeNameSortKey(undefined)).toBeNull();
  });
  it("通常の文字列はasciiNocaseFoldと同じ結果", () => {
    expect(computeNameSortKey("Pavel Nedvěd")).toBe("pavel nedvěd");
  });
});

describe("compareNocaseCompatible", () => {
  it("大文字小文字の違いを無視して比較する(ASCII)", () => {
    expect(compareNocaseCompatible("apple", "APPLE")).toBe(0);
    expect(compareNocaseCompatible("Apple", "banana")).toBeLessThan(0);
  });

  it("非ASCII文字はASCII文字より大きい(バイナリ比較のため) — SQLiteのNOCASE+BINARY比較を再現する", () => {
    // 実データで確認済みの実例: "Ståle" は "Steven" より後ろに来る(SQLite COLLATE NOCASE実測と一致)
    expect(compareNocaseCompatible("Steven", "Ståle")).toBeLessThan(0);
    // 実データで確認済みの実例: "Aarón" は "Aaron Ramsdale" より後ろに来る
    expect(compareNocaseCompatible("Aaron Ramsdale", "Aarón")).toBeLessThan(0);
  });

  it("完全に同じ文字列(畳み込み後)は0を返す", () => {
    expect(compareNocaseCompatible("Messi", "MESSI")).toBe(0);
  });
});
