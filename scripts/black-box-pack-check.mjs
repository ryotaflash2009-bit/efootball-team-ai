/**
 * パック診断（/pack-check・2026-10-17）のブラックボックス。
 *
 *   node scripts/black-box-pack-check.mjs   （事前に npm run build・node scripts/local-server.mjs start）
 *
 * - カードを選んでいなければ「まだカードを選んでいません」。
 * - 検索して「追加」を押すと URL の ids に入り、結果の一覧に出る。
 * - My Team に弱い CF と Roberto Carlos（LB）を「所持」で入れ、パックに強い CF・弱い CF そのもの・GK・Roberto Carlos の別のカードを
 *   入れると、強化・所持済み・持っていないポジション・同じ選手の目印が出る。まとめの件数が合う。
 * - 最近追加されたカードの一覧から追加できる。
 * - 390px で横のはみ出しなし・JS の例外なし。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition } from "./lib/headless-chrome.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "pack-check.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MY_TEAM_KEY = "efootball-team-ai:local:guest:my-team:v1";
const NOW = "2026-10-17T00:00:00.000Z";
// 実データ: Roberto Carlos の 2 枚（カード ID の下位 20 ビットが同じ）
const RC_A = "88039581945292";
const RC_B = "88033139494348";
const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const myTeamRecord = (id) => ({ localRecordId: `mt_${id}`, teamCardId: `tc_${id}`, worldCardId: id, ownershipStatus: "owned", usageStatus: "unused", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: NOW, updatedAt: NOW, deletedAt: null, source: "local", syncStatus: "local_only" });

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.text ?? "exception"));
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const go = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 15000, intervalMs: 100 });
    await new Promise((r) => setTimeout(r, 800));
  };
  const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
  const waitFor = (sel, ms = 12000) => waitForCondition(() => has(sel), { timeoutMs: ms, intervalMs: 200 }).catch(() => {});
  const top = (q) => ev(`(async () => (await (await fetch("/api/world/players?pageSize=1&${q}")).json()).players?.[0]?.worldCardId ?? null)()`);
  try {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await go(`${BASE}/pack-check`);
    await ev(`localStorage.setItem("efootball-team-ai:locale:v1", "ja"); localStorage.removeItem(${JSON.stringify(MY_TEAM_KEY)})`);
    await go(`${BASE}/pack-check`);
    record("カードを選んでいなければ空の案内", await has('[data-testid="pack-check-empty"]'), "");

    // 検索して追加
    await ev(`(() => { const i = document.querySelector('[data-testid="pack-check-search"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "メッシ"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await waitFor('[data-testid="pack-check-search-results"] [data-testid="pack-check-add"]');
    await ev(`document.querySelector('[data-testid="pack-check-search-results"] [data-testid="pack-check-add"]').click()`);
    await waitFor('[data-testid="pack-check-list"] li');
    const url1 = await ev("location.search");
    record("検索して追加すると URL の ids と結果の一覧に入る", /^\?ids=\d+$/.test(url1) && (await has('[data-testid="pack-check-list"] li')), url1);
    // 続けて 2 枚を素早く追加しても、どちらも残る（URL の更新を待たない）
    await ev(`(() => { const b = [...document.querySelectorAll('[data-testid="pack-check-search-results"] [data-testid="pack-check-add"]')].filter((x) => !x.disabled); b[0]?.click(); b[1]?.click(); })()`);
    await waitForCondition(async () => ((await ev("location.search")) || "").split(",").length >= 3, { timeoutMs: 8000, intervalMs: 200 }).catch(() => {});
    const url2 = await ev("location.search");
    record("続けて素早く 2 枚を追加しても両方が残る", (url2 || "").replace("?ids=", "").split(",").length === 3, url2);

    // 所持と比べる
    const weakCf = await top("sort=ovr_max_asc&position=CF");
    const strongCf = await top("sort=ovr_max_desc&position=CF");
    const gk = await top("sort=ovr_max_desc&position=GK");
    await ev(`localStorage.setItem(${JSON.stringify(MY_TEAM_KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: NOW, records: [myTeamRecord(weakCf), myTeamRecord(RC_A)] }))})`);
    await go(`${BASE}/pack-check?ids=${[strongCf, weakCf, gk, RC_B].join(",")}`);
    await waitForCondition(async () => (await ev(`document.querySelectorAll('[data-testid="pack-check-list"] li').length`)) === 4, { timeoutMs: 15000, intervalMs: 200 }).catch(() => {});
    const verdicts = (await ev(`Object.fromEntries([...document.querySelectorAll('[data-testid="pack-check-list"] li')].map((li) => [li.querySelector("a").getAttribute("href").split("/").pop(), li.dataset.verdict]))`)) ?? {};
    record("強い CF は「強化」", verdicts[strongCf] === "upgrade", JSON.stringify(verdicts));
    record("所持している CF そのものは「所持済み」", verdicts[weakCf] === "already_owned", "");
    record("GK を持っていなければ「持っていないポジション」", verdicts[gk] === "new_position", "");
    const rcText = (await ev(`[...document.querySelectorAll('[data-testid="pack-check-list"] li')].find((li) => li.querySelector("a").getAttribute("href").endsWith(${JSON.stringify(RC_B)}))?.innerText ?? ""`)) || "";
    record("同じ選手の別のカードを所持していれば目印", /同じ選手の別のカード/.test(rcText), rcText.replace(/\s+/g, " ").slice(0, 120));
    const summary = (await ev(`document.querySelector('[data-testid="pack-check-summary"]')?.innerText ?? ""`)) || "";
    const upgrades = Object.values(verdicts).filter((v) => v === "upgrade").length;
    record("まとめの件数が一覧と合う", summary.includes(`4 枚のうち、強化 ${upgrades} 枚`) && summary.includes("所持済み 1 枚"), summary.replace(/\s+/g, " "));

    // 選手の詳細: My Team と比べる（所持は弱い CF と Roberto Carlos のまま）
    const fitOf = async (id) => {
      await go(`${BASE}/players/world/${id}`);
      await waitFor('[data-testid="my-team-fit"]', 15000);
      return ev(`document.querySelector('[data-testid="my-team-fit"]')?.dataset.verdict ?? null`);
    };
    record("選手の詳細: 強い CF は「強化」", (await fitOf(strongCf)) === "upgrade", "");
    record("選手の詳細: 所持している CF は「所持済み」", (await fitOf(weakCf)) === "already_owned", "");
    const fitLink = await ev(`document.querySelector('[data-testid="my-team-fit-pack-check"]')?.getAttribute("href") ?? null`);
    await fitOf(strongCf);
    const fitLink2 = await ev(`document.querySelector('[data-testid="my-team-fit-pack-check"]')?.getAttribute("href") ?? null`);
    record("選手の詳細: パック診断へのリンク（所持済みには出さない）", fitLink === null && fitLink2 === `/pack-check?ids=${strongCf}`, String(fitLink2));
    await ev(`localStorage.removeItem(${JSON.stringify(MY_TEAM_KEY)})`);
    await go(`${BASE}/players/world/${strongCf}`);
    await new Promise((r) => setTimeout(r, 1500));
    record("選手の詳細: My Team が空なら比較の欄を出さない", !(await has('[data-testid="my-team-fit"]')), "");

    // 最近追加されたカードから追加
    await go(`${BASE}/pack-check`);
    await ev(`(() => { const d = document.querySelector('[data-testid="pack-check-new-cards"]'); d.open = true; })()`);
    await waitFor('[data-testid="pack-check-new-cards"] [data-testid="pack-check-add"]', 15000);
    const newCount = await ev(`document.querySelectorAll('[data-testid="pack-check-new-cards"] [data-testid="pack-check-add"]').length`);
    if (newCount > 0) {
      await ev(`document.querySelector('[data-testid="pack-check-new-cards"] [data-testid="pack-check-add"]').click()`);
      await waitFor('[data-testid="pack-check-list"] li');
    }
    record("最近追加されたカードの一覧から追加できる", newCount > 0 && (await has('[data-testid="pack-check-list"] li')), `${newCount} cards`);

    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await go(`${BASE}/pack-check?ids=${[strongCf, weakCf, gk, RC_B].join(",")}`);
    await waitFor('[data-testid="pack-check-list"] li');
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("390px で横のはみ出しなし", overflow <= 1, `overflow=${overflow}`);
    record("ページ内で JS の例外が起きない", errors.length === 0, errors.slice(0, 2).join(" / "));
    await ev(`localStorage.removeItem(${JSON.stringify(MY_TEAM_KEY)})`);
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const L = ["# パック診断 ブラックボックステスト結果", "", `実行日時: ${new Date().toISOString()}`, `対象: ${BASE}`, "", "| 結果 | 項目 | 詳細 |", "|---|---|---|", ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`), "", `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`, ""];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`\n[black-box-pack-check] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
