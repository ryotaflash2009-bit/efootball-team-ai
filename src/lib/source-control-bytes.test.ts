import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * ソースに制御文字（NUL など）をそのまま書かない（2026-10-07）。
 * そのまま書くと Git・grep がファイルをバイナリとして扱い、レビューで差分が見えなくなる。
 * 文字列・正規表現では `\u0000` のようなエスケープを使う。タブ・改行・CR は対象外。
 */
const ROOTS = ["src", "scripts"];
const EXT = /\.(ts|tsx|mjs|js)$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
}

describe("ソースの制御文字", () => {
  it("src と scripts の .ts/.tsx/.mjs/.js に生の制御文字が無い", () => {
    const files: string[] = [];
    for (const r of ROOTS) walk(r, files);
    expect(files.length).toBeGreaterThan(100);
    const bad = files.filter((f) => CONTROL.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
