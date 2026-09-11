/**
 * World 同期の整合性チェック（読み取り専用・外部アクセスなし）。
 *
 *   node scripts/check-world-sync-integrity.mjs
 *
 * 終了コード: 0 = 問題なし / 1 = 問題あり
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { WORLD_STAT_KEYS } from "./sqlite/world.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB = path.join(ROOT, "data", "efootball.db");

const db = new DatabaseSync(DB, { readOnly: true });
const q = (s, ...a) => db.prepare(s).get(...a);
const qa = (s, ...a) => db.prepare(s).all(...a);

const issues = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? "OK  " : "NG  "} ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) issues.push(`${label}: ${detail ?? ""}`);
};

// 1. SQLite 自体
const integ = qa("PRAGMA integrity_check");
check("PRAGMA integrity_check = ok", JSON.stringify(integ) === '[{"integrity_check":"ok"}]', JSON.stringify(integ));
check("PRAGMA foreign_key_check 違反なし", qa("PRAGMA foreign_key_check").length === 0, `${qa("PRAGMA foreign_key_check").length} 件`);

// 2. 既存 eFHUB データの保護
check("player_cards = 19", q("SELECT COUNT(*) n FROM player_cards").n === 19, `${q("SELECT COUNT(*) n FROM player_cards").n}`);
check("player_index_entries = 47479", q("SELECT COUNT(*) n FROM player_index_entries").n === 47479, `${q("SELECT COUNT(*) n FROM player_index_entries").n}`);
check("player_card_stats = 494", q("SELECT COUNT(*) n FROM player_card_stats").n === 494, `${q("SELECT COUNT(*) n FROM player_card_stats").n}`);

// 3. World カードの重複
const dup = q("SELECT COUNT(*) n FROM (SELECT world_card_id FROM world_player_cards GROUP BY world_card_id HAVING COUNT(*)>1)").n;
check("world_player_cards の world_card_id 重複なし", dup === 0, `${dup} 件`);

// 4. World 件数の整合
const cards = q("SELECT COUNT(*) n FROM world_player_cards").n;
const stats = q("SELECT COUNT(*) n FROM world_player_stats").n;
const app = q("SELECT COUNT(*) n FROM world_player_appearances").n;
const skills = q("SELECT COUNT(*) n FROM world_player_skills").n;
const ai = q("SELECT COUNT(*) n FROM world_player_ai_styles").n;
const totalCount = Number(q("SELECT value FROM world_sync_state WHERE key='world_total_count'")?.value || 0);
console.log(`\n  world_player_cards=${cards}  stats=${stats}  skills=${skills}  ai_styles=${ai}  appearances=${app}  (world_total_count=${totalCount})`);

if (cards > 0) {
  check("world_player_cards 件数 ≈ world_total_count", totalCount === 0 || Math.abs(cards - totalCount) <= 50, `cards ${cards} vs total ${totalCount}`);
  // 能力値: 各カードに 26 行（値が数値のもの）。GK 統計は 40 固定なので基本 26 揃うはず
  const stat26 = q("SELECT COUNT(*) n FROM (SELECT world_card_id FROM world_player_stats WHERE stat_kind='base' GROUP BY world_card_id HAVING COUNT(*)=26)").n;
  check("能力値が26項目そろっているカード = 総カード数", stat26 === cards, `26項目そろい ${stat26} / 全 ${cards}`);
  // stat_key が想定26キーのみ
  const badKey = q("SELECT COUNT(*) n FROM world_player_stats WHERE stat_key NOT IN (" + WORLD_STAT_KEYS.map(() => "?").join(",") + ")", ...WORLD_STAT_KEYS).n;
  check("world_player_stats のキーが想定26種のみ", badKey === 0, `想定外キー ${badKey} 行`);
  // 能力値レンジ
  const outOfRange = q("SELECT COUNT(*) n FROM world_player_stats WHERE value < 1 OR value > 120").n;
  check("能力値が 1..120 の範囲", outOfRange === 0, `範囲外 ${outOfRange} 行`);
  // appearance は cards と同数（appearance が null のカードは許容 → <= cards）
  check("appearances <= cards", app <= cards, `app ${app} / cards ${cards}`);
  // ファイル名≠中身のようなIDズレ（stats の world_card_id が cards に存在）
  const orphanStats = q("SELECT COUNT(*) n FROM world_player_stats s LEFT JOIN world_player_cards c ON c.world_card_id=s.world_card_id WHERE c.world_card_id IS NULL").n;
  check("孤立した world_player_stats 行なし", orphanStats === 0, `${orphanStats} 行`);
}

// 5. stat_key_map / source_priorities のシード
check("stat_key_map = 26 行", q("SELECT COUNT(*) n FROM stat_key_map").n === 26, `${q("SELECT COUNT(*) n FROM stat_key_map").n}`);
check("source_priorities シード済み", q("SELECT COUNT(*) n FROM source_priorities").n >= 5, `${q("SELECT COUNT(*) n FROM source_priorities").n}`);

db.close();

console.log(`\n=> ${issues.length === 0 ? "整合性 OK" : issues.length + " 件の問題あり"}`);
process.exit(issues.length === 0 ? 0 : 1);
