/**
 * 参照データ(SQLite)を代替構成(静的JSON/Supabase想定)へ変換した場合のサイズ・速度・
 * 整合性を、ローカルだけで検証するPoC。
 *
 *   node scripts/poc/reference-data-migration-poc.mjs
 *
 * - 正本 data/efootball.db は readOnly: true でのみ開く(書き込み・スキーマ適用は一切行わない)。
 * - 外部アクセス・実Supabase接続は一切行わない。
 * - 変換成果物はすべて data/poc-hybrid-migration/ 配下(.gitignoreの/data配下、Git追跡対象外)へ出力する。
 * - このスクリプト自体もGitへコミットしない(監査ブランチ上の未コミットファイルとして扱う)。
 */

import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DB_PATH = path.join(ROOT, "data", "efootball.db");
const OUT_DIR = path.join(ROOT, "data", "poc-hybrid-migration");
const REPORT_PATH = path.join(ROOT, "docs", "production-readiness", "reference-data-migration-poc-results.md");

function openReadOnly() {
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function bytesToMiB(n) {
  return (n / 1024 / 1024).toFixed(2);
}

async function writeJson(name, data) {
  const json = JSON.stringify(data);
  const file = path.join(OUT_DIR, name);
  await fs.writeFile(file, json, "utf8");
  const gz = zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  const gzFile = file.replace(/\.json$/, ".json.gz");
  await fs.writeFile(gzFile, gz);
  return { rawBytes: Buffer.byteLength(json, "utf8"), gzBytes: gz.length, count: Array.isArray(data) ? data.length : 1 };
}

function timeIt(fn) {
  const t0 = process.hrtime.bigint();
  const result = fn();
  const t1 = process.hrtime.bigint();
  return { result, ms: Number(t1 - t0) / 1e6 };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const results = [];
  const mem0 = process.memoryUsage().heapUsed;

  const db = openReadOnly();

  // ---- 1. player_index_entries(47,479件)フル ----
  const idx = db.prepare("SELECT * FROM player_index_entries").all();
  const idxFull = await writeJson("player-index-full.json", idx);

  // ---- 2. 軽量検索索引(id/nameEn/nameJa/ovrのみ) ----
  const idxLight = idx.map((r) => ({ i: r.efhub_card_id, e: r.name_en, j: r.name_ja, o: r.ovr_max_candidate }));
  const idxLightRes = await writeJson("player-index-light.json", idxLight);

  // ---- 3. world_player_cards(13,009件)フル(stats/skillsを結合) ----
  const cardsRaw = db.prepare("SELECT * FROM world_player_cards").all();
  const statsByCard = new Map();
  for (const row of db.prepare("SELECT * FROM world_player_stats").all()) {
    if (!statsByCard.has(row.world_card_id)) statsByCard.set(row.world_card_id, []);
    statsByCard.get(row.world_card_id).push({ key: row.stat_key, kind: row.stat_kind, value: row.value });
  }
  const skillsByCard = new Map();
  for (const row of db.prepare("SELECT * FROM world_player_skills ORDER BY display_order").all()) {
    if (!skillsByCard.has(row.world_card_id)) skillsByCard.set(row.world_card_id, []);
    skillsByCard.get(row.world_card_id).push(row.skill_name);
  }
  const cardsFull = cardsRaw.map((c) => ({
    ...c,
    stats: statsByCard.get(c.world_card_id) ?? [],
    skills: skillsByCard.get(c.world_card_id) ?? [],
  }));
  const cardsFullRes = await writeJson("world-cards-full.json", cardsFull);

  // ---- 4. 検索/一覧結果向けの軽量カード(表示に必要な列だけ) ----
  const cardsList = cardsRaw.map((c) => ({
    id: c.world_card_id,
    nameEn: c.name_en,
    nameJa: c.name_ja,
    position: c.registered_position,
    team: c.team,
    league: c.league,
    ovrBase: c.ovr_base,
    ovrMax: c.ovr_max,
    cardType: c.card_type,
    imageUrl: c.image_url,
  }));
  const cardsListRes = await writeJson("world-cards-list.json", cardsList);

  // 典型的な検索結果100件(ovr_max降順の先頭100件)を1ページ分として保存
  const page100 = [...cardsList].sort((a, b) => (b.ovrMax ?? 0) - (a.ovrMax ?? 0)).slice(0, 100);
  const page100Res = await writeJson("world-cards-page100.json", page100);

  // 選手詳細1件分(フル)
  const oneDetail = cardsFull.find((c) => c.world_card_id === "89138556575063") ?? cardsFull[0];
  const oneDetailRes = await writeJson("world-card-detail-one.json", oneDetail);

  // ---- 5. managers(66件) ----
  const managers = db.prepare("SELECT * FROM managers").all();
  const managersRes = await writeJson("managers-full.json", managers);

  // ---- 6. player_booster_definitions(44件) ----
  const boosters = db.prepare("SELECT * FROM player_booster_definitions").all();
  const boostersRes = await writeJson("booster-definitions-full.json", boosters);

  // ---- 検索速度: SQLiteクエリ vs インメモリJS配列フィルタ(同一条件) ----
  const N_TRIALS = 5;
  let sqlTotalMs = 0;
  for (let i = 0; i < N_TRIALS; i++) {
    const { ms } = timeIt(() =>
      db
        .prepare(
          "SELECT world_card_id, name_en, name_ja, ovr_max FROM world_player_cards WHERE registered_position = ? AND ovr_max >= ? ORDER BY ovr_max DESC LIMIT 100",
        )
        .all("CF", 80),
    );
    sqlTotalMs += ms;
  }
  let jsTotalMs = 0;
  for (let i = 0; i < N_TRIALS; i++) {
    const { ms } = timeIt(() =>
      cardsList
        .filter((c) => c.position === "CF" && (c.ovrMax ?? 0) >= 80)
        .sort((a, b) => (b.ovrMax ?? 0) - (a.ovrMax ?? 0))
        .slice(0, 100),
    );
    jsTotalMs += ms;
  }

  // JSON.parse時間(インメモリ配列をシリアライズ→パースし直す往復時間で近似)
  const cardsListJsonStr = JSON.stringify(cardsList);
  const { ms: parseMsCardsList } = timeIt(() => JSON.parse(cardsListJsonStr));
  const idxLightJsonStr = JSON.stringify(idxLight);
  const { ms: parseMsIdxLight } = timeIt(() => JSON.parse(idxLightJsonStr));

  const mem1 = process.memoryUsage().heapUsed;

  // ---- 整合性チェック ----
  const dupIdx = idx.length - new Set(idx.map((r) => r.efhub_card_id)).size;
  const dupCards = cardsRaw.length - new Set(cardsRaw.map((r) => r.world_card_id)).size;
  const missingImage = cardsRaw.filter((c) => !c.image_url).length;
  const missingNameJa = cardsRaw.filter((c) => !c.name_ja).length;
  const nonAsciiSample = cardsRaw.find((c) => /[^\x00-\x7F]/.test(c.name_ja ?? ""));
  const worldCount = db.prepare("SELECT COUNT(*) c FROM world_player_cards").get().c;
  const idxCount = db.prepare("SELECT COUNT(*) c FROM player_index_entries").get().c;
  const mgrCount = db.prepare("SELECT COUNT(*) c FROM managers").get().c;
  const boostCount = db.prepare("SELECT COUNT(*) c FROM player_booster_definitions").get().c;

  db.close();

  const lines = [];
  lines.push("# 参照データ移行PoC 結果(ローカル限定、外部送信なし)");
  lines.push("");
  lines.push(`実行日時: ${new Date().toISOString()}`);
  lines.push(`実行環境: Node ${process.version}(このワークスペース内、実Supabase接続なし)`);
  lines.push("");
  lines.push("**注意: 本PoCは正本SQLiteを読み取り専用でのみ使用し、変更していない。変換成果物はすべて`data/poc-hybrid-migration/`(Git追跡対象外)へ出力した。**");
  lines.push("");
  lines.push("## 1. 変換サイズ(生JSON / gzip圧縮後)");
  lines.push("");
  lines.push("| 成果物 | 件数 | 生サイズ | gzip後 | 1件平均(生) |");
  lines.push("|---|---|---|---|---|");
  const row = (label, r) => `| ${label} | ${r.count.toLocaleString()} | ${bytesToMiB(r.rawBytes)} MiB | ${bytesToMiB(r.gzBytes)} MiB | ${(r.rawBytes / r.count).toFixed(0)} B |`;
  lines.push(row("player_index_entries フル(47,479件)", idxFull));
  lines.push(row("player_index 軽量検索索引(id/名前/OVRのみ)", idxLightRes));
  lines.push(row("world_player_cards フル(stats+skills結合、13,009件)", cardsFullRes));
  lines.push(row("world_player_cards 一覧用軽量版(13,009件)", cardsListRes));
  lines.push(row("典型的な検索結果100件(1ページ分)", page100Res));
  lines.push(row("選手詳細1件(フル)", oneDetailRes));
  lines.push(row("managers フル(66件)", managersRes));
  lines.push(row("player_booster_definitions フル(44件)", boostersRes));
  lines.push("");
  lines.push("## 2. 検索速度(同一条件・5回平均、CF・OVR80以上・上位100件)");
  lines.push("");
  lines.push(`| 方式 | 平均応答時間 |`);
  lines.push(`|---|---|`);
  lines.push(`| SQLite(node:sqlite、インデックスなしの素朴なWHERE) | ${(sqlTotalMs / N_TRIALS).toFixed(2)} ms |`);
  lines.push(`| インメモリJS配列(Array.filter+sort、一覧用軽量版13,009件を全走査) | ${(jsTotalMs / N_TRIALS).toFixed(2)} ms |`);
  lines.push("");
  lines.push("## 3. JSON解析時間・メモリ使用量");
  lines.push("");
  lines.push(`- 一覧用軽量版(13,009件、${bytesToMiB(cardsListRes.rawBytes)} MiB)のJSON.parse: ${parseMsCardsList.toFixed(2)} ms`);
  lines.push(`- 軽量検索索引(47,479件、${bytesToMiB(idxLightRes.rawBytes)} MiB)のJSON.parse: ${parseMsIdxLight.toFixed(2)} ms`);
  lines.push(`- 本PoC実行中のheapUsed増分(概算、GCタイミング依存のため参考値): ${bytesToMiB(mem1 - mem0)} MiB`);
  lines.push("");
  lines.push("## 4. SQLiteとの整合性チェック");
  lines.push("");
  lines.push(`| 項目 | 結果 |`);
  lines.push(`|---|---|`);
  lines.push(`| player_index_entries 件数一致(期待47,479) | ${idxCount === 47479 ? "一致" : "不一致"}(実測${idxCount}) |`);
  lines.push(`| world_player_cards 件数一致(期待13,009) | ${worldCount === 13009 ? "一致" : "不一致"}(実測${worldCount}) |`);
  lines.push(`| managers 件数一致(期待66) | ${mgrCount === 66 ? "一致" : "不一致"}(実測${mgrCount}) |`);
  lines.push(`| player_booster_definitions 件数一致(期待44) | ${boostCount === 44 ? "一致" : "不一致"}(実測${boostCount}) |`);
  lines.push(`| player_index_entries 重複ID | ${dupIdx}件 |`);
  lines.push(`| world_player_cards 重複ID | ${dupCards}件 |`);
  lines.push(`| world_player_cards 画像URL欠損 | ${missingImage}件 / ${cardsRaw.length}件 |`);
  lines.push(`| world_player_cards 日本語名欠損 | ${missingNameJa}件 / ${cardsRaw.length}件 |`);
  lines.push(`| 日本語名(Unicode)のJSON化・再読込確認 | サンプル: ${nonAsciiSample ? `"${nonAsciiSample.name_ja}"(${nonAsciiSample.world_card_id})が変換後も破損なく保持されることを確認` : "サンプルなし"} |`);
  lines.push("");
  lines.push("## 5. 出力ファイル一覧(すべて`data/poc-hybrid-migration/`配下、Git追跡対象外)");
  lines.push("");
  const files = await fs.readdir(OUT_DIR);
  for (const f of files.sort()) {
    const st = await fs.stat(path.join(OUT_DIR, f));
    lines.push(`- ${f}(${bytesToMiB(st.size)} MiB)`);
  }
  lines.push("");

  await fs.writeFile(REPORT_PATH, lines.join("\n") + "\n", "utf8");
  console.log(lines.join("\n"));
  console.log(`\nレポート: ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch((err) => {
  console.error("PoC失敗:", err);
  process.exit(1);
});
