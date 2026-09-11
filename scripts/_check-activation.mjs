/** 一時: v8 activation 監査の SQLite 検証。読み取り専用。使用後に削除。 */
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("./data/efootball.db");
const q = (s) => db.prepare(s).all();

console.log("integrity:", db.prepare("PRAGMA integrity_check").get().integrity_check);
console.log("fk_check rows:", db.prepare("PRAGMA foreign_key_check").all().length);
console.log("counts:", {
  world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
  player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
  player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  managers: db.prepare("SELECT COUNT(*) n FROM managers").get().n,
  player_booster_definitions: db.prepare("SELECT COUNT(*) n FROM player_booster_definitions").get().n,
  source_mappings: db.prepare("SELECT COUNT(*) n FROM player_booster_source_mappings").get().n,
});
console.log("\nactivation_type x activation_evidence:");
console.log(q("SELECT source, activation_type, activation_evidence, COUNT(*) n FROM player_booster_source_mappings GROUP BY source, activation_type, activation_evidence ORDER BY source"));
console.log("\npower_of_many rows:");
console.log(q("SELECT source, source_booster_id, internal_booster_key, effect_status, activation_type, activation_evidence, auto_apply FROM player_booster_source_mappings WHERE activation_type='power_of_many'"));
console.log("\nresolved_boosters: applied=1 distinct cards =", db.prepare("SELECT COUNT(DISTINCT world_card_id) n FROM player_card_resolved_boosters WHERE applied=1").get().n);
console.log("resolved_boosters confirmation_status dist:", q("SELECT confirmation_status, COUNT(*) n FROM player_card_resolved_boosters GROUP BY confirmation_status"));
console.log("conflicts:", db.prepare("SELECT COUNT(*) n FROM player_booster_conflicts").get().n);
db.close();
