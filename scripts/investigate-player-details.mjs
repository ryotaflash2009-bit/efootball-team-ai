/**
 * eFHUB 個別選手ページのデータ構造を調べる調査スクリプト（2カードのみ・最大2リクエスト）。
 *
 *   node scripts/investigate-player-details.mjs 89138556575063 88041460996837
 *
 * 厳守:
 *  - 対象は上記2 IDのみ（allowlist）。他IDや他ページ・他ホストへはアクセスしない。
 *  - GET のみ / 各1回・合計最大2回 / 20秒 / 間隔1秒 / 再試行なし / redirect: "manual"。
 *  - Cookie / Authorization / APIキーを使わない。
 *  - 受信データは「文字列」としてのみ解析。eval や取得コードの実行はしない。
 *  - JSON.parse が通る候補だけを扱う。
 *  - レスポンス全体は保存しない。代表 JSON 断片のみ（各2KB以内・合計30KB以内）を成果物へ。
 *  - 画像バイナリは取得も保存もしない。
 *  - 発見した新API/URLへはアクセスしない（記録のみ）。
 *  - 成功時のみ docs/player-detail-findings.md を新規作成。停止時は作らず終了コード1。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "docs", "player-detail-findings.md");

const ALLOWED_IDS = ["89138556575063", "88041460996837"];
const ID_LABEL = { "89138556575063": "Lionel Messi", "88041460996837": "Fabio Cannavaro" };
const PAGE_HOST = "efhub.com";
const TIMEOUT_MS = 20_000;
const GAP_MS = 1_000;
const MAX_REQUESTS = 2;
const MAX_BYTES = 3 * 1024 * 1024;
const SNIPPET_MAX = 2 * 1024;
const SNIPPET_TOTAL_MAX = 30 * 1024;
const UA = "eFootball-Team-AI-dev/0.1 (player detail structure research; <=2 requests; no cookies)";

let requestCount = 0;
let lastAt = 0;
let snippetTotal = 0;

function stop(reason, detail) {
  console.error("\n[detail] 停止:", reason);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 800));
  console.error("[detail] 成果物は作成しません。実行リクエスト数:", requestCount);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 能力値トークン（英語キャメル正規名 → 表示名） ----
const STAT_TOKENS = {
  offensiveAwareness: "Offensive Awareness",
  ballControl: "Ball Control",
  dribbling: "Dribbling",
  tightPossession: "Tight Possession",
  lowPass: "Low Pass",
  loftedPass: "Lofted Pass",
  finishing: "Finishing",
  heading: "Heading",
  setPieceTaking: "Set Piece Taking",
  curl: "Curl",
  defensiveAwareness: "Defensive Awareness",
  tackling: "Tackling",
  aggression: "Aggression",
  defensiveEngagement: "Defensive Engagement",
  gkAwareness: "GK Awareness",
  gkCatching: "GK Catching",
  gkParrying: "GK Parrying",
  gkReflexes: "GK Reflexes",
  gkReach: "GK Reach",
  speed: "Speed",
  acceleration: "Acceleration",
  kickingPower: "Kicking Power",
  jumping: "Jumping",
  physicalContact: "Physical Contact",
  balance: "Balance",
  stamina: "Stamina",
};
const STAT_KEYS_LC = new Set(Object.keys(STAT_TOKENS).map((k) => k.toLowerCase()));
const STAT_JP = [
  "オフェンスセンス", "ボールコントロール", "ドリブル", "ボールキープ", "グラウンダーパス",
  "フライパス", "決定力", "ヘディング", "ヘッダー", "プレースキック", "カーブ",
  "ディフェンスセンス", "ボール奪取", "守備意識", "アグレッシブネス", "GKセンス",
  "キャッチング", "クリアリング", "コラプシング", "ディフレクティング",
  "スピード", "瞬発力", "キック力", "ジャンプ", "フィジカルコンタクト", "肉体的",
  "ボディバランス", "スタミナ",
];

const KEY_HINTS = [
  "skill", "playstyle", "playingstyle", "playing_style", "position", "aptitude",
  "boost", "booster", "level", "maxlevel", "max_level", "trainingpoint", "training_point",
  "progression", "weakfoot", "weak_foot", "form", "injury", "condition",
  "nationality", "league", "region", "team", "club", "cardtype", "card_type",
  "height", "weight", "age", "foot", "ovr", "rating", "overall",
];

// ---- 取得 ----
async function fetchPage(id) {
  if (requestCount >= MAX_REQUESTS) stop(`リクエスト上限(${MAX_REQUESTS})超過`, id);
  const wait = GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);

  const url = `https://${PAGE_HOST}/players/${id}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  requestCount++;
  lastAt = Date.now();
  console.log(`[detail] (${requestCount}/${MAX_REQUESTS}) GET ${url}`);

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
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

  const contentType = res.headers.get("content-type") ?? "(なし)";
  const text = await res.text();
  if (text.length > MAX_BYTES) stop(`レスポンスが 3MB を超えました: ${text.length} bytes`, url);

  const lc = text.toLowerCase();
  if (lc.includes("just a moment") || lc.includes("cf-chl") || lc.includes("challenge-platform")) {
    stop("Cloudflare チャレンジ / CAPTCHA の兆候", url);
  }
  if (/captcha/i.test(text)) stop("captcha 文字列を検出", url);
  if (/(name=["']?password["']?)/i.test(text) && /(sign ?in|log ?in|ログイン)/i.test(text)) {
    stop("ログインフォームの兆候", url);
  }

  return { id, url, status: res.status, contentType, text, bytes: text.length };
}

// ---- RSC フライト抽出（文字列処理のみ・eval しない） ----
function extractFlightChunks(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(m[1])); // JSON文字列のデコードのみ
    } catch {
      /* skip */
    }
  }
  return chunks;
}

function extractNextData(html) {
  const m = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function extractLdJson(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* skip */
    }
  }
  return out;
}

// フライトの各行 "Nx:VALUE" から VALUE を JSON.parse できたものだけ集める
function parseFlightRows(flightText) {
  const parsed = [];
  const rows = flightText.split("\n");
  for (const row of rows) {
    const mm = row.match(/^[0-9a-f]+:(?:[A-Za-z]+\d*)?(.*)$/s);
    if (!mm) continue;
    const body = mm[1];
    if (!body || (body[0] !== "{" && body[0] !== "[")) continue;
    try {
      parsed.push(JSON.parse(body));
    } catch {
      /* skip: 実行はしない */
    }
  }
  return parsed;
}

// ---- 木を歩いて注目ノードを収集 ----
function walk(root, visit) {
  let count = 0;
  const stack = [{ node: root, path: "$", depth: 0 }];
  while (stack.length) {
    const { node, path: p, depth } = stack.pop();
    if (count++ > 40000 || depth > 14) continue;
    if (node && typeof node === "object") {
      visit(node, p);
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length && i < 400; i++) {
          stack.push({ node: node[i], path: `${p}[${i}]`, depth: depth + 1 });
        }
      } else {
        for (const k of Object.keys(node)) {
          stack.push({ node: node[k], path: `${p}.${k}`, depth: depth + 1 });
        }
      }
    }
  }
}

function isStatGroup(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length < 6 || keys.length > 60) return false;
  let statHits = 0;
  let numericInRange = 0;
  for (const k of keys) {
    if (STAT_KEYS_LC.has(k.toLowerCase())) statHits++;
    const v = obj[k];
    if (typeof v === "number" && v >= 1 && v <= 120) numericInRange++;
  }
  return statHits >= 5 || (numericInRange >= 12 && numericInRange / keys.length > 0.6);
}

function trimSnippet(value) {
  let s;
  try {
    s = JSON.stringify(value);
  } catch {
    return "(直列化不可)";
  }
  if (s.length > SNIPPET_MAX) s = s.slice(0, SNIPPET_MAX) + " …(切り詰め)";
  if (snippetTotal + s.length > SNIPPET_TOTAL_MAX) return "(断片合計30KB上限のため省略)";
  snippetTotal += s.length;
  return s;
}

function analyseNodes(nodes) {
  const found = {
    statGroups: [], // {path, keyCount, statKeyHits, keys, snippet}
    skillNodes: [],
    positionNodes: [],
    boosterNodes: [],
    playstyleNodes: [],
    levelNodes: [],
    miscFieldNodes: [], // weakFoot / form / injury
    basicFieldObjects: [], // id+name+ovr らしきもの
    allKeysSeen: new Set(),
  };

  for (const root of nodes) {
    walk(root, (obj, p) => {
      if (Array.isArray(obj)) return;
      const keys = Object.keys(obj);
      for (const k of keys) found.allKeysSeen.add(k);

      if (isStatGroup(obj)) {
        const statKeyHits = keys.filter((k) => STAT_KEYS_LC.has(k.toLowerCase()));
        found.statGroups.push({
          path: p,
          keyCount: keys.length,
          statKeyHits: statKeyHits.length,
          keys: keys.slice(0, 60),
          snippet: trimSnippet(obj),
        });
      }

      const hasId = "id" in obj || "playerId" in obj || "i" in obj;
      const hasName = "name" in obj || "nameEn" in obj || "e" in obj || "englishName" in obj;
      const hasOvr = "ovr" in obj || "o" in obj || "overall" in obj || "rating" in obj;
      if (hasId && hasName && hasOvr) {
        found.basicFieldObjects.push({ path: p, keys: keys.slice(0, 60), snippet: trimSnippet(obj) });
      }

      for (const k of keys) {
        const lk = k.toLowerCase();
        const v = obj[k];
        if (/skill/.test(lk) && (Array.isArray(v) || typeof v === "object")) {
          found.skillNodes.push({ path: `${p}.${k}`, type: Array.isArray(v) ? "array" : "object", len: Array.isArray(v) ? v.length : undefined, snippet: trimSnippet(v) });
        }
        if (/(position|aptitude|playablepos)/.test(lk) && (Array.isArray(v) || typeof v === "object")) {
          found.positionNodes.push({ path: `${p}.${k}`, snippet: trimSnippet(v) });
        }
        if (/boost/.test(lk)) {
          found.boosterNodes.push({ path: `${p}.${k}`, snippet: trimSnippet(v) });
        }
        if (/(playstyle|playing_?style)/.test(lk)) {
          found.playstyleNodes.push({ path: `${p}.${k}`, snippet: trimSnippet(v) });
        }
        if (/(maxlevel|max_level|trainingpoint|training_point|progression|^level$)/.test(lk)) {
          found.levelNodes.push({ path: `${p}.${k}`, valuePreview: typeof v === "object" ? "(object/array)" : v });
        }
        if (/(weakfoot|weak_foot|^form$|injury)/.test(lk)) {
          found.miscFieldNodes.push({ path: `${p}.${k}`, valuePreview: typeof v === "object" ? trimSnippet(v) : v });
        }
      }
    });
  }
  return found;
}

// ---- API 形跡（記録のみ・アクセスしない） ----
function findApiHints(html) {
  const hints = new Set();
  for (const m of html.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) {
    const u = m[1];
    if (/(\/api\/|\.json|graphql|player|stat|tier)/i.test(u) && !/\.(png|jpe?g|webp|avif|svg|css|js|woff2?)($|\?)/i.test(u)) {
      hints.add(u);
    }
  }
  for (const m of html.matchAll(/["'`](\/(?:api|_next\/data)\/[^"'`\s]+)["'`]/g)) hints.add(m[1]);
  for (const m of html.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)) hints.add("fetch: " + m[1]);
  return [...hints].slice(0, 50);
}

function basicFieldReport(nodes) {
  // 単純フィールドを拾う
  const wanted = [
    "id", "playerId", "name", "nameEn", "nameJa", "japName", "englishName",
    "ovr", "overall", "rating", "cardType", "type", "team", "teamName", "club",
    "nationality", "country", "league", "region", "age", "height", "weight",
    "foot", "strongerFoot", "registeredPosition", "position",
  ];
  const out = {};
  for (const root of nodes) {
    walk(root, (obj) => {
      if (Array.isArray(obj)) return;
      for (const w of wanted) {
        if (w in obj && (typeof obj[w] !== "object" || obj[w] === null)) {
          const key = w;
          if (!(key in out)) out[key] = new Set();
          out[key].add(String(obj[w]).slice(0, 80));
        }
      }
    });
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].slice(0, 6)]));
}

// ---- メイン ----
async function main() {
  const ids = process.argv.slice(2);
  if (ids.length !== 2 || ids[0] !== ALLOWED_IDS[0] || ids[1] !== ALLOWED_IDS[1]) {
    stop("引数が許可された2 IDと一致しません", `期待: ${ALLOWED_IDS.join(" ")} / 受領: ${ids.join(" ")}`);
  }

  const pages = [];
  for (const id of ids) pages.push(await fetchPage(id));

  const perPlayer = [];
  for (const pg of pages) {
    const nextData = extractNextData(pg.text);
    const ldJson = extractLdJson(pg.text);
    const chunks = extractFlightChunks(pg.text);
    const flightText = chunks.join("");
    const flightRows = parseFlightRows(flightText);

    const nodes = [];
    if (nextData) nodes.push(nextData);
    for (const r of flightRows) nodes.push(r);
    for (const l of ldJson) nodes.push(l);

    const analysis = analyseNodes(nodes);
    const basics = basicFieldReport(nodes);
    const apiHints = findApiHints(pg.text);

    // 日本語能力値ラベルの出現
    const jpStatSeen = STAT_JP.filter((w) => pg.text.includes(w));

    perPlayer.push({
      id: pg.id,
      label: ID_LABEL[pg.id],
      url: pg.url,
      status: pg.status,
      contentType: pg.contentType,
      bytes: pg.bytes,
      hasNextData: !!nextData,
      flightChunkCount: chunks.length,
      flightTextLen: flightText.length,
      flightRowsParsed: flightRows.length,
      ldJsonCount: ldJson.length,
      nodeCount: nodes.length,
      jpStatSeen,
      analysis,
      basics,
      apiHints,
    });

    console.log(
      `[detail] ${pg.id} status=${pg.status} bytes=${pg.bytes} __NEXT_DATA__=${!!nextData} ` +
        `flightChunks=${chunks.length} flightRowsParsed=${flightRows.length} ` +
        `statGroups=${analysis.statGroups.length} skillNodes=${analysis.skillNodes.length} ` +
        `positionNodes=${analysis.positionNodes.length} boosterNodes=${analysis.boosterNodes.length}`,
    );
  }

  // RSC が全く解析できない場合は停止
  const anythingUseful = perPlayer.some(
    (p) =>
      p.analysis.statGroups.length > 0 ||
      p.analysis.basicFieldObjects.length > 0 ||
      Object.keys(p.basics).length >= 3,
  );
  if (!anythingUseful) {
    stop(
      "RSC/HTML から選手データを安全に抽出できませんでした（statGroup も基本フィールドも検出できず）",
      perPlayer.map((p) => `${p.id}: flightChunks=${p.flightChunkCount} rows=${p.flightRowsParsed} bytes=${p.bytes}`).join("\n"),
    );
  }

  const md = buildMarkdown(perPlayer);
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, md, "utf8");
  console.log(`\n[detail] 作成: ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`[detail] 実行リクエスト数: ${requestCount}/${MAX_REQUESTS} / 断片合計: ${snippetTotal} bytes`);
}

function classifyLine(name, field, type, mv, cv, meaning, state, dbName, convert, nullable, source) {
  return `| ${name} | ${field} | ${type} | ${mv} | ${cv} | ${meaning} | ${state} | ${dbName} | ${convert} | ${nullable} | ${source} |`;
}

function buildMarkdown(perPlayer) {
  const [A, B2] = perPlayer;
  const L = [];
  L.push("# eFHUB 個別選手ページ データ構造 調査結果");
  L.push("");
  L.push(`実行日時: ${new Date().toISOString()}`);
  L.push("調査対象: Lionel Messi (89138556575063) / Fabio Cannavaro (88041460996837)");
  L.push("外部アクセス: efhub.com の個別ページ GET ×2（合計2回）。他ホスト・他URLへのアクセスなし。");
  L.push("解析方針: 受信テキストの文字列解析のみ。eval・コード実行なし。JSON.parse 可能な候補のみ採用。");
  L.push("");

  L.push("## 1. ページ概要");
  L.push("");
  L.push("| 選手 | URL | HTTP | Content-Type | サイズ | __NEXT_DATA__ | RSCチャンク数 | 解析できたRSC行 | ld+json |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const p of perPlayer) {
    L.push(
      `| ${p.label} | ${p.url} | ${p.status} | ${p.contentType} | ${p.bytes} B | ${p.hasNextData} | ${p.flightChunkCount} | ${p.flightRowsParsed} | ${p.ldJsonCount} |`,
    );
  }
  L.push("");
  L.push("- リダイレクト / ログイン要求 / Cookie 要求 / CAPTCHA: なし");
  L.push(`- レスポンス形式: HTML + Next.js App Router の RSC ペイロード（self.__next_f.push）。`);
  for (const p of perPlayer) {
    L.push(`- ${p.label}: 日本語能力値ラベルの出現 = ${p.jpStatSeen.length ? p.jpStatSeen.join(" / ") : "なし"}`);
  }
  L.push("");

  L.push("## 2. 発見した基本情報フィールド（単純値）");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    const entries = Object.entries(p.basics);
    if (entries.length === 0) L.push("- （検出なし）");
    for (const [k, vals] of entries) L.push(`- \`${k}\`: ${vals.join(" | ")}`);
    L.push("");
  }

  L.push("## 3. 能力値グループ（statGroup 候補）");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label} — ${p.analysis.statGroups.length} 群`);
    for (const g of p.analysis.statGroups.slice(0, 6)) {
      L.push(`- path: \`${g.path}\` / キー数 ${g.keyCount} / 能力名キー一致 ${g.statKeyHits}`);
      L.push(`  - keys: ${g.keys.join(", ")}`);
      L.push(`  - 断片: \`${g.snippet}\``);
    }
    L.push("");
  }
  L.push("> 群が複数ある場合、基礎値 / Max Level 値 / 育成後値 / ブースター適用後値 のいずれかは");
  L.push("> キー名から判別できたときのみ後述の分類表に反映。判別できないものは「C 未確認」。");
  L.push("");

  L.push("## 4. 選手スキル候補");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.analysis.skillNodes.length === 0) L.push("- （検出なし）");
    for (const s of p.analysis.skillNodes.slice(0, 6)) {
      L.push(`- \`${s.path}\` (${s.type}${s.len != null ? `, len ${s.len}` : ""})`);
      L.push(`  - 断片: \`${s.snippet}\``);
    }
    L.push("");
  }

  L.push("## 5. プレースタイル候補");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.analysis.playstyleNodes.length === 0) L.push("- （検出なし）");
    for (const s of p.analysis.playstyleNodes.slice(0, 6)) L.push(`- \`${s.path}\` — 断片: \`${s.snippet}\``);
    L.push("");
  }

  L.push("## 6. ポジション適性 / ポジション別総合値 候補");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.analysis.positionNodes.length === 0) L.push("- （検出なし）");
    for (const s of p.analysis.positionNodes.slice(0, 6)) L.push(`- \`${s.path}\` — 断片: \`${s.snippet}\``);
    L.push("");
  }

  L.push("## 7. 育成 / レベル情報 候補");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.analysis.levelNodes.length === 0) L.push("- （検出なし）");
    for (const s of p.analysis.levelNodes.slice(0, 12)) L.push(`- \`${s.path}\` = ${JSON.stringify(s.valuePreview).slice(0, 200)}`);
    L.push("");
  }

  L.push("## 8. ブースター情報 候補");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.analysis.boosterNodes.length === 0) L.push("- （検出なし）");
    for (const s of p.analysis.boosterNodes.slice(0, 8)) L.push(`- \`${s.path}\` — 断片: \`${s.snippet}\``);
    L.push("");
  }

  L.push("## 9. Weak Foot / Form / Injury Resistance 候補");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.analysis.miscFieldNodes.length === 0) L.push("- （検出なし）");
    for (const s of p.analysis.miscFieldNodes.slice(0, 10)) L.push(`- \`${s.path}\` = ${JSON.stringify(s.valuePreview).slice(0, 200)}`);
    L.push("");
  }

  L.push("## 10. 画像情報");
  L.push("");
  L.push("- 選手カード画像 / ミニカード画像は前調査（docs/player-image-findings.md）で確認済み:");
  L.push("  `https://efimg.com/efootballhub22/images/player_cards/{playerId}_l.png` / `.../mini-cards/mini-cards/{playerId}_l.png`");
  L.push("- 本調査では画像へアクセスしていない。");
  L.push("");

  L.push("## 11. 通常 JSON API の形跡（記録のみ・未アクセス）");
  L.push("");
  for (const p of perPlayer) {
    L.push(`### ${p.label}`);
    if (p.apiHints.length === 0) L.push("- （該当なし）");
    for (const h of p.apiHints) L.push(`- ${h}`);
    L.push("");
  }
  L.push("> これらのURLへは一切アクセスしていない。追加調査には別途承認が必要。");
  L.push("");

  L.push("## 12. RSC 解析の必要性");
  L.push("");
  const statFound = perPlayer.some((p) => p.analysis.statGroups.length > 0);
  L.push(`- 個別選手データは Next.js の RSC ペイロード（self.__next_f.push）内に直列化されている。`);
  L.push(`- 能力値グループの検出: ${statFound ? "あり（RSC 解析で能力値らしき数値群を取得できる）" : "なし（この2ページからは能力値群を抽出できなかった）"}`);
  L.push("- 通常の JSON API（安定した公開エンドポイント）が別に存在するかは「11.」の候補URLを追加調査するまで未確定。");
  L.push("- 実装方針の推奨:");
  L.push("  1. まず「11.」の候補URL（JSON API らしきもの）を1件だけ調査し、安定 API があればそれを使う。");
  L.push("  2. API が無ければ RSC パーサを作り、parser_version を管理し、構造変化を検知したら停止する運用にする。");
  L.push("");

  L.push("## 13. フィールド分類表（A 確認済み / B 有力な推測 / C 未確認 / D 取得不可）");
  L.push("");
  L.push("| 表示名 | 元フィールド名 | 型 | Messiの値 | Cannavaroの値 | 意味 | 確認状態 | 推奨DB名 | 変換要否 | null可能性 | 取得元 |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  // 自動で埋められる基本フィールド
  const b1 = A.basics, b2 = B2.basics;
  const cell = (o, keys) => {
    for (const k of keys) if (o[k]) return o[k].join(" / ");
    return "—";
  };
  L.push(classifyLine("選手ID", "id / playerId", "string|number", cell(b1, ["id", "playerId"]), cell(b2, ["id", "playerId"]), "カード固有ID（player-index.json の i と同じ想定）", "B", "efhub_card_id", "文字列化", "低", "RSC"));
  L.push(classifyLine("英語名", "name / nameEn / englishName", "string", cell(b1, ["nameEn", "name", "englishName"]), cell(b2, ["nameEn", "name", "englishName"]), "英語表記名", "B", "name_en", "不要", "低", "RSC"));
  L.push(classifyLine("日本語名", "nameJa / japName", "string", cell(b1, ["nameJa", "japName"]), cell(b2, ["nameJa", "japName"]), "日本語表記名", "B", "name_ja", "不要", "低", "RSC"));
  L.push(classifyLine("OVR", "ovr / overall / rating", "number", cell(b1, ["ovr", "overall", "rating"]), cell(b2, ["ovr", "overall", "rating"]), "総合値（基礎かMaxかは要確認）", "C", "ovr_base / ovr_max", "要区別", "低", "RSC"));
  L.push(classifyLine("カードタイプ", "cardType / type", "string|number", cell(b1, ["cardType", "type"]), cell(b2, ["cardType", "type"]), "カード種別（Epic/Legend/POTW等）", "C", "card_type", "要マッピング", "中", "RSC"));
  L.push(classifyLine("所属チーム", "team / teamName / club", "string|object", cell(b1, ["team", "teamName", "club"]), cell(b2, ["team", "teamName", "club"]), "所属クラブ", "C", "team_id / team_name", "要正規化", "中", "RSC"));
  L.push(classifyLine("国籍", "nationality / country", "string|object", cell(b1, ["nationality", "country"]), cell(b2, ["nationality", "country"]), "国籍", "C", "nationality", "要正規化", "中", "RSC"));
  L.push(classifyLine("リーグ", "league", "string|object", cell(b1, ["league"]), cell(b2, ["league"]), "リーグ", "C", "league", "要正規化", "中", "RSC"));
  L.push(classifyLine("地域", "region", "string", cell(b1, ["region"]), cell(b2, ["region"]), "地域分類", "C", "region", "要マッピング", "中", "RSC"));
  L.push(classifyLine("年齢", "age", "number", cell(b1, ["age"]), cell(b2, ["age"]), "年齢", "C", "age", "不要", "中", "RSC"));
  L.push(classifyLine("身長", "height", "number", cell(b1, ["height"]), cell(b2, ["height"]), "身長cm", "C", "height_cm", "不要", "中", "RSC"));
  L.push(classifyLine("体重", "weight", "number", cell(b1, ["weight"]), cell(b2, ["weight"]), "体重kg", "C", "weight_kg", "不要", "中", "RSC"));
  L.push(classifyLine("利き足", "foot / strongerFoot", "string|number", cell(b1, ["foot", "strongerFoot"]), cell(b2, ["foot", "strongerFoot"]), "利き足", "C", "stronger_foot", "要マッピング", "中", "RSC"));
  L.push(classifyLine("登録ポジション", "registeredPosition / position", "string|number", cell(b1, ["registeredPosition", "position"]), cell(b2, ["registeredPosition", "position"]), "登録ポジション", "C", "registered_position", "要マッピング", "中", "RSC"));
  L.push(classifyLine("能力値(群)", "(下記 3. の statGroup)", "object", statFound ? "検出" : "未検出", statFound ? "検出" : "未検出", "26能力値。基礎/Max/育成後の別は要確認", "C", "player_card_stats", "要区別", "—", "RSC"));
  L.push(classifyLine("選手スキル", "skills / playerSkills", "array", A.analysis.skillNodes.length ? "検出" : "未検出", B2.analysis.skillNodes.length ? "検出" : "未検出", "保有スキル一覧", "C", "player_card_skills", "要マッピング", "中", "RSC"));
  L.push(classifyLine("プレースタイル", "playingStyle / playstyle", "string|number", A.analysis.playstyleNodes.length ? "検出" : "未検出", B2.analysis.playstyleNodes.length ? "検出" : "未検出", "攻撃/守備のプレースタイル", "C", "playstyle", "要マッピング", "中", "RSC"));
  L.push(classifyLine("ポジション適性", "positions / positionRatings", "object|array", A.analysis.positionNodes.length ? "検出" : "未検出", B2.analysis.positionNodes.length ? "検出" : "未検出", "各ポジションの適性/総合値", "C", "player_card_position_ratings", "要区別(数値/文字)", "中", "RSC"));
  L.push(classifyLine("最大レベル/育成P", "maxLevel / trainingPoints", "number", A.analysis.levelNodes.length ? "検出" : "未検出", B2.analysis.levelNodes.length ? "検出" : "未検出", "育成上限・ポイント総量", "C", "max_level / training_points", "不要", "中", "RSC"));
  L.push(classifyLine("ブースター", "boost / booster", "object|array", A.analysis.boosterNodes.length ? "検出" : "未検出", B2.analysis.boosterNodes.length ? "検出" : "未検出", "カード付きブースター", "C", "player_card_boosters", "要マッピング", "高", "RSC"));
  L.push(classifyLine("Weak Foot", "weakFoot*", "number", A.analysis.miscFieldNodes.length ? "検出?" : "未検出", B2.analysis.miscFieldNodes.length ? "検出?" : "未検出", "逆足の頻度/精度", "C", "weak_foot_usage / weak_foot_acc", "不要", "中", "RSC"));
  L.push(classifyLine("Form", "form", "number", "—", "—", "コンディション安定度", "C", "form", "不要", "中", "RSC"));
  L.push(classifyLine("Injury Resistance", "injuryResistance", "number", "—", "—", "怪我耐性", "C", "injury_resistance", "不要", "中", "RSC"));
  L.push("");
  L.push("> 実際の値・キー名は「2.〜9.」の検出結果と断片で確認すること。短縮キー・数値コードは証拠が揃うまで A に上げない。");
  L.push("");

  L.push("## 14. 確認済み事項（A）");
  L.push("- 両ページとも HTTP 200 / HTML + RSC 形式 / 認証・CAPTCHA・リダイレクトなし。");
  L.push("- 個別選手データは初期レスポンスの RSC ペイロードに含まれる（クライアント専用フェッチではない部分がある）。");
  L.push(`- 日本語能力値ラベルのページ内出現: Messi ${A.jpStatSeen.length} 種 / Cannavaro ${B2.jpStatSeen.length} 種。`);
  L.push("");
  L.push("## 15. 有力な推測（B）");
  L.push("- 選手ID＝カード固有ID（player-index.json の i と同一体系）。");
  L.push("- 英語名/日本語名は基本情報として RSC に存在。");
  L.push("");
  L.push("## 16. 未確認事項（C）");
  L.push("- 能力値が「基礎値 / Max Level / 育成後 / ブースター適用後」のどれか（複数群の意味）。");
  L.push("- OVR が基礎かMaxか、ポジション別総合値の計算規則。");
  L.push("- カードタイプ・チーム・国籍・リーグ・地域の数値コード対応。");
  L.push("- スキル/プレースタイル/ポジション適性のコード体系（数値↔名称）。");
  L.push("- 育成ポイントの消費規則、能力値グループ定義。");
  L.push("- ブースター適用前後の値が両方含まれるか。");
  L.push("- Weak Foot / Form / Injury Resistance の正確なキー名と値域。");
  L.push("");
  L.push("## 17. 取得できなかった項目（D）");
  L.push("- （実行結果を見て、2ページのレスポンスに存在しなかったフィールドをここに列挙）");
  L.push("");

  L.push("## 18. 推奨する自前DB構造（案）");
  L.push("");
  L.push("```");
  L.push("player_cards        : internal_card_id(PK), efhub_card_id, name_en, name_ja, ovr_base, ovr_max,");
  L.push("                      card_type, team_id, nationality, league, region, age, height_cm, weight_kg,");
  L.push("                      stronger_foot, registered_position, weak_foot_usage, weak_foot_acc, form,");
  L.push("                      injury_resistance, max_level, training_points, source, fetched_at");
  L.push("player_card_stats   : internal_card_id(FK), stat_kind('base'|'max'|'trained'|'boosted'), stat_key, value");
  L.push("stat_definitions    : stat_key(PK), name_en, name_ja, group('offense'|'defense'|'physical'|'gk'), display_order");
  L.push("player_card_skills  : internal_card_id(FK), skill_key, is_additional, display_order");
  L.push("skills              : skill_key(PK), name_en, name_ja");
  L.push("player_card_playstyles: internal_card_id(FK), playstyle_key, kind('attack'|'defense')");
  L.push("playstyles          : playstyle_key(PK), name_en, name_ja, code");
  L.push("player_card_position_ratings: internal_card_id(FK), position_code, rating_value, rating_kind('registered'|'high'|'partial'|'none'|'trained')");
  L.push("player_card_boosters : internal_card_id(FK), booster_id, magnitude, applied('before'|'after')");
  L.push("boosters            : booster_id(PK), name_en, name_ja, effect_json");
  L.push("progression_rules   : rule_version, group_key, points_cost, delta_json   -- API/式が判明したら");
  L.push("```");
  L.push("- `stat_kind` を必ず持たせ、基礎/Max/育成後/ブースター後を混在させない。");
  L.push("- eFHUB 独自の計算結果（ポジション別OVR等）は `computed_*` として別管理し、元データと区別する。");
  L.push("");

  L.push("## 19. 次の追加調査");
  L.push("- 「11.」の JSON API 候補URLのうち最も有望な1件だけを（別承認で）調査。");
  L.push("- 同一選手の別カード（Messi 106/105 等）で能力値群を比較し、stat_kind を確定。");
  L.push("- eFHUB 画面（DevTools）で「基礎値表示」と「Max表示」を切り替えた時の数値と RSC の群を突き合わせ。");
  L.push("- eFHUB / efimg.com の robots.txt・利用規約。");
  L.push("");
  L.push("## 20. 実装前に確認すべきこと");
  L.push("- 能力値の stat_kind を根拠付きで確定できているか。");
  L.push("- RSC 依存か JSON API 利用かの方針決定。");
  L.push("- スキル/プレースタイル/ポジションのコード表を用意できているか。");
  L.push("- カード固有ID と player-index.json の i の同一性を複数カードで確認したか。");
  L.push("");

  return L.join("\n") + "\n";
}

main().catch((err) => stop("想定外のエラー", err?.stack ?? String(err)));
