import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { JA_CORE_NAMESPACES } from "./dictionaries/ja";
import { JA_SPLIT_NAMESPACES } from "./dictionaries/ja-ns/all";
import jaFull from "./dictionaries/ja-full";
import en from "./dictionaries/en";
import { jaSplitNamespace } from "./dictionaries/ja-registry";

/**
 * 日本語の辞書の分割（2026-10-04）の守り。核（ja.ts）以外の名前空間を使うファイルは、必ず ja-ns/<名前空間> を import する。
 * 忘れると client で文言が空になり、server の HTML と食い違う（hydration の不一致）。このテストで検出する。
 */
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "src");
const split = Object.keys(JA_SPLIT_NAMESPACES);
const core = [...JA_CORE_NAMESPACES] as string[];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !p.includes(path.join("i18n", "dictionaries"))) out.push(p);
  }
  return out;
}
const usesNamespace = (src: string, ns: string) =>
  new RegExp(`(\\bt|\\btranslate\\([^,]+,)\\s*\\(?\\s*["'\`]${ns}["'\`]|Dictionary\\[["']${ns}["']\\]|\\bt\\(["']${ns}["']`).test(src);

describe("日本語の辞書の分割", () => {
  it("核と分割の名前空間は重ならず、合わせると英語の辞書と同じ名前空間になる", () => {
    expect(core.filter((n) => split.includes(n))).toEqual([]);
    expect([...core, ...split].sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(jaFull).sort()).toEqual(Object.keys(en).sort());
  });

  it("分割した名前空間の module は import した時点で登録される", () => {
    for (const ns of split) expect(jaSplitNamespace(ns as never), ns).toBeDefined();
  });

  it("分割した名前空間を使うファイルは、ja-ns/<名前空間> を直接 import している（client で文言が空にならない）", () => {
    const missing: string[] = [];
    for (const f of sourceFiles(SRC)) {
      const src = readFileSync(f, "utf8");
      for (const ns of split) {
        if (usesNamespace(src, ns) && !src.includes(`@/lib/i18n/dictionaries/ja-ns/${ns}"`)) missing.push(`${path.relative(ROOT, f)} → ${ns}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("名前空間を変数で渡す t() は LocaleContext 以外で使わない（静的に確認できない使い方を増やさない）", () => {
    const dynamic = sourceFiles(SRC)
      .filter((f) => !f.endsWith(path.join("i18n", "LocaleContext.tsx")))
      .filter((f) => /\bt\(\s*(?!["'`])[A-Za-z_$][\w$]*\s*(as\b|,)/.test(readFileSync(f, "utf8").replace(/\/\/.*$/gm, "")))
      .map((f) => path.relative(ROOT, f));
    expect(dynamic).toEqual([]);
  });

  it("全画面の殻（layout・AppShell・Header・Footer・Sidebar・言語の切り替え）は核の名前空間だけを使う", () => {
    for (const f of ["components/AppShell.tsx", "components/Header.tsx", "components/Footer.tsx", "components/Sidebar.tsx", "components/LanguageSwitcher.tsx", "components/auth/HeaderAccountNav.tsx"]) {
      const src = readFileSync(path.join(SRC, f), "utf8");
      for (const ns of split) expect(usesNamespace(src, ns), `${f} uses ${ns}`).toBe(false);
    }
  });
});
