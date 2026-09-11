/**
 * World 画像の原因調査（読み取り専用・外部アクセス 0 回）。
 *   node scripts/investigate-world-images.mjs
 *
 * SQLite に保存済みの画像 URL 列・ホスト・null 件数などを出力する。
 * 秘密情報は列に無い。表示するのは公開画像 URL のみ。
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

console.log("=== 1. world_player_cards の画像関連列 ===");
console.log(all("PRAGMA table_info(world_player_cards)").filter((c) => /image|url/i.test(c.name)).map((c) => `${c.name} ${c.type}`));

console.log("\n=== 2. world_player_appearances の列（画像パスの有無） ===");
console.log(all("PRAGMA table_info(world_player_appearances)").map((c) => c.name).join(", "));

console.log("\n=== 3-9. 画像 URL の統計 ===");
const total = one("SELECT COUNT(*) n FROM world_player_cards").n;
const imgNotNull = one("SELECT COUNT(*) n FROM world_player_cards WHERE image_url IS NOT NULL AND image_url <> ''").n;
const imgNull = one("SELECT COUNT(*) n FROM world_player_cards WHERE image_url IS NULL OR image_url = ''").n;
const mobNotNull = one("SELECT COUNT(*) n FROM world_player_cards WHERE mobile_image_url IS NOT NULL AND mobile_image_url <> ''").n;
const mobNull = one("SELECT COUNT(*) n FROM world_player_cards WHERE mobile_image_url IS NULL OR mobile_image_url = ''").n;
console.log(`総カード数: ${total}`);
console.log(`image_url あり: ${imgNotNull}  なし(null/空): ${imgNull}`);
console.log(`mobile_image_url あり: ${mobNotNull}  なし(null/空): ${mobNull}`);
console.log(`image_url も mobile も無い: ${one("SELECT COUNT(*) n FROM world_player_cards WHERE (image_url IS NULL OR image_url='') AND (mobile_image_url IS NULL OR mobile_image_url='')").n}`);

console.log("\n=== 6-7. URL は絶対か / ホスト名 ===");
const hosts = all(`
  SELECT
    CASE WHEN instr(image_url,'://')>0
      THEN substr(image_url, 1, instr(image_url,'://')+2) || substr(substr(image_url, instr(image_url,'://')+3), 1, instr(substr(image_url, instr(image_url,'://')+3)||'/', '/')-1)
      ELSE '(relative or none)' END AS origin,
    COUNT(*) c
  FROM world_player_cards
  WHERE image_url IS NOT NULL AND image_url <> ''
  GROUP BY origin ORDER BY c DESC`);
console.log("image_url のホスト:", JSON.stringify(hosts));
const mhosts = all(`
  SELECT
    CASE WHEN instr(mobile_image_url,'://')>0
      THEN substr(mobile_image_url, 1, instr(mobile_image_url,'://')+2) || substr(substr(mobile_image_url, instr(mobile_image_url,'://')+3), 1, instr(substr(mobile_image_url, instr(mobile_image_url,'://')+3)||'/', '/')-1)
      ELSE '(relative or none)' END AS origin,
    COUNT(*) c
  FROM world_player_cards
  WHERE mobile_image_url IS NOT NULL AND mobile_image_url <> ''
  GROUP BY origin ORDER BY c DESC`);
console.log("mobile_image_url のホスト:", JSON.stringify(mhosts));

console.log("\n=== 拡張子の分布（image_url） ===");
console.log(JSON.stringify(all(`
  SELECT lower(substr(image_url, length(image_url)-4)) tail, COUNT(*) c
  FROM world_player_cards WHERE image_url IS NOT NULL AND image_url<>''
  GROUP BY tail ORDER BY c DESC LIMIT 10`)));

console.log("\n=== 10. eFHUB 高信頼リンクあり / なし の内訳 ===");
const linked = one("SELECT COUNT(*) n FROM world_player_cards WHERE internal_card_id IS NOT NULL").n;
console.log(`internal_card_id あり(高信頼リンク): ${linked}`);
console.log(`高信頼リンクなし: ${total - linked}`);
console.log(`高信頼リンクなし かつ image_url あり: ${one("SELECT COUNT(*) n FROM world_player_cards WHERE internal_card_id IS NULL AND image_url IS NOT NULL AND image_url<>''").n}`);
// source_record_links 経由の eFHUB ID を持つ件数
console.log(`source_record_links 経由で eFHUB ID を引ける World カード: ${one(`
  SELECT COUNT(*) n FROM world_player_cards c
  JOIN source_record_links lw ON lw.source='world' AND lw.source_card_id=c.world_card_id
  JOIN source_record_links le ON le.source='efhub' AND le.internal_card_id=lw.internal_card_id`).n}`);

console.log("\n=== 3種類の代表カード ===");
function show(label, row) {
  if (!row) { console.log(`\n[${label}] 該当なし`); return; }
  console.log(`\n[${label}]`);
  console.log(`  worldCardId : ${row.world_card_id}`);
  console.log(`  name        : ${row.name_ja} / ${row.name_en}`);
  console.log(`  efhubLink   : ${row.efhub_card_id ? "あり (" + row.efhub_card_id + ")" : "なし"}`);
  console.log(`  image_url   : ${row.image_url ?? "(null)"}`);
  console.log(`  mobile_url  : ${row.mobile_image_url ?? "(null)"}`);
}
const withLink = `LEFT JOIN source_record_links lw ON lw.source='world' AND lw.source_card_id=c.world_card_id
                  LEFT JOIN source_record_links le ON le.source='efhub' AND le.internal_card_id=lw.internal_card_id`;
const A = one(`SELECT c.world_card_id,c.name_ja,c.name_en,c.image_url,c.mobile_image_url,le.source_card_id efhub_card_id
  FROM world_player_cards c ${withLink}
  WHERE le.source_card_id IS NOT NULL AND c.image_url IS NOT NULL
  ORDER BY c.ovr_max DESC LIMIT 1`);
const B = one(`SELECT c.world_card_id,c.name_ja,c.name_en,c.image_url,c.mobile_image_url,le.source_card_id efhub_card_id
  FROM world_player_cards c ${withLink}
  WHERE le.source_card_id IS NULL AND c.image_url IS NOT NULL AND c.image_url<>''
  ORDER BY c.ovr_max DESC LIMIT 1`);
const C = one(`SELECT c.world_card_id,c.name_ja,c.name_en,c.image_url,c.mobile_image_url,le.source_card_id efhub_card_id
  FROM world_player_cards c ${withLink}
  WHERE (c.image_url IS NULL OR c.image_url='')
  ORDER BY c.ovr_max DESC LIMIT 1`);
show("A: eFHUB リンクあり・画像あり", A);
show("B: eFHUB リンクなし・World 画像あり（現在 NO IMAGE のはず）", B);
show("C: World 画像 URL 自体が無い", C);

console.log("\n=== 先頭ページ(最大OVR降順) 先頭24件の画像状況 ===");
const top = all(`SELECT c.world_card_id,c.name_en, c.image_url IS NOT NULL AND c.image_url<>'' has_img,
  le.source_card_id efhub
  FROM world_player_cards c ${withLink}
  ORDER BY c.ovr_max DESC, c.ovr_base DESC, c.world_card_id ASC LIMIT 24`);
let imgCount = 0, linkCount = 0;
for (const r of top) { if (r.has_img) imgCount++; if (r.efhub) linkCount++; }
console.log(`24件中: World画像URLあり ${imgCount} / eFHUB高信頼リンクあり ${linkCount}`);
console.log("（現在の実装では eFHUB リンクありの " + linkCount + " 件だけ画像表示、残り " + (24 - linkCount) + " 件が NO IMAGE）");

db.close();
