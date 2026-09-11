/**
 * eFHUB 個別選手ページの RSC から「中心 player オブジェクト」を特定する調査スクリプト。
 *
 *   node scripts/investigate-player-root.mjs 89138556575063 88041460996837
 *
 * 厳守:
 *  - 対象は上記2 IDのみ（allowlist）。他ID・他ページ・他ホスト・発見URLへアクセスしない。
 *  - GET のみ / 各1回・合計最大2回 / 20秒 / 間隔1秒 / 再試行なし / redirect: "manual"。
 *  - Cookie / Authorization / APIキーを使わない。
 *  - 受信データは文字列としてのみ解析。eval / Function / 取得コード実行はしない。JSON.parse 可能な候補のみ。
 *  - レスポンス全体は保存しない。中心オブジェクトの生JSON断片は各8KBまで、その他は各2KBまで、合計40KBまで。
 *  - 成功時のみ docs/player-root-findings.md を新規作成。停止時は作らず終了コード1。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "docs", "player-root-findings.md");

const ALLOWED_IDS = ["89138556575063", "88041460996837"];
const LABEL = { "89138556575063": "Lionel Messi", "88041460996837": "Fabio Cannavaro" };
const HOST = "efhub.com";
const TIMEOUT_MS = 20_000;
const GAP_MS = 1_000;
const MAX_REQUESTS = 2;
const MAX_BYTES = 3 * 1024 * 1024;
const CENTRAL_SNIPPET_MAX = 8 * 1024;
const OTHER_SNIPPET_MAX = 2 * 1024;
const SNIPPET_TOTAL_MAX = 40 * 1024;
const UA = "eFootball-Team-AI-dev/0.1 (RSC central player object research; <=2 requests; no cookies)";

let requestCount = 0;
let lastAt = 0;
let snippetTotal = 0;

function stop(reason, detail) {
  console.error("\n[root] 停止:", reason);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 1000));
  console.error("[root] 成果物は作成しません。実行リクエスト数:", requestCount);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 取得 ----
async function fetchPage(id) {
  if (requestCount >= MAX_REQUESTS) stop(`リクエスト上限(${MAX_REQUESTS})超過`, id);
  const wait = GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);

  const url = `https://${HOST}/players/${id}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  requestCount++;
  lastAt = Date.now();
  console.log(`[root] (${requestCount}/${MAX_REQUESTS}) GET ${url}`);

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
  } catch (err) {
    stop(`GET 失敗（ネットワーク/タイムアウト）: ${url}`, err?.message ?? String(err));
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 300 && res.status < 400) {
    stop(`リダイレクト(${res.status})（自動追跡しない）`, `Location: ${res.headers.get("location") ?? "(なし)"}`);
  }
  if (res.status !== 200) stop(`HTTP ${res.status}`, url);

  const text = await res.text();
  if (text.length > MAX_BYTES) stop(`レスポンスが 3MB 超: ${text.length} bytes`, url);
  const lc = text.toLowerCase();
  if (lc.includes("just a moment") || lc.includes("cf-chl") || lc.includes("challenge-platform")) stop("CAPTCHA/Cloudflare チャレンジの兆候", url);
  if (/captcha/i.test(text)) stop("captcha 文字列を検出", url);

  return { id, url, status: res.status, contentType: res.headers.get("content-type") ?? "(なし)", text, bytes: text.length };
}

// ---- RSC 抽出（文字列処理のみ） ----
function extractParsedNodes(html) {
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
      nodes.push(JSON.parse(body)); // 実行はしない
    } catch {
      /* skip */
    }
  }
  return { chunkCount: chunks.length, flightLen: flight.length, nodes };
}

// ---- 木を歩く ----
function walk(root, visit) {
  let count = 0;
  const stack = [{ node: root, path: "$", depth: 0, parentKey: null }];
  while (stack.length) {
    const { node, path: p, depth, parentKey } = stack.pop();
    if (count++ > 60000 || depth > 18) continue;
    if (node && typeof node === "object") {
      visit(node, p, parentKey);
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length && i < 500; i++) {
          stack.push({ node: node[i], path: `${p}[${i}]`, depth: depth + 1, parentKey: null });
        }
      } else {
        for (const k of Object.keys(node)) {
          stack.push({ node: node[k], path: `${p}.${k}`, depth: depth + 1, parentKey: k });
        }
      }
    }
  }
}

const SIGNAL_KEYS = [
  "baseStats", "playerSkills", "comSkills", "additionalPositions", "playerModel",
  "booster", "boosters", "boost", "boosts",
  "maxLevel", "minLevel", "level", "initialLevel",
  "trainingPoints", "progressionPoints", "progression", "autoAllocate",
  "positionRatings", "positions", "position", "registeredPosition",
  "overall", "ovr", "rating",
  "cardType", "rarity",
  "playStyle", "playingStyle", "playstyle",
  "team", "club", "nationality", "country", "league", "region",
  "strongerFoot", "foot",
  "form", "injuryResistance", "weakFootUsage", "weakFootAccuracy",
];
const SIGNAL_SET = new Set(SIGNAL_KEYS.map((s) => s.toLowerCase()));

function scoreObject(obj, parentKey, targetId) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const keys = Object.keys(obj);
  let score = 0;
  const signals = [];
  for (const k of keys) {
    if (SIGNAL_SET.has(k.toLowerCase())) {
      signals.push(k);
      score += 2;
    }
  }
  const idVal = obj.playerId ?? obj.id ?? obj.i;
  if (idVal != null && String(idVal) === targetId) score += 10;
  if (parentKey && /^(player|card|playercard)$/i.test(parentKey)) score += 6;
  if ("baseStats" in obj) score += 5;
  if ("playerModel" in obj) score += 4;
  if ("playerSkills" in obj) score += 3;
  if (score === 0) return null;
  return { keys, score, signals, idVal: idVal != null ? String(idVal) : null, parentKey };
}

function typePreview(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) {
    const head = v.slice(0, 3).map((x) => (typeof x === "object" && x ? `{${Object.keys(x).slice(0, 6).join(",")}}` : JSON.stringify(x)));
    return `Array(${v.length}) [${head.join(", ")}${v.length > 3 ? ", …" : ""}]`;
  }
  if (typeof v === "object") return `Object {${Object.keys(v).slice(0, 24).join(", ")}${Object.keys(v).length > 24 ? ", …" : ""}}`;
  const s = JSON.stringify(v);
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

function snippet(value, max) {
  let s;
  try {
    s = JSON.stringify(value);
  } catch {
    return "(直列化不可)";
  }
  if (s.length > max) s = s.slice(0, max) + " …(切り詰め)";
  if (snippetTotal + s.length > SNIPPET_TOTAL_MAX) return "(断片合計40KB上限のため省略)";
  snippetTotal += s.length;
  return s;
}

// 目的フィールドのマッチャ（キー名パターン）
const FIELD_MATCHERS = [
  ["OVR", /^(ovr|overall|rating|baseOverall|maxOverall)$/i, "number"],
  ["カードタイプ", /(card.?type|rarity|cardRarity|playerType)/i, "any"],
  ["登録ポジション", /(registered.?position|mainPosition|primaryPosition|^position$|basePosition)/i, "any"],
  ["チーム", /(^team$|teamName|clubName|^club$|teamId|clubId)/i, "any"],
  ["国籍", /(nationality|^country$|nationName|nationId|countryId)/i, "any"],
  ["リーグ", /(^league$|leagueName|leagueId)/i, "any"],
  ["地域", /(^region$|regionName|regionId|confederation)/i, "any"],
  ["利き足", /(strongerFoot|^foot$|dominantFoot)/i, "any"],
  ["プレースタイル", /(play.?style|playstyleId|playStyleCode)/i, "any"],
  ["最大レベル", /(max.?level)/i, "any"],
  ["初期レベル", /(initial.?level|min.?level|startLevel)/i, "any"],
  ["育成ポイント総量", /(training.?points?|progression.?points?|skillPoints?|maxProgression|totalPoints)/i, "any"],
  ["育成レベル別テーブル", /(levelStats|statGrowth|growthTable|progressionTable|levels?$|perLevel)/i, "any"],
  ["自動育成配分", /(auto.?allocate|autoProgression|recommendedProgression|defaultProgression)/i, "any"],
  ["ポジション別総合値", /(position.?ratings?|positionOvr|ovrByPosition|positionScores?)/i, "any"],
  ["Form", /^form$/i, "any"],
  ["Injury Resistance", /(injury.?res)/i, "any"],
  ["Weak Foot Usage", /(weakFootUsage|weak.?foot.?use)/i, "any"],
  ["Weak Foot Accuracy", /(weakFootAcc)/i, "any"],
  ["ブースター", /boost/i, "any"],
  ["能力値グループ(base以外)", /(maxLevelStats|maxStats|currentStats|trainedStats|finalStats|boostedStats|displayStats)/i, "any"],
  ["追加スキル区別", /(additionalSkills|baseSkills|extraSkills|skillList|isAdditional|skillType|aiSkills)/i, "any"],
];

function collectTargetFields(centralObjs) {
  // centralObjs: [{obj, path}]
  const rows = [];
  const seen = new Set();
  for (const { obj, path: cpath } of centralObjs) {
    walk(obj, (node, p) => {
      if (Array.isArray(node)) return;
      for (const [label, re] of FIELD_MATCHERS) {
        for (const k of Object.keys(node)) {
          if (re.test(k)) {
            const key = `${label}|${k}|${cpath}${p.slice(1)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push({ label, key: k, path: `${cpath}${p.slice(1)}.${k}`, preview: typePreview(node[k]) });
          }
        }
      }
    });
  }
  return rows;
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length !== 2 || ids[0] !== ALLOWED_IDS[0] || ids[1] !== ALLOWED_IDS[1]) {
    stop("引数が許可された2 IDと一致しません", `期待: ${ALLOWED_IDS.join(" ")} / 受領: ${ids.join(" ")}`);
  }

  const pages = [];
  for (const id of ids) pages.push(await fetchPage(id));

  const perPlayer = [];
  for (const pg of pages) {
    const { chunkCount, flightLen, nodes } = extractParsedNodes(pg.text);

    // 候補オブジェクトを収集（重複はキー署名で除去）
    const candidates = [];
    const sigSeen = new Set();
    for (const root of nodes) {
      walk(root, (node, p, parentKey) => {
        const sc = scoreObject(node, parentKey, pg.id);
        if (!sc) return;
        const sig = sc.keys.slice().sort().join("|");
        if (sigSeen.has(sig)) return;
        sigSeen.add(sig);
        candidates.push({ path: p, ...sc, obj: node });
      });
    }
    candidates.sort((a, b) => b.score - a.score);

    // 中心オブジェクト = 最高スコア。加えて parentKey==player / idVal==target のものも採用
    const central = [];
    if (candidates[0]) central.push(candidates[0]);
    for (const c of candidates) {
      if (central.includes(c)) continue;
      if (/^(player|card|playercard)$/i.test(c.parentKey ?? "") || c.idVal === pg.id) {
        if (!central.some((x) => x.path === c.path)) central.push(c);
      }
      if (central.length >= 4) break;
    }

    const centralForFields = central.map((c) => ({ obj: c.obj, path: c.path }));
    const targetRows = collectTargetFields(centralForFields);

    perPlayer.push({
      id: pg.id,
      label: LABEL[pg.id],
      url: pg.url,
      status: pg.status,
      bytes: pg.bytes,
      chunkCount,
      flightLen,
      nodeCount: nodes.length,
      candidateCount: candidates.length,
      central: central.map((c) => ({
        path: c.path,
        score: c.score,
        parentKey: c.parentKey,
        idVal: c.idVal,
        signals: c.signals,
        keys: c.keys,
        keyTypeMap: c.keys.slice(0, 120).map((k) => ({ k, t: typePreview(c.obj[k]) })),
        raw: snippet(c.obj, CENTRAL_SNIPPET_MAX),
      })),
      targetRows,
    });

    console.log(
      `[root] ${pg.id} candidates=${candidates.length} centralPaths=${central.map((c) => c.path).join(" , ")}`,
    );
  }

  const specified = perPlayer.every((p) => p.central.length > 0);
  if (!specified) {
    stop("中心 player オブジェクトを特定できませんでした", perPlayer.map((p) => `${p.id}: candidates=${p.candidateCount}`).join("\n"));
  }

  const md = buildMarkdown(perPlayer);
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, md, "utf8");
  console.log(`\n[root] 作成: ${path.relative(ROOT, OUT_FILE)} / 断片合計 ${snippetTotal} bytes / リクエスト ${requestCount}/${MAX_REQUESTS}`);
}

function buildMarkdown(perPlayer) {
  const L = [];
  L.push("# eFHUB 個別選手ページ 中心 player オブジェクト 調査結果");
  L.push("");
  L.push(`実行日時: ${new Date().toISOString()}`);
  L.push("対象: Lionel Messi (89138556575063) / Fabio Cannavaro (88041460996837)");
  L.push("外部アクセス: efhub.com の個別ページ GET ×2。他ホスト・他URLへのアクセスなし。");
  L.push("解析: 受信テキストの文字列解析のみ。eval/Function/コード実行なし。JSON.parse 可能な候補のみ。");
  L.push("");

  for (const p of perPlayer) {
    L.push(`## ${p.label} (${p.id})`);
    L.push("");
    L.push(`- URL: ${p.url} / HTTP ${p.status} / ${p.bytes} B / RSCチャンク ${p.chunkCount} / パースノード ${p.nodeCount} / 候補オブジェクト ${p.candidateCount}`);
    L.push("");
    p.central.forEach((c, idx) => {
      L.push(`### 中心オブジェクト候補 ${idx + 1}: \`${c.path}\`（score ${c.score}${c.parentKey ? `, parentKey=${c.parentKey}` : ""}${c.idVal ? `, id=${c.idVal}` : ""}）`);
      L.push("");
      L.push(`シグナルキー: ${c.signals.join(", ") || "（なし）"}`);
      L.push("");
      L.push(`全キー (${c.keys.length}):`);
      L.push("```");
      L.push(c.keys.join(", "));
      L.push("```");
      L.push("");
      L.push("キー → 型/値プレビュー:");
      L.push("");
      L.push("| キー | 型 / 値 |");
      L.push("|---|---|");
      for (const { k, t } of c.keyTypeMap) L.push(`| \`${k}\` | ${String(t).replace(/\|/g, "\\|").slice(0, 300)} |`);
      L.push("");
      L.push("生JSON断片（上限8KB・切り詰めあり）:");
      L.push("```json");
      L.push(c.raw);
      L.push("```");
      L.push("");
    });

    L.push(`### 目的フィールドの検出（${p.label}）`);
    L.push("");
    if (p.targetRows.length === 0) {
      L.push("- （目的フィールドに一致するキーを中心オブジェクト配下で検出できず）");
    } else {
      L.push("| 目的 | 検出キー | パス | 型 / 値 |");
      L.push("|---|---|---|---|");
      for (const r of p.targetRows) {
        L.push(`| ${r.label} | \`${r.key}\` | \`${r.path}\` | ${String(r.preview).replace(/\|/g, "\\|").slice(0, 260)} |`);
      }
    }
    L.push("");
  }

  // 共通 / カード固有
  const [a, b] = perPlayer;
  const keysA = new Set(a.central.flatMap((c) => c.keys));
  const keysB = new Set(b.central.flatMap((c) => c.keys));
  const common = [...keysA].filter((k) => keysB.has(k)).sort();
  const onlyA = [...keysA].filter((k) => !keysB.has(k)).sort();
  const onlyB = [...keysB].filter((k) => !keysA.has(k)).sort();
  L.push("## 共通構造 / カード固有構造");
  L.push("");
  L.push(`- 共通キー (${common.length}): ${common.join(", ") || "（なし）"}`);
  L.push(`- Messi のみ (${onlyA.length}): ${onlyA.join(", ") || "（なし）"}`);
  L.push(`- Cannavaro のみ (${onlyB.length}): ${onlyB.join(", ") || "（なし）"}`);
  L.push("");

  L.push("## 分類（A 確認済み / B 有力な推測 / C 未確認 / D 取得不可）");
  L.push("");
  L.push("> 実際の値・キー名は上の各表を根拠に手作業で確定すること。");
  L.push("> 「検出」= 中心オブジェクト配下にキーが存在した。値の意味・単位・コード対応が未確認なら C。");
  L.push("");
  L.push("| 項目 | 状態 | 根拠 |");
  L.push("|---|---|---|");
  const has = (p, label) => p.targetRows.some((r) => r.label === label);
  const bothHas = (label) => has(perPlayer[0], label) && has(perPlayer[1], label);
  const line = (label) => {
    const state = bothHas(label) ? "B（両カードでキー検出・意味は要確認）" : has(perPlayer[0], label) || has(perPlayer[1], label) ? "C（片方のみ検出）" : "D（中心オブジェクト配下に未検出）";
    return `| ${label} | ${state} | 上表参照 |`;
  };
  for (const label of [
    "OVR", "カードタイプ", "登録ポジション", "チーム", "国籍", "リーグ", "地域", "利き足",
    "プレースタイル", "最大レベル", "初期レベル", "育成ポイント総量", "育成レベル別テーブル",
    "自動育成配分", "ポジション別総合値", "Form", "Injury Resistance",
    "Weak Foot Usage", "Weak Foot Accuracy", "ブースター", "能力値グループ(base以外)", "追加スキル区別",
  ]) {
    L.push(line(label));
  }
  L.push("");

  L.push("## 更新した自前DBスキーマ案（前回 docs/player-detail-findings.md からの差分）");
  L.push("");
  L.push("- 中心オブジェクトの実キー名が判明したら `stat_definitions` / `playstyles` / `skills` の key を実キーに合わせる。");
  L.push("- OVR は `ovr_base`（RSC）と `ovr_max` / `ovr_by_position`（自前計算）を分離。");
  L.push("- 育成テーブルが取得できた場合のみ `progression_rules` を実装（式は推測で作らない）。");
  L.push("- ブースターは card 側の適用状態（`applied_before` / `applied_after`）と booster マスタを分離。");
  L.push("");

  L.push("## 次のフェーズ");
  L.push("- 調査はここで終了。Phase A（詳細データパーサー + DBスキーマ）の実装計画をチャットで提示し、承認を待つ。");
  L.push("");

  return L.join("\n") + "\n";
}

main().catch((err) => stop("想定外のエラー", err?.stack ?? String(err)));
