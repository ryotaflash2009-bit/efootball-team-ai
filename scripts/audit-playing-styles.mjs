/**
 * プレースタイル関連データの棚卸し監査（読み取り専用・外部アクセスなし・SQLite書き込み0）。
 *
 * 目的: docs/playing-style-ledger.md（プレースタイル規則台帳）の根拠となる集計値を、
 * 同一データから常に同一の結果で再現できるようにする。実ユーザーデータへは一切アクセスしない
 * （対象は data/efootball.db 内の World/eFHUB/監督の同期データのみ）。
 *
 *   node scripts/audit-playing-styles.mjs
 *
 * 終了コード: 常に 0（監査結果の報告のみ・合否判定は行わない）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { normalizePlayingStyle, normalizeAiPlayingStyle } from "../src/lib/world/playing-style.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB = path.join(ROOT, "data", "efootball.db");

const db = new DatabaseSync(DB, { readOnly: true });
const q = (sql, ...args) => db.prepare(sql).get(...args);
const qa = (sql, ...args) => db.prepare(sql).all(...args);

function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** 値を「null」「空文字」「実値」に分類して件数集計する（未知値と空値を区別する）。 */
function countByValue(table, column) {
  const total = q(`SELECT COUNT(*) n FROM ${table}`).n;
  const nullCount = q(`SELECT COUNT(*) n FROM ${table} WHERE ${column} IS NULL`).n;
  const emptyCount = q(`SELECT COUNT(*) n FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(${column}) = ''`).n;
  const rows = qa(
    `SELECT ${column} v, COUNT(*) n FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(${column}) <> '' GROUP BY ${column} ORDER BY n DESC, v ASC`,
  );
  return { total, nullCount, emptyCount, distinctCount: rows.length, rows };
}

section("1. world_player_cards.playing_style（攻撃プレースタイル・World由来）");
const worldStyle = countByValue("world_player_cards", "playing_style");
console.log(`総件数=${worldStyle.total} / NULL=${worldStyle.nullCount} / 空文字=${worldStyle.emptyCount} / 実値の種類数=${worldStyle.distinctCount}`);
console.log("上位20件:", worldStyle.rows.slice(0, 20).map((r) => `${r.v}(${r.n})`).join(", "));

section("2. world_player_cards.playing_style_def（守備プレースタイル・World由来）");
const worldStyleDef = countByValue("world_player_cards", "playing_style_def");
console.log(`総件数=${worldStyleDef.total} / NULL=${worldStyleDef.nullCount} / 空文字=${worldStyleDef.emptyCount} / 実値の種類数=${worldStyleDef.distinctCount}`);
console.log("上位20件:", worldStyleDef.rows.slice(0, 20).map((r) => `${r.v}(${r.n})`).join(", "));

section("3. playing_style と playing_style_def の関係（同じ語彙かどうか）");
const styleSet = new Set(worldStyle.rows.map((r) => r.v));
const defSet = new Set(worldStyleDef.rows.map((r) => r.v));
const onlyInDef = [...defSet].filter((v) => !styleSet.has(v));
const onlyInStyle = [...styleSet].filter((v) => !defSet.has(v));
const inBoth = [...styleSet].filter((v) => defSet.has(v));
console.log(`playing_style にのみ存在する値: ${onlyInStyle.length} 種類`);
console.log(`playing_style_def にのみ存在する値: ${onlyInDef.length} 種類 → ${onlyInDef.slice(0, 20).join(", ")}`);
console.log(`両方に存在する値: ${inBoth.length} 種類（同一の値が offensive/defensive 双方の欄に現れる例）`);
const sameValueSameCard = q(
  "SELECT COUNT(*) n FROM world_player_cards WHERE playing_style IS NOT NULL AND playing_style_def IS NOT NULL AND playing_style = playing_style_def",
).n;
console.log(`同一カードで playing_style = playing_style_def となっている件数: ${sameValueSameCard}`);
const defIsBasic = q("SELECT COUNT(*) n FROM world_player_cards WHERE playing_style_def = 'Basic'").n;
console.log(`playing_style_def = 'Basic' の件数（既定値の可能性がある値。意味は未確認）: ${defIsBasic}`);

section("4. player_cards.playing_style_name / playing_style_defensive（eFHUB由来・19件）");
const efhubStyle = countByValue("player_cards", "playing_style_name");
const efhubStyleDef = countByValue("player_cards", "playing_style_defensive");
console.log(`playing_style_name: 総件数=${efhubStyle.total} / NULL=${efhubStyle.nullCount} / 空文字=${efhubStyle.emptyCount} / 実値の種類数=${efhubStyle.distinctCount}`);
console.log("値一覧:", efhubStyle.rows.map((r) => `${r.v}(${r.n})`).join(", "));
console.log(`playing_style_defensive: 総件数=${efhubStyleDef.total} / NULL=${efhubStyleDef.nullCount} / 空文字=${efhubStyleDef.emptyCount} / 実値の種類数=${efhubStyleDef.distinctCount}`);
console.log("値一覧:", efhubStyleDef.rows.map((r) => `${r.v}(${r.n})`).join(", "));

section("5. eFHUB由来と World由来の表記差（playing_style_name vs playing_style）");
const efhubSet = new Set(efhubStyle.rows.map((r) => r.v));
const efhubNotInWorld = [...efhubSet].filter((v) => !styleSet.has(v));
const efhubInWorld = [...efhubSet].filter((v) => styleSet.has(v));
console.log(`eFHUB値のうちWorldの playing_style に完全一致する値: ${efhubInWorld.length} / 一致しない値: ${efhubNotInWorld.length}`);
if (efhubNotInWorld.length > 0) console.log("World側に完全一致が無いeFHUB値:", efhubNotInWorld.join(", "));

section("6. world_player_ai_styles（AIプレースタイル・通常プレースタイルとは別テーブル）");
const aiTotal = q("SELECT COUNT(*) n FROM world_player_ai_styles").n;
const aiPlayers = q("SELECT COUNT(DISTINCT world_card_id) n FROM world_player_ai_styles").n;
const aiDistinct = q("SELECT COUNT(DISTINCT style_name) n FROM world_player_ai_styles").n;
const totalPlayers = q("SELECT COUNT(*) n FROM world_player_cards").n;
console.log(`AIスタイル行数=${aiTotal} / 保持する選手数=${aiPlayers}（全${totalPlayers}選手中） / 選手あたり平均行数=${aiPlayers > 0 ? (aiTotal / aiPlayers).toFixed(2) : "—"} / AIスタイル値の種類数=${aiDistinct}`);
console.log("AIスタイル上位10件:", qa("SELECT style_name v, COUNT(*) n FROM world_player_ai_styles GROUP BY style_name ORDER BY n DESC LIMIT 10").map((r) => `${r.v}(${r.n})`).join(", "));

section("7. manager_link_up_conditions.playing_style（監督のLink-Up Play条件・選手個別のプレースタイルとは別概念）");
const linkUpTotal = q("SELECT COUNT(*) n FROM manager_link_up_conditions").n;
const linkUpWithStyle = q("SELECT COUNT(*) n FROM manager_link_up_conditions WHERE playing_style IS NOT NULL AND TRIM(playing_style) <> ''").n;
const linkUpDistinct = q("SELECT COUNT(DISTINCT playing_style) n FROM manager_link_up_conditions WHERE playing_style IS NOT NULL AND TRIM(playing_style) <> ''").n;
console.log(`Link-Up Play条件の総件数=${linkUpTotal} / playing_style条件を持つ件数=${linkUpWithStyle} / 条件値の種類数=${linkUpDistinct}`);
const linkUpNotInWorld = qa(
  "SELECT DISTINCT playing_style v FROM manager_link_up_conditions WHERE playing_style IS NOT NULL AND TRIM(playing_style) <> ''",
).map((r) => r.v).filter((v) => !styleSet.has(v));
console.log(`Link-Up Play条件値のうち、World player_cards.playing_styleに完全一致しない値: ${linkUpNotInWorld.length} 件`, linkUpNotInWorld.slice(0, 20));

section("8. 表記揺れの簡易検出（大文字小文字・前後空白を無視した重複候補）");
function findCaseInsensitiveDupes(rows) {
  const byLower = new Map();
  for (const r of rows) {
    const key = r.v.trim().toLowerCase();
    if (!byLower.has(key)) byLower.set(key, []);
    byLower.get(key).push(r.v);
  }
  return [...byLower.entries()].filter(([, variants]) => new Set(variants).size > 1);
}
const worldStyleDupes = findCaseInsensitiveDupes(worldStyle.rows);
console.log(`world_player_cards.playing_style の大文字小文字違い候補: ${worldStyleDupes.length} 件`, worldStyleDupes.slice(0, 10));

section("9. 参考: 診断カテゴリ計算・戦術監査での使用状況（コード上の確認結果・本スクリプトでは再確認しない）");
console.log("squad-diagnosis.ts の8カテゴリ計算はプレースタイルを一切使用しない（26能力値のみ）。");
console.log("squad-tactical-review.ts は TacticalPlacementInput.playingStyle / playingStyleDefensive を保持するが、");
console.log("finding生成ロジックでは未使用（発動対象ポジションの確認済み対応表が無いため、意図的に不使用）。");
console.log("link-up.ts は選手自身の playingStyle と Link-Up Play 条件の playingStyle を完全一致（大小無視・trim）で比較する、確認済みの既存機能。");

section("10. 参考: playing_style ごとの registered_position 分布（観察情報・発動対象ポジションの確定根拠ではない）");
console.log("※ これは実データ上の相関を機械的に集計した参考情報であり、公式または確認済みの発動条件ではない。");
console.log("※ 台帳の『発動対象ポジション』列を埋める根拠としては使用しない（未確認のまま『未確認』とする）。");
for (const row of worldStyle.rows) {
  const positions = qa(
    "SELECT registered_position p, COUNT(*) n FROM world_player_cards WHERE playing_style = ? GROUP BY registered_position ORDER BY n DESC LIMIT 3",
    row.v,
  );
  console.log(`  ${row.v}(${row.n}): ${positions.map((p) => `${p.p}=${p.n}`).join(" / ")}`);
}

section("11. 正規化層（src/lib/world/playing-style.ts）を接続した集計");
console.log("※ 本セクションのみ正規化層（正規化されたcanonicalId等）を使用する。他セクションは生データの集計のみ。");

function summarizeNormalization(label, rows, attribute, source) {
  const counts = { known: 0, aliasMatched: 0, basic: 0, empty: 0, anomaly: 0, unknown: 0, notApplicable: 0 };
  const unresolvedValues = new Map();
  for (const row of rows) {
    const r = normalizePlayingStyle(row.v, attribute, source);
    counts[r.status] += row.n;
    if (r.status === "unknown" || r.status === "anomaly") {
      unresolvedValues.set(row.v, (unresolvedValues.get(row.v) ?? 0) + row.n);
    }
  }
  console.log(`\n[${label}] (${source}/${attribute})`);
  console.log(
    `  正規化済み(known)=${counts.known} / 別名一致(aliasMatched)=${counts.aliasMatched} / Basic=${counts.basic} / ` +
      `値なし(empty)=${counts.empty} / 異常値(anomaly)=${counts.anomaly} / 未知値(unknown)=${counts.unknown} / ` +
      `他属性の既知名(notApplicable)=${counts.notApplicable}`,
  );
  if (unresolvedValues.size > 0) {
    console.log(`  正規化できなかった実値: ${[...unresolvedValues.entries()].map(([v, n]) => `${v}(${n})`).join(", ")}`);
  }
  return counts;
}

summarizeNormalization("World playing_style", worldStyle.rows, "offensive", "world");
summarizeNormalization("World playing_style_def", worldStyleDef.rows, "defensive", "world");
summarizeNormalization("eFHUB playing_style_name", efhubStyle.rows, "offensive", "efhub");
// eFHUB playing_style_defensive は19件中19件NULLのため、実値の集計対象は0件（既に§4で確認済み）。
summarizeNormalization("Link-Up Play条件 playing_style", qa("SELECT playing_style v, COUNT(*) n FROM manager_link_up_conditions WHERE playing_style IS NOT NULL AND TRIM(playing_style) <> '' GROUP BY playing_style"), "offensive", "linkUp");

section("12. AIプレースタイルの正規化集計（通常プレースタイルとは別関数・別集計）");
const aiRows = qa("SELECT style_name v, COUNT(*) n FROM world_player_ai_styles GROUP BY style_name");
const aiCounts = { known: 0, unknownMarker: 0, empty: 0, unknown: 0 };
const aiUnresolved = new Map();
for (const row of aiRows) {
  const r = normalizeAiPlayingStyle(row.v, "world");
  aiCounts[r.status] += row.n;
  if (r.status === "unknown") aiUnresolved.set(row.v, (aiUnresolved.get(row.v) ?? 0) + row.n);
}
console.log(
  `known=${aiCounts.known} / unknownMarker(-)=${aiCounts.unknownMarker} / empty=${aiCounts.empty} / unknown=${aiCounts.unknown}`,
);
if (aiUnresolved.size > 0) console.log("正規化できなかった実値:", [...aiUnresolved.entries()]);

db.close();
console.log("\n監査完了（SQLite書き込み: 0件）。");
