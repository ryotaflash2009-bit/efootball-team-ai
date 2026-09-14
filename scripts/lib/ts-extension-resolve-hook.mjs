/**
 * scripts/配下のプレーンなNode ESM(.mjs)から、src/lib配下のTypeScriptファイルを
 * 拡張子省略の相対import(例: "../world/player-image")で参照できるようにするための
 * 最小限のresolveフック。
 *
 * Next.js/Vitestはバンドラー方式の解決(拡張子省略可)を行うが、素のNode ESMは
 * 相対importに拡張子を要求するため、このフックで".ts"/".tsx"/"/index.ts"を
 * 順に試して解決する。外部通信・ファイル書込みは行わない(既存ファイルの存在確認のみ)。
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return nextResolve(specifier, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND" && err?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw err;
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const basePath = path.resolve(path.dirname(parentPath), specifier);
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = basePath + suffix;
      if (fs.existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    throw err;
  }
}
