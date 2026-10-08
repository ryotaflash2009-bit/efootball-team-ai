#!/usr/bin/env node
/**
 * 選手一覧の保存した絞り込み（NEW-31・2026-10-09）の black-box。npm run build && npm run start の後に
 *   node scripts/black-box-saved-filters.mjs
 * - 分離したヘッドレス Chrome（一時のプロファイル）。実際の利用者の保存データには触れない。
 * - 確認: 条件が無いときは保存しない・名前をつけて保存（ページ番号・未知の項目は保存しない）・再読み込みで残る・選ぶと同じ条件へ移る・
 *   同じ名前は上書き・削除・英語・390px で横のはみ出しなし・JS の例外なし・ダイアログを出さない。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const KEY = "efootball-team-ai:local:guest:saved-player-filters:v1";
const LOCALE_KEY = "efootball-team-ai:locale:v1";
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
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const errors = [];
  let dialogs = 0;
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? "exception"));
  client.on("Page.javascriptDialogOpening", () => {
    dialogs++;
    client.send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
  });
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const nav = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 15000, intervalMs: 100 });
    await waitForCondition(async () => (await ev(`!!document.querySelector('[data-testid="saved-player-filters"]')`)) === true, { timeoutMs: 15000, intervalMs: 150 });
    await sleep(300);
  };
  const click = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return false; e.click(); return true; })()`);
  const typeName = (v) =>
    ev(`(() => { const i = document.querySelector('[data-testid="saved-filter-name"]'); if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  const status = () => ev(`document.querySelector('[data-testid="saved-player-filters"] [role="status"]')?.textContent ?? ""`);
  const stored = () => ev(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "null")`);

  try {
    // 条件なし
    await nav(`${BASE}/players`);
    await click('[data-testid="saved-filter-save"]');
    await typeName("なし");
    await click('[data-testid="saved-filter-confirm"]');
    await sleep(200);
    record("条件が無いときは保存せず、案内だけ", /保存する条件がありません/.test(await status()) && (await stored()) === null, await status());

    // 保存
    await nav(`${BASE}/players?position=CF&minOvr=90&page=2&evil=1`);
    await click('[data-testid="saved-filter-save"]');
    await typeName("  CF 90+  ");
    await click('[data-testid="saved-filter-confirm"]');
    await sleep(200);
    const s1 = await stored();
    record("名前をつけて保存（ページ番号・未知の項目は保存しない）", s1?.items?.length === 1 && s1.items[0].name === "CF 90+" && s1.items[0].query === "position=CF&minOvr=90" && /保存しました/.test(await status()), JSON.stringify(s1?.items?.[0] ?? null));

    // 再読み込み → 一覧に出る・今の条件が選ばれた状態（page と evil を除いた同じ条件）
    await nav(`${BASE}/players?position=CF&minOvr=90`);
    const sel = await ev(`(() => { const s = document.querySelector('[data-testid="saved-filter-select"]'); return s ? { value: s.value, options: [...s.options].map((o) => o.textContent) } : null; })()`);
    record("再読み込みで残り、今の条件と同じものが選ばれている", !!sel && sel.options.includes("CF 90+") && sel.value === s1.items[0].id, JSON.stringify(sel));

    // 別の条件から選ぶ → 移動
    await nav(`${BASE}/players?q=messi`);
    await ev(`(() => { const s = document.querySelector('[data-testid="saved-filter-select"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, ${JSON.stringify(s1.items[0].id)}); s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
    await waitForCondition(async () => /position=CF/.test(await ev("location.search")), { timeoutMs: 10000, intervalMs: 150 }).catch(() => {});
    const search = await ev("location.search");
    record("選ぶと保存した条件の一覧へ移る", search === "?position=CF&minOvr=90", search);

    // 同じ名前で上書き
    await nav(`${BASE}/players?position=CB`);
    await click('[data-testid="saved-filter-save"]');
    await typeName("CF 90+");
    await click('[data-testid="saved-filter-confirm"]');
    await sleep(200);
    const s2 = await stored();
    record("同じ名前は上書き（件数は増えない）", s2?.items?.length === 1 && s2.items[0].query === "position=CB" && /上書き/.test(await status()), JSON.stringify(s2?.items?.map((x) => x.query)));

    // 削除
    await nav(`${BASE}/players?position=CB`);
    await click('[data-testid="saved-filter-delete"]');
    await sleep(200);
    record("選んだものを削除できる", (await stored())?.items?.length === 0 && !(await ev(`!!document.querySelector('[data-testid="saved-filter-select"]')`)));

    // 390px
    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await nav(`${BASE}/players?position=CF`);
    await click('[data-testid="saved-filter-save"]');
    await sleep(150);
    record("390px で横のはみ出しなし（名前の入力を開いた状態）", (await ev("document.documentElement.scrollWidth <= window.innerWidth + 1")) === true, String(await ev("document.documentElement.scrollWidth")));

    // 英語
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "en")`);
    await nav(`${BASE}/players`);
    const en = await ev(`document.querySelector('[data-testid="saved-player-filters"]').innerText`);
    record("英語の表示", /Save current filters/.test(en) && /Saved on this device only/.test(en) && !/[ぁ-ん]/.test(en), en.replace(/\n/g, " / "));
    record("ダイアログを出さない", dialogs === 0, String(dialogs));
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
