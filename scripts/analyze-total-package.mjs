/**
 * Total Package（World boost1=83）341 カードの読み取り専用影響分析。
 *   node scripts/analyze-total-package.mjs
 *
 * - 外部アクセス 0。SQLite は SELECT のみ（書き込みなし）。
 * - Total Package は KONAMI 公式「The Power of Many」= 発動条件（Game Plan の同一リーグ登録人数）付き。
 *   条件を静的データ・現状のスカッドで評価できないため conditional_unverified を維持し全モードで未適用。
 *   本スクリプトは「もし +3 を無条件適用したら」の影響（99超過・uncapped）を確認するためのもの。
 */
import { DatabaseSync } from "node:sqlite";
import { getBoosterDef } from "../src/lib/progression/booster-catalog.ts";

const d = new DatabaseSync("./data/efootball.db");
const all = (s, ...p) => d.prepare(s).all(...p);
const one = (s, ...p) => d.prepare(s).get(...p);

const tp = getBoosterDef("total-package");
const STATS = tp.affectedStats; // 26
const LEVEL = 3; // 全 341 カードが +3 表記

const cards = all(`
  SELECT c.world_card_id, c.name_en, c.card_type, c.registered_position, c.nationality,
         c.region, c.league, c.team, c.ovr_base, c.ovr_max, c.maximum_level, c.boost1, c.boost2
  FROM world_player_cards c
  JOIN player_card_resolved_boosters r ON r.world_card_id = c.world_card_id
  WHERE r.internal_booster_key = 'total-package'
`);

const tally = (key) => {
  const m = {};
  for (const c of cards) { const k = c[key] ?? "(null)"; m[k] = (m[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

console.log("=== Total Package 341 カード 影響分析（読み取り専用）===");
console.log("対象カード数:", cards.length);
console.log("catalog: evidenceLevel=", tp.evidenceLevel, " conditional=", tp.conditional, " maxLevel=", tp.maxLevel, " affectedStats=", STATS.length, " conditionEvaluable=", tp.conditionEvaluable);
console.log("\ncard_type:", JSON.stringify(tally("card_type")));
console.log("registered_position:", JSON.stringify(tally("registered_position")));
console.log("league:", JSON.stringify(tally("league")));
console.log("region:", JSON.stringify(tally("region")));
console.log("maximum_level 分布:", JSON.stringify(tally("maximum_level")));

// booster level distribution from resolved table
const lvl = all("SELECT level, COUNT(*) n FROM player_card_resolved_boosters WHERE internal_booster_key='total-package' GROUP BY level");
console.log("\nブースターレベル分布:", JSON.stringify(lvl));
console.log("slot 分布:", JSON.stringify(all("SELECT slot, COUNT(*) n FROM player_card_resolved_boosters WHERE internal_booster_key='total-package' GROUP BY slot")));
console.log("applied フラグ:", JSON.stringify(all("SELECT applied, COUNT(*) n FROM player_card_resolved_boosters WHERE internal_booster_key='total-package' GROUP BY applied")));
console.log("confirmation_status:", JSON.stringify(all("SELECT confirmation_status, COUNT(*) n FROM player_card_resolved_boosters WHERE internal_booster_key='total-package' GROUP BY confirmation_status")));
const names = all("SELECT DISTINCT resolved_name FROM player_card_resolved_boosters WHERE internal_booster_key='total-package'");
console.log("resolved_name の種類:", JSON.stringify(names.map((r) => r.resolved_name)));

// dual booster
const dual = cards.filter((c) => c.boost1 && c.boost2);
console.log("\nデュアルブースターカード:", dual.length);

// name/level/effect conflicts (same source id -> multiple keys)
const raw = all("SELECT world_card_id, boost1, boost2 FROM world_player_cards WHERE boost1=83 OR boost2=83");
console.log("boost1=83 のカード数:", raw.filter((c) => c.boost1 === 83).length, " / boost2=83:", raw.filter((c) => c.boost2 === 83).length);

// impact if +3 applied unconditionally: uncapped = base + 3 for all 26 stats
let cardsWithStats = 0, over99cards = 0, over99pairs = 0, ge100pairs = 0, nullStat = 0, maxUncapped = 0, badKey = 0;
const validKeys = new Set(one("SELECT GROUP_CONCAT(DISTINCT stat_key) g FROM world_player_stats").g.split(","));
for (const k of STATS) if (!validKeys.has(k)) badKey++;
for (const c of cards) {
  const rows = all("SELECT stat_key, value FROM world_player_stats WHERE world_card_id=? AND stat_kind='base'", c.world_card_id);
  if (rows.length === 0) continue;
  cardsWithStats++;
  const base = Object.fromEntries(rows.map((r) => [r.stat_key, r.value]));
  let over = false;
  for (const k of STATS) {
    const bv = base[k];
    if (bv == null) { nullStat++; continue; }
    const u = bv + LEVEL;
    if (u > maxUncapped) maxUncapped = u;
    if (u > 99) { over99pairs++; over = true; }
    if (u >= 100) ge100pairs++;
  }
  if (over) over99cards++;
}
console.log("\n=== もし +3 を無条件適用した場合の影響（実際には全モード未適用）===");
console.log("stats を持つカード:", cardsWithStats, "/", cards.length);
console.log("不正 stat キー:", badKey);
console.log("null 能力値 (card,stat):", nullStat);
console.log("99 超過が発生するカード:", over99cards);
console.log("99 超過する (card,stat) 数:", over99pairs);
console.log("uncapped >= 100 の (card,stat) 数:", ge100pairs);
console.log("最大 uncappedValue:", maxUncapped);

// applied-count invariants
console.log("\n=== 適用カウント不変チェック ===");
console.log("標準モード applied=1 カード:", one("SELECT COUNT(DISTINCT world_card_id) n FROM player_card_resolved_boosters WHERE applied=1").n, "(expect 1931)");
console.log("Total Package applied=1:", one("SELECT COUNT(*) n FROM player_card_resolved_boosters WHERE internal_booster_key='total-package' AND applied=1").n, "(expect 0)");
console.log("player_booster_conflicts:", one("SELECT COUNT(*) n FROM player_booster_conflicts").n, "(expect 0)");
