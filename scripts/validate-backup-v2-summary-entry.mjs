/**
 * Stage 3: Production Backup v2の非秘密要約artifactを検証するエントリー(ネットワーク・DB・Secretを使わない)。
 *
 *   npx tsc -p tsconfig.backup-summary-validation.json
 *   node scripts/validate-backup-v2-summary-entry.mjs ./data/<folder>/reference-data-backup-summary.json
 *
 * tscはCommonJSを出力し、repositoryのpackage.jsonは"type": "module"のため、
 * run-production-backup-entry.mjsと同じく出力先へ{"type":"commonjs"}のmarkerを書いてからimportする。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, "..", "dist-backup-summary-validation");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);

const { main } = await import("../dist-backup-summary-validation/reference-data/auto-update/backup-v2-summary-validator-cli.js");
main();
