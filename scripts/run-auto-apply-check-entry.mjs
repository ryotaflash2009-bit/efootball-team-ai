/**
 * 自動の Apply job の再確認（auto-apply-check-cli.ts）のエントリー。production-apply と同じ出力先を使う。
 *
 *   npx tsc -p tsconfig.production-apply.json
 *   node scripts/run-auto-apply-check-entry.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist-production-apply");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
const { main } = await import("../dist-production-apply/reference-data/auto-update/auto-apply-check-cli.js");
process.exitCode = main();
