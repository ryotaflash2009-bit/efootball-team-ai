/**
 * 監督画像ソースの調査（候補サイトを順番に）。
 *   node scripts/investigate-manager-image-sources.mjs
 *
 * 外部アクセス: GET のみ・最大40回・逐次・間隔3秒・20秒・再試行なし・
 *   Cookie/Authorization/APIキーなし・UA偽装なし・redirect 非追跡・未確認API総当たりなし・パス辞書なし。
 * サイトごとに 429/403/CAPTCHA/ログイン要求 を検出したらそのサイトの調査を打ち切って次へ。
 * 目的: 「安全に表示/再配信でき、監督カードと正確に対応できる公開画像」があるかの判定（A〜E）。
 * 全画像は取得しない（本スクリプトは判定まで）。結果は ./docs/manager-image-sources.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_MD = path.join(ROOT, "docs", "manager-image-sources.md");
const UA = "eFootball-Team-AI-dev/0.1 (manager image licensing check; contact: project owner)";
const TIMEOUT_MS = 20_000;
const GAP_MS = 3_000;
const MAX = 40;

let n = 0;
const allLog = [];

async function get(url, { binary = false, label = "" } = {}) {
  if (n >= MAX) throw new Error(`GLOBAL-STOP: 外部アクセス上限(${MAX})`);
  if (n > 0) await new Promise((r) => setTimeout(r, GAP_MS));
  n++;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: binary ? "image/*" : "text/html,application/json,text/plain,*/*" },
    });
  } catch (err) {
    const e = { n, url, label, error: String(err.message ?? err) };
    allLog.push(e);
    return e;
  } finally {
    clearTimeout(t);
  }
  const e = {
    n, url, label,
    status: res.status,
    contentType: res.headers.get("content-type") ?? null,
    contentLength: res.headers.get("content-length") ?? null,
    location: res.headers.get("location") ?? null,
    setCookie: [...res.headers.keys()].some((k) => k.toLowerCase() === "set-cookie"),
  };
  const blocked = res.status === 401 || res.status === 403 || res.status === 429;
  const authRedirect = res.status >= 300 && res.status < 400 && /login|signin|captcha|sso|auth/i.test(e.location ?? "");
  if (blocked) e.siteStop = `HTTP ${res.status}`;
  if (authRedirect) e.siteStop = `認証系リダイレクト → ${e.location}`;

  if (res.status === 200) {
    if (binary) {
      const b = Buffer.from(await res.arrayBuffer());
      e.bytesLen = b.length;
      e.magic = b.slice(0, 12).toString("hex");
    } else {
      e.body = (await res.text()).slice(0, 120_000);
      e.bodyLen = e.body.length;
    }
  } else if (res.status >= 300 && res.status < 400) {
    e.redirectNote = "追跡しない";
  }
  allLog.push(e);
  return e;
}

// ---- HTML から利用条件・著作権・画像の手がかりを抽出 ----
function scan(html) {
  const h = html ?? "";
  const pick = (re, k = 0) => [...h.matchAll(re)].map((m) => (m[k] ?? m[0]).replace(/\s+/g, " ").trim());
  return {
    copyright: pick(/(©|&copy;|copyright|all rights reserved|property of|licen[cs]e|無断転載|著作権|権利は|帰属)[^<>{}]{0,140}/gi).slice(0, 10),
    konamiMention: pick(/(konami|コナミ|not affiliated|unofficial|非公式|fan[- ]?made|ファンサイト|fan project)[^<>{}]{0,140}/gi).slice(0, 8),
    policyLinks: [...h.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{0,60})<\/a>/gi)]
      .map((m) => ({ text: m[2].replace(/\s+/g, " ").trim(), href: m[1] }))
      .filter((l) => /terms|privacy|licen[cs]e|copyright|dmca|policy|legal|credit|attribut|規約|方針|ポリシー|クレジット|免責/i.test(l.text + " " + l.href))
      .slice(0, 12),
    managerLinks: [...new Set([...h.matchAll(/href="([^"]*(?:manager|coach|監督)[^"]*)"/gi)].map((m) => m[1]))].slice(0, 6),
    imgHosts: [...new Set([...h.matchAll(/https?:\/\/([a-z0-9.-]+)\/[^"'`)\s]*\.(?:png|jpe?g|webp|avif)/gi)].map((m) => m[1].toLowerCase()))].slice(0, 12),
    hotlinkHints: pick(/(hotlink|hot-link|inline linking|直接リンク|embed|埋め込み)[^<>{}]{0,120}/gi).slice(0, 6),
  };
}

// ---- サイト調査（各サイト最大 ~7 リクエスト。siteStop で打ち切り） ----
async function investigateSite(site) {
  const rec = { name: site.name, base: site.base, requests: [], analysis: {}, verdict: null, verdictReason: "" };
  const budgetStart = n;
  const doGet = async (u, label) => {
    const r = await get(u, { label: `${site.name}:${label}` });
    rec.requests.push({ url: u, label, status: r.status ?? null, error: r.error ?? null, contentType: r.contentType ?? null, redirect: r.location ?? null, siteStop: r.siteStop ?? null });
    return r;
  };

  for (const [label, url] of site.probes) {
    if (n - budgetStart >= 7) { rec.analysis._note = "サイト別上限(7)到達"; break; }
    if (n >= MAX) break;
    const r = await doGet(url, label);
    if (r.siteStop) {
      rec.verdict = "E";
      rec.verdictReason = `${label} で ${r.siteStop}（停止条件）→ このサイトの調査を打ち切り`;
      return rec;
    }
    if (label === "robots") rec.analysis.robots = (r.body ?? "").slice(0, 1500);
    if (label === "home" || label === "managers") {
      rec.analysis[label] = { status: r.status, len: r.bodyLen ?? null, redirect: r.location ?? null, ...(r.body ? scan(r.body) : {}) };
    }
    if (/terms|privacy|license|about|legal|credit/i.test(label)) {
      rec.analysis[label] = { status: r.status, redirect: r.location ?? null, snippet: (r.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1800) };
    }
  }
  return rec;
}

async function main() {
  const known = {
    "amine250-repo (前回調査済み)": "raw.githubusercontent.com/amine250/efootball-managers — 66監督・64画像候補・PNG・LICENSE なし・ゲーム内レンダー/他サイト由来混在・同名別カード別画像・利用許可未確認（C）",
    "efootballdb.com (前回調査済み)": "robots Allow:/* / terms・privacy・about すべて 404 / 著作権表記『eFootball assets property of KONAMI』のみ / SPA・画像は api.efootballdb.com（非公開API）/ Konami レンダー → C/E",
  };

  const sites = [
    {
      name: "eFootBase",
      base: "https://efootbase.com/",
      probes: [
        ["robots", "https://efootbase.com/robots.txt"],
        ["home", "https://efootbase.com/"],
        ["managers", "https://efootbase.com/managers"],
        ["terms", "https://efootbase.com/terms"],
        ["about", "https://efootbase.com/about"],
      ],
    },
    {
      name: "EFScout",
      base: "https://efscout.app/",
      probes: [
        ["robots", "https://efscout.app/robots.txt"],
        ["home", "https://efscout.app/"],
        ["managers", "https://efscout.app/managers"],
        ["terms", "https://efscout.app/terms"],
        ["about", "https://efscout.app/about"],
      ],
    },
    {
      name: "eFootBox",
      base: "https://www.efootbox.com/",
      probes: [
        ["robots", "https://www.efootbox.com/robots.txt"],
        ["home", "https://www.efootbox.com/"],
        ["managers", "https://www.efootbox.com/managers"],
        ["terms", "https://www.efootbox.com/terms"],
        ["privacy", "https://www.efootbox.com/privacy"],
      ],
    },
    {
      name: "amine250 GitHub Pages",
      base: "https://amine250.github.io/efootball-managers/",
      probes: [
        ["robots", "https://amine250.github.io/robots.txt"],
        ["home", "https://amine250.github.io/efootball-managers/"],
        ["license", "https://raw.githubusercontent.com/amine250/efootball-managers/main/data/photos/README.md"],
        ["credits", "https://raw.githubusercontent.com/amine250/efootball-managers/main/CREDITS.md"],
        ["notice", "https://raw.githubusercontent.com/amine250/efootball-managers/main/NOTICE"],
      ],
    },
    {
      name: "KONAMI eFootball 公式",
      base: "https://www.konami.com/efootball/",
      probes: [
        ["robots", "https://www.konami.com/robots.txt"],
        ["home", "https://www.konami.com/efootball/ja/"],
        ["terms", "https://www.konami.com/efootball/ja/terms/"],
        ["legal", "https://legal.konami.com/games/"],
      ],
    },
  ];

  const results = [];
  for (const s of sites) {
    if (n >= MAX) { results.push({ name: s.name, base: s.base, verdict: "未調査", verdictReason: "外部アクセス上限" }); continue; }
    console.log(`\n### 調査中: ${s.name} (${s.base})  [使用済み ${n}/${MAX}]`);
    const rec = await investigateSite(s);
    results.push(rec);
    console.log(JSON.stringify({ name: rec.name, verdict: rec.verdict, reason: rec.verdictReason, requests: rec.requests.map((r) => `${r.label}:${r.status ?? r.error}${r.siteStop ? " STOP" : ""}`) }, null, 1));
    console.log("analysis:", JSON.stringify(rec.analysis, null, 1).slice(0, 4000));
  }

  const md = [
    "# 監督画像ソース 候補サイト別調査",
    "",
    `実行日時: ${new Date().toISOString()}  外部アクセス: ${n} / ${MAX}`,
    "",
    "## 既知（前回調査済み・再取得なし）",
    ...Object.entries(known).map(([k, v]) => `- **${k}**: ${v}`),
    "",
    "## 今回のサイト別結果",
    ...results.flatMap((r) => [
      `### ${r.name}  \`${r.base}\``,
      "",
      `- 判定: **${r.verdict ?? "（判定は本文参照）"}**  ${r.verdictReason ?? ""}`,
      "- リクエスト: " + (r.requests ?? []).map((x) => `${x.label}=${x.status ?? x.error}${x.siteStop ? "(STOP)" : ""}`).join(", "),
      "",
      "```json",
      JSON.stringify(r.analysis ?? {}, null, 2),
      "```",
      "",
    ]),
    "## 全リクエストログ",
    "```json",
    JSON.stringify(allLog.map((e) => ({ n: e.n, url: e.url, label: e.label, status: e.status ?? e.error, ct: e.contentType, redirect: e.location, siteStop: e.siteStop })), null, 2),
    "```",
    "",
  ].join("\n");
  await fs.mkdir(path.dirname(OUT_MD), { recursive: true });
  await fs.writeFile(OUT_MD, md, "utf8");
  console.log(`\n=== 完了。合計外部アクセス ${n} / ${MAX}。結果: docs/manager-image-sources.md ===`);
}

main().catch((err) => {
  console.error("調査中断:", err.message ?? err);
  console.error(`ここまでの外部アクセス: ${n}`);
  console.error(JSON.stringify(allLog.map((e) => ({ n: e.n, url: e.url, status: e.status ?? e.error, siteStop: e.siteStop })), null, 1));
  process.exit(1);
});
