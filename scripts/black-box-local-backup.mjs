/**
 * F-023b 現在の領域のデータの書き出し・読み込み・削除（/data-management）のブラックボックス。
 *
 *   node scripts/black-box-local-backup.mjs            （next start を localhost:3000 で起動済み・ローカル専用）
 *
 * - 隔離ブラウザーの localStorage だけを使う（合成データ）。サーバー・DB・Production へは書き込まない。
 * - 書き出しは実際のダウンロード（./data/work/bb-local-backup/ へ保存）、読み込みは実際のファイル入力で行う。
 * - 8 viewport × 日英で表示を確認し、desktop と mobile で 書き出し → 削除 → 読み込み → 復元 を確認する。
 * - ログイン中の領域はテストダブル（?__efbAuth=1）で確認する（ゲストのデータが見えないこと）。
 */
import { writeFileSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error("local only: BASE_URL must be http://localhost:<port>");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "local-backup.md");
const DL = path.join(ROOT, "data", "work", "bb-local-backup");

const VIEWPORTS = [
  { name: "desktop-1280x720", width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
  { name: "tablet-768x1024", width: 768, height: 1024, deviceScaleFactor: 2, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, deviceScaleFactor: 2, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-393x852", width: 393, height: 852, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-430x932", width: 430, height: 932, deviceScaleFactor: 3, mobile: true },
];
const LOCALE_KEY = "efootball-team-ai:locale:v1";
const T = "2026-10-01T00:00:00.000Z";
const GUEST_MYTEAM = "efootball-team-ai:local:guest:my-team:v1";
const GUEST_HISTORY = "efootball-team-ai:local:guest:diagnosis-history:v1";
const MYTEAM = {
  storageVersion: "my-team-storage/v1",
  updatedAt: T,
  records: [{ localRecordId: "mt_bbbackup1", teamCardId: "tc_bbbackup1", worldCardId: "89138556575063", ownershipStatus: "owned", usageStatus: "main", selectedBuildId: null, favoriteBuildId: null, note: "BB", tags: [], addedAt: T, updatedAt: T, deletedAt: null, source: "local", syncStatus: "local_only" }],
};
const HISTORY = {
  schema: "efb-diagnosis-history/v1",
  entries: [{ id: "dh_bbbackup0001", savedAt: T, squadId: "sq_bb", squadLabel: "BB Squad", payload: { v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: "2026-10-01", o: [70, "A"], c: { attack: [40, "C"], defense: [47, "C"], aerial: [54, "C"], speed: [61, "B"], passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"] }, s: null, w: null } }],
};

let client;
let errors = [];
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.text}`);
  return r.result.value;
}
async function waitFor(fn, ms, label) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (await fn()) return;
    } catch {
      /* 遷移中 */
    }
    await sleep(100);
  }
  throw new Error(`timeout: ${label}`);
}
async function nav(route) {
  await client.send("Page.navigate", { url: `${BASE}${route}` });
  await waitFor(async () => (await ev("document.readyState")) === "complete", 30000, `load ${route}`);
  await sleep(700);
}
const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const counts = () => ev(`[...document.querySelectorAll('[data-testid=local-backup-counts] li')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim())`);
const setLS = (k, v) => ev(`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
const getLS = (k) => ev(`localStorage.getItem(${JSON.stringify(k)})`);

async function step(vp, locale, op, fn) {
  errors = [];
  let res;
  try {
    res = await fn();
  } catch (e) {
    res = { ok: false, detail: e.message };
  }
  const problems = [];
  if (!res.ok) problems.push(res.detail || "check failed");
  let overflow = 0;
  try {
    overflow = await ev("document.documentElement.scrollWidth - window.innerWidth");
  } catch {
    /* 遷移中 */
  }
  if (overflow > 0) problems.push(`horizontal overflow ${overflow}px`);
  if (errors.length) problems.push(`console/exception: ${errors[0]}`);
  const row = { viewport: vp.name, locale, op, ok: problems.length === 0, detail: problems.length ? problems.join(" ; ") : res.detail || "" };
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"}  [${vp.name} ${locale}] ${op}${row.detail ? `  — ${row.detail}` : ""}`);
}

async function main() {
  if (existsSync(DL)) for (const f of readdirSync(DL)) rmSync(path.join(DL, f));
  mkdirSync(DL, { recursive: true });
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  for (const d of ["Page", "Runtime", "DOM", "Log"]) await client.send(`${d}.enable`);
  await installSupabaseAuthTestDouble(client);
  await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL }).catch(() => client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL }));
  client.on("Runtime.exceptionThrown", (p) => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 200)));
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") errors.push((p.args ?? []).map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  });

  async function setFile(filePath) {
    const { root } = await client.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-testid=local-backup-import]" });
    await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  }

  try {
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      for (const locale of ["ja", "en"]) {
        await nav("/");
        await ev("localStorage.clear()");
        await setLS(LOCALE_KEY, locale);
        await setLS(GUEST_MYTEAM, JSON.stringify(MYTEAM));
        await setLS(GUEST_HISTORY, JSON.stringify(HISTORY));

        await step(vp, locale, "panel shows current guest data with counts; controls usable", async () => {
          await nav("/data-management");
          await waitFor(() => has("[data-testid=local-backup-counts]"), 10000, "counts");
          const c = await counts();
          const small = await ev(`[...document.querySelectorAll('[data-testid=local-backup] button, [data-testid=local-backup] label')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length`);
          return { ok: c.length === 2 && small === 0, detail: c.join(" | ") };
        });

        if (vp.name !== "desktop-1280x720" && vp.name !== "mobile-390x844") continue;

        await step(vp, locale, "export → delete → import → restored after reload", async () => {
          for (const f of readdirSync(DL)) rmSync(path.join(DL, f));
          await ev(`document.querySelector('[data-testid=local-backup-export]').click()`);
          await waitFor(() => readdirSync(DL).some((f) => f.endsWith(".json")), 10000, "download");
          const file = path.join(DL, readdirSync(DL).find((f) => f.endsWith(".json")));
          const exported = JSON.parse(readFileSync(file, "utf8"));
          if (!/^efootball-team-ai-backup-\d{4}-\d{2}-\d{2}\.json$/.test(path.basename(file))) throw new Error(`file name ${path.basename(file)}`);
          if (JSON.stringify(exported).match(/scopeId|userId|email|@|efb-test-double/)) throw new Error("identity in export");
          await ev(`document.querySelector('[data-testid=local-backup-delete]').click()`);
          await waitFor(() => has("[data-testid=local-backup-delete-confirm]"), 3000, "delete confirm");
          await ev(`[...document.querySelectorAll('[data-testid=local-backup-delete-confirm] button')][0].click()`);
          await waitFor(async () => (await getLS(GUEST_MYTEAM)) === null && (await ev("document.readyState")) === "complete", 10000, "deleted");
          await sleep(800);
          if ((await getLS(LOCALE_KEY)) !== locale) throw new Error("locale removed by delete");
          if ((await counts()).length !== 0) throw new Error("counts after delete");
          await setFile(file);
          await waitFor(() => has("[data-testid=local-backup-import-confirm]"), 5000, "import confirm");
          await ev(`[...document.querySelectorAll('[data-testid=local-backup-import-confirm] button')][0].click()`);
          await waitFor(async () => (await getLS(GUEST_MYTEAM)) !== null, 10000, "imported");
          await sleep(1200);
          const after = await counts();
          const restoredTeam = JSON.parse(await getLS(GUEST_MYTEAM));
          const msg = await ev(`document.querySelector('[data-testid=local-backup-message]')?.innerText ?? ''`);
          return { ok: after.length === 2 && JSON.stringify(restoredTeam) === JSON.stringify(MYTEAM) && msg.length > 0, detail: after.join(" | ") };
        });

        await step(vp, locale, "invalid file changes nothing", async () => {
          const bad = path.join(DL, "bad.json");
          writeFileSync(bad, JSON.stringify({ schema: "efb-local-backup/v1", app: "efootball-team-ai", exportedAt: T, sections: { myTeam: { ...MYTEAM, records: [{ worldCardId: "<x>" }] } } }));
          const before = await getLS(GUEST_MYTEAM);
          await setFile(bad);
          await waitFor(async () => (await ev(`document.querySelector('[data-testid=local-backup-message]')?.innerText ?? ''`)).length > 0, 5000, "error message");
          const confirmShown = await has("[data-testid=local-backup-import-confirm]");
          return { ok: !confirmShown && (await getLS(GUEST_MYTEAM)) === before, detail: "rejected" };
        });

        await step(vp, locale, "signed-in area (test double) does not show guest data", async () => {
          await nav("/data-management?__efbAuth=1");
          await waitFor(async () => (await ev(`document.querySelector('[data-testid=local-backup]')?.innerText ?? ''`)).match(/アカウント|account/), 10000, "account region");
          await sleep(500);
          const c = await counts();
          return { ok: c.length === 0, detail: `account counts=${c.length}` };
        });
      }
    }
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
    if (existsSync(DL)) for (const f of readdirSync(DL)) rmSync(path.join(DL, f));
  }

  const failed = results.filter((r) => !r.ok);
  const L = [
    "# F-023b 現在の領域のデータ（書き出し・読み込み・削除） ブラックボックス",
    "",
    `実行日時: ${new Date().toISOString()}`,
    "対象: localhost（Production Build）・隔離ブラウザーの localStorage の合成データだけ。サーバー・DB・Production へは書き込まない。",
    "",
    "| 結果 | viewport | locale | 確認 | 詳細 |",
    "|---|---|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.viewport} | ${r.locale} | ${escapeMarkdownCell(r.op)} | ${escapeMarkdownCell(String(r.detail))} |`),
    "",
    `## 判定: ${results.length - failed.length}/${results.length} PASS`,
    "",
  ];
  writeFileSync(REPORT, L.join("\n"), "utf8");
  console.log(`\n[black-box-local-backup] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
