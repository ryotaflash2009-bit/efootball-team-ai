/**
 * スカッド一覧の「My Teamから引き継いだカード」バナーが、内部ID(worldCardId)を
 * 生の数字のまま画面へ表示しないことを確認する専用ブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-squad-list-banner.mjs
 *
 * 背景(Phase 2 回帰で発見・修正した不具合):
 *   /squads?card=<worldCardId> でスカッド一覧を開いたときのバナーが、
 *   これまで選手名を解決せず「My Team のカード（ID <worldCardId>）」のように
 *   内部IDをそのまま文言に埋め込んで表示していた。カード名をクライアント側で
 *   worldCardIdから解決して表示するよう修正し、このテストで再発を防止する。
 *
 * - Production Build上の隔離ヘッドレスChロム(scripts/lib/headless-chrome.mjs)で実際に画面を確認する。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 実在するWorld DBカードのworldCardIdのみを使用する。
 * - 結果は docs/black-box-tests/squad-list-banner.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "squad-list-banner.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const MESSI_SS = "89138556575063"; // リオネル メッシ(実在するWorld DBカード)

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
}
async function bodyText(client) {
  return evalJson(client, "document.body.innerText");
}

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client); // ヘッダーの認証状態表示が実Supabaseへ接続しないようにする(このレールは認証と無関係)
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.text ?? "exception"));

  try {
    await navigateAndSettle(client, `${BASE}/squads?card=${MESSI_SS}`);
    // 名前解決後(「メッシ」表示)まで待つ。
    await waitForCondition(async () => (await bodyText(client)).includes("メッシ"), { timeoutMs: 8000, intervalMs: 150 });
    const body = await bodyText(client);
    record("引き継ぎバナー: 解決済みの選手名(メッシ)が表示される", body.includes("メッシ"), "");
    record(
      "引き継ぎバナー: 生のworldCardIdが数字のまま表示されない",
      !new RegExp(MESSI_SS).test(body),
      "",
    );
    record("引き継ぎバナー: 「読み込み中」のまま固まっていない(名前解決が完了している)", !body.includes("読み込み中"), "");
    record("ページ内でJS例外が発生していない", errors.length === 0, errors.join(" / "));

    // 無効な形式のcardパラメータは、サーバー側のスキーマ検証で無視されバナー自体が出ない(安全側)。
    await navigateAndSettle(client, `${BASE}/squads?card=not-a-valid-id`);
    await new Promise((r) => setTimeout(r, 300));
    const invalidBody = await bodyText(client);
    record("不正な形式のcardパラメータではバナー自体が表示されない", !invalidBody.includes("My Team のカード"), "");
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-squad-list-banner] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# スカッド一覧「引き継ぎバナー」内部ID非露出 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。実機ではない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。",
    "実在するWorld DBカード(本番SQLite)のworldCardIdのみを使用する。",
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
  console.log(`[black-box-squad-list-banner] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
