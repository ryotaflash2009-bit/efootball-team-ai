/**
 * Phase Dのシャドー比較で確認された2件の差分を修正するための、実Supabase(PostgreSQL)への
 * 差分投入ツール。
 *
 * 既存の`pg-real-import.mjs`(初回投入)・`pg-detail-extension-import.mjs`
 * (不足フィールド追加、既に実行・COMMIT済み)のいずれとも別物。このツールは
 * 既に投入済みの3テーブルへ、以下の追加列だけをUPDATEする
 * (`src/lib/reference-data/real-import-phase-d-remediation-orchestrator.ts`を使う)。
 *   - world_player_cards.name_sort_key
 *   - managers.name_sort_key
 *   - player_card_analysis.efhub_name_en
 *
 *   既定(引数なし)                                                  : dry-run。外部接続は一切行わない。
 *   node scripts/migration/pg-phase-d-remediation-import.mjs --validate-only : 接続文字列の組み立て・
 *     検証だけを行う。実接続はしない。
 *   node scripts/migration/pg-phase-d-remediation-import.mjs --execute        : 実接続してUPDATEする。
 *
 * `--validate-only`/`--execute`時に読み取る環境変数は既存の差分投入ツールと同じ4つ
 * (MIGRATION_TARGET_LABEL/MIGRATION_PG_CONNECTION_TEMPLATE/MIGRATION_PG_PASSWORD/
 * MIGRATION_PG_CA_CERT_PATH、CA証明書は必須)。値は常にログへ出力しない。
 * 通常はこのファイルを直接実行せず、`scripts/migration/secure-connect.ps1`
 * (`-Tool PhaseDRemediation`指定)経由で実行すること。
 * rejectUnauthorizedはいかなる場合もtrue固定(緩めない)。
 *
 * 対象は reference_data.world_player_cards / reference_data.managers /
 * reference_data.player_card_analysis の既存行への追加列UPDATEのみに固定されている
 * (real-import-guards.tsの許可リストで多層防御)。新しい行のINSERT/DELETEは一切行わない。
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "..", "lib", "ts-extension-resolve-hook.mjs")));

const { computeNameSortKey } = await import("../../src/lib/reference-data/name-sort-key.ts");
const { computeDatasetVersion, computePayloadHash } = await import("../../src/lib/reference-data/migration-transform.ts");
const { parseExecuteFlag, parseValidateOnlyFlag, sanitizeErrorMessage } = await import("../../src/lib/reference-data/real-import-guards.ts");
const { runPhaseDRemediationImport } = await import("../../src/lib/reference-data/real-import-phase-d-remediation-orchestrator.ts");
const { buildAndValidateConnectionString, extractProjectRefFromSupabaseUrl } = await import("../../src/lib/reference-data/connection-string-builder.ts");
const { extractSupabaseUrlFromEnvFileContent } = await import("../../src/lib/reference-data/local-env-file.ts");
const { buildPgSslConfig, loadCaCertificateFromFile, describeSslConfigForLog, checkCaCertPathProvided } = await import(
  "../../src/lib/reference-data/pg-ssl-config.ts"
);

const ROOT = path.resolve(HERE, "..", "..");
const DB_PATH = path.join(ROOT, "data", "efootball.db");
const CA_CERT_PATH_ENV = "MIGRATION_PG_CA_CERT_PATH";
const TEMPLATE_ENV = "MIGRATION_PG_CONNECTION_TEMPLATE";
const PASSWORD_ENV = "MIGRATION_PG_PASSWORD";
const TARGET_LABEL_ENV = "MIGRATION_TARGET_LABEL";
const EXPECTED_WORLD_COUNT = 13009;
const EXPECTED_MANAGER_COUNT = 66;
const EXPECTED_ANALYSIS_COUNT = 19;

async function resolveExpectedProjectRef() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return extractProjectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  }
  try {
    const content = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    const url = extractSupabaseUrlFromEnvFileContent(content);
    return url ? extractProjectRefFromSupabaseUrl(url) : null;
  } catch {
    return null;
  }
}

function readAndTransform(db, now) {
  const worldRows = db.prepare("SELECT world_card_id, name_en FROM world_player_cards").all();
  const worldLiveOrder = db
    .prepare("SELECT world_card_id FROM world_player_cards ORDER BY name_en COLLATE NOCASE ASC, world_card_id ASC")
    .all()
    .map((r) => r.world_card_id);
  const worldNameSortKeyUpdates = worldRows.map((r) => ({ world_card_id: r.world_card_id, name_sort_key: computeNameSortKey(r.name_en) }));

  const managerRows = db.prepare("SELECT internal_manager_id, name_en FROM managers").all();
  const managersLiveOrder = db
    .prepare("SELECT internal_manager_id FROM managers ORDER BY name_en COLLATE NOCASE ASC, internal_manager_id ASC")
    .all()
    .map((r) => r.internal_manager_id);
  const managerNameSortKeyUpdates = managerRows.map((r) => ({ internal_manager_id: r.internal_manager_id, name_sort_key: computeNameSortKey(r.name_en) }));

  const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='player_cards'").get() != null;
  const analysisRawRows = tableExists ? db.prepare("SELECT efhub_card_id, name_en FROM player_cards").all() : [];
  const worldIdSet = new Set(worldRows.map((r) => r.world_card_id));
  const orphanIds = analysisRawRows.filter((r) => !worldIdSet.has(r.efhub_card_id)).map((r) => r.efhub_card_id);
  const analysisNameUpdates = analysisRawRows
    .filter((r) => worldIdSet.has(r.efhub_card_id))
    .map((r) => ({ world_card_id: r.efhub_card_id, efhub_name_en: r.name_en }));

  // JS側の再ソート結果がSQLiteの実際のライブクエリ順序と完全一致するかを検証する(実接続前に必ず確認する)。
  function validateOrder(liveOrderIds, rows, pkField, isNumericPk) {
    const resorted = [...rows].sort((a, b) => {
      const ka = a.name_sort_key ?? "";
      const kb = b.name_sort_key ?? "";
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return isNumericPk ? a[pkField] - b[pkField] : String(a[pkField]).localeCompare(String(b[pkField]));
    });
    return JSON.stringify(resorted.map((r) => r[pkField])) === JSON.stringify(liveOrderIds);
  }
  const worldOrderOk = validateOrder(worldLiveOrder, worldNameSortKeyUpdates, "world_card_id", false);
  const managersOrderOk = validateOrder(managersLiveOrder, managerNameSortKeyUpdates, "internal_manager_id", true);

  return {
    worldNameSortKeyUpdates,
    managerNameSortKeyUpdates,
    analysisNameUpdates,
    orphanIds,
    worldOrderOk,
    managersOrderOk,
    worldBatchId: randomUUID(),
    managerBatchId: randomUUID(),
    analysisBatchId: randomUUID(),
    datasetVersions: {
      world: computeDatasetVersion("world-name-sort-key", now),
      managers: computeDatasetVersion("managers-name-sort-key", now),
      analysis: computeDatasetVersion("analysis-name", now),
    },
  };
}

async function main() {
  const execute = parseExecuteFlag(process.argv);
  const validateOnly = parseValidateOnlyFlag(process.argv);
  const mode = execute ? "実投入(--execute)" : validateOnly ? "接続準備の検証のみ(--validate-only、実接続なし)" : "dry-run(既定)";
  console.log(`モード: ${mode}`);
  console.log("この投入は既存13,009/66/19件の再投入ではなく、name_sort_key/efhub_name_en列だけのUPDATEである。");

  const stat = await fs.stat(DB_PATH);
  console.log(`SQLiteファイルサイズ: ${stat.size} バイト、更新日時: ${stat.mtime.toISOString()}`);

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const integrityResult = db.prepare("PRAGMA integrity_check").all()[0]?.integrity_check ?? "unknown";
  console.log(`SQLite integrity_check: ${integrityResult}`);
  if (integrityResult.trim().toLowerCase() !== "ok") {
    console.error("integrity_checkが'ok'以外を返したため中止します。");
    db.close();
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const data = readAndTransform(db, now);
  db.close();

  console.log("");
  console.log(`world_player_cards 更新対象: ${data.worldNameSortKeyUpdates.length}件(期待値${EXPECTED_WORLD_COUNT}件) / 並び順検証=${data.worldOrderOk}`);
  console.log(`managers 更新対象: ${data.managerNameSortKeyUpdates.length}件(期待値${EXPECTED_MANAGER_COUNT}件) / 並び順検証=${data.managersOrderOk}`);
  console.log(`player_card_analysis 更新対象: ${data.analysisNameUpdates.length}件(期待値${EXPECTED_ANALYSIS_COUNT}件) / 孤立参照=${data.orphanIds.length}件`);

  if (!data.worldOrderOk || !data.managersOrderOk) {
    console.error("name_sort_keyの並び順検証に失敗したため、接続前に中止します(SQLite実測順序と不一致)。");
    process.exitCode = 1;
    return;
  }
  if (data.orphanIds.length > 0) {
    console.error("孤立参照が見つかったため、接続前に中止します。");
    process.exitCode = 1;
    return;
  }
  if (
    data.worldNameSortKeyUpdates.length !== EXPECTED_WORLD_COUNT ||
    data.managerNameSortKeyUpdates.length !== EXPECTED_MANAGER_COUNT ||
    data.analysisNameUpdates.length !== EXPECTED_ANALYSIS_COUNT
  ) {
    console.error(
      `件数が想定(${EXPECTED_WORLD_COUNT}/${EXPECTED_MANAGER_COUNT}/${EXPECTED_ANALYSIS_COUNT})と一致しないため、接続前に中止します。` +
        `実測: ${data.worldNameSortKeyUpdates.length}/${data.managerNameSortKeyUpdates.length}/${data.analysisNameUpdates.length}`,
    );
    process.exitCode = 1;
    return;
  }

  const payloadHashes = {
    world: computePayloadHash(data.worldNameSortKeyUpdates),
    managers: computePayloadHash(data.managerNameSortKeyUpdates),
    analysis: computePayloadHash(data.analysisNameUpdates),
  };
  console.log("");
  console.log(
    `payload_hash: world=${payloadHashes.world.slice(0, 16)}... managers=${payloadHashes.managers.slice(0, 16)}... analysis=${payloadHashes.analysis.slice(0, 16)}...`,
  );

  if (!execute && !validateOnly) {
    console.log("");
    console.log("dry-runのため、ここで終了します(外部接続0回)。接続準備を確認するには --validate-only、実投入するには --execute を指定してください。");
    return;
  }

  const targetLabel = process.env[TARGET_LABEL_ENV];
  if (!targetLabel) {
    console.error(`環境変数 ${TARGET_LABEL_ENV} が設定されていません。secure-connect.ps1経由で実行してください。`);
    process.exitCode = 1;
    return;
  }
  console.log("");
  console.log(`対象環境: ${targetLabel}`);

  const connectionTemplate = process.env[TEMPLATE_ENV];
  const password = process.env[PASSWORD_ENV];
  if (!connectionTemplate) {
    console.error(`環境変数 ${TEMPLATE_ENV} が設定されていません。secure-connect.ps1経由で実行してください。`);
    process.exitCode = 1;
    return;
  }
  if (!password) {
    console.error(`環境変数 ${PASSWORD_ENV} が設定されていません。secure-connect.ps1経由で実行してください。`);
    process.exitCode = 1;
    return;
  }

  const expectedProjectRef = await resolveExpectedProjectRef();
  const buildResult = buildAndValidateConnectionString({ template: connectionTemplate, password, expectedProjectRef });
  if (!buildResult.ok) {
    console.error(`接続文字列の検証に失敗したため中止します: ${buildResult.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`接続文字列の検証に成功しました(形式: ${buildResult.poolerType} pooler)。接続文字列の内容自体は表示しません。`);

  const caCertPath = process.env[CA_CERT_PATH_ENV];
  const caCertPathCheck = checkCaCertPathProvided(caCertPath);
  if (!caCertPathCheck.ok) {
    console.error(`実接続前に中止します: ${caCertPathCheck.reason}(環境変数 ${CA_CERT_PATH_ENV} で指定する)`);
    process.exitCode = 1;
    return;
  }
  let caCertPem;
  try {
    caCertPem = loadCaCertificateFromFile(caCertPath);
  } catch (err) {
    console.error(`CA証明書の読み込みに失敗したため中止します: ${err?.message ?? err}`);
    process.exitCode = 1;
    return;
  }
  const sslConfig = buildPgSslConfig(caCertPem);
  console.log(`SSL設定: ${describeSslConfigForLog(sslConfig)}`);

  if (validateOnly) {
    console.log("");
    console.log("検証OK: 入力準備が完了しました(--validate-onlyのため、ここでは接続していません)。");
    return;
  }

  const connectionString = buildResult.connectionString;
  const pg = await import("pg");
  const client = new pg.Client({ connectionString, ssl: sslConfig });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    console.log("PostgreSQLへ接続しました。");

    const result = await runPhaseDRemediationImport(client, {
      worldNameSortKeyUpdates: data.worldNameSortKeyUpdates,
      managerNameSortKeyUpdates: data.managerNameSortKeyUpdates,
      analysisNameUpdates: data.analysisNameUpdates,
      worldBatchId: data.worldBatchId,
      managerBatchId: data.managerBatchId,
      analysisBatchId: data.analysisBatchId,
      datasetVersions: data.datasetVersions,
      payloadHashes,
      chunkSize: 2000,
      expectedWorldCount: EXPECTED_WORLD_COUNT,
      expectedManagerCount: EXPECTED_MANAGER_COUNT,
      expectedAnalysisCount: EXPECTED_ANALYSIS_COUNT,
    });

    console.log("");
    console.log(`結果: ${result.decision.toUpperCase()}`);
    if (result.reasons.length > 0) {
      console.log(`理由: ${result.reasons.join(" / ")}`);
    }
    process.exitCode = result.decision === "commit" ? 0 : 1;
  } catch (err) {
    const message = sanitizeErrorMessage(String(err?.message ?? err), [connectionTemplate, password, connectionString]);
    console.error(`投入処理でエラーが発生し、ROLLBACKしました(または接続に失敗しました): ${message}`);
    process.exitCode = 1;
  } finally {
    if (connected) {
      await client.end();
      console.log("PostgreSQL接続を切断しました。");
    }
  }
}

main().catch((err) => {
  console.error("予期しないエラー:", err?.message ?? err);
  process.exitCode = 1;
});
