#!/usr/bin/env node
/**
 * 育成ポイントのコストの規則（v3・2026-10-08）の black-box。npm run build && npm run start の後に
 *   node scripts/black-box-cost-rule.mjs
 * - 分離したヘッドレス Chrome。保存はこのブラウザーの localStorage（架空のビルド）だけ。
 * - 旧規則のビルド（costRuleId なし）: 読み込むと旧規則のまま計算し、案内を出す。保存データは変えない。
 *   「現在のポイント計算で再計算」で現行の規則になり、残りポイントが減る。保存すると新しいビルドに現行の規則が記録される。
 * - 新しい育成: 現行の規則（4 段階ごと）で計算し、案内を出さない。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble, stubVercelInsightsOnLocalhost } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const CARD = "89138556575063"; // Messi BIGTIME（最大 Lv32 → 62pt）
const BUILDS_KEY = "efootball-team-ai:local:guest:progression-builds:v1";
const legacyCost = (lv) => { let s = 0; for (let i = 0; i < lv; i++) s += 1 + Math.floor(i / 5); return s; };
const currentCost = (lv) => { let s = 0; for (let i = 0; i < lv; i++) s += 1 + Math.floor(i / 4); return s; };
const TOTAL = 62;
const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
  await stubVercelInsightsOnLocalhost(client, BASE);
  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? "exception"));
  const ev = async (expr) => {
    const r = await client.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const nav = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 15000, intervalMs: 100 });
  };
  const remaining = () => ev(`Number(document.querySelector("[data-testid=remaining-points] .text-sm")?.textContent ?? "NaN")`);
  const store = () => ev(`JSON.parse(localStorage.getItem(${JSON.stringify(BUILDS_KEY)}) || "{}")`);
  const L = 10;
  const legacy = {
    buildId: "b_legacy0000000001",
    worldCardId: CARD,
    buildName: "旧規則のビルド",
    progressionAllocation: { shooting: L },
    selectedPlayerBooster: null,
    calculatedStats: {},
    calculatedOvr: null,
    calculationMode: "provisional",
    rulesVersion: "progression/2026-08-28.v2",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    schemaVersion: 1,
  };

  try {
    // 新しい育成（ビルドなし）: 現行の規則・案内なし
    await nav(`${BASE}/players/world/${CARD}?tab=progression`);
    await ev(`localStorage.setItem(${JSON.stringify(BUILDS_KEY)}, ${JSON.stringify(JSON.stringify({ [CARD]: [legacy] }))})`);
    await nav(`${BASE}/players/world/${CARD}?tab=progression`);
    await waitForCondition(async () => Number.isFinite(await remaining()), { timeoutMs: 15000, intervalMs: 200 });
    record("新しい育成: 旧規則の案内を出さない", (await ev(`!!document.querySelector("[data-testid=legacy-cost-rule-notice]")`)) === false);
    const before = JSON.stringify((await store())[CARD]);

    // 旧規則のビルドを読み込む（保存欄の一覧が描画されるまで待つ）
    await waitForCondition(async () => (await ev(`[...document.querySelectorAll("button")].some((x) => /^(読込|Load)$/.test(x.textContent.trim()))`)) === true, { timeoutMs: 15000, intervalMs: 200 }).catch(() => {});
    const loaded = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /^(読込|Load)$/.test(x.textContent.trim())); if (!b) return false; b.click(); return true; })()`);
    await sleep(600);
    record("旧規則のビルドを読み込める", loaded === true);
    const r1 = await remaining();
    record("旧規則のビルドは旧規則のまま計算（残り = 62 − 旧規則の累積）", r1 === TOTAL - legacyCost(L), `残り${r1} 期待${TOTAL - legacyCost(L)}`);
    record("旧規則の案内と「再計算」のボタンを出す", (await ev(`!!document.querySelector("[data-testid=legacy-cost-rule-notice]") && !!document.querySelector("[data-testid=legacy-cost-rule-recalculate]")`)) === true);
    record("読み込みだけでは保存データを変えない", JSON.stringify((await store())[CARD]) === before);

    // 現在の計算で再計算
    await ev(`document.querySelector("[data-testid=legacy-cost-rule-recalculate]").click()`);
    await sleep(400);
    const r2 = await remaining();
    record("再計算: 現行の規則（残り = 62 − 現行の累積）・案内が消える", r2 === TOTAL - currentCost(L) && (await ev(`!!document.querySelector("[data-testid=legacy-cost-rule-notice]")`)) === false, `残り${r2} 期待${TOTAL - currentCost(L)}`);
    record("再計算しても元の保存ビルドは変わらない（自分で保存するまで）", JSON.stringify((await store())[CARD]) === before);

    // 保存（新しいビルド）→ 現行の規則が記録される
    await ev(`(() => { const s = document.querySelector("[data-testid=dock-done]"); return true; })()`);
    const saved = await ev(`(() => { const b = document.querySelector("[data-testid=quick-save]"); if (!b || b.disabled) return "disabled"; b.click(); return "clicked"; })()`);
    if (saved === "disabled") {
      // クイック保存は未保存の変更があるときだけ。保存欄の「保存」を使う。
      await ev(`(() => { const i = document.querySelector("#progression-build-bar input"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "現行規則のビルド"); i.dispatchEvent(new Event("input", { bubbles: true })); const b = [...document.querySelectorAll("#progression-build-bar button")].find((x) => /^(保存|Save)$/.test(x.textContent.trim())); b?.click(); return !!b; })()`);
    }
    await sleep(600);
    const after = (await store())[CARD] ?? [];
    const newer = after.filter((b) => b.buildId !== legacy.buildId);
    record("保存した新しいビルドに現行の規則が記録される", newer.length >= 1 && newer.every((b) => b.costRuleId === "staged-2026-10-08"), JSON.stringify(newer.map((b) => b.costRuleId)));
    record("元の旧規則のビルドは costRuleId なしのまま", after.find((b) => b.buildId === legacy.buildId)?.costRuleId === undefined);
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("390px: 横のはみ出しなし", overflow <= 1, `${overflow}px`);
    record("JS の例外なし", errors.length === 0, errors.slice(0, 2).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n[black-box-cost-rule] ${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
