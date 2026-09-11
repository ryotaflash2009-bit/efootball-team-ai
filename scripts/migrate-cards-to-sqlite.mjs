/**
 * Phase B.5: src/data/cards/*.json を data/efootball.db（SQLite）へ移行し、
 * JSON↔SQLite を照合し、2回実行して冪等性を確認する。
 *
 *   node scripts/migrate-cards-to-sqlite.mjs
 *
 * - 外部アクセス0回。node:sqlite（Node標準）のみ。新規 npm パッケージなし。
 * - JSON 元データは削除しない。SQLite 内の子テーブルは DELETE→INSERT で置換（UPSERT）。
 * - 異常エントリ 8554053 を sync_errors へ記録（通常カードとして解析しない）。
 * - 結果は docs/phase-b5-sqlite-migration.md に生成。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, DB_PATH, tableCounts } from "./sqlite/db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CARDS_DIR = path.join(ROOT, "src", "data", "cards");
const REPORT = path.join(ROOT, "docs", "phase-b5-sqlite-migration.md");

const STAT_KEYS = [
  "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
  "finishing", "heading", "setPieceTaking", "curl", "speed", "acceleration", "kickingPower", "jump",
  "physicalContact", "balance", "stamina", "defensiveAwareness", "ballWinning", "trackingBack",
  "aggression", "gkAwareness", "gkCatching", "gkClearing", "gkReflexes", "gkReach",
];

const ANOMALOUS = { id: "8554053", name: "Ismail Nasrallah", note: "anomalous: no player object (non-card index entry)" };

const PC_COLS = [
  "efhub_card_id", "parser_version", "source", "source_url", "fetched_at",
  "slug", "name_en", "name_ja", "name_zh",
  "ovr_base", "ovr_max", "player_type_code", "registered_position", "level_cap",
  "playing_style_name", "playing_style_defensive",
  "age", "height", "weight", "preferred_foot",
  "weak_foot_usage", "weak_foot_accuracy", "form", "condition_value", "injury_resistance",
  "country_id", "league_id", "league_name", "team_id", "team_name",
  "boost_id_1", "boost_id_2", "gp_value", "datapack_id", "image_url", "player_model_json",
];

function pcValues(c) {
  return [
    c.efhubCardId, c.parserVersion, c.source, c.sourceUrl, c.fetchedAt,
    c.slug, c.nameEn, c.nameJa, c.nameZh ?? "",
    c.ovrBase, c.ovrMax ?? null, c.playerTypeCode, c.registeredPosition, c.levelCap,
    c.playingStyleName, c.playingStyleDefensive ?? null,
    c.age, c.heightCm, c.weightKg, c.preferredFoot,
    c.weakFootUsage, c.weakFootAccuracy, c.form, c.condition, c.injuryResistance,
    c.countryId, c.leagueId, c.leagueName, c.teamId, c.teamName,
    c.boostId1, c.boostId2, c.gpValue, c.datapackId, c.imageUrl,
    JSON.stringify(c.playerModel),
  ];
}

function upsertCardSql() {
  const placeholders = PC_COLS.map(() => "?").join(", ");
  const updates = PC_COLS.slice(1).map((col) => `${col} = excluded.${col}`).join(", ");
  return `INSERT INTO player_cards (${PC_COLS.join(", ")}) VALUES (${placeholders})
          ON CONFLICT(efhub_card_id) DO UPDATE SET ${updates}`;
}

async function readCards() {
  const files = (await fs.readdir(CARDS_DIR)).filter((f) => /^[0-9]{1,20}\.json$/.test(f)).sort();
  const cards = [];
  const bad = [];
  for (const f of files) {
    try {
      const c = JSON.parse(await fs.readFile(path.join(CARDS_DIR, f), "utf8"));
      if (`${c.efhubCardId}.json` !== f) throw new Error(`filename != efhubCardId (${f})`);
      if (!c.baseStats || Object.keys(c.baseStats).length !== 26) throw new Error("baseStats not 26");
      for (const k of STAT_KEYS) if (typeof c.baseStats[k] !== "number") throw new Error(`baseStats.${k} not number`);
      if (!Array.isArray(c.playerSkills) || c.playerSkills.length === 0) throw new Error("playerSkills empty");
      cards.push(c);
    } catch (e) {
      bad.push({ file: f, error: e.message });
    }
  }
  return { cards, bad };
}

function startRun(db, kind) {
  const now = new Date().toISOString();
  const info = db.prepare("INSERT INTO sync_runs (kind, started_at, status) VALUES (?, ?, 'running')").run(kind, now);
  return Number(info.lastInsertRowid);
}
function finishRun(db, runId, ok, fail) {
  db.prepare("UPDATE sync_runs SET finished_at=?, status='done', ok_count=?, fail_count=? WHERE id=?")
    .run(new Date().toISOString(), ok, fail, runId);
}
function recordError(db, runId, cardId, error) {
  db.prepare("INSERT INTO sync_errors (run_id, efhub_card_id, error, attempt, at) VALUES (?, ?, ?, 0, ?)")
    .run(runId, cardId, error, new Date().toISOString());
}

function migrateOnce(db, cards, kind) {
  const runId = startRun(db, kind);
  const upsert = db.prepare(upsertCardSql());
  const delStats = db.prepare("DELETE FROM player_card_stats WHERE efhub_card_id=?");
  const insStat = db.prepare("INSERT INTO player_card_stats (efhub_card_id, stat_key, stat_kind, value) VALUES (?, ?, 'base', ?)");
  const delSkills = db.prepare("DELETE FROM player_card_skills WHERE efhub_card_id=?");
  const insSkill = db.prepare("INSERT INTO player_card_skills (efhub_card_id, skill_key, display_order) VALUES (?, ?, ?)");
  const delCom = db.prepare("DELETE FROM player_card_com_skills WHERE efhub_card_id=?");
  const insCom = db.prepare("INSERT INTO player_card_com_skills (efhub_card_id, skill_key, display_order) VALUES (?, ?, ?)");
  const delPos = db.prepare("DELETE FROM player_card_positions WHERE efhub_card_id=?");
  const insPos = db.prepare("INSERT INTO player_card_positions (efhub_card_id, position_code, familiarity, is_registered) VALUES (?, ?, ?, ?)");
  const delBoost = db.prepare("DELETE FROM player_card_boosters WHERE efhub_card_id=?");
  const insBoost = db.prepare("INSERT INTO player_card_boosters (efhub_card_id, slot, booster_id) VALUES (?, ?, ?)");

  let ok = 0;
  let fail = 0;
  const errors = [];
  for (const c of cards) {
    const id = c.efhubCardId;
    db.exec("BEGIN");
    try {
      upsert.run(...pcValues(c));

      delStats.run(id);
      for (const k of STAT_KEYS) insStat.run(id, k, c.baseStats[k]);

      delSkills.run(id);
      c.playerSkills.forEach((s, i) => insSkill.run(id, s, i));

      delCom.run(id);
      (c.comSkills ?? []).forEach((s, i) => insCom.run(id, s, i));

      delPos.run(id);
      const seen = new Set();
      insPos.run(id, c.registeredPosition, null, 1);
      seen.add(c.registeredPosition);
      for (const ap of c.additionalPositions ?? []) {
        if (seen.has(ap.position)) continue;
        insPos.run(id, ap.position, ap.familiarity, 0);
        seen.add(ap.position);
      }

      delBoost.run(id);
      insBoost.run(id, 1, c.boostId1 ?? 0);
      insBoost.run(id, 2, c.boostId2 ?? 0);

      db.exec("COMMIT");
      ok++;
    } catch (e) {
      db.exec("ROLLBACK");
      fail++;
      errors.push({ id, error: e.message });
      recordError(db, runId, id, `migration: ${e.message}`);
    }
  }
  finishRun(db, runId, ok, fail);
  return { runId, ok, fail, errors };
}

function dataCounts(db) {
  return {
    parser_versions: tableCounts(db).parser_versions,
    player_cards: tableCounts(db).player_cards,
    player_card_stats: tableCounts(db).player_card_stats,
    player_card_skills: tableCounts(db).player_card_skills,
    player_card_com_skills: tableCounts(db).player_card_com_skills,
    player_card_positions: tableCounts(db).player_card_positions,
    player_card_boosters: tableCounts(db).player_card_boosters,
  };
}
function cardIdSet(db) {
  return db.prepare("SELECT efhub_card_id FROM player_cards ORDER BY efhub_card_id").all().map((r) => r.efhub_card_id);
}

function verifyCard(db, c) {
  const id = c.efhubCardId;
  const issues = [];
  const row = db.prepare("SELECT * FROM player_cards WHERE efhub_card_id=?").get(id);
  if (!row) return [`player_cards に行なし`];
  if (row.efhub_card_id !== id) issues.push("efhub_card_id 不一致");
  if (row.ovr_base !== c.ovrBase) issues.push(`ovr_base ${row.ovr_base}!=${c.ovrBase}`);
  if ((row.ovr_max ?? null) !== (c.ovrMax ?? null)) issues.push(`ovr_max ${row.ovr_max}!=${c.ovrMax}`);
  if (row.name_en !== c.nameEn) issues.push("name_en 不一致");
  if (row.name_ja !== c.nameJa) issues.push("name_ja 不一致");
  if (row.player_type_code !== c.playerTypeCode) issues.push("player_type_code 不一致");
  if (row.level_cap !== c.levelCap) issues.push("level_cap 不一致");
  if (row.registered_position !== c.registeredPosition) issues.push("registered_position 不一致");
  if ((row.playing_style_defensive ?? null) !== (c.playingStyleDefensive ?? null)) issues.push("playing_style_defensive 不一致");
  if (row.parser_version !== c.parserVersion) issues.push("parser_version 不一致");

  // baseStats 26
  const stats = db.prepare("SELECT stat_key, value FROM player_card_stats WHERE efhub_card_id=? AND stat_kind='base'").all(id);
  const sm = Object.fromEntries(stats.map((s) => [s.stat_key, s.value]));
  if (stats.length !== 26) issues.push(`stats 行数 ${stats.length}!=26`);
  for (const k of STAT_KEYS) if (sm[k] !== c.baseStats[k]) issues.push(`stat ${k} ${sm[k]}!=${c.baseStats[k]}`);

  // skills（順序）
  const sk = db.prepare("SELECT skill_key FROM player_card_skills WHERE efhub_card_id=? ORDER BY display_order").all(id).map((r) => r.skill_key);
  if (JSON.stringify(sk) !== JSON.stringify(c.playerSkills)) issues.push("playerSkills 不一致");
  const com = db.prepare("SELECT skill_key FROM player_card_com_skills WHERE efhub_card_id=? ORDER BY display_order").all(id).map((r) => r.skill_key);
  if (JSON.stringify(com) !== JSON.stringify(c.comSkills ?? [])) issues.push("comSkills 不一致");

  // positions
  const posRows = db.prepare("SELECT position_code, familiarity, is_registered FROM player_card_positions WHERE efhub_card_id=?").all(id);
  const reg = posRows.find((p) => p.is_registered === 1);
  if (!reg || reg.position_code !== c.registeredPosition) issues.push("登録ポジション不一致");
  for (const ap of c.additionalPositions ?? []) {
    if (ap.position === c.registeredPosition) continue;
    const m = posRows.find((p) => p.position_code === ap.position);
    if (!m || m.familiarity !== ap.familiarity) issues.push(`additionalPosition ${ap.position} 不一致`);
  }

  // boosters
  const b = db.prepare("SELECT slot, booster_id FROM player_card_boosters WHERE efhub_card_id=? ORDER BY slot").all(id);
  const bmap = Object.fromEntries(b.map((r) => [r.slot, r.booster_id]));
  if (bmap[1] !== (c.boostId1 ?? 0)) issues.push(`boost1 ${bmap[1]}!=${c.boostId1}`);
  if (bmap[2] !== (c.boostId2 ?? 0)) issues.push(`boost2 ${bmap[2]}!=${c.boostId2}`);

  // player model
  if (row.player_model_json !== JSON.stringify(c.playerModel)) issues.push("player_model_json 不一致");

  return issues;
}

function seedParserVersions(db) {
  const now = new Date().toISOString();
  const stmt = db.prepare("INSERT OR IGNORE INTO parser_versions (version, note, created_at) VALUES (?, ?, ?)");
  stmt.run("efhub-player-page/2026-08-28.1", "initial (Phase A / Phase B)", now);
  stmt.run("efhub-player-page/2026-08-28.2", "add playingStyleDefensive (optional)", now);
}

function recordAnomalousOnce(db, runId) {
  const exists = db.prepare("SELECT COUNT(*) AS n FROM sync_errors WHERE efhub_card_id=?").get(ANOMALOUS.id).n;
  if (exists > 0) return false;
  db.prepare("INSERT INTO sync_errors (run_id, efhub_card_id, http_status, error, attempt, at) VALUES (?, ?, 200, ?, 0, ?)")
    .run(runId, ANOMALOUS.id, `${ANOMALOUS.note} (name: ${ANOMALOUS.name})`, new Date().toISOString());
  return true;
}

async function main() {
  const { cards, bad } = await readCards();
  console.log(`[migrate] JSON カード ${cards.length} 件 / 不正 ${bad.length} 件`);

  const db = await openDb();
  seedParserVersions(db);

  // --- 1回目 ---
  const run1 = migrateOnce(db, cards, "json-to-sqlite-migration");
  const counts1 = dataCounts(db);
  const ids1 = cardIdSet(db);
  console.log(`[migrate] 1回目: ok=${run1.ok} fail=${run1.fail}`);

  // --- 照合 ---
  const verifyResults = [];
  for (const c of cards) {
    const issues = verifyCard(db, c);
    verifyResults.push({ id: c.efhubCardId, name: c.nameEn, ok: issues.length === 0, issues });
  }
  const verifyOk = verifyResults.filter((v) => v.ok).length;

  // --- 2回目（冪等性） ---
  const run2 = migrateOnce(db, cards, "json-to-sqlite-migration-rerun");
  const counts2 = dataCounts(db);
  const ids2 = cardIdSet(db);
  const countsEqual = JSON.stringify(counts1) === JSON.stringify(counts2);
  const idsEqual = JSON.stringify(ids1) === JSON.stringify(ids2);
  const dupInCards = new Set(ids2).size !== ids2.length;
  console.log(`[migrate] 2回目: ok=${run2.ok} fail=${run2.fail} / counts equal=${countsEqual} / ids equal=${idsEqual} / dup=${dupInCards}`);

  // --- 異常エントリ記録 ---
  const anomalyRecorded = recordAnomalousOnce(db, run1.runId);

  const finalCounts = tableCounts(db);
  const syncRuns = db.prepare("SELECT id, kind, status, ok_count, fail_count FROM sync_runs ORDER BY id").all();
  const syncErrors = db.prepare("SELECT id, run_id, efhub_card_id, http_status, error FROM sync_errors ORDER BY id").all();

  db.close();

  const md = buildReport({
    now: new Date().toISOString(),
    jsonCount: cards.length,
    badJson: bad,
    run1, run2,
    counts1, counts2, countsEqual, idsEqual, dupInCards,
    verifyResults, verifyOk,
    anomalyRecorded,
    finalCounts, syncRuns, syncErrors,
    dbPathRel: path.relative(ROOT, DB_PATH),
  });
  await fs.writeFile(REPORT, md, "utf8");
  console.log(`[migrate] レポート: ${path.relative(ROOT, REPORT)}`);
  console.log(`[migrate] 完了。照合 ${verifyOk}/${cards.length} 一致 / 冪等 ${countsEqual && idsEqual && !dupInCards}`);
}

function buildReport(x) {
  const L = [];
  L.push("# Phase B.5 SQLite 移行レポート");
  L.push("");
  L.push(`実行日時: ${x.now}`);
  L.push(`DB: ${x.dbPathRel}（node:sqlite・Node標準）`);
  L.push(`外部アクセス: 0 回`);
  L.push("");
  L.push("## 1. 入力");
  L.push(`- src/data/cards/ の有効カード JSON: ${x.jsonCount} 件`);
  L.push(`- 不正 JSON: ${x.badJson.length} 件${x.badJson.length ? " — " + x.badJson.map((b) => `${b.file}(${b.error})`).join(", ") : ""}`);
  L.push("");
  L.push("## 2. 移行結果");
  L.push(`- 1回目: 成功 ${x.run1.ok} / 失敗 ${x.run1.fail}`);
  if (x.run1.errors.length) for (const e of x.run1.errors) L.push(`  - ${e.id}: ${e.error}`);
  L.push("");
  L.push("## 3. テーブル件数（最終）");
  L.push("```");
  L.push(JSON.stringify(x.finalCounts, null, 2));
  L.push("```");
  L.push("");
  L.push("## 4. JSON ↔ SQLite 照合");
  L.push(`- 一致: ${x.verifyOk} / ${x.verifyResults.length}`);
  L.push("");
  L.push("| efhubCardId | 選手 | 照合 | 不一致内容 |");
  L.push("|---|---|---|---|");
  for (const v of x.verifyResults) {
    L.push(`| ${v.id} | ${v.name} | ${v.ok ? "一致" : "不一致"} | ${v.issues.join("; ") || "-"} |`);
  }
  L.push("");
  L.push("> 照合項目: efhub_card_id / ovr_base / ovr_max / name_en / name_ja / player_type_code / level_cap /");
  L.push("> registered_position / playing_style_defensive / parser_version / baseStats 26値 / playerSkills 順序 /");
  L.push("> comSkills / additionalPositions / boost_id_1 / boost_id_2 / player_model_json");
  L.push("");
  L.push("## 5. 冪等性（2回実行）");
  L.push(`- 2回目: 成功 ${x.run2.ok} / 失敗 ${x.run2.fail}`);
  L.push(`- データテーブル件数 1回目==2回目: **${x.countsEqual}**`);
  L.push(`- efhub_card_id 集合 1回目==2回目: **${x.idsEqual}**`);
  L.push(`- player_cards 内の重複 efhub_card_id: **${x.dupInCards ? "あり" : "なし"}**`);
  L.push("```");
  L.push("1回目: " + JSON.stringify(x.counts1));
  L.push("2回目: " + JSON.stringify(x.counts2));
  L.push("```");
  L.push("");
  L.push("## 6. sync_runs");
  L.push("| id | kind | status | ok | fail |");
  L.push("|---|---|---|---|---|");
  for (const r of x.syncRuns) L.push(`| ${r.id} | ${r.kind} | ${r.status} | ${r.ok_count} | ${r.fail_count} |`);
  L.push("");
  L.push("## 7. sync_errors（異常エントリ含む）");
  L.push(`- 8554053 の記録: ${x.anomalyRecorded ? "今回追加" : "既存（重複記録せず）"}`);
  L.push("");
  L.push("| id | run_id | efhub_card_id | http | error |");
  L.push("|---|---|---|---|---|");
  for (const e of x.syncErrors) L.push(`| ${e.id} | ${e.run_id} | ${e.efhub_card_id} | ${e.http_status ?? "-"} | ${e.error} |`);
  L.push("");
  L.push("## 8. 判定");
  const allGood = x.verifyOk === x.verifyResults.length && x.countsEqual && x.idsEqual && !x.dupInCards && x.run1.fail === 0;
  L.push(`- 全カード照合一致・冪等・重複なし・移行失敗0: **${allGood}**`);
  L.push("- UI のデータ参照先は players.sample.json のまま（未切替）。");
  L.push("");
  return L.join("\n") + "\n";
}

main().catch((err) => {
  console.error("\n[migrate] 中断:", err?.stack ?? err);
  process.exit(1);
});
