/**
 * 定期検出のエントリー(Secret・Environment・Productionを使わない)。
 *
 *   npx tsc -p tsconfig.update-detection.json
 *   REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED=true node scripts/run-update-detection-entry.mjs
 *
 * run-production-backup-entry.mjsと同じく、CommonJS出力の隣に{"type":"commonjs"}のmarkerを書いてからimportする。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, "..", "dist-update-detection");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);

const { main } = await import("../dist-update-detection/reference-data/auto-update/update-detection-cli.js");
process.exitCode = await main();
