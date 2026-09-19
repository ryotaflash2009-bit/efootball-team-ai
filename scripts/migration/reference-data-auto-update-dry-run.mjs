/**
 * 参照データ自動更新の dry-run 専用CLI(Phase 1)。
 *
 *   node scripts/migration/reference-data-auto-update-dry-run.mjs \
 *     --staging <取得結果JSON> --previous <前回スナップショットJSON> --schema <スキーマ設定JSON>
 *
 * このCLIは常にdry-runであり、`--execute`相当のフラグは存在しない(実装していない)。
 * ネットワーク接続・実DB接続を一切行わず、ローカルのJSONファイル3つだけを入力として、
 * schema validation → 差分計算 → safety gate → 更新計画の生成 → 監査ログ出力、までを行う。
 * 書込み(Supabaseへの反映)は一切行わない(writesPerformedは常に0)。
 *
 * 入力ファイルの想定形式:
 *   --staging  : { "table": string, "sourceMeta": {...}, "records": [{ "id": string, "fields": {...} }] }
 *   --previous : { "table": string, "records": [{ "id": string, "checksum": string }] }
 *   --schema   : { "idPattern": string(正規表現ソース), "requiredFields": string[],
 *                  "numericRanges"?: [{ "field": string, "min": number, "max": number }],
 *                  "knownFields": string[] }
 *
 * 実際の外部取得(efootball-world.com等)は、既存の`scripts/sync-*.mjs`群が既に
 * レート制限・タイムアウト・再試行上限・429/403即停止等を実装済みであるため、
 * それらの出力を本CLIが読める`--staging`形式へ変換する連携部分は、今回は未実装
 * (`docs/production-readiness/reference-data-auto-update-design.md`のPhase 2で設計)。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "..", "lib", "ts-extension-resolve-hook.mjs")));

const { generateUpdatePlan } = await import("../../src/lib/reference-data/auto-update/plan.ts");
const { buildAuditLogEntry } = await import("../../src/lib/reference-data/auto-update/audit-log.ts");

function readArg(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name}に値が指定されていない`);
  return value;
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("--execute")) {
    throw new Error("このCLIに--executeは存在しない(Phase 1はdry-run専用、実装していない)");
  }

  const stagingPath = readArg(argv, "--staging", null);
  const previousPath = readArg(argv, "--previous", null);
  const schemaPath = readArg(argv, "--schema", null);
  if (!stagingPath || !previousPath || !schemaPath) {
    throw new Error("--staging / --previous / --schema をすべて指定すること");
  }

  const maxDecreaseRatio = Number(readArg(argv, "--max-decrease-ratio", "0.05"));
  const maxIncreaseRatio = Number(readArg(argv, "--max-increase-ratio", "0.1"));
  const maxRemovedCount = Number(readArg(argv, "--max-removed-count", "9999999"));

  const staging = await readJson(stagingPath);
  const previous = await readJson(previousPath);
  const rawSchema = await readJson(schemaPath);
  const schemaConfig = {
    idPattern: new RegExp(rawSchema.idPattern),
    requiredFields: rawSchema.requiredFields ?? [],
    numericRanges: rawSchema.numericRanges ?? [],
    knownFields: rawSchema.knownFields ?? [],
  };

  console.log("=== 参照データ自動更新 dry-run ===");
  console.log(`モード: dry-run固定(このCLIに書込み経路は存在しない)`);
  console.log(`対象テーブル: ${staging.table}`);
  console.log(`取得元: ${staging.sourceMeta?.source ?? "(不明)"}`);
  console.log(`取得日時: ${staging.sourceMeta?.fetchedAt ?? "(不明)"}`);

  const plan = generateUpdatePlan({
    staging,
    previous,
    schemaConfig,
    diffThresholds: { maxDecreaseRatio, maxIncreaseRatio, maxRemovedCount },
  });

  const auditEntry = buildAuditLogEntry(plan, staging.sourceMeta, new Date().toISOString());

  console.log("\n--- 差分レポート ---");
  console.log(`前回件数: ${plan.diff.previousCount} / 今回件数: ${plan.diff.candidateCount}`);
  console.log(`追加: ${plan.diff.addedCount}件 / 更新: ${plan.diff.updatedCount}件 / 削除: ${plan.diff.removedCount}件 / 不変: ${plan.diff.unchangedCount}件`);

  console.log("\n--- schema validation ---");
  console.log(`有効: ${plan.schemaValidCount}件 / 無効: ${plan.schemaInvalidCount}件`);
  if (plan.unknownFields.length > 0) console.log(`未知フィールド: ${plan.unknownFields.join(", ")}`);
  if (plan.duplicateIds.length > 0) console.log(`重複ID: ${plan.duplicateIds.join(", ")}`);

  console.log("\n--- 判定 ---");
  console.log(`decision: ${plan.decision}`);
  if (plan.reasons.length > 0) {
    console.log("理由:");
    for (const r of plan.reasons) console.log(`  - ${r}`);
  }
  console.log(`writesPerformed: ${plan.writesPerformed}(常に0、このCLIは書込みを一切行わない)`);

  console.log("\n--- 監査ログエントリー(JSON) ---");
  console.log(JSON.stringify(auditEntry, null, 2));

  if (plan.decision !== "apply-candidate") {
    console.log("\n結論: この候補データは安全ゲートを通過しなかったため、適用不可と判定(書込みは行っていない)。");
    process.exitCode = 1;
  } else {
    console.log("\n結論: 安全ゲートを通過(apply-candidate)。ただし本CLIは書込みを一切行わない。実適用にはPhase 2の人による承認付き適用処理(未実装)が必要。");
  }
}

main().catch((err) => {
  console.error(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
