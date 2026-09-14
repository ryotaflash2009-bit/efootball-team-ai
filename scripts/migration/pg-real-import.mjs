/**
 * 参照データの実Supabase(PostgreSQL)への初回投入ツール。
 *
 *   既定(引数なし)                                     : dry-run。外部接続は一切行わない。
 *   node scripts/migration/pg-real-import.mjs --validate-only : 接続文字列テンプレート+パスワードを
 *     組み立てて構造だけ検証する。実接続はしない(接続準備の確認専用)。
 *   node scripts/migration/pg-real-import.mjs --execute        : 実接続して投入する。
 *
 * `--validate-only`/`--execute`時は、接続文字列を組み立てるための2つの値を
 * 環境変数からのみ読み取る(コマンドライン引数・ログ・ファイルへは一切出力しない)。
 *   - MIGRATION_PG_CONNECTION_TEMPLATE: [YOUR-PASSWORD]プレースホルダーを含む接続文字列テンプレート
 *   - MIGRATION_PG_PASSWORD           : DBパスワード(生の値。本ツール側でURLエンコードする)
 *   - MIGRATION_PG_CA_CERT_PATH       : (任意)Supabase公式のCA証明書ファイルへのローカルパス。
 *     秘密情報ではない(公開CA証明書)ためコマンドライン引数として渡してもよいが、
 *     内容自体は常にログへ出力しない。省略時はNode既定のCAストアで検証する
 *     (Supabase Session poolerの証明書チェーンがそこに含まれない場合は
 *     "self-signed certificate in certificate chain"で失敗する。その場合はCA証明書の指定が必要)。
 * 通常はこのファイルを直接実行せず、`scripts/migration/secure-connect.ps1`
 * (非表示入力・使用後の環境変数削除を行うラッパー)経由で実行すること。
 * rejectUnauthorizedはいかなる場合もtrue固定(緩めない)。
 *
 * 対象は reference_data スキーマの4テーブルのみに固定されている
 * (src/lib/reference-data/real-import-guards.ts の許可リストで多層防御)。
 * public/authスキーマ・my_team_snapshots・rls_probe_records・既存ユーザーのデータは
 * 一切操作しない(SQLは常にreference_data.*への固定文のみ発行する)。
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
  computeDatasetVersion,
  computePayloadHash,
  transformWorldPlayerCard,
  validateWorldPlayerCard,
  transformManager,
  validateManager,
  transformPlayerCardAnalysis,
  findOrphanAnalysisRows,
  findDuplicateIds,
} = await import("../../src/lib/reference-data/migration-transform.ts");
const { parseExecuteFlag, parseValidateOnlyFlag, sanitizeErrorMessage, EXPECTED_COUNTS } = await import(
  "../../src/lib/reference-data/real-import-guards.ts"
);
const { runRealImport } = await import("../../src/lib/reference-data/real-import-orchestrator.ts");
const { buildAndValidateConnectionString } = await import("../../src/lib/reference-data/connection-string-builder.ts");
const { buildPgSslConfig, loadCaCertificateFromFile, describeSslConfigForLog } = await import("../../src/lib/reference-data/pg-ssl-config.ts");

const ROOT = path.resolve(HERE, "..", "..");
const DB_PATH = path.join(ROOT, "data", "efootball.db");
const CA_CERT_PATH_ENV = "MIGRATION_PG_CA_CERT_PATH";
const TEMPLATE_ENV = "MIGRATION_PG_CONNECTION_TEMPLATE";
const PASSWORD_ENV = "MIGRATION_PG_PASSWORD";
const TARGET_LABEL_ENV = "MIGRATION_TARGET_LABEL";

function tableExists(db, name) {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name) != null;
}

function readAndTransform(db, now) {
  const worldBatchId = randomUUID();
  const worldDatasetVersion = computeDatasetVersion("world", now);
  const cardsRaw = db.prepare("SELECT * FROM world_player_cards").all();
  const statsByCard = new Map();
  for (const row of db.prepare("SELECT * FROM world_player_stats").all()) {
    if (!statsByCard.has(row.world_card_id)) statsByCard.set(row.world_card_id, []);
    statsByCard.get(row.world_card_id).push(row);
  }
  const skillsByCard = new Map();
  for (const row of db.prepare("SELECT * FROM world_player_skills").all()) {
    if (!skillsByCard.has(row.world_card_id)) skillsByCard.set(row.world_card_id, []);
    skillsByCard.get(row.world_card_id).push(row);
  }
  const worldTransformed = cardsRaw.map((row) =>
    transformWorldPlayerCard(row, statsByCard.get(row.world_card_id) ?? [], skillsByCard.get(row.world_card_id) ?? [], worldDatasetVersion, worldBatchId),
  );
  const worldValidations = worldTransformed.map((row) => ({ row, result: validateWorldPlayerCard(row) }));
  const worldValid = worldValidations.filter((v) => v.result.ok).map((v) => v.row);
  const worldInvalid = worldValidations.filter((v) => !v.result.ok);
  const worldDupes = findDuplicateIds(worldTransformed, (r) => r.world_card_id);

  const mgrBatchId = randomUUID();
  const mgrDatasetVersion = computeDatasetVersion("managers", now);
  const mgrRaw = db.prepare("SELECT * FROM managers").all();
  const mgrTransformed = mgrRaw.map((row) => transformManager(row, mgrDatasetVersion, mgrBatchId));
  const mgrValidations = mgrTransformed.map((row) => ({ row, result: validateManager(row) }));
  const mgrValid = mgrValidations.filter((v) => v.result.ok).map((v) => v.row);
  const mgrInvalid = mgrValidations.filter((v) => !v.result.ok);
  const mgrDupes = findDuplicateIds(mgrTransformed, (r) => String(r.internal_manager_id));

  const analysisBatchId = randomUUID();
  const analysisDatasetVersion = computeDatasetVersion("player-card-analysis", now);
  let analysisValid = [];
  let orphanIds = [];
  let analysisDupeCount = 0;
  let pcRawCount = 0;
  if (tableExists(db, "player_cards")) {
    const pcRaw = db.prepare("SELECT * FROM player_cards").all();
    pcRawCount = pcRaw.length;
    const positionsByCard = new Map();
    for (const row of db.prepare("SELECT * FROM player_card_positions").all()) {
      if (!positionsByCard.has(row.efhub_card_id)) positionsByCard.set(row.efhub_card_id, []);
      positionsByCard.get(row.efhub_card_id).push({ code: row.position_code, familiarity: row.familiarity, isRegistered: !!row.is_registered });
    }
    const comSkillsByCard = new Map();
    for (const row of db.prepare("SELECT * FROM player_card_com_skills ORDER BY display_order").all()) {
      if (!comSkillsByCard.has(row.efhub_card_id)) comSkillsByCard.set(row.efhub_card_id, []);
      comSkillsByCard.get(row.efhub_card_id).push(row.skill_key);
    }
    const playerSkillsByCard = new Map();
    for (const row of db.prepare("SELECT * FROM player_card_skills ORDER BY display_order").all()) {
      if (!playerSkillsByCard.has(row.efhub_card_id)) playerSkillsByCard.set(row.efhub_card_id, []);
      playerSkillsByCard.get(row.efhub_card_id).push(row.skill_key);
    }
    const analysisTransformed = pcRaw.map((row) => {
      let playerModel = {};
      try {
        const parsed = JSON.parse(row.player_model_json ?? "{}");
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) if (typeof v === "number") playerModel[k] = v;
        }
      } catch {
        /* 壊れたJSONは空扱い */
      }
      return transformPlayerCardAnalysis(
        {
          efhub_card_id: row.efhub_card_id,
          weak_foot_usage: row.weak_foot_usage,
          weak_foot_accuracy: row.weak_foot_accuracy,
          form: row.form,
          condition_value: row.condition_value,
          injury_resistance: row.injury_resistance,
          player_model: playerModel,
          positions: positionsByCard.get(row.efhub_card_id) ?? [],
          com_skills: comSkillsByCard.get(row.efhub_card_id) ?? [],
          player_skills: playerSkillsByCard.get(row.efhub_card_id) ?? [],
          fetched_at: row.fetched_at,
        },
        analysisDatasetVersion,
        analysisBatchId,
      );
    });
    const worldCardIdSet = new Set(worldValid.map((r) => r.world_card_id));
    orphanIds = findOrphanAnalysisRows(analysisTransformed, worldCardIdSet);
    analysisDupeCount = findDuplicateIds(analysisTransformed, (r) => r.world_card_id).length;
    analysisValid = analysisTransformed.filter((r) => !orphanIds.includes(r.world_card_id));
  }

  return {
    world: { valid: worldValid, invalidCount: worldInvalid.length, dupeCount: worldDupes.length, batchId: worldBatchId, datasetVersion: worldDatasetVersion, sourceCount: cardsRaw.length },
    managers: { valid: mgrValid, invalidCount: mgrInvalid.length, dupeCount: mgrDupes.length, batchId: mgrBatchId, datasetVersion: mgrDatasetVersion, sourceCount: mgrRaw.length },
    analysis: { valid: analysisValid, orphanCount: orphanIds.length, dupeCount: analysisDupeCount, batchId: analysisBatchId, datasetVersion: analysisDatasetVersion, sourceCount: pcRawCount },
  };
}

async function main() {
  const execute = parseExecuteFlag(process.argv);
  const validateOnly = parseValidateOnlyFlag(process.argv);
  const mode = execute ? "実投入(--execute)" : validateOnly ? "接続準備の検証のみ(--validate-only、実接続なし)" : "dry-run(既定)";
  console.log(`モード: ${mode}`);

  // SQLite側の前提条件確認(常に実施。読み取り専用のみ、書込み・変更は一切行わない)
  const stat = await fs.stat(DB_PATH);
  console.log(`SQLiteファイルサイズ: ${stat.size} バイト、更新日時: ${stat.mtime.toISOString()}`);

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const integrityRows = db.prepare("PRAGMA integrity_check").all();
  const integrityResult = integrityRows[0]?.integrity_check ?? "unknown";
  console.log(`SQLite integrity_check: ${integrityResult}`);
  if (integrityResult.trim().toLowerCase() !== "ok") {
    console.error("integrity_checkが'ok'以外を返したため中止します。");
    db.close();
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const datasets = readAndTransform(db, now);
  db.close();

  const totalInvalid = datasets.world.invalidCount + datasets.managers.invalidCount;
  const totalDupes = datasets.world.dupeCount + datasets.managers.dupeCount + datasets.analysis.dupeCount;
  const totalOrphans = datasets.analysis.orphanCount;

  console.log("");
  console.log(`world_player_cards: 取得元${datasets.world.sourceCount}件 / 検証OK${datasets.world.valid.length}件 / dataset_version=${datasets.world.datasetVersion}`);
  console.log(`managers: 取得元${datasets.managers.sourceCount}件 / 検証OK${datasets.managers.valid.length}件 / dataset_version=${datasets.managers.datasetVersion}`);
  console.log(`player_card_analysis: 取得元${datasets.analysis.sourceCount}件 / 検証OK${datasets.analysis.valid.length}件 / dataset_version=${datasets.analysis.datasetVersion}`);
  console.log(`必須項目欠損・不正値: ${totalInvalid}件 / 重複ID: ${totalDupes}件 / 孤立参照: ${totalOrphans}件`);

  if (totalInvalid > 0 || totalDupes > 0 || totalOrphans > 0) {
    console.error("ローカル検証で問題が見つかったため、接続前に中止します。");
    process.exitCode = 1;
    return;
  }

  if (
    datasets.world.valid.length !== EXPECTED_COUNTS.world_player_cards ||
    datasets.managers.valid.length !== EXPECTED_COUNTS.managers ||
    datasets.analysis.valid.length !== EXPECTED_COUNTS.player_card_analysis
  ) {
    console.error(
      `件数が想定(${EXPECTED_COUNTS.world_player_cards}/${EXPECTED_COUNTS.managers}/${EXPECTED_COUNTS.player_card_analysis})と一致しないため、接続前に中止します。` +
        `実測: ${datasets.world.valid.length}/${datasets.managers.valid.length}/${datasets.analysis.valid.length}`,
    );
    process.exitCode = 1;
    return;
  }

  const payloadHashes = {
    world: computePayloadHash(datasets.world.valid),
    managers: computePayloadHash(datasets.managers.valid),
    analysis: computePayloadHash(datasets.analysis.valid),
  };
  console.log("");
  console.log(`payload_hash: world=${payloadHashes.world.slice(0, 16)}... managers=${payloadHashes.managers.slice(0, 16)}... analysis=${payloadHashes.analysis.slice(0, 16)}...`);

  if (!execute && !validateOnly) {
    console.log("");
    console.log("dry-runのため、ここで終了します(外部接続0回)。接続準備を確認するには --validate-only、実投入するには --execute を指定してください。");
    return;
  }

  // ここから先(--validate-only / --execute)だけ、接続文字列の組み立て・検証を行う。
  // --validate-onlyでは実接続を行わない。
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

  const buildResult = buildAndValidateConnectionString({ template: connectionTemplate, password });
  if (!buildResult.ok) {
    console.error(`接続文字列の検証に失敗したため中止します: ${buildResult.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`接続文字列の検証に成功しました(形式: ${buildResult.poolerType} pooler)。接続文字列の内容自体は表示しません。`);

  // CA証明書(任意)の読み込み。rejectUnauthorizedは常にtrue固定で、CA未指定でも緩めない。
  const caCertPath = process.env[CA_CERT_PATH_ENV];
  let caCertPem;
  if (caCertPath) {
    try {
      caCertPem = loadCaCertificateFromFile(caCertPath);
    } catch (err) {
      console.error(`CA証明書の読み込みに失敗したため中止します: ${err?.message ?? err}`);
      process.exitCode = 1;
      return;
    }
  }
  const sslConfig = buildPgSslConfig(caCertPem);
  console.log(`SSL設定: ${describeSslConfigForLog(sslConfig)}`);
  if (!caCertPath) {
    console.log(
      `注意: ${CA_CERT_PATH_ENV}が未設定です。Supabase Session poolerの証明書チェーンがNode既定のCAストアに` +
        `含まれない場合、"self-signed certificate in certificate chain"で接続に失敗します。` +
        `その場合はSupabase公式のCA証明書ファイルをローカルへ保存し、${CA_CERT_PATH_ENV}で指定してください。`,
    );
  }

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

    const result = await runRealImport(client, {
      worldRows: datasets.world.valid,
      managerRows: datasets.managers.valid,
      analysisRows: datasets.analysis.valid,
      worldBatchId: datasets.world.batchId,
      managersBatchId: datasets.managers.batchId,
      analysisBatchId: datasets.analysis.batchId,
      datasetVersions: { world: datasets.world.datasetVersion, managers: datasets.managers.datasetVersion, analysis: datasets.analysis.datasetVersion },
      payloadHashes,
      chunkSize: 2000,
      now,
    });

    console.log("");
    console.log(`結果: ${result.decision.toUpperCase()}`);
    console.log(`件数: world_player_cards=${result.counts.world} managers=${result.counts.managers} player_card_analysis=${result.counts.analysis}`);
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
