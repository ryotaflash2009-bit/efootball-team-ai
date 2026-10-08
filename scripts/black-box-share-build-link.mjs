#!/usr/bin/env node
/**
 * 育成の配分の共有リンク（2026-10-09）の black-box。npm run build && npm run start の後に
 *   node scripts/black-box-share-build-link.mjs
 * - 分離したヘッドレス Chrome。選手の育成タブで自動配分 → 「この配分をリンクでコピー」→ そのリンクを開くと、比較の画面で同じカテゴリのレベルになる。
 * - クリップボードの許可が無い環境では、代わりに表示されるリンクの欄を読む（どちらでも同じリンク）。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const CARD = "89136409091415";
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
  await client.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: BASE }).catch(() => {});
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? "exception"));
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  /** 条件が満たされるまで待つ（満たされなければ理由つきで失敗させる）。 */
  const must = async (label, fn, timeoutMs) => {
    const ok = await waitForCondition(fn, { timeoutMs, intervalMs: 200 });
    if (!ok) throw new Error(`timeout: ${label}`);
  };
  const nav = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 20000, intervalMs: 100 });
  };

  try {
    await nav(`${BASE}/players/world/${CARD}?tab=progression`);
    await must("share button", async () => (await ev(`!!document.querySelector('[data-testid="share-build-link"] button')`)) === true, 20000);
    record("配分が無いときはボタンを押せない", (await ev(`document.querySelector('[data-testid="share-build-link"] button').disabled`)) === true);
    // 読み込み直後（hydration の前）の押下は効かないため、配分が入るまで押し直す。
    await must("allocation", async () => {
      await ev(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "攻撃重視")?.click()`);
      await sleep(400);
      return (await ev(`document.querySelector('[data-testid="share-build-link"] button').disabled`)) === false;
    }, 15000);
    await ev(`document.querySelector('[data-testid="share-build-link"] button').click()`);
    await must("status", async () => !!(await ev(`document.querySelector('[data-testid="share-build-link"] [role="status"]')?.textContent`)), 10000);
    const status = await ev(`document.querySelector('[data-testid="share-build-link"] [role="status"]').textContent`);
    let url = await ev(`document.querySelector('[data-testid="share-build-link-url"]')?.value ?? null`);
    if (!url) url = await ev(`navigator.clipboard.readText().catch(() => null)`);
    record("リンクを作る（コピー、またはコピーできないときはリンクの欄）", !!url && /\/compare\?ids=89136409091415&al=/.test(decodeURIComponent(url)), `${status} ${url ?? ""}`.slice(0, 160));
    const al = decodeURIComponent(new URL(url).searchParams.get("al") ?? "");
    const expected = Object.fromEntries(al.split(".").map((p) => p.split("~")).map(([k, v]) => [k, Number(v)]));
    record("リンクに入るのはカードの ID とカテゴリのレベルだけ", [...new URL(url).searchParams.keys()].sort().join(",") === "al,ids" && Object.keys(expected).length > 0, JSON.stringify(expected));

    await nav(url);
    // 1 人の比較の画面: 列に「手動育成」と、配分の消費ポイント（今の規則: レベル L に ceil(L/4)）が出る
    const cost = (lv) => Array.from({ length: lv }, (_, i) => Math.ceil((i + 1) / 4)).reduce((a, b) => a + b, 0);
    const used = Object.values(expected).reduce((a, lv) => a + cost(lv), 0);
    await must("compare column", async () => /手動育成/.test(await ev(`document.querySelector("main")?.innerText ?? ""`)), 45000);
    const text = await ev(`document.querySelector("main").innerText`);
    const shown = (text.match(/(\d+) \/ (\d+)pt/) ?? [])[1];
    record("リンクを開くと比較の画面で同じ配分（手動育成・同じ消費ポイント）", /現在: 手動育成/.test(text) && Number(shown) === used, `期待 ${used}pt / 表示 ${shown}pt`);
    // My Builds の各ビルドからも同じリンクを作れる
    const BUILDS_KEY = "efootball-team-ai:local:guest:progression-builds:v1";
    const build = { buildId: "bbShare01", worldCardId: CARD, buildName: "共有テスト", progressionAllocation: { shooting: 6, dribbling: 5 }, selectedPlayerBooster: null, conditionalBoosterSelections: [], calculatedStats: {}, calculatedOvr: null, calculationMode: "provisional", rulesVersion: "progression/2026-08-28.v2", costRuleId: "staged-2026-10-08", createdAt: "2026-10-09T00:00:00.000Z", updatedAt: "2026-10-09T00:00:00.000Z", schemaVersion: 1 };
    await ev(`localStorage.setItem(${JSON.stringify(BUILDS_KEY)}, ${JSON.stringify(JSON.stringify({ [CARD]: [build] }))})`);
    await nav(`${BASE}/my-builds`);
    await must("my-builds share", async () => (await ev(`!!document.querySelector('[data-testid="share-build-link"] button:not([disabled])')`)) === true, 20000);
    await ev(`document.querySelector('[data-testid="share-build-link"] button').click()`);
    await must("my-builds status", async () => !!(await ev(`document.querySelector('[data-testid="share-build-link"] [role="status"]')?.textContent`)), 10000);
    let url2 = await ev(`document.querySelector('[data-testid="share-build-link-url"]')?.value ?? null`);
    if (!url2) url2 = await ev(`navigator.clipboard.readText().catch(() => null)`);
    record("My Builds の保存したビルドから同じ形のリンクを作れる", !!url2 && decodeURIComponent(url2).endsWith("/compare?ids=89136409091415&al=dribbling~5.shooting~6"), url2 ?? "");
    record("JS の例外なし", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
