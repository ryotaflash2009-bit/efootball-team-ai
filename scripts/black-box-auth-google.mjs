/**
 * Google OAuth の準備（2026-10-11・既定は無効）のブラックボックス。
 *
 *   node scripts/black-box-auth-google.mjs   （事前に npm run build・node scripts/local-server.mjs start）
 *
 * 隔離したヘッドレス Chrome・認証のテストダブル（localhost だけ）。実 Supabase・Google へは接続しない。
 * - 既定（無効）: ログイン画面に Google のボタンは出ない・パスワードの再設定の導線は従来どおり。
 * - ローカルの ?oauthPreview=1: Google のボタン（redirect 方式・redirectTo は自サイトの /auth/callback?flow=google&next=…・
 *   prompt=select_account）・再設定の導線は出ない・パスワードは「以前のアカウント」用・新規登録の画面は Google だけ。
 * - 失敗の表示（キャンセル・失敗）を日本語・英語で・生のエラー文を出さない。
 * - 390px（モバイル）で横のはみ出しなし。
 * - ゲストのデータの引き継ぎ: ログイン中のアカウントの画面に件数と導線・?source=guest でゲストを選んだ状態・不足分だけ追加・ゲストのデータは残る。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "auth-google.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOCALE_KEY = "efootball-team-ai:locale:v1";
const GUEST_MY_TEAM = "efootball-team-ai:local:guest:my-team:v1";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.text ?? "exception"));
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const go = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 10000, intervalMs: 100 });
    await new Promise((r) => setTimeout(r, 500));
  };
  const text = () => ev("document.body.innerText");
  const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
  const viewport = (width, height, mobile) => client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });

  try {
    await viewport(1280, 900, false);
    await go(`${BASE}/auth/sign-in`);
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);

    // 既定（無効）
    await go(`${BASE}/auth/sign-in`);
    await waitForCondition(async () => /ログイン/.test(await text()), { timeoutMs: 8000 }).catch(() => {});
    record("[既定・無効] Google のボタンを出さない", !(await has('[data-testid="google-sign-in-button"]')), "");
    record("[既定・無効] パスワードの再設定の導線は従来どおり", await ev(`!!document.querySelector('a[href="/auth/forgot-password"]')`), "");

    // ローカルのプレビュー
    await go(`${BASE}/auth/sign-in?oauthPreview=1&next=%2Fsquads`);
    await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
    const t1 = await text();
    record("[プレビュー] Google のボタン「Google で続ける」を出す", /Google で続ける/.test(t1), "");
    record("[プレビュー] パスワードの再設定の導線を出さない（パスワードでのログインを一般に提供しないため）", !(await ev(`!!document.querySelector('a[href="/auth/forgot-password"]')`)), "");
    record("[プレビュー] メール＋パスワードは以前のアカウント用と示す", /以前にメールアドレスで作成したアカウント/.test(t1), "");
    record("[プレビュー] ゲストのまま使える・自動では統合しない旨", /ゲストとしてすべての機能/.test(t1) && /自動では統合しません/.test(t1), "");
    await ev(`document.querySelector('[data-testid="google-sign-in-button"]').click()`);
    await waitForCondition(async () => ((await ev("(window.__EFB_TEST_OAUTH_CALLS__ || []).length")) ?? 0) > 0, { timeoutMs: 5000 }).catch(() => {});
    const call = (await ev("window.__EFB_TEST_OAUTH_CALLS__ || []"))[0] ?? null;
    const redirectTo = call?.options?.redirectTo ?? "";
    record("[プレビュー] signInWithOAuth は provider google・redirect 方式（popup の指定なし）", call?.provider === "google" && call?.options?.skipBrowserRedirect !== true, JSON.stringify(call?.provider));
    record(
      "[プレビュー] redirectTo は自サイトの /auth/callback?flow=google&next=%2Fsquads",
      redirectTo === `${BASE}/auth/callback?flow=google&next=%2Fsquads`,
      redirectTo,
    );
    record("[プレビュー] 毎回アカウントを選ばせる（prompt=select_account）", call?.options?.queryParams?.prompt === "select_account", "");

    // 失敗の表示（クライアント側）
    await go(`${BASE}/auth/sign-in?oauthPreview=1`);
    await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
    await ev(`window.__EFB_TEST_OAUTH_MODE__ = "failure"; document.querySelector('[data-testid="google-sign-in-button"]').click()`);
    await waitForCondition(async () => /Google でのログインを完了できませんでした/.test(await text()), { timeoutMs: 5000 }).catch(() => {});
    const tf = await text();
    record("[プレビュー] 開始の失敗は一般化した文で表示（生の文なし）", /Google でのログインを完了できませんでした/.test(tf) && !/test double/.test(tf), "");

    // callback からの失敗（日本語・英語）
    for (const [locale, cancelRe, failRe] of [
      ["ja", /Google でのログインをキャンセルしました/, /Google でのログインを完了できませんでした/],
      ["en", /Google sign-in was cancelled/, /Google sign-in couldn't be completed/],
    ]) {
      await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`);
      await go(`${BASE}/auth/callback?flow=google&next=%2Faccount&error=access_denied&error_description=secret-detail`);
      await waitForCondition(async () => cancelRe.test(await text()), { timeoutMs: 8000 }).catch(() => {});
      const tc = await text();
      record(`[${locale}] Google の画面でキャンセル → ログイン画面に案内（生の文なし）`, cancelRe.test(tc) && !/secret-detail/.test(tc) && /\/auth\/sign-in/.test(await ev("location.pathname")), "");
      await go(`${BASE}/auth/callback?flow=google&error=invalid_request`);
      await waitForCondition(async () => failRe.test(await text()), { timeoutMs: 8000 }).catch(() => {});
      record(`[${locale}] Google の失敗 → ログイン画面に案内`, failRe.test(await text()), "");
    }
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);

    // 新規登録の画面
    await go(`${BASE}/auth/sign-up?oauthPreview=1`);
    await waitForCondition(() => has('[data-testid="signup-google"]'), { timeoutMs: 8000 }).catch(() => {});
    record("[プレビュー] 新規登録は Google だけ（メールとパスワードの入力欄なし・確認メールなし）", (await has('[data-testid="signup-google"]')) && !(await has('input[type="password"]')) && /確認メールは届きません/.test(await text()), "");
    await go(`${BASE}/auth/sign-up`);
    await waitForCondition(() => has('[data-testid="signup-limited"]'), { timeoutMs: 8000 }).catch(() => {});
    record("[既定・無効] 新規登録は従来どおり「限定テスト中」", await has('[data-testid="signup-limited"]'), "");

    // モバイル
    await viewport(390, 844, true);
    await go(`${BASE}/auth/sign-in?oauthPreview=1`);
    await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("[390px] Google のボタンを表示・横のはみ出しなし", (await has('[data-testid="google-sign-in-button"]')) && overflow <= 0, `overflow=${overflow}`);
    await viewport(1280, 900, false);

    // ゲストのデータの引き継ぎ
    await ev(`localStorage.setItem(${JSON.stringify(GUEST_MY_TEAM)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: "2026-10-11T00:00:00.000Z", records: [{ localRecordId: "mt_1", teamCardId: "tc_1", worldCardId: "88039581945292", ownershipStatus: "owned", usageStatus: "unused", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z", deletedAt: null, source: "local", syncStatus: "local_only" }] }))})`);
    const guestBefore = await ev(`localStorage.getItem(${JSON.stringify(GUEST_MY_TEAM)})`);
    await go(`${BASE}/account?__efbAuth=1&__efbUserId=efb-google-user-1`);
    await waitForCondition(() => has('[data-testid="account-guest-data-notice"]'), { timeoutMs: 10000 }).catch(() => {});
    const ta = await text();
    record("[引き継ぎ] ログイン中のアカウントの画面にゲストのデータの件数と導線（自動ではコピーしない）", /ゲストとして保存したデータが 1 件/.test(ta) && /自動ではコピーしません/.test(ta), "");
    await go(`${BASE}/account/local-data-migration?source=guest&__efbAuth=1&__efbUserId=efb-google-user-1`);
    await waitForCondition(async () => /ゲストとして保存したデータ（この端末）/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
    record("[引き継ぎ] ?source=guest でゲストのデータを選んだ状態で開く", /ゲストとして保存したデータ（この端末）/.test(await text()), "");
    const accountKeys = await ev(`Object.keys(localStorage).filter((k) => k.startsWith("efootball-team-ai:local:account:") && k.endsWith(":my-team:v1"))`);
    record("[引き継ぎ] 開いただけではアカウントの領域へコピーしない", (accountKeys ?? []).length === 0, `keys=${(accountKeys ?? []).length}`);
    await ev(`document.querySelector('input[name="local-data-migration-select-myTeam"]').click()`);
    await ev(`[...document.querySelectorAll("button")].find((b) => /プレビュー/.test(b.textContent))?.click()`);
    await waitForCondition(async () => /追加/.test(await text()), { timeoutMs: 5000 }).catch(() => {});
    record("[引き継ぎ] プレビューで追加の件数を表示", /追加/.test(await text()), "");
    record("[引き継ぎ] ゲストのデータは変わらない", (await ev(`localStorage.getItem(${JSON.stringify(GUEST_MY_TEAM)})`)) === guestBefore, "");
    record("ページ内で JS の例外が起きない", errors.length === 0, errors.slice(0, 2).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-auth-google] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# Google OAuth の準備 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build 上の隔離ヘッドレス Chrome・認証のテストダブル。実 Supabase・Google へは接続しない）`,
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
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
