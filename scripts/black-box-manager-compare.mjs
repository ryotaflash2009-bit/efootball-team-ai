#!/usr/bin/env node
/**
 * 監督の比較（NEW-23・/managers/compare）の black-box（2026-10-07）。
 * 8 つの画面の幅 × 日本語・英語で、比較の表・最高の印・ページの横はみ出しなし・JS のエラーなし・英語のタブの題名を確かめる。
 *   BASE_URL=http://localhost:3000 node scripts/black-box-manager-compare.mjs
 * 読み取りだけ（データの書き込みなし）。分離した一時の Chrome のプロファイルを使う。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const LOCALE_KEY = "efootball-team-ai:locale:v1";
const VIEWPORTS = [
  [320, 640, true], [360, 740, true], [390, 844, true], [430, 932, true],
  [768, 1024, true], [1024, 768, false], [1280, 800, false], [1920, 1080, false],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await fetch(`${BASE}/api/managers?pageSize=3&sort=name`).then((r) => r.json());
const ids = list.managers.map((m) => m.internalManagerId);
if (ids.length < 2) {
  console.error("[manager-compare] 監督のデータが 2 人未満のため確認できません");
  process.exit(1);
}
const url = `${BASE}/managers/compare?ids=${ids.join(",")}`;

const browser = await launchIsolatedBrowser();
const tab = await openTab(browser.port, "about:blank");
const client = connectCDP(tab.webSocketDebuggerUrl);
const errors = [];
client.on?.("Runtime.exceptionThrown", (e) => errors.push(String(e.exceptionDetails?.exception?.description ?? e.exceptionDetails?.text ?? "exception").slice(0, 300)));
await client.send("Runtime.enable");
await client.send("Page.enable");
const evaluate = async (expression) => (await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

let pass = 0;
const failures = [];
try {
  await client.send("Page.navigate", { url: `${BASE}/managers` });
  await sleep(1500);
  for (const locale of ["ja", "en"]) {
    await evaluate(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`);
    for (const [width, height, mobile] of VIEWPORTS) {
      const name = `${locale}@${width}`;
      await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
      errors.length = 0;
      await client.send("Page.navigate", { url });
      let state = null;
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        state = await evaluate(`(() => {
          const table = document.querySelector('[data-testid="manager-compare-table"]');
          if (!table) return null;
          return {
            managerLinks: table.querySelectorAll('a[href^="/managers/"]').length,
            stars: [...table.querySelectorAll('span')].filter((s) => s.textContent === '★').length,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            title: document.title,
            heading: document.querySelector('h1')?.textContent ?? '',
          };
        })()`);
        if (state && (locale === "ja" || /Compare managers/.test(state.title))) break;
      }
      const problems = [];
      if (!state) problems.push("比較の表がない");
      else {
        if (state.managerLinks !== ids.length) problems.push(`監督の数 ${state.managerLinks} ≠ ${ids.length}`);
        if (state.stars < 1) problems.push("最高の印がない");
        if (state.overflow > 1) problems.push(`ページの横はみ出し ${state.overflow}px`);
        if (locale === "en" && !/^Compare managers \| TeamAIXI$/.test(state.title)) problems.push(`英語の題名 ${state.title}`);
        if (locale === "en" && state.heading !== "Compare managers") problems.push(`英語の見出し ${state.heading}`);
        if (locale === "ja" && state.heading !== "監督の比較") problems.push(`日本語の見出し ${state.heading}`);
      }
      if (errors.length) problems.push(`JS のエラー ${errors.join(" / ")}`);
      if (problems.length) failures.push(`${name}: ${problems.join("・")}`);
      else pass++;
    }
  }
} finally {
  await closeTab(browser.port, tab.id).catch(() => {});
  client.close();
  await browser.close();
}
console.log(`[manager-compare] ${pass}/${VIEWPORTS.length * 2} PASS (ids=${ids.join(",")})`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
