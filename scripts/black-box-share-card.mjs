/**
 * F-041b 診断カードの比率・プレビュー・保存・OS 共有のブラックボックス（ローカル専用）。
 *
 *   node scripts/black-box-share-card.mjs            （next start を localhost:3000 で起動済み）
 *
 * - 隔離ブラウザーの guest 領域へ最小のスカッド（合成）を置き、/squads/<id> の診断カードを操作する。
 * - 4 比率のプレビュー画像の実寸（PNG の画素数）、保存（実際のダウンロード）、プレビューの Object URL の解放、
 *   Web Share API（ページ内で模擬: 成功・取り消し・非対応）を確認する。8 viewport × 日英。
 * - サーバー・DB・Production へは書き込まない。
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error("local only: BASE_URL must be http://localhost:<port>");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "share-card.md");
const DL = path.join(ROOT, "data", "work", "bb-share-card");
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
const EXPECTED = { "3:4": [1440, 1920], "1:1": [1920, 1920], "9:16": [1440, 2560], "16:9": [2560, 1440] };
const SQUAD_ID = "sq_bbsharecard01";
const LOCALE_KEY = "efootball-team-ai:locale:v1";
function fixtureSquad() {
  const now = new Date().toISOString();
  return {
    squadId: SQUAD_ID, squadName: "BB Share Card とても長いスカッド名のテスト用の名前です", formationId: "4-3-3", managerId: null, slots: [], substitutes: [], captainSlotId: null,
    setPieces: { corners: null, freeKicks: null, penalties: null }, linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    rulesVersion: "progression/2026-08-28.v2", schemaVersion: 1, createdAt: now, updatedAt: now,
  };
}
// Object URL の作成・解放の数と、Web Share の模擬（window.__shareMode: "ok" | "abort" | "none"）。
const INSTRUMENT = `(() => {
  window.__urls = { created: 0, revoked: 0 };
  const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (b) => { window.__urls.created++; return c(b); };
  URL.revokeObjectURL = (u) => { window.__urls.revoked++; return r(u); };
  const mode = localStorage.getItem("__bb_share_mode") || "none";
  if (mode !== "none") {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { if (mode === "abort") { const e = new Error("cancel"); e.name = "AbortError"; throw e; } window.__shared = (window.__shared || 0) + 1; } });
  } else {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
  }
})()`;

let client;
let errors = [];
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.text}`);
  return r.result.value;
}
async function waitFor(fn, ms, label) {
  const until = Date.now() + ms;
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
  await sleep(800);
}
const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
async function step(vp, locale, op, fn) {
  errors = [];
  let res;
  try {
    res = await fn();
  } catch (e) {
    res = { ok: false, detail: e.message };
  }
  const problems = [];
  if (!res.ok) problems.push(res.detail || "check failed");
  try {
    const overflow = await ev("document.documentElement.scrollWidth - window.innerWidth");
    if (overflow > 0) problems.push(`horizontal overflow ${overflow}px`);
  } catch {
    /* 遷移中 */
  }
  if (errors.length) problems.push(`console/exception: ${errors[0]}`);
  const row = { viewport: vp.name, locale, op, ok: problems.length === 0, detail: problems.length ? problems.join(" ; ") : res.detail || "" };
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"}  [${vp.name} ${locale}] ${op}${row.detail ? `  — ${row.detail}` : ""}`);
}

async function main() {
  if (existsSync(DL)) for (const f of readdirSync(DL)) rmSync(path.join(DL, f));
  mkdirSync(DL, { recursive: true });
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  for (const d of ["Page", "Runtime", "Log"]) await client.send(`${d}.enable`);
  await installSupabaseAuthTestDouble(client);
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: INSTRUMENT });
  await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL }).catch(() => client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL }));
  client.on("Runtime.exceptionThrown", (p) => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 200)));
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") errors.push((p.args ?? []).map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  });

  const openOptions = async () => {
    await waitFor(() => has("[data-testid=share-card] details summary"), 15000, "share card");
    await ev(`(() => { const d = document.querySelector('[data-testid=share-card] details'); if (!d.open) d.querySelector('summary').click(); })()`);
  };
  const previewSize = () => ev(`(() => { const i = document.querySelector('[data-testid=share-card-preview] img'); return i && i.complete && i.naturalWidth ? [i.naturalWidth, i.naturalHeight] : null; })()`);

  try {
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      for (const locale of ["ja", "en"]) {
        await nav("/");
        await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)}); localStorage.setItem("__bb_share_mode", "none"); localStorage.setItem("efootball-team-ai:local:guest:squads:v1", ${JSON.stringify(JSON.stringify([fixtureSquad()]))})`);

        await step(vp, locale, "4 ratios: preview pixel sizes, selection state, URLs revoked", async () => {
          await nav(`/squads/${SQUAD_ID}`);
          await openOptions();
          const sizes = [];
          for (const [ratio, [w, h]] of Object.entries(EXPECTED)) {
            await ev(`document.querySelector('[data-testid=share-card] [data-ratio="${ratio}"]').click()`);
            await waitFor(async () => {
              const s = await previewSize();
              return s && s[0] === w && s[1] === h;
            }, 10000, `preview ${ratio}`);
            const checked = await ev(`document.querySelector('[data-testid=share-card] [data-ratio="${ratio}"]').getAttribute('aria-checked')`);
            if (checked !== "true") throw new Error(`${ratio} not checked`);
            const overflowImg = await ev(`(() => { const i = document.querySelector('[data-testid=share-card-preview] img'); return i.getBoundingClientRect().right - document.documentElement.clientWidth; })()`);
            if (overflowImg > 0) throw new Error(`preview overflows by ${overflowImg}px`);
            sizes.push(`${ratio}=${w}x${h}`);
          }
          await ev(`document.querySelector('[data-testid=share-card] details summary').click()`);
          await sleep(300);
          const u = await ev("window.__urls");
          return { ok: u.created === u.revoked && u.created >= 4, detail: `${sizes.join(" ")}; urls ${u.created}/${u.revoked}` };
        });

        if (vp.name !== "desktop-1280x720" && vp.name !== "mobile-390x844") continue;

        await step(vp, locale, "save downloads a PNG with the ratio in the file name; share hidden when unsupported", async () => {
          for (const f of readdirSync(DL)) rmSync(path.join(DL, f));
          await nav(`/squads/${SQUAD_ID}`);
          await openOptions();
          await ev(`document.querySelector('[data-testid=share-card] [data-ratio="9:16"]').click()`);
          if (await has("[data-testid=share-card-share]")) throw new Error("share shown without Web Share");
          await ev(`document.querySelector('[data-testid=share-card-save]').click()`);
          await waitFor(() => readdirSync(DL).some((f) => f.endsWith(".png")), 10000, "download");
          const f = readdirSync(DL).find((x) => x.endsWith(".png"));
          if (!/^efootball-team-ai-squad-diagnosis-.+-9x16\.png$/.test(f)) throw new Error(`file name ${f}`);
          return { ok: true, detail: f.replace(/-\d{8}.*/, "…") };
        });

        await step(vp, locale, "OS share: success shows shared; cancel is not an error", async () => {
          await ev(`localStorage.setItem("__bb_share_mode", "ok")`);
          await nav(`/squads/${SQUAD_ID}`);
          await waitFor(() => has("[data-testid=share-card-share]"), 10000, "share button");
          await ev(`document.querySelector('[data-testid=share-card-share]').click()`);
          await waitFor(async () => (await ev("window.__shared || 0")) === 1, 10000, "shared");
          await waitFor(async () => (await ev(`document.querySelector('[data-testid=share-card] [role=status]')?.innerText ?? ''`)).length > 0, 5000, "shared message");
          await ev(`localStorage.setItem("__bb_share_mode", "abort")`);
          await nav(`/squads/${SQUAD_ID}`);
          await waitFor(() => has("[data-testid=share-card-share]"), 10000, "share button");
          await ev(`document.querySelector('[data-testid=share-card-share]').click()`);
          await sleep(1500);
          const alert = await has("[data-testid=share-card] [role=alert]");
          await ev(`localStorage.setItem("__bb_share_mode", "none")`);
          return { ok: !alert, detail: "shared once; cancel silent" };
        });
      }
    }
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
    if (existsSync(DL)) for (const f of readdirSync(DL)) rmSync(path.join(DL, f));
  }

  const failed = results.filter((r) => !r.ok);
  const L = [
    "# F-041b 診断カード（比率・プレビュー・保存・OS 共有） ブラックボックス",
    "",
    `実行日時: ${new Date().toISOString()}`,
    "対象: localhost（Production Build）。隔離ブラウザーの guest 領域の合成スカッドだけ。Web Share はページ内の模擬。",
    "",
    "| 結果 | viewport | locale | 確認 | 詳細 |",
    "|---|---|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.viewport} | ${r.locale} | ${escapeMarkdownCell(r.op)} | ${escapeMarkdownCell(String(r.detail))} |`),
    "",
    `## 判定: ${results.length - failed.length}/${results.length} PASS`,
    "",
  ];
  writeFileSync(REPORT, L.join("\n"), "utf8");
  console.log(`\n[black-box-share-card] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
