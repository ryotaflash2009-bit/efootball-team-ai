/**
 * 招待制アルファ公開前の最終表示整合(/release-readiness・/account metadata)の
 * 専用ブラックボックステスト。
 *   npm run build && (PORT=3001 npm run start) の後に
 *   BASE_URL=http://localhost:3001 node scripts/black-box-final-alpha-readiness-copy.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - 実Supabaseへは一切接続しない(Supabase Authはテストダブルへ差し替え)。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 結果は docs/black-box-tests/final-alpha-readiness-copy.md へ。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "final-alpha-readiness-copy.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const LOCALE_KEY = "efootball-team-ai:locale:v1";

const PAGES = ["/release-readiness", "/account", "/privacy", "/terms", "/support"];

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
  await new Promise((r) => setTimeout(r, 250));
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

    // /release-readiness: 内容の正確性
    await navigateAndSettle(client, `${BASE}/release-readiness`);
    const rrText = await bodyText(client);
    record("[release-readiness] 「ログイン機構は未実装」という古い断定がない", !/ログイン機構は未実装/.test(rrText), "");
    record("[release-readiness] 「アカウントの概念が無い」という古い断定がない", !/アカウントの概念が無い/.test(rrText), "");
    record("[release-readiness] 「本番ホスティングは未整備」という古い断定がない", !/本番ホスティングは未整備/.test(rrText), "");
    record("[release-readiness] Supabase Authに言及がある", /Supabase Auth/.test(rrText), "");
    record("[release-readiness] RLSに言及がある", /RLS/.test(rrText), "");
    record("[release-readiness] My Teamクラウド保存(アルファ機能・明示操作)への言及がある", /明示操作/.test(rrText), "");
    record("[release-readiness] 端末間の完全な自動同期は未実装と明記される", /完全な自動同期/.test(rrText) && /未実装/.test(rrText), "");
    record("[release-readiness] Supabase参照データ経路への言及がある(利用可能な機能欄)", /Supabase.*参照データ経路|参照データ.*Supabase/.test(rrText), "");
    record("[release-readiness] SQLite切戻しへの言及がある", /SQLite/.test(rrText), "");
    record("[release-readiness] 自動更新dry-runへの言及がある", /dry-run/.test(rrText), "");
    record("[release-readiness] Cronが未実装と明記される", /Cron/.test(rrText) && /未実装/.test(rrText), "");
    record("[release-readiness] 内部PID・SQLiteテーブル名等が露出しない", !/world_player_cards|server\.pid|localhost:3000/i.test(rrText), "");

    // /account: metadataとページ本文
    await navigateAndSettle(client, `${BASE}/account`);
    const accountText = await bodyText(client);
    const accountDescription = await evalJson(client, `document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''`);
    record("[account] metadata descriptionに古い断定(技術検証段階。クラウド同期は未実装)がない", !/技術検証段階。クラウド同期は未実装/.test(accountDescription), "");
    record("[account] metadata descriptionがSupabase Authに言及", /Supabase Auth/.test(accountDescription), "");
    record("[account] metadata descriptionがMy Teamクラウド保存に言及", /My Team.*クラウド保存/.test(accountDescription), "");
    record("[account] metadata descriptionが端末間自動同期は未対応と明記", /端末間の自動同期は未対応/.test(accountDescription), "");
    record("[account] 未ログイン時はログイン必須の案内が表示される", accountText.includes("ログイン"), "");
    record("[account] RLSテストページへの一般利用者向けリンクがない", !/\/account\/rls-test/.test(await evalJson(client, "document.body.innerHTML")), "");

    // Privacy/Terms/Supportとの矛盾確認(内容が変わっていないことの簡易確認)
    await navigateAndSettle(client, `${BASE}/privacy`);
    const privacyText = await bodyText(client);
    record("[privacy] クラウド保存が明示操作時のみである説明が維持されている", /明示的な操作/.test(privacyText), "");

    // 日英
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${BASE}/release-readiness`);
    const rrTextEn = await bodyText(client);
    record("[英語] release-readinessが英語表示され、Supabase Authに言及", /Supabase Auth/.test(rrTextEn) && !/このページでは/.test(rrTextEn), "");
    record("[英語] 「login mechanism is not implemented」という古い断定がない", !/login mechanism is not implemented/i.test(rrTextEn), "");
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    record("[セキュリティ] コンソールエラーが発生していない(全シナリオ通算)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
    record("[セキュリティ] 実Supabaseを含む新規の外部通信が発生していない", externalRequests.length === 0, externalRequests.slice(0, 3).join(" | "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close?.();
    await browser.close();
  }

  const passCount = results.filter((r) => r.pass).length;
  const lines = [
    "# 招待制アルファ最終表示整合 ブラックボックステスト結果",
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
