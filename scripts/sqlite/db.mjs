/**
 * node:sqlite（Node.js 標準・実験的機能）の共通処理。
 * 新規 npm パッケージは使わない。
 *
 * DB ファイルは data/efootball.db 固定。パスはこのファイルからの相対で組み立てる
 * （絶対パスを文字列連結で組み立てない）。
 */

import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../scripts/sqlite
const ROOT = path.resolve(HERE, "..", "..");              // ワークスペース直下
export const DB_PATH = path.join(ROOT, "data", "efootball.db");
const SCHEMA_PATH = path.join(HERE, "schema.sql");

/** data/ を用意して DB を開き、schema.sql を適用して返す */
export async function openDb() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  const schema = await fs.readFile(SCHEMA_PATH, "utf8");
  db.exec(schema); // すべて IF NOT EXISTS（冪等）
  return db;
}

/** テーブルの行数 */
export function count(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

/**
 * 索引エントリの異常判定（共有ロジック）。
 * 返り値: 異常なら理由文字列、正常なら null。
 *
 * 注: eFHUB の選手ID は「短いID（2〜8桁・標準カード）」と「長いID（14〜15桁・特殊カード）」の
 *     2レンジが存在し、いずれも正常。ID 桁数では判定しない。
 *     OVR は 40〜109 が通常。>=115 は 8554053/8554076（Ismail Nasrallah / Safi Belal, OVR120）
 *     のような「通常の詳細ページを持たないテンプレート的エントリ」の兆候。
 */
export function classifyIndexAnomaly(idStr, nameEn, nameJa, ovr) {
  const reasons = [];
  if (!/^[0-9]{1,20}$/.test(String(idStr ?? ""))) reasons.push("invalid id format");
  if ((nameEn == null || nameEn === "") && (nameJa == null || nameJa === "")) reasons.push("empty names");
  if (ovr == null || !Number.isFinite(Number(ovr)) || Number(ovr) < 1) reasons.push("ovr missing or < 1");
  else if (Number(ovr) >= 115) reasons.push("ovr >= 115 (likely template entry without a normal detail page)");
  return reasons.length ? reasons.join("; ") : null;
}

/** 主要テーブルの行数まとめ */
export function tableCounts(db) {
  const tables = [
    "parser_versions",
    "player_cards",
    "player_card_stats",
    "player_card_skills",
    "player_card_com_skills",
    "player_card_positions",
    "player_card_boosters",
    "sync_runs",
    "sync_errors",
  ];
  const out = {};
  for (const t of tables) out[t] = count(db, t);
  return out;
}
