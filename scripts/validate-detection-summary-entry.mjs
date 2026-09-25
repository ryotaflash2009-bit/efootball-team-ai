/**
 * 定期検出の非秘密要約artifactを検証するエントリー(ネットワーク・DB・Secretを使わない)。
 *
 *   npx tsc -p tsconfig.update-detection.json
 *   node scripts/validate-detection-summary-entry.mjs ./data/<folder>/reference-data-detection-summary.json
 *
 * tscはCommonJSを出力し、repositoryのpackage.jsonは"type": "module"のため、
 * 出力先へ{"type":"commonjs"}のmarkerを書いてからimportする(run-update-detection-entry.mjsと同じ)。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, "..", "dist-update-detection");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);

const { main } = await import("../dist-update-detection/reference-data/auto-update/detection-summary-validator-cli.js");
main();
