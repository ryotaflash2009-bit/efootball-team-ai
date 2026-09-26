/**
 * 更新パイプラインの自動進行のエントリー(Secretを使わない。GITHUB_TOKEN の actions: write だけ)。
 *
 *   npx tsc -p tsconfig.update-orchestrator.json
 *   GH_TOKEN=... GITHUB_REPOSITORY=owner/repo ORCHESTRATOR_DETECTION_RUN_ID=... ORCHESTRATOR_WORK_DIR=/abs/dir node scripts/run-update-orchestrator-entry.mjs
 *
 * run-update-detection-entry.mjsと同じく、CommonJS出力の隣に{"type":"commonjs"}のmarkerを書いてからimportする。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, "..", "dist-update-orchestrator");
writeFileSync(join(distDir, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);

const { main } = await import("../dist-update-orchestrator/reference-data/auto-update/update-orchestrator-cli.js");
process.exitCode = await main();
