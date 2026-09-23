/**
 * Production apply workflow(Stage 2時点ではpreflight modeだけ)のエントリー。
 *
 *   npx tsc -p tsconfig.production-apply.json
 *   REFERENCE_DATA_APPLY_MODE=preflight node scripts/run-production-apply-entry.mjs
 *
 * backup entryと同じく、CommonJS出力を読み込むために出力先へ{"type":"commonjs"}を書いてから
 * compile済みのmain()を呼ぶだけの薄いシム(処理はproduction-apply-cli.tsにある)。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist-production-apply");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
const { main } = await import("../dist-production-apply/reference-data/auto-update/production-apply-cli.js");
await main();
