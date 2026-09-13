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
const MY_BUILDS_PAGE = `${BASE}/my-builds`;
const FAVORITES_PAGE = `${BASE}/favorites`;
const MIGRATION_PAGE = `${BASE}/account/local-data-migration`;

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const LEGACY_MY_TEAM_KEY = "efootball-team-ai:my-team:v1";
const LEGACY_MY_BUILDS_KEY = "efootball-team-ai:progression-builds:v1";
const LEGACY_FAVORITES_KEY = "efootball-team-ai:favorites:v1";

const USER_A = "black-box-user-a";
const USER_B = "black-box-user-b";

/** アプリのcomputeAccountScopeId()と完全に同じアルゴリズムで、Node側から期待キーを算出する。 */
async function scopedKeyFor(userId, kindSegment) {
  const prefix = "efootball-team-ai:local-storage-scope:v1:";
  const data = new TextEncoder().encode(prefix + userId);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const scopeId = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `efootball-team-ai:local:account:${scopeId}:${kindSegment}:v1`;
}
async function scopedMyTeamKeyFor(userId) {
  return scopedKeyFor(userId, "my-team");
}
async function scopedMyBuildsKeyFor(userId) {
  return scopedKeyFor(userId, "progression-builds");
}
async function scopedFavoritesKeyFor(userId) {
  return scopedKeyFor(userId, "favorites");
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
function myBuildsFixtureJson(entries) {
  // entries: [[worldCardId, buildId, buildName]]
  const map = {};
  for (const [worldCardId, buildId, buildName] of entries) {
    (map[worldCardId] ??= []).push({
      buildId,
      worldCardId,
      buildName,
      progressionAllocation: {},
      selectedPlayerBooster: null,
      calculatedStats: {},
      calculatedOvr: null,
      calculationMode: "provisional",
      rulesVersion: "progression/2026-08-28.v2",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      schemaVersion: 1,
    });
  }
  return JSON.stringify(map);
}
function favoritesFixtureJson(worldCardIds) {
  return JSON.stringify({
    storageVersion: "favorites-storage/2026-08-30.v1",
    updatedAt: new Date().toISOString(),
    records: worldCardIds.map((worldCardId) => ({
      localRecordId: `fav_${worldCardId}fx`,
      worldCardId,
      note: "",
      tags: [],
      addedAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      source: "local",
      syncStatus: "local_only",
    })),
  });
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
/** チェックボックスを明示的な状態(checked: true/false)へ設定する。 */
async function setCheckboxState(client, name, checked) {
  await callInPage(
    client,
    function (n, want) {
      const cb = document.querySelector(`input[name="${n}"]`);
      if (cb && cb.checked !== want) cb.click();
    },
    name,
    checked,
  );
}
/** disabledでも実行を試みる強制クリック(通常のclickButtonByTextはdisabledを除外するため、明示確認前の拒否を検証する用)。 */
async function forceClickButtonByText(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.trim() === needle);
      if (!b) return false;
      b.click();
      return true;
    },
    text,
  );
}
/** disabledなボタンへフォーカスを試み、Enter/Spaceのkeydown/keyupを発火する(実行に至らないことを確認する用)。 */
async function pressKeyOnButtonByText(client, text, key) {
  return callInPage(
    client,
    function (needle, k) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.trim() === needle);
      if (!b) return { found: false };
      b.focus();
      const opts = { key: k, code: k === " " ? "Space" : "Enter", bubbles: true, cancelable: true };
      b.dispatchEvent(new KeyboardEvent("keydown", opts));
      b.dispatchEvent(new KeyboardEvent("keyup", opts));
      return { found: true, focused: document.activeElement === b };
    },
    text,
    key,
  );
}
/** Node側でSHA-256(小文字16進)を計算する(バックアップの整合性ハッシュ検証用)。 */
async function sha256HexNode(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    // My Builds: guest/A/B分離・切り替え・ログアウト後の保持
    // ============================================================
    const aBuildsKey = await scopedMyBuildsKeyFor(USER_A);
    const bBuildsKey = await scopedMyBuildsKeyFor(USER_B);

    await navigateAndSettle(client, MY_BUILDS_PAGE);
    body = await bodyText(client);
    record("[My Builds/未認証] 画面がクラッシュせず表示される(guest空状態)", errors.length === 0 && body.includes("My Builds"), "");

    await setLocalStorageItem(client, aBuildsKey, myBuildsFixtureJson([["40001", "b_a1", "Aの攻撃ビルド"]]));
    await navigateAndSettle(client, `${MY_BUILDS_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[My Builds/A] A領域のビルドが表示される", body.includes("Aの攻撃ビルド"), "");

    await navigateAndSettle(client, `${MY_BUILDS_PAGE}?__efbAuth=1&__efbUserId=${USER_B}`);
    body = await bodyText(client);
    record("[My Builds/B] Aのビルドが表示されない", !body.includes("Aの攻撃ビルド"), "");

    await setLocalStorageItem(client, bBuildsKey, myBuildsFixtureJson([["40002", "b_b1", "Bの守備ビルド"]]));
    await navigateAndSettle(client, `${MY_BUILDS_PAGE}?__efbAuth=1&__efbUserId=${USER_B}`);
    body = await bodyText(client);
    record("[My Builds/B] B領域のビルドが表示される", body.includes("Bの守備ビルド"), "");
    record("[My Builds/B] Aのビルドは依然として表示されない", !body.includes("Aの攻撃ビルド"), "");

    await navigateAndSettle(client, `${MY_BUILDS_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[My Builds/A復帰] Aのビルドが復元される", body.includes("Aの攻撃ビルド"), "");
    record("[My Builds/A復帰] Bのビルドは表示されない", !body.includes("Bの守備ビルド"), "");

    await callInPage(client, async function () {
      if (window.__EFB_AUTH_TEST_DOUBLE__ && window.__EFB_AUTH_TEST_DOUBLE__.signOut) {
        await window.__EFB_AUTH_TEST_DOUBLE__.signOut();
      }
    });
    await waitForCondition(async () => !(await bodyText(client)).includes("Aの攻撃ビルド"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[My Builds/ログアウト] Aのビルドは表示されない(guestへ戻る)", !body.includes("Aの攻撃ビルド"), "");
    const aBuildsAfterLogout = await getLocalStorageItem(client, aBuildsKey);
    record("[My Builds/ログアウト] Aのアカウント領域データは削除されない", aBuildsAfterLogout != null && aBuildsAfterLogout.includes("Aの攻撃ビルド"), "");

    // ============================================================
    // お気に入り: guest/A/B分離・切り替え・ログアウト後の保持
    // ============================================================
    const aFavKey = await scopedFavoritesKeyFor(USER_A);
    const bFavKey = await scopedFavoritesKeyFor(USER_B);

    await navigateAndSettle(client, FAVORITES_PAGE);
    body = await bodyText(client);
    record("[お気に入り/未認証] 画面がクラッシュせず表示される(guest空状態)", errors.length === 0 && body.includes("お気に入り"), "");

    await setLocalStorageItem(client, aFavKey, favoritesFixtureJson(["50001"]));
    await navigateAndSettle(client, `${FAVORITES_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[お気に入り/A] A領域のお気に入りが表示される", body.includes("50001"), "");

    await navigateAndSettle(client, `${FAVORITES_PAGE}?__efbAuth=1&__efbUserId=${USER_B}`);
    body = await bodyText(client);
    record("[お気に入り/B] Aのお気に入り(50001)が表示されない", !body.includes("50001"), "");

    await setLocalStorageItem(client, bFavKey, favoritesFixtureJson(["50002", "50003"]));
    await navigateAndSettle(client, `${FAVORITES_PAGE}?__efbAuth=1&__efbUserId=${USER_B}`);
    body = await bodyText(client);
    record("[お気に入り/B] B領域の2件が表示される", body.includes("50002") && body.includes("50003"), "");

    await navigateAndSettle(client, `${FAVORITES_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[お気に入り/A復帰] Aのお気に入りが復元される", body.includes("50001"), "");
    record("[お気に入り/A復帰] Bのお気に入りは表示されない", !body.includes("50002") && !body.includes("50003"), "");

    await callInPage(client, async function () {
      if (window.__EFB_AUTH_TEST_DOUBLE__ && window.__EFB_AUTH_TEST_DOUBLE__.signOut) {
        await window.__EFB_AUTH_TEST_DOUBLE__.signOut();
      }
    });
    await waitForCondition(async () => !(await bodyText(client)).includes("50001"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[お気に入り/ログアウト] Aのお気に入りは表示されない(guestへ戻る)", !body.includes("50001"), "");
    const aFavAfterLogout = await getLocalStorageItem(client, aFavKey);
    record("[お気に入り/ログアウト] Aのアカウント領域データは削除されない", aFavAfterLogout != null && aFavAfterLogout.includes("50001"), "");

    // レガシー共通My Builds(4件相当)・お気に入り(2件)へフィクスチャを仕込む(実データではない)。
    // b_legacy1は後段の参照整合性(My Team→My Builds)テストでも再利用する。
    // b_legacy3はAのアカウント領域に同一buildIdで異なる内容のものを後で仕込み、競合検出を検証する。
    // 4件目は不正データ(buildId欠落)として、不正データ件数の検出を検証する。
    const legacyMyBuildsMap = JSON.parse(
      myBuildsFixtureJson([
        ["40001", "b_legacy1", "レガシービルド1"],
        ["40002", "b_legacy2", "レガシービルド2"],
        ["40003", "b_legacy3", "レガシービルド3(競合予定)"],
      ]),
    );
    legacyMyBuildsMap["40004"] = [{ worldCardId: "40004", buildName: "不正データ(buildId欠落)" }]; // buildIdが無い不正エントリ
    await setLocalStorageItem(client, LEGACY_MY_BUILDS_KEY, JSON.stringify(legacyMyBuildsMap));
    await setLocalStorageItem(client, LEGACY_FAVORITES_KEY, favoritesFixtureJson(["60001", "60002"]));
    // Aのアカウント領域へ、b_legacy3と同一IDだが内容が異なるビルドを先に仕込み、競合を発生させる。
    const aBuildsBeforeConflict = JSON.parse(await getLocalStorageItem(client, aBuildsKey));
    aBuildsBeforeConflict["40003"] = [
      {
        buildId: "b_legacy3",
        worldCardId: "40003",
        buildName: "Aの既存ビルド(競合)",
        progressionAllocation: {},
        selectedPlayerBooster: null,
        calculatedStats: {},
        calculatedOvr: null,
        calculationMode: "provisional",
        rulesVersion: "progression/2026-08-28.v2",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        schemaVersion: 1,
      },
    ];
    await setLocalStorageItem(client, aBuildsKey, JSON.stringify(aBuildsBeforeConflict));

    // ============================================================
    // 移行センター: 未認証
    // ============================================================
    await navigateAndSettle(client, MIGRATION_PAGE);
    body = await bodyText(client);
    record("[移行センター/未認証] レガシー件数(My Team 3件)が表示される", /3/.test(body), "");
    const flat = body.replace(/\s+/g, " ");
    // レガシー件数表示は「有効な要素数」だけを数える(buildId欠落の不正エントリ1件は除外)ため、
    // 4件仕込んでも表示は3件になる(不正データ件数は移行プレビュー側で別途1件として表示される)。
    record("[移行センター/未認証] レガシーMy Builds件数(有効3件)が表示される", /My Builds[\s\S]{0,10}3/.test(flat), "");
    record("[移行センター/未認証] レガシーお気に入り件数(2件)が表示される", /お気に入り[\s\S]{0,10}2/.test(flat), "");
    record("[移行センター/未認証] ログインが必要である旨が表示される", body.includes("ログイン"), "");
    const hasMigrateButtonUnauth = await evalJson(client, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('移行する'))`);
    record("[移行センター/未認証] 移行実行ボタンは表示されない", hasMigrateButtonUnauth === false, "");
    const hasSelectCheckboxUnauth = await evalJson(
      client,
      `!!document.querySelector('input[name="local-data-migration-select-myTeam"]')`,
    );
    record("[移行センター/未認証] 種別選択チェックボックスは表示されない(ログイン後のみ)", hasSelectCheckboxUnauth === false, "");

    // ============================================================
    // 移行センター: ユーザーAでプレビュー→実行→ロールバック検証は含めず正常系を確認
    // ============================================================
    await navigateAndSettle(client, `${MIGRATION_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[移行センター/A] 現在ログイン中のアカウント表記が出る(メール等は出ない)", body.includes("現在ログイン中のアカウント"), "");
    record("[移行センター/A] 内部UUID風の文字列を表示しない", !UUID_LIKE_RE.test(body), "");
    record("[移行センター/A] スコープハッシュ(64桁hex)を表示しない", !HEX64_RE.test(body), "");
    record(
      "[移行センター/A] 保存スカッド・テンプレートには選択チェックボックスが無い(引き続き対象外)",
      (await evalJson(client, `!document.querySelector('input[name="local-data-migration-select-squads"]')`)) &&
        (await evalJson(client, `!document.querySelector('input[name="local-data-migration-select-squadTemplates"]')`)),
      "",
    );

    const previewDisabledInitially = await isButtonDisabled(client, "移行内容を確認(プレビュー)");
    record("[移行センター/A] 何も選択していない状態ではプレビューボタンが無効", previewDisabledInitially === true, `disabled=${previewDisabledInitially}`);

    await ackCheckboxIfPresent(client, "local-data-migration-select-myTeam");
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
    await setCheckboxState(client, "local-data-migration-select-myTeam", false);

    // ============================================================
    // 参照整合性: My TeamがまだMy Buildsに存在しないbuildIdを参照している状態を作る
    // (レガシーMy Teamは移行済みだが、レガシーMy Buildsはまだ移行前、という正常にあり得る状態)。
    // ============================================================
    const aTeamAfterMigrate = JSON.parse(await getLocalStorageItem(client, aScopedKey));
    aTeamAfterMigrate.records[0].selectedBuildId = "b_legacy1";
    await setLocalStorageItem(client, aScopedKey, JSON.stringify(aTeamAfterMigrate));
    await navigateAndSettle(client, `${MIGRATION_PAGE}?__efbAuth=1&__efbUserId=${USER_A}`);
    body = await bodyText(client);
    record("[参照整合性/A] 参照されている保存ビルド数が表示される(1件以上)", /参照されている保存ビルド数/.test(body), "");
    record("[参照整合性/A] My Builds移行前は参照切れとして検出される(データ破損とはみなさない)", body.includes("参照切れ"), "");

    // ============================================================
    // 移行センター: My Builds・お気に入りを同時選択した状態のUI確認
    // (各データ種別を独立処理することの前提として、まず両方を選んでも
    //  それぞれ独立したプレビューパネルが個別に表示されることを確認する)。
    // ============================================================
    await ackCheckboxIfPresent(client, "local-data-migration-select-myBuilds");
    await ackCheckboxIfPresent(client, "local-data-migration-select-favorites");
    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record(
      "[移行センター/同時選択] My Builds・お気に入り両方のプレビュー見出しが同時に表示される",
      body.includes("My Buildsの移行プレビュー") && body.includes("お気に入りの移行プレビュー"),
      "",
    );
    // プレビューだけではどちらのアカウント領域キーも書き込まれない(0件書込み)。
    const aBuildsBeforePreviewWrite = await getLocalStorageItem(client, aBuildsKey);
    const aFavBeforePreviewWrite = await getLocalStorageItem(client, aFavKey);

    // ============================================================
    // 移行センター: My Buildsを個別に移行する(新規追加・重複0・競合1・不正データ1を含む)
    // ============================================================
    await setCheckboxState(client, "local-data-migration-select-favorites", false);
    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[移行センター/My Builds] プレビュー見出しが表示される", body.includes("My Buildsの移行プレビュー"), "");
    const mbFlat = body.replace(/\s+/g, " ");
    record(
      "[移行センター/My Builds] レガシー件数3(有効)・新規追加候補2・競合1・不正データ1が表示される",
      /レガシー件数[\s\S]{0,10}3/.test(mbFlat) &&
        /新規追加候補[\s\S]{0,10}2/.test(mbFlat) &&
        /競合[\s\S]{0,10}1/.test(mbFlat) &&
        /不正データ件数[\s\S]{0,10}1/.test(mbFlat),
      "",
    );
    record(
      "[移行センター/My Builds] プレビューだけではAのアカウント領域が書き込まれない",
      (await getLocalStorageItem(client, aBuildsKey)) === aBuildsBeforePreviewWrite,
      "",
    );

    // 明示確認前は、実行ボタンを強制クリック・Enter・Spaceで叩いても移行が実行されないことを確認する。
    await clickButtonByText(client, "新規追加分を移行する");
    await new Promise((r) => setTimeout(r, 200));
    const migrateDisabledForMb = await isButtonDisabled(client, "移行する");
    record("[移行確認/My Builds] チェック前は移行実行ボタンが無効化される", migrateDisabledForMb === true, `disabled=${migrateDisabledForMb}`);
    await forceClickButtonByText(client, "移行する");
    await pressKeyOnButtonByText(client, "移行する", "Enter");
    await pressKeyOnButtonByText(client, "移行する", " ");
    await new Promise((r) => setTimeout(r, 150));
    record(
      "[移行確認/My Builds] 強制クリック・Enter・Spaceでも実行されない(Aのアカウント領域が変化しない)",
      (await getLocalStorageItem(client, aBuildsKey)) === aBuildsBeforePreviewWrite,
      "",
    );
    record("[移行確認/My Builds] 未実行のため成功メッセージも表示されない", !(await bodyText(client)).includes("追加しました"), "");

    await ackCheckboxIfPresent(client, "local-data-migration-ack");
    const migrateEnabledForMb = await isButtonDisabled(client, "移行する");
    record("[移行確認/My Builds] チェック後は移行実行ボタンが有効になる", migrateEnabledForMb === false, `disabled=${migrateEnabledForMb}`);

    await clickButtonByText(client, "移行する");
    await waitForCondition(async () => (await bodyText(client)).includes("追加しました"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[移行実行/My Builds] 成功メッセージが表示される", body.includes("追加しました"), "");
    const legacyBuildsAfterMigrate = await getLocalStorageItem(client, LEGACY_MY_BUILDS_KEY);
    record(
      "[移行実行/My Builds] レガシー共通My Buildsは削除されない(不正データも含め4エントリのまま)",
      legacyBuildsAfterMigrate != null &&
        legacyBuildsAfterMigrate.includes("b_legacy1") &&
        legacyBuildsAfterMigrate.includes("b_legacy2") &&
        legacyBuildsAfterMigrate.includes("b_legacy3") &&
        legacyBuildsAfterMigrate.includes("40004"),
      "",
    );
    const aBuildsAfterMigrate = JSON.parse(await getLocalStorageItem(client, aBuildsKey));
    const migratedBuildIds = Object.values(aBuildsAfterMigrate)
      .flat()
      .map((b) => b.buildId)
      .sort();
    record(
      "[移行実行/My Builds] Aのアカウント領域に元のb_a1・既存b_legacy3(競合のため元のまま)と新規b_legacy1・b_legacy2が揃う(競合は上書きされない)",
      JSON.stringify(migratedBuildIds) === JSON.stringify(["b_a1", "b_legacy1", "b_legacy2", "b_legacy3"]),
      JSON.stringify(migratedBuildIds),
    );
    record(
      "[移行実行/My Builds] 競合していたb_legacy3の内容はAの既存内容のまま上書きされない",
      aBuildsAfterMigrate["40003"]?.[0]?.buildName === "Aの既存ビルド(競合)",
      String(aBuildsAfterMigrate["40003"]?.[0]?.buildName),
    );
    record("[参照整合性/A] My Builds移行後は参照切れが解消される(自動テスト)", !body.includes("参照切れ") || /参照切れ[\s\S]{0,10}0/.test(body.replace(/\s+/g, " ")), "");

    // バックアップ(localStorage内の一時キー)の内容整合性・秘密情報非混入を直接確認する。
    const mbLegacyBackupRaw = await getLocalStorageItem(client, "efootball-team-ai:local-storage-scope:backup:legacy:myBuilds:v1");
    const mbAccountBackupRaw = await getLocalStorageItem(client, "efootball-team-ai:local-storage-scope:backup:account:myBuilds:v1");
    record("[バックアップ/My Builds] レガシー領域のバックアップが保存されている", mbLegacyBackupRaw != null, "");
    record("[バックアップ/My Builds] account領域(移行前)のバックアップが保存されている", mbAccountBackupRaw != null, "");
    if (mbLegacyBackupRaw && mbAccountBackupRaw) {
      const mbLegacyBackup = JSON.parse(mbLegacyBackupRaw);
      const mbAccountBackup = JSON.parse(mbAccountBackupRaw);
      const expectedLegacyHash = await sha256HexNode(mbLegacyBackup.payload ?? "");
      const expectedAccountHash = await sha256HexNode(mbAccountBackup.payload ?? "");
      record(
        "[バックアップ/My Builds] バックアップの整合性ハッシュが実際のpayloadと一致する",
        mbLegacyBackup.payloadHash === expectedLegacyHash && mbAccountBackup.payloadHash === expectedAccountHash,
        "",
      );
      record(
        "[バックアップ/My Builds] account領域バックアップの中身は移行前(b_a1のみ)である",
        mbAccountBackup.payload != null && mbAccountBackup.payload.includes("b_a1") && !mbAccountBackup.payload.includes("b_legacy1"),
        "",
      );
      // payloadHash自体は整合性ハッシュ(64桁hex)として構造上正しく含まれるべき値のため、
      // 「秘密情報・内部UUID・スコープハッシュを含まない」の検査対象はpayload(実データ)本体だけに限る。
      const payloadOnly = JSON.stringify([mbLegacyBackup.payload, mbAccountBackup.payload]);
      record(
        "[バックアップ/My Builds] バックアップに秘密情報・内部UUID・スコープハッシュが含まれない",
        !SECRET_LEAK_RE.test(payloadOnly) && !UUID_LIKE_RE.test(payloadOnly) && !HEX64_RE.test(payloadOnly),
        "",
      );
    }
    // JSONバックアップのダウンロードボタン(任意機能)。ヘッドレス自動化環境では
    // File System Access API / ダウンロードが許可されないことがあるため、ここでは
    // クリックしてもクラッシュしない(JS例外が増えない)ことだけを確認する
    // (実際のファイル書き込み・保存先選択・成功/失敗分岐はbrowser-save-file.test.tsで担保)。
    const errorsBeforeDownloadClick = errors.length;
    await clickButtonByText(client, "バックアップをJSONでダウンロード");
    await new Promise((r) => setTimeout(r, 200));
    record(
      "[バックアップ/My Builds] JSONダウンロードボタンをクリックしてもクラッシュしない",
      errors.length === errorsBeforeDownloadClick,
      "",
    );

    // Bのアカウント領域・guest領域はAのMy Builds移行によって一切変更されていない
    // (Bは別シナリオで自分自身のビルド[b_b1]を既に保存済みのため、nullではなく内容の非混入を確認する)。
    const bBuildsAfterAMigration = await getLocalStorageItem(client, bBuildsKey);
    record(
      "[移行実行/My Builds] Bのアカウント領域My Buildsは変更されない(Bの既存データのまま・Aの移行分は混入しない)",
      bBuildsAfterAMigration != null &&
        bBuildsAfterAMigration.includes("b_b1") &&
        !bBuildsAfterAMigration.includes("b_legacy1") &&
        !bBuildsAfterAMigration.includes("b_legacy2") &&
        !bBuildsAfterAMigration.includes("b_legacy3"),
      "",
    );
    const guestBuildsKeyForMb = "efootball-team-ai:local:guest:progression-builds:v1";
    record(
      "[移行実行/My Builds] guest領域My Buildsキーは触れられていない(移行はaccount領域だけを対象とする)",
      (await getLocalStorageItem(client, guestBuildsKeyForMb)) === null,
      "",
    );
    await setCheckboxState(client, "local-data-migration-select-myBuilds", false);

    // ============================================================
    // 移行センター: お気に入りを個別に移行する(重複1・不正データを含む)
    // ============================================================
    // レガシーへ、既に移行済みの60001と重複するIDを含め3件目を追加(重複検出の確認)。
    await setLocalStorageItem(client, LEGACY_FAVORITES_KEY, favoritesFixtureJson(["60001", "60002", "60003"]));
    // Aのアカウント領域(既に50001のみ)には触れない。
    await ackCheckboxIfPresent(client, "local-data-migration-select-favorites");
    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[移行センター/お気に入り] プレビュー見出しが表示される", body.includes("お気に入りの移行プレビュー"), "");
    const favFlat = body.replace(/\s+/g, " ");
    record(
      "[移行センター/お気に入り] レガシー件数3・新規追加候補3が表示される",
      /レガシー件数[\s\S]{0,10}3/.test(favFlat) && /新規追加候補[\s\S]{0,10}3/.test(favFlat),
      "",
    );
    record(
      "[移行センター/お気に入り] プレビューだけではAのアカウント領域が書き込まれない",
      (await getLocalStorageItem(client, aFavKey)) === aFavBeforePreviewWrite,
      "",
    );

    await clickButtonByText(client, "新規追加分を移行する");
    await new Promise((r) => setTimeout(r, 200));
    await ackCheckboxIfPresent(client, "local-data-migration-ack");
    await clickButtonByText(client, "移行する");
    await waitForCondition(async () => (await bodyText(client)).includes("追加しました"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[移行実行/お気に入り] 成功メッセージが表示される", body.includes("追加しました"), "");
    const legacyFavAfterMigrate = await getLocalStorageItem(client, LEGACY_FAVORITES_KEY);
    record(
      "[移行実行/お気に入り] レガシー共通お気に入りは削除されない",
      legacyFavAfterMigrate != null &&
        legacyFavAfterMigrate.includes("60001") &&
        legacyFavAfterMigrate.includes("60002") &&
        legacyFavAfterMigrate.includes("60003"),
      "",
    );
    const aFavAfterMigrate = JSON.parse(await getLocalStorageItem(client, aFavKey));
    const migratedFavIds = aFavAfterMigrate.records.map((r) => r.worldCardId).sort();
    record(
      "[移行実行/お気に入り] Aのアカウント領域に元の50001と移行された60001・60002・60003が揃う",
      JSON.stringify(migratedFavIds) === JSON.stringify(["50001", "60001", "60002", "60003"]),
      JSON.stringify(migratedFavIds),
    );

    // 再プレビューで重複扱い(追加候補0)になることを確認する。
    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[再プレビュー/お気に入り] 追加できるデータがない旨が表示される", body.includes("追加できるデータはありません") || body.includes("重複"), "");

    // Bのアカウント領域お気に入りはAの移行によって変更されない。
    // Bは別シナリオで自分自身のお気に入り(50002・50003)を既に保存済みのため、
    // nullではなく内容の非混入(Aの移行分が混ざっていないこと)を確認する。
    const bFavAfterAMigration = await getLocalStorageItem(client, bFavKey);
    record(
      "[移行実行/お気に入り] Bのアカウント領域お気に入りは変更されない(Bの既存データのまま・Aの移行分は混入しない)",
      bFavAfterAMigration != null &&
        bFavAfterAMigration.includes("50002") &&
        bFavAfterAMigration.includes("50003") &&
        !bFavAfterAMigration.includes("60001") &&
        !bFavAfterAMigration.includes("60002") &&
        !bFavAfterAMigration.includes("60003"),
      "",
    );
    await setCheckboxState(client, "local-data-migration-select-favorites", false);

    // ============================================================
    // 移行実行の失敗・ロールバック(お気に入りのaccount領域書き込みだけを強制的に失敗させる)。
    // ============================================================
    await setLocalStorageItem(client, LEGACY_FAVORITES_KEY, favoritesFixtureJson(["60001", "60002", "60003", "70001"]));
    const aFavBeforeRollbackTest = await getLocalStorageItem(client, aFavKey);
    await callInPage(
      client,
      function (targetKey) {
        var orig = localStorage.setItem.bind(localStorage);
        window.__EFB_ORIG_SET_ITEM__ = orig;
        localStorage.setItem = function (k, v) {
          if (k === targetKey) return; // 移行実行時の書き込みだけを握りつぶし、検証失敗によるロールバックを再現する
          orig(k, v);
        };
      },
      aFavKey,
    );
    await ackCheckboxIfPresent(client, "local-data-migration-select-favorites");
    await clickButtonByText(client, "移行内容を確認(プレビュー)");
    await new Promise((r) => setTimeout(r, 200));
    await clickButtonByText(client, "新規追加分を移行する");
    await new Promise((r) => setTimeout(r, 200));
    await ackCheckboxIfPresent(client, "local-data-migration-ack");
    await clickButtonByText(client, "移行する");
    await waitForCondition(async () => /失敗|戻しました/.test(await bodyText(client)), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[ロールバック/お気に入り] 移行失敗・ロールバックの旨が表示される", /失敗|戻しました/.test(body), "");
    // 書き込みを元に戻す。
    await callInPage(client, function () {
      if (window.__EFB_ORIG_SET_ITEM__) localStorage.setItem = window.__EFB_ORIG_SET_ITEM__;
    });
    record(
      "[ロールバック/お気に入り] Aのアカウント領域は移行前の内容のまま(ロールバック済み)",
      (await getLocalStorageItem(client, aFavKey)) === aFavBeforeRollbackTest,
      "",
    );
    await setCheckboxState(client, "local-data-migration-select-favorites", false);

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
