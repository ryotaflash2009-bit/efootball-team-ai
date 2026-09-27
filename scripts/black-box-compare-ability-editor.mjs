/**
 * 比較画面の「能力から育成」（1人ずつの編集モード）ブラックボックス。実ブラウザー・全8 viewport。
 *
 *   BASE_URL=http://localhost:3200 REPORT_PATH=./data/cmp/local.md node scripts/black-box-compare-ability-editor.mjs
 *
 * - 対象サイトへの GET とブラウザー内の操作だけ（保存はこのブラウザーの localStorage）。非GETがあれば失敗。
 * - 2人比較は全 viewport、3人・4人比較は desktop-1280x720 と mobile-390x844。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const REPORT = path.resolve(ROOT, process.env.REPORT_PATH ?? "./data/compare-ability-editor-black-box.md");
if (!REPORT.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
const IDS = ["89138556575063", "88041460996837", "106788187832737", "17592722922839"]; // Messi, Cannavaro, Neuer(GK), near-cap Messi

const VIEWPORTS = [
  { name: "desktop-1280x720", width: 1280, height: 720, dpr: 1, mobile: false, multi: true },
  { name: "desktop-1440x900", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, dpr: 1, mobile: false },
  { name: "tablet-768x1024", width: 768, height: 1024, dpr: 2, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, dpr: 2, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, dpr: 3, mobile: true, multi: true },
  { name: "mobile-393x852", width: 393, height: 852, dpr: 3, mobile: true },
  { name: "mobile-430x932", width: 430, height: 932, dpr: 3, mobile: true },
].filter((v) => !process.env.BB_VIEWPORTS || process.env.BB_VIEWPORTS.split(",").includes(v.name));

const cost = (lv) => { let s = 0; for (let i = 0; i < lv; i++) s += 1 + Math.floor(i / 5); return s; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let current = "";
const record = (name, pass, detail = "") => {
  results.push({ viewport: current, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${current}] ${name}${detail ? "  — " + detail : ""}`);
};

async function run(browser, vp) {
  current = vp.name;
  const tab = await openTab(browser.port, "about:blank");
  const c = connectCDP(tab.webSocketDebuggerUrl);
  await c.ready;
  for (const d of ["Page", "Runtime", "Network"]) await c.send(`${d}.enable`);
  if (IS_LOCAL) await installSupabaseAuthTestDouble(c);
  await c.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, mobile: vp.mobile });
  if (vp.mobile) await c.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const cap = { errors: [], warnings: [], failed: [], s5xx: [], nonGet: [] };
  const urls = new Map();
  c.on("Network.requestWillBeSent", (p) => { urls.set(p.requestId, p.request.url.replace(BASE, "").slice(0, 90)); if (!["GET", "HEAD", "OPTIONS"].includes(p.request.method)) cap.nonGet.push(`${p.request.method} ${p.request.url.replace(BASE, "").slice(0, 60)}`); });
  c.on("Network.responseReceived", (p) => { if (p.response.status >= 500) cap.s5xx.push(`${p.response.status} ${urls.get(p.requestId)}`); });
  c.on("Network.loadingFailed", (p) => { if (!p.canceled) cap.failed.push(`${p.errorText} ${urls.get(p.requestId) ?? ""}`); });
  c.on("Runtime.consoleAPICalled", (p) => { const t = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160); if (p.type === "error") cap.errors.push(t); else if (p.type === "warning") cap.warnings.push(t); });
  c.on("Runtime.exceptionThrown", (p) => cap.errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 160)));

  const ev = async (fn, ...args) => {
    const { result: obj } = await c.send("Runtime.evaluate", { expression: "globalThis", returnByValue: false });
    const r = await c.send("Runtime.callFunctionOn", { objectId: obj.objectId, functionDeclaration: fn.toString(), arguments: args.map((value) => ({ value })), returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
    return r.result.value;
  };
  const waitFor = async (fn, ms = 20000, ...args) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn, ...args)) return true; await sleep(150); } return false; };
  const tap = async (sel) => {
    const q = await ev((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    if (!q) return false;
    await sleep(100);
    const p = await ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    if (vp.mobile) {
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
      await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
      await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    }
    await sleep(200);
    return true;
  };
  const dragTo = async (ratio) => {
    const r = await ev(() => { const e = document.querySelector("[data-testid=compare-ability-sheet] [data-testid=category-slider]"); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2, w: b.width }; });
    const x0 = r.x + 2, x1 = r.x + r.w * ratio;
    if (vp.mobile) {
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: r.y }] });
      for (let i = 1; i <= 8; i++) await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: r.y }] });
      await sleep(80);
      const held = await ev(() => document.querySelector(".cat-slider")?.dataset.blocked);
      await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(200);
      return held;
    }
    await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: r.y, button: "left", clickCount: 1 });
    for (let i = 1; i <= 8; i++) await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / 8, y: r.y, button: "left", buttons: 1 });
    await sleep(80);
    const held = await ev(() => document.querySelector(".cat-slider")?.dataset.blocked);
    await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: r.y, button: "left", clickCount: 1 });
    await sleep(200);
    return held;
  };
  const sheet = () => ev(() => {
    const s = document.querySelector("[data-testid=compare-ability-sheet]");
    const rem = document.querySelector("[data-testid=compare-ability-sheet] [data-testid=remaining-points]")?.textContent ?? "";
    const m = rem.match(/(-?\d+)\s*\/\s*(\d+)/);
    return {
      open: !!s,
      title: s?.querySelector("h2")?.textContent ?? "",
      modal: s?.getAttribute("aria-modal"),
      tabs: s ? [...s.querySelectorAll("[role=tab]")].map((t) => t.getAttribute("aria-selected")) : [],
      others: s?.querySelector("[data-testid=compare-others]")?.textContent ?? "",
      level: Number(document.querySelector("[data-testid=compare-ability-sheet] [data-testid=dock-level]")?.textContent ?? NaN),
      remaining: m ? Number(m[1]) : null,
      dirty: document.querySelector("[data-testid=compare-ability-sheet] [data-testid=save-state]")?.dataset.dirty ?? null,
      notice: document.querySelector("[data-testid=compare-ability-sheet] [data-testid=save-notice]")?.textContent ?? "",
      chip: (g) => g,
      bodyLocked: document.body.style.overflow === "hidden",
    };
  });
  const chipLevel = (g) => ev((id) => Number(document.querySelector(`[data-testid=compare-ability-sheet] [data-group="${id}"] .tabular-nums`)?.textContent), g);
  const tableValue = (label, col) => ev((l, i) => {
    const row = [...document.querySelectorAll("#compare-abilities tr")].find((r) => r.querySelector("td")?.textContent.trim() === l);
    const cells = row ? [...row.querySelectorAll("td")].slice(1) : [];
    return cells[i] ? Number(cells[i].querySelector(".tabular-nums, span")?.textContent.match(/\d+/)?.[0]) : null;
  }, label, col);

  const open = async (n) => {
    await c.send("Page.navigate", { url: `${BASE}/compare?ids=${IDS.slice(0, n).join(",")}` });
    return waitFor(() => document.querySelectorAll("[data-testid=compare-open-ability-editor]").length > 0, 45000);
  };

  // ---- 2人比較 ----
  record("比較画面（2人）に「能力から育成」の入口", await open(2));
  await sleep(800);
  const baseP2 = await tableValue("ボールキープ", 1);
  await tap("[data-testid=compare-open-ability-editor]");
  let s = await sheet();
  record("全画面の編集モード（aria-modal）で、編集中の選手（1人目）を題名に明示・背景スクロール停止", s.open && s.modal === "true" && /リオネル メッシ/.test(s.title) && s.bodyLocked, s.title);
  record("選手の切替タブ（1人目が選択中）", JSON.stringify(s.tabs) === JSON.stringify(["true", "false"]));
  await tap("[data-testid=compare-ability-sheet] [data-stat=tightPossession]");
  s = await sheet();
  record("能力を選ぶと、他の選手の同じ能力値を並べる", /ファビオ カンナヴァーロ/.test(s.others) && s.others.includes(String(baseP2)), s.others.slice(0, 80));
  await tap("[data-testid=compare-ability-sheet] [data-testid=progression-dock] button[aria-label$='上げる']");
  s = await sheet();
  record("＋で1段階（Lv1・残り61）、未保存", s.level === 1 && s.remaining === 61 && s.dirty === "true", `Lv${s.level} 残り${s.remaining}`);
  await dragTo(0.62);
  s = await sheet();
  const L = s.level;
  record("ドラッグで複数段階、残り = 62 − 累積コスト", L >= 6 && L <= 9 && s.remaining === 62 - cost(L), `Lv${L} 残り${s.remaining}`);
  // 選手を切り替え → 戻る（下書きは選手ごとに保持）
  await tap("[data-testid=compare-ability-sheet] [role=tab][aria-selected=false]");
  s = await sheet();
  record("2人目へ切替: 題名が変わり、2人目の配分は0", /ファビオ カンナヴァーロ/.test(s.title) && (await chipLevel("dribbling")) === 0, s.title);
  await tap("[data-testid=compare-ability-sheet] [role=tab][aria-selected=false]");
  record("1人目へ戻ると下書き（ドリブル）を保持", (await chipLevel("dribbling")) === L, `Lv${await chipLevel("dribbling")}`);
  // ポイント不足
  await tap("[data-testid=compare-ability-sheet] [data-stat=tackling]");
  const blocked = await dragTo(0.995);
  s = await sheet();
  record("ポイント不足: 到達可能上限で止まり理由を表示", blocked === "true" && s.remaining >= 0 && s.remaining < 1 + Math.floor(s.level / 5), `Lv${s.level} 残り${s.remaining}`);
  await tap("[data-testid=compare-ability-sheet] [data-testid=dock-revert]");
  // 保存
  await tap("[data-testid=compare-ability-sheet] [data-stat=tightPossession]");
  await tap("[data-testid=compare-ability-sheet] [data-testid=quick-save]");
  s = await sheet();
  record("パネルの「保存」でこの選手のビルドとして保存、保存済みに", s.dirty === "false" && /保存しました/.test(s.notice), s.notice);
  // 閉じる → 比較表に反映（この選手だけ）
  await tap("[data-testid=compare-ability-sheet] [data-testid=dock-done]");
  await tap("[data-testid=compare-ability-sheet] [data-sheet-close]");
  await sleep(300);
  const p1 = await tableValue("ボールキープ", 0);
  const p2 = await tableValue("ボールキープ", 1);
  record("比較へ戻ると表に反映（1人目だけ変わる）", p1 === 86 + L && p2 === baseP2 && !(await sheet()).open && !(await ev(() => document.body.style.overflow === "hidden")), `1人目 ${p1} / 2人目 ${p2}`);
  // 再読込（URL に配分）
  await c.send("Page.reload", {});
  await waitFor(() => document.querySelectorAll("[data-testid=compare-open-ability-editor]").length > 0, 45000);
  await sleep(800);
  record("再読込しても配分を保持（URL）", (await tableValue("ボールキープ", 0)) === 86 + L);
  // Escape で閉じる
  await tap("[data-testid=compare-open-ability-editor]");
  await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
  await sleep(300);
  record("Escape で編集モードを閉じる（パネル未選択時）", !(await sheet()).open);
  // 英語
  await ev(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "English")?.click());
  await sleep(600);
  await tap("[data-testid=compare-open-ability-editor]");
  await tap("[data-testid=compare-ability-sheet] [data-stat=tightPossession]");
  const en = await ev(() => {
    const re = /[぀-ヿ一-龯]/;
    const s = document.querySelector("[data-testid=compare-ability-sheet]");
    if (!s) return ["(編集モードが開いていない)"];
    const found = new Set();
    const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { const t = n.textContent.trim(); if (t && re.test(t) && !n.parentElement.closest("[data-user-content]")) found.add(t.slice(0, 50)); }
    for (const el of s.querySelectorAll("[aria-label],[title],[aria-valuetext]")) for (const a of ["aria-label", "title", "aria-valuetext"]) { const v = el.getAttribute(a); if (v && re.test(v)) found.add(`@${a}:${v.slice(0, 40)}`); }
    return [...found];
  });
  record("英語: 編集モード全体に日本語が無い", en.length === 0, en.slice(0, 4).join(" | "));
  await tap("[data-testid=compare-ability-sheet] [data-testid=dock-done]");
  await tap("[data-testid=compare-ability-sheet] [data-sheet-close]");
  await ev(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "日本語")?.click());
  await sleep(400);
  record("横方向のはみ出し 0", (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);

  // ---- 3人・4人比較 ----
  if (vp.multi) {
    for (const n of [3, 4]) {
      await open(n);
      await sleep(800);
      // 選手タブで n 人目を選び、その選手の入口から開く
      await ev((k) => { const tabs = [...document.querySelectorAll("#compare-cockpit [role=tab]")]; tabs[k - 1]?.click(); }, n);
      await sleep(300);
      await tap("[data-testid=compare-open-ability-editor]");
      s = await sheet();
      record(`${n}人比較: ${n}人目を編集中と明示、タブ${n}個`, s.open && s.tabs.length === n && s.tabs[n - 1] === "true", s.title);
      await tap("[data-testid=compare-ability-sheet] [data-stat=tightPossession]");
      s = await sheet();
      const othersCount = (s.others.match(/\d\. /g) ?? []).length;
      record(`${n}人比較: 他の ${n - 1} 人の値を並べる`, othersCount === n - 1, s.others.slice(0, 90));
      await tap("[data-testid=compare-ability-sheet] [data-testid=dock-done]");
      await tap("[data-testid=compare-ability-sheet] [data-sheet-close]");
    }
  }

  record("console error 0", cap.errors.length === 0, cap.errors.slice(0, 3).join(" | "));
  record("console warning 0", cap.warnings.length === 0, cap.warnings.slice(0, 3).join(" | "));
  record("network error 0", cap.failed.length === 0, cap.failed.slice(0, 3).join(" | "));
  record("HTTP 5xx 0", cap.s5xx.length === 0, cap.s5xx.join(" | "));
  record("非GETリクエスト 0", cap.nonGet.length === 0, cap.nonGet.join(" | "));
  c.close();
  await closeTab(browser.port, tab.id);
}

const browser = await launchIsolatedBrowser();
try {
  for (const vp of VIEWPORTS) {
    try { await run(browser, vp); } catch (e) { record("実行エラー", false, String(e.message).slice(0, 200)); }
  }
} finally {
  await browser.close();
}
const pass = results.filter((r) => r.pass).length;
mkdirSync(path.dirname(REPORT), { recursive: true });
writeFileSync(REPORT, [
  "# 比較画面「能力から育成」ブラックボックス",
  "",
  `実行日時: ${new Date().toISOString()}  対象: ${IS_LOCAL ? BASE : "公開サイト"}`,
  "",
  `**${pass}/${results.length} PASS**`,
  "",
  "| 結果 | viewport | 項目 | 詳細 |",
  "|---|---|---|---|",
  ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.viewport} | ${r.name} | ${String(r.detail).replace(/\|/g, "/")} |`),
  "",
].join("\n"));
writeFileSync(REPORT.replace(/\.md$/, ".summary.json"), JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, failures: results.filter((r) => !r.pass) }, null, 2));
console.log(`\n${pass}/${results.length} PASS`);
process.exitCode = pass === results.length ? 0 : 1;
