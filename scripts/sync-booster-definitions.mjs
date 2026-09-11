/**
 * 選手ブースター定義カタログ → SQLite（player_booster_definitions）。
 *   node scripts/sync-booster-definitions.mjs
 *
 * - 外部アクセス 0。src/lib/progression/booster-catalog.ts（真の出所）を読み込んで
 *   非破壊的にテーブルへ UPSERT するだけ。
 * - 既存の World / eFHUB / 監督データには一切書き込まない。
 * - World `boost1`/`boost2`・eFHUB `boost_id` の数値 ID とは番号体系が一致しないため未マッピング（NULL）。
 */
import { openDb } from "./sqlite/db.mjs";
import { BOOSTER_CATALOG, BOOSTER_CATALOG_VERSION } from "../src/lib/progression/booster-catalog.ts";

const nowIso = () => new Date().toISOString();

const db = await openDb();

// 追加列を非破壊で補完（v4: evidence_level / v6: condition_text, condition_evaluable）
{
  const cols = new Set(db.prepare("PRAGMA table_info(player_booster_definitions)").all().map((r) => r.name));
  for (const [name, ddl] of [
    ["evidence_level", "TEXT"],
    ["condition_text", "TEXT"],
    ["condition_evaluable", "INTEGER"],
  ]) {
    if (!cols.has(name)) {
      db.exec(`ALTER TABLE player_booster_definitions ADD COLUMN ${name} ${ddl}`);
      console.log(`[boosters] 列追加: ${name}`);
    }
  }
}

// 既存データのガード
const before = {
  world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
  player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
  player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  managers: db.prepare("SELECT COUNT(*) n FROM managers").get().n,
};
console.log("[boosters] 既存データ（事前）:", JSON.stringify(before));

const run = db
  .prepare("INSERT INTO player_booster_sync_runs (started_at, status, catalog_version) VALUES (?, 'running', ?)")
  .run(nowIso(), BOOSTER_CATALOG_VERSION);
const runId = Number(run.lastInsertRowid);

const upsert = db.prepare(`
  INSERT INTO player_booster_definitions
    (booster_key, name_en, name_ja, category, affected_stat_keys, per_level_delta, max_level,
     conditional, confirmation_status, evidence_level, evidence, source, world_source_booster_id,
     efhub_source_booster_id, catalog_version, verified_at, condition_text, condition_evaluable)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(booster_key) DO UPDATE SET
    name_en=excluded.name_en, name_ja=excluded.name_ja, category=excluded.category,
    affected_stat_keys=excluded.affected_stat_keys, per_level_delta=excluded.per_level_delta,
    max_level=excluded.max_level, conditional=excluded.conditional,
    confirmation_status=excluded.confirmation_status, evidence_level=excluded.evidence_level,
    evidence=excluded.evidence, catalog_version=excluded.catalog_version, verified_at=excluded.verified_at,
    condition_text=excluded.condition_text, condition_evaluable=excluded.condition_evaluable
`);

const at = nowIso();
db.exec("BEGIN");
let n = 0;
try {
  for (const b of BOOSTER_CATALOG) {
    upsert.run(
      b.key, b.nameEn, b.nameJa, b.category, JSON.stringify(b.affectedStats), 1, b.maxLevel,
      b.conditional ? 1 : 0, b.confirmationStatus, b.evidenceLevel, b.evidence, "efscout", null, null,
      BOOSTER_CATALOG_VERSION, at,
      b.conditionText ?? null,
      b.conditionEvaluable == null ? null : b.conditionEvaluable ? 1 : 0,
    );
    n++;
  }
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  db.prepare("UPDATE player_booster_sync_runs SET status='failed', finished_at=? WHERE id=?").run(nowIso(), runId);
  console.error("[boosters] 失敗:", err.message);
  db.close();
  process.exit(1);
}

db.prepare("UPDATE player_booster_sync_runs SET status='done', finished_at=?, row_count=? WHERE id=?").run(nowIso(), n, runId);

const after = {
  world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
  player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
  player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  managers: db.prepare("SELECT COUNT(*) n FROM managers").get().n,
};
console.log("[boosters] 既存データ（事後）:", JSON.stringify(after));
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) {
    console.error(`[boosters] 既存データ件数が変化: ${k} ${before[k]} → ${after[k]} — 中断`);
    db.close();
    process.exit(1);
  }
}

const conf = db.prepare("SELECT confirmation_status, COUNT(*) n FROM player_booster_definitions GROUP BY confirmation_status").all();
console.log(`[boosters] player_booster_definitions: ${n} 件`, JSON.stringify(conf));
console.log("[boosters] 整合性 OK（既存データ不変・非破壊）");
db.close();
