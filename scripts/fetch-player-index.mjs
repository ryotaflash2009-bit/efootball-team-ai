/**
 * eFHUB の player-index.json を「1回だけ」GET し、先頭最大100件を
 * ワークスペース内へ保存する検証スクリプト。
 *
 *   node scripts/fetch-player-index.mjs
 *
 * 方針:
 *  - アクセスは https://efhub.com/search/player-index.json への GET 1回のみ
 *  - タイムアウト 20 秒
 *  - 失敗時（ネットワーク / 非200 / 非JSON / 非配列 / 検証失敗）はファイルを書かずに終了コード 1
 *  - 選手ID は数値精度の劣化を避けるため、JSON パース前に文字列化する
 *  - 保存先: src/data/players.sample.json, src/data/meta.json
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://efhub.com/search/player-index.json";
const METHOD = "GET";
const TIMEOUT_MS = 20_000;
const MAX_SAVE = 100;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const PLAYERS_FILE = path.join(DATA_DIR, "players.sample.json");
const META_FILE = path.join(DATA_DIR, "meta.json");

function fail(message, detail) {
  console.error("[fetch-player-index] 失敗:", message);
  if (detail !== undefined) console.error(detail);
  console.error("[fetch-player-index] ファイルは書き込みませんでした。");
  process.exit(1);
}

async function main() {
  console.log(`[fetch-player-index] GET ${SOURCE_URL} (timeout ${TIMEOUT_MS}ms)`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(SOURCE_URL, {
      method: METHOD,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "eFootball-Team-AI-dev/0.1 (local verification; 1 request)",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    fail("ネットワークエラーまたはタイムアウト", err?.message ?? err);
    return;
  }
  clearTimeout(timer);

  if (!res.ok) {
    fail(`HTTP ステータスが 200 系ではありません: ${res.status} ${res.statusText}`);
    return;
  }

  const contentType = res.headers.get("content-type") ?? "(なし)";
  let rawText;
  try {
    rawText = await res.text();
  } catch (err) {
    fail("レスポンス本文の読み取りに失敗", err?.message ?? err);
    return;
  }

  // 選手ID (キー "i") を文字列化してから JSON.parse する（大きな数値の精度劣化を防ぐ）。
  const idSafeText = rawText.replace(/([{,]\s*)"i"\s*:\s*(\d+)/g, '$1"i":"$2"');

  let data;
  try {
    data = JSON.parse(idSafeText);
  } catch (err) {
    fail("レスポンスが JSON として解釈できません", err?.message ?? err);
    return;
  }

  if (!Array.isArray(data)) {
    fail(`レスポンスのトップレベルが配列ではありません（型: ${typeof data}）`);
    return;
  }

  const totalReceived = data.length;
  if (totalReceived === 0) {
    fail("配列が空です");
    return;
  }

  // --- 先頭3件を検証・表示（i/e/j/o の意味確認用） ---
  console.log("[fetch-player-index] 先頭3件（生データ）:");
  for (const entry of data.slice(0, 3)) {
    console.log("  " + JSON.stringify(entry));
  }

  const sample = data[0];
  const keys = sample && typeof sample === "object" ? Object.keys(sample) : [];
  console.log(`[fetch-player-index] 1件目のキー: [${keys.join(", ")}]`);

  // --- 正規化 + 検証 ---
  const players = [];
  let invalid = 0;
  for (const entry of data.slice(0, MAX_SAVE)) {
    if (!entry || typeof entry !== "object") {
      invalid++;
      continue;
    }
    const idRaw = entry.i;
    const eRaw = entry.e;
    const jRaw = entry.j;
    const oRaw = entry.o;

    const id = idRaw === undefined || idRaw === null ? "" : String(idRaw);
    const nameEn = typeof eRaw === "string" ? eRaw : eRaw == null ? "" : String(eRaw);
    const nameJa = typeof jRaw === "string" ? jRaw : jRaw == null ? "" : String(jRaw);
    const ovrNum = typeof oRaw === "string" ? Number(oRaw) : oRaw;
    const ovr = Number.isFinite(ovrNum) ? ovrNum : NaN;

    if (id === "" || !Number.isFinite(ovr)) {
      invalid++;
      continue;
    }
    players.push({ id, nameJa, nameEn, ovr });
  }

  if (players.length === 0) {
    fail(`先頭 ${MAX_SAVE} 件のうち有効な選手が0件でした（不正 ${invalid} 件）。データ構造が想定と大きく異なります。`);
    return;
  }

  // 想定（i=ID, e=英語名, j=日本語名, o=OVR）との整合をざっくり判定
  const looksEnglish = /[A-Za-z]/.test(players[0].nameEn);
  const looksJapanese = /[぀-ヿ一-龯]/.test(players[0].nameJa);
  const ovrInRange = players.every((p) => p.ovr >= 0 && p.ovr <= 120);

  const fetchedAt = new Date().toISOString();
  const meta = {
    source: "eFHUB",
    sourceUrl: SOURCE_URL,
    method: METHOD,
    fetchedAt,
    totalReceived,
    savedCount: players.length,
    note: `content-type=${contentType}; invalid=${invalid}; keys=[${keys.join("|")}]; ` +
      `check(e=英字:${looksEnglish}, j=日本語:${looksJapanese}, o=0-120:${ovrInRange})`,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PLAYERS_FILE, JSON.stringify({ players }, null, 2) + "\n", "utf8");
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2) + "\n", "utf8");

  console.log("[fetch-player-index] 保存しました:");
  console.log(`  ${path.relative(ROOT, PLAYERS_FILE)}  (${players.length} 件)`);
  console.log(`  ${path.relative(ROOT, META_FILE)}`);
  console.log(`[fetch-player-index] 受信 ${totalReceived} 件 / 保存 ${players.length} 件 / 不正 ${invalid} 件`);
  console.log(`[fetch-player-index] 想定チェック: e=英字:${looksEnglish} j=日本語:${looksJapanese} o=0-120:${ovrInRange}`);
}

main().catch((err) => fail("想定外のエラー", err?.stack ?? err));
