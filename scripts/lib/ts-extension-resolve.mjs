/**
 * Node の型の除去（.ts の直接実行）用の resolve hook。拡張子なしの相対 import（"./ja" 等）に ".ts" を補う。
 * 監査スクリプトが、分割した日本語の辞書（ja-ns/*.ts）を含む完全な辞書を読むため（2026-10-04）。
 * 2026-10-06: tsconfig の別名 "@/x"（→ src/x）も解決する（多言語の辞書が計算ライブラリの文の表を読み込むため）。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

function fromAlias(specifier) {
  const base = path.join(SRC, specifier.slice(2));
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const f = base + ext;
    if (existsSync(f) && (ext !== "" || /\.[cm]?[jt]sx?$/.test(f))) return pathToFileURL(f).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const url = fromAlias(specifier);
    if (url) return next(url, context);
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
    throw err;
  }
}
