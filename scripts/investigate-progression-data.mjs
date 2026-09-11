/**
 * 育成機能の実装前調査（読み取り専用・外部アクセス 0 回）。
 *   node scripts/investigate-progression-data.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB = path.join(ROOT, "data", "efootball.db");

const db = new DatabaseSync(DB, { readOnly: true });
const one = (s, ...a) => db.prepare(s).get(...a);
const all = (s, ...a) => db.prepare(s).all(...a);
const j = (x) => JSON.stringify(x);

console.log("=== world_player_cards: 育成に関係する列の分布 ===");
console.log("maximum_level:", j(one("SELECT MIN(maximum_level) mn, MAX(maximum_level) mx, COUNT(DISTINCT maximum_level) d FROM world_player_cards")));
console.log("maximum_level ヒストグラム:", j(all("SELECT maximum_level lv, COUNT(*) c FROM world_player_cards GROUP BY lv ORDER BY lv")));
console.log("ovr_base:", j(one("SELECT MIN(ovr_base) mn, MAX(ovr_base) mx FROM world_player_cards")));
console.log("ovr_max:", j(one("SELECT MIN(ovr_max) mn, MAX(ovr_max) mx FROM world_player_cards")));
console.log("ovr_max - ovr_base 分布:", j(all("SELECT (ovr_max - ovr_base) diff, COUNT(*) c FROM world_player_cards GROUP BY diff ORDER BY diff")));
console.log("boost1!=0:", one("SELECT COUNT(*) c FROM world_player_cards WHERE COALESCE(boost1,0)<>0").c, " boost2!=0:", one("SELECT COUNT(*) c FROM world_player_cards WHERE COALESCE(boost2,0)<>0").c);
console.log("boost1 の値の種類:", one("SELECT COUNT(DISTINCT boost1) c FROM world_player_cards WHERE COALESCE(boost1,0)<>0").c);
console.log("boost1 上位:", j(all("SELECT boost1, COUNT(*) c FROM world_player_cards WHERE COALESCE(boost1,0)<>0 GROUP BY boost1 ORDER BY c DESC LIMIT 8")));
console.log("card_type × maximum_level 中央値:", j(all("SELECT card_type, MIN(maximum_level) mn, MAX(maximum_level) mx, ROUND(AVG(maximum_level)) avg FROM world_player_cards GROUP BY card_type ORDER BY avg DESC")));

console.log("\n=== world_player_stats: 構造 ===");
console.log("stat_kind の種類:", j(all("SELECT stat_kind, COUNT(*) c FROM world_player_stats GROUP BY stat_kind")));
console.log("value 範囲:", j(one("SELECT MIN(value) mn, MAX(value) mx FROM world_player_stats")));
console.log("value >= 95 の件数:", one("SELECT COUNT(*) c FROM world_player_stats WHERE value>=95").c, " = 99 の件数:", one("SELECT COUNT(*) c FROM world_player_stats WHERE value=99").c, " > 99:", one("SELECT COUNT(*) c FROM world_player_stats WHERE value>99").c);
console.log("GK 統計が 40 固定か（非GK）:", j(one("SELECT COUNT(*) tot, SUM(CASE WHEN value=40 THEN 1 ELSE 0 END) at40 FROM world_player_stats WHERE stat_key LIKE 'gk%'")));

console.log("\n=== eFHUB player_cards: level_cap / booster ===");
console.log("level_cap:", j(all("SELECT level_cap, COUNT(*) c FROM player_cards GROUP BY level_cap ORDER BY level_cap")));
console.log("boost_id_1/2 サンプル:", j(all("SELECT efhub_card_id, name_en, level_cap, boost_id_1, boost_id_2 FROM player_cards LIMIT 20")));

console.log("\n=== stat_key_map（World キー → eFHUB キー） ===");
console.log(j(all("SELECT world_key, efhub_key, name_en FROM stat_key_map ORDER BY name_en")));

console.log("\n=== 代表カードの選定 ===");
function card(label, row) {
  if (!row) { console.log(`[${label}] なし`); return; }
  console.log(`[${label}] ${row.world_card_id} ${row.name_ja}/${row.name_en} type=${row.card_type} pos=${row.registered_position} base=${row.ovr_base} max=${row.ovr_max} lv=${row.maximum_level} boost1=${row.boost1} boost2=${row.boost2}`);
}
const sel = "world_card_id,name_ja,name_en,card_type,registered_position,ovr_base,ovr_max,maximum_level,boost1,boost2";
card("Messi 代表（最大OVR最高）", one(`SELECT ${sel} FROM world_player_cards WHERE name_en='Lionel Messi' ORDER BY ovr_max DESC LIMIT 1`));
console.log("  Messi 全カード:", j(all(`SELECT world_card_id, card_type, registered_position, ovr_base, ovr_max, maximum_level, boost1 FROM world_player_cards WHERE name_en='Lionel Messi' ORDER BY ovr_max DESC`)));
card("Cannavaro 代表", one(`SELECT ${sel} FROM world_player_cards WHERE name_en='Fabio Cannavaro' ORDER BY ovr_max DESC LIMIT 1`));
console.log("  Cannavaro 全カード:", j(all(`SELECT world_card_id, card_type, registered_position, ovr_base, ovr_max, maximum_level, boost1 FROM world_player_cards WHERE name_en='Fabio Cannavaro' ORDER BY ovr_max DESC`)));
card("GK カード（最大OVR最高）", one(`SELECT ${sel} FROM world_player_cards WHERE registered_position='GK' ORDER BY ovr_max DESC LIMIT 1`));
card("攻撃型 CF（最大OVR最高）", one(`SELECT ${sel} FROM world_player_cards WHERE registered_position='CF' ORDER BY ovr_max DESC LIMIT 1`));
card("守備型 CB（最大OVR最高）", one(`SELECT ${sel} FROM world_player_cards WHERE registered_position='CB' ORDER BY ovr_max DESC LIMIT 1`));
card("ブースターなしカード", one(`SELECT ${sel} FROM world_player_cards WHERE COALESCE(boost1,0)=0 AND COALESCE(boost2,0)=0 ORDER BY ovr_max DESC LIMIT 1`));
card("ブースター2つカード", one(`SELECT ${sel} FROM world_player_cards WHERE COALESCE(boost1,0)<>0 AND COALESCE(boost2,0)<>0 ORDER BY ovr_max DESC LIMIT 1`));
card("最大レベル 最小", one(`SELECT ${sel} FROM world_player_cards ORDER BY maximum_level ASC LIMIT 1`));
card("最大レベル 最大", one(`SELECT ${sel} FROM world_player_cards ORDER BY maximum_level DESC LIMIT 1`));

// GK カードの GK 統計は 40 ではない？
const gk = one(`SELECT world_card_id FROM world_player_cards WHERE registered_position='GK' ORDER BY ovr_max DESC LIMIT 1`);
if (gk) {
  console.log("\n  GK カードの能力値:", j(all("SELECT stat_key, value FROM world_player_stats WHERE world_card_id=? ORDER BY stat_key", gk.world_card_id)));
}

db.close();
