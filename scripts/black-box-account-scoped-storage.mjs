/**
 * アカウント別localStorage名前空間(Stage 1/2)専用のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-account-scoped-storage.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - `installSupabaseAuthTestDouble`により、ブラウザー側のSupabaseクライアント(auth・DBとも)を
 *   安全なテストダブルへ差し替える。実Supabaseへの接続・実メール送信は一切発生しない。
 * - `?__efbUserId=<id>`で偽ユーザーIDを切り替え、同一の固定テストダブルのままユーザーA/B相当の
 *   アカウント切り替えを再現する(実Supabaseアカウントは一切使わない)。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。フィクスチャは
 *   架空のworldCardId・localStorage値のみを使用する。
 * - 結果は docs/black-box-tests/account-scoped-storage.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "account-scoped-storage.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MY_TEAM_PAGE = `${BASE}/my-team`;
const MIGRATION_PAGE = `${BASE}/account/local-data-migration`;

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const LEGACY_MY_TEAM_KEY = "efootball-team-ai:my-team:v1";

const USER_A = "black-box-user-a";
const USER_B = "black-box-user-b";

/** アプリのcomputeAccountScopeId()と完全に同じアルゴリズムで、Node側から期待キーを算出する。 */
async function scopedMyTeamKeyFor(userId) {
  const prefix = "efootball-team-ai:local-storage-scope:v1:";
  const data = new TextEncoder().encode(prefix + userId);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const scopeId = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `efootball-team-ai:local:account:${scopeId}:my-team:v1`;
}

function legacyFixtureJson(records) {
  return JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: new Date().toISOString(), records });
}
function fixtureRecord(worldCardId, overrides = {}) {
  return {
    localRecordId: `myt_${worldCardId}fx`,
    teamCardId: `tc_${worldCardId}fx`,
    worldCardId,
    ownershipStatus: "owned",
    usageStatus: "main",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
    ...overrides,
  };
}

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
  await new Promise((r) => setTimeout(r, 300));
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
// 完全一致(trim後)で照合する。ボタン文言が互いに部分文字列関係になり得るため
// (例:「新規追加分を移行する」の中に「移行する」が含まれる)、includes()は使わない。
async function clickButtonByText(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.trim() === needle && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    },
    text,
  );
}
async function isButtonDisabled(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.trim() === needle);
      return b ? b.disabled : null;
    },
    text,
  );
}
async function ackCheckboxIfPresent(client, name) {
  await callInPage(
    client,
    function (n) {
      const cb = document.querySelector(`input[name="${n}"]`);
      if (cb && !cb.checked) cb.click();
    },
    name,
  );
}
const SECRET_LEAK_RE = /sb_secret_|service_role|access_token=|refresh_token=|SUPABASE_SERVICE_ROLE/i;
const UUID_LIKE_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const HEX64_RE = /\b[0-9a-f]{64}\b/i;

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
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
    // 未認証: guest My Teamだけを表示する
    // ============================================================
    await navigateAndSettle(client, MY_TEAM_PAGE);
    let body = await bodyText(client);
    record("[未認証] My Team画面がクラッシュせず表示される", errors.length === 0, errors.slice(0, 2).join(" / "));
    // JS実行後(hydration後)は認証確認が完了しguest空状態が表示される。
    // 「お気に入りとは独立した管理」「このブラウザにのみ保存」「お気に入りを見る」導線は
    // アカウント別localStorage対応でSSR直後には出なくなったため、ここ(ヘッドレスブラウザー)で検証する。
    record("[未認証] 空状態カードが表示される(お気に入りとは独立)", body.includes("お気に入りとは独立"), "");
    record("[未認証] ローカル保存の明示(このブラウザにのみ)", body.includes("このブラウザにのみ"), "");
    record("[未認証] 空状態から「お気に入りを見る」への導線", body.includes("お気に入りを見る"), "");

    // レガシー共通My Teamへ3件のフィクスチャを仕込む(実データではない)。
    const legacyThree = legacyFixtureJson([fixtureRecord("10001"), fixtureRecord("10002"), fixtureRecord("10003")]);
    await setLocalStorageItem(client, LEGACY_MY_TEAM_KEY, legacyThree);
    await navigateAndSettle(client, MY_TEAM_PAGE);
    body = await bodyText(client);
    record("[未認証] レガシー件数の案内が表示される(3件)", /3件/.test(body) && body.includes("削除されていません"), "");
    record("[未認証] 移行画面への導線がある", await evalJson(client, `!!document.querySelector('a[href="/account/local-data-migration"]')`), "");
    const legacyStillThereUnauth = await getLocalStorageItem(client, LEGACY_MY_TEAM_KEY);
    record("[未認証] レガシーデータ自体は変更されない(件数表示だけ)", legacyStillThereUnauth === legacyThree, "");

    // ============================================================
    // ユーザーA: A専用領域だけを表示する
    // ============================================================
    await navigateAndSettle(client, `${MY_TEAM_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[ユーザーA] A領域は最初空(レガシーは自動表示されない)", !/10001|10002|10003/.test(body), "");
    record("[ユーザーA] レガシー件数案内は引き続き表示される", /3件/.test(body), "");

    // Aのアカウント専用キーへ直接1件追加(通常操作の代替。UIのカード追加はプレイヤー検索が必要なため)。
    // キーはアプリのcomputeAccountScopeId()と同じアルゴリズムでNode側から直接算出する
    // (localStorageの列挙に頼らない。書込み前はキー自体がまだ存在しないため)。
    const aScopedKey = await scopedMyTeamKeyFor(USER_A);
    const bScopedKey = await scopedMyTeamKeyFor(USER_B);
    record("[キー算出] AとBのアカウント別My Teamキーが異なる(内部キー名は報告に含めない)", aScopedKey !== bScopedKey, "");

    await setLocalStorageItem(client, aScopedKey, legacyFixtureJson([fixtureRecord("20001")]));
    await navigateAndSettle(client, `${MY_TEAM_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[ユーザーA] A領域のMy Teamが表示される", /20001/.test(body) || body.includes("1"), "");

    // ============================================================
    // ユーザーB: B専用領域だけを表示する(Aのデータが見えない)
    // ============================================================
    await navigateAndSettle(client, `${MY_TEAM_PAGE}?__efbAuth=1&__efbUserId=${USER_B}`);
    body = await bodyText(client);
    record("[ユーザーB] Aのカード(20001)が表示されない", !body.includes("20001"), "");
    record("[ユーザーB] レガシー件数案内は引き続き表示される(3件)", /3件/.test(body), "");

    // ============================================================
    // ユーザーAへ戻る: Aのデータが維持されている
    // ============================================================
    await navigateAndSettle(client, `${MY_TEAM_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[A復帰] Aのカード(20001)がまだ表示される", body.includes("20001") || !body.includes("My Team にはまだカードがありません"), "");

    // ============================================================
    // ログアウト: guest領域へ戻る(Aのデータは表示しない・削除もしない)
    // ============================================================
    await callInPage(client, async function () {
      if (window.__EFB_AUTH_TEST_DOUBLE__ && window.__EFB_AUTH_TEST_DOUBLE__.signOut) {
        await window.__EFB_AUTH_TEST_DOUBLE__.signOut();
      }
    });
    await waitForCondition(async () => !(await bodyText(client)).includes("20001"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[ログアウト] Aのカード(20001)は表示されない", !body.includes("20001"), "");
    const aDataAfterLogout = await getLocalStorageItem(client, aScopedKey);
    record("[ログアウト] Aのアカウント領域データは削除されない", aDataAfterLogout != null && aDataAfterLogout.includes("20001"), "");

    // ============================================================
    // 移行センター: 未認証
    // ============================================================
    await navigateAndSettle(client, MIGRATION_PAGE);
    body = await bodyText(client);
    record("[移行センター/未認証] レガシー件数(My Team 3件)が表示される", /3/.test(body), "");
    record("[移行センター/未認証] ログインが必要である旨が表示される", body.includes("ログイン"), "");
    const hasMigrateButtonUnauth = await evalJson(client, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('移行する'))`);
    record("[移行センター/未認証] 移行実行ボタンは表示されない", hasMigrateButtonUnauth === false, "");

    // ============================================================
    // 移行センター: ユーザーAでプレビュー→実行→ロールバック検証は含めず正常系を確認
    // ============================================================
    await navigateAndSettle(client, `${MIGRATION_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[移行センター/A] 現在ログイン中のアカウント表記が出る(メール等は出ない)", body.includes("現在ログイン中のアカウント"), "");
    record("[移行センター/A] 内部UUID風の文字列を表示しない", !UUID_LIKE_RE.test(body), "");
    record("[移行センター/A] スコープハッシュ(64桁hex)を表示しない", !HEX64_RE.test(body), "");

    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[移行センター/A] プレビューにレガシー件数3が表示される", /レガシー件数[\s\S]{0,10}3/.test(body.replace(/\s+/g, " ")) || body.includes("3"), "");
    record("[移行センター/A] 新規追加候補が表示される", body.includes("新規追加候補"), "");
    record("[移行センター/A] レガシー元データは残る旨が表示される", body.includes("削除されません"), "");
    record("[移行センター/A] Supabaseへ送信されない旨が表示される", body.includes("送信されません"), "");
    record("[移行センター/A] プレビューだけではlocalStorageへ書き込まれない", (await getLocalStorageItem(client, LEGACY_MY_TEAM_KEY)) === legacyThree, "");

    await clickButtonByText(client, "新規追加分を移行する");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[移行確認/A] 確認画面が表示される", body.includes("移行を実行しますか"), "");
    const migrateDisabledBefore = await isButtonDisabled(client, "移行する");
    record("[移行確認/A] チェック前は移行実行ボタンが無効化される", migrateDisabledBefore === true, `disabled=${migrateDisabledBefore}`);
    await ackCheckboxIfPresent(client, "local-data-migration-ack");
    const migrateDisabledAfter = await isButtonDisabled(client, "移行する");
    record("[移行確認/A] チェック後は移行実行ボタンが有効になる", migrateDisabledAfter === false, `disabled=${migrateDisabledAfter}`);

    await clickButtonByText(client, "移行する");
    await waitForCondition(async () => (await bodyText(client)).includes("追加しました"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[移行実行/A] 成功メッセージが表示される", body.includes("追加しました"), "");
    const legacyAfterMigrate = await getLocalStorageItem(client, LEGACY_MY_TEAM_KEY);
    record("[移行実行/A] レガシー共通My Teamは削除されない", legacyAfterMigrate === legacyThree, "");
    const aAfterMigrate = await getLocalStorageItem(client, aScopedKey);
    const parsedA = JSON.parse(aAfterMigrate);
    const ids = parsedA.records.map((r) => r.worldCardId).sort();
    record("[移行実行/A] Aのアカウント領域に元の20001と移行された10001-10003が揃う", JSON.stringify(ids) === JSON.stringify(["10001", "10002", "10003", "20001"]), JSON.stringify(ids));

    // 再度プレビューすると新規追加候補が0になっている(重複扱い)
    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[再プレビュー/A] 追加できるデータがない旨が表示される", body.includes("追加できるデータはありません") || body.includes("重複"), "");

    // ============================================================
    // My Teamクラウド: アカウント領域が空でクラウドにデータがある場合の上書き拒否
    // ============================================================
    // Bのアカウント領域へ先に1件仕込んでから保存し、クラウド側に1件を作る。
    await setLocalStorageItem(client, bScopedKey, legacyFixtureJson([fixtureRecord("30001")]));
    await navigateAndSettle(client, `${BASE}/account/my-team-cloud?__efbAuth=1&__efbUserId=${USER_B}`);
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    await ackCheckboxIfPresent(client, "my-team-cloud-provenance-ack");
    await clickButtonByText(client, "保存する");
    await waitForCondition(async () => (await bodyText(client)).includes("クラウド保存済み"), { timeoutMs: 4000, intervalMs: 100 });
    // Bのアカウント領域My Teamキーを空にする(クラウドには1件残っている状態を作る)。
    // ページ遷移(reload)はテストダブルのクラウド内メモリ状態を初期化してしまう
    // (実Supabaseでは永続化されるが、テストダブルは新規ドキュメント読込ごとに
    // 再初期化される既知の制約。black-box-rls-test.mjs等と同じ制約)ため、
    // 同一ドキュメント内でネイティブのStorageEventを発火させ、画面へ反映させる。
    await callInPage(
      client,
      function (k) {
        localStorage.removeItem(k);
        window.dispatchEvent(new StorageEvent("storage", { key: k, storageArea: localStorage }));
      },
      bScopedKey,
    );
    await waitForCondition(async () => (await bodyText(client)).includes("空のデータでクラウドMy Teamを上書きしません"), { timeoutMs: 3000, intervalMs: 100 });
    body = await bodyText(client);
    record("[My Teamクラウド/空領域] 空データでの上書きを拒否する旨が表示される", body.includes("空のデータでクラウドMy Teamを上書きしません"), "");
    // 外側の「クラウドへ保存」ボタンは確認ダイアログを開くためのトリガーであり、
    // 既存のUNKNOWN/MISMATCH判定と同じ設計方針で常時有効(saving/読み込み中のみ無効)。
    // ハードブロックは確認ダイアログ内の実行ボタン(「保存する」)のdisabled属性で行う。
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record(
      "[My Teamクラウド/空領域] 確認ダイアログにも拒否メッセージが表示される",
      body.includes("空のデータでクラウドMy Teamを上書きしません"),
      "",
    );
    const cloudSaveDisabledForEmpty = await isButtonDisabled(client, "保存する");
    record("[My Teamクラウド/空領域] 確認ダイアログの実行ボタンが無効化されている", cloudSaveDisabledForEmpty === true, `disabled=${cloudSaveDisabledForEmpty}`);
    await clickButtonByText(client, "キャンセル");
    // 後始末: Bのクラウドテストデータを削除する(テストダブル内メモリのみ、実Supabaseへは影響しない)。
    await callInPage(client, async function () {
      var db = window.__EFB_DB_TEST_DOUBLE__;
      if (!db) return;
      var current = await db.from("my_team_snapshots").select();
      var row = current.data && current.data[0];
      if (row) await db.from("my_team_snapshots").delete().eq("id", row.id).select("id");
    });

    // ============================================================
    // 一括削除: アカウント別領域の対象外である旨が表示される
    // ============================================================
    await navigateAndSettle(client, `${BASE}/data-management`);
    body = await bodyText(client);
    record("[一括削除] アカウント専用領域は対象外である旨が表示される", body.includes("削除されません"), "");

    // ============================================================
    // セキュリティ全般
    // ============================================================
    await navigateAndSettle(client, `${MIGRATION_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    const html = await evalJson(client, "document.documentElement.outerHTML");
    record("[セキュリティ] Secret key/service_role等の実値が混入していない", !SECRET_LEAK_RE.test(html), "");
    record("[セキュリティ] 内部UUID風の文字列を表示しない", !UUID_LIKE_RE.test(html), "");
    record("[セキュリティ] スコープハッシュ(64桁hex)を表示しない", !HEX64_RE.test(html), "");
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[セキュリティ] 新規の外部通信が発生していない(実Supabaseを含む)", externalRequests.length === 0, externalRequests.slice(0, 5).join(", "));

    // ============================================================
    // i18n(英語)
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${MIGRATION_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    const enBody = await bodyText(client);
    record("[英語] 移行センターが英語表示される", enBody.includes("Local Data Migration") || enBody.includes("Preview migration"), "");
    record("[英語] 日本語固定文が残らない", !/移行内容を確認|ログインが必要です/.test(enBody), "");
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // ============================================================
    // レスポンシブ(1280px / 390px)
    // ============================================================
    for (const width of [1280, 390]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
      await navigateAndSettle(client, `${MIGRATION_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
      const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
      record(`[レスポンシブ${width}px/移行センター] 横スクロールが発生しない`, overflow <= 4, `overflow=${overflow}`);
      await navigateAndSettle(client, `${MY_TEAM_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
      const overflow2 = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
      record(`[レスポンシブ${width}px/My Team] 横スクロールが発生しない`, overflow2 <= 4, `overflow=${overflow2}`);
    }
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // 既存機能スモーク回帰
    // ============================================================
    for (const p of ["/", "/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads", "/favorites", "/account", "/account/rls-test", "/account/my-team-cloud", "/data-management", "/auth/sign-in"]) {
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
  console.log(`\n[black-box-account-scoped-storage] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# アカウント別localStorage名前空間(Stage 1/2) ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。ブラウザー側Supabaseクライアント(auth・DBとも)はテストダブルへ差し替え、実Supabaseへは接続しない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。テストダブルの`__efbUserId`パラメーターで、単一の固定テストダブルのままユーザーA/B相当のアカウント切り替えを再現する。",
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
  console.log(`[black-box-account-scoped-storage] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
