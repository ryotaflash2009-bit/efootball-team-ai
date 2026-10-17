/**
 * 新しいカードの画面（/players/new・2026-10-17）のブラックボックス。
 *
 *   node scripts/black-box-new-cards.mjs   （事前に npm run build・node scripts/local-server.mjs start）
 *
 * - 最近追加された正式なカードの一覧が出る（直近 7 日・枚数の表示）。
 * - My Team が空なら「My Team に登録すると…」の案内。
 * - My Team に弱いカード（CF）を「所持」で入れると、それより強い新しいカード（CF）が比較の一覧に出る。
 * - 390px で横のはみ出しなし・JS の例外なし。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition } from "./lib/headless-chrome.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "new-cards.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MY_TEAM_KEY = "efootball-team-ai:local:guest:my-team:v1";
const NOW = "2026-10-17T00:00:00.000Z";
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
  try {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await go(`${BASE}/players/new`);
    await ev(`localStorage.setItem("efootball-team-ai:locale:v1", "ja"); localStorage.removeItem(${JSON.stringify(MY_TEAM_KEY)})`);
    await go(`${BASE}/players/new`);
    const heading = (await ev(`document.querySelector('[data-testid="recently-added"]')?.innerText ?? ""`)) || "";
    const recentCount = (await ev(`document.querySelectorAll('[data-testid="recently-added-grid"] a[href^="/players/world/"]').length`)) ?? 0;
    record("最近追加されたカードの一覧（直近 7 日・枚数の表示）", /最近追加されたカード（直近 7 日・\d+ 枚）/.test(heading) && recentCount > 0, `${recentCount} cards`);
    await waitFor('[data-testid="new-cards-impact-no-team"]');
    record("My Team が空なら登録の案内", await has('[data-testid="new-cards-impact-no-team"]'), "");

    // 最近追加された CF のカードの最小の OVR より弱い CF のカードを所持にする
    const recentCf = await ev(`(async () => {
      const ids = [...new Set([...document.querySelectorAll('[data-testid="recently-added-grid"] a[href^="/players/world/"]')].map((a) => a.getAttribute("href").split("/").pop()))];
      const j = await (await fetch("/api/world/players/by-ids?ids=" + ids.slice(0, 200).join(","))).json();
      return (j.players || []).filter((p) => p.registeredPosition === "CF").map((p) => p.ovrMax ?? p.ovrBase).filter((v) => typeof v === "number");
    })()`);
    const weak = await ev(`(async () => (await (await fetch("/api/world/players?pageSize=1&sort=ovr_max_asc&position=CF")).json()).players?.[0]?.worldCardId ?? null)()`);
    await ev(`localStorage.setItem(${JSON.stringify(MY_TEAM_KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: NOW, records: weak ? [myTeamRecord(weak)] : [] }))})`);
    await go(`${BASE}/players/new`);
    await waitFor('[data-testid="new-cards-impact-list"]', 15000);
    const rows = (await ev(`[...document.querySelectorAll('[data-testid="new-cards-impact-list"] li')].map((li) => li.innerText.replace(/\\s+/g, " "))`)) ?? [];
    const cfRows = rows.filter((r) => /^CF /.test(r));
    record("所持の弱い CF より強い新しい CF が比較に出る（+差・あなたのカード名）", recentCf.length === 0 ? true : cfRows.length > 0 && cfRows.every((r) => /より \+\d+/.test(r)), `${cfRows.length} CF rows / ${rows.length} rows; e.g. ${rows[0] ?? "-"}`);
    record("持っていないポジションは「まだ持っていません」と出る", rows.some((r) => /まだ持っていません/.test(r)), "");

    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await go(`${BASE}/players/new`);
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("390px で横のはみ出しなし", overflow <= 1, `overflow=${overflow}`);
    record("ページ内で JS の例外が起きない", errors.length === 0, errors.slice(0, 2).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const L = ["# 新しいカードの画面 ブラックボックステスト結果", "", `実行日時: ${new Date().toISOString()}`, `対象: ${BASE}`, "", "| 結果 | 項目 | 詳細 |", "|---|---|---|", ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`), "", `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`, ""];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`\n[black-box-new-cards] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
