/**
 * 読み込み時間・操作応答の計測（読み取りだけの GET。何も書き込まない）。2026-10-04。
 *
 *   BASE_URL=https://efootball-team-ai.vercel.app SAMPLES=5 node scripts/perf-flows.mjs
 *   BASE_URL=http://localhost:3000 node scripts/perf-flows.mjs
 *
 * 計測（route × viewport × locale × cold / warm）:
 *   TTFB・DCL・load・FCP・LCP・CLS・long task（件数・合計）・request 数・転送量（JS / CSS / 画像 / 文書 / API）・
 *   同じ URL の重複 request・API の応答時間・文書の x-vercel-cache / age / 地域。
 * client の画面遷移（Home からサイドバーのリンク）: クリックから、URL の変化・<main> の描画・通信の静止（300ms）まで。
 * 分布: 最小・中央値・p75・p95・最大・件数。外れ値は除外せず、そのまま残す（詳細は JSON）。
 * 出力: REPORT_PATH（既定 data/work/perf/perf-<label>.json）と標準出力の表。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const SAMPLES = Number(process.env.SAMPLES ?? 3);
const LABEL = process.env.LABEL ?? (BASE.includes("localhost") ? "local" : "production");
const REPORT = process.env.REPORT_PATH ?? path.join(ROOT, "data", "work", "perf", `perf-${LABEL}.json`);
const LOCALES = (process.env.LOCALES ?? "ja,en").split(",");
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, mobile: false, dpr: 1 },
  { name: "mobile", width: 390, height: 844, mobile: true, dpr: 3 },
];
const ROUTES = (process.env.ROUTES ?? "/,/players,/players/world/89138556575063,/managers,/compare?ids=89138556575063,88041460996837,/squads,/best-xi,/my-team,/my-builds,/diagnosis-history").split(/,(?=\/)/);
const TRANSITIONS = ["/players", "/managers", "/compare", "/squads", "/best-xi", "/my-team", "/"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLLECT = `(() => {
  const n = performance.getEntriesByType("navigation")[0];
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]));
  const res = performance.getEntriesByType("resource");
  const kind = (r) => /\\.js(\\?|$)/.test(r.name) ? "js" : /\\.css(\\?|$)/.test(r.name) ? "css" : r.initiatorType === "img" || /player-image|\\.(png|webp|jpg|svg)/.test(r.name) ? "img" : /\\/api\\//.test(r.name) ? "api" : "other";
  const bytes = { js: 0, css: 0, img: 0, api: 0, other: 0 };
  const counts = { js: 0, css: 0, img: 0, api: 0, other: 0 };
  const apiMs = [];
  const seen = new Map();
  for (const r of res) { const k = kind(r); bytes[k] += r.transferSize || 0; counts[k]++; if (k === "api") apiMs.push(Math.round(r.duration)); const u = r.name.split("#")[0]; seen.set(u, (seen.get(u) || 0) + 1); }
  const duplicates = [...seen.entries()].filter(([u, c]) => c > 1 && !/_rsc=|player-image/.test(u)).length;
  return {
    ttfb: n ? Math.round(n.responseStart - n.startTime) : null,
    dcl: n ? Math.round(n.domContentLoadedEventEnd) : null,
    load: n ? Math.round(n.loadEventEnd) : null,
    htmlBytes: n ? n.transferSize : null,
    fcp: paint["first-contentful-paint"] != null ? Math.round(paint["first-contentful-paint"]) : null,
    lcp: window.__pf ? Math.round(window.__pf.lcp) : null,
    cls: window.__pf ? Number(window.__pf.cls.toFixed(4)) : null,
    clsSources: window.__pf && window.__pf.src ? window.__pf.src.slice(0, 4) : [],
    longTasks: window.__pf ? window.__pf.lt.length : null,
    longTaskTotal: window.__pf ? Math.round(window.__pf.lt.reduce((a, b) => a + b, 0)) : null,
    requests: res.length + 1, bytes, counts, apiMaxMs: apiMs.length ? Math.max(...apiMs) : 0, duplicates,
    domNodes: document.getElementsByTagName("*").length,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  };
})()`;
const OBSERVE = `window.__pf={lcp:0,cls:0,lt:[]};try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__pf.lcp=e.startTime}).observe({type:"largest-contentful-paint",buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){window.__pf.cls+=e.value;if(e.value>0.01)(window.__pf.src||(window.__pf.src=[])).push(Math.round(e.startTime)+"ms "+e.value.toFixed(3)+" "+(e.sources||[]).map(x=>x.node?(x.node.nodeType===1?x.node.tagName+"."+String(x.node.className||"").slice(0,40)+" "+String(x.node.textContent||"").slice(0,30):"#text "+String(x.node.textContent).slice(0,30)):"?").join(" | "))}}).observe({type:"layout-shift",buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())window.__pf.lt.push(e.duration)}).observe({type:"longtask",buffered:true})}catch(e){}`;

function stats(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
  return { n: v.length, min: v[0], median: q(0.5), p75: q(0.75), p95: q(0.95), max: v[v.length - 1] };
}

async function newPage(vp, locale) {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const c = connectCDP(tab.webSocketDebuggerUrl);
  await c.ready;
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.send("Network.enable");
  await installSupabaseAuthTestDouble(c).catch(() => {});
  await c.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, mobile: vp.mobile });
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `${OBSERVE};try{localStorage.setItem("efootball-team-ai:locale:v1",${JSON.stringify(locale)})}catch(e){}` });
  const errors = [];
  const docs = [];
  c.on("Runtime.exceptionThrown", (p) => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 140)));
  c.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errors.push(String(p.args?.[0]?.value ?? p.args?.[0]?.description ?? "").split("\n")[0].slice(0, 140)); });
  c.on("Network.responseReceived", (p) => {
    if (p.type === "Document") {
      const h = Object.fromEntries(Object.entries(p.response.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
      docs.push({ status: p.response.status, cache: h["x-vercel-cache"] ?? null, age: h.age ?? null, region: h["x-vercel-id"] ? String(h["x-vercel-id"]).split("::").slice(0, -1).join(">") : null });
    }
    if (p.response.status >= 500) errors.push(`HTTP ${p.response.status} ${p.response.url.slice(0, 100)}`);
  });
  const ev = async (e) => (await c.send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const close = async () => { await closeTab(browser.port, tab.id).catch(() => {}); c.close(); await browser.close(); };
  return { c, ev, errors, docs, close };
}

async function settle(ev, quietMs = 600, timeoutMs = 15000) {
  const t0 = Date.now();
  let last = -1, stableSince = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const n = await ev("performance.getEntriesByType('resource').length + (document.readyState === 'complete' ? 0 : 100000)");
    if (n !== last) { last = n; stableSince = Date.now(); }
    else if (Date.now() - stableSince >= quietMs) return Date.now() - t0;
    await sleep(100);
  }
  return Date.now() - t0;
}

async function measureLoads() {
  const rows = [];
  for (const vp of VIEWPORTS) for (const locale of LOCALES) for (const route of ROUTES) {
    for (let i = 0; i < SAMPLES; i++) {
      const p = await newPage(vp, locale); // 新しいプロファイル = cold（HTTP cache なし）
      try {
        for (const kind of ["cold", "warm"]) {
          await p.c.send("Page.navigate", { url: `${BASE}${route}` });
          await waitForCondition(async () => (await p.ev("document.readyState")) === "complete", { timeoutMs: 20000, intervalMs: 100 });
          await settle(p.ev);
          const m = await p.ev(COLLECT);
          rows.push({ route, viewport: vp.name, locale, kind, sample: i, ...m, doc: p.docs.at(-1) ?? null });
        }
      } finally {
        rows.at(-1).errors = [...p.errors];
        await p.close();
      }
    }
  }
  return rows;
}

async function measureTransitions() {
  const rows = [];
  for (const vp of VIEWPORTS) for (const locale of LOCALES) {
    const p = await newPage(vp, locale);
    try {
      await p.c.send("Page.navigate", { url: `${BASE}/` });
      await waitForCondition(async () => (await p.ev("document.readyState")) === "complete", { timeoutMs: 20000 });
      await settle(p.ev);
      for (let round = 0; round < SAMPLES; round++) {
        for (const href of TRANSITIONS) {
          const ok = await p.ev(`(() => { const a = [...document.querySelectorAll('a[href="${href}"]')].find((x) => x.offsetParent !== null) || document.querySelector('a[href="${href}"]'); if (!a) return false; window.__navT0 = performance.now(); a.click(); return true; })()`);
          if (!ok) { rows.push({ viewport: vp.name, locale, href, round, ok: false }); continue; }
          const t0 = Date.now();
          await waitForCondition(async () => (await p.ev("location.pathname")) === href.split("?")[0], { timeoutMs: 15000, intervalMs: 20 });
          const urlMs = Date.now() - t0;
          await waitForCondition(async () => (await p.ev("!!document.querySelector('main h1, main [data-testid]') && !document.querySelector('main .skeleton')")) === true, { timeoutMs: 15000, intervalMs: 30 });
          const contentMs = Date.now() - t0;
          const settleMs = await settle(p.ev, 300);
          rows.push({ viewport: vp.name, locale, href, round, ok: true, urlMs, contentMs, settledMs: contentMs + settleMs, fullReload: (await p.ev("performance.getEntriesByType('navigation')[0].name")) .endsWith(href) });
        }
      }
      rows.push({ viewport: vp.name, locale, heapMB: await p.ev("performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null"), domNodes: await p.ev("document.getElementsByTagName('*').length"), errors: [...p.errors], memory: true });
    } finally {
      await p.close();
    }
  }
  return rows;
}

const loads = await measureLoads();
const transitions = await measureTransitions();
const summary = {};
for (const r of loads) {
  const k = `${r.route} | ${r.viewport} | ${r.kind}`;
  (summary[k] ??= { ttfb: [], fcp: [], lcp: [], cls: [], longTaskTotal: [], js: [], total: [], requests: [], duplicates: [], apiMaxMs: [] });
  const s = summary[k];
  s.ttfb.push(r.ttfb); s.fcp.push(r.fcp); s.lcp.push(r.lcp); s.cls.push(r.cls); s.longTaskTotal.push(r.longTaskTotal);
  s.js.push(Math.round((r.bytes?.js ?? 0) / 1024)); s.total.push(Math.round(Object.values(r.bytes ?? {}).reduce((a, b) => a + b, 0) / 1024 + (r.htmlBytes ?? 0) / 1024));
  s.requests.push(r.requests); s.duplicates.push(r.duplicates); s.apiMaxMs.push(r.apiMaxMs);
}
const table = Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([m, xs]) => [m, stats(xs)]))]));
const tr = {};
for (const r of transitions.filter((x) => x.ok)) (tr[`${r.href} | ${r.viewport}`] ??= []).push(r.contentMs);
const trTable = Object.fromEntries(Object.entries(tr).map(([k, v]) => [k, stats(v)]));
const errors = [...loads.flatMap((r) => r.errors ?? []), ...transitions.flatMap((r) => r.errors ?? [])];
await fs.mkdir(path.dirname(REPORT), { recursive: true });
await fs.writeFile(REPORT, JSON.stringify({ base: BASE, label: LABEL, samples: SAMPLES, at: new Date().toISOString(), table, transitions: trTable, errors, raw: { loads, transitions } }, null, 1));
console.log(`perf ${LABEL} ${BASE} samples=${SAMPLES}`);
console.log("route | viewport | kind :: ttfb med/p95 | fcp med/p95 | lcp med/p95 | cls max | longTask p95 | js KB med | total KB med | req med | dup max | api max p95");
for (const [k, v] of Object.entries(table)) {
  const f = (m, key) => (v[m] ? v[m][key] : "-");
  console.log(`${k} :: ${f("ttfb", "median")}/${f("ttfb", "p95")} | ${f("fcp", "median")}/${f("fcp", "p95")} | ${f("lcp", "median")}/${f("lcp", "p95")} | ${f("cls", "max")} | ${f("longTaskTotal", "p95")} | ${f("js", "median")} | ${f("total", "median")} | ${f("requests", "median")} | ${f("duplicates", "max")} | ${f("apiMaxMs", "p95")}`);
}
console.log("transition (click → content) median/p75/p95/max n");
for (const [k, s] of Object.entries(trTable)) console.log(`${k} :: ${s.median}/${s.p75}/${s.p95}/${s.max} n=${s.n}`);
console.log(`errors: ${errors.length}${errors.length ? "\n  " + [...new Set(errors)].slice(0, 10).join("\n  ") : ""}`);
console.log(`report: ${path.relative(ROOT, REPORT)}`);
