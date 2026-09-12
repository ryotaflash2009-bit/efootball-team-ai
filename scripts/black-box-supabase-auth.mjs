/**
 * Supabase Auth 技術検証(PoC)専用のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-supabase-auth.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - 実際のSupabaseプロジェクトへは一切接続しない(このテスト実行環境の.env.localは
 *   プレースホルダーのみ・値は空)。そのため主眼は「未設定環境で安全に動作すること」
 *   「フォームの検証・表示・レスポンシブ・セキュリティ・i18n」であり、実サインアップ/
 *   実ログインの成功シナリオはSection 17のユーザー自身による手動確認で別途行う。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 新規外部通信は一切発生しない(すべて同一オリジンへのアクセスのみ)。
 * - パスワード・メールアドレス・トークン等の実値はこのスクリプト自体にも一切書かない。
 * - 結果は docs/black-box-tests/supabase-auth.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "supabase-auth.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const LOCALE_KEY = "efootball-team-ai:locale:v1";

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
async function setInputValue(client, selector, value) {
  const expr = `
    (function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `;
  return evalJson(client, expr);
}
async function clickSelector(client, selector) {
  return evalJson(client, `(function(){ const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
}

// 実際の値が万一混入していないかの検出用パターン(このスクリプト自体には実値を書かない)。
const SECRET_LEAK_RE = /sb_secret_|service_role|access_token=|refresh_token=|SUPABASE_SERVICE_ROLE/i;
const UNREPLACED_VAR_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}|__[A-Z_]+__/;

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
    // 未設定環境(.env.localは値未入力): クラッシュしない・既存機能が使える
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account`);
    const accountBody = await bodyText(client);
    record("[未設定環境] /accountがクラッシュせず表示される", !errors.length, errors.slice(0, 2).join(" / "));
    record("[未設定環境] /accountがSecret keyの入力を要求しない", !/[Ss]ecret\s*key/.test(accountBody), "");
    record("[未設定環境] /accountに内部UUID/トークンを表示しない", !SECRET_LEAK_RE.test(accountBody), "");

    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    const signUpUnconfiguredBody = await bodyText(client);
    record("[未設定環境] /auth/sign-upがクラッシュせず表示される", signUpUnconfiguredBody.length > 0, "");

    for (const p of ["/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads", "/favorites"]) {
      const r = await fetch(`${BASE}${p}`);
      record(`[未設定環境] 既存機能 ${p} が引き続き200(ログイン不要)`, r.status === 200, `HTTP ${r.status}`);
    }

    // ============================================================
    // サインアップ画面(日本語)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    const signUpBody = await bodyText(client);
    record("[サインアップ] タイトルが表示される", signUpBody.includes("新規登録"), "");
    record("[サインアップ] メールアドレス・パスワード・パスワード確認の入力欄がある", (await evalJson(client, `document.querySelectorAll('input[type=email]').length`)) === 1 && (await evalJson(client, `document.querySelectorAll('input[type=password]').length`)) === 2, "");
    record("[サインアップ] パスワード要件の案内が表示される", signUpBody.includes("12文字以上"), "");
    record("[サインアップ] ログインへのリンクがある", !!(await evalJson(client, `!!document.querySelector('a[href="/auth/sign-in"]')`)), "");

    await setInputValue(client, 'input[type="email"]', "not-an-email");
    await setInputValue(client, 'input[autocomplete="new-password"]', "Aa1!Aa1!Aa1!");
    const passwordConfirmSelectors = await evalJson(client, `[...document.querySelectorAll('input[autocomplete="new-password"]')].length`);
    record("[サインアップ] パスワード・パスワード確認の2つの入力欄が存在する", passwordConfirmSelectors === 2, "");
    await clickSelector(client, 'button[type="submit"]');
    await new Promise((r) => setTimeout(r, 200));
    const invalidEmailErrorBody = await bodyText(client);
    record("[サインアップ] 不正なメール形式で安全なエラーが表示される", invalidEmailErrorBody.includes("メールアドレスの形式が正しくありません"), "");

    // パスワード不一致の検証
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    await setInputValue(client, 'input[type="email"]', "test@example.com");
    const pwInputs = await evalJson(client, `[...document.querySelectorAll('input[autocomplete="new-password"]')].map((_, i) => i)`);
    await evalJson(
      client,
      `(function(){
        const inputs = document.querySelectorAll('input[autocomplete="new-password"]');
        const proto = Object.getPrototypeOf(inputs[0]);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(inputs[0], 'Aa1!Aa1!Aa1!');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(inputs[1], 'Different1!Aa1!');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    await clickSelector(client, 'button[type="submit"]');
    await new Promise((r) => setTimeout(r, 200));
    const mismatchBody = await bodyText(client);
    record("[サインアップ] パスワード不一致で安全なエラーが表示される", mismatchBody.includes("パスワードが一致しません"), "");
    record("[サインアップ] パスワードの値そのものは画面に表示されない", !mismatchBody.includes("Aa1!Aa1!Aa1!") && !mismatchBody.includes("Different1!Aa1!"), "");

    // ============================================================
    // ログイン画面(日本語)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/sign-in`);
    const signInBody = await bodyText(client);
    record("[ログイン] タイトルが表示される", signInBody.includes("ログイン"), "");
    record("[ログイン] 新規登録へのリンクがある", !!(await evalJson(client, `!!document.querySelector('a[href="/auth/sign-up"]')`)), "");
    record("[ログイン] パスワードをお忘れの方へのリンクがある", !!(await evalJson(client, `!!document.querySelector('a[href="/auth/forgot-password"]')`)), "");
    record("[ログイン] パスワード入力欄がtype=passwordである(値を隠す)", (await evalJson(client, `document.querySelector('input[autocomplete="current-password"]').type`)) === "password", "");

    await navigateAndSettle(client, `${BASE}/auth/sign-in?authError=callback_failed`);
    const signInWithErrorBody = await bodyText(client);
    record("[ログイン] コールバック失敗クエリで安全な一般化メッセージが表示される(生のエラー詳細を含まない)", signInWithErrorBody.includes("メールアドレスまたはパスワードが正しくありません"), "");

    // オープンリダイレクト対策: 外部URLをnextに指定してもログイン画面自体は正常表示される
    await navigateAndSettle(client, `${BASE}/auth/sign-in?next=https%3A%2F%2Fevil.example.com`);
    record("[セキュリティ] next=外部URLでも/auth/sign-inが正常表示される(遷移は起きない)", (await bodyText(client)).includes("ログイン"), "");

    // ============================================================
    // パスワードをお忘れの方
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/forgot-password`);
    const forgotBody = await bodyText(client);
    record("[パスワード再設定] タイトルと説明が表示される", forgotBody.includes("パスワードをお忘れ"), "");
    record("[パスワード再設定] メールアドレス入力欄が1つだけ", (await evalJson(client, `document.querySelectorAll('input[type=email]').length`)) === 1, "");

    // ============================================================
    // 新しいパスワードを設定(recoveryセッションが無い状態でも安全に表示される)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/update-password`);
    const updatePasswordBody = await bodyText(client);
    record("[パスワード更新] クラッシュせず表示される", updatePasswordBody.length > 0, "");
    record("[パスワード更新] パスワード要件の案内が表示される", updatePasswordBody.includes("12文字以上"), "");

    // ============================================================
    // コールバック(認証コード交換): codeなし・未設定環境ともに安全な内部遷移
    // ============================================================
    const callbackNoCode = await fetch(`${BASE}/auth/callback`, { redirect: "manual" });
    record("[コールバック] codeが無い場合は3xxで内部のsign-inへ遷移する", callbackNoCode.status >= 300 && callbackNoCode.status < 400, `HTTP ${callbackNoCode.status}`);
    const callbackLocation = callbackNoCode.headers.get("location") ?? "";
    record("[コールバック] 遷移先が同一オリジンの内部パスである(外部URLではない)", callbackLocation.startsWith(BASE) || callbackLocation.startsWith("/"), callbackLocation);
    record("[コールバック] 遷移先URLにトークン・セッション情報を含まない", !SECRET_LEAK_RE.test(callbackLocation), "");

    const callbackExternalNext = await fetch(`${BASE}/auth/callback?code=dummy&next=${encodeURIComponent("https://evil.example.com")}`, { redirect: "manual" });
    const externalNextLocation = callbackExternalNext.headers.get("location") ?? "";
    record("[セキュリティ] コールバックのnextへ外部URLを渡しても外部へリダイレクトしない", !externalNextLocation.includes("evil.example.com"), externalNextLocation);

    // ============================================================
    // アカウント画面(このテスト環境はSupabase未設定のため「unconfigured」表示になる。
    // 実際の「未ログイン(unauthenticated)」表示 — ログイン必須の案内・ログイン/新規登録リンク —
    // は実Supabaseへの到達を要するため、black-boxでは検証しない(localhost以外への外部通信は
    // 0回の方針)。この画面はSection 17のユーザー自身による手動確認で確認する。)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account`);
    const accountUnconfiguredBody = await bodyText(client);
    record("[アカウント/未設定環境] ログイン中である旨を誤って表示しない", !accountUnconfiguredBody.includes("ログイン中"), "");
    record("[アカウント/未設定環境] 内部UUID・トークンを表示しない", !SECRET_LEAK_RE.test(accountUnconfiguredBody), "");

    // ============================================================
    // ナビゲーション導線(ヘッダー): Supabase未設定時はログイン導線を表示しない(安全側)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/`);
    const headerHasAuthLink = await evalJson(client, `!!document.querySelector('header a[href="/auth/sign-in"], header a[href="/account"]')`);
    record("[ナビゲーション/未設定環境] Supabase未設定時はヘッダーにログイン導線を表示しない", headerHasAuthLink === false, `link=${headerHasAuthLink}`);

    // ============================================================
    // 英語(i18n)
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    const enSignUpBody = await bodyText(client);
    record("[英語] サインアップ画面が英語表示される", enSignUpBody.includes("Sign up"), "");
    record("[英語] 日本語固定文が残らない(サインアップ)", !/新規登録|パスワード（確認用）/.test(enSignUpBody), "");

    await navigateAndSettle(client, `${BASE}/auth/sign-in`);
    const enSignInBody = await bodyText(client);
    record("[英語] ログイン画面が英語表示される", enSignInBody.includes("Sign in"), "");

    await navigateAndSettle(client, `${BASE}/account`);
    const enAccountBody = await bodyText(client);
    record("[英語] アカウント画面が英語表示される", enAccountBody.includes("Account") || enAccountBody.includes("sign in"), "");
    record("[i18n] 未置換の変数プレースホルダーが残っていない", !UNREPLACED_VAR_RE.test(enAccountBody) && !UNREPLACED_VAR_RE.test(enSignUpBody), "");
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // ============================================================
    // セキュリティ全般
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account`);
    const accountHtml = await evalJson(client, "document.documentElement.outerHTML");
    record("[セキュリティ] ページソースにSecret key/service_role等の実値が混入していない", !SECRET_LEAK_RE.test(accountHtml), "");
    const allAuthHrefs = await evalJson(client, `[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))`);
    record("[セキュリティ] javascript:/data:スキームのリンクが存在しない", !allAuthHrefs.some((h) => /^\s*(javascript|data):/i.test(h)), "");
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[セキュリティ] 新規の外部通信が発生していない", externalRequests.length === 0, externalRequests.slice(0, 3).join(", "));

    // ============================================================
    // レスポンシブ(1280px / 390px)
    // ============================================================
    for (const width of [1280, 390]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
      for (const p of ["/auth/sign-up", "/auth/sign-in", "/account"]) {
        await navigateAndSettle(client, `${BASE}${p}`);
        const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
        record(`[レスポンシブ${width}px] ${p}で横スクロールが発生しない`, overflow <= 4, `overflow=${overflow}`);
      }
    }
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // 既存機能スモーク回帰
    // ============================================================
    for (const p of ["/", "/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads", "/favorites", "/managers", "/compare"]) {
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
  console.log(`\n[black-box-supabase-auth] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# Supabase Auth 技術検証(PoC) ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。実Supabaseへは接続していない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。実際のメール送信・実サインアップは行わない。",
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
  console.log(`[black-box-supabase-auth] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
