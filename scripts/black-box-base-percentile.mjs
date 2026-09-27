/**
 * F-071 基礎能力値のパーセンタイルのブラックボックス（8 viewport × 日本語/英語）。
 *
 *   node scripts/black-box-base-percentile.mjs                               (next start を localhost:3000 で起動済み)
 *   BASE_URL=https://<公開サイト> REPORT_PATH=./data/<folder>/base-percentile.md node scripts/black-box-base-percentile.mjs
 *
 * 2つの状態を確かめる:
 * - 実際の状態: main の成果物（無い・古い・一致）に応じた表示。一致しないときは照合できない旨だけ（値を出さない）。
 * - 表示の確認: ブラウザー内で /api/percentiles/world-base の応答だけを合成の分布へ差し替え（CDP Fetch。サーバー・DB は変えない）、
 *   区分の表示・範囲の切り替え・F-034 の別枠・比較画面のトグルを確かめる。
 * GET と画面操作だけ。書き込み・ログイン・外部送信なし。結果は要約だけ。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = (() => {
  const custom = process.env.REPORT_PATH;
  if (!custom) {
    if (!IS_LOCAL) throw new Error("REPORT_PATH is required when BASE_URL is not localhost");
    return path.join(ROOT, "docs", "black-box-tests", "base-percentile.md");
  }
  const p = path.resolve(ROOT, custom);
  if (!p.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
  return p;
})();

const VIEWPORTS = [
  { name: "desktop-1280x720", width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
  { name: "tablet-768x1024", width: 768, height: 1024, deviceScaleFactor: 2, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, deviceScaleFactor: 2, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-393x852", width: 393, height: 852, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-430x932", width: 430, height: 932, deviceScaleFactor: 3, mobile: true },
];
const LOCALE_KEY = "efootball-team-ai:locale:v1";
const TEXT = {
  ja: { explanation: "この順位は育成前の基礎能力値を、現在のWorldカード分布と比較したものです", fallback: "パーセンタイルデータを現在の選手データと照合できません", statsTab: "能力値", progressionTab: "育成" },
  en: { explanation: "This ranking compares the base ability value before progression with the current World card distribution", fallback: "Percentile data could not be matched to the current player dataset", statsTab: "Abilities", progressionTab: "Progression" },
};
const STAT_KEYS = ["offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass", "finishing", "heading", "setPieceTaking", "curl", "defensiveAwareness", "tackling", "aggression", "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach", "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina"];
const POSITIONS = ["GK", "CB", "LB", "RB", "DMF", "CMF", "LMF", "RMF", "AMF", "LWF", "RWF", "SS", "CF"];
const HYDRATION_RE = /hydrat|Minified React error #(418|423|425)|did not match/i;

// F-072 共有カードの見本（docs/product/share-url-contract.md の sd1 をアプリのコードとは独立に組み立てる）。
function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(text, "utf8")) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
const SHARE_SAMPLE = {
  v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: "2026-09-27", f: "4-3-3", o: [71, "A"],
  c: { attack: [40, "C"], defense: [47, "C"], aerial: [54, "C"], speed: [61, "B"], passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"] },
  s: ["ability", "counterAttack"], w: ["compatibility", null],
};
const SHARE_TOKEN = (() => {
  const body = Buffer.from(JSON.stringify(SHARE_SAMPLE), "utf8").toString("base64url");
  return `sd1.${body}.${fnv1a32(body)}`;
})();

/** 合成の分布（値 40〜84 に一様・母数 4,500。上位の選手に称号が付く幅）。表示の確認用で、実データではない。 */
function syntheticBody() {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, { min: 40, counts: Array.from({ length: 45 }, () => 100) }]));
  const scopes = { all: { n: 4500, stats }, field: { n: 4500, stats }, gk: { n: 4500, stats } };
  for (const p of POSITIONS) scopes[`position:${p}`] = { n: 4500, stats };
  return { status: "valid", generatedAt: "2026-09-28T00:00:00.000Z", datasetVersion: "synthetic", recordCount: 4500, scopes };
}

let client;
let cap;
const resetCap = () => (cap = { consoleErrors: [], warnings: [], exceptions: [], s5xx: [], s4xx: [], writes: [] });
resetCap();
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.text}`);
  return r.result.value;
}
async function waitFor(fn, timeoutMs, label) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if (await fn()) return;
    } catch {
      /* 遷移中 */
    }
    await sleep(100);
  }
  throw new Error(`timeout: ${label}`);
}
async function nav(route) {
  await client.send("Page.navigate", { url: `${BASE}${route}` });
  await waitFor(async () => (await ev("document.readyState")) === "complete", 30000, `load ${route}`);
  await sleep(700);
}
const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const bodyText = () => ev("document.body ? document.body.innerText : ''");
const clickText = (sel, text) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);

async function step(vp, locale, route, op, fn) {
  resetCap();
  let res;
  try {
    res = await fn();
  } catch (e) {
    res = { ok: false, detail: e.message };
  }
  const problems = [];
  if (!res.ok) problems.push(res.detail || "check failed");
  let overflow = 0;
  let text = "";
  try {
    overflow = await ev("document.documentElement.scrollWidth - window.innerWidth");
    text = await bodyText();
  } catch {
    /* 遷移中 */
  }
  if (cap.consoleErrors.length) problems.push(`console error: ${cap.consoleErrors[0]}`);
  if (cap.exceptions.length) problems.push(`exception: ${cap.exceptions[0]}`);
  if (cap.warnings.length) problems.push(`console warning: ${cap.warnings[0]}`);
  if (cap.s5xx.length) problems.push(`5xx: ${cap.s5xx[0]}`);
  if (cap.s4xx.length) problems.push(`unexpected 4xx: ${cap.s4xx[0]}`);
  if (cap.writes.length) problems.push(`non-GET request: ${cap.writes[0]}`);
  if ([...cap.consoleErrors, ...cap.exceptions].some((m) => HYDRATION_RE.test(m))) problems.push("hydration mismatch");
  if (overflow > 0) problems.push(`horizontal overflow ${overflow}px`);
  if (/上位\s*0\s*%|Top 0%/.test(text)) problems.push("shows top 0%");
  const row = { viewport: vp.name, locale, route, op, ok: problems.length === 0, detail: problems.length ? problems.join(" ; ") : res.detail || "" };
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"}  [${vp.name} ${locale}] ${route} ${op}${row.detail ? `  — ${row.detail}` : ""}`);
}

async function main() {
  const list = await (await fetch(`${BASE}/api/world/players?pageSize=4`, { signal: AbortSignal.timeout(30000) })).json();
  const field = list.players.find((p) => p.registeredPosition && p.registeredPosition !== "GK") ?? list.players[0];
  const second = list.players.find((p) => p.worldCardId !== field.worldCardId) ?? field;
  const actual = await (await fetch(`${BASE}/api/percentiles/world-base`, { signal: AbortSignal.timeout(30000) })).json();

  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  for (const d of ["Page", "Runtime", "Network", "Log"]) await client.send(`${d}.enable`);
  await installSupabaseAuthTestDouble(client);
  const fmtArgs = (p) => (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").replace(/\s+/g, " ").slice(0, 200);
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error" || p.type === "assert") cap.consoleErrors.push(fmtArgs(p));
    else if (p.type === "warning") cap.warnings.push(fmtArgs(p));
  });
  client.on("Runtime.exceptionThrown", (p) => cap.exceptions.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception").split("\n")[0].slice(0, 200)));
  client.on("Log.entryAdded", (p) => {
    if (p.entry.source === "network") return;
    if (p.entry.level === "error") cap.consoleErrors.push(`[${p.entry.source}] ${String(p.entry.text).slice(0, 200)}`);
    else if (p.entry.level === "warning" && p.entry.source !== "other") cap.warnings.push(`[${p.entry.source}] ${String(p.entry.text).slice(0, 200)}`);
  });
  client.on("Network.requestWillBeSent", (p) => {
    const m = p.request?.method;
    if (m && m !== "GET" && m !== "HEAD" && (p.request.url ?? "").startsWith(BASE)) cap.writes.push(`${m} ${new URL(p.request.url).pathname}`);
  });
  client.on("Network.responseReceived", (p) => {
    const url = p.response?.url ?? "";
    if (!url.startsWith(BASE)) return;
    const s = p.response.status;
    const tag = `${s} ${p.type} ${new URL(url).pathname}`;
    if (s >= 500) cap.s5xx.push(tag);
    else if (s >= 400) cap.s4xx.push(tag);
  });

  // 合成の分布へ差し替える（ブラウザー内の応答だけ。サーバー・DB は変えない）。
  let synthetic = false;
  const body = Buffer.from(JSON.stringify(syntheticBody())).toString("base64");
  client.on("Fetch.requestPaused", async (p) => {
    if (synthetic && p.request.url.startsWith(`${BASE}/api/percentiles/world-base`)) {
      await client.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body });
    } else {
      await client.send("Fetch.continueRequest", { requestId: p.requestId });
    }
  });
  await client.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/percentiles/world-base*", requestStage: "Request" }] });

  const detail = `/players/world/${encodeURIComponent(field.worldCardId)}`;
  try {
    // 実際の状態（viewport に依存しないので1回）
    const vp0 = VIEWPORTS[0];
    await client.send("Emulation.setDeviceMetricsOverride", { width: vp0.width, height: vp0.height, deviceScaleFactor: 1, mobile: false });
    await nav("/");
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);
    await step(vp0, "ja", "/api/percentiles/world-base", `actual state: ${actual.status}`, async () => {
      const okShape = actual.status === "valid" ? typeof actual.recordCount === "number" && !!actual.scopes?.all : ["not_generated", "unavailable"].includes(actual.status);
      if (!okShape) throw new Error(`unexpected status ${actual.status}`);
      if (JSON.stringify(actual).match(/https?:|world_card_id|name_(en|ja)/)) throw new Error("row data in API");
      return { ok: true, detail: actual.status };
    });
    await step(vp0, "ja", detail, "actual state shown without guessed values", async () => {
      await nav(`${detail}?tab=stats`);
      await clickText("[role=tab], button", TEXT.ja.statsTab);
      await waitFor(() => has("[data-testid=base-percentile-panel]"), 8000, "panel");
      await waitFor(async () => !(await bodyText()).includes("読み込み中…"), 8000, "loaded");
      const badges = await count("[data-testid=base-percentile-panel] [data-bucket]");
      const fallback = await has("[data-testid=base-percentile-unavailable]");
      if (actual.status === "valid") return { ok: badges > 0 && !fallback, detail: `badges=${badges}` };
      return { ok: fallback && badges === 0, detail: `fallback=${fallback}` };
    });

    synthetic = true;
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      for (const locale of ["ja", "en"]) {
        const T = TEXT[locale];
        await nav("/");
        await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`);

        await step(vp, locale, detail, "stats tab: buckets, explanation, scope toggle", async () => {
          await nav(`${detail}?tab=stats`);
          await clickText("[role=tab], button", T.statsTab);
          // タブの中身は非表示でも DOM にあるため、表示中のパネルだけを見る。
          const PANEL = `[...document.querySelectorAll('[data-testid=base-percentile-panel]')].find((p) => p.offsetParent !== null)`;
          await waitFor(async () => (await ev(`(${PANEL})?.querySelectorAll('[data-bucket]').length ?? 0`)) > 0, 8000, "buckets");
          if (!(await bodyText()).includes(T.explanation)) throw new Error("explanation missing");
          const n1 = await ev(`(${PANEL}).querySelectorAll('[data-bucket]').length`);
          const buttons = await ev(`(${PANEL}).querySelectorAll('button[aria-pressed]').length`);
          await ev(`(${PANEL}).querySelectorAll('button[aria-pressed]')[1]?.click()`);
          await sleep(200);
          const pressed = await ev(`(${PANEL}).querySelectorAll('button[aria-pressed]')[1]?.getAttribute('aria-pressed')`);
          const n2 = await ev(`(${PANEL}).querySelectorAll('[data-bucket]').length`);
          const tiny = await ev(`[...(${PANEL}).querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height < 32).length`);
          return { ok: n1 > 0 && buttons >= 2 && pressed === "true" && n2 > 0 && tiny === 0, detail: `badges=${n1}/${n2}, scopes=${buttons}, small=${tiny}` };
        });

        await step(vp, locale, detail, "F-034: base percentile shown separately from the build preview", async () => {
          await nav(`${detail}?tab=progression`);
          await clickText("[role=tab], button", T.progressionTab);
          await waitFor(() => has("[data-testid=progression-base-percentile]"), 8000, "section");
          await ev(`document.querySelector('[data-testid=progression-base-percentile]').open = true`);
          await waitFor(async () => (await count("[data-testid=progression-base-percentile] [data-bucket]")) > 0, 8000, "buckets");
          return { ok: true, detail: `badges=${await count("[data-testid=progression-base-percentile] [data-bucket]")}` };
        });

        await step(vp, locale, "/compare", "toggle shows buckets for every player in the same scope", async () => {
          await nav(`/compare?ids=${encodeURIComponent(field.worldCardId)},${encodeURIComponent(second.worldCardId)}`);
          await waitFor(() => has("[data-testid=compare-percentile-toggle]"), 15000, "toggle");
          const before = await count("td [data-bucket]");
          await ev(`document.querySelector('[data-testid=compare-percentile-toggle]').click()`);
          await waitFor(async () => (await count("td [data-bucket]")) > 0, 8000, "buckets");
          const after = await count("td [data-bucket]");
          const note = await has("[data-testid=compare-percentile-note]");
          return { ok: before === 0 && after > 0 && note, detail: `badges=${after}` };
        });

        // F-072: 称号・バッジ（選手詳細・合成の分布 / 共有カード・sd1 の見本）
        await step(vp, locale, detail, "F-072 player titles strip with reasons", async () => {
          await nav(`${detail}?tab=stats`);
          await clickText("[role=tab], button", T.statsTab);
          await waitFor(() => has("[data-testid=player-titles]"), 8000, "titles");
          const strip = `[...document.querySelectorAll('[data-testid=player-titles]')].find((p) => p.offsetParent !== null)`;
          const total = await ev(`Number((${strip}).dataset.titleCount)`);
          const primaries = await ev(`(${strip}).querySelectorAll('[data-title-kind=primary]').length`);
          const badges = await ev(`(${strip}).querySelectorAll('[data-title-kind=badge]').length`);
          const hasWhy = total === 0 || (await ev(`!!(${strip}).querySelector('details summary')`));
          // 合成の分布では、この選手（World 一覧の先頭のフィールドプレイヤー）は上位の能力が多く、称号が1つ付く。
          return { ok: primaries === 1 && badges <= 4 && hasWhy, detail: `primary=${primaries}, badges=${badges}` };
        });

        await step(vp, locale, "/share/diagnosis", "F-072 diagnosis title from the shared token", async () => {
          await nav(`/share/diagnosis#${SHARE_TOKEN}`);
          await waitFor(() => has("[data-testid=diagnosis-titles]"), 10000, "titles");
          const primaryId = await ev(`document.querySelector('[data-testid=diagnosis-titles] [data-title-kind=primary]')?.dataset.titleId ?? null`);
          const badgeIds = await ev(`[...document.querySelectorAll('[data-testid=diagnosis-titles] [data-title-kind=badge]')].map((e) => e.dataset.titleId).join(',')`);
          // 見本: 段階 A 以上は counterAttack 89 S・pressResistance 82 A・dribblePossession 75 A → 称号 1 + バッジ 2（点数順）。
          return { ok: primaryId === "counterAttack" && badgeIds === "pressResistance,dribblePossession", detail: `primary=${primaryId}, badges=${badgeIds}` };
        });
      }
    }
    await nav("/");
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const L = [
    "# F-071 基礎能力値のパーセンタイル・F-072 称号 ブラックボックス",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${IS_LOCAL ? "localhost（Production Build）" : "公開サイト"}  viewport: ${VIEWPORTS.length}  locale: ja, en  実際の成果物の状態: ${actual.status}`,
    "",
    "表示の確認は、ブラウザー内で分布 API の応答だけを合成の分布へ差し替えて行う（サーバー・DB は変えない）。書き込み・ログインなし。",
    "",
    "| 結果 | viewport | locale | route | 確認 | 詳細 |",
    "|---|---|---|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.viewport} | ${r.locale} | ${escapeMarkdownCell(r.route)} | ${escapeMarkdownCell(r.op)} | ${escapeMarkdownCell(String(r.detail))} |`),
    "",
    `## 判定: ${results.length - failed.length}/${results.length} PASS${failed.length ? `（${failed.length} 件 FAIL）` : ""}`,
    "",
  ];
  mkdirSync(path.dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, L.join("\n"), "utf8");
  console.log(`\n[black-box-base-percentile] ${results.length - failed.length}/${results.length} PASS  レポート: ${path.relative(ROOT, REPORT)}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
