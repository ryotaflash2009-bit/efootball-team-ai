/**
 * 公開サイト/ローカルの総合ブラックボックス(全主要画面 × 8 viewport + 操作 + 性能 + 公開範囲)。
 *
 *   node scripts/public-black-box-full.mjs                                (next start を localhost:3000 で起動済み)
 *   BASE_URL=https://<公開サイト> REPORT_PATH=./data/<folder>/report.md EXPECT_WORLD=13297 EXPECT_MANAGERS=67 \
 *     node scripts/public-black-box-full.mjs
 *
 * - GET/HEADと、サーバー側のユーザーデータへ書き込まないブラウザー操作だけを行う(ログインしない。
 *   認証表示は既存のテストダブルで実Supabase Authへ接続させない。削除・保存ボタンは押さない)。
 * - ブラウザーは既存helperの隔離プロファイル(OS一時領域)で起動し、終了時に破棄する。
 * - HTTP 200だけで合格にしない: 画面ごとの構造・identity・件数・not-found信号を確認する。
 * - 結果は要約だけ(route・操作・viewport・pass/fail・件数・時間)。HTML・API本文・行データは保存しない。
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = (() => {
  const custom = process.env.REPORT_PATH;
  if (!custom) {
    if (!IS_LOCAL) throw new Error("REPORT_PATH is required when BASE_URL is not localhost");
    return path.join(ROOT, "docs", "black-box-tests", "public-black-box-full.md");
  }
  const p = path.resolve(ROOT, custom);
  if (!p.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
  return p;
})();
const ONLY_VP = process.env.BB_VIEWPORTS ? process.env.BB_VIEWPORTS.split(",") : null;

const VIEWPORTS = [
  { name: "desktop-1280x720", width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
  { name: "tablet-768x1024", width: 768, height: 1024, deviceScaleFactor: 2, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, deviceScaleFactor: 2, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-393x852", width: 393, height: 852, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-430x932", width: 430, height: 932, deviceScaleFactor: 3, mobile: true },
].filter((v) => !ONLY_VP || ONLY_VP.includes(v.name));

const T = {
  notFound: "ページが見つかりません",
  pageError: "ページの表示中にエラーが発生しました",
  rejected: "この検索語では検索できません",
  playersTitleJa: "プレイヤー",
  playersTitleEn: "Players",
  worldImported: "World 取り込み日時",
};
// 画面テキストに出てはいけないもの(内部情報・秘密・生のエラー)。
const LEAK_RE = /sb_secret_|service_role|postgres(ql)?:\/\/|SUPABASE_[A-Z_]+|PGRST\d|PostgREST|supabase\.co|WORLD_QUERY_FAILED|stack trace|\n\s+at [\w.<>]+ \(|pre-apply\/|\.age\b|ilike\.|\bor=\(|[0-9a-f]{64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|DROP TABLE/i;
const HYDRATION_RE = /hydrat|Minified React error #(418|423|425)|did not match/i;

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Number(n).toLocaleString("en-US");

// ---------------------------------------------------------------------------
// ページ内で実行する関数(toStringで渡す)
// ---------------------------------------------------------------------------
function pageSettled() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const sk = [...document.querySelectorAll(".skeleton,[aria-busy='true']")].filter(visible).length;
  return document.readyState === "complete" && sk === 0;
}

function layoutAudit(mobile) {
  const W = innerWidth;
  const H = innerHeight;
  const out = { overflow: document.documentElement.scrollWidth - W, outside: [], covered: [], smallTargets: [], h1: null, h1Covered: false, headerBlocksContent: false };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width <= 0 || r.height <= 0 || s.visibility === "hidden" || s.display === "none" || el.closest("[inert],[aria-hidden='true']")) return false;
    // 閉じた<details>の中身は描画されない(Chromeは位置を返すが表示・操作できない)。summaryは除く。
    const closed = el.closest("details:not([open])");
    return !closed || !!el.closest("summary");
  };
  const srOnly = (el) => {
    const r = el.getBoundingClientRect();
    return r.width <= 1 || r.height <= 1 || getComputedStyle(el).clip === "rect(0px, 0px, 0px, 0px)";
  };
  const inHScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if ((s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden") && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  const controls = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,[role=button]")].filter((el) => visible(el) && !srOnly(el));
  scrollTo(0, 0);
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !inHScroller(el)) out.outside.push(label(el));
  }
  // 覆われた操作要素(fixed header・重なり): viewport内にある要素の中心が、その要素自身(または子/親label)に当たること。
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > H || r.left < 0 || r.right > W || inHScroller(el)) continue;
    const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (!hit) continue;
    if (hit === el || el.contains(hit) || hit.contains(el) || (hit.closest("label") && hit.closest("label").contains(el))) continue;
    out.covered.push(label(el));
  }
  // タップ対象(WCAG 2.5.8: 24px。文中のリンクと、24pxの円が他の対象と重ならない場合は例外)。
  if (mobile) {
    const rects = controls.map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (const { el, r } of rects) {
      if (Math.min(r.width, r.height) >= 24) continue;
      // labelで包まれた入力は、label全体がタップ対象(WCAGの対象領域)。
      const lab = el.closest("label");
      if (lab) {
        const lr = lab.getBoundingClientRect();
        if (Math.min(lr.width, lr.height) >= 24) continue;
      }
      const parent = el.parentElement;
      const inline = el.tagName === "A" && parent && /^(P|LI|SPAN|DD|TD)$/.test(parent.tagName) && parent.textContent.trim().length > el.textContent.trim().length + 3;
      if (inline) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const clash = rects.some((o) => o.el !== el && !o.el.contains(el) && !el.contains(o.el) && Math.hypot(Math.max(o.r.left - cx, 0, cx - o.r.right), Math.max(o.r.top - cy, 0, cy - o.r.bottom)) < 12);
      if (clash) out.smallTargets.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  const h1 = document.querySelector("main h1, h1");
  if (h1 && visible(h1)) {
    out.h1 = h1.textContent.trim().replace(/\s+/g, " ").slice(0, 80);
    const r = h1.getBoundingClientRect();
    if (r.top >= 0 && r.top < H) {
      const hit = document.elementFromPoint(Math.min(W - 1, r.left + Math.min(r.width, 40) / 2), r.top + r.height / 2);
      out.h1Covered = !!hit && hit !== h1 && !h1.contains(hit) && !hit.contains(h1);
    }
  }
  out.outside = [...new Set(out.outside)].slice(0, 5);
  out.covered = [...new Set(out.covered)].slice(0, 5);
  out.smallTargets = [...new Set(out.smallTargets)].slice(0, 8);
  return out;
}

function pageText() {
  return document.body ? document.body.innerText : "";
}

function worldCardIds() {
  return [...new Set([...document.querySelectorAll("main a[href^='/players/world/']")].map((a) => a.getAttribute("href").split("?")[0].split("/").pop()))];
}

function managerCardIds() {
  return [...new Set([...document.querySelectorAll("main a[href^='/managers/']")].map((a) => a.getAttribute("href").split("?")[0].split("/").pop()))];
}

// ---------------------------------------------------------------------------
// CDP
// ---------------------------------------------------------------------------
let client;
let cap;
function resetCap() {
  cap = { consoleErrors: [], warnings: [], exceptions: [], failed: [], s4xx: [], s5xx: [], offOrigin: [], reqs: [] };
}
resetCap();
const call = (fn, ...args) => `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(",")})`;
async function ev(expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`page eval: ${r.exceptionDetails.exception?.description?.split("\n")[0] ?? r.exceptionDetails.text}`);
  return r.result?.value;
}
const run = (fn, ...args) => ev(call(fn, ...args));
const locationPath = () => ev("location.pathname + location.search");

async function waitFor(predicate, timeoutMs = 15000, label = "condition") {
  const s = Date.now();
  while (Date.now() - s < timeoutMs) {
    if (await predicate().catch(() => false)) return Date.now() - s;
    await sleep(120);
  }
  throw new Error(`timeout: ${label}`);
}
async function settle(timeoutMs = 20000) {
  const s = Date.now();
  await waitFor(() => run(pageSettled), timeoutMs, "loading/skeleton finished");
  await sleep(250);
  return Date.now() - s;
}
async function nav(p) {
  await client.send("Page.navigate", { url: `${BASE}${p}` });
  await sleep(150);
  return settle();
}
async function click(selectorExpr, label) {
  const ok = await ev(`(() => { const el = ${selectorExpr}; if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true; })()`);
  if (!ok) throw new Error(`not found: ${label}`);
}
async function typeInto(selector, text) {
  const ok = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({ block: "center" }); el.focus(); el.select && el.select(); return true; })()`);
  if (!ok) throw new Error(`input not found: ${selector}`);
  await client.send("Input.insertText", { text });
}
async function selectOption(selector, pickExpr) {
  const v = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const opts = [...el.options].map((o) => o.value);
    const value = (${pickExpr})(opts, el.value);
    if (value == null) return null;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return value;
  })()`);
  if (v == null) throw new Error(`select not usable: ${selector}`);
  return v;
}
async function selectVisible(selector) {
  return ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
}

function dupCount(list) {
  const seen = new Map();
  for (const x of list) seen.set(x, (seen.get(x) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} x${n}`);
}

async function step(vp, route, op, fn, { allow4xx = [], audit = true } = {}) {
  resetCap();
  const started = Date.now();
  let res = { ok: true, detail: "" };
  let layout = null;
  try {
    res = (await fn()) ?? res;
    if (audit) layout = await run(layoutAudit, vp.mobile);
  } catch (e) {
    res = { ok: false, detail: `error: ${String(e.message).slice(0, 160)}` };
  }
  await sleep(200);
  let text = "";
  try {
    text = await run(pageText);
  } catch {
    /* 遷移中 */
  }
  const problems = [];
  if (!res.ok) problems.push(res.detail || "check failed");
  if (cap.consoleErrors.length) problems.push(`console error: ${cap.consoleErrors[0]}`);
  if (cap.exceptions.length) problems.push(`exception: ${cap.exceptions[0]}`);
  if (cap.warnings.length) problems.push(`console warning: ${cap.warnings[0]}`);
  if (cap.failed.length) problems.push(`network error: ${cap.failed[0]}`);
  if (cap.s5xx.length) problems.push(`5xx: ${cap.s5xx[0]}`);
  const u4 = cap.s4xx.filter((s) => !allow4xx.some((re) => re.test(s)));
  if (u4.length) problems.push(`unexpected 4xx: ${u4[0]}`);
  if (cap.offOrigin.length) problems.push(`off-origin request: ${cap.offOrigin[0]}`);
  const dupApi = dupCount(cap.reqs.filter((r) => r.path.startsWith("/api/") && r.type !== "Image").map((r) => r.path));
  if (dupApi.length) problems.push(`duplicate API request: ${dupApi[0]}`);
  if (LEAK_RE.test(text)) problems.push(`internal information shown: ${LEAK_RE.exec(text)[0].slice(0, 30)}`);
  if (text.includes(T.pageError)) problems.push("error boundary shown");
  if ([...cap.consoleErrors, ...cap.exceptions].some((m) => HYDRATION_RE.test(m))) problems.push("hydration mismatch");
  if (layout) {
    if (layout.overflow > 0) problems.push(`horizontal overflow ${layout.overflow}px`);
    if (layout.outside.length) problems.push(`controls outside viewport: ${layout.outside.join(" | ")}`);
    if (layout.covered.length) problems.push(`controls covered: ${layout.covered.join(" | ")}`);
    if (layout.smallTargets.length) problems.push(`small tap targets: ${layout.smallTargets.join(" | ")}`);
    if (layout.h1Covered) problems.push("heading covered by fixed header");
  }
  const row = {
    viewport: vp.name,
    route,
    op,
    ok: problems.length === 0,
    ms: Date.now() - started,
    requests: cap.reqs.length,
    consoleErrors: cap.consoleErrors.length + cap.exceptions.length,
    warnings: cap.warnings.length,
    networkErrors: cap.failed.length,
    http5xx: cap.s5xx.length,
    unexpected4xx: u4.length,
    overflow: layout ? Math.max(0, layout.overflow) : null,
    detail: problems.length ? problems.join(" ; ") : res.detail || "",
  };
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"}  [${vp.name}] ${route} ${op}${row.detail ? `  — ${row.detail}` : ""}`);
  return row;
}

// ---------------------------------------------------------------------------
// 期待値(公開APIから取得。値はレポートへ出さない)
// ---------------------------------------------------------------------------
async function getJson(p) {
  const r = await fetch(`${BASE}${p}`, { signal: AbortSignal.timeout(30000) });
  if (r.status !== 200) throw new Error(`${p} -> ${r.status}`);
  return r.json();
}

async function main() {
  const world = await getJson("/api/world/players?pageSize=4");
  const managers = await getJson("/api/managers?pageSize=1");
  const EXPECT_WORLD = Number(process.env.EXPECT_WORLD ?? world.totalCount);
  const EXPECT_MANAGERS = Number(process.env.EXPECT_MANAGERS ?? managers.totalCount);
  const ids = world.players.map((p) => p.worldCardId);
  const firstPlayer = world.players[0];
  const firstManager = managers.managers[0];
  const managerQuery = String(firstManager.nameEn || firstManager.nameJa || "a").slice(0, 3);

  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  for (const d of ["Page", "Runtime", "Network", "Log", "Performance"]) await client.send(`${d}.enable`);
  await client.send("Emulation.setTimezoneOverride", { timezoneId: process.env.GATE_BROWSER_TZ ?? "Asia/Tokyo" });
  await installSupabaseAuthTestDouble(client);

  const fmtArgs = (p) => (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").replace(/\s+/g, " ").slice(0, 200);
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error" || p.type === "assert") cap.consoleErrors.push(fmtArgs(p));
    else if (p.type === "warning") cap.warnings.push(fmtArgs(p));
  });
  client.on("Runtime.exceptionThrown", (p) => cap.exceptions.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception").split("\n")[0].slice(0, 200)));
  client.on("Log.entryAdded", (p) => {
    // networkの失敗はNetworkイベントで数える(4xxの"Failed to load resource"を二重に数えない)。
    if (p.entry.source === "network") return;
    if (p.entry.level === "error") cap.consoleErrors.push(`[${p.entry.source}] ${String(p.entry.text).slice(0, 200)}`);
    else if (p.entry.level === "warning" && p.entry.source !== "other") cap.warnings.push(`[${p.entry.source}] ${String(p.entry.text).slice(0, 200)}`);
  });
  const reqInfo = new Map();
  client.on("Network.requestWillBeSent", (p) => {
    const url = p.request?.url ?? "";
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (!url.startsWith(BASE)) {
      cap.offOrigin.push(url.split("?")[0].replace(/^https?:\/\/([^/]+).*/, "$1"));
      return;
    }
    const u = new URL(url);
    reqInfo.set(p.requestId, { path: u.pathname, type: p.type });
    cap.reqs.push({ path: u.pathname + (u.pathname.startsWith("/api/") ? u.search : ""), type: p.type });
  });
  client.on("Network.responseReceived", (p) => {
    const url = p.response?.url ?? "";
    if (!url.startsWith(BASE)) return;
    const u = new URL(url);
    const s = p.response.status;
    const tag = `${s} ${p.type} ${u.pathname}`;
    if (s >= 500) cap.s5xx.push(tag);
    else if (s >= 400) cap.s4xx.push(tag);
  });
  client.on("Network.loadingFailed", (p) => {
    if (p.canceled || /ERR_ABORTED/.test(p.errorText ?? "")) return;
    const info = reqInfo.get(p.requestId);
    cap.failed.push(`${p.errorText} ${info ? info.path : ""}`);
  });

  const hasText = async (s) => (await run(pageText)).includes(s);
  const expectText = async (s, label = s) => {
    if (!(await hasText(s))) throw new Error(`missing: ${label}`);
  };
  const notFoundCheck = async () => {
    // HTTP 200のstreaming soft-404も含め、not-foundの画面(タイトル)を必須にする。
    await expectText(T.notFound, "not-found view");
    return { ok: true, detail: "not-found view" };
  };

  // route → 期待する構造・identity
  const ROUTES = [
    ["/", async () => {
      await expectText(fmt(EXPECT_WORLD), `World count ${fmt(EXPECT_WORLD)}`);
      await expectText(T.worldImported);
      return { ok: true, detail: `World ${fmt(EXPECT_WORLD)}` };
    }],
    ["/players", async () => {
      const n = (await run(worldCardIds)).length;
      if (n < 1) throw new Error("no player cards");
      await expectText(`${fmt(EXPECT_WORLD)} 件中`, "total range");
      return { ok: true, detail: `${n} cards` };
    }],
    [`/players/world/${firstPlayer.worldCardId}`, async () => {
      const name = firstPlayer.nameJa || firstPlayer.nameEn;
      const t = await run(pageText);
      if (!t.includes(name) && !t.includes(firstPlayer.nameEn)) throw new Error("player identity not shown");
      if (/全 [0-9,]+ 中の順位/.test(t)) throw new Error("ambiguous rank total label");
      return { ok: true, detail: `identity ok${t.includes("順位集計時点") ? ", rank total labeled" : ""}` };
    }],
    ["/managers", async () => {
      await expectText(`${EXPECT_MANAGERS}`, "managers count");
      if ((await run(managerCardIds)).length < 1) throw new Error("no manager cards");
      await expectText("取り込み", "managers import date");
      return { ok: true, detail: `managers ${EXPECT_MANAGERS}` };
    }],
    [`/managers/${firstManager.internalManagerId}`, async () => {
      const t = await run(pageText);
      if (!t.includes(firstManager.nameJa || firstManager.nameEn) && !t.includes(firstManager.nameEn)) throw new Error("manager identity not shown");
      return { ok: true, detail: "identity ok" };
    }],
    ["/compare", null],
    ["/squads", null],
    ["/squads/templates", null],
    ["/squads/compare", null],
    ["/best-xi", null],
    ["/favorites", null],
    ["/my-team", null],
    ["/my-builds", null],
    ["/build-inventory", null],
    ["/support", async () => {
      for (const href of ["/terms", "/privacy"]) if (!(await ev(`!!document.querySelector('a[href="${href}"]')`))) throw new Error(`no link to ${href}`);
      return { ok: true, detail: "legal links present" };
    }],
    ["/terms", null],
    ["/privacy", null],
    ["/disclaimer", null],
    ["/about", null],
    ["/data-management", async () => {
      const t = await run(pageText);
      if (/Production|本番DB|service role/i.test(t)) throw new Error("production management text shown");
      return { ok: true, detail: "local data management only" };
    }],
    ["/auth/sign-in", null],
    ["/auth/sign-up", null],
    ["/auth/forgot-password", null],
    ["/this-page-does-not-exist", notFoundCheck, [/^404 Document \/this-page-does-not-exist$/]],
    ["/players/world/999999999999999999", notFoundCheck, [/^404 Document \/players\/world\/999999999999999999$/]],
    ["/account/rls-test", notFoundCheck, [/^404 Document \/account\/rls-test$/]],
    ["/release-readiness", notFoundCheck, [/^404 Document \/release-readiness$/]],
  ];

  for (const vp of VIEWPORTS) {
    await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: vp.mobile });

    for (const [route, check, allow4xx] of ROUTES) {
      await step(vp, route, "view", async () => {
        await nav(route);
        const h1 = await ev("(document.querySelector('main h1, h1')||{}).textContent||''");
        if (!check && !h1.trim()) throw new Error("no page heading");
        return check ? check() : { ok: true, detail: `h1 ok` };
      }, { allow4xx: allow4xx ?? [] });
    }

    // 末尾スラッシュ: 公開ページは正規URLへ、内部ページは最終404。
    await step(vp, "/players/", "trailing slash", async () => {
      await nav("/players/");
      const p = await locationPath();
      if (p !== "/players") throw new Error(`ended at ${p}`);
      if ((await run(worldCardIds)).length < 1) throw new Error("no cards");
      return { ok: true, detail: "→ /players" };
    });
    for (const internal of ["/account/rls-test/", "/release-readiness/"]) {
      await step(vp, internal, "trailing slash", async () => {
        await nav(internal);
        return notFoundCheck();
      }, { allow4xx: [/^404 Document \/(account\/rls-test|release-readiness)$/] });
    }

    // ---- 操作 ----
    await step(vp, "/players", "language ja→en→ja", async () => {
      await nav("/players");
      const btnEn = `[...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.trim() === "English" && b.getBoundingClientRect().width > 0)`;
      const btnJa = `[...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.trim() === "日本語" && b.getBoundingClientRect().width > 0)`;
      if (!(await ev(`!!(${btnEn})`))) {
        // モバイル: メニューの中にある場合は開く
        await click(`document.querySelector("header button[aria-expanded='false']")`, "menu toggle");
        await sleep(300);
      }
      await click(btnEn, "English button");
      await waitFor(async () => (await ev("(document.querySelector('main h1')||{}).textContent||''")).includes(T.playersTitleEn), 5000, "English heading");
      const stored = await ev(`localStorage.getItem("efootball-team-ai:locale:v1")`);
      await click(btnJa, "日本語 button");
      await waitFor(async () => (await ev("(document.querySelector('main h1')||{}).textContent||''")).includes(T.playersTitleJa), 5000, "Japanese heading");
      await ev(`document.querySelector("header button[aria-expanded='true']")?.click()`);
      return { ok: stored === "en", detail: stored === "en" ? "switched and restored" : "locale not persisted" };
    });

    const searchCases = [
      ["ja", "メッシ", true],
      ["en", "Messi", true],
      ["unicode", "Müller", false],
      ["symbols", "100%_'\"<>&", false],
    ];
    for (const [kind, q, mustHit] of searchCases) {
      await step(vp, "/players", `search ${kind}`, async () => {
        await nav("/players");
        await typeInto("main input[aria-label='選手を検索']", q);
        await waitFor(async () => new URL(await ev("location.href")).searchParams.get("q") === q, 8000, "q in URL");
        await settle();
        const n = (await run(worldCardIds)).length;
        const t = await run(pageText);
        if (t.includes(T.rejected)) throw new Error("normal search was rejected");
        if (mustHit && n < 1) throw new Error("no results");
        return { ok: true, detail: `${n} results` };
      });
    }
    await step(vp, "header search", "submit with Enter", async () => {
      await nav("/");
      await typeInto("header input[type='search']", "Messi");
      await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
      await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await waitFor(async () => (await locationPath()) === "/players?q=Messi", 10000, "/players?q=Messi");
      await settle();
      const n = (await run(worldCardIds)).length;
      return { ok: n > 0, detail: `${n} results` };
    });
    await step(vp, "/players", "search control-character rejected safely", async () => {
      await nav("/players?q=%01abc");
      await expectText(T.rejected, "safe rejection view");
      return { ok: true, detail: "rejection view" };
    }, { allow4xx: [/^400 Document \/players$/] });

    await step(vp, "/players", "search clear", async () => {
      await nav("/players?q=Messi");
      await click(`[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "すべて解除")`, "clear all");
      await waitFor(async () => !(await ev("location.search")).includes("q="), 8000, "q removed");
      await settle();
      const n = (await run(worldCardIds)).length;
      await expectText(`${fmt(EXPECT_WORLD)} 件中`, "full range after clear");
      return { ok: n > 0, detail: `${n} cards` };
    });

    const openFilters = async () => {
      if (!(await selectVisible("select[aria-label='ポジション']"))) {
        await click(`[...document.querySelectorAll("main button[aria-expanded]")].find((b) => b.textContent.includes("フィルター"))`, "filter toggle");
        await waitFor(() => selectVisible("select[aria-label='ポジション']"), 5000, "filters open");
      }
    };
    for (const [label, sel, param, pick] of [
      ["position filter", "select[aria-label='ポジション']", "position", "(o) => (o.includes('CF') ? 'CF' : o.find((v) => v))"],
      ["card type filter", "select[aria-label='カードタイプ']", "cardType", "(o) => o.find((v) => v)"],
      ["sort", "select[aria-label='並べ替え']", "sort", "(o, cur) => o.find((v) => v && v !== cur)"],
    ]) {
      await step(vp, "/players", label, async () => {
        await nav("/players");
        if (param !== "sort") await openFilters();
        const value = await selectOption(sel, pick);
        await waitFor(async () => new URL(await ev("location.href")).searchParams.get(param) === value, 8000, `${param} in URL`);
        await settle();
        const n = (await run(worldCardIds)).length;
        return { ok: n > 0, detail: `${param} set, ${n} cards` };
      });
    }
    await step(vp, "/players", "nationality filter", async () => ({ ok: true, detail: "not a feature of this site (no nationality filter exists); skipped by design" }), { audit: false });

    await step(vp, "/players", "pagination", async () => {
      await nav("/players");
      const first = (await run(worldCardIds))[0];
      await click(`document.querySelector("a[rel='next']")`, "next page");
      await waitFor(async () => new URL(await ev("location.href")).searchParams.get("page") === "2", 8000, "page=2");
      await settle();
      const second = (await run(worldCardIds))[0];
      if (!second || second === first) throw new Error("page 2 shows the same cards");
      return { ok: true, detail: "page 2 differs" };
    });

    await step(vp, "/players → detail → back", "navigate and back", async () => {
      await nav("/players");
      const id = (await run(worldCardIds))[0];
      await click(`document.querySelector("main a[href^='/players/world/${id}']")`, "first card");
      await waitFor(async () => (await locationPath()).startsWith(`/players/world/${id}`), 10000, "detail URL");
      await settle();
      if (!(await ev("!!document.querySelector('main h1')"))) throw new Error("detail heading missing");
      await ev("history.back()");
      await waitFor(async () => (await locationPath()) === "/players", 10000, "back to list");
      await settle();
      return { ok: (await run(worldCardIds)).length > 0, detail: "detail and back ok" };
    });

    for (const n of [2, 3, 4]) {
      await step(vp, "/compare", `compare ${n} players`, async () => {
        await nav(`/compare?ids=${ids.slice(0, n).join(",")}`);
        const shown = await run(worldCardIds);
        const missing = ids.slice(0, n).filter((i) => !shown.includes(i));
        if (missing.length) throw new Error(`${missing.length} compared players missing`);
        return { ok: true, detail: `${n} identities shown` };
      });
    }

    await step(vp, "/managers", "manager search", async () => {
      await nav("/managers");
      await typeInto("input[aria-label='監督を検索']", managerQuery);
      await waitFor(async () => new URL(await ev("location.href")).searchParams.get("q") === managerQuery, 8000, "q in URL");
      await settle();
      const n = (await run(managerCardIds)).length;
      return { ok: n > 0, detail: `${n} results` };
    });
    await step(vp, "/managers", "manager filter", async () => {
      await nav("/managers");
      const value = await selectOption("select[aria-label='ブースター']", "(o) => o.find((v) => v)");
      await waitFor(async () => (await ev("location.search")).length > 1, 8000, "filter in URL");
      await settle();
      const n = (await run(managerCardIds)).length;
      return { ok: true, detail: `booster=${value}, ${n} results` };
    });
    await step(vp, "/managers → detail", "open manager", async () => {
      await nav("/managers");
      const id = (await run(managerCardIds))[0];
      await click(`document.querySelector("main a[href^='/managers/${id}']")`, "first manager");
      await waitFor(async () => (await locationPath()).startsWith(`/managers/${id}`), 10000, "manager URL");
      await settle();
      return { ok: await ev("!!document.querySelector('main h1')"), detail: "manager detail" };
    });

    await step(vp, "/support → /terms → /privacy", "legal navigation", async () => {
      await nav("/support");
      await click(`document.querySelector("a[href='/terms']")`, "terms link");
      await waitFor(async () => (await locationPath()) === "/terms", 10000, "/terms");
      await settle();
      await click(`document.querySelector("a[href='/privacy']")`, "privacy link");
      await waitFor(async () => (await locationPath()) === "/privacy", 10000, "/privacy");
      await settle();
      return { ok: true, detail: "support → terms → privacy" };
    });
  }

  // ---------------------------------------------------------------------------
  // 性能(desktop 1280x720 / mobile 390x844 × 主要7画面 × cold 1 + warm 2)
  // ---------------------------------------------------------------------------
  const perf = [];
  const PERF_PAGES = ["/", "/players", `/players/world/${firstPlayer.worldCardId}`, "/managers", `/compare?ids=${ids.slice(0, 2).join(",")}`, "/squads", "/best-xi"];
  const OBS = `(() => { window.__m = { lcp: 0, cls: 0, lt: 0, ltMax: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__m.lt += e.duration; window.__m.ltMax = Math.max(window.__m.ltMax, e.duration); } }).observe({ type: 'longtask', buffered: true }); })()`;
  const { identifier: obsId } = await client.send("Page.addScriptToEvaluateOnNewDocument", { source: OBS });
  const PERF_COLLECT = `(() => { const n = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const names = res.map((r) => r.name.split('#')[0]);
    const api = res.filter((r) => /\\/api\\//.test(r.name) && r.initiatorType !== 'img');
    const slow = res.reduce((a, r) => (r.duration > (a ? a.duration : -1) ? r : a), null);
    return { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), lcp: Math.round(window.__m.lcp), cls: +window.__m.cls.toFixed(3),
      longTaskTotal: Math.round(window.__m.lt), longTaskMax: Math.round(window.__m.ltMax), requests: res.length + 1, duplicates: names.length - new Set(names).size,
      slowestMs: slow ? Math.round(slow.duration) : 0, slowestType: slow ? slow.initiatorType : null,
      apiCount: api.length, apiMaxMs: Math.round(Math.max(0, ...api.map((r) => r.duration))) }; })()`;
  for (const vp of [VIEWPORTS.find((v) => v.name === "desktop-1280x720"), VIEWPORTS.find((v) => v.name === "mobile-390x844")].filter(Boolean)) {
    await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
    for (const p of PERF_PAGES) {
      const runs = [];
      await client.send("Network.clearBrowserCache");
      for (let i = 0; i < 3; i++) {
        resetCap();
        const t0 = Date.now();
        await client.send("Page.navigate", { url: `${BASE}${p}` });
        await waitFor(() => ev("document.readyState === 'complete'"), 30000, "load");
        const loadingMs = Date.now() - t0;
        await settle(30000);
        const loadingDoneMs = Date.now() - t0;
        await sleep(800);
        runs.push({ kind: i === 0 ? "cold" : "warm", ...(await ev(PERF_COLLECT)), loadingIndicatorMs: loadingDoneMs, readyMs: loadingMs, errors: cap.consoleErrors.length + cap.exceptions.length + cap.failed.length + cap.s5xx.length });
      }
      const warm = runs.filter((r) => r.kind === "warm");
      const med = (k) => Math.round(warm.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(warm.length / 2)]);
      const row = {
        viewport: vp.name, page: p.replace(/\/players\/world\/\d+/, "/players/world/<id>").replace(/ids=[\d,]+/, "ids=<2>"),
        coldLoad: runs[0].load, warmLoadMedian: med("load"), ttfbWarm: med("ttfb"), dclWarm: med("dcl"), lcpWarm: med("lcp"),
        clsMax: Math.max(...runs.map((r) => r.cls)), longTaskMax: Math.max(...runs.map((r) => r.longTaskMax)), longTaskTotalMax: Math.max(...runs.map((r) => r.longTaskTotal)),
        requests: runs[0].requests, duplicatesMax: Math.max(...runs.map((r) => r.duplicates)), slowestMs: Math.max(...runs.map((r) => r.slowestMs)),
        apiCount: runs[0].apiCount, apiMaxMs: Math.max(...runs.map((r) => r.apiMaxMs)), loadingIndicatorWarm: med("loadingIndicatorMs"), errors: runs.reduce((a, r) => a + r.errors, 0),
      };
      // 重大: warm load中央値 > 3000ms、long task合計 > 1000ms、CLS > 0.25、エラー。
      row.ok = row.warmLoadMedian <= 3000 && row.longTaskTotalMax <= 1000 && row.clsMax <= 0.25 && row.errors === 0;
      perf.push(row);
      console.log(`${row.ok ? "OK  " : "SLOW"} perf [${vp.name}] ${row.page} cold=${row.coldLoad} warm=${row.warmLoadMedian} lcp=${row.lcpWarm} cls=${row.clsMax} lt=${row.longTaskTotalMax} req=${row.requests} api=${row.apiCount}`);
    }
  }
  await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: obsId });

  // メモリ: 同じタブで一覧⇔詳細を10往復し、GC後のJS heapが増え続けないこと。
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const heap = [];
  await client.send("HeapProfiler.enable");
  for (let i = 0; i < 10; i++) {
    await nav("/players");
    await click(`document.querySelector("main a[href^='/players/world/']")`, "card");
    await waitFor(async () => (await locationPath()).startsWith("/players/world/"), 10000, "detail");
    await settle();
    await client.send("HeapProfiler.collectGarbage");
    const m = await client.send("Performance.getMetrics");
    heap.push(Math.round((m.metrics.find((x) => x.name === "JSHeapUsedSize")?.value ?? 0) / 1024));
  }
  const memory = { heapKB: heap, growthRatio: +(heap[heap.length - 1] / Math.max(1, Math.min(...heap.slice(0, 3)))).toFixed(2) };
  memory.ok = memory.growthRatio <= 1.5;

  client.close();
  await closeTab(browser.port, tab.id);
  await browser.close();

  // ---------------------------------------------------------------------------
  // 公開範囲・セキュリティ(HTTPのみ)
  // ---------------------------------------------------------------------------
  const sec = [];
  const secCheck = (name, ok, detail = "") => {
    sec.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  security ${name}${detail ? `  — ${detail}` : ""}`);
  };
  const raw = async (p, init = {}) => fetch(`${BASE}${p}`, { redirect: "manual", signal: AbortSignal.timeout(30000), ...init });
  const home = await raw("/");
  const homeHtml = await home.text();
  secCheck("noindex meta", /<meta name="robots" content="[^"]*noindex/.test(homeHtml));
  secCheck("X-Robots-Tag noindex", /noindex/.test(home.headers.get("x-robots-tag") ?? ""));
  secCheck("no canonical/OG overriding noindex", !/rel="canonical"|property="og:/.test(homeHtml));
  secCheck("robots.txt Disallow: /", /Disallow:\s*\/\s*$/m.test(await (await raw("/robots.txt")).text()));
  secCheck("sitemap 404", (await raw("/sitemap.xml")).status === 404);
  secCheck("no nav links to internal pages", !/href="\/(account\/rls-test|release-readiness)/.test(homeHtml));
  const chunk = /\/_next\/static\/chunks\/[^"']+\.js/.exec(homeHtml)?.[0];
  if (chunk) {
    const m = await raw(`${chunk}.map`);
    const body = await m.text();
    secCheck("no source maps", [403, 404].includes(m.status) && !body.includes('"mappings"'), `chunk .map → ${m.status}`);
  } else secCheck("no source maps", false, "no chunk found");
  for (const p of ["/api/debug", "/api/env", "/api/health", "/api/diagnostics", "/api/admin", "/diagnostics"]) {
    const s = (await raw(p)).status;
    secCheck(`no debug endpoint ${p}`, s === 404 || s === 405, `status ${s}`);
  }
  const cb = await raw("/auth/callback?next=https%3A%2F%2Fevil.example%2F");
  const loc = cb.headers.get("location") ?? "";
  secCheck("no open redirect (auth callback)", cb.status >= 300 && cb.status < 400 && !/evil\.example/.test(loc) && new URL(loc, BASE).origin === new URL(BASE).origin, `→ ${new URL(loc, BASE).pathname}`);
  const cors = await raw("/api/world/players?pageSize=1", { headers: { Origin: "https://evil.example" } });
  const acao = cors.headers.get("access-control-allow-origin");
  const acac = cors.headers.get("access-control-allow-credentials");
  secCheck("CORS not reflecting arbitrary origins with credentials", !(acao === "https://evil.example" || (acao && acac === "true")), `ACAO=${acao ?? "none"}`);
  const rej = await raw("/api/world/players?q=%01abc");
  const rejBody = await rej.text();
  secCheck("search input rejection kept", rej.status === 400 && /SEARCH_INPUT_REJECTED/.test(rejBody) && !LEAK_RE.test(rejBody), `status ${rej.status}`);
  const apiCache = (await raw("/api/world/players?pageSize=1")).headers.get("cache-control") ?? "";
  secCheck("API responses carry no user data / no shared cache of user data", !/set-cookie/i.test([...home.headers.keys()].join(",")), `cache-control=${apiCache || "none"}`);
  secCheck("security headers", !!home.headers.get("content-security-policy") && home.headers.get("x-content-type-options") === "nosniff" && !!home.headers.get("x-frame-options"), "CSP, nosniff, X-Frame-Options");

  // ---------------------------------------------------------------------------
  // レポート
  // ---------------------------------------------------------------------------
  const pass = results.filter((r) => r.ok).length;
  const perfOk = perf.filter((r) => r.ok).length;
  const secOk = sec.filter((r) => r.ok).length;
  const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  const totals = {
    steps: results.length, pass, consoleErrors: results.reduce((a, r) => a + r.consoleErrors, 0), warnings: results.reduce((a, r) => a + r.warnings, 0),
    networkErrors: results.reduce((a, r) => a + r.networkErrors, 0), http5xx: results.reduce((a, r) => a + r.http5xx, 0), unexpected4xx: results.reduce((a, r) => a + r.unexpected4xx, 0),
    overflowSteps: results.filter((r) => (r.overflow ?? 0) > 0).length,
  };
  const lines = [
    "# 総合ブラックボックス(公開範囲・全viewport・操作・性能)",
    "",
    `実行日時: ${new Date().toISOString()}  対象: ${IS_LOCAL ? BASE : "公開サイト(GETと非破壊のブラウザー操作のみ)"}`,
    `viewport: ${VIEWPORTS.map((v) => v.name).join(", ")}  期待件数: World ${fmt(EXPECT_WORLD)} / Managers ${EXPECT_MANAGERS}`,
    "",
    `**画面・操作: ${pass}/${results.length} PASS** (console error ${totals.consoleErrors}, warning ${totals.warnings}, network error ${totals.networkErrors}, 5xx ${totals.http5xx}, 想定外4xx ${totals.unexpected4xx}, overflow ${totals.overflowSteps})`,
    `**性能: ${perfOk}/${perf.length} OK**  **メモリ: ${memory.ok ? "OK" : "NG"} (growth ${memory.growthRatio})**  **公開範囲・セキュリティ: ${secOk}/${sec.length} PASS**`,
    "",
    "## 失敗",
    "",
    ...(results.filter((r) => !r.ok).length ? results.filter((r) => !r.ok).map((r) => `- [${r.viewport}] ${r.route} ${r.op}: ${esc(r.detail)}`) : ["なし"]),
    "",
    "## 画面・操作",
    "",
    "| 結果 | viewport | route | 操作 | ms | requests | 詳細 |",
    "|---|---|---|---|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.viewport} | ${esc(r.route.replace(/\/\d{6,}/g, "/<id>"))} | ${esc(r.op)} | ${r.ms} | ${r.requests} | ${esc(r.detail)} |`),
    "",
    "## 性能",
    "",
    "| 判定 | viewport | page | cold load | warm load | TTFB | DCL | LCP | CLS | long task max/total | requests | dup | slowest | API count/max | loading表示 | errors |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...perf.map((r) => `| ${r.ok ? "OK" : "SLOW"} | ${r.viewport} | ${esc(r.page)} | ${r.coldLoad} | ${r.warmLoadMedian} | ${r.ttfbWarm} | ${r.dclWarm} | ${r.lcpWarm} | ${r.clsMax} | ${r.longTaskMax}/${r.longTaskTotalMax} | ${r.requests} | ${r.duplicatesMax} | ${r.slowestMs} | ${r.apiCount}/${r.apiMaxMs} | ${r.loadingIndicatorWarm} | ${r.errors} |`),
    "",
    `メモリ(一覧⇔詳細10往復・GC後JS heap KB): ${memory.heapKB.join(", ")}`,
    "",
    "## 公開範囲・セキュリティ",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...sec.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${esc(r.name)} | ${esc(r.detail)} |`),
    "",
  ];
  writeFileSync(REPORT, lines.join("\n"), "utf8");
  const summaryPath = REPORT.replace(/\.md$/, ".summary.json");
  writeFileSync(summaryPath, `${JSON.stringify({ at: new Date().toISOString(), viewports: VIEWPORTS.map((v) => v.name), totals, perf, memory, security: sec, failures: results.filter((r) => !r.ok) }, null, 2)}\n`, "utf8");
  console.log(`\n[public-black-box-full] steps ${pass}/${results.length}, perf ${perfOk}/${perf.length}, memory ${memory.ok ? "OK" : "NG"}, security ${secOk}/${sec.length}`);
  process.exit(pass === results.length && perfOk === perf.length && memory.ok && secOk === sec.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});
