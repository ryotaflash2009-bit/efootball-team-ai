/**
 * eFootball World が全選手詳細データの取得元として使えるかを最小限の外部アクセスで調査する。
 *
 *   node scripts/investigate-efootball-world.mjs
 *
 * 制約（このプロンプトの承認範囲）:
 *  - 外部リクエストは合計最大5回。robots.txt は既に取得済み（手動）なので、本スクリプトは最大4回。
 *  - GET / POST のみ。再試行なし。redirect: "manual"（3xx で停止）。各20秒。同時1。間隔3秒以上。
 *  - Cookie / Authorization / APIキー / 保存済みセッションを使わない。UA を偽装しない。CAPTCHA を回避しない。
 *  - ホストは efootball-world.com のみ。他ホストへ移動する必要が出たら停止。
 *  - eFHUB へはアクセスしない。SQLite のデータや個人情報を Payload に含めない。
 *  - 未確認 API の総当たり・URL 推測をしない。ページサイズ probe をしない。
 *  - 全件取得は開始しない。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "efootball-world-data-investigation.md");

const HOST = "efootball-world.com";
const UA = "eFootball-Team-AI-dev/0.1 (data-source feasibility check; single-threaded; contact: project owner)";
const MAX_REQUESTS = 4; // robots.txt は別途取得済み（全体で5回中1回）
const GAP_MS = 3000;
const TIMEOUT_MS = 20_000;

const SEARCH_URL = `https://${HOST}/api/proxy/v1/api/players/search`;
const HOME_URL = `https://${HOST}/`;

// robots.txt（手動取得済みの内容を記録）
const ROBOTS = {
  url: `https://${HOST}/robots.txt`,
  status: 200,
  body: "User-Agent: *\nAllow: /\nDisallow: /my/\nDisallow: /auth/\n\nSitemap: https://efootball-world.com/sitemap.xml",
  verdict:
    "全UAに Allow: /。Disallow は /my/（個人ページ）と /auth/ のみ。Crawl-delay 指定なし。" +
    "ClaudeBot 等の AI クローラー制限や Content-Signal なし。→ /api/ と /player/ への自動アクセスは robots.txt 上は許可。",
};

let reqCount = 0;
let lastAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stop(reason, detail) {
  console.error("\n[world] 停止:", reason);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 800));
  writeReport({ stopped: true, stopReason: reason, stopDetail: detail }).finally(() => process.exit(1));
}

function assertHost(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    stop("URL が不正", url);
  }
  if (u.protocol !== "https:") stop("HTTPS ではない", url);
  if (u.host !== HOST) stop(`ホストが ${HOST} ではない`, url);
}

async function req(url, opts, label) {
  assertHost(url);
  if (reqCount >= MAX_REQUESTS) stop(`リクエスト上限 ${MAX_REQUESTS} を超える操作が必要`, `${label}: ${url}`);
  const wait = GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  reqCount++;
  lastAt = Date.now();
  console.log(`[world] (${reqCount}/${MAX_REQUESTS}) ${opts?.method ?? "GET"} ${url}  [${label}]`);
  let res;
  try {
    res = await fetch(url, {
      ...opts,
      redirect: "manual",
      signal: c.signal,
      headers: { "User-Agent": UA, ...(opts?.headers ?? {}) },
    });
  } catch (err) {
    stop(`${label} のリクエスト失敗（ネットワーク/タイムアウト）`, err?.message ?? String(err));
  } finally {
    clearTimeout(t);
  }
  if (res.status >= 300 && res.status < 400) {
    stop(`${label}: リダイレクト(${res.status})（追跡しない）`, `Location: ${res.headers.get("location") ?? "(なし)"}`);
  }
  if (res.status === 401 || res.status === 403) stop(`${label}: HTTP ${res.status}（認証/拒否）`);
  if (res.status === 429) stop(`${label}: HTTP 429（レート制限）`, `Retry-After: ${res.headers.get("retry-after") ?? "(なし)"}`);
  return res;
}

const RL_HEADERS = ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "ratelimit-limit", "ratelimit-remaining", "x-rate-limit-limit"];
function rateLimitHeaders(res) {
  const o = {};
  for (const k of RL_HEADERS) {
    const v = res.headers.get(k);
    if (v != null) o[k] = v;
  }
  return o;
}

function looksSensitive(text) {
  const t = text.toLowerCase();
  const hits = [];
  if (/"(access_?token|refresh_?token|id_?token|session_?token|jwt)"\s*:/.test(t)) hits.push("token field");
  if (/"(password|passwd|secret|api_?key|private_?key)"\s*:/.test(t)) hits.push("credential field");
  if (/"(email|phone_?number|address_?line|credit_?card|card_?number|cvv)"\s*:/.test(t)) hits.push("PII field");
  if (/set-cookie/i.test(t)) hits.push("set-cookie");
  return hits;
}

function fieldTypes(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    o[k] = v === null ? "null" : Array.isArray(v) ? `array[${v.length}]` : typeof v === "object" ? `object{${Object.keys(v).slice(0, 8).join(",")}}` : `${typeof v}=${JSON.stringify(v).slice(0, 60)}`;
  }
  return o;
}

function extractLinks(html, kinds) {
  const out = {};
  for (const kind of kinds) out[kind] = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = m[1];
    const low = href.toLowerCase();
    for (const kind of kinds) {
      if (low.includes(kind)) out[kind].add(href);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, s]) => [k, [...s].slice(0, 10)]));
}

function extractApiRefs(text) {
  const set = new Set();
  for (const m of text.matchAll(/["'`](\/api\/[^"'`\s]+)["'`]/g)) set.add(m[1]);
  for (const m of text.matchAll(/["'`](https?:\/\/[^"'`\s]*\/api\/[^"'`\s]*)["'`]/g)) set.add(m[1]);
  for (const m of text.matchAll(/\/player\/[A-Za-z0-9_-]+/g)) set.add(m[0]);
  return [...set].slice(0, 40);
}

const findings = {};

async function main() {
  // --- 2/5: players/search 1ページ目 ---
  {
    const payload = { page: 1, size: 24, sortBy: "CREATED_AT", sortOrder: "DESC" };
    const res = await req(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    }, "players/search page 1");
    const ct = res.headers.get("content-type") ?? "";
    const rl = rateLimitHeaders(res);
    const raw = await res.text();
    const sensitive = looksSensitive(raw + "\n" + [...res.headers.keys()].join(","));
    if (sensitive.length) {
      stop("players/search レスポンスに個人情報/認証情報の兆候", sensitive.join(", "));
    }
    if (raw.length > 5_000_000) stop("players/search レスポンスが想定より著しく大きい", `${raw.length} bytes`);

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      stop("players/search レスポンスを JSON 解析できない", err?.message ?? String(err));
    }

    // ページング系キーの探索（レスポンスのどの階層にあるか不明なので浅く走査）
    const topKeys = Object.keys(json ?? {});
    const container =
      Array.isArray(json?.players) ? json :
      json?.data && Array.isArray(json.data.players) ? json.data :
      json?.result && Array.isArray(json.result.players) ? json.result :
      json?.data && Array.isArray(json.data) ? { players: json.data } :
      json;
    const players = Array.isArray(container?.players) ? container.players : Array.isArray(container) ? container : [];

    findings.search = {
      httpStatus: res.status,
      contentType: ct,
      bytes: raw.length,
      rateLimitHeaders: rl,
      topLevelKeys: topKeys,
      pagingKeys: {
        totalCount: container?.totalCount ?? container?.total ?? json?.totalCount ?? null,
        totalPages: container?.totalPages ?? json?.totalPages ?? null,
        currentPage: container?.currentPage ?? container?.page ?? json?.currentPage ?? null,
        pageSize: container?.pageSize ?? container?.size ?? json?.pageSize ?? null,
        hasNext: container?.hasNext ?? container?.hasMore ?? json?.hasNext ?? null,
        cursorLike: [container?.cursor, container?.nextCursor, container?.next].filter((v) => v != null),
      },
      playersCount: players.length,
      playerFieldTypes: players[0] ? fieldTypes(players[0]) : null,
      sample3: players.slice(0, 3),
      apiRefs: extractApiRefs(raw),
    };
    console.log(`[world] search: status=${res.status} players=${players.length} totalCount=${JSON.stringify(findings.search.pagingKeys.totalCount)} totalPages=${JSON.stringify(findings.search.pagingKeys.totalPages)}`);
  }

  // --- 3/5: ホームページ HTML（利用条件リンク / API 参照 / 個別ページリンク） ---
  let tosCandidates = [];
  {
    const res = await req(HOME_URL, { headers: { Accept: "text/html,*/*" } }, "homepage");
    const raw = await res.text();
    const sensitive = looksSensitive(raw);
    findings.home = {
      httpStatus: res.status,
      contentType: res.headers.get("content-type"),
      bytes: raw.length,
      hasNextData: /__NEXT_DATA__|self\.__next_f\.push/.test(raw),
      links: extractLinks(raw, ["terms", "tos", "legal", "privacy", "guideline", "利用規約", "player/"]),
      apiRefs: extractApiRefs(raw),
      sensitive,
    };
    const linkGroups = findings.home.links;
    tosCandidates = [
      ...(linkGroups.terms || []), ...(linkGroups.tos || []), ...(linkGroups.legal || []),
      ...(linkGroups["利用規約"] || []), ...(linkGroups.guideline || []),
    ]
      .map((h) => {
        try {
          return new URL(h, HOME_URL).href;
        } catch {
          return null;
        }
      })
      .filter((u) => u && new URL(u).host === HOST);
    console.log(`[world] homepage: status=${res.status} tos候補=${tosCandidates.length} playerリンク=${(linkGroups["player/"] || []).length}`);
  }

  // --- 4/5: 利用条件ページ（ホームで見つかった場合のみ） ---
  if (tosCandidates.length > 0) {
    const url = tosCandidates[0];
    const res = await req(url, { headers: { Accept: "text/html,*/*" } }, "terms/legal page");
    const raw = await res.text();
    const low = raw.toLowerCase();
    const flags = {
      mentionsScraping: /(scrap|crawl|spider|bot|automated|自動取得|クロール|スクレイピング|ロボット)/i.test(raw),
      prohibitsAutomated: /(prohibit|not permitted|禁止|してはならない|認められません)[^。.]{0,120}(scrap|crawl|automated|自動|bot|収集)/i.test(raw),
      mentionsApi: /\bapi\b/i.test(raw),
      mentionsDataUse: /(data|データ|コンテンツ)[^。.]{0,80}(use|利用|再配布|redistribut)/i.test(low),
    };
    findings.tos = { url, httpStatus: res.status, bytes: raw.length, flags, excerptLen: raw.length };
    console.log(`[world] terms: status=${res.status} scraping言及=${flags.mentionsScraping} 自動禁止らしき=${flags.prohibitsAutomated}`);
  } else {
    findings.tos = { url: null, note: "ホームページの公開リンクから利用条件ページを特定できず。URL 推測はしない。→ 未確認。" };
    // 余ったリクエストを別用途へ回さない（プロンプト指示）
  }

  // --- 5/5: 個別選手ページ（players/search で直接確認できた1件のみ・Messi/Cannavaro は未実施） ---
  const p0 = findings.search?.sample3?.[0];
  const worldId = p0 ? (p0.id ?? p0.playerId ?? p0.playerCode ?? null) : null;
  if (worldId != null && reqCount < MAX_REQUESTS) {
    const url = `https://${HOST}/player/${encodeURIComponent(String(worldId))}`;
    const res = await req(url, { headers: { Accept: "text/html,*/*" } }, `individual player ${worldId}`);
    const raw = await res.text();
    const sensitive = looksSensitive(raw);
    if (sensitive.length) {
      findings.individual = { url, httpStatus: res.status, note: "個人情報の兆候を検知したため内容を保存せず", sensitive };
    } else {
      // RSC / __NEXT_DATA__ から選手データらしき JSON を軽く探す
      const nextData = (raw.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i) || [])[1] ?? null;
      const abilityHits = [
        "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
        "finishing", "heading", "speed", "acceleration", "kickingPower", "physicalContact", "stamina",
        "defensiveAwareness", "gkAwareness", "playingStyle", "playstyle", "skills", "positionRatings",
        "maxLevel", "levelCap", "boostId", "booster", "weakFoot", "form", "injuryResistance",
        "overallRating", "baseStats", "trainingLevel", "progression",
      ].filter((k) => new RegExp(`["']${k}["']`).test(raw));
      findings.individual = {
        url,
        httpStatus: res.status,
        contentType: res.headers.get("content-type"),
        bytes: raw.length,
        hasNextData: !!nextData,
        hasRsc: /self\.__next_f\.push/.test(raw),
        abilityKeyHits: abilityHits,
        apiRefs: extractApiRefs(raw),
      };
    }
    console.log(`[world] individual: status=${res.status} abilityKeys=${JSON.stringify(findings.individual.abilityKeyHits ?? [])}`);
  } else {
    findings.individual = { url: null, note: worldId == null ? "players/search から個別ページ用IDを安全に特定できず → 未実施" : "リクエスト上限に到達 → 未実施" };
  }

  await writeReport({ stopped: false });
  console.log(`\n[world] 調査完了。外部リクエスト（本スクリプト）: ${reqCount}/${MAX_REQUESTS}（robots.txt 手動分を含め合計 ${reqCount + 1}/5）`);
  console.log(`[world] レポート: ${path.relative(ROOT, REPORT)}`);
}

async function writeReport(meta) {
  const L = [];
  L.push("# eFootball World データソース調査（最小調査）");
  L.push("");
  L.push(`実行日時: ${new Date().toISOString()}`);
  L.push(`外部リクエスト: robots.txt 1回（手動）+ 本スクリプト ${reqCount}回 = 合計 ${reqCount + 1}/5`);
  L.push(`対象ホスト: ${HOST} のみ / Cookie・Authorization・APIキー不使用 / UA 偽装なし / リダイレクト非追跡`);
  if (meta.stopped) {
    L.push("");
    L.push(`## 停止: ${meta.stopReason}`);
    if (meta.stopDetail !== undefined) L.push("```\n" + (typeof meta.stopDetail === "string" ? meta.stopDetail : JSON.stringify(meta.stopDetail, null, 2)).slice(0, 1000) + "\n```");
  }
  L.push("");
  L.push("## 1. robots.txt");
  L.push("```");
  L.push(ROBOTS.body);
  L.push("```");
  L.push(`判定: ${ROBOTS.verdict}`);
  L.push("");

  L.push("## 2. players/search API（1ページ目）");
  if (findings.search) {
    const s = findings.search;
    L.push(`- POST ${SEARCH_URL}`);
    L.push(`- HTTP ${s.httpStatus} / Content-Type ${s.contentType} / ${s.bytes} bytes`);
    L.push(`- レート制限ヘッダー: ${Object.keys(s.rateLimitHeaders).length ? JSON.stringify(s.rateLimitHeaders) : "（なし）"}`);
    L.push(`- トップレベルキー: ${s.topLevelKeys.join(", ")}`);
    L.push(`- ページング: ${JSON.stringify(s.pagingKeys)}`);
    L.push(`- players 件数: ${s.playersCount}`);
    L.push("- players[0] フィールド:");
    L.push("```json");
    L.push(JSON.stringify(s.playerFieldTypes, null, 2));
    L.push("```");
    L.push("- 先頭3件:");
    L.push("```json");
    for (const p of s.sample3) L.push(JSON.stringify(p));
    L.push("```");
    if (s.apiRefs.length) {
      L.push("- レスポンス内の API 参照候補（未アクセス）:");
      for (const r of s.apiRefs) L.push(`  - ${r}`);
    }
  } else {
    L.push("- 未取得");
  }
  L.push("");

  L.push("## 3. ホームページ HTML");
  if (findings.home) {
    const h = findings.home;
    L.push(`- HTTP ${h.httpStatus} / ${h.bytes} bytes / Next.js data: ${h.hasNextData}`);
    L.push(`- 利用規約系リンク: ${JSON.stringify(h.links)}`);
    if (h.apiRefs?.length) {
      L.push("- API / 個別ページ参照候補（未アクセス）:");
      for (const r of h.apiRefs) L.push(`  - ${r}`);
    }
  } else {
    L.push("- 未取得");
  }
  L.push("");

  L.push("## 4. 利用条件ページ");
  if (findings.tos?.url) {
    L.push(`- ${findings.tos.url}（HTTP ${findings.tos.httpStatus} / ${findings.tos.bytes} bytes）`);
    L.push(`- 兆候: ${JSON.stringify(findings.tos.flags)}`);
    L.push("- ※ 全文は保存せず、自動取得の可否に関わる語の有無のみ記録。");
  } else {
    L.push(`- ${findings.tos?.note ?? "未確認"}`);
  }
  L.push("");

  L.push("## 5. 個別選手ページ（players/search で直接確認できた1件）");
  if (findings.individual?.url) {
    const i = findings.individual;
    L.push(`- ${i.url}（HTTP ${i.httpStatus} / ${i.bytes ?? "-"} bytes）`);
    if (i.note) L.push(`- ${i.note}`);
    if (i.abilityKeyHits) L.push(`- 能力値/詳細キーの出現: ${i.abilityKeyHits.length ? i.abilityKeyHits.join(", ") : "なし"}`);
    if (i.hasNextData != null) L.push(`- __NEXT_DATA__: ${i.hasNextData} / RSC: ${i.hasRsc}`);
    if (i.apiRefs?.length) {
      L.push("- 個別ページ内の API 参照候補（未アクセス）:");
      for (const r of i.apiRefs) L.push(`  - ${r}`);
    }
  } else {
    L.push(`- ${findings.individual?.note ?? "未実施"}`);
  }
  L.push("");
  L.push("> Messi / Cannavaro の照合は本調査では **未実施**（players/search 1ページ目は CREATED_AT DESC のため両者が含まれず、");
  L.push("> 追加の名前検索は 5 リクエスト制約により送っていない）。次回の最小調査で対応。");
  L.push("");

  L.push("## 次に必要な最小調査（案）");
  L.push("- players/search で `size` の上限を確認（1リクエスト。レスポンス or 公開コードから判断できれば不要）。");
  L.push("- Messi / Cannavaro を名前検索（各1リクエスト）→ eFHUB 保存済みデータと照合。");
  L.push("- 個別詳細 API の正確な形式を1〜2件で確認（能力値・スキル・育成の取得可否）。");
  L.push("- 監督 / ブースター / パック / Tier の API 候補を1件ずつ確認。");
  L.push("");
  L.push("（詳細な方式比較・所要時間見積り・SQLite 統合設計・データ競合設計は、上記の追加調査結果を待って確定する）");
  L.push("");

  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
}

main().catch((err) => {
  console.error("\n[world] 中断:", err?.stack ?? err);
  writeReport({ stopped: true, stopReason: "想定外のエラー", stopDetail: err?.message }).finally(() => process.exit(1));
});
