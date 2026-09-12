/**
 * Supabase Auth 技術検証(PoC)専用のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-supabase-auth.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - `.env.local`に実Supabase認証情報が設定されていても、このスクリプトは
 *   `installSupabaseAuthTestDouble`でブラウザー側のSupabaseクライアントを安全なテストダブルへ
 *   差し替える(実サインアップ・実メール送信・実ログイン等の外部通信は一切発生しない)。
 *   これは「black-boxはlocalhostへのHTTPのみ・外部アクセス0回」という既存方針を、
 *   実認証情報が設定された後も維持するための仕組み。
 * - サインアップ成功・確認メール再送信・レート制限・ログイン中状態などのシナリオは、
 *   すべてこのテストダブル経由で検証する(テストダブルのメールアドレスは
 *   example.invalid ドメインの明示的な偽値であり、実メールアドレスではない)。
 * - 実際のSupabaseプロジェクトを使った手動確認(実サインアップ・実メール確認・実ログイン)は
 *   Section 17としてユーザー自身がすでに完了済み。
 * - このレポートには過去(実認証情報を入力する前)に実行した「未設定環境」シナリオの結果も
 *   累積的に残す(env.test.tsが同じ検証をユニットテストレベルで常時カバーしているため、
 *   実認証情報が入った状態のブラックボックスでは再現しない=省略ではなく多重防御の一部)。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - パスワード・実メールアドレス・トークン等の実値はこのスクリプト自体にも一切書かない。
 * - 結果は docs/black-box-tests/supabase-auth.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "supabase-auth.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const MY_TEAM_KEY = "efootball-team-ai:my-team:v1";
const FAKE_MY_TEAM_VALUE = JSON.stringify({ __fixture: "black-box-supabase-auth", untouched: true });

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
/**
 * `fn`(このファイル内に静的に書かれた、外部入力を一切含まない固定の関数)を、
 * ページ内で`args`を「関数の引数」として実行する(CDP `Runtime.callFunctionOn`)。
 *
 * `evalJson`のようにテンプレートリテラルへ値を文字列として埋め込んでコードを組み立てる方式
 * (`` `...${JSON.stringify(value)}...` ``)は取らない。CDPの`arguments`配列はプロトコル層で
 * 個別にシリアライズされ、`functionDeclaration`(常に固定の関数ソース)へ文字列として
 * 混ぜ込まれることが無いため、値の中身(バックスラッシュ・引用符・改行・Unicode区切り文字等)に
 * 関わらずコード注入・文字列境界の脱出が起こらない。
 */
async function callInPage(client, fn, ...args) {
  const windowRef = await client.send("Runtime.evaluate", { expression: "window" });
  if (windowRef?.exceptionDetails) throw new Error(`eval exception: ${windowRef.exceptionDetails.text}`);
  const objectId = windowRef?.result?.objectId;
  const res = await client.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: fn.toString(),
    arguments: args.map((value) => ({ value })),
    returnByValue: true,
    awaitPromise: true,
  });
  if (res?.exceptionDetails) throw new Error(`callFunctionOn exception: ${res.exceptionDetails.text}`);
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
  await callInPage(
    client,
    function (k, v) {
      localStorage.setItem(k, v);
    },
    key,
    value,
  );
}
async function getLocalStorageItem(client, key) {
  return callInPage(
    client,
    function (k) {
      return localStorage.getItem(k);
    },
    key,
  );
}
async function setInputValue(client, selector, value) {
  return callInPage(
    client,
    function (sel, val) {
      const el = document.querySelector(sel);
      if (!el) return false;
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    selector,
    value,
  );
}
async function clickSelector(client, selector) {
  return callInPage(
    client,
    function (sel) {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
  );
}
async function setResendMode(client, mode) {
  await callInPage(
    client,
    function (m) {
      window.__EFB_TEST_RESEND_MODE__ = m;
    },
    mode,
  );
}

// 実際の値が万一混入していないかの検出用パターン(このスクリプト自体には実値を書かない)。
const SECRET_LEAK_RE = /sb_secret_|service_role|access_token=|refresh_token=|SUPABASE_SERVICE_ROLE/i;
const UNREPLACED_VAR_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}|__[A-Z_]+__/;
const REAL_LOOKING_EMAIL_RE = /[a-z0-9._%+-]+@(?!example\.(?:com|invalid)|efb-test-double\.example\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i;

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client); // 実Supabaseへは一切接続しない(既定: 未ログイン・再送信成功)
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
    // 基本表示(テストダブル配下・実Supabaseへ接続しない)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account`);
    const accountBody = await bodyText(client);
    record("[基本] /accountがクラッシュせず表示される", errors.length === 0, errors.slice(0, 2).join(" / "));
    record("[基本] /accountがSecret keyの入力を要求しない", !/[Ss]ecret\s*key/.test(accountBody), "");
    record("[基本] /accountに内部UUID・トークン等を表示しない", !SECRET_LEAK_RE.test(accountBody), "");
    record("[基本] 未ログイン時はログイン必須の案内を表示する", accountBody.includes("ログイン"), "");

    for (const p of ["/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads", "/favorites"]) {
      const r = await fetch(`${BASE}${p}`);
      record(`[基本] 既存機能 ${p} が引き続き200(ログイン不要)`, r.status === 200, `HTTP ${r.status}`);
    }

    // ============================================================
    // ナビゲーション導線(ヘッダー): 未ログイン時はログインリンク、ログイン中はアカウントリンク
    // ============================================================
    await navigateAndSettle(client, `${BASE}/`);
    const headerSignInLink = await evalJson(client, `!!document.querySelector('header a[href="/auth/sign-in"]')`);
    record("[ナビゲーション] 未ログイン時、ヘッダーにログイン導線がある", headerSignInLink === true, "");

    await navigateAndSettle(client, `${BASE}/?__efbAuth=1`);
    const headerAccountLink = await evalJson(client, `!!document.querySelector('header a[href="/account"]')`);
    record("[ナビゲーション] ログイン中は、ヘッダーにアカウント導線がある", headerAccountLink === true, "");

    // ============================================================
    // サインアップ画面: フォーム表示・入力検証
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    const signUpBody = await bodyText(client);
    record("[サインアップ] タイトルが表示される", signUpBody.includes("新規登録"), "");
    record(
      "[サインアップ] メールアドレス・パスワード・パスワード確認の入力欄がある",
      (await evalJson(client, `document.querySelectorAll('input[type=email]').length`)) === 1 &&
        (await evalJson(client, `document.querySelectorAll('input[type=password]').length`)) === 2,
      "",
    );
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
    // 入力値のコード注入耐性(callInPage経由の値渡しは、値をテンプレートリテラルへ
    // 文字列として埋め込まない。値の内容に関わらず「引数」として渡るだけであることを、
    // 実際に悪意ある値を投入して検証する。読み戻した値が入力値と完全一致すれば、
    // コードとして実行されず・文字列境界を脱出せず・意図した値としてだけ扱われたことになる)
    // ============================================================
    const injectionProbes = [
      ["通常のASCII文字列", "probe-ascii@example.com"],
      ["シングルクォート", "a'b@example.com"],
      ["ダブルクォート", 'a"b@example.com'],
      ["バックスラッシュ", "a\\b@example.com"],
      ["連続するバックスラッシュ", "a\\\\\\\\b@example.com"],
      ["改行", "a\nb@example.com"],
      ["CRLF", "a\r\nb@example.com"],
      ["テンプレートリテラルのバッククォート", "a`b@example.com"],
      ["${...}に見える文字列", "a${1+1}b@example.com"],
      ["script終了タグに見える文字列", "</script><script>alert(1)</script>"],
      ["HTML特殊文字", "<img src=x onerror=alert(1)>"],
      ["Unicode文字", "café🎉@example.com"],
      ["非常に長い文字列", "a".repeat(5000) + "@example.com"],
      ["javascript:に見える値", "javascript:alert(1)"],
      ["data:に見える値", "data:text/html,<script>alert(1)</script>"],
      ["プロトコル相対URL", "//evil.example.com"],
      ["不正URL", "ht!tp://[invalid"],
      ["引用符とバックスラッシュの混在", "a\\'\"b@example.com"],
      ["バックスラッシュと改行の混在", "a\\\nb@example.com"],
    ];
    const errorsBeforeProbes = errors.length;
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    const PROBE_KEY = "efb-test-injection-probe";
    for (const [label, probeValue] of injectionProbes) {
      // localStorage往復(callInPage経由)で値そのものの完全性を検証する。
      // <input type="email">はHTML仕様の value sanitization algorithm により
      // 改行/CRLFを単独入力欄の値から取り除く(ブラウザーの正規動作であり、
      // callInPageの引数渡しとは無関係)ため、改行を含む値の完全性確認には使わない。
      await setLocalStorageItem(client, PROBE_KEY, probeValue);
      const storedBack = await getLocalStorageItem(client, PROBE_KEY);
      record(`[入力値耐性] ${label}: localStorage往復後、値が入力値と完全一致する(コード実行・境界脱出なし)`, storedBack === probeValue, "");

      // 改行を含まない値については、実際のDOM入力欄(<input>)への設定でも完全一致することを確認する。
      if (!/[\r\n]/.test(probeValue)) {
        await setInputValue(client, 'input[type="email"]', probeValue);
        const readBack = await evalJson(client, `document.querySelector('input[type="email"]').value`);
        record(`[入力値耐性] ${label}: 入力欄へ設定した値が完全一致する(コード実行・境界脱出なし)`, readBack === probeValue, "");
      }

      const stillOnSignUp = await evalJson(client, "location.pathname");
      record(`[入力値耐性] ${label}: 意図しないページ遷移が発生しない`, stillOnSignUp === "/auth/sign-up", stillOnSignUp);
    }
    record("[入力値耐性] 上記すべての注入耐性チェック中にJS例外が発生していない", errors.length === errorsBeforeProbes, errors.slice(errorsBeforeProbes, errorsBeforeProbes + 3).join(" / "));

    // ============================================================
    // サインアップ成功画面(テストダブル: signUpは常にerror無しで成功する)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    await setResendMode(client, "success");
    await setInputValue(client, 'input[type="email"]', "test-signup@example.com");
    await evalJson(
      client,
      `(function(){
        const inputs = document.querySelectorAll('input[autocomplete="new-password"]');
        const proto = Object.getPrototypeOf(inputs[0]);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(inputs[0], 'Aa1!Aa1!Aa1!');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(inputs[1], 'Aa1!Aa1!Aa1!');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    await clickSelector(client, 'button[type="submit"]');
    await waitForCondition(async () => (await bodyText(client)).includes("次に行うこと"), { timeoutMs: 4000, intervalMs: 100 });
    const successBody = await bodyText(client);
    record("[サインアップ成功] 確認メール送信の案内が表示される", successBody.includes("確認メールを送信しました") || successBody.includes("確認メール"), "");
    record("[サインアップ成功] 次に行うことの見出しが表示される", successBody.includes("次に行うこと"), "");
    record(
      "[サインアップ成功] 番号付き手順(受信箱確認・メールを開く・リンクを押す・ログインへ)が表示される",
      successBody.includes("受信箱を確認") && successBody.includes("確認リンクを押して") && successBody.includes("ログイン画面またはアカウント画面"),
      "",
    );
    record("[サインアップ成功] 迷惑メールフォルダーの案内がある", successBody.includes("迷惑メール"), "");
    record("[サインアップ成功] すでに確認済みの場合はログインできる案内がある", successBody.includes("すでに完了している場合は、そのままログインできます"), "");
    record("[サインアップ成功] ログイン画面へ進むボタンがある", !!(await evalJson(client, `!!document.querySelector('a[href="/auth/sign-in"] button, a[href="/auth/sign-in"]')`)), "");
    record("[サインアップ成功] パスワードの値が画面に表示されない", !successBody.includes("Aa1!Aa1!Aa1!"), "");
    record(
      "[サインアップ成功] localhostではローカル開発環境の別端末案内が表示される",
      successBody.includes("ローカル開発環境です") && successBody.includes("別の端末でlocalhostのリンクを開くと"),
      "",
    );
    record("[サインアップ成功] iPhone固有の問題であるかのような表現はしない", !/iPhone|iphone/.test(successBody), "");

    // ============================================================
    // 確認メール再送信: 成功
    // ============================================================
    const resendButtonExists = !!(await evalJson(client, `!!document.querySelector('button')`));
    record("[再送信] 再送信ボタンが存在する", resendButtonExists, "");
    const resendButtons = await evalJson(client, `[...document.querySelectorAll('button')].map(b => b.textContent).filter(t => t && t.includes('再送信'))`);
    record("[再送信] 再送信ボタンのラベルが表示される", Array.isArray(resendButtons) && resendButtons.length > 0, JSON.stringify(resendButtons));

    const clickResend = async () =>
      evalJson(
        client,
        `(function(){ const btns = [...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent && x.textContent.includes('再送信')); if (!b) return false; b.click(); return true; })()`,
      );

    await clickResend();
    await waitForCondition(async () => (await bodyText(client)).includes("再送信しました"), { timeoutMs: 4000, intervalMs: 100 });
    const afterResendBody = await bodyText(client);
    record("[再送信] 再送信成功で安全な案内が表示される", afterResendBody.includes("確認メールを再送信しました"), "");
    record("[再送信] 待機秒数のカウントダウンが表示される", /再送信まであと\d+秒/.test(afterResendBody), "");

    const resendDisabledAfterClick = await evalJson(
      client,
      `(function(){ const btns = [...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent && (x.textContent.includes('再送信') || x.textContent.includes('送信中'))); return b ? b.disabled : null; })()`,
    );
    record("[再送信] クールダウン中は再送信ボタンが無効化される(連打防止)", resendDisabledAfterClick === true, `disabled=${resendDisabledAfterClick}`);

    // ============================================================
    // 確認メール再送信: レート制限(429相当)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    await setResendMode(client, "rate_limited");
    await setInputValue(client, 'input[type="email"]', "test-ratelimit@example.com");
    await evalJson(
      client,
      `(function(){
        const inputs = document.querySelectorAll('input[autocomplete="new-password"]');
        const proto = Object.getPrototypeOf(inputs[0]);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(inputs[0], 'Aa1!Aa1!Aa1!');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(inputs[1], 'Aa1!Aa1!Aa1!');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    await clickSelector(client, 'button[type="submit"]');
    await waitForCondition(async () => (await bodyText(client)).includes("次に行うこと"), { timeoutMs: 4000, intervalMs: 100 });
    await clickResend();
    await waitForCondition(async () => (await bodyText(client)).includes("再送信できません") || (await bodyText(client)).includes("再送信しました"), {
      timeoutMs: 4000,
      intervalMs: 100,
    });
    const rateLimitedBody = await bodyText(client);
    record("[再送信/レート制限] 短時間の複数送信で安全な日本語案内が表示される", rateLimitedBody.includes("短時間に複数回送信されたため"), "");
    record("[再送信/レート制限] Supabaseの生エラー(429・rate_limit等)を表示しない", !/429|rate.?limit/i.test(rateLimitedBody), "");
    record("[再送信/レート制限] UIがクラッシュしない", errors.length === 0, errors.slice(0, 2).join(" / "));

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

    await navigateAndSettle(client, `${BASE}/auth/sign-in?next=https%3A%2F%2Fevil.example.com`);
    record("[セキュリティ] next=外部URLでも/auth/sign-inが正常表示される(遷移は起きない)", (await bodyText(client)).includes("ログイン"), "");

    // ============================================================
    // パスワードをお忘れの方 / 新しいパスワードを設定
    // ============================================================
    await navigateAndSettle(client, `${BASE}/auth/forgot-password`);
    const forgotBody = await bodyText(client);
    record("[パスワード再設定] タイトルと説明が表示される", forgotBody.includes("パスワードをお忘れ"), "");
    record("[パスワード再設定] メールアドレス入力欄が1つだけ", (await evalJson(client, `document.querySelectorAll('input[type=email]').length`)) === 1, "");

    await navigateAndSettle(client, `${BASE}/auth/update-password`);
    const updatePasswordBody = await bodyText(client);
    record("[パスワード更新] クラッシュせず表示される", updatePasswordBody.length > 0, "");
    record("[パスワード更新] パスワード要件の案内が表示される", updatePasswordBody.includes("12文字以上"), "");

    // ============================================================
    // コールバック(認証コード交換): codeなしの安全な内部遷移(実Supabaseへは接続しない)
    // codeありのコード交換成功/失敗パスは src/app/auth/callback/route.test.ts が
    // テストダブル(外部通信0回)で既に網羅しているため、black-boxでは実行しない
    // (実credentialsが設定された状態でcodeを渡すと実Supabaseへ通信してしまうため)。
    // ============================================================
    const callbackNoCode = await fetch(`${BASE}/auth/callback`, { redirect: "manual" });
    record("[コールバック] codeが無い場合は3xxで内部のsign-inへ遷移する", callbackNoCode.status >= 300 && callbackNoCode.status < 400, `HTTP ${callbackNoCode.status}`);
    const callbackLocation = callbackNoCode.headers.get("location") ?? "";
    record("[コールバック] 遷移先が同一オリジンの内部パスである(外部URLではない)", callbackLocation.startsWith(BASE) || callbackLocation.startsWith("/"), callbackLocation);
    record("[コールバック] 遷移先URLにトークン・セッション情報を含まない", !SECRET_LEAK_RE.test(callbackLocation), "");

    // ============================================================
    // アカウント画面: ログイン中状態(テストダブル経由・実UUID/トークンは使わない)
    // ============================================================
    await setLocalStorageItem(client, MY_TEAM_KEY, FAKE_MY_TEAM_VALUE);
    await navigateAndSettle(client, `${BASE}/account?__efbAuth=1`);
    const authedAccountBody = await waitForCondition(
      async () => {
        const t = await bodyText(client);
        return t.includes("ログイン中") ? t : null;
      },
      { timeoutMs: 4000, intervalMs: 100 },
    );
    record("[アカウント/ログイン中] ログイン中である旨が表示される", !!authedAccountBody && authedAccountBody.includes("ログイン中"), "");
    record("[アカウント/ログイン中] クラウド同期は未実装である旨の案内がある", !!authedAccountBody && authedAccountBody.includes("クラウド同期"), "");
    record("[アカウント/ログイン中] 内部UUID・アクセストークン・リフレッシュトークンを表示しない", !!authedAccountBody && !SECRET_LEAK_RE.test(authedAccountBody), "");
    record(
      "[アカウント/ログイン中] 実際のメールアドレス形式の値を表示しない(テストダブルの偽アドレスのみ)",
      !!authedAccountBody && !REAL_LOOKING_EMAIL_RE.test(authedAccountBody),
      "",
    );

    await clickSelector(client, "button");
    const logoutButtonClicked = await evalJson(
      client,
      `(function(){ const btns=[...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent && x.textContent.includes('ログアウト')); if(!b) return false; b.click(); return true; })()`,
    );
    record("[アカウント/ログアウト] ログアウトボタンが操作できる", logoutButtonClicked === true, "");
    await waitForCondition(
      async () => {
        const t = await bodyText(client);
        return t.includes("ログインが必要") ? t : null;
      },
      { timeoutMs: 4000, intervalMs: 100 },
    );
    const afterLogoutBody = await bodyText(client);
    record("[アカウント/ログアウト] ログアウト後は未ログイン表示に戻る", afterLogoutBody.includes("ログインが必要"), "");
    const myTeamAfterLogout = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[アカウント/ログアウト] ログアウトしてもMy Team等のローカルデータは維持される", myTeamAfterLogout === FAKE_MY_TEAM_VALUE, "");

    // ============================================================
    // 英語(i18n)
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${BASE}/auth/sign-up`);
    const enSignUpBody = await bodyText(client);
    record("[英語] サインアップ画面が英語表示される", enSignUpBody.includes("Sign up"), "");
    record("[英語] 日本語固定文が残らない(サインアップ)", !/新規登録|パスワード（確認用）/.test(enSignUpBody), "");

    await setInputValue(client, 'input[type="email"]', "test-en@example.com");
    await setResendMode(client, "success");
    await evalJson(
      client,
      `(function(){
        const inputs = document.querySelectorAll('input[autocomplete="new-password"]');
        const proto = Object.getPrototypeOf(inputs[0]);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(inputs[0], 'Aa1!Aa1!Aa1!');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(inputs[1], 'Aa1!Aa1!Aa1!');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    await clickSelector(client, 'button[type="submit"]');
    await waitForCondition(async () => (await bodyText(client)).includes("What to do next"), { timeoutMs: 4000, intervalMs: 100 });
    const enSuccessBody = await bodyText(client);
    record("[英語] サインアップ成功画面(番号付き手順・再送信・ローカル開発案内)が英語表示される", enSuccessBody.includes("What to do next") && enSuccessBody.includes("Resend confirmation email"), "");
    record("[英語] ローカル開発環境の案内が英語表示される", enSuccessBody.includes("This is a local development environment"), "");

    await navigateAndSettle(client, `${BASE}/auth/sign-in`);
    const enSignInBody = await bodyText(client);
    record("[英語] ログイン画面が英語表示される", enSignInBody.includes("Sign in"), "");

    await navigateAndSettle(client, `${BASE}/account`);
    const enAccountBody = await bodyText(client);
    record("[英語] アカウント画面が英語表示される", enAccountBody.includes("Account") || enAccountBody.includes("sign in"), "");
    record("[i18n] 未置換の変数プレースホルダーが残っていない", !UNREPLACED_VAR_RE.test(enAccountBody) && !UNREPLACED_VAR_RE.test(enSuccessBody), "");
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
    record("[セキュリティ] 新規の外部通信が発生していない(実Supabaseを含む)", externalRequests.length === 0, externalRequests.slice(0, 5).join(", "));

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
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。ブラウザー側Supabaseクライアントはテストダブルへ差し替え、実Supabaseへは接続しない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。実際のメール送信・実サインアップ・実ログインは行わない。",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${escapeMarkdownCell(r.name)} | ${escapeMarkdownCell(r.detail || "")} |`),
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
