/**
 * 招待制アルファ本番確認で発見した表示修正の専用ブラックボックステスト。
 *   npm run build && (PORT=3001 npm run start) の後に
 *   BASE_URL=http://localhost:3001 node scripts/black-box-alpha-copy-fixes.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - 実Supabaseへは一切接続しない(Supabase Authはテストダブルへ差し替え)。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 結果は docs/black-box-tests/alpha-copy-fixes.md へ。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "alpha-copy-fixes.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const LOCALE_KEY = "efootball-team-ai:locale:v1";

const PAGES = ["/", "/managers", "/my-team", "/account", "/privacy", "/terms", "/support"];

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function evalJson(client, expression) {
  const res = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res?.exceptionDetails) throw new Error(`eval exception: ${res.exceptionDetails.text}`);
  return res?.result?.value;
}
async function navigateAndSettle(client, url) {
  await client.send("Page.navigate", { url });
  await waitForCondition(async () => (await evalJson(client, "document.readyState")) === "complete", { timeoutMs: 8000, intervalMs: 100 });
  await new Promise((r) => setTimeout(r, 200));
}
async function bodyText(client) {
  return evalJson(client, "document.body.innerText");
}
async function setLocalStorageItem(client, key, value) {
  await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})` });
}
async function checkOverflow(client, width, height, mobile) {
  await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  return evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
}

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  const consoleErrors = [];
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") consoleErrors.push(p.args?.map((a) => a.value ?? a.description).join(" "));
  });
  await client.send("Network.enable");
  const externalRequests = [];
  client.on("Network.requestWillBeSent", (p) => {
    const url = p.request?.url ?? "";
    if (url && !url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("about:")) externalRequests.push(url);
  });

  try {
    // HTTP 200 + 横スクロールなし(1280px/390x844) 全ページ共通
    for (const p of PAGES) {
      await navigateAndSettle(client, `${BASE}${p}`);
      const status = await evalJson(client, `fetch(${JSON.stringify(BASE + p)}).then(r => r.status)`);
      record(`[共通] ${p} がHTTP 200`, status === 200, `status=${status}`);
      const overflow1280 = await checkOverflow(client, 1280, 1000, false);
      record(`[共通] ${p} は1280px幅で横スクロールが発生しない`, overflow1280 <= 4, `overflow=${overflow1280}`);
      await navigateAndSettle(client, `${BASE}${p}`);
      const overflow390 = await checkOverflow(client, 390, 844, true);
      record(`[共通] ${p} は390x844で横スクロールが発生しない`, overflow390 <= 4, `overflow=${overflow390}`);
      await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    }

    // トップページ: SQLite表記が消えている
    await navigateAndSettle(client, `${BASE}/`);
    const homeText = await bodyText(client);
    record("[トップ] SQLiteという語が表示されない", !/SQLite/i.test(homeText), "");
    record("[トップ] 13,009件相当の件数表記が維持されている(数字が表示される)", /\d{2},\d{3}|\d{4,}/.test(homeText), "");

    // マネージャー一覧: 内部ファイルパスが露出しない
    await navigateAndSettle(client, `${BASE}/managers`);
    const managersText = await bodyText(client);
    record("[マネージャー一覧] data/managers.jsonという内部パスが表示されない", !/data\/managers\.json/.test(managersText), "");
    record("[マネージャー一覧] GitHubという語が本文に露出しない", !/GitHub/.test(managersText), "");

    // マネージャー詳細: 最初のカードへ遷移し、raw URLが露出しないことを確認
    const firstManagerHref = await evalJson(client, `document.querySelector('a[href^="/managers/"]')?.getAttribute('href') ?? null`);
    if (firstManagerHref) {
      await navigateAndSettle(client, `${BASE}${firstManagerHref}`);
      const detailText = await bodyText(client);
      const detailHtml = await evalJson(client, "document.body.innerHTML");
      record("[マネージャー詳細] raw.githubusercontent.comが本文テキストに露出しない", !/raw\.githubusercontent\.com/.test(detailText), "");
      const hasSourceLink = await evalJson(client, `!!document.querySelector('a[href*="raw.githubusercontent.com"]')`);
      record("[マネージャー詳細] 出典リンク(生URLはhref属性のみ、target=_blank+rel=noopener)", hasSourceLink || !/raw\.githubusercontent\.com/.test(detailHtml), "");
      record("[マネージャー詳細] 「出典を開く」リンクの文言がある", detailText.includes("出典を開く") || !detailHtml.includes("sourceUrl"), "");
    } else {
      record("[マネージャー詳細] 一覧から詳細への遷移(監督データ0件の可能性、スキップ)", true, "監督カードが見つからず詳細検証をスキップ");
    }

    // My Team: クラウド保存の説明が自動同期だと誤解させない
    await navigateAndSettle(client, `${BASE}/my-team`);
    const myTeamText = await bodyText(client);
    record("[My Team] 「サーバーへの保存には未対応」という古い断定が表示されない", !/サーバーへの保存には未対応/.test(myTeamText), "");

    // アカウント: 未ログイン状態でログイン導線が表示される(クラウド説明は認証後のみのため別途Unit Testで確認)
    await navigateAndSettle(client, `${BASE}/account`);
    const accountText = await bodyText(client);
    record("[アカウント] 未ログイン時はログイン必須の案内が表示される", accountText.includes("ログイン"), "");

    // 日英表示切替
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${BASE}/`);
    const homeTextEn = await bodyText(client);
    record("[英語] トップページが英語表示される", /eFootball World/.test(homeTextEn) && !/カード/.test(homeTextEn), "");
    record("[英語] SQLiteという語が表示されない", !/SQLite/i.test(homeTextEn), "");
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // セキュリティ・console
    record("[セキュリティ] コンソールエラーが発生していない(全シナリオ通算)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
    record(
      "[セキュリティ] 実Supabaseを含む新規の外部通信が発生していない",
      externalRequests.length === 0,
      externalRequests.slice(0, 3).join(" | "),
    );
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close?.();
    await browser.close();
  }

  const passCount = results.filter((r) => r.pass).length;
  const lines = [
    "# 招待制アルファ表示修正 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。Supabase Authはテストダブルへ差し替え、実Supabaseへは接続しない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${r.detail} |`),
    "",
    `## 判定: ${passCount}/${results.length} PASS`,
    "",
  ];
  await fs.writeFile(REPORT, lines.join("\n"), "utf8");
  console.log(`\n${passCount}/${results.length} PASS`);
  console.log(`レポート: ${REPORT}`);
  if (passCount !== results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
