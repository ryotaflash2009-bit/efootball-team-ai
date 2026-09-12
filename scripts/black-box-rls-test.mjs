/**
 * Supabase Row Level Security 分離検証(PoC)専用のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-rls-test.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - `installSupabaseAuthTestDouble`により、ブラウザー側のSupabaseクライアント(auth・DBとも)を
 *   安全なテストダブルへ差し替える。実Supabaseへの接続・実メール送信は一切発生しない。
 * - RLSそのもの(実際のユーザー間データ分離)は実Supabase上のSQL監査・手動検証で証明する対象であり、
 *   このスクリプトが検証するのは「アプリ層がRLSの結果(0件更新・0件削除・未認証等)を
 *   安全に扱えているか」「秘密情報を表示していないか」「UI/入力値の安全性」。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 結果は docs/black-box-tests/rls-test.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "rls-test.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const MY_TEAM_KEY = "efootball-team-ai:my-team:v1";
const FAKE_MY_TEAM_VALUE = JSON.stringify({ __fixture: "black-box-rls-test", untouched: true });

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
async function clickButtonByText(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.includes(needle));
      if (!b) return false;
      b.click();
      return true;
    },
    text,
  );
}

const SECRET_LEAK_RE = /sb_secret_|service_role|access_token=|refresh_token=|SUPABASE_SERVICE_ROLE/i;
const REAL_LOOKING_EMAIL_RE = /[a-z0-9._%+-]+@(?!example\.(?:com|invalid)|efb-test-double\.example\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i;
const UNREPLACED_VAR_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}|__[A-Z_]+__/;
// UUID風の文字列(内部user_id等)がテキストとして露出していないかの緩やかな検出。
// このテストダブル自身のレコードidは"efb-test-row-N"形式のため誤検知しない。
const UUID_LIKE_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client); // 実Supabaseへは一切接続しない
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
    // 未認証状態
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account/rls-test`);
    const unauthBody = await bodyText(client);
    record("[未認証] クラッシュせず表示される", errors.length === 0, errors.slice(0, 2).join(" / "));
    record("[未認証] ログイン必須の案内が表示される", unauthBody.includes("ログイン"), "");
    record("[未認証] 検証データ一覧を表示しない", !unauthBody.includes("検証用の短い文字列"), "");
    const createFormExists = await evalJson(client, `!!document.querySelector('input[name="rls-probe-create-label"]')`);
    record("[未認証] 作成フォームを表示しない", createFormExists === false, "");
    const hasSignInLink = await evalJson(client, `!!document.querySelector('a[href="/auth/sign-in"]')`);
    record("[未認証] ログイン導線がある", hasSignInLink === true, "");
    record("[未認証] 内部UUIDを表示しない", !UUID_LIKE_RE.test(unauthBody), "");
    record("[未認証] Secret key/service_role等を表示しない", !SECRET_LEAK_RE.test(unauthBody), "");

    // ============================================================
    // 認証済み(本人)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
    const authedBody = await bodyText(client);
    record("[認証済み] 開発用PoC表記が表示される", authedBody.includes("開発用") || authedBody.includes("PoC"), "");
    record("[認証済み] クラウド同期ではない旨が表示される", authedBody.includes("クラウド同期ではありません"), "");
    record("[認証済み] 短い検証文字列だけを扱う旨が表示される", authedBody.includes("個人情報や秘密情報は入力しないでください"), "");
    record("[認証済み] 0件時の一覧表示(空状態)", authedBody.includes("検証用レコードはまだありません"), "");

    // 作成
    await setInputValue(client, 'input[name="rls-probe-create-label"]', "Probe A");
    await clickButtonByText(client, "作成");
    await waitForCondition(async () => (await bodyText(client)).includes("Probe A"), { timeoutMs: 4000, intervalMs: 100 });
    let body = await bodyText(client);
    record("[作成] 作成した文字列が一覧に表示される", body.includes("Probe A"), "");
    record("[作成] 安全な成功案内が表示される", body.includes("作成しました"), "");

    // 再読み込み後も一覧に残る(テストダブルはページ内メモリのため、同一タブ内でのSPA遷移では維持される想定。
    // ここでは同一タブでの再取得(一覧の再読込)を、ページ遷移なしで検証する)。
    await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
    body = await bodyText(client);
    // テストダブルは新しいドキュメント読み込みごとにインメモリテーブルを再初期化するため、
    // 再読み込み後は0件表示に戻ることを確認する(実Supabaseでは実際に永続化されるため
    // この挙動差は既知のテストダブル制約であり、実データの永続性はSection 17の実手動検証で確認する)。
    record("[再読み込み] ページ再読み込み後もクラッシュしない・0件表示に戻る(テストダブルの既知の制約)", body.includes("検証用レコードはまだありません"), "");

    // 作成→編集→保存
    await setInputValue(client, 'input[name="rls-probe-create-label"]', "Probe A");
    await clickButtonByText(client, "作成");
    await waitForCondition(async () => (await bodyText(client)).includes("Probe A"), { timeoutMs: 4000, intervalMs: 100 });
    await clickButtonByText(client, "編集");
    await new Promise((r) => setTimeout(r, 150));
    const editInputExists = await evalJson(client, `!!document.querySelector('input[name="rls-probe-edit-label"]')`);
    record("[更新] 編集用入力欄が表示される", editInputExists === true, "");
    await setInputValue(client, 'input[name="rls-probe-edit-label"]', "Updated probe");
    await clickButtonByText(client, "保存");
    await waitForCondition(async () => (await bodyText(client)).includes("Updated probe"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[更新] 更新後の文字列が一覧に反映される", body.includes("Updated probe"), "");
    record("[更新] 更新前の文字列が残らない", !body.includes("Probe A"), "");
    record("[更新] 安全な成功案内が表示される", body.includes("更新しました"), "");

    // 削除(確認あり)
    await clickButtonByText(client, "削除");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[削除] 削除前に明示的な確認が表示される", body.includes("削除しますか"), "");
    await clickButtonByText(client, "削除する");
    await waitForCondition(async () => !(await bodyText(client)).includes("Updated probe"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[削除] 削除後、一覧から消える", !body.includes("Updated probe"), "");
    record("[削除] 安全な成功案内が表示される", body.includes("削除しました"), "");
    record("[削除] 0件になり空状態表示に戻る", body.includes("検証用レコードはまだありません"), "");

    // ============================================================
    // 他人データ(IDOR): 存在しない/他人のIDを想定した0件更新・0件削除
    // ============================================================
    // UIには他人ID・レコードIDを自由入力させる攻撃用フォームを一切出していない
    // (Section 14の方針どおり)。そのため「UIが0件応答を安全に扱えるか」自体は
    // 上記のUnit Test(rls-probe.test.ts)がすでに個別に検証済み。
    // ここでは、UIが依存するテストダブル自身が「存在しない/他人のID」に対して
    // 実RLSと同じ形の応答(0件・エラー無し)を返すことを、そのグローバル経由で確認する
    // (実Supabaseへは接続しない。開発者ツール相当の直接呼び出しであり、通常UIからは
    // 到達できない経路)。
    await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
    const idorUpdate = await callInPage(client, async function () {
      var db = window.__EFB_DB_TEST_DOUBLE__;
      if (!db) return null;
      return db.from("rls_probe_records").update({ label: "hijacked" }).eq("id", "someone-elses-id").select("id,label");
    });
    record("[IDOR] 存在しない/他人のIDへの更新は0件になる(成功として誤表示されない)", Array.isArray(idorUpdate?.data) && idorUpdate.data.length === 0, JSON.stringify(idorUpdate));

    const idorDelete = await callInPage(client, async function () {
      var db = window.__EFB_DB_TEST_DOUBLE__;
      if (!db) return null;
      return db.from("rls_probe_records").delete().eq("id", "someone-elses-id").select("id");
    });
    record("[IDOR] 存在しない/他人のIDへの削除は0件になる(成功として誤表示されない)", Array.isArray(idorDelete?.data) && idorDelete.data.length === 0, JSON.stringify(idorDelete));

    // ============================================================
    // 入力値耐性(Create画面の入力欄経由)
    // ============================================================
    const injectionProbes = [
      ["空文字", ""],
      ["空白だけ", "   "],
      ["長さ超過(101文字)", "a".repeat(101)],
      ["HTML風", "<img src=x onerror=alert(1)>"],
      ["script風", "</script><script>alert(1)</script>"],
      ["SQL風", "'; DROP TABLE rls_probe_records; --"],
      ["Unicode", "café🎉"],
      ["絵文字", "🚀🔥✨"],
      ["バックスラッシュ", "a\\b"],
      ["引用符", "a'b\"c"],
      ["javascript:に見える値", "javascript:alert(1)"],
      ["data:に見える値", "data:text/html,<script>alert(1)</script>"],
    ];
    for (const [label, value] of injectionProbes) {
      const errorsBefore = errors.length;
      await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
      await setInputValue(client, 'input[name="rls-probe-create-label"]', value);
      await clickButtonByText(client, "作成");
      await new Promise((r) => setTimeout(r, 200));
      const afterBody = await bodyText(client);
      const isEmptyOrBlank = value.trim().length === 0;
      const isTooLong = value.length > 100;
      if (isEmptyOrBlank) {
        record(`[入力値: ${label}] 空文字/空白は安全に拒否される`, afterBody.includes("文字列を入力してください"), "");
      } else if (isTooLong) {
        record(`[入力値: ${label}] 長さ超過は安全に拒否される`, afterBody.includes("100文字以内"), "");
      } else {
        // コードとして実行されず、値そのものが表示テキストとしてそのまま一覧に反映されることを確認する。
        record(`[入力値: ${label}] 値がそのまま安全に反映される(コード実行なし)`, afterBody.includes(value), "");
      }
      record(`[入力値: ${label}] この入力でJS例外が発生していない`, errors.length === errorsBefore, errors.slice(errorsBefore, errorsBefore + 2).join(" / "));
    }

    // ============================================================
    // セッション: ログアウト後は一覧非表示・localStorage維持
    // ============================================================
    await setLocalStorageItem(client, MY_TEAM_KEY, FAKE_MY_TEAM_VALUE);
    await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
    await callInPage(client, async function () {
      // 認証済みダブルからログアウトする(window.__EFB_AUTH_TEST_DOUBLE__.signOut)。
      if (window.__EFB_AUTH_TEST_DOUBLE__ && window.__EFB_AUTH_TEST_DOUBLE__.signOut) {
        await window.__EFB_AUTH_TEST_DOUBLE__.signOut();
      }
    });
    await waitForCondition(async () => (await bodyText(client)).includes("ログイン"), { timeoutMs: 4000, intervalMs: 100 });
    const afterLogoutBody = await bodyText(client);
    record("[セッション] ログアウト後は未ログイン表示に戻る", afterLogoutBody.includes("ログイン"), "");
    const myTeamAfterLogout = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[セッション] ログアウトしてもMy Team等のローカルデータは維持される", myTeamAfterLogout === FAKE_MY_TEAM_VALUE, "");

    // ============================================================
    // 英語(i18n)
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
    const enBody = await bodyText(client);
    record("[英語] PoC画面が英語表示される", enBody.includes("Dev PoC") || enBody.includes("Row Level Security"), "");
    record("[英語] 日本語固定文が残らない", !/開発用|検証用の短い文字列/.test(enBody), "");
    record("[i18n] 未置換の変数プレースホルダーが残っていない", !UNREPLACED_VAR_RE.test(enBody), "");
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // ============================================================
    // セキュリティ全般
    // ============================================================
    await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
    const html = await evalJson(client, "document.documentElement.outerHTML");
    record("[セキュリティ] Secret key/service_role等の実値が混入していない", !SECRET_LEAK_RE.test(html), "");
    record("[セキュリティ] 実際のメールアドレス形式の値を表示しない(テストダブルの偽アドレスのみ)", !REAL_LOOKING_EMAIL_RE.test(html), "");
    const allHrefs = await evalJson(client, `[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))`);
    record("[セキュリティ] javascript:/data:スキームのリンクが存在しない", !allHrefs.some((h) => /^\s*(javascript|data):/i.test(h)), "");
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[セキュリティ] 新規の外部通信が発生していない(実Supabaseを含む)", externalRequests.length === 0, externalRequests.slice(0, 5).join(", "));

    // ============================================================
    // レスポンシブ(1280px / 390px)
    // ============================================================
    for (const width of [1280, 390]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
      await navigateAndSettle(client, `${BASE}/account/rls-test?__efbAuth=1`);
      const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
      record(`[レスポンシブ${width}px] 横スクロールが発生しない`, overflow <= 4, `overflow=${overflow}`);
    }
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // 既存機能スモーク回帰
    // ============================================================
    for (const p of ["/", "/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads", "/favorites", "/account", "/auth/sign-in"]) {
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
  console.log(`\n[black-box-rls-test] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# Supabase RLS 分離検証(PoC) ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。ブラウザー側Supabaseクライアント(auth・DBとも)はテストダブルへ差し替え、実Supabaseへは接続しない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。RLS自体の分離証明は実Supabase上のSQL監査・手動検証で別途行う。",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, " ")} |`),
    "",
    `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`,
    "",
  ];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-rls-test] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
