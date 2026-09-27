/**
 * 能力値直接操作・スライド式育成UI の総合ブラックボックス（実ブラウザー・全8 viewport）。
 *
 *   BASE_URL=http://localhost:3200 REPORT_PATH=./data/ade/local.md node scripts/black-box-ability-progression.mjs
 *   BASE_URL=https://<公開サイト> REPORT_PATH=./data/ade/public.md node scripts/black-box-ability-progression.mjs
 *
 * - 対象サイトへの GET と、ブラウザー内の操作だけ（保存はこのブラウザーの localStorage。本番DBへは書き込まない）。
 * - 非GETのリクエストが1件でもあれば失敗として記録する。
 * - 期待値は同じ計算規則（段階コスト 1 + floor(level / 5)、総ポイント (最大Lv − 1) × 2）から求める。
 * - 結果は REPORT_PATH（./data 配下のみ）へ Markdown と JSON で書く。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const REPORT = path.resolve(ROOT, process.env.REPORT_PATH ?? "./data/ability-progression-black-box.md");
if (!REPORT.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
const CARD = process.env.CARD_ID ?? "89138556575063"; // Messi BIGTIME: 最大Lv32 → 62pt、ドリブル上限Lv13、ディフェンスは62ptでLv22まで

const VIEWPORTS = [
  { name: "desktop-1280x720", width: 1280, height: 720, dpr: 1, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, dpr: 1, mobile: false },
  { name: "tablet-768x1024", width: 768, height: 1024, dpr: 2, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, dpr: 2, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "mobile-393x852", width: 393, height: 852, dpr: 3, mobile: true },
  { name: "mobile-430x932", width: 430, height: 932, dpr: 3, mobile: true },
].filter((v) => !process.env.BB_VIEWPORTS || process.env.BB_VIEWPORTS.split(",").includes(v.name));

const cost = (lv) => { let s = 0; for (let i = 0; i < lv; i++) s += 1 + Math.floor(i / 5); return s; };
const TOTAL = 62;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const perf = [];
let current = "";
const record = (name, pass, detail = "") => {
  results.push({ viewport: current, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${current}] ${name}${detail ? "  — " + detail : ""}`);
};

async function runViewport(browser, vp) {
  current = vp.name;
  const tab = await openTab(browser.port, "about:blank");
  const c = connectCDP(tab.webSocketDebuggerUrl);
  await c.ready;
  for (const d of ["Page", "Runtime", "Network", "Log"]) await c.send(`${d}.enable`);
  if (IS_LOCAL) await installSupabaseAuthTestDouble(c);
  await c.send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
  const setMetrics = (w, h) => c.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: vp.dpr, mobile: vp.mobile });
  await setMetrics(vp.width, vp.height);
  if (vp.mobile) await c.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  const cap = { errors: [], warnings: [], failed: [], s5xx: [], nonGet: [], requests: 0 };
  const urls = new Map();
  c.on("Network.requestWillBeSent", (p) => {
    cap.requests++;
    urls.set(p.requestId, p.request.url.replace(BASE, "").slice(0, 100));
    if (p.request.method !== "GET" && p.request.method !== "HEAD" && p.request.method !== "OPTIONS") cap.nonGet.push(`${p.request.method} ${p.request.url.replace(BASE, "").slice(0, 80)}`);
  });
  c.on("Network.responseReceived", (p) => { if (p.response.status >= 500) cap.s5xx.push(`${p.response.status} ${urls.get(p.requestId)}`); });
  c.on("Network.loadingFailed", (p) => { if (!p.canceled) cap.failed.push(`${p.errorText} ${urls.get(p.requestId) ?? ""}`); });
  c.on("Runtime.consoleAPICalled", (p) => {
    const text = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200);
    if (p.type === "error" || p.type === "assert") cap.errors.push(text);
    else if (p.type === "warning") cap.warnings.push(text);
  });
  c.on("Runtime.exceptionThrown", (p) => cap.errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 200)));

  const ev = async (fn, ...args) => {
    const { result: obj } = await c.send("Runtime.evaluate", { expression: "globalThis", returnByValue: false });
    const r = await c.send("Runtime.callFunctionOn", { objectId: obj.objectId, functionDeclaration: fn.toString(), arguments: args.map((value) => ({ value })), returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
    return r.result.value;
  };
  const waitFor = async (fn, ms = 15000, ...args) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn, ...args)) return true; await sleep(150); } return false; };
  const center = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left }; }, sel);
  const tap = async (sel) => {
    const p = await center(sel);
    if (!p) return false;
    await sleep(120);
    const q = await ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    if (vp.mobile) {
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q.x, y: q.y }] });
      await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: q.x, y: q.y, button: "left", clickCount: 1 });
      await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: q.x, y: q.y, button: "left", clickCount: 1 });
    }
    await sleep(150);
    return true;
  };
  const key = async (k, code = k) => {
    await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Home: 36, End: 35, Escape: 27 }[k] ?? 0 });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
    await sleep(80);
  };
  // スライダーを ratio a → b へドラッグ。hold 中に fn を実行してから離す。
  const drag = async (a, b, whileHeld) => {
    const r = await ev(() => { const e = document.querySelector("[data-testid=category-slider]"); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2, w: b.width }; });
    const x0 = r.x + r.w * a, x1 = r.x + r.w * b, steps = 10;
    if (vp.mobile) {
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: r.y }] });
      for (let i = 1; i <= steps; i++) await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: r.y }] });
    } else {
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: r.y, button: "left", clickCount: 1 });
      for (let i = 1; i <= steps; i++) await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / steps, y: r.y, button: "left", buttons: 1 });
    }
    await sleep(120);
    const held = whileHeld ? await whileHeld() : null;
    if (vp.mobile) await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    else await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: r.y, button: "left", clickCount: 1 });
    await sleep(200);
    return held;
  };
  const dock = () => ev(() => {
    const d = document.querySelector("[data-testid=progression-dock]");
    const lv = document.querySelector("[data-testid=dock-level]")?.textContent;
    const rem = document.querySelector("[data-testid=remaining-points]")?.textContent ?? "";
    const m = rem.match(/(-?\d+)\s*\/\s*(\d+)/);
    const plus = [...(d?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "＋");
    const minus = [...(d?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "−");
    const slider = document.querySelector("[data-testid=category-slider]");
    return {
      open: !!d,
      level: lv == null ? null : Number(lv),
      remaining: m ? Number(m[1]) : null,
      total: m ? Number(m[2]) : null,
      plusDisabled: plus?.disabled ?? null,
      minusDisabled: minus?.disabled ?? null,
      valuenow: slider ? Number(slider.getAttribute("aria-valuenow")) : null,
      valuemax: slider ? Number(slider.getAttribute("aria-valuemax")) : null,
      status: document.querySelector("[role=status][id^=dock-status]")?.textContent ?? "",
      text: d?.textContent ?? "",
    };
  });
  const badge = (stat) => ev((s) => Number(document.querySelector(`[data-stat="${s}"] .ability-badge`)?.textContent), stat);
  const chipLevel = (g) => ev((id) => Number(document.querySelector(`[data-group="${id}"] .tabular-nums`)?.textContent), g);
  const overflow = () => ev(() => document.documentElement.scrollWidth - window.innerWidth);

  // 1. 開く
  await c.send("Page.navigate", { url: `${BASE}/players/world/${CARD}?tab=progression` });
  const loaded = await waitFor(() => !!document.querySelector("[data-stat=tightPossession]"), 45000);
  record("選手詳細の育成タブを開く（能力一覧が表示）", loaded);
  if (!loaded) { c.close(); await closeTab(browser.port, tab.id); return; }
  await sleep(1200);
  await ev(() => { window.__lt = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ type: "longtask", buffered: false }); } catch { /* 未対応 */ } });
  record("横方向のはみ出し 0（初期）", (await overflow()) <= 1, `${await overflow()}px`);

  // 2-6. 能力をタップ → 選択・関連・暗く
  const t0 = Date.now();
  await tap("[data-stat=tightPossession]");
  const tapMs = Date.now() - t0;
  const roles = await ev(() => ({
    pressed: document.querySelector("[data-stat=tightPossession]")?.getAttribute("aria-pressed"),
    related: [...document.querySelectorAll("[data-role=related]")].map((e) => e.dataset.stat).sort(),
    unrelated: document.querySelectorAll("[data-role=unrelated]").length,
    unrelatedOpacity: Number(getComputedStyle(document.querySelector("[data-role=unrelated]")).opacity),
  }));
  record("ボールキープをタップすると選択状態（aria-pressed=true）", roles.pressed === "true", `${tapMs}ms`);
  record("関連能力（ボールコントロール・ドリブル）を同時に強調", JSON.stringify(roles.related) === JSON.stringify(["ballControl", "dribbling"]), roles.related.join(","));
  record("無関係な能力は少し暗く（読める範囲）", roles.unrelated === 23 && roles.unrelatedOpacity >= 0.5 && roles.unrelatedOpacity < 1, `${roles.unrelated}件 opacity ${roles.unrelatedOpacity}`);
  let d = await dock();
  record("育成パネルが開き、ドリブル Lv0・残り62/62", d.open && d.level === 0 && d.remaining === TOTAL && d.total === TOTAL, `Lv${d.level} 残り${d.remaining}/${d.total}`);
  await sleep(300); // 開くときの短い演出（180ms）が終わってから測る
  const geo = await ev(() => { const p = document.querySelector("[data-testid=progression-dock]").getBoundingClientRect(); return { top: p.top, bottom: p.bottom, h: window.innerHeight }; });
  record("パネルが画面内に収まる（下端・高さ）", geo.bottom <= geo.h + 1 && geo.top > 0, `top ${Math.round(geo.top)} bottom ${Math.round(geo.bottom)} / ${geo.h}`);
  const small = await ev(() => [...document.querySelectorAll("[data-testid=progression-dock] button, [data-testid=category-slider]")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || (b.getAttribute("role") !== "slider" && r.width < 43.5)); }).map((b) => b.textContent.trim().slice(0, 12) || b.getAttribute("aria-label")));
  record("パネル内の操作要素はすべて 44px 以上", small.length === 0, small.join(" / "));

  // 7-10. ＋で1段階
  await tap("[data-testid=progression-dock] button[aria-label*='1']:not([aria-label*='下'])".replace("[aria-label*='1']:not([aria-label*='下'])", "[aria-label$='上げる'], [data-testid=progression-dock] button[aria-label^='Raise']"));
  d = await dock();
  record("＋で1段階: Lv1・残り61・ボールキープ87・チップ1", d.level === 1 && d.remaining === TOTAL - 1 && (await badge("tightPossession")) === 87 && (await chipLevel("dribbling")) === 1, `Lv${d.level} 残り${d.remaining} 値${await badge("tightPossession")}`);

  // キーボード
  await ev(() => document.querySelector("[data-testid=category-slider]").focus());
  await key("ArrowRight"); await key("ArrowUp");
  d = await dock();
  record("キーボード → ↑ で +1 ずつ（Lv3）", d.level === 3 && d.valuenow === 3, `Lv${d.level}`);
  await key("End");
  d = await dock();
  record("End で到達可能上限（Lv13＝カテゴリ上限、MAX）", d.level === 13 && d.plusDisabled === true && /最大|maximum/i.test(d.status), `Lv${d.level} ${d.status}`);
  await key("Home");
  d = await dock();
  record("Home で 0（ポイント全返却）", d.level === 0 && d.remaining === TOTAL, `Lv${d.level} 残り${d.remaining}`);
  const focusVisible = await ev(() => { const e = document.querySelector("[data-testid=category-slider]"); return document.activeElement === e && getComputedStyle(e).outlineStyle !== "none"; });
  record("スライダーにフォーカスが見える", focusVisible);

  // 11-12. ドラッグで複数段階（プレビュー → 離して確定）、非線形コスト
  const reqBefore = cap.requests;
  const held = await drag(0.02, 0.62, async () => ({ d: await dock(), v: await badge("tightPossession"), drag: await ev(() => document.querySelector(".cat-slider")?.dataset.dragging) }));
  const L = (await dock()).level;
  record("ドラッグ中にプレビュー（能力値・レベルがリアルタイムに変わる）", held.drag === "true" && held.d.level === L && held.v === 86 + L, `drag=${held.drag} Lv${held.d.level} 値${held.v}`);
  d = await dock();
  record("ドラッグで複数段階（Lv6〜9）を一気に変更し、離すと確定", L >= 6 && L <= 9 && d.valuenow === L, `Lv${L}`);
  record("非線形コスト: 残り = 62 − 累積コスト", d.remaining === TOTAL - cost(L), `残り${d.remaining} 期待${TOTAL - cost(L)}`);
  record("配分チップも同じ値", (await chipLevel("dribbling")) === L);
  record("ドラッグ中の通信 0", cap.requests === reqBefore, `${cap.requests - reqBefore}件`);

  // 15. −で1段階（返却ポイント）
  await tap("[data-testid=progression-dock] button[aria-label$='下げる'], [data-testid=progression-dock] button[aria-label^='Lower']");
  d = await dock();
  record("−で1段階戻す", d.level === L - 1 && d.remaining === TOTAL - cost(L - 1), `Lv${d.level}`);
  const keepL = d.level;

  // 13-14, 24. ポイント不足（ディフェンス）
  await tap("[data-stat=tackling]");
  d = await dock();
  const remainingForDef = d.remaining;
  let reach = 0; while (cost(reach + 1) <= remainingForDef) reach++;
  const heldDef = await drag(0.02, 0.995, async () => ({ d: await dock(), blocked: await ev(() => document.querySelector(".cat-slider")?.dataset.blocked) }));
  record("ポイント不足: 到達可能上限で止まり、理由を表示", heldDef.d.level === reach && heldDef.blocked === "true" && /不足|Not enough/.test(heldDef.d.status), `Lv${heldDef.d.level} 期待${reach} ${heldDef.d.status}`);
  d = await dock();
  record("到達不能区間の表示と＋の無効化（理由つき）", d.level === reach && d.plusDisabled === true && (await ev(() => !!document.querySelector(".cat-slider-blocked"))) && /不足|Not enough/.test(d.status), `Lv${d.level} 残り${d.remaining}`);
  record("残りポイントは負にならない", d.remaining >= 0 && d.remaining === remainingForDef - cost(reach), `残り${d.remaining}`);

  // 16-17. 元に戻す / スライダーで0へ
  await tap("[data-testid=progression-dock] button[title]");
  d = await dock();
  record("元に戻す: 選択時点（Lv0）へ", d.level === 0 && d.remaining === remainingForDef, `Lv${d.level} 残り${d.remaining}`);

  // 選択解除（Escape・同じ能力の再タップ）
  await key("Escape");
  record("Escape で選択解除（パネルは閉じ、配分は保持）", !(await dock()).open && (await chipLevel("dribbling")) === keepL);
  await tap("[data-stat=dribbling]");
  await tap("[data-stat=dribbling]");
  record("同じ能力の再タップで選択解除", !(await dock()).open);

  // 隠れ 0: パネルを開いたまま最後の能力までスクロールできる
  await tap("[data-stat=defensiveEngagement]");
  const hidden = await ev(async () => {
    const rows = [...document.querySelectorAll("[data-testid=ability-direct-list] > div:not(details) li")];
    const last = rows[rows.length - 1];
    last.scrollIntoView({ block: "end" });
    await new Promise((r) => setTimeout(r, 200));
    window.scrollBy(0, 400);
    await new Promise((r) => setTimeout(r, 200));
    last.scrollIntoView({ block: "nearest" });
    await new Promise((r) => setTimeout(r, 200));
    const dockTop = document.querySelector("[data-testid=progression-dock]").getBoundingClientRect().top;
    const lastRect = last.getBoundingClientRect();
    return { lastBottom: lastRect.bottom, dockTop, hiddenPx: Math.max(0, lastRect.bottom - dockTop) };
  });
  record("パネル表示中も最後の能力が隠れない", hidden.hiddenPx <= 1, `隠れ ${Math.round(hidden.hiddenPx)}px`);
  await key("Escape");

  // 18-20. 保存 → 再読込 → 読込で配分が復元
  await ev(() => { const i = document.querySelector("input[aria-label='ビルド名']"); i.scrollIntoView({ block: "center" }); i.focus(); });
  await c.send("Input.insertText", { text: "BB slider" });
  await sleep(150);
  const saveSel = "#progression-build-bar button.bg-accent";
  await tap(saveSel);
  const savedOk = await waitFor(() => document.querySelector("#progression-build-bar")?.textContent.includes("BB slider"), 5000);
  record("既存の保存操作で保存（ブラウザー内のみ）", savedOk);
  await c.send("Page.reload", { ignoreCache: false });
  await waitFor(() => !!document.querySelector("[data-stat=tightPossession]"), 45000);
  await sleep(1000);
  record("再読込直後は未編集（Lv0）", (await chipLevel("dribbling")) === 0);
  await ev(() => { const li = [...document.querySelectorAll("#progression-build-bar li")].find((l) => l.textContent.includes("BB slider")); li?.querySelector("button")?.setAttribute("data-bb", "load"); });
  await tap("#progression-build-bar button[data-bb=load]");
  await sleep(300);
  record("読込で配分と能力値が復元（ドリブル・ボールキープ）", (await chipLevel("dribbling")) === keepL && (await badge("tightPossession")) === 86 + keepL, `Lv${await chipLevel("dribbling")} 値${await badge("tightPossession")}`);

  // 21. 言語切替
  await ev(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "English")?.click());
  await sleep(500);
  await tap("[data-stat=tightPossession]");
  const en = await ev(() => ({ list: document.querySelector("[data-testid=ability-direct-list]").textContent, dock: document.querySelector("[data-testid=progression-dock]")?.textContent ?? "" }));
  const jp = /[぀-ヿ一-龯]/;
  record("英語: 能力一覧と育成パネルに日本語が混ざらない", !jp.test(en.list) && !jp.test(en.dock) && /Train this ability/.test(en.dock), jp.test(en.dock) ? "dock に日本語" : jp.test(en.list) ? "list に日本語" : "");
  await ev(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "日本語")?.click());
  await sleep(500);
  const ja = await ev(() => document.querySelector("[data-testid=progression-dock]")?.textContent ?? "");
  record("日本語へ戻す（カテゴリは日本語名、英語の内部キーなし）", /この能力を育成/.test(ja) && /ドリブル/.test(ja) && !/dribbling|Dribbling/.test(ja));

  // 22. 向きの変更
  if (vp.mobile) {
    await setMetrics(vp.height, vp.width);
    await sleep(500);
    const land = await ev(async () => {
      const p = document.querySelector("[data-testid=progression-dock]");
      const s = document.querySelector("[data-testid=category-slider]").getBoundingClientRect();
      const row = document.querySelector("[data-stat=tightPossession]");
      row.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 150));
      // 選択中の行の下端をパネルの直上へ合わせ、上部の固定要素（ヘッダー・タブ・選手バー）と重ならずに見えるか。
      window.scrollBy(0, row.getBoundingClientRect().bottom - p.getBoundingClientRect().top + 4);
      await new Promise((r) => setTimeout(r, 150));
      const topFixed = Math.max(0, ...[...document.querySelectorAll("body *")].filter((e) => { const cs = getComputedStyle(e); return (cs.position === "sticky" || cs.position === "fixed") && !p.contains(e) && e !== p; }).map((e) => e.getBoundingClientRect()).filter((r) => r.top < window.innerHeight / 2 && r.height > 0 && r.height < window.innerHeight / 2).map((r) => r.bottom));
      const rr = row.getBoundingClientRect();
      return { over: document.documentElement.scrollWidth - window.innerWidth, dockH: p.getBoundingClientRect().height, h: window.innerHeight, sliderVisible: s.bottom <= window.innerHeight && s.top >= 0, rowVisible: rr.top >= topFixed - 1 && rr.bottom <= p.getBoundingClientRect().top + 1, topFixed: Math.round(topFixed) };
    });
    record("横向き: はみ出し 0・スライダーが見える・パネルが画面の半分未満・選択中の行が見える", land.over <= 1 && land.sliderVisible && land.dockH < land.h * 0.5 && land.rowVisible, `dock ${Math.round(land.dockH)}/${land.h} 上部固定 ${land.topFixed}px 行 ${land.rowVisible ? "見える" : "隠れる"}`);
    await setMetrics(vp.width, vp.height);
    await sleep(300);
  }
  record("横方向のはみ出し 0（操作後）", (await overflow()) <= 1, `${await overflow()}px`);

  // 23. 戻る／進む
  await c.send("Page.navigate", { url: `${BASE}/players` });
  await waitFor(() => location.pathname === "/players" && document.readyState === "complete", 20000);
  await sleep(800);
  await ev(() => history.back());
  const back = await waitFor(() => !!document.querySelector("[data-stat=tightPossession]"), 30000);
  await ev(() => history.forward());
  const fwd = await waitFor(() => location.pathname === "/players", 20000);
  record("ブラウザーの戻る／進むで壊れない", back && fwd);

  const lt = await ev(() => window.__lt ?? 0).catch(() => 0);
  perf.push({ viewport: vp.name, tapToSelectMs: tapMs, longTaskTotalMs: Math.round(lt) });

  record("console error 0", cap.errors.length === 0, cap.errors.slice(0, 3).join(" | "));
  record("console warning 0", cap.warnings.length === 0, cap.warnings.slice(0, 3).join(" | "));
  record("network error 0", cap.failed.length === 0, cap.failed.slice(0, 3).join(" | "));
  record("HTTP 5xx 0", cap.s5xx.length === 0, cap.s5xx.join(" | "));
  record("非GETリクエスト 0（本番への書き込みなし）", cap.nonGet.length === 0, cap.nonGet.join(" | "));

  c.close();
  await closeTab(browser.port, tab.id);
}

const browser = await launchIsolatedBrowser();
try {
  for (const vp of VIEWPORTS) {
    try {
      await runViewport(browser, vp);
    } catch (e) {
      record("実行エラー", false, String(e.message).slice(0, 200));
    }
  }
} finally {
  await browser.close();
}

const pass = results.filter((r) => r.pass).length;
const md = [
  "# 能力値直接操作・スライド式育成UI ブラックボックス",
  "",
  `実行日時: ${new Date().toISOString()}  対象: ${IS_LOCAL ? BASE : "公開サイト"}  viewport: ${VIEWPORTS.map((v) => v.name).join(", ")}`,
  "",
  `**${pass}/${results.length} PASS**`,
  "",
  "| 結果 | viewport | 項目 | 詳細 |",
  "|---|---|---|---|",
  ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.viewport} | ${r.name} | ${String(r.detail).replace(/\|/g, "/")} |`),
  "",
  "## 操作の応答",
  "",
  "| viewport | タップ→選択 (ms, CDP往復含む) | long task 合計 (ms) |",
  "|---|---|---|",
  ...perf.map((p) => `| ${p.viewport} | ${p.tapToSelectMs} | ${p.longTaskTotalMs} |`),
  "",
].join("\n");
mkdirSync(path.dirname(REPORT), { recursive: true });
writeFileSync(REPORT, md);
writeFileSync(REPORT.replace(/\.md$/, ".summary.json"), JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, failures: results.filter((r) => !r.pass), perf }, null, 2));
console.log(`\n${pass}/${results.length} PASS`);
process.exitCode = pass === results.length ? 0 : 1;
