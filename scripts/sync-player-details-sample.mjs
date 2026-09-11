/**
 * Phase B: タイプの異なる20カードの試験取得・解析・保存・検証。
 *
 *   node scripts/sync-player-details-sample.mjs
 *
 * 厳守:
 *  - 対象は下の TARGETS 20カードのみ（allowlist）。
 *  - Messi 89138556575063 / Cannavaro 88041460996837 は既存ローカル JSON を再利用（フェッチしない）。
 *  - 外部 GET は最大18回。各URL最大1回・同時1件・間隔2.5秒以上・タイムアウト20秒・再試行なし・
 *    redirect: "manual"（3xxは失敗記録して次へ）・Cookie/Authorization/APIキーなし。
 *  - efhub.com/players/{id} 以外へアクセスしない。
 *  - 抽出ロジックは src/lib/efhub/parse-player-page.ts と同等の移植。
 *    保存 JSON は src/lib/efhub/sample-cards.test.ts が Phase A の Zod スキーマで再検証する。
 *  - Phase A パーサ本体は変更しない。
 *  - 成功済みカードを壊さない（カードごとに独立ファイル・成功時のみ書き込み）。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARDS_DIR = path.join(ROOT, "src", "data", "cards");
const SAMPLE_FILE = path.join(ROOT, "src", "data", "players.sample.json");
const REPORT_FILE = path.join(ROOT, "docs", "phase-b-player-sample-report.md");

// src/lib/efhub/parser-version.ts と一致させること
const PARSER_VERSION = "efhub-player-page/2026-08-28.1";

// src/lib/efhub/masters.ts の STAT_KEYS と一致させること（test が両者一致を assert）
const STAT_KEYS = [
  "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
  "finishing", "heading", "setPieceTaking", "curl", "speed", "acceleration", "kickingPower", "jump",
  "physicalContact", "balance", "stamina", "defensiveAwareness", "ballWinning", "trackingBack",
  "aggression", "gkAwareness", "gkCatching", "gkClearing", "gkReflexes", "gkReach",
];
const PLAYER_MODEL_KEYS = [
  "armLength", "shoulderWidth", "neckLength", "chestMeasurement", "neckSize", "shoulderHeight",
  "legLength", "thighSize", "waistSize", "armSize", "calfSize", "legCoverageRadius",
  "armCoverageRadius", "jumpingHeight", "torsoCollision", "dribbleHeight",
];
const POSITION_CODES = new Set([
  "GK", "CB", "LB", "RB", "LWB", "RWB", "DMF", "CMF", "LMF", "RMF", "AMF", "LWF", "RWF", "SS", "CF",
]);

// 中心 player オブジェクトの想定キー（Messi/Cannavaro の実測 37キー）
const REFERENCE_PLAYER_KEYS = [
  "id", "name", "nameJa", "nameZh", "slug", "nationality", "nationalityCode", "countryId", "team",
  "teamId", "league", "leagueId", "position", "additionalPositions", "playingStyle", "overallRating",
  "age", "height", "weight", "preferredFoot", "weakFootUsage", "weakFootAccuracy", "form", "condition",
  "injuryResistance", "skills", "comSkills", "stats", "playerModel", "imageUrl", "playerId", "gpValue",
  "datapackId", "playerType", "boostId", "boostId2", "levelCap",
].sort();

const TARGETS = [
  { id: "89138556575063", name: "Lionel Messi", reuseLocal: true },
  { id: "89136409091415", name: "Lionel Messi" },
  { id: "88041460996837", name: "Fabio Cannavaro", reuseLocal: true },
  { id: "88045755964133", name: "Fabio Cannavaro" },
  { id: "88036092150743", name: "Gianluigi Buffon" },
  { id: "88038776505238", name: "Edwin van der Sar" },
  { id: "88045755960770", name: "Paolo Maldini" },
  { id: "88039581945324", name: "Franz Beckenbauer" },
  { id: "88039581945292", name: "Roberto Carlos" },
  { id: "88039581948642", name: "Claude Makelele" },
  { id: "88040387117922", name: "Xavi" },
  { id: "89138288136169", name: "Andres Iniesta" },
  { id: "88036092152543", name: "Michel Platini" },
  { id: "88035823848901", name: "Pavel Nedved" },
  { id: "88041460993461", name: "Luis Figo" },
  { id: "88041460894376", name: "Gareth Bale" },
  { id: "88036360594345", name: "Franck Ribery" },
  { id: "88040387119495", name: "Pele" },
  { id: "88040387119642", name: "Zlatan Ibrahimovic" },
  { id: "8554053", name: "Ismail Nasrallah", edge: true },
];

const MAX_FETCH = 18;
const GAP_MS = 2500;
const TIMEOUT_MS = 20_000;
const HOST = "efhub.com";
const UA = "eFootball-Team-AI-dev/0.1 (phase B sample sync; <=18 requests; no cookies)";

let fetchCount = 0;
let lastAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class StructErr extends Error {}

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---- RSC 抽出（parse-player-page.ts と同等・文字列処理のみ） ----
function extractRscNodes(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(m[1]));
    } catch {
      /* skip */
    }
  }
  const flight = chunks.join("");
  const nodes = [];
  for (const row of flight.split("\n")) {
    const mm = row.match(/^[0-9a-f]+:(?:[A-Za-z]+\d*)?(.*)$/s);
    if (!mm) continue;
    const body = mm[1];
    if (!body || (body[0] !== "{" && body[0] !== "[")) continue;
    try {
      nodes.push(JSON.parse(body));
    } catch {
      /* skip — 実行はしない */
    }
  }
  return nodes;
}

function walk(roots, visit) {
  let count = 0;
  const stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    if (count++ > 200000) break;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length && i < 2000; i++) stack.push(node[i]);
    } else if (isRecord(node)) {
      visit(node);
      for (const k of Object.keys(node)) stack.push(node[k]);
    }
  }
}

function findPlayerObject(nodes, expectedId) {
  let found = null;
  walk(nodes, (node) => {
    if (found) return;
    const idVal = node.playerId ?? node.id;
    if (
      idVal != null &&
      String(idVal) === expectedId &&
      "levelCap" in node &&
      "overallRating" in node &&
      "playingStyle" in node
    ) {
      found = node;
    }
  });
  if (!found) throw new StructErr("中心 player オブジェクトが見つからない（ID一致 + levelCap/overallRating/playingStyle）");
  return found;
}

function findBaseStats(nodes) {
  let found = null;
  walk(nodes, (node) => {
    if (found) return;
    for (const k of STAT_KEYS) if (typeof node[k] !== "number") return;
    const obj = {};
    for (const k of STAT_KEYS) obj[k] = node[k];
    found = obj;
  });
  if (!found) throw new StructErr("baseStats（26能力値）が見つからないか不完全");
  return found;
}

function findStringArrayByKey(nodes, key) {
  let found = null;
  walk(nodes, (node) => {
    if (found) return;
    const v = node[key];
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")) found = v;
  });
  return found;
}

function findAdditionalPositions(nodes) {
  let found = null;
  walk(nodes, (node) => {
    if (found) return;
    const v = node.additionalPositions;
    if (
      Array.isArray(v) &&
      v.every((x) => isRecord(x) && typeof x.position === "string" && typeof x.familiarity === "number")
    ) {
      found = v.map((x) => ({ position: x.position, familiarity: x.familiarity }));
    }
  });
  if (!found) throw new StructErr("additionalPositions 配列が見つからない");
  return found;
}

function reqStr(o, k) {
  const v = o[k];
  if (typeof v === "string") return v;
  if (v == null) throw new StructErr(`player.${k} が欠損`);
  return String(v);
}
function reqNum(o, k) {
  const v = o[k];
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new StructErr(`player.${k} が数値でない/欠損`);
  return n;
}
function optStr(o, k, fb) {
  const v = o[k];
  return typeof v === "string" && v !== "" ? v : fb;
}
function optNum(o, k, fb) {
  const v = o[k];
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fb;
}

/** html → ParsedPlayerCard 形の object（＋生 player キー一覧・defaulted フィールド） */
function assembleCard(html, id, ovrMax, fetchedAt) {
  const nodes = extractRscNodes(html);
  if (nodes.length === 0) throw new StructErr("RSC ペイロードを1件も復元できない");

  const player = findPlayerObject(nodes, id);
  const baseStats = findBaseStats(nodes);
  const additionalPositions = findAdditionalPositions(nodes);
  const playerSkills = findStringArrayByKey(nodes, "playerSkills");
  if (!playerSkills) throw new StructErr("playerSkills 配列が見つからない");

  const comSkills =
    Array.isArray(player.comSkills) && player.comSkills.every((x) => typeof x === "string")
      ? player.comSkills
      : [];

  if (!isRecord(player.playerModel)) throw new StructErr("player.playerModel が見つからない");
  const playerModel = {};
  for (const k of PLAYER_MODEL_KEYS) {
    if (typeof player.playerModel[k] !== "number") throw new StructErr(`playerModel.${k} が数値でない/欠損`);
    playerModel[k] = player.playerModel[k];
  }

  const defaulted = [];
  const slug = optStr(player, "slug", "unknown");
  if (slug === "unknown") defaulted.push("slug");
  const imageUrl = optStr(player, "imageUrl", `https://efimg.com/efootballhub22/images/player_cards/${id}_l.png`);
  if (!player.imageUrl) defaulted.push("imageUrl");
  const gpValue = optNum(player, "gpValue", 0);
  if (typeof player.gpValue !== "number") defaulted.push("gpValue");
  const datapackId = optNum(player, "datapackId", 0);
  if (typeof player.datapackId !== "number") defaulted.push("datapackId");
  const nameZh = optStr(player, "nameZh", "");
  if (!player.nameZh) defaulted.push("nameZh");

  const card = {
    efhubCardId: String(player.playerId ?? player.id),
    slug,
    nameEn: reqStr(player, "name"),
    nameJa: reqStr(player, "nameJa"),
    nameZh,
    registeredPosition: reqStr(player, "position"),
    playingStyleName: reqStr(player, "playingStyle"),
    playerTypeCode: reqNum(player, "playerType"),
    ovrBase: reqNum(player, "overallRating"),
    ovrMax: ovrMax ?? null,
    age: reqNum(player, "age"),
    heightCm: reqNum(player, "height"),
    weightKg: reqNum(player, "weight"),
    preferredFoot: reqStr(player, "preferredFoot"),
    weakFootUsage: reqNum(player, "weakFootUsage"),
    weakFootAccuracy: reqNum(player, "weakFootAccuracy"),
    form: reqNum(player, "form"),
    condition: reqNum(player, "condition"),
    injuryResistance: reqNum(player, "injuryResistance"),
    levelCap: reqNum(player, "levelCap"),
    boostId1: reqNum(player, "boostId"),
    boostId2: reqNum(player, "boostId2"),
    gpValue,
    countryId: reqNum(player, "countryId"),
    leagueId: reqNum(player, "leagueId"),
    leagueName: reqStr(player, "league"),
    teamId: reqStr(player, "teamId"),
    teamName: reqStr(player, "team"),
    imageUrl,
    datapackId,
    baseStats,
    playerSkills,
    comSkills,
    additionalPositions,
    playerModel,
    parserVersion: PARSER_VERSION,
    source: "efhub",
    sourceUrl: `https://${HOST}/players/${id}`,
    fetchedAt,
  };

  return { card, rawPlayerKeys: Object.keys(player).sort(), defaulted };
}

async function fetchPage(id) {
  if (fetchCount >= MAX_FETCH) throw new StructErr(`フェッチ上限 ${MAX_FETCH} を超える要求`);
  const wait = GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);
  const url = `https://${HOST}/players/${id}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  fetchCount++;
  lastAt = Date.now();
  console.log(`[phase-b] (${fetchCount}/${MAX_FETCH}) GET ${url}`);
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
  } finally {
    clearTimeout(t);
  }
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, reason: `redirect ${res.status}`, httpStatus: res.status, location: res.headers.get("location") };
  }
  if (res.status !== 200) {
    return { ok: false, reason: `HTTP ${res.status}`, httpStatus: res.status };
  }
  const text = await res.text();
  const lc = text.toLowerCase();
  if (lc.includes("just a moment") || lc.includes("cf-chl") || /captcha/i.test(text)) {
    return { ok: false, reason: "CAPTCHA/Cloudflare チャレンジの兆候", httpStatus: 200 };
  }
  return { ok: true, text, httpStatus: 200 };
}

async function loadExistingCard(id) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(CARDS_DIR, `${id}.json`), "utf8"));
    return raw && raw.efhubCardId === id ? raw : null;
  } catch {
    return null;
  }
}

function statRange(baseStats) {
  const vals = Object.values(baseStats);
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

async function main() {
  const sample = JSON.parse(await fs.readFile(SAMPLE_FILE, "utf8"));
  const ovrById = new Map(sample.players.map((p) => [p.id, p.ovr]));

  await fs.mkdir(CARDS_DIR, { recursive: true });

  const results = [];
  const now = new Date().toISOString();

  for (const target of TARGETS) {
    const { id, name } = target;
    const rec = { id, name, edge: !!target.edge, status: "", reason: "", checks: {}, rawPlayerKeys: null, defaulted: [] };

    // 既存 & parserVersion 一致 → 再利用（フェッチしない）
    const existing = await loadExistingCard(id);
    if (existing && existing.parserVersion === PARSER_VERSION) {
      rec.status = target.reuseLocal ? "local-reuse" : "skipped-existing";
      rec.checks = {
        idMatch: existing.efhubCardId === id,
        baseStatsCount: Object.keys(existing.baseStats || {}).length,
        statRange: existing.baseStats ? statRange(existing.baseStats) : null,
        playerSkillsIsStringArray: Array.isArray(existing.playerSkills) && existing.playerSkills.every((x) => typeof x === "string"),
        familiarityNumeric: Array.isArray(existing.additionalPositions) && existing.additionalPositions.every((x) => typeof x.familiarity === "number"),
        registeredPosition: existing.registeredPosition,
        playerTypeCode: existing.playerTypeCode,
        levelCap: existing.levelCap,
        boostId1: existing.boostId1,
        boostId2: existing.boostId2,
      };
      results.push(rec);
      console.log(`[phase-b] ${id} ${name}: ${rec.status}`);
      continue;
    }

    // フェッチ
    let fetched;
    try {
      fetched = await fetchPage(id);
    } catch (err) {
      rec.status = "failed";
      rec.reason = `fetch error: ${err?.message ?? err}`;
      results.push(rec);
      console.log(`[phase-b] ${id} ${name}: FAILED (${rec.reason})`);
      continue;
    }
    if (!fetched.ok) {
      rec.status = "failed";
      rec.reason = fetched.reason + (fetched.location ? ` -> ${fetched.location}` : "");
      rec.httpStatus = fetched.httpStatus;
      results.push(rec);
      console.log(`[phase-b] ${id} ${name}: FAILED (${rec.reason})`);
      continue;
    }

    // 解析
    let assembled;
    try {
      assembled = assembleCard(fetched.text, id, ovrById.get(id) ?? null, now);
    } catch (err) {
      rec.status = "failed";
      rec.reason = `parse error: ${err?.message ?? err}`;
      results.push(rec);
      console.log(`[phase-b] ${id} ${name}: FAILED (${rec.reason})`);
      continue;
    }

    const { card, rawPlayerKeys, defaulted } = assembled;
    rec.rawPlayerKeys = rawPlayerKeys;
    rec.defaulted = defaulted;

    // 保存（成功時のみ・カードごとに独立ファイル）
    await fs.writeFile(path.join(CARDS_DIR, `${id}.json`), JSON.stringify(card, null, 2) + "\n", "utf8");

    const range = statRange(card.baseStats);
    rec.status = "fetched";
    rec.checks = {
      idMatch: card.efhubCardId === id,
      baseStatsCount: Object.keys(card.baseStats).length,
      statRange: range,
      statRangeOk: range.min >= 1 && range.max <= 120,
      playerSkillsIsStringArray: card.playerSkills.every((x) => typeof x === "string"),
      playerSkillsCount: card.playerSkills.length,
      comSkillsCount: card.comSkills.length,
      familiarityNumeric: card.additionalPositions.every((x) => typeof x.familiarity === "number"),
      additionalPositions: card.additionalPositions,
      registeredPosition: card.registeredPosition,
      registeredPositionKnown: POSITION_CODES.has(card.registeredPosition),
      playingStyleName: card.playingStyleName,
      playerTypeCode: card.playerTypeCode,
      levelCap: card.levelCap,
      boostId1: card.boostId1,
      boostId2: card.boostId2,
      missingVsReference: REFERENCE_PLAYER_KEYS.filter((k) => !rawPlayerKeys.includes(k)),
      extraVsReference: rawPlayerKeys.filter((k) => !REFERENCE_PLAYER_KEYS.includes(k)),
    };
    results.push(rec);
    console.log(`[phase-b] ${id} ${name}: fetched & saved (type ${card.playerTypeCode}, levelCap ${card.levelCap}, pos ${card.registeredPosition})`);
  }

  // ---- 集計 ----
  const saved = results.filter((r) => r.status === "fetched");
  const reused = results.filter((r) => r.status === "local-reuse" || r.status === "skipped-existing");
  const failed = results.filter((r) => r.status === "failed");

  const dist = (key) => {
    const map = {};
    for (const r of [...saved, ...reused]) {
      const v = r.checks?.[key];
      if (v === undefined) continue;
      map[String(v)] = (map[String(v)] ?? 0) + 1;
    }
    return map;
  };
  const boost2Dist = { zero: 0, nonZero: 0 };
  for (const r of [...saved, ...reused]) {
    if (r.checks?.boostId2 === undefined) continue;
    if (r.checks.boostId2 === 0) boost2Dist.zero++;
    else boost2Dist.nonZero++;
  }

  // 重複チェック
  const files = (await fs.readdir(CARDS_DIR)).filter((f) => /^[0-9]{1,20}\.json$/.test(f));
  const idsFromFiles = [];
  let filenameMismatch = 0;
  for (const f of files) {
    const raw = JSON.parse(await fs.readFile(path.join(CARDS_DIR, f), "utf8"));
    idsFromFiles.push(raw.efhubCardId);
    if (`${raw.efhubCardId}.json` !== f) filenameMismatch++;
  }
  const dupCount = idsFromFiles.length - new Set(idsFromFiles).size;

  // 再実行時のフェッチ対象
  let wouldFetchNext = 0;
  for (const target of TARGETS) {
    const existing = await loadExistingCard(target.id);
    if (!(existing && existing.parserVersion === PARSER_VERSION)) wouldFetchNext++;
  }

  // 同一人物カードの区別
  const messiA = await loadExistingCard("89138556575063");
  const messiB = await loadExistingCard("89136409091415");
  const cannA = await loadExistingCard("88041460996837");
  const cannB = await loadExistingCard("88045755964133");
  const distinguishable = (a, b) =>
    a && b && a.efhubCardId !== b.efhubCardId && JSON.stringify(a.baseStats) !== JSON.stringify(b.baseStats);

  const report = buildReport({
    now, results, saved, reused, failed, fetchCount,
    dist: {
      playerTypeCode: dist("playerTypeCode"),
      levelCap: dist("levelCap"),
      boostId1: dist("boostId1"),
      registeredPosition: dist("registeredPosition"),
    },
    boost2Dist,
    dup: { dupCount, filenameMismatch, fileCount: files.length },
    wouldFetchNext,
    sameName: {
      messi: distinguishable(messiA, messiB),
      cannavaro: distinguishable(cannA, cannB),
    },
  });
  await fs.writeFile(REPORT_FILE, report, "utf8");

  console.log(`\n[phase-b] 完了: fetched=${saved.length} reused=${reused.length} failed=${failed.length} / 外部GET ${fetchCount}`);
  console.log(`[phase-b] レポート: ${path.relative(ROOT, REPORT_FILE)}`);
  console.log(`[phase-b] 重複=${dupCount} ファイル名不一致=${filenameMismatch} 再実行フェッチ対象=${wouldFetchNext}`);
}

function buildReport(x) {
  const L = [];
  L.push("# Phase B 検証レポート — タイプの異なる20カード試験取得");
  L.push("");
  L.push(`実行日時: ${x.now}`);
  L.push(`外部 GET 実行回数: ${x.fetchCount} / 上限 18`);
  L.push(`結果: 取得 ${x.saved.length} / ローカル再利用 ${x.reused.length} / 失敗 ${x.failed.length}`);
  L.push("");

  L.push("## 1. カード別結果");
  L.push("");
  L.push("| # | efhubCardId | 選手 | 状態 | pos | type | levelCap | boost1 | boost2 | 能力値min/max | defaulted |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  x.results.forEach((r, i) => {
    const c = r.checks ?? {};
    const range = c.statRange ? `${c.statRange.min}/${c.statRange.max}` : "-";
    L.push(
      `| ${i + 1} | ${r.id} | ${r.name}${r.edge ? " (edge)" : ""} | ${r.status}${r.reason ? ` — ${r.reason}` : ""} | ${c.registeredPosition ?? "-"} | ${c.playerTypeCode ?? "-"} | ${c.levelCap ?? "-"} | ${c.boostId1 ?? "-"} | ${c.boostId2 ?? "-"} | ${range} | ${(r.defaulted || []).join(",") || "-"} |`,
    );
  });
  L.push("");

  L.push("## 2. 検証チェック（取得/再利用カード）");
  L.push("");
  L.push("| efhubCardId | ID一致 | baseStats数 | 能力値レンジOK | playerSkills文字列配列 | familiarity数値 | posコード既知 |");
  L.push("|---|---|---|---|---|---|---|");
  for (const r of [...x.saved, ...x.reused]) {
    const c = r.checks;
    L.push(
      `| ${r.id} | ${c.idMatch} | ${c.baseStatsCount} | ${c.statRangeOk ?? "(既存)"} | ${c.playerSkillsIsStringArray} | ${c.familiarityNumeric} | ${c.registeredPositionKnown ?? "(既存)"} |`,
    );
  }
  L.push("");

  L.push("## 3. 失敗一覧");
  L.push("");
  if (x.failed.length === 0) {
    L.push("- なし");
  } else {
    L.push("| efhubCardId | 選手 | edge | 理由 |");
    L.push("|---|---|---|---|");
    for (const r of x.failed) L.push(`| ${r.id} | ${r.name} | ${r.edge} | ${r.reason} |`);
  }
  L.push("");

  L.push("## 4. 構造差（生 player オブジェクトのキー・参照＝Messi/Cannavaro の37キー）");
  L.push("");
  L.push("| efhubCardId | 生キー数 | 参照に無いキー(extra) | 参照から欠けるキー(missing) |");
  L.push("|---|---|---|---|");
  for (const r of x.saved) {
    const c = r.checks;
    L.push(`| ${r.id} | ${r.rawPlayerKeys?.length ?? "-"} | ${(c.extraVsReference || []).join(", ") || "-"} | ${(c.missingVsReference || []).join(", ") || "-"} |`);
  }
  L.push("");
  L.push("> ローカル再利用の2枚（Messi 89138556575063 / Cannavaro 88041460996837）は再フェッチしていないため生キー比較なし。");
  L.push("");

  L.push("## 5. 分布");
  L.push("");
  L.push("### playerTypeCode");
  L.push("```");
  L.push(JSON.stringify(x.dist.playerTypeCode, null, 2));
  L.push("```");
  L.push("### levelCap");
  L.push("```");
  L.push(JSON.stringify(x.dist.levelCap, null, 2));
  L.push("```");
  L.push("### boostId1（値ごとの枚数）");
  L.push("```");
  L.push(JSON.stringify(x.dist.boostId1, null, 2));
  L.push("```");
  L.push(`### boostId2: 0 = ${x.boost2Dist.zero} 枚 / 非0 = ${x.boost2Dist.nonZero} 枚`);
  L.push("");
  L.push("### registeredPosition");
  L.push("```");
  L.push(JSON.stringify(x.dist.registeredPosition, null, 2));
  L.push("```");
  L.push("");

  L.push("## 6. 同一人物の別カード区別");
  L.push("");
  L.push(`- Messi (89138556575063 vs 89136409091415): 区別可能 = ${x.sameName.messi}`);
  L.push(`- Cannavaro (88041460996837 vs 88045755964133): 区別可能 = ${x.sameName.cannavaro}`);
  L.push("  （efhubCardId が異なり、baseStats も異なることを確認）");
  L.push("");

  L.push("## 7. 重複防止");
  L.push("");
  L.push(`- src/data/cards/ の JSON ファイル数: ${x.dup.fileCount}`);
  L.push(`- 重複 efhubCardId: ${x.dup.dupCount}`);
  L.push(`- ファイル名 ≠ 中身の efhubCardId: ${x.dup.filenameMismatch}`);
  L.push(`- いま再実行した場合のフェッチ対象件数: ${x.wouldFetchNext}（0 + 失敗分なら重複しない）`);
  L.push("");

  const edge = x.results.find((r) => r.edge);
  L.push("## 8. エッジケース（OVR120・7桁ID）");
  L.push("");
  L.push(`- ${edge?.id} ${edge?.name}: ${edge?.status}${edge?.reason ? ` — ${edge.reason}` : ""}`);
  if (edge?.status === "fetched") {
    L.push(`  - type ${edge.checks.playerTypeCode} / levelCap ${edge.checks.levelCap} / pos ${edge.checks.registeredPosition} / 能力値 ${edge.checks.statRange?.min}-${edge.checks.statRange?.max}`);
  }
  L.push("");

  L.push("## 9. Phase B 成功条件の判定");
  L.push("");
  const nonEdge = x.results.filter((r) => !r.edge);
  const nonEdgeOk = nonEdge.filter((r) => r.status === "fetched" || r.status === "local-reuse" || r.status === "skipped-existing").length;
  L.push(`- 非エッジ ${nonEdge.length} 枚中 成功/再利用 ${nonEdgeOk} 枚（基準: 17以上）`);
  L.push(`- 重複ファイルなし: ${x.dup.dupCount === 0 && x.dup.filenameMismatch === 0}`);
  L.push(`- 再実行フェッチ対象: ${x.wouldFetchNext}`);
  L.push(`- 同一人物カード区別: Messi=${x.sameName.messi} / Cannavaro=${x.sameName.cannavaro}`);
  L.push("- typecheck / lint / test / build の結果はスクリプト外で実行し、本レポートの後に追記。");
  L.push("");

  return L.join("\n") + "\n";
}

main().catch((err) => {
  console.error("\n[phase-b] 中断:", err?.stack ?? err);
  process.exit(1);
});
