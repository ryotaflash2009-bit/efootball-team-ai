/** 一時: カード付属ブースターの発動方式（activationType）監査。読み取り専用・外部0。使用後に削除。 */
import { DatabaseSync } from "node:sqlite";
import { WORLD_BOOST1_MAP, WORLD_BOOST2_MAP } from "../src/lib/progression/booster-resolution-data.ts";
import { BOOSTER_CATALOG } from "../src/lib/progression/booster-catalog.ts";

const DEF = new Map(BOOSTER_CATALOG.map((b) => [b.key, b]));
const db = new DatabaseSync("./data/efootball.db");
const q = (s, ...p) => db.prepare(s).all(...p);

function actInfo(hit) {
  const def = DEF.get(hit.key);
  if (!def) return null;
  return {
    key: hit.key,
    level: hit.level,
    activation: hit.activation ?? (def.conditional ? "power_of_many" : "fixed"),
    explicit: hit.activation != null,
    evidenceLevel: def.evidenceLevel,
    affectedCount: def.affectedStats.length,
  };
}

for (const [slotName, MAP] of [["boost1", WORLD_BOOST1_MAP], ["boost2", WORLD_BOOST2_MAP]]) {
  const col = slotName;
  console.log(`\n========== ${slotName} ==========`);
  const usedIds = q(`SELECT ${col} id, COUNT(*) n FROM world_player_cards WHERE ${col}<>0 GROUP BY ${col} ORDER BY n DESC`);
  const resolved = usedIds.filter((r) => MAP[r.id]);
  const unresolved = usedIds.filter((r) => !MAP[r.id]);
  console.log(`カードで使用中ユニークID: ${usedIds.length}  (対応表登録 ${Object.keys(MAP).length}) / 解決 ${resolved.length} / 未解決 ${unresolved.length}`);
  let fixedIds = 0, pomIds = 0, derivedFixed = 0, explicitPom = 0, explicitFixed = 0;
  console.log(` ID  |cards| key                  |lvl| activation    |src     | evidence               | 代表`);
  for (const { id, n } of usedIds) {
    const hit = MAP[id];
    if (!hit) {
      const s = q(`SELECT name_en FROM world_player_cards WHERE ${col}=? ORDER BY ovr_base DESC LIMIT 1`, id)[0];
      console.log(` ${String(id).padStart(3)} |${String(n).padStart(4)} | (未解決)             |   |               |        |                        | ${s?.name_en ?? "?"}`);
      continue;
    }
    const a = actInfo(hit);
    if (a.activation === "power_of_many") { pomIds++; if (a.explicit) explicitPom++; }
    else { fixedIds++; if (a.explicit) explicitFixed++; else derivedFixed++; }
    const s = q(`SELECT name_en, card_type FROM world_player_cards WHERE ${col}=? ORDER BY ovr_base DESC LIMIT 1`, id)[0];
    console.log(` ${String(id).padStart(3)} |${String(n).padStart(4)} | ${a.key.padEnd(20)} |${String(a.level).padStart(3)}| ${a.activation.padEnd(13)} |${(a.explicit ? "explicit" : "derived ").padEnd(8)}| ${a.evidenceLevel.padEnd(22)} | ${s?.name_en ?? "?"}`);
  }
  console.log(` → 解決済ID: fixed=${fixedIds} (explicit ${explicitFixed} / derived ${derivedFixed}) / power_of_many=${pomIds} (explicit ${explicitPom})`);
}

console.log(`\n========== 同名 effectKey が複数 World ID ==========`);
for (const [slotName, MAP] of [["boost1", WORLD_BOOST1_MAP], ["boost2", WORLD_BOOST2_MAP]]) {
  const byKey = new Map();
  for (const [id, hit] of Object.entries(MAP)) {
    if (!byKey.has(hit.key)) byKey.set(hit.key, []);
    byKey.get(hit.key).push({ id: +id, level: hit.level, activation: hit.activation ?? (DEF.get(hit.key)?.conditional ? "power_of_many" : "fixed") });
  }
  for (const [key, arr] of byKey) if (arr.length > 1) console.log(` [${slotName}] ${key}: ${arr.map((x) => `id${x.id}(+${x.level},${x.activation})`).join("  ")}`);
}

console.log(`\n========== boost1 と boost2 で同一数値ID ==========`);
for (const id of Object.keys(WORLD_BOOST1_MAP).map(Number)) {
  if (WORLD_BOOST2_MAP[id]) {
    const k1 = WORLD_BOOST1_MAP[id], k2 = WORLD_BOOST2_MAP[id];
    console.log(` ID ${id}: boost1=${k1.key}+${k1.level} / boost2=${k2.key}+${k2.level}  ${k1.key === k2.key ? "(同名)" : "(別効果)"}`);
  }
}

console.log(`\n========== カード単位 ==========`);
const cards = q("SELECT boost1, boost2 FROM world_player_cards WHERE boost1<>0 OR boost2<>0");
let dual = 0, fixedOnly = 0, hasPom = 0, hasUnres = 0, standardApplied = 0;
for (const c of cards) {
  if (c.boost1 && c.boost2) dual++;
  let f = false, p = false, u = false, std = false;
  for (const [id, MAP] of [[c.boost1, WORLD_BOOST1_MAP], [c.boost2, WORLD_BOOST2_MAP]]) {
    if (!id) continue;
    const hit = MAP[id];
    if (!hit) { u = true; continue; }
    const a = actInfo(hit);
    if (!a) { u = true; continue; }
    if (a.activation === "power_of_many") p = true;
    else { f = true; if (["game_client_verified", "screenshot_verified", "external_cross_verified"].includes(a.evidenceLevel)) std = true; }
  }
  if (p) hasPom++;
  if (u) hasUnres++;
  if (std) standardApplied++;
  if (f && !p && !u) fixedOnly++;
}
console.log(` ブースター付き ${cards.length} / デュアル ${dual} / fixedのみ ${fixedOnly} / power_of_many含む ${hasPom} / 未解決ID含む ${hasUnres} / 標準自動適用 ${standardApplied}`);

console.log(`\n========== boost2=44 の全カード（別リーグか） ==========`);
for (const c of q("SELECT world_card_id, name_en, card_type, registered_position, league, nationality, boost1 FROM world_player_cards WHERE boost2=44")) {
  console.log(` ${c.world_card_id} ${c.name_en} | ${c.card_type} | ${c.registered_position} | league=${c.league ?? "-"} | nat=${c.nationality ?? "-"} | boost1=${c.boost1}`);
}
console.log(`\n boost1=83 総数 ${q("SELECT COUNT(*) n FROM world_player_cards WHERE boost1=83")[0].n}`);

console.log(`\n========== SQLite player_booster_source_mappings ==========`);
try {
  console.log(q("SELECT source, activation_type, COUNT(*) n FROM player_booster_source_mappings GROUP BY source, activation_type"));
  for (const r of q("SELECT source, slot, source_booster_id, internal_booster_key, effect_status, activation_type, auto_apply FROM player_booster_source_mappings WHERE activation_type='power_of_many'")) console.log("  PoM row:", r);
} catch (e) { console.log(e.message); }

db.close();
