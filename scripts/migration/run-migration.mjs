/**
 * 参照データ(SQLite → PostgreSQL/reference_data)のローカル移行ツール本体(dry-run専用)。
 *
 * 直接実行せず、必ず `reference-data-migration-tool.mjs` 経由で起動すること
 * (src/lib配下の拡張子省略import解決フックを先に登録する必要があるため)。
 *
 * - 正本 data/efootball.db は readOnly: true でのみ開く(書き込み・スキーマ適用は行わない)。
 * - 実Supabase・実PostgreSQLへは一切接続しない(--dry-runの有無に関わらず、このツール自体が
 *   接続機能を持たない。実インポートは別途、実接続を持つ将来のツールで行う)。
 * - 変換結果・manifestはすべて data/poc-hybrid-migration/migration-dry-run/
 *   (.gitignoreの/data配下、Git追跡対象外)へ出力する。
 * - 秘密情報(接続文字列・APIキー等)は一切使用しない。
 */

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeDatasetVersion,
  transformWorldPlayerCard,
  validateWorldPlayerCard,
  transformManager,
  validateManager,
  transformPlayerCardAnalysis,
  findOrphanAnalysisRows,
  findDuplicateIds,
  buildManifest,
} from "../../src/lib/reference-data/migration-transform.ts";
import { buildSearchIndex, searchIndex } from "../../src/lib/reference-data/search-index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DB_PATH = path.join(ROOT, "data", "efootball.db");
const OUT_DIR = path.join(ROOT, "data", "poc-hybrid-migration", "migration-dry-run");
const REPORT_PATH = path.join(ROOT, "docs", "production-readiness", "reference-data-migration-dry-run-results.md");

function openReadOnly() {
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function tableExists(db, name) {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name) != null;
}

async function writeJson(name, data) {
  await fs.writeFile(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const db = openReadOnly();
  const now = new Date();
  const summaryLines = [];
  summaryLines.push("# 参照データ移行ツール dry-run 結果");
  summaryLines.push("");
  summaryLines.push(`実行日時: ${now.toISOString()}`);
  summaryLines.push("");
  summaryLines.push("**このツールは実Supabase・実PostgreSQLへ一切接続していない(dry-runのみ)。正本SQLiteは読み取り専用でのみ使用した。**");
  summaryLines.push("");

  // ------------------------------------------------------------------
  // 1. world_player_cards
  // ------------------------------------------------------------------
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

  await writeJson("world-player-cards.json", worldValid);
  await writeJson("world-player-cards-invalid.json", worldInvalid);
  const worldManifest = buildManifest({
    targetTable: "reference_data.world_player_cards",
    datasetVersion: worldDatasetVersion,
    importBatchId: worldBatchId,
    source: "data/efootball.db#world_player_cards",
    sourceRowCount: cardsRaw.length,
    validRows: worldValid,
    invalidRowCount: worldInvalid.length,
    duplicateIdCount: worldDupes.length,
    now,
  });
  await writeJson("world-player-cards.manifest.json", worldManifest);

  summaryLines.push("## world_player_cards");
  summaryLines.push("");
  summaryLines.push(`- 取得元件数(SQLite): ${cardsRaw.length}`);
  summaryLines.push(`- 検証OK件数: ${worldValid.length}`);
  summaryLines.push(`- 検証NG件数: ${worldInvalid.length}`);
  summaryLines.push(`- 重複ID件数: ${worldDupes.length}`);
  summaryLines.push(`- dataset_version: ${worldDatasetVersion}`);
  summaryLines.push(`- import_batch_id: ${worldBatchId}`);
  summaryLines.push(`- payload_hash: ${worldManifest.payloadHash}`);
  summaryLines.push("");

  // ------------------------------------------------------------------
  // 2. managers
  // ------------------------------------------------------------------
  const mgrBatchId = randomUUID();
  const mgrDatasetVersion = computeDatasetVersion("managers", now);
  const mgrRaw = db.prepare("SELECT * FROM managers").all();
  const mgrTransformed = mgrRaw.map((row) => transformManager(row, mgrDatasetVersion, mgrBatchId));
  const mgrValidations = mgrTransformed.map((row) => ({ row, result: validateManager(row) }));
  const mgrValid = mgrValidations.filter((v) => v.result.ok).map((v) => v.row);
  const mgrInvalid = mgrValidations.filter((v) => !v.result.ok);
  const mgrDupes = findDuplicateIds(mgrTransformed, (r) => String(r.internal_manager_id));

  await writeJson("managers.json", mgrValid);
  await writeJson("managers-invalid.json", mgrInvalid);
  const mgrManifest = buildManifest({
    targetTable: "reference_data.managers",
    datasetVersion: mgrDatasetVersion,
    importBatchId: mgrBatchId,
    source: "data/efootball.db#managers",
    sourceRowCount: mgrRaw.length,
    validRows: mgrValid,
    invalidRowCount: mgrInvalid.length,
    duplicateIdCount: mgrDupes.length,
    now,
  });
  await writeJson("managers.manifest.json", mgrManifest);

  summaryLines.push("## managers");
  summaryLines.push("");
  summaryLines.push(`- 取得元件数(SQLite): ${mgrRaw.length}`);
  summaryLines.push(`- 検証OK件数: ${mgrValid.length}`);
  summaryLines.push(`- 検証NG件数: ${mgrInvalid.length}`);
  summaryLines.push(`- 重複ID件数: ${mgrDupes.length}`);
  summaryLines.push(`- dataset_version: ${mgrDatasetVersion}`);
  summaryLines.push(`- import_batch_id: ${mgrBatchId}`);
  summaryLines.push(`- payload_hash: ${mgrManifest.payloadHash}`);
  summaryLines.push("");

  // ------------------------------------------------------------------
  // 3. player_card_analysis(player_cards + 3補助テーブルの統合)
  // ------------------------------------------------------------------
  let analysisValid = [];
  let analysisInvalidCount = 0;
  let analysisDupeCount = 0;
  let orphanIds = [];
  let analysisManifest = null;
  const analysisBatchId = randomUUID();
  const analysisDatasetVersion = computeDatasetVersion("player-card-analysis", now);

  if (tableExists(db, "player_cards")) {
    const pcRaw = db.prepare("SELECT * FROM player_cards").all();
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
        /* 壊れたJSONは空扱い(既存のanalysis-repository.tsと同じ安全側フォールバック) */
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
    analysisInvalidCount = orphanIds.length;

    await writeJson("player-card-analysis.json", analysisValid);
    analysisManifest = buildManifest({
      targetTable: "reference_data.player_card_analysis",
      datasetVersion: analysisDatasetVersion,
      importBatchId: analysisBatchId,
      source: "data/efootball.db#player_cards+player_card_positions+player_card_com_skills+player_card_skills",
      sourceRowCount: pcRaw.length,
      validRows: analysisValid,
      invalidRowCount: analysisInvalidCount,
      duplicateIdCount: analysisDupeCount,
      now,
    });
    await writeJson("player-card-analysis.manifest.json", analysisManifest);
  }

  summaryLines.push("## player_card_analysis(player_cards + 3補助テーブルの統合)");
  summaryLines.push("");
  summaryLines.push(`- 検証OK件数: ${analysisValid.length}`);
  summaryLines.push(`- world_player_cardsに存在しないID(除外): ${orphanIds.length}${orphanIds.length ? ` (${orphanIds.join(", ")})` : ""}`);
  summaryLines.push(`- 重複ID件数: ${analysisDupeCount}`);
  if (analysisManifest) {
    summaryLines.push(`- dataset_version: ${analysisDatasetVersion}`);
    summaryLines.push(`- import_batch_id: ${analysisBatchId}`);
    summaryLines.push(`- payload_hash: ${analysisManifest.payloadHash}`);
  }
  summaryLines.push("");

  // ------------------------------------------------------------------
  // 4. player_index_entries → サーバー内静的検索索引(design: static-search-index-design.md)
  // ------------------------------------------------------------------
  let indexEntryCount = 0;
  let indexRawBytes = 0;
  let indexGzipBytes = 0;
  let sampleSearch = null;
  if (tableExists(db, "player_index_entries")) {
    const indexDatasetVersion = computeDatasetVersion("index", now);
    const indexRaw = db.prepare("SELECT efhub_card_id, name_en, name_ja, ovr_max_candidate, is_anomalous FROM player_index_entries").all();
    const index = buildSearchIndex(indexRaw, indexDatasetVersion);
    indexEntryCount = index.entries.length;

    const json = JSON.stringify(index);
    indexRawBytes = Buffer.byteLength(json, "utf8");
    const gz = gzipSync(json, { level: 9 });
    indexGzipBytes = gz.length;
    await fs.writeFile(path.join(OUT_DIR, "search-index.json"), json, "utf8");
    await fs.writeFile(path.join(OUT_DIR, "search-index.json.gz"), gz);

    // 実データに対する検索動作の確認(サーバー内メモリ検索を模擬)
    const sample = index.entries[0];
    if (sample) {
      const query = (sample.nameJa ?? sample.nameEn).slice(0, 2);
      sampleSearch = { query, result: searchIndex(index, query, { limit: 5 }) };
      await writeJson("search-index-sample-query.json", sampleSearch);
    }
  }

  summaryLines.push("## player_index_entries → 検索索引(サーバー内静的アセット)");
  summaryLines.push("");
  summaryLines.push(`- 索引エントリ件数(is_anomalous除外後): ${indexEntryCount}`);
  summaryLines.push(`- 索引サイズ: 生 ${(indexRawBytes / 1024 / 1024).toFixed(2)} MiB / gzip ${(indexGzipBytes / 1024 / 1024).toFixed(2)} MiB`);
  if (sampleSearch) {
    summaryLines.push(`- サンプル検索("${sampleSearch.query}"): ヒット${sampleSearch.result.total}件中${sampleSearch.result.items.length}件を返却`);
  }
  summaryLines.push("");

  db.close();

  summaryLines.push("## 出力ファイル一覧(`data/poc-hybrid-migration/migration-dry-run/`、Git追跡対象外)");
  summaryLines.push("");
  const files = await fs.readdir(OUT_DIR);
  for (const f of files.sort()) summaryLines.push(`- ${f}`);
  summaryLines.push("");
  summaryLines.push("## 実施していないこと(明記)");
  summaryLines.push("");
  summaryLines.push("- 実Supabase・実PostgreSQLへの接続・投入(このツールには接続機能自体が無い)。");
  summaryLines.push("- 正本SQLiteへの書込み(readOnly接続のみ使用)。");
  summaryLines.push("- 変換結果JSONのGitへの追加(すべて`.gitignore`対象の`/data`配下に出力)。");

  await fs.writeFile(REPORT_PATH, summaryLines.join("\n") + "\n", "utf8");
  console.log(summaryLines.join("\n"));
  console.log(`\nレポート: ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch((err) => {
  console.error("移行ツール失敗:", err);
  process.exit(1);
});
