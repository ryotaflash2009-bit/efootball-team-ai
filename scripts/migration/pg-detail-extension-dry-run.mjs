/**
 * reference_data.world_player_cards / reference_data.managers への
 * 詳細フィールド追加(差分投入)のdry-runツール。
 *
 *   node scripts/migration/pg-detail-extension-dry-run.mjs
 *
 * - 正本 data/efootball.db は readOnly: true でのみ開く(書き込み・スキーマ適用は行わない)。
 * - 実Supabase・実PostgreSQLへは一切接続しない(このツール自体に接続機能が無い)。
 * - 既存13,009件・66件・19件を再投入する設計ではなく、今回追加する差分列
 *   (efhub_card_id/ai_styles/appearance/efhub_conflicts/boosters/link_up_plays)
 *   だけを対象にする。
 * - 変換結果・manifestはすべて data/poc-hybrid-migration/detail-extension-dry-run/
 *   (.gitignoreの/data配下、Git追跡対象外)へ出力する。
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
const { computeDatasetVersion, computePayloadHash, buildManifest } = await import("../../src/lib/reference-data/migration-transform.ts");

const ROOT = path.resolve(HERE, "..", "..");
const DB_PATH = path.join(ROOT, "data", "efootball.db");
const OUT_DIR = path.join(ROOT, "data", "poc-hybrid-migration", "detail-extension-dry-run");

function openReadOnly() {
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

async function writeJson(name, data) {
  await fs.writeFile(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const db = openReadOnly();
  const now = new Date();
  const summary = [];
  summary.push("# reference_data 詳細フィールド追加 dry-run 結果");
  summary.push("");
  summary.push(`実行日時: ${now.toISOString()}`);
  summary.push("");
  summary.push("**このツールは実Supabase・実PostgreSQLへ一切接続していない(dry-runのみ)。正本SQLiteは読み取り専用でのみ使用した。**");
  summary.push("**この投入は既存13,009/66/19件の再投入ではなく、差分列(未移行フィールド)だけを対象にする。**");
  summary.push("");

  const integrity = db.prepare("PRAGMA integrity_check").all()[0].integrity_check;
  summary.push(`SQLite integrity_check: ${integrity}`);
  if (integrity.trim().toLowerCase() !== "ok") {
    console.error("integrity_checkが'ok'以外を返したため中止します。");
    db.close();
    process.exitCode = 1;
    return;
  }

  // ---- world_player_cards 側の差分データ ----
  const worldIds = new Set(db.prepare("SELECT world_card_id FROM world_player_cards").all().map((r) => r.world_card_id));
  const linkRows = db.prepare("SELECT internal_card_id, source, source_card_id FROM source_record_links").all();
  const efhubLinkMap = buildEfhubLinkMap(linkRows);
  const aiStylesRows = db.prepare("SELECT world_card_id, style_name, display_order FROM world_player_ai_styles").all();
  const aiStylesMap = buildAiStylesMap(aiStylesRows);
  const appearanceRows = db.prepare("SELECT * FROM world_player_appearances").all();
  const appearanceMap = buildAppearanceMap(appearanceRows);
  const conflictRows = db.prepare("SELECT world_card_id, field_name, efhub_value, world_value FROM data_conflicts").all();
  const conflictsMap = buildEfhubConflictsMap(conflictRows);

  const efhubLinkOrphans = findOrphanIds(efhubLinkMap.keys(), worldIds);
  const aiStylesOrphans = findOrphanIds(aiStylesMap.keys(), worldIds);
  const appearanceOrphans = findOrphanIds(appearanceMap.keys(), worldIds);
  const conflictsOrphans = findOrphanIds(conflictsMap.keys(), worldIds);

  const worldUpdates = [...worldIds].map((id) => ({
    world_card_id: id,
    efhub_card_id: efhubLinkMap.get(id) ?? null,
    ai_styles: aiStylesMap.get(id) ?? [],
    appearance: appearanceMap.get(id) ?? null,
    efhub_conflicts: conflictsMap.get(id) ?? [],
  }));

  const worldDatasetVersion = computeDatasetVersion("world-detail", now);
  const worldBatchId = randomUUID();
  await writeJson("world-detail-updates.json", worldUpdates);
  const worldManifest = buildManifest({
    targetTable: "reference_data.world_player_cards(detail extension)",
    datasetVersion: worldDatasetVersion,
    importBatchId: worldBatchId,
    source: "data/efootball.db#source_record_links+world_player_ai_styles+world_player_appearances+data_conflicts",
    sourceRowCount: worldUpdates.length,
    validRows: worldUpdates,
    invalidRowCount: efhubLinkOrphans.length + aiStylesOrphans.length + appearanceOrphans.length + conflictsOrphans.length,
    duplicateIdCount: 0,
    now,
  });
  await writeJson("world-detail.manifest.json", worldManifest);

  summary.push("");
  summary.push("## world_player_cards 詳細フィールド");
  summary.push("");
  summary.push(`- 対象行数: ${worldUpdates.length}件(既存world_player_cards全件と同数のはず)`);
  summary.push(`- efhub_card_id 設定件数: ${efhubLinkMap.size}件`);
  summary.push(`- ai_styles 非空件数: ${aiStylesMap.size}件`);
  summary.push(`- appearance 設定件数: ${appearanceMap.size}件`);
  summary.push(`- efhub_conflicts 非空件数: ${conflictsMap.size}件`);
  summary.push(`- 孤立参照(world_player_cardsに存在しないID): efhub_link=${efhubLinkOrphans.length} / ai_styles=${aiStylesOrphans.length} / appearance=${appearanceOrphans.length} / conflicts=${conflictsOrphans.length}`);
  summary.push(`- dataset_version: ${worldDatasetVersion}`);
  summary.push(`- import_batch_id: ${worldBatchId}`);
  summary.push(`- payload_hash: ${worldManifest.payloadHash}`);

  // ---- managers 側の差分データ ----
  const managerIds = new Set(db.prepare("SELECT internal_manager_id FROM managers").all().map((r) => String(r.internal_manager_id)));
  const boosterRows = db.prepare("SELECT * FROM manager_boosters").all();
  const boostersMap = buildManagerBoostersMap(boosterRows);
  const linkUpPlayRows = db.prepare("SELECT * FROM manager_link_up_plays").all();
  const linkUpConditionRows = db.prepare("SELECT * FROM manager_link_up_conditions").all();
  const linkUpPlaysMap = buildManagerLinkUpPlaysMap(linkUpPlayRows, linkUpConditionRows);

  const boosterOrphans = findOrphanIds([...boostersMap.keys()].map(String), managerIds);
  const linkUpOrphans = findOrphanIds([...linkUpPlaysMap.keys()].map(String), managerIds);

  const managerUpdates = [...managerIds].map((idStr) => {
    const id = Number(idStr);
    return {
      internal_manager_id: id,
      boosters: boostersMap.get(id) ?? [],
      link_up_plays: linkUpPlaysMap.get(id) ?? [],
    };
  });

  const managerDatasetVersion = computeDatasetVersion("managers-detail", now);
  const managerBatchId = randomUUID();
  await writeJson("managers-detail-updates.json", managerUpdates);
  const managerManifest = buildManifest({
    targetTable: "reference_data.managers(detail extension)",
    datasetVersion: managerDatasetVersion,
    importBatchId: managerBatchId,
    source: "data/efootball.db#manager_boosters+manager_link_up_plays+manager_link_up_conditions",
    sourceRowCount: managerUpdates.length,
    validRows: managerUpdates,
    invalidRowCount: boosterOrphans.length + linkUpOrphans.length,
    duplicateIdCount: 0,
    now,
  });
  await writeJson("managers-detail.manifest.json", managerManifest);

  summary.push("");
  summary.push("## managers 詳細フィールド");
  summary.push("");
  summary.push(`- 対象行数: ${managerUpdates.length}件(既存managers全件と同数のはず)`);
  summary.push(`- boosters 非空件数: ${boostersMap.size}件`);
  summary.push(`- link_up_plays 非空件数: ${linkUpPlaysMap.size}件`);
  summary.push(`- 孤立参照: boosters=${boosterOrphans.length} / link_up_plays=${linkUpOrphans.length}`);
  summary.push(`- dataset_version: ${managerDatasetVersion}`);
  summary.push(`- import_batch_id: ${managerBatchId}`);
  summary.push(`- payload_hash: ${managerManifest.payloadHash}`);

  db.close();

  const totalOrphans = efhubLinkOrphans.length + aiStylesOrphans.length + appearanceOrphans.length + conflictsOrphans.length + boosterOrphans.length + linkUpOrphans.length;

  summary.push("");
  summary.push("## 実施していないこと(明記)");
  summary.push("");
  summary.push("- 実Supabase・実PostgreSQLへの接続・更新(このツールには接続機能自体が無い)。");
  summary.push("- 正本SQLiteへの書込み(readOnly接続のみ使用)。");
  summary.push("- 既存13,009件・66件・19件の再投入(今回は差分列のUPDATE対象データを算出しただけ)。");
  summary.push("- 変換結果JSONのGitへの追加(すべて`.gitignore`対象の`/data`配下に出力)。");

  const reportPath = path.join(ROOT, "docs", "production-readiness", "reference-data-detail-extension-dry-run-results.md");
  await fs.writeFile(reportPath, summary.join("\n") + "\n", "utf8");
  console.log(summary.join("\n"));
  console.log(`\nレポート: ${path.relative(ROOT, reportPath)}`);

  if (totalOrphans > 0) {
    console.error(`\n孤立参照が${totalOrphans}件見つかりました。実投入前に原因を確認してください。`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("dry-run失敗:", err);
  process.exit(1);
});
