/**
 * World 個別選手ページ（保存済み HTML）から、カード付属ブースターの効果（対象能力・上昇量）を抽出する。
 *   node scripts/analyze-booster-effects.mjs --dir <html保存ディレクトリ>
 *
 * 仕組み: eFootball World（外部コミュニティDB・KONAMI 公式サイトではない）の個別ページの ScoreBar は
 *   ブースター ON の値、RSC の baseAbilities はブースター OFF の値。その差分＝ブースターの効果（対象能力ごとの上昇量）。
 *   EFScout の定義と突き合わせることで「外部2ソースで整合（external_cross_verified）」の判定に使う。ゲーム内実測ではない。
 * - 外部アクセス 0（保存済み HTML のみ）。DB 書き込み 0。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BOOSTER_CATALOG } from "../src/lib/progression/booster-catalog.ts";

const dirArg = process.argv.indexOf("--dir");
const DIR = dirArg >= 0 ? process.argv[dirArg + 1] : "./data/world-pages";
const d = new DatabaseSync("./data/efootball.db");
const NAME2KEY = new Map(BOOSTER_CATALOG.map((b) => [b.nameEn, b.key]));
const CAT = new Map(BOOSTER_CATALOG.map((b) => [b.key, b]));

const N2K = {
  "Offensive Awareness": "offensiveAwareness", "Ball Control": "ballControl", "Dribbling": "dribbling",
  "Tight Possession": "tightPossession", "Low Pass": "lowPass", "Lofted Pass": "loftedPass",
  "Finishing": "finishing", "Heading": "heading", "Set Piece Taking": "setPieceTaking", "Place Kicking": "setPieceTaking",
  "Curl": "curl", "Defensive Awareness": "defensiveAwareness", "Tackling": "tackling", "Ball Winning": "tackling",
  "Defensive Engagement": "defensiveEngagement", "Aggression": "aggression", "Kicking Power": "kickingPower",
  "Speed": "speed", "Acceleration": "acceleration", "Jumping": "jumping", "Jump": "jumping",
  "Physical Contact": "physicalContact", "Balance": "balance", "Stamina": "stamina",
  "GK Awareness": "gkAwareness", "Goalkeeping": "gkAwareness",
  "GK Catching": "gkCatching", "GK Parrying": "gkParrying", "GK Reflexes": "gkReflexes", "GK Reach": "gkReach",
};
const RSCK = { placeKicking: "setPieceTaking", jump: "jumping", goalkeeping: "gkAwareness", ballWinning: "tackling" };

function parsePage(body) {
  const chunks = [...body.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => m[1]);
  let rsc = ""; for (const c of chunks) { try { rsc += JSON.parse('"' + c + '"'); } catch {} }
  const bm = rsc.match(/"baseAbilities":\{([^}]+)\}/); const base = {};
  if (bm) for (const kv of bm[1].split(",")) { const mm = kv.match(/"([^"]+)":(\d+)/); if (mm) base[RSCK[mm[1]] ?? mm[1]] = Number(mm[2]); }
  const shown = {}; let m;
  const re = /statName[^>]*>([^<]+)<\/p>[\s\S]{0,260}?scoreText[^>]*>(\d+)</g;
  while ((m = re.exec(body))) { const k = N2K[m[1].trim()]; if (k) shown[k] = Number(m[2]); }
  const sel = [...body.matchAll(/selectButtonText">([^<]*)</g)].map((x) => x[1].replace(/&#x27;/g, "'").replace(/&amp;/g, "&"));
  const u = []; for (const s of sel) if (u.length < 2) u.push(s);
  return { base, shown, slot1: u[0], slot2: u[1] };
}
const parseLabel = (s) => { const m = (s || "").match(/^(.+?) \+(\d+)$/); return m ? { name: m[1], level: Number(m[2]) } : null; };

const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".html"));
const obs = {}; // key -> [{wid, level, diffs}]
const dualObs = []; // {wid, s1, s2, diffs}
for (const f of files) {
  const wid = f.replace(".html", "");
  const body = await fs.readFile(path.join(DIR, f), "utf8");
  const p = parsePage(body);
  if (Object.keys(p.base).length < 20 || Object.keys(p.shown).length < 20) continue;
  const diffs = {};
  for (const k of Object.keys(p.base)) { const dd = (p.shown[k] ?? p.base[k]) - p.base[k]; if (dd) diffs[k] = dd; }
  const p1 = parseLabel(p.slot1), p2 = parseLabel(p.slot2);
  if (p1 && (!p2 || p.slot2 === "No Booster")) {
    const key = NAME2KEY.get(p1.name); if (!key) continue;
    (obs[key] ??= []).push({ wid, level: p1.level, diffs });
  } else if (p1 && p2) {
    dualObs.push({ wid, s1: p1, s2: p2, diffs });
  }
}

console.log(`保存ページ: ${files.length}  単一ブースター観測: ${Object.values(obs).reduce((a, x) => a + x.length, 0)}  デュアル観測: ${dualObs.length}\n`);
console.log("=== 単一ブースター: 観測された対象能力・上昇量 ===");
const report = [];
for (const [key, arr] of Object.entries(obs).sort()) {
  const sets = new Set(arr.map((e) => Object.keys(e.diffs).sort().join(",")));
  const deltaEqLevel = arr.every((e) => Object.entries(e.diffs).every(([, v]) => v === e.level));
  const merged = [...new Set(arr.flatMap((e) => Object.keys(e.diffs)))].sort();
  const cat = CAT.get(key);
  const catStats = [...(cat?.affectedStats ?? [])].sort();
  const catMatch = merged.join(",") === catStats.join(",");
  const levels = [...new Set(arr.map((e) => e.level))].sort();
  const distinctCards = new Set(arr.map((e) => e.wid)).size;
  const status =
    distinctCards >= 2 && sets.size === 1 && deltaEqLevel && !cat?.conditional
      ? "effect_confirmed 候補"
      : cat?.conditional
        ? "conditional"
        : distinctCards < 2
          ? "1カードのみ（provisional 維持）"
          : "要確認";
  report.push({ key, distinctCards, levels, merged, catMatch, status, deltaEqLevel, setsOk: sets.size === 1 });
  console.log(`${key.padEnd(20)} 別カード${distinctCards} Lv[${levels.join("/")}] → [${merged.join(" ")}]  ${catMatch ? "" : "★カタログ不一致"} ${status}`);
}

console.log("\n=== デュアル（加算検算） ===");
for (const e of dualObs) {
  const k1 = NAME2KEY.get(e.s1.name), k2 = NAME2KEY.get(e.s2.name);
  const c1 = CAT.get(k1), c2 = CAT.get(k2);
  if (!c1 || !c2) { console.log(`  ${e.wid}: key不明`); continue; }
  const expected = {};
  for (const s of c1.affectedStats) expected[s] = (expected[s] ?? 0) + e.s1.level;
  for (const s of c2.affectedStats) expected[s] = (expected[s] ?? 0) + e.s2.level;
  const expStr = Object.entries(expected).sort().map(([k, v]) => `${k}+${v}`).join(" ");
  const obsStr = Object.entries(e.diffs).sort().map(([k, v]) => `${k}+${v}`).join(" ");
  const match = expStr === obsStr;
  console.log(`  ${e.wid} ${e.s1.name}+${e.s1.level} & ${e.s2.name}+${e.s2.level}: ${match ? "✓ 加算一致" : "✗ 不一致"}`);
  if (!match) console.log(`     期待: ${expStr}\n     観測: ${obsStr}`);
}

console.log("\n=== カタログ修正が必要なブースター ===");
for (const r of report) if (!r.catMatch) console.log(`  ${r.key}: → [${r.merged.map((s) => `"${s}"`).join(", ")}]`);

console.log("\n=== effect_confirmed 昇格候補（別カード2+ / 一貫 / delta=level / 非条件） ===");
const cands = report.filter((r) => r.status === "effect_confirmed 候補");
for (const r of cands) console.log(`  ${r.key}  (別カード ${r.distinctCards})`);
console.log(`計 ${cands.length}`);
void d;
