/**
 * 問い合わせ窓口(公開専用メールアドレス)有効化の専用ブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-support-contact.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 新規外部通信・生成AI・APIキー・追加料金は一切発生しない(mailtoリンクのみ・送信バックエンドなし)。
 * - 結果は docs/black-box-tests/support-contact.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "support-contact.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const CONFIGURED_EMAIL = "efootballteamAIsuportteam@outlook.jp";

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
async function getMailtoHrefs(client) {
  return evalJson(client, `[...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href'))`);
}
const UNREPLACED_VAR_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}|__[A-Z_]+__|example@example\.com|TODO\b/;
const PERSONAL_INFO_RE = /\d{2,4}-\d{2,4}-\d{4}|東京都|大阪府|〒\d{3}|Microsoft account|recovery code|回復コード:/i;

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  const errors = [];
  const consoleErrors = [];
  const networkRequests = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.text ?? "exception"));
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") consoleErrors.push(p.args?.map((a) => a.value ?? a.description).join(" "));
  });
  await client.send("Network.enable");
  client.on("Network.requestWillBeSent", (p) => networkRequests.push(p.request?.url ?? ""));

  try {
    // ============================================================
    // 日本語: /support
    // ============================================================
    await navigateAndSettle(client, `${BASE}/support`);
    const jaBody = await bodyText(client);
    record("[日本語] 一般問い合わせの案内が表示される", jaBody.includes("一般的なお問い合わせ"), "");
    record("[日本語] 不具合報告の案内が表示される", jaBody.includes("不具合報告"), "");
    record("[日本語] 権利者からの連絡の案内が表示される", jaBody.includes("権利者"), "");
    record("[日本語] プライバシー問い合わせの案内が表示される", jaBody.includes("プライバシーに関するお問い合わせ") || jaBody.includes("プライバシーやローカルデータ"), "");
    record("[日本語] 正しいメールアドレスが表示される", jaBody.includes(CONFIGURED_EMAIL), "");
    record("[日本語] 準備中表示が消えている", !jaBody.includes("問い合わせ窓口は公開前準備中です"), "");
    const jaMailtos = await getMailtoHrefs(client);
    record("[日本語] mailtoリンクが正しい宛先を持つ", jaMailtos.length > 0 && jaMailtos.every((h) => h.startsWith(`mailto:${CONFIGURED_EMAIL}`)), JSON.stringify(jaMailtos));
    record("[日本語] 本名・住所・電話番号が表示されない", !PERSONAL_INFO_RE.test(jaBody), "");
    record("[日本語] 未置換変数・架空メールが表示されない", !UNREPLACED_VAR_RE.test(jaBody), "");

    // ============================================================
    // 英語: /support
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${BASE}/support`);
    const enBody = await bodyText(client);
    record("[英語] すべての問い合わせ用途が表示される", enBody.includes("General inquiries") && enBody.includes("Bug reports") && enBody.includes("rights holders") && enBody.includes("Privacy"), "");
    record("[英語] 日本語固定文が残らない", !/一般的なお問い合わせ|不具合報告|権利者/.test(enBody), "");
    record("[英語] メールアドレスは日本語版と同一", enBody.includes(CONFIGURED_EMAIL), "");
    const enMailtos = await getMailtoHrefs(client);
    record(
      "[英語] mailtoリンクの宛先は日本語版と同一",
      enMailtos.length > 0 && enMailtos.every((h) => h.startsWith(`mailto:${CONFIGURED_EMAIL}`)) && JSON.stringify(enMailtos.map((h) => h.split("?")[0])) === JSON.stringify(jaMailtos.map((h) => h.split("?")[0])),
      JSON.stringify(enMailtos),
    );
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // ============================================================
    // 関係ページ
    // ============================================================
    await navigateAndSettle(client, `${BASE}/terms`);
    const termsBody = await bodyText(client);
    record("[関係ページ] /termsは問い合わせ先を断定せず「問い合わせ」ページへ誘導する", termsBody.includes("問い合わせ"), "");
    record("[関係ページ] /termsに架空の準拠法・裁判管轄を追加していない", termsBody.includes("運営者による確認が完了していない"), "");

    await navigateAndSettle(client, `${BASE}/privacy`);
    const privacyBody = await bodyText(client);
    record("[関係ページ] /privacyの内容が現行実装と矛盾しない(ブラウザー内保存の明示)", privacyBody.includes("ブラウザー"), "");

    await navigateAndSettle(client, `${BASE}/disclaimer`);
    const disclaimerBody = await bodyText(client);
    record("[関係ページ] /disclaimerに権利者向け連絡導線(「問い合わせ」ページへのリンク)がある", disclaimerBody.includes("権利者の方は"), "");
    const disclaimerSupportLinkExists = await evalJson(client, `!!document.querySelector('a[href="/support"]')`);
    record("[関係ページ] /disclaimerから/supportへのリンクが実在する", disclaimerSupportLinkExists, "");

    await navigateAndSettle(client, `${BASE}/release-readiness`);
    const releaseBody = await bodyText(client);
    record("[関係ページ] /release-readinessで問い合わせ窓口項目が完了として表示される", releaseBody.includes("受け付ける連絡先"), "");
    record("[関係ページ] 認証・同期・課金は完了扱いになっていない", releaseBody.includes("未着手") || releaseBody.includes("未実装"), "");
    record(
      "[関係ページ] 一般ベータ公開可能・正式公開可能と誤表示していない",
      !/一般ベータ公開可能|正式公開可能|Pro課金開始可能/.test(releaseBody),
      "",
    );

    const homeFooterMailtoCount = await navigateAndSettle(client, `${BASE}/`).then(() =>
      evalJson(client, `document.querySelectorAll('footer a[href^="mailto:"]').length`),
    );
    record("[関係ページ] フッターに問い合わせ用メールアドレスを直接露出していない(/supportへの導線のみ)", homeFooterMailtoCount === 0, "");

    // ============================================================
    // セキュリティ
    // ============================================================
    await navigateAndSettle(client, `${BASE}/support`);
    const allHrefs = await evalJson(client, `[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))`);
    record("[セキュリティ] javascript:スキームのリンクが存在しない", !allHrefs.some((h) => /^\s*javascript:/i.test(h)), "");
    record("[セキュリティ] data:スキームのリンクが存在しない", !allHrefs.some((h) => /^\s*data:/i.test(h)), "");
    record("[セキュリティ] mailtoリンクは正しいスキームのみ", jaMailtos.every((h) => h.startsWith("mailto:")), "");
    record("[セキュリティ] コンソールへ問い合わせ関連情報が出力されていない", !consoleErrors.some((m) => m.includes(CONFIGURED_EMAIL)), "");
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[セキュリティ] 新規の外部API通信が発生していない", externalRequests.length === 0, externalRequests.slice(0, 3).join(", "));

    // ============================================================
    // レスポンシブ
    // ============================================================
    for (const width of [1280, 390]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
      await navigateAndSettle(client, `${BASE}/support`);
      const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
      record(`[レスポンシブ${width}px] /supportで横スクロールが発生しない`, overflow <= 4, `overflow=${overflow}`);
      const footerTappable = await evalJson(client, `document.querySelectorAll('footer a').length > 0`);
      record(`[レスポンシブ${width}px] フッターのリンクが操作可能`, footerTappable, "");
    }
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // 既存機能スモーク回帰
    // ============================================================
    for (const p of ["/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads"]) {
      const r = await fetch(`${BASE}${p}`);
      record(`[スモーク回帰] ${p} が引き続き200`, r.status === 200, `HTTP ${r.status}`);
    }

    record("ページ内でJS例外が発生していない(全シナリオ通算)", errors.length === 0, errors.slice(0, 3).join(" / "));
    record("コンソールエラーが発生していない(全シナリオ通算)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-support-contact] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 問い合わせ窓口(公開専用メールアドレス)有効化 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。実機ではない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\|/g, "\\|")} |`),
    "",
    `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`,
    "",
  ];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-support-contact] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
