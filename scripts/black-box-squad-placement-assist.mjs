/**
 * スカッドの配置補助（F-036: 複数選択・整列・均等配置・選択だけの左右反転）のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-squad-placement-assist.mjs
 *
 * - Production Build 上の隔離ヘッドレス Chrome（scripts/lib/headless-chrome.mjs）で実際に操作する。
 * - 隔離プロファイルの guest の保存領域だけを使う。実ユーザーの保存スカッド・My Team・SQLite は変更しない。
 * - 実在する World カードの worldCardId を、ローカルの API（localhost）から取得して使う。外部アクセス 0 回。
 * - 結果は docs/black-box-tests/squad-placement-assist.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "squad-placement-assist.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const KEY = "efootball-team-ai:local:guest:squads:v1";
const PICKED = ["lb", "lcb", "rcb", "rb"];
const START = { lb: [12, 70], lcb: [38, 79], rcb: [60, 83], rb: [88, 72] };

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalJson(client, expression) {
  const res = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res?.exceptionDetails) throw new Error(`eval exception: ${res.exceptionDetails.text}`);
  return res?.result?.value;
}
async function navigateAndSettle(client, url) {
  await client.send("Page.navigate", { url });
  await waitForCondition(async () => (await evalJson(client, "document.readyState")) === "complete", { timeoutMs: 10000, intervalMs: 100 });
}
const clickByText = (client, text) =>
  evalJson(client, `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
const isDisabled = (client, text) =>
  evalJson(client, `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); return b ? b.disabled : null; })()`);
const stored = (client) => evalJson(client, `JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "[]")[0] || null`);
const coords = (sq) => Object.fromEntries((sq?.slots ?? []).map((s) => [s.slotId, [s.x, s.y, s.roleOverride ?? null]]));
async function waitStored(client, pred, timeoutMs = 6000) {
  let last = null;
  try {
    await waitForCondition(async () => pred((last = await stored(client))), { timeoutMs, intervalMs: 150 });
  } catch {
    /* 呼び出し側で判定する */
  }
  return last;
}

async function main() {
  const players = await (await fetch(`${BASE}/api/world/players?limit=8`)).json();
  const ids = [...new Set(players.players.map((p) => p.worldCardId))].slice(0, 4);
  if (ids.length < 4) throw new Error("World のカードを 4 枚取得できない");

  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? p.exceptionDetails?.text ?? "exception"));

  try {
    // 1) アプリ自身の作成の流れでスカッドを作り、4 人を入れた状態を保存領域に書く。
    await navigateAndSettle(client, `${BASE}/squads`);
    await waitForCondition(async () => (await isDisabled(client, "作成して編集")) === false, { timeoutMs: 10000, intervalMs: 150 });
    await clickByText(client, "作成して編集");
    await waitForCondition(async () => /\/squads\/[^/?]+/.test(await evalJson(client, "location.pathname")), { timeoutMs: 10000, intervalMs: 150 });
    const squadPath = await evalJson(client, "location.pathname");
    await waitStored(client, (s) => !!s);
    const seeded = await evalJson(
      client,
      `(() => { const all = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "[]"); const sq = all[0]; if (!sq) return false;
        const ids = ${JSON.stringify(ids)}; const start = ${JSON.stringify(START)}; const picked = ${JSON.stringify(PICKED)};
        sq.slots = sq.slots.map((s) => { const i = picked.indexOf(s.slotId); return i < 0 ? s : { ...s, worldCardId: ids[i], x: start[s.slotId][0], y: start[s.slotId][1], roleOverride: s.slotId === "lb" ? "LB" : null }; });
        localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(all)); return true; })()`,
    );
    record("準備: アプリの作成の流れでスカッドを作り、4 人（LB・CB・CB・RB）を入れる", seeded === true, squadPath);
    await navigateAndSettle(client, `${BASE}${squadPath}`);
    await waitForCondition(async () => (await evalJson(client, `[...document.querySelectorAll("button")].some((b) => /^複数選択 (ON|OFF)$/.test(b.textContent.trim()))`)) === true, { timeoutMs: 10000, intervalMs: 150 });
    const before = coords(await stored(client));
    const gkBefore = JSON.stringify(before.gk);

    // 2) 複数選択を ON にし、4 人を選ぶ。
    record("配置補助バーに「複数選択 OFF」がある", (await clickByText(client, "複数選択 OFF")) === true);
    await waitForCondition(async () => (await evalJson(client, `!!document.querySelector('[data-testid="squad-multi-select"]')`)) === true, { timeoutMs: 4000, intervalMs: 100 });
    record("複数選択 ON で操作の欄が出る", (await evalJson(client, `!!document.querySelector('[data-testid="squad-multi-select"]')`)) === true);
    record("選択が足りない間は操作のボタンが無効", (await isDisabled(client, "横一列に揃える")) === true && (await isDisabled(client, "左右に均等")) === true);
    const pressable = await evalJson(client, `document.querySelectorAll('button[aria-pressed="false"][aria-label]').length`);
    const clicked = await evalJson(
      client,
      `(() => { const bs = [...document.querySelectorAll('button[aria-pressed="false"][aria-label]')].filter((b) => b.style.left); bs.forEach((b) => b.click()); return bs.length; })()`,
    );
    await sleep(300);
    const text = await evalJson(client, "document.body.innerText");
    record("ピッチの選手は選択の切り替えボタン（aria-pressed）になり、4 人を選べる", clicked === 4 && text.includes("選択中: 4 人"), `aria-pressed=false ${pressable}, clicked ${clicked}`);
    record("選んだ選手は aria-pressed=true", (await evalJson(client, `document.querySelectorAll('button[aria-pressed="true"][aria-label]').length`)) >= 4);

    // 3) 横一列に揃える → 保存された y が平均にそろい、x は維持。
    await clickByText(client, "横一列に揃える");
    const avgY = Math.round(((70 + 79 + 83 + 72) / 4) * 10) / 10;
    let s = coords(await waitStored(client, (q) => PICKED.every((id) => coords(q)[id]?.[1] === avgY)));
    record("横一列に揃える: 4 人の y が平均にそろう（自動保存）", PICKED.every((id) => s[id]?.[1] === avgY), JSON.stringify(PICKED.map((id) => s[id]?.[1])));
    record("横一列に揃える: x は維持", PICKED.every((id) => s[id]?.[0] === START[id][0]));

    // 4) 左右に均等 → 両端を保ち等間隔。
    await clickByText(client, "左右に均等");
    const want = [12, 37.3, 62.7, 88];
    s = coords(await waitStored(client, (q) => PICKED.every((id, i) => coords(q)[id]?.[0] === want[i])));
    record("左右に均等: 両端を保ち等間隔（12・37.3・62.7・88）", PICKED.every((id, i) => s[id]?.[0] === want[i]), JSON.stringify(PICKED.map((id) => s[id]?.[0])));

    // 5) 選択を左右反転 → x → 100-x、LB の上書きは RB へ。
    await clickByText(client, "選択を左右反転");
    s = coords(await waitStored(client, (q) => coords(q).lb?.[0] === 88));
    record("選択を左右反転: x → 100−x・左右ロールの上書き（LB → RB）も反転", s.lb?.[0] === 88 && s.lb?.[2] === "RB" && s.rb?.[0] === 12, JSON.stringify(s.lb));

    // 6) 元に戻す → 1 操作ずつ戻る。
    await clickByText(client, "元に戻す");
    s = coords(await waitStored(client, (q) => coords(q).lb?.[0] === 12));
    record("元に戻す: 直前の操作（左右反転）だけが戻る", s.lb?.[0] === 12 && s.lb?.[2] === "LB" && s.lcb?.[0] === 37.3);

    // 7) 選んでいない枠・他の設定は不変。選択解除・OFF で通常の操作に戻る。
    record("選んでいない枠（GK）の座標は不変", JSON.stringify(s.gk) === gkBefore);
    await clickByText(client, "選択を解除");
    await sleep(200);
    record("選択を解除で 0 人になる", (await evalJson(client, "document.body.innerText")).includes("選択中: 0 人"));
    await clickByText(client, "複数選択 ON");
    await sleep(200);
    record("複数選択 OFF で操作の欄が消え、aria-pressed も外れる", (await evalJson(client, `!document.querySelector('[data-testid="squad-multi-select"]') && document.querySelectorAll('button[aria-pressed][aria-label][style]').length === 0`)) === true);

    // 8) モバイル幅で横スクロールが出ない（操作の欄を出した状態）。
    await client.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await clickByText(client, "複数選択 OFF");
    await sleep(300);
    const overflow = await evalJson(client, "document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("375px: 複数選択の欄を出しても横スクロールなし", overflow <= 1, `overflow ${overflow}px`);
    record("ページ内で JS 例外が発生していない", errors.length === 0, errors.slice(0, 3).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-squad-placement-assist] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# スカッドの配置補助（F-036 複数選択・整列・均等配置・選択の左右反転）ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build 上の隔離ヘッドレス Chrome。実機ではない）  外部アクセス: **0 回**`,
    "",
    "隔離プロファイルの guest の保存領域だけを使う。実ユーザーの保存スカッド・My Team・SQLite は変更しない。",
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
  console.log(`[black-box-squad-placement-assist] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
