/**
 * 招待制ベータ前のローカル性能計測(再実行可能)。
 *
 *   npm run build && npx next start -p 3000   (別terminal)
 *   node scripts/perf-local-benchmark.mjs
 *
 * - localhost:3000 へのHTTPと、既存helperの隔離headless Chrome(OSの一時フォルダの使い捨てprofile、終了時に破棄)だけを使う。
 *   外部サイトへは移動しない(参照データの取得はアプリのserver側が行う)。
 * - HTTP: route・APIごとに最初の1回(cold相当: server起動後の初回)と、続くwarm N回の所要時間・応答サイズ。
 * - Browser: desktop 1280 / mobile 390 でページごとにR回開き、navigation timing・long task・CLS・request数・
 *   同一API URLの重複・console error を集計する。
 * - 結果は docs/black-box-tests/perf-local-benchmark.md へ(認証情報・利用者データ・非公開URLは含めない)。
 * - 判定は「重大な問題」だけ: warm中央値 page>3000ms / API>2000ms、long task合計>1000ms、CLS>0.25、
 *   同一ナビゲーション内での同一APIの重複、console error、5xx。数値はこの端末での参考値で、一般化しない。
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

// 既定はlocalhost。本人承認のある読み取り専用の公開サイト確認だけ BASE_URL(https) を指定する。
// 結果は既定のレポート(localhost用)を上書きしないよう、BASE_URL指定時は REPORT_PATH(リポジトリ内・git管理外の./data配下)へ書く。
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = resolveReport(process.env.REPORT_PATH, path.join(ROOT, "docs", "black-box-tests", "perf-local-benchmark.md"));
function resolveReport(custom, fallback) {
  if (!custom) {
    if (!IS_LOCAL) throw new Error("REPORT_PATH is required when BASE_URL is not localhost");
    return fallback;
  }
  const p = path.resolve(ROOT, custom);
  if (!p.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
  return p;
}
// 公開サイトでは小さい固定sample数にする(負荷をかけない)。
const WARM = Number(process.env.PERF_WARM ?? 5);
const BROWSER_REPEAT = Number(process.env.PERF_REPEAT ?? 3);
if (!(WARM >= 1 && WARM <= 5 && BROWSER_REPEAT >= 2 && BROWSER_REPEAT <= 3)) throw new Error("PERF_WARM 1-5, PERF_REPEAT 2-3");
const LIMITS = { pageMs: 3000, apiMs: 2000, longTaskMs: 1000, cls: 0.25 };

const HTTP_TARGETS = [
  ["page", "Home", "/"],
  ["page", "Players initial", "/players"],
  ["page", "Players search", `/players?q=${encodeURIComponent("メッシ")}`],
  ["page", "Players filter", "/players?position=CF&sort=ovr_max_desc"],
  ["page", "World detail", "/players/world/89138556575063"],
  ["page", "Managers", "/managers"],
  ["page", "Managers search", "/managers?q=conte"],
  ["page", "Compare", "/compare"],
  ["page", "My Team", "/my-team"],
  ["page", "My Builds", "/my-builds"],
  ["page", "Squads", "/squads"],
  ["page", "Best XI", "/best-xi"],
  ["api", "World list API", "/api/world/players?pageSize=24"],
  ["api", "World search API", `/api/world/players?q=${encodeURIComponent("messi")}&pageSize=24`],
  ["api", "Managers API", "/api/managers?pageSize=24"],
];

const BROWSER_PAGES = ["/", "/players", `/players?q=${encodeURIComponent("メッシ")}`, "/players?position=CF", "/managers", "/managers?q=conte", "/compare", "/my-team", "/my-builds", "/squads", "/best-xi"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
];

/** Markdown表のセル用: バックスラッシュを先にエスケープしてから`|`をエスケープし、改行は空白にする。 */
function escapeTableCell(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const max = (xs) => (xs.length ? Math.max(...xs) : 0);

async function timedGet(p) {
  const t0 = performance.now();
  const r = await fetch(BASE + p, { redirect: "manual" });
  const body = await r.text();
  return { ms: Math.round(performance.now() - t0), status: r.status, bytes: Buffer.byteLength(body) };
}

async function httpPhase() {
  const rows = [];
  for (const [kind, label, p] of HTTP_TARGETS) {
    const cold = await timedGet(p);
    const warm = [];
    for (let i = 0; i < WARM; i++) warm.push(await timedGet(p));
    const statuses = [cold.status, ...warm.map((w) => w.status)];
    const limit = kind === "api" ? LIMITS.apiMs : LIMITS.pageMs;
    rows.push({
      kind, label, path: p, coldMs: cold.ms, warmMedianMs: median(warm.map((w) => w.ms)), warmMaxMs: max(warm.map((w) => w.ms)),
      kb: Math.round(cold.bytes / 1024), statuses: [...new Set(statuses)].join(","),
      ok: statuses.every((s) => s === 200) && median(warm.map((w) => w.ms)) <= limit,
    });
  }
  return rows;
}

async function evalJson(client, expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

const OBSERVER = `(() => {
  window.__perf = { longTasks: 0, longTaskMs: 0, cls: 0 };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__perf.longTasks++; window.__perf.longTaskMs += e.duration; } }).observe({ type: "longtask", buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
})()`;

async function browserPhase() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVER });
  await installSupabaseAuthTestDouble(client);
  let cur = { requests: [], errors: 0, server5xx: 0 };
  client.on("Network.requestWillBeSent", (p) => cur.requests.push(p.request?.url ?? ""));
  client.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") cur.errors++; });
  client.on("Runtime.exceptionThrown", () => cur.errors++);
  client.on("Network.responseReceived", (p) => { if ((p.response?.url ?? "").startsWith(BASE) && p.response.status >= 500) cur.server5xx++; });
  const rows = [];
  try {
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      for (const p of BROWSER_PAGES) {
        const samples = [];
        for (let i = 0; i < BROWSER_REPEAT; i++) {
          cur = { requests: [], errors: 0, server5xx: 0 };
          await client.send("Page.navigate", { url: BASE + p });
          const t0 = Date.now();
          while (Date.now() - t0 < 20000) {
            if ((await evalJson(client, "document.readyState").catch(() => null)) === "complete") break;
            await new Promise((r) => setTimeout(r, 100));
          }
          await new Promise((r) => setTimeout(r, 1200)); // hydration後のlong task・layout shift・追加fetchを拾う
          const m = await evalJson(client, `(() => { const n = performance.getEntriesByType("navigation")[0] || {}; return { ttfb: Math.round(n.responseStart || 0), dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0), longTasks: window.__perf?.longTasks ?? 0, longTaskMs: Math.round(window.__perf?.longTaskMs ?? 0), cls: Math.round((window.__perf?.cls ?? 0) * 1000) / 1000 }; })()`);
          const api = cur.requests.filter((u) => u.startsWith(`${BASE}/api/`));
          const dup = api.length - new Set(api).size;
          samples.push({ ...m, requests: cur.requests.filter((u) => u.startsWith(BASE)).length, apiRequests: api.length, duplicateApi: dup, errors: cur.errors, server5xx: cur.server5xx });
        }
        const warm = samples.slice(1);
        const row = {
          viewport: vp.name, path: p,
          coldLoadMs: samples[0].load, warmLoadMedianMs: median(warm.map((s) => s.load)), warmLoadMaxMs: max(warm.map((s) => s.load)),
          ttfbMedianMs: median(samples.map((s) => s.ttfb)), longTaskMsMax: max(samples.map((s) => s.longTaskMs)), clsMax: max(samples.map((s) => s.cls)),
          requests: samples[0].requests, apiRequests: samples[0].apiRequests, duplicateApiMax: max(samples.map((s) => s.duplicateApi)),
          errors: samples.reduce((a, s) => a + s.errors, 0), server5xx: samples.reduce((a, s) => a + s.server5xx, 0),
        };
        row.ok = row.warmLoadMedianMs <= LIMITS.pageMs && row.longTaskMsMax <= LIMITS.longTaskMs && row.clsMax <= LIMITS.cls && row.duplicateApiMax === 0 && row.errors === 0 && row.server5xx === 0;
        rows.push(row);
        console.log(`${row.ok ? "OK  " : "SLOW"} [${vp.name}] ${decodeURIComponent(p)} load cold=${row.coldLoadMs} warm=${row.warmLoadMedianMs}ms longTask=${row.longTaskMsMax}ms cls=${row.clsMax} api=${row.apiRequests} dup=${row.duplicateApiMax}`);
      }
    }
  } finally {
    client.close();
    await closeTab(browser.port, tab.id);
    await browser.close();
  }
  return rows;
}

async function main() {
  const http = await httpPhase();
  for (const r of http) console.log(`${r.ok ? "OK  " : "SLOW"} ${r.label} cold=${r.coldMs}ms warm=${r.warmMedianMs}ms max=${r.warmMaxMs}ms ${r.kb}KB`);
  const browser = await browserPhase();
  const bad = [...http.filter((r) => !r.ok), ...browser.filter((r) => !r.ok)];
  const lines = [
    "# ローカル性能計測(招待制ベータ前)",
    "",
    `実行日時: ${new Date().toISOString()}  対象: ${IS_LOCAL ? `${BASE}(next start、Production build)` : "公開サイト(読み取り専用GETのみ)"}  HTTP warm=${WARM}回・browser=${BROWSER_REPEAT}回(1回目をcold相当)`,
    `閾値(重大な問題だけを判定): page warm中央値 ${LIMITS.pageMs}ms / API ${LIMITS.apiMs}ms / long task合計 ${LIMITS.longTaskMs}ms / CLS ${LIMITS.cls} / 同一APIの重複0 / console error 0 / 5xx 0`,
    "数値はこの端末・この時点の参考値であり一般化しない。",
    "",
    "## HTTP(server render・API)",
    "",
    "| 判定 | 対象 | cold ms | warm中央値 ms | warm最大 ms | KB | status |",
    "|---|---|---|---|---|---|---|",
    ...http.map((r) => `| ${r.ok ? "OK" : "SLOW"} | ${r.label} | ${r.coldMs} | ${r.warmMedianMs} | ${r.warmMaxMs} | ${r.kb} | ${r.statuses} |`),
    "",
    "## Browser(navigation・hydration後)",
    "",
    "| 判定 | viewport | page | cold load ms | warm load中央値 ms | warm最大 ms | TTFB中央値 ms | long task最大 ms | CLS最大 | requests | API | 重複API | error | 5xx |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...browser.map((r) => `| ${r.ok ? "OK" : "SLOW"} | ${r.viewport} | ${escapeTableCell(decodeURIComponent(r.path))} | ${r.coldLoadMs} | ${r.warmLoadMedianMs} | ${r.warmLoadMaxMs} | ${r.ttfbMedianMs} | ${r.longTaskMsMax} | ${r.clsMax} | ${r.requests} | ${r.apiRequests} | ${r.duplicateApiMax} | ${r.errors} | ${r.server5xx} |`),
    "",
    `**重大な問題: ${bad.length}件**`,
    "",
  ];
  writeFileSync(REPORT, lines.join("\n"), "utf8");
  console.log(`\n[perf-local-benchmark] severe issues: ${bad.length}`);
  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
