/**
 * World UI 接続で使うインデックスを SQLite へ追加する（非破壊・冪等）。
 *
 *   node scripts/apply-world-ui-indexes.mjs
 *
 * - CREATE INDEX IF NOT EXISTS のみ。テーブル・データは一切変更しない。
 * - 外部アクセスなし。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB = path.join(ROOT, "data", "efootball.db");

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS ix_wpc_ovr_max      ON world_player_cards(ovr_max)",
  "CREATE INDEX IF NOT EXISTS ix_wpc_ovr_base     ON world_player_cards(ovr_base)",
  "CREATE INDEX IF NOT EXISTS ix_wpc_playstyle    ON world_player_cards(playing_style)",
  "CREATE INDEX IF NOT EXISTS ix_wpc_playstyledef ON world_player_cards(playing_style_def)",
  "CREATE INDEX IF NOT EXISTS ix_wpc_name_en_nocase ON world_player_cards(name_en COLLATE NOCASE)",
];

const db = new DatabaseSync(DB);
db.exec("PRAGMA foreign_keys = ON;");

const before = db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n;
for (const sql of INDEXES) {
  db.exec(sql);
  console.log("OK  " + sql.replace(/\s+/g, " "));
}
const after = db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n;

const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='world_player_cards' ORDER BY name").all().map((r) => r.name);
console.log("\nworld_player_cards のインデックス:", idx.join(", "));
console.log(`world_player_cards 件数: ${before} → ${after}（不変であるべき）`);

const integ = db.prepare("PRAGMA integrity_check").get();
console.log("integrity_check:", JSON.stringify(integ));
db.close();

process.exit(before === after ? 0 : 1);
