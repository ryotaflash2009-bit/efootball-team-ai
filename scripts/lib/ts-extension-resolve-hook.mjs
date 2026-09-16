/**
 * scripts/配下のプレーンなNode ESM(.mjs)から、src/lib配下のTypeScriptファイルを
 * 拡張子省略の相対import(例: "../world/player-image")、および"@/"パスエイリアス
 * (tsconfig.jsonの"@/*": ["./src/*"]と同じ意味、例: "@/lib/world/mappers")で
 * 参照できるようにするための最小限のresolveフック。
 *
 * Next.js/Vitestはバンドラー方式の解決(拡張子省略・パスエイリアス可)を行うが、
 * 素のNode ESMはそのいずれもサポートしないため、このフックで
 * ".ts"/".tsx"/"/index.ts"を順に試して解決する。
 * 外部通信・ファイル書込みは行わない(既存ファイルの存在確認のみ)。
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];
// このファイルの2階層上(scripts/lib → scripts → リポジトリルート)がtsconfig.jsonの基準ディレクトリ。
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALIAS_PREFIX = "@/";

function resolveCandidates(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = basePath + suffix;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(ALIAS_PREFIX)) {
    // tsconfig.jsonの "@/*": ["./src/*"] と同じ規則(素のNode ESMはこのエイリアスを知らないため代替解決する)。
    const basePath = path.join(REPO_ROOT, "src", specifier.slice(ALIAS_PREFIX.length));
    const candidate = resolveCandidates(basePath);
    if (candidate) return nextResolve(pathToFileURL(candidate).href, context);
    throw new Error(`ts-extension-resolve-hook: "@/"エイリアスを解決できない: ${specifier}`);
  }
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return nextResolve(specifier, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND" && err?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw err;
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const basePath = path.resolve(path.dirname(parentPath), specifier);
    const candidate = resolveCandidates(basePath);
    if (candidate) return nextResolve(pathToFileURL(candidate).href, context);
    throw err;
  }
}
