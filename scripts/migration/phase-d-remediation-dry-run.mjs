/**
 * Phase Dで確認された2件の差分の修正案について、正本SQLiteを読み取り専用で使い、
 * 投入payloadを算出・検証するdry-runツール。
 *
 *   1. reference_data.world_player_cards / reference_data.managers への
 *      name_sort_key列(SQLiteのCOLLATE NOCASEと同じ並び順を再現するための事前計算済み
 *      ソートキー)の追加差分。
 *   2. reference_data.player_card_analysis への efhub_name_en列(レガシーeFHUB由来の
 *      分析表示専用名、SQLiteのplayer_cards.name_enと同じ値)の追加差分。
 *
 * - 実Supabase・実PostgreSQLへは一切接続しない(このツール自体に接続機能が無い)。
 * - 正本SQLiteは読み取り専用でのみ使用する。
 * - name_sort_keyについては、算出した値で(name_sort_key, 主キー)順に並べ替えた結果が、
 *   SQLiteの実際のORDER BY name_en COLLATE NOCASE, 主キー ASC の結果と全件完全一致することを
 *   検証する(1件でも不一致があれば中止する)。
 * - 出力はすべて`.gitignore`対象の`/data`配下のみ(Git追加禁止)。
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
const { computeDatasetVersion, computePayloadHash, buildManifest } = await import("../../src/lib/reference-data/migration-transform.ts");

const ROOT = path.resolve(HERE, "..", "..");
const DB_PATH = path.join(ROOT, "data", "efootball.db");
const OUT_DIR = path.join(ROOT, "data", "poc-hybrid-migration", "phase-d-remediation-dry-run");

function openReadOnly() {
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

async function writeJson(name, data) {
  await fs.writeFile(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), "utf8");
}

/** JS側の再ソート結果がSQLiteの実際のライブクエリ順序と完全一致するかを検証する。 */
function validateSortOrder(label, liveOrderIds, rowsForSort, pkField, isNumericPk) {
  const resorted = [...rowsForSort].sort((a, b) => {
    const ka = a.name_sort_key ?? "";
    const kb = b.name_sort_key ?? "";
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    if (isNumericPk) return a[pkField] - b[pkField];
    return String(a[pkField]) < String(b[pkField]) ? -1 : String(a[pkField]) > String(b[pkField]) ? 1 : 0;
  });
  const resortedIds = resorted.map((r) => r[pkField]);
  const match = JSON.stringify(resortedIds) === JSON.stringify(liveOrderIds);
  let firstDiffIndex = -1;
  if (!match) {
    for (let i = 0; i < liveOrderIds.length; i += 1) {
      if (liveOrderIds[i] !== resortedIds[i]) {
        firstDiffIndex = i;
        break;
      }
    }
  }
  return { label, count: liveOrderIds.length, match, firstDiffIndex };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const db = openReadOnly();
  const now = new Date();
  const summary = [];
  summary.push("# Phase D 差分修正 dry-run 結果(name_sort_key / efhub_name_en)");
  summary.push("");
  summary.push(`実行日時: ${now.toISOString()}`);
  summary.push("");
  summary.push("**このツールは実Supabase・実PostgreSQLへ一切接続していない(dry-runのみ)。正本SQLiteは読み取り専用でのみ使用した。**");
  summary.push("");

  const integrity = db.prepare("PRAGMA integrity_check").all()[0].integrity_check;
  summary.push(`SQLite integrity_check: ${integrity}`);
  if (integrity.trim().toLowerCase() !== "ok") {
    console.error("integrity_checkが'ok'以外を返したため中止します。");
    db.close();
    process.exitCode = 1;
    return;
  }

  // ---- 1. name_sort_key (world_player_cards) ----
  const worldRows = db.prepare("SELECT world_card_id, name_en FROM world_player_cards").all();
  const worldLiveOrder = db
    .prepare("SELECT world_card_id FROM world_player_cards ORDER BY name_en COLLATE NOCASE ASC, world_card_id ASC")
    .all()
    .map((r) => r.world_card_id);
  const worldWithKey = worldRows.map((r) => ({ world_card_id: r.world_card_id, name_sort_key: computeNameSortKey(r.name_en) }));
  const worldValidation = validateSortOrder("world_player_cards", worldLiveOrder, worldWithKey, "world_card_id", false);

  // ---- 1. name_sort_key (managers) ----
  const managerRows = db.prepare("SELECT internal_manager_id, name_en FROM managers").all();
  const managersLiveOrder = db
    .prepare("SELECT internal_manager_id FROM managers ORDER BY name_en COLLATE NOCASE ASC, internal_manager_id ASC")
    .all()
    .map((r) => r.internal_manager_id);
  const managersWithKey = managerRows.map((r) => ({ internal_manager_id: r.internal_manager_id, name_sort_key: computeNameSortKey(r.name_en) }));
  const managersValidation = validateSortOrder("managers", managersLiveOrder, managersWithKey, "internal_manager_id", true);

  summary.push("");
  summary.push("## name_sort_key 検証(SQLiteのCOLLATE NOCASE実測順序との完全一致確認)");
  summary.push("");
  for (const v of [worldValidation, managersValidation]) {
    summary.push(`- ${v.label}: 件数=${v.count} / 完全一致=${v.match}${v.match ? "" : ` (最初の相違位置: ${v.firstDiffIndex})`}`);
  }
  const nameSortKeyOk = worldValidation.match && managersValidation.match;
  if (!nameSortKeyOk) {
    console.error("name_sort_keyの並び順検証に失敗したため中止します(SQLite実測順序と不一致)。");
    db.close();
    process.exitCode = 1;
    return;
  }

  const worldDatasetVersion = computeDatasetVersion("world-name-sort-key", now);
  const worldBatchId = randomUUID();
  await writeJson("world-name-sort-key-updates.json", worldWithKey);
  const worldManifest = buildManifest({
    targetTable: "reference_data.world_player_cards(name_sort_key extension)",
    datasetVersion: worldDatasetVersion,
    importBatchId: worldBatchId,
    source: "src/lib/reference-data/name-sort-key.ts#computeNameSortKey(world_player_cards.name_en)",
    sourceRowCount: worldWithKey.length,
    validRows: worldWithKey,
    invalidRowCount: 0,
    duplicateIdCount: 0,
    now,
  });
  await writeJson("world-name-sort-key.manifest.json", worldManifest);

  const managersDatasetVersion = computeDatasetVersion("managers-name-sort-key", now);
  const managersBatchId = randomUUID();
  await writeJson("managers-name-sort-key-updates.json", managersWithKey);
  const managersManifest = buildManifest({
    targetTable: "reference_data.managers(name_sort_key extension)",
    datasetVersion: managersDatasetVersion,
    importBatchId: managersBatchId,
    source: "src/lib/reference-data/name-sort-key.ts#computeNameSortKey(managers.name_en)",
    sourceRowCount: managersWithKey.length,
    validRows: managersWithKey,
    invalidRowCount: 0,
    duplicateIdCount: 0,
    now,
  });
  await writeJson("managers-name-sort-key.manifest.json", managersManifest);

  summary.push("");
  summary.push(`- world_player_cards: dataset_version=${worldDatasetVersion} / import_batch_id=${worldBatchId} / payload_hash=${worldManifest.payloadHash}`);
  summary.push(`- managers: dataset_version=${managersDatasetVersion} / import_batch_id=${managersBatchId} / payload_hash=${managersManifest.payloadHash}`);

  // ---- 2. efhub_name_en (player_card_analysis) ----
  const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='player_cards'").get() != null;
  const analysisRows = tableExists ? db.prepare("SELECT efhub_card_id, name_en FROM player_cards").all() : [];
  const worldIdSet = new Set(worldRows.map((r) => r.world_card_id));
  const orphanIds = analysisRows.filter((r) => !worldIdSet.has(r.efhub_card_id)).map((r) => r.efhub_card_id);
  const analysisUpdates = analysisRows
    .filter((r) => worldIdSet.has(r.efhub_card_id))
    .map((r) => ({ world_card_id: r.efhub_card_id, efhub_name_en: r.name_en }));

  summary.push("");
  summary.push("## efhub_name_en (player_card_analysis)");
  summary.push("");
  summary.push(`- 対象行数: ${analysisUpdates.length}件(既存player_card_analysis全件と同数のはず、期待値19件)`);
  summary.push(`- 孤立参照(world_player_cardsに存在しないID): ${orphanIds.length}件`);
  if (orphanIds.length > 0 || analysisUpdates.length !== 19) {
    console.error(`analysisデータの検証に失敗したため中止します(孤立参照=${orphanIds.length}件, 対象行数=${analysisUpdates.length}件, 期待値19件)。`);
    db.close();
    process.exitCode = 1;
    return;
  }

  const analysisDatasetVersion = computeDatasetVersion("analysis-name", now);
  const analysisBatchId = randomUUID();
  await writeJson("analysis-name-updates.json", analysisUpdates);
  const analysisManifest = buildManifest({
    targetTable: "reference_data.player_card_analysis(efhub_name_en extension)",
    datasetVersion: analysisDatasetVersion,
    importBatchId: analysisBatchId,
    source: "data/efootball.db#player_cards.name_en",
    sourceRowCount: analysisUpdates.length,
    validRows: analysisUpdates,
    invalidRowCount: 0,
    duplicateIdCount: 0,
    now,
  });
  await writeJson("analysis-name.manifest.json", analysisManifest);
  summary.push(`- dataset_version: ${analysisDatasetVersion} / import_batch_id: ${analysisBatchId} / payload_hash: ${analysisManifest.payloadHash}`);

  db.close();

  summary.push("");
  summary.push("## 実施していないこと(明記)");
  summary.push("");
  summary.push("- 実Supabase・実PostgreSQLへの接続・更新(このツールには接続機能自体が無い)。");
  summary.push("- 正本SQLiteへの書込み(readOnly接続のみ使用)。");
  summary.push("- world_player_cards.name_en / managers.name_en の変更(参照するだけで書き換えない)。");
  summary.push("- 変換結果JSONのGitへの追加(すべて`.gitignore`対象の`/data`配下に出力)。");

  const reportPath = path.join(ROOT, "docs", "production-readiness", "phase-d-remediation-dry-run-results.md");
  await fs.writeFile(reportPath, summary.join("\n") + "\n", "utf8");
  console.log(summary.join("\n"));
  console.log(`\nレポート: ${path.relative(ROOT, reportPath)}`);
}

main().catch((err) => {
  console.error("dry-run失敗:", err);
  process.exit(1);
});
