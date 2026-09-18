/**
 * 参照データの実Supabase(PostgreSQL)への「詳細フィールド追加」差分投入ツール。
 *
 * 既存の`pg-real-import.mjs`(初回投入、INSERT専用、空テーブル前提)とは別物。
 * このツールは既に投入済みの`reference_data.world_player_cards`(13,009件)・
 * `reference_data.managers`(66件)に対して、追加した列(efhub_card_id/ai_styles/
 * appearance/efhub_conflicts/boosters/link_up_plays)だけをUPDATEする
 * (`src/lib/reference-data/real-import-detail-extension-orchestrator.ts`を使う)。
 *
 *   既定(引数なし)                                              : dry-run。外部接続は一切行わない。
 *   node scripts/migration/pg-detail-extension-import.mjs --validate-only : 接続文字列の組み立て・
 *     検証だけを行う。実接続はしない。
 *   node scripts/migration/pg-detail-extension-import.mjs --execute        : 実接続してUPDATEする。
 *
 * `--validate-only`/`--execute`時に読み取る環境変数は`pg-real-import.mjs`と同じ3つ
 * (MIGRATION_TARGET_LABEL/MIGRATION_PG_CONNECTION_TEMPLATE/MIGRATION_PG_PASSWORD)+
 * 任意のMIGRATION_PG_CA_CERT_PATH。値は常にログへ出力しない。
 * 通常はこのファイルを直接実行せず、`scripts/migration/secure-connect.ps1`
 * (`-Tool DetailExtension`指定、非表示入力・使用後の環境変数削除を行うラッパー)経由で実行すること。
 * rejectUnauthorizedはいかなる場合もtrue固定(緩めない)。
 *
 * 対象は reference_data.world_player_cards / reference_data.managers の
 * 既存行への追加列UPDATEのみに固定されている(real-import-guards.tsの許可リストで多層防御)。
 * public/authスキーマ・my_team_snapshots・rls_probe_records・既存ユーザーのデータ・
 * player_card_analysis・import_batchesの既存行(target_table以外)は一切操作しない。
 * 新しい行のINSERT/DELETEは一切行わない(既存行の追加列だけをUPDATEする)。
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "..", "lib", "ts-extension-resolve-hook.mjs")));

const {
  buildEfhubLinkMap,
  buildAiStylesMap,
  buildAppearanceMap,
  buildEfhubConflictsMap,
  buildManagerBoostersMap,
  buildManagerLinkUpPlaysMap,
  findOrphanIds,
} = await import("../../src/lib/reference-data/detail-extension-transform.ts");
const { computeDatasetVersion, computePayloadHash } = await import("../../src/lib/reference-data/migration-transform.ts");
const { parseExecuteFlag, parseValidateOnlyFlag, sanitizeErrorMessage } = await import("../../src/lib/reference-data/real-import-guards.ts");
const { runDetailExtensionImport } = await import("../../src/lib/reference-data/real-import-detail-extension-orchestrator.ts");
const { buildAndValidateConnectionString, extractProjectRefFromSupabaseUrl } = await import("../../src/lib/reference-data/connection-string-builder.ts");
const { buildPgSslConfig, loadCaCertificateFromFile, describeSslConfigForLog, checkCaCertPathProvided } = await import(
  "../../src/lib/reference-data/pg-ssl-config.ts"
);
const { extractSupabaseUrlFromEnvFileContent } = await import("../../src/lib/reference-data/local-env-file.ts");

const ROOT = path.resolve(HERE, "..", "..");
// MIGRATION_DB_PATH_OVERRIDE/MIGRATION_EXPECTED_*_COUNTは、クリーンcheckout(実DBを
// 含まない)でのCLIテストが、実DB(data/efootball.db、13,009/66件)を必要とせず
// 最小限の合成フィクスチャDBで完結できるようにするためのテスト専用の差し替え口である
// (pg-real-import.mjs/pg-phase-d-remediation-import.mjsと同じ仕組み)。通常運用
// (secure-connect.ps1経由)ではいずれも設定されず、既定値(実DBパス・実件数)のままなので、
// 本番の挙動・安全性(件数一致ゲート等)は一切変わらない。
const DB_PATH = process.env.MIGRATION_DB_PATH_OVERRIDE || path.join(ROOT, "data", "efootball.db");
const CA_CERT_PATH_ENV = "MIGRATION_PG_CA_CERT_PATH";
const TEMPLATE_ENV = "MIGRATION_PG_CONNECTION_TEMPLATE";
const PASSWORD_ENV = "MIGRATION_PG_PASSWORD";
const TARGET_LABEL_ENV = "MIGRATION_TARGET_LABEL";
const EXPECTED_WORLD_COUNT = Number(process.env.MIGRATION_EXPECTED_WORLD_COUNT || 13009);

/**
 * 接続文字列の「別プロジェクト取り違え」検出のためだけに、project ref(非秘密値)を解決する。
 * 通常のnodeプロセスは`.env.local`を自動読み込みしないため、環境変数に無ければ
 * `.env.local`から`NEXT_PUBLIC_SUPABASE_URL`の行だけを読む(publishable key等は読まない)。
 * 取得できなくても致命的エラーにはしない(project ref突合はあくまで追加の安全網のため)。
 */
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
const EXPECTED_MANAGER_COUNT = Number(process.env.MIGRATION_EXPECTED_MANAGER_COUNT || 66);

function readAndTransform(db, now) {
  const worldIds = new Set(db.prepare("SELECT world_card_id FROM world_player_cards").all().map((r) => r.world_card_id));
  const linkRows = db.prepare("SELECT internal_card_id, source, source_card_id FROM source_record_links").all();
  const efhubLinkMap = buildEfhubLinkMap(linkRows);
  const aiStylesMap = buildAiStylesMap(db.prepare("SELECT world_card_id, style_name, display_order FROM world_player_ai_styles").all());
  const appearanceMap = buildAppearanceMap(db.prepare("SELECT * FROM world_player_appearances").all());
  const conflictsMap = buildEfhubConflictsMap(db.prepare("SELECT world_card_id, field_name, efhub_value, world_value FROM data_conflicts").all());

  const orphanCount =
    findOrphanIds(efhubLinkMap.keys(), worldIds).length +
    findOrphanIds(aiStylesMap.keys(), worldIds).length +
    findOrphanIds(appearanceMap.keys(), worldIds).length +
    findOrphanIds(conflictsMap.keys(), worldIds).length;

  const worldUpdates = [...worldIds].map((id) => ({
    world_card_id: id,
    efhub_card_id: efhubLinkMap.get(id) ?? null,
    ai_styles: aiStylesMap.get(id) ?? [],
    appearance: appearanceMap.get(id) ?? null,
    efhub_conflicts: conflictsMap.get(id) ?? [],
  }));

  const managerIds = new Set(db.prepare("SELECT internal_manager_id FROM managers").all().map((r) => String(r.internal_manager_id)));
  const boostersMap = buildManagerBoostersMap(db.prepare("SELECT * FROM manager_boosters").all());
  const linkUpPlaysMap = buildManagerLinkUpPlaysMap(
    db.prepare("SELECT * FROM manager_link_up_plays").all(),
    db.prepare("SELECT * FROM manager_link_up_conditions").all(),
  );
  const managerOrphanCount =
    findOrphanIds([...boostersMap.keys()].map(String), managerIds).length + findOrphanIds([...linkUpPlaysMap.keys()].map(String), managerIds).length;

  const managerUpdates = [...managerIds].map((idStr) => {
    const id = Number(idStr);
    return { internal_manager_id: id, boosters: boostersMap.get(id) ?? [], link_up_plays: linkUpPlaysMap.get(id) ?? [] };
  });

  return {
    worldUpdates,
    managerUpdates,
    worldBatchId: randomUUID(),
    managerBatchId: randomUUID(),
    datasetVersions: { world: computeDatasetVersion("world-detail", now), managers: computeDatasetVersion("managers-detail", now) },
    totalOrphans: orphanCount + managerOrphanCount,
  };
}

async function main() {
  const execute = parseExecuteFlag(process.argv);
  const validateOnly = parseValidateOnlyFlag(process.argv);
  const mode = execute ? "実投入(--execute)" : validateOnly ? "接続準備の検証のみ(--validate-only、実接続なし)" : "dry-run(既定)";
  console.log(`モード: ${mode}`);
  console.log("この投入は既存13,009/66件の再投入ではなく、追加列(efhub_card_id/ai_styles/appearance/efhub_conflicts/boosters/link_up_plays)だけのUPDATEである。");

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
  console.log(`world_player_cards 更新対象: ${data.worldUpdates.length}件(期待値${EXPECTED_WORLD_COUNT}件) / dataset_version=${data.datasetVersions.world}`);
  console.log(`managers 更新対象: ${data.managerUpdates.length}件(期待値${EXPECTED_MANAGER_COUNT}件) / dataset_version=${data.datasetVersions.managers}`);
  console.log(`孤立参照(world_player_cards/managersに存在しないID): ${data.totalOrphans}件`);

  if (data.totalOrphans > 0) {
    console.error("孤立参照が見つかったため、接続前に中止します。");
    process.exitCode = 1;
    return;
  }
  if (data.worldUpdates.length !== EXPECTED_WORLD_COUNT || data.managerUpdates.length !== EXPECTED_MANAGER_COUNT) {
    console.error(
      `件数が想定(${EXPECTED_WORLD_COUNT}/${EXPECTED_MANAGER_COUNT})と一致しないため、接続前に中止します。実測: ${data.worldUpdates.length}/${data.managerUpdates.length}`,
    );
    process.exitCode = 1;
    return;
  }

  const payloadHashes = { world: computePayloadHash(data.worldUpdates), managers: computePayloadHash(data.managerUpdates) };
  console.log("");
  console.log(`payload_hash: world=${payloadHashes.world.slice(0, 16)}... managers=${payloadHashes.managers.slice(0, 16)}...`);

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

  // NEXT_PUBLIC_SUPABASE_URLはクライアントへ公開済みの非秘密値。ここから抽出したproject refは
  // 「別プロジェクトの接続情報を誤って貼り付けていないか」の追加検証にのみ使い、画面には出さない。
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

    const result = await runDetailExtensionImport(client, {
      worldUpdates: data.worldUpdates,
      managerUpdates: data.managerUpdates,
      worldBatchId: data.worldBatchId,
      managerBatchId: data.managerBatchId,
      datasetVersions: data.datasetVersions,
      payloadHashes,
      chunkSize: 2000,
      expectedWorldCount: EXPECTED_WORLD_COUNT,
      expectedManagerCount: EXPECTED_MANAGER_COUNT,
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
