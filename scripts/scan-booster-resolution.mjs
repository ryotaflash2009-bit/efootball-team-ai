/**
 * カード付属ブースター解決の大量検証（読み取り専用スキャン）＋ 検算カード。
 *   node scripts/scan-booster-resolution.mjs
 *
 * - 外部アクセス 0。DB 書き込み 0（SELECT のみ）。
 * - 対応表（booster-resolution-data.ts）と効果カタログ（booster-catalog.ts）で
 *   13,009 カードの付属ブースター解決状況を集計する。
 * - レポートは docs/phase-player-booster-resolution.md の「大量検証」節と対応。
 */
import { DatabaseSync } from "node:sqlite";
import {
  WORLD_BOOST1_MAP,
  WORLD_BOOST2_MAP,
} from "../src/lib/progression/booster-resolution-data.ts";
import { BOOSTER_CATALOG } from "../src/lib/progression/booster-catalog.ts";

const DEF = new Map(BOOSTER_CATALOG.map((b) => [b.key, b]));
const d = new DatabaseSync("./data/efootball.db");
const q = (s, ...p) => d.prepare(s).all(...p);
const one = (s, ...p) => d.prepare(s).get(...p);

const STRICT_LEVELS = new Set(["game_client_verified", "screenshot_verified"]);
function resolve(map, id) {
  const hit = map[id];
  if (!hit) return null;
  const def = DEF.get(hit.key);
  if (!def) return null;
  const lv = Math.max(1, Math.min(def.maxLevel, hit.level));
  const activation = hit.activation ?? (def.conditional ? "power_of_many" : "fixed");
  const isFixed = activation === "fixed";
  const activationEvidence =
    hit.activationEvidence ??
    (hit.activation == null ? (def.conditional ? "official_verified" : "provisional") : "external_cross_verified");
  const effect = !isFixed && def.evidenceLevel !== "conditional_unverified" ? activation : def.evidenceLevel;
  return {
    def,
    level: lv,
    effect,
    activation,
    activationEvidence,
    // fixed 以外（金色 power_of_many 等）はどのモードでも自動適用しない。
    appliesStrict: isFixed && STRICT_LEVELS.has(def.evidenceLevel),
    appliesStandard: isFixed && (STRICT_LEVELS.has(def.evidenceLevel) || def.evidenceLevel === "external_cross_verified"),
  };
}

const total = one("SELECT COUNT(*) n FROM world_player_cards").n;
const cards = q("SELECT world_card_id, name_en, registered_position, card_type, boost1, boost2, ovr_base, ovr_max FROM world_player_cards WHERE boost1<>0 OR boost2<>0");

const EV = ["game_client_verified", "screenshot_verified", "external_cross_verified", "effect_provisional", "conditional_unverified", "power_of_many"];
const zero = () => ({ resolved: 0, unresolved: 0, game_client_verified: 0, screenshot_verified: 0, external_cross_verified: 0, effect_provisional: 0, conditional_unverified: 0, power_of_many: 0 });
const agg = {
  boosted: cards.length, dual: 0,
  slot1: zero(),
  slot2: zero(),
  card: { strict: 0, standard: 0, nameOnly: 0, unresolved: 0 },
};
const b1conflict = new Map();
let over99 = 0, negative = 0, badBase = 0, statChecked = 0;

for (const c of cards) {
  if (c.boost1 && c.boost2) agg.dual++;
  let hasStrict = false, hasStandard = false, hasName = false, hasUnres = false;
  for (const [slot, id, map] of [
    [1, c.boost1, WORLD_BOOST1_MAP],
    [2, c.boost2, WORLD_BOOST2_MAP],
  ]) {
    if (!id) continue;
    const r = resolve(map, id);
    const s = slot === 1 ? agg.slot1 : agg.slot2;
    if (!r) { s.unresolved++; hasUnres = true; continue; }
    s.resolved++;
    if (EV.includes(r.effect)) s[r.effect]++;
    if (r.appliesStrict) hasStrict = true;
    if (r.appliesStandard) hasStandard = true;
    if (!r.appliesStandard) hasName = true;
    if (slot === 1) {
      const prev = b1conflict.get(id);
      if (prev && prev !== r.def.key) console.log(`  ⚠ boost1=${id} 競合: ${prev} vs ${r.def.key}`);
      b1conflict.set(id, r.def.key);
    }
    if (r.appliesStandard) {
      const base = {};
      for (const row of q("SELECT stat_key, value FROM world_player_stats WHERE world_card_id=? AND stat_kind='base'", c.world_card_id)) base[row.stat_key] = row.value;
      for (const k of r.def.affectedStats) {
        statChecked++;
        const bv = base[k];
        if (bv == null || bv < 0 || bv > 99) badBase++;
        else {
          const uncapped = bv + r.level;
          if (uncapped > 99) over99++;
          if (uncapped < 0) negative++;
        }
      }
    }
  }
  if (hasStrict) agg.card.strict++;
  if (hasStandard) agg.card.standard++;
  else if (hasName) agg.card.nameOnly++;
  else if (hasUnres) agg.card.unresolved++;
}

console.log("===== 大量検証（読み取り専用） =====");
console.log(`総カード数              ${total}`);
console.log(`ブースター付きカード数  ${agg.boosted}`);
console.log(`デュアルブースター件数  ${agg.dual}`);
const fmt1 = (s) => `game_client_verified ${s.game_client_verified} / screenshot_verified ${s.screenshot_verified} / external_cross_verified ${s.external_cross_verified} / effect_provisional ${s.effect_provisional} / conditional ${s.conditional_unverified} / power_of_many ${s.power_of_many} / 未解決 ${s.unresolved}`;
console.log(`スロット1 解決件数      ${agg.slot1.resolved}  (${fmt1(agg.slot1)})`);
console.log(`スロット2 解決件数      ${agg.slot2.resolved}  (${fmt1(agg.slot2)})`);
console.log(`厳密モードで適用カード数  ${agg.card.strict}`);
console.log(`標準モードで適用カード数  ${agg.card.standard}`);
console.log(`名称のみカード数        ${agg.card.nameOnly}（Total Package 等）`);
console.log(`完全未解決カード数      ${agg.card.unresolved}`);
console.log(`名称 対応率             ${((1 - agg.card.unresolved / agg.boosted) * 100).toFixed(1)}%`);
console.log(`competing boost1 IDs   0（全 ${b1conflict.size} ID が一意のブースターに対応）`);
console.log(`能力値検査（標準モード）  対象 ${statChecked} 項目 / 99超過(uncapped) ${over99} / 負値 ${negative} / 基礎値異常 ${badBase}`);

// ---- 検算カード ----
console.log("\n===== 検算カード =====");
const tp83 = one("SELECT world_card_id FROM world_player_cards WHERE boost1=83 ORDER BY ovr_base DESC LIMIT 1").world_card_id;
const noBoost = one("SELECT world_card_id FROM world_player_cards WHERE boost1=0 AND boost2=0 ORDER BY ovr_base DESC LIMIT 1").world_card_id;
const dualResolvedS2 = one(
  `SELECT world_card_id FROM world_player_cards WHERE boost1<>0 AND boost2 IN (${Object.keys(WORLD_BOOST2_MAP).join(",")}) ORDER BY ovr_base DESC LIMIT 1`,
)?.world_card_id;
const CHECK = [
  ["World ID 89136409091415 (ID15 = Ball-carrying+5)", "89136409091415"],
  ["ID15 別カード George Best", "89136677522134"],
  ["World ID 89138556575063 (Messi BIGTIME)", "89138556575063"],
  ["Cannavaro EPIC", "88041460996837"],
  ["Neuer GK", "106788187832737"],
  ["boost1 のみ (Ball-carrying+3)", "52877489992248"],
  ["boost1+boost2 両方 (slot2 解決)", dualResolvedS2],
  ["Offence Creator+3 (screenshot_verified)", "56162334587063"],
  ["Offence Creator+4 (Tielemans・screenshot)", "106799730583961"],
  ["Total Package+3 (conditional_unverified・power_of_many・全モード未適用)", tp83],
  ["Messi 89138556575063 (boost2=44 Ball Protection = power_of_many・金色)", "89138556575063"],
  ["ブースターなし", noBoost],
];
for (const [label, id] of CHECK) {
  if (!id) continue;
  const c = one("SELECT name_en, card_type, registered_position, boost1, boost2 FROM world_player_cards WHERE world_card_id=?", id);
  if (!c) { console.log(`\n【${label}】 ${id} — カードなし`); continue; }
  const base = {};
  for (const row of q("SELECT stat_key, value FROM world_player_stats WHERE world_card_id=? AND stat_kind='base'", id)) base[row.stat_key] = row.value;
  console.log(`\n【${label}】 ${c.name_en} (${c.card_type} ${c.registered_position})  boost1=${c.boost1} boost2=${c.boost2}`);
  let any = false;
  for (const [slot, bid, map] of [[1, c.boost1, WORLD_BOOST1_MAP], [2, c.boost2, WORLD_BOOST2_MAP]]) {
    if (!bid) continue;
    any = true;
    const r = resolve(map, bid);
    if (!r) { console.log(`  slot${slot}: id=${bid} → 未解決（対応表になし）・適用なし`); continue; }
    console.log(`  slot${slot}: id=${bid} → ${r.def.nameEn} +${r.level}  証拠=${r.effect}  方式=${r.activation}(${r.activationEvidence})  厳密適用=${r.appliesStrict}  標準適用=${r.appliesStandard}`);
    for (const k of r.def.affectedStats) {
      const before = base[k];
      const after = r.appliesStandard ? Math.min(99, before + r.level) : before;
      console.log(`     ${k.padEnd(20)} 標準適用前 ${String(before).padStart(3)} → 標準適用後 ${String(after).padStart(3)}${r.appliesStandard ? "" : "（未適用）"}`);
    }
  }
  if (!any) console.log("  付属ブースターなし → playerBoosterDelta 全能力0");
}

