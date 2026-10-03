/**
 * 主要画面のアクセシビリティの機械的な確認（GET と描画だけ・ログインしない・書き込みなし）。
 *
 *   node scripts/a11y-audit.mjs                                   （next start を localhost:3000 で起動済み）
 *   BASE_URL=https://<公開サイト> REPORT_PATH=./data/<folder>/a11y.md node scripts/a11y-audit.mjs
 *
 * 確認すること（画面ごと・desktop 1280 と mobile 390）:
 * - <html lang> がある / <h1> がちょうど 1 つ
 * - <img> に alt がある（装飾は alt="" でよい）
 * - ボタン・リンク・入力に、読み上げの名前（text・aria-label・aria-labelledby・title・<label>）がある
 * - id の重複がない / tabindex が正の値の要素がない
 * 結果は件数と要素の短い説明だけ（本文・利用者のデータは保存しない）。色のコントラストは対象外。
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = process.env.REPORT_PATH ? path.resolve(ROOT, process.env.REPORT_PATH) : null;
if (REPORT && !REPORT.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
if (!REPORT && !BASE.startsWith("http://localhost")) throw new Error("REPORT_PATH is required when BASE_URL is not localhost");

const PAGES = ["/", "/players", "/managers", "/compare", "/squads", "/best-xi", "/favorites", "/my-builds", "/my-team", "/diagnosis-history", "/data-management", "/about", "/terms", "/privacy", "/disclaimer", "/support"];
const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800, mobile: false },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ページ内で評価する（toString で渡す）。 */
function audit() {
  const short = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.getAttribute("href") ? `[href=${el.getAttribute("href").slice(0, 40)}]` : ""}`;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const nameOf = (el) => {
    const t = (el.getAttribute("aria-label") || "").trim();
    if (t) return t;
    const lb = el.getAttribute("aria-labelledby");
    if (lb) return lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && l.textContent.trim()) return l.textContent.trim();
    }
    const wrap = el.closest("label");
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    const txt = (el.innerText || el.textContent || "").trim();
    if (txt) return txt;
    const img = el.querySelector("img[alt]:not([alt=''])");
    if (img) return img.getAttribute("alt");
    if (el.getAttribute("title")) return el.getAttribute("title");
    if (el.getAttribute("placeholder")) return el.getAttribute("placeholder");
    if (el.tagName === "INPUT" && ["submit", "button", "reset"].includes(el.type) && el.value) return el.value;
    return "";
  };
  const problems = [];
  if (!document.documentElement.getAttribute("lang")) problems.push("html: lang missing");
  const h1 = [...document.querySelectorAll("h1")].filter(visible);
  if (h1.length !== 1) problems.push(`h1: ${h1.length} visible (expected 1)`);
  for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) problems.push(`img without alt: ${short(img)} ${String(img.getAttribute("src") ?? "").slice(0, 40)}`);
  for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]")) {
    if (!visible(el)) continue;
    if (!nameOf(el)) problems.push(`no accessible name: ${short(el)}`);
  }
  const ids = new Map();
  for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) problems.push(`duplicate id: ${id} x${n}`);
  for (const el of document.querySelectorAll("[tabindex]")) if (Number(el.getAttribute("tabindex")) > 0) problems.push(`positive tabindex: ${short(el)}`);
  return [...new Set(problems)].slice(0, 20);
}

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  const rows = [];
  const evaluate = async () =>
    (await client.send("Runtime.callFunctionOn", { functionDeclaration: audit.toString(), objectId: (await client.send("Runtime.evaluate", { expression: "globalThis" })).result.objectId, returnByValue: true })).result.value ?? ["evaluation failed"];
  try {
    // 自己確認: 既知の問題を含むページで、検出が働くことを先に確かめる（全部 PASS が「検出していない」ことでないように）。
    const faulty = "<html><body><img src='x.png'><button></button><div id='d'></div><div id='d'></div><a href='/x' tabindex='2'>x</a><input type='text'></body></html>";
    await client.send("Page.navigate", { url: `data:text/html,${encodeURIComponent(faulty)}` });
    await sleep(500);
    const self = await evaluate();
    const expected = ["html: lang missing", "h1: 0 visible", "img without alt", "no accessible name: button", "duplicate id: d", "positive tabindex", "no accessible name: input"];
    const missed = expected.filter((e) => !self.some((p) => p.startsWith(e)));
    if (missed.length) throw new Error(`self-test did not detect: ${missed.join(", ")}`);
    console.log(`self-test: ${expected.length}/${expected.length} known problems detected`);
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      for (const p of PAGES) {
        await client.send("Page.navigate", { url: `${BASE}${p}` });
        let ready = false;
        for (let i = 0; i < 40 && !ready; i++) {
          await sleep(300);
          const r = await client.send("Runtime.evaluate", { expression: "document.readyState === 'complete' && !document.querySelector('.skeleton,[aria-busy=\"true\"]')", returnByValue: true });
          ready = r.result.value === true;
        }
        await sleep(800);
        const r = await client.send("Runtime.callFunctionOn", { functionDeclaration: audit.toString(), executionContextId: undefined, objectId: (await client.send("Runtime.evaluate", { expression: "globalThis" })).result.objectId, returnByValue: true });
        const problems = r.result.value ?? ["evaluation failed"];
        rows.push({ viewport: vp.name, page: p, ok: problems.length === 0, problems });
        console.log(`${problems.length === 0 ? "PASS" : "FAIL"}  [${vp.name}] ${p}${problems.length ? `  — ${problems.slice(0, 3).join(" ; ")}` : ""}`);
      }
    }
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const pass = rows.filter((r) => r.ok).length;
  const lines = [
    "# アクセシビリティの機械的な確認",
    "",
    `対象: ${BASE} / 実行: ${new Date().toISOString()} / 結果: ${pass}/${rows.length} PASS`,
    "",
    "| viewport | page | result | problems |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${r.viewport} | ${r.page} | ${r.ok ? "PASS" : "FAIL"} | ${r.problems.join("<br>").replace(/\|/g, "/")} |`),
  ];
  const out = REPORT ?? path.join(ROOT, "data", "work", "a11y-report.md");
  writeFileSync(out, `${lines.join("\n")}\n`);
  console.log(`\n[a11y-audit] ${pass}/${rows.length} PASS  レポート: ${path.relative(ROOT, out)}`);
  process.exit(pass === rows.length ? 0 : 1);
}

main().catch((e) => {
  console.error(`[a11y-audit] error: ${String(e?.message ?? e).slice(0, 200)}`);
  process.exit(2);
});
