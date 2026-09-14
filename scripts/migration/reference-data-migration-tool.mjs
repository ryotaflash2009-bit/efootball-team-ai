/**
 * 参照データ移行ツールの起動エントリ。
 *
 *   node scripts/migration/reference-data-migration-tool.mjs
 *
 * src/lib配下のTypeScriptファイル同士の拡張子省略import(Next.js/Vitestのバンドラー方式解決)を、
 * 素のNode ESMからも解決できるよう`ts-extension-resolve-hook.mjs`を先に登録してから
 * 本体(run-migration.mjs)を読み込む。フック自体は外部通信・書込みを行わない(ファイル存在確認のみ)。
 */
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "..", "lib", "ts-extension-resolve-hook.mjs")));

await import("./run-migration.mjs");
