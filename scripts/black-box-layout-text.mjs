/**
 * 狭い画面での文字の切れ・はみ出しと、英語の画面への日本語の混入を確かめるブラックボックステスト（2026-11-09）。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-layout-text.mjs
 *
 * 背景（2026-11-04 の点検で見つけて直した不具合）:
 *   - 幅 360〜390px でヘッダーの検索欄が 18〜33px になり、説明（プレースホルダー）が「選」だけに切れていた（#436）。
 *   - 英語の検索欄の説明 2 つが 375px で切れていた（#437）。
 *   - 利き足が日本語の画面でも「Left foot」のままだった（#438・これは new-cards で確認）。
 *   ここでは同じ種類の切れ・混入を、主なページ × 日本語/英語 × 狭い画面でまとめて確かめる。
 *
 * - 隔離したヘッドレス Chrome（scripts/lib/headless-chrome.mjs）で実際に画面を確認する。
 * - 保存データは作らない（表示言語の既存のキーだけを、この隔離した browser の中で切り替える）。
 * - 結果は docs/black-box-tests/layout-text.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "layout-text.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOCALE_KEY = "efootball-team-ai:locale:v1";

const PAGES = [
  "/",
  "/players",
  "/players?position=CF",
  "/players/world/89138556575063",
  "/tier",
  "/compare",
  "/managers",
  "/new-cards",
  "/squads",
  "/squads/templates",
  "/squads/compare",
  "/my-team",
  "/my-builds",
  "/build-inventory",
  "/best-xi",
  "/favorites",
  "/about",
  "/auth/sign-in",
];
const RUNS = [
  { locale: "ja", width: 360 },
  { locale: "ja", width: 390 },
  { locale: "en", width: 360 },
  { locale: "en", width: 390 },
  { locale: "en", width: 1280 },
];

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

/** ページの中で実行する点検。見つかった問題の短い説明の配列を返す。 */
function audit(checkJapanese) {
  const out = [];
  const ctx = document.createElement("canvas").getContext("2d");
  for (const el of document.querySelectorAll("input[placeholder],textarea[placeholder]")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !el.placeholder) continue;
    const cs = getComputedStyle(el);
    if (getComputedStyle(el, "::placeholder").color === "rgba(0, 0, 0, 0)") continue;
    ctx.font = cs.font;
    const textWidth = ctx.measureText(el.placeholder).width;
    const room = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (textWidth > room + 1) out.push(`placeholder "${el.placeholder}" ${Math.round(textWidth)}px > ${Math.round(room)}px`);
  }
  for (const el of document.querySelectorAll("button,a,label,span,p,h1,h2,h3,th,td,dt,dd,li")) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "hidden" && cs.overflowX !== "clip") continue;
    if (cs.textOverflow === "ellipsis") continue;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) {
      out.push(`clipped <${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 40)}"`);
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page wider than viewport (${document.documentElement.scrollWidth} > ${innerWidth})`);
  if (checkJapanese) {
    const text = document.querySelector("main")?.innerText ?? "";
    for (const line of text.split(String.fromCharCode(10))) {
      if (/[぀-ヿ一-鿿]/.test(line)) out.push(`Japanese on the English page: "${line.trim().slice(0, 50)}"`);
    }
  }
  return out.slice(0, 6);
}

async function evalJson(client, expression) {
  const res = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res?.exceptionDetails) throw new Error(`eval exception: ${res.exceptionDetails.text}`);
  return res?.result?.value;
}

async function settle(client) {
  await waitForCondition(
    async () => (await evalJson(client, `document.readyState === "complete" && !document.querySelector('.skeleton,[aria-busy="true"]')`)) === true,
    { timeoutMs: 12000, intervalMs: 200 },
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
}

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client); // ヘッダーの認証状態の表示が実 Supabase へ接続しないようにする

  try {
    for (const { locale, width } of RUNS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
      await client.send("Page.navigate", { url: `${BASE}/about` });
      await settle(client);
      await evalJson(client, `localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`);
      for (const p of PAGES) {
        await client.send("Page.navigate", { url: `${BASE}${p}` });
        await settle(client);
        const lang = await evalJson(client, "document.documentElement.lang");
        const problems = await evalJson(client, `(${audit.toString()})(${locale === "en"})`);
        const langOk = locale === "en" ? /^en/.test(lang ?? "") : true;
        record(
          `${locale} ${width}px ${p}: 文字の切れ・はみ出し${locale === "en" ? "・日本語の混入" : ""}がない`,
          langOk && Array.isArray(problems) && problems.length === 0,
          langOk ? (problems ?? ["evaluation failed"]).join(" / ") : `html lang=${lang}（英語に切り替わっていない）`,
        );
      }
    }
  } finally {
    await evalJson(client, `localStorage.removeItem(${JSON.stringify(LOCALE_KEY)})`).catch(() => {});
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-layout-text] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 狭い画面の文字の切れ・英語の画面への日本語の混入 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（隔離したヘッドレス Chrome。実機ではない）`,
    "",
    "保存データは作らない。表示言語だけをこの隔離した browser の中で切り替える。",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`),
    "",
    `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`,
    "",
  ];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-layout-text] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
