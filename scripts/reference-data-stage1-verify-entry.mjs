/**
 * Stage 1 upstream読み取り検証のエントリー(本人承認済みの手動実行専用)。
 *
 *   npx tsc -p tsconfig.stage1-verification.json
 *   node scripts/reference-data-stage1-verify-entry.mjs probe|full
 *
 * backup entryと同じく、CommonJS出力を読み込むために出力先へ{"type":"commonjs"}を書いてから
 * compile済みのmain()を呼ぶだけの薄いシム(処理はstage1-verification-cli.tsにある)。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist-stage1-verification");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
const { main } = await import("../dist-stage1-verification/reference-data/auto-update/stage1-verification-cli.js");
process.exitCode = await main();
