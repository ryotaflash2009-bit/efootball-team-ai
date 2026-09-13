/**
 * My Teamクラウド保存(手動・任意PoC)専用のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-my-team-cloud.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - `installSupabaseAuthTestDouble`により、ブラウザー側のSupabaseクライアント(auth・DBとも)を
 *   安全なテストダブルへ差し替える。実Supabaseへの接続・実メール送信は一切発生しない。
 * - RLSそのもの(実際のユーザー間データ分離)は実Supabase上のSQL監査・手動検証で証明する対象であり、
 *   このスクリプトが検証するのは「アプリ層がクラウド保存/取得/削除の結果を安全に扱えているか」
 *   「ログインだけで自動送信されないか」「ローカルデータが保護されているか」「秘密情報を表示していないか」。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。フィクスチャは
 *   架空のworldCardId・localStorage値のみを使用する。
 * - 結果は docs/black-box-tests/my-team-cloud.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "my-team-cloud.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGE = `${BASE}/account/my-team-cloud`;

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const MY_TEAM_KEY = "efootball-team-ai:my-team:v1";
const MY_TEAM_STORAGE_VERSION = "my-team-storage/2026-08-30.v1";

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
function myTeamFixtureJson(records) {
  return JSON.stringify({ storageVersion: MY_TEAM_STORAGE_VERSION, updatedAt: new Date().toISOString(), records });
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
async function clickButtonByText(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.includes(needle) && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    },
    text,
  );
}
// disabled属性を無視して強制的に.click()を呼ぶ(clickButtonByTextとは異なり、
// !x.disabledフィルターを掛けない)。ネイティブのdisabledな<button>は.click()しても
// クリックイベント自体が発火しない、という実ブラウザーの標準動作を直接検証するために使う。
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
// disabledなボタンへフォーカスを試み、Enter/Spaceのkeydown/keyupを発火する
// (フォーカス自体が当たらない、あるいはイベントが発火しても実行に至らないことを確認する)。
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
async function getUpsertCallCount(client) {
  return evalJson(client, "window.__EFB_TEST_MT_UPSERT_CALLS__ || 0");
}
async function buttonExists(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      return btns.some((x) => x.textContent && x.textContent.trim() === needle);
    },
    text,
  );
}
// 保存確認画面に「由来確認」チェックボックスが表示されている場合(MATCH以外)だけ、
// それをチェックする(表示されていなければ何もしない=MATCH時は完全な無操作)。
// checked プロパティの直接代入+change イベント発火では、Reactの制御下にある
// チェックボックスのonChangeが発火しないことを確認したため、実ブラウザー操作と同じ
// .click()を使う(ネイティブのクリック相当のイベント一式が発生し、Reactが正しく検知する)。
async function ackProvenanceCheckboxIfPresent(client) {
  await callInPage(client, function () {
    const cb = document.querySelector('input[name="my-team-cloud-provenance-ack"]');
    if (cb && !cb.checked) cb.click();
  });
}
async function isButtonDisabled(client, text) {
  return callInPage(
    client,
    function (needle) {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.textContent && x.textContent.includes(needle));
      return b ? b.disabled : null;
    },
    text,
  );
}

const SECRET_LEAK_RE = /sb_secret_|service_role|access_token=|refresh_token=|SUPABASE_SERVICE_ROLE/i;
const REAL_LOOKING_EMAIL_RE = /[a-z0-9._%+-]+@(?!example\.(?:com|invalid)|efb-test-double\.example\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i;
const UNREPLACED_VAR_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}|__[A-Z_]+__/;
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
    // about:blank はオリジンが不定でlocalStorageへアクセスできないため、
    // 最初に一度ナビゲートしてから状態を仕込む。
    await navigateAndSettle(client, PAGE);
    const unauthFixture = myTeamFixtureJson([fixtureRecord("10001")]);
    await setLocalStorageItem(client, MY_TEAM_KEY, unauthFixture);
    await navigateAndSettle(client, PAGE);
    const unauthBody = await bodyText(client);
    record("[未認証] クラッシュせず表示される", errors.length === 0, errors.slice(0, 2).join(" / "));
    record("[未認証] ログイン必須の案内が表示される", unauthBody.includes("ログイン"), "");
    const hasSignInLink = await evalJson(client, `!!document.querySelector('a[href="/auth/sign-in"]')`);
    record("[未認証] ログイン導線がある", hasSignInLink === true, "");
    const noSaveButton = !(await buttonExists(client, "クラウドへ保存"));
    const noDeleteButton = !(await buttonExists(client, "クラウドデータを削除"));
    record("[未認証] クラウド操作ボタンを表示しない", noSaveButton && noDeleteButton, "");
    const localAfterUnauth = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[未認証] ローカルMy Teamは変更されない", localAfterUnauth === unauthFixture, "");
    record("[未認証] 内部UUIDを表示しない", !UUID_LIKE_RE.test(unauthBody), "");
    record("[未認証] Secret key/service_role等を表示しない", !SECRET_LEAK_RE.test(unauthBody), "");
    record("[未認証] ブラウザー共通データである旨が表示される", unauthBody.includes("このブラウザーで共通です"), "");
    record("[未認証] My Builds等が未同期である旨が表示される", unauthBody.includes("まだクラウド同期の対象ではありません"), "");

    // ============================================================
    // 認証済み・クラウドデータなし・ローカル空
    // ============================================================
    await setLocalStorageItem(client, MY_TEAM_KEY, myTeamFixtureJson([]));
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    let body = await bodyText(client);
    record("[認証済み/初期] ログインだけでは自動送信されない旨が表示される", body.includes("自動送信されません"), "");
    record("[認証済み/初期] クラウド保存は任意である旨が表示される", body.includes("任意です"), "");
    record("[認証済み/初期] ローカル件数0が表示される", body.includes("0"), "");
    record("[認証済み/初期] クラウドデータなしと表示される", body.includes("クラウドデータなし"), "");
    record("[認証済み/初期] ブラウザー共通データである旨が表示される", body.includes("このブラウザーで共通です"), "");
    record("[認証済み/初期] My Builds等が未同期である旨が表示される", body.includes("まだクラウド同期の対象ではありません"), "");

    // 保存確認画面(空のMy Team)
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[保存確認/空] 保存前の確認画面が表示される", body.includes("保存前の確認"), "");
    record("[保存確認/空] 保存対象件数が表示される", /保存対象件数.*0/.test(body.replace(/\s+/g, " ")), "");
    record("[保存確認/空] 空のMy Teamを保存する警告が表示される", body.includes("空の状態で保存されます"), "");
    record("[保存確認/空] ローカルは削除されない旨が表示される", body.includes("ローカルのMy Teamは削除されません"), "");
    // キャンセルすると何も変わらない
    await clickButtonByText(client, "キャンセル");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[保存キャンセル] キャンセル後もクラウドデータなしのまま", body.includes("クラウドデータなし"), "");

    // ============================================================
    // ローカルに2件登録 → 保存 → 検証
    // ============================================================
    const twoRecords = [fixtureRecord("10001"), fixtureRecord("10002")];
    const twoRecordsFixture = myTeamFixtureJson(twoRecords);
    await setLocalStorageItem(client, MY_TEAM_KEY, twoRecordsFixture);
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    body = await bodyText(client);
    record("[ローカル2件] ローカル件数2が表示される", /現在のローカル件数[\s\S]{0,20}2/.test(body) || body.includes("2"), "");

    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[保存確認/2件] 保存対象件数2が表示される", /保存対象件数[:\s]*2件/.test(body), "");
    record("[保存確認/2件] お気に入り等は含まれない旨が表示される", body.includes("保存対象に含まれません"), "");
    await ackProvenanceCheckboxIfPresent(client); // このブラウザーでの初回保存(由来UNKNOWN)のため明示確認が必要
    await clickButtonByText(client, "保存する");
    await waitForCondition(async () => (await bodyText(client)).includes("クラウド保存済み"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[保存/2件] 保存成功メッセージが表示される", body.includes("クラウドへ保存しました"), "");
    record("[保存/2件] クラウド件数2が表示される", body.includes("クラウド保存済み") && /2/.test(body), "");
    const localAfterSave = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[保存/2件] 保存成功後もローカルデータは変更されない", localAfterSave === twoRecordsFixture, "");

    // 保存直後、一致プレビュー(追加候補なし)
    body = await bodyText(client);
    record("[プレビュー/一致] 追加候補なしメッセージが表示される", body.includes("追加できる新しいカードはありません"), "");
    record("[プレビュー/一致] 反映ボタンは表示されない", !body.includes("ローカルへ反映（不足分のみ追加）"), "");

    // ============================================================
    // 既存クラウドデータがある状態での再保存(上書き確認)
    // ============================================================
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[再保存確認] 既存データの上書き警告が表示される", body.includes("上書きされます"), "");
    await clickButtonByText(client, "キャンセル");

    // ============================================================
    // クラウドのみに存在するカード(直接テストダブル経由で注入) → プレビュー → 反映
    // ============================================================
    const injected = await callInPage(client, async function () {
      var db = window.__EFB_DB_TEST_DOUBLE__;
      if (!db) return null;
      var current = await db.from("my_team_snapshots").select();
      var row = current.data && current.data[0];
      if (!row) return null;
      var items = row.team_data.items.slice();
      items.push({
        worldCardId: "99999",
        ownershipStatus: "owned",
        usageStatus: "main",
        selectedBuildId: null,
        favoriteBuildId: null,
        note: "",
        tags: [],
        addedAt: "2026-09-05T00:00:00.000Z",
        updatedAt: "2026-09-05T00:00:00.000Z",
      });
      return db
        .from("my_team_snapshots")
        .upsert({
          schema_version: row.schema_version,
          team_data: { items: items },
          item_count: items.length,
          payload_hash: "0".repeat(64),
          client_updated_at: new Date().toISOString(),
        })
        .select();
    });
    record("[直接注入] クラウドのみのカードを注入できる(検証用)", Array.isArray(injected?.data) && injected.data[0]?.item_count === 3, JSON.stringify(injected));

    await clickButtonByText(client, "クラウドデータを確認");
    await waitForCondition(async () => (await bodyText(client)).includes("ローカルへ反映（不足分のみ追加）"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[プレビュー/差分] クラウドのみカードが検出され反映ボタンが表示される", body.includes("ローカルへ反映（不足分のみ追加）"), "");
    record("[プレビュー/差分] 確認しただけではローカル未変更の旨が表示される", body.includes("ローカルデータはまだ変更されていません"), "");
    const localBeforeApply = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[プレビュー/差分] プレビュー表示だけではローカルが変化しない", localBeforeApply === twoRecordsFixture, "");

    await clickButtonByText(client, "ローカルへ反映（不足分のみ追加）");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[反映確認] 反映前の確認画面が表示される", body.includes("ローカルへ反映しますか"), "");
    record("[反映確認] 追加件数が案内される", /1/.test(body), "");
    await clickButtonByText(client, "追加する");
    await waitForCondition(async () => {
      const raw = await getLocalStorageItem(client, MY_TEAM_KEY);
      return typeof raw === "string" && raw.includes("99999");
    }, { timeoutMs: 4000, intervalMs: 100 });
    const localAfterApply = await getLocalStorageItem(client, MY_TEAM_KEY);
    const parsedAfterApply = JSON.parse(localAfterApply);
    record("[反映/実行] クラウド専用カードがローカルへ追加される", parsedAfterApply.records.some((r) => r.worldCardId === "99999"), "");
    record("[反映/実行] 既存のローカルレコード(10001/10002)は変更されない", ["10001", "10002"].every((id) => {
      const rec = parsedAfterApply.records.find((r) => r.worldCardId === id);
      return rec && rec.addedAt === "2026-09-01T00:00:00.000Z";
    }), "");
    body = await bodyText(client);
    record("[反映/実行] 反映成功メッセージが表示される", /1件をローカルへ追加しました/.test(body), "");

    // ============================================================
    // クラウドデータ削除
    // ============================================================
    await clickButtonByText(client, "クラウドデータを削除");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[削除確認] 削除前の確認画面が表示される", body.includes("削除しますか"), "");
    record("[削除確認] ローカルは削除されない旨が表示される", body.includes("ローカルのMy Team・お気に入り・保存ビルド・保存スカッドは削除されません"), "");
    await clickButtonByText(client, "削除する");
    await waitForCondition(async () => (await bodyText(client)).includes("クラウドデータを削除しました"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[削除/実行] 削除成功メッセージが表示される", body.includes("クラウドデータを削除しました"), "");
    record("[削除/実行] クラウドデータなし表示に戻る", body.includes("クラウドデータなし"), "");
    const localAfterDelete = await getLocalStorageItem(client, MY_TEAM_KEY);
    const parsedAfterDelete = JSON.parse(localAfterDelete);
    record("[削除/実行] クラウド削除後もローカルMy Team(3件)は保持される", parsedAfterDelete.records.length === 3, "");

    // ============================================================
    // 異常系: 複数行検知・0件削除
    // ============================================================
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    await ackProvenanceCheckboxIfPresent(client);
    await clickButtonByText(client, "保存する");
    await waitForCondition(async () => (await bodyText(client)).includes("クラウド保存済み"), { timeoutMs: 4000, intervalMs: 100 });

    const doubleDelete = await callInPage(client, async function () {
      var db = window.__EFB_DB_TEST_DOUBLE__;
      var del1 = await db.from("my_team_snapshots").delete().eq("id", "nonexistent-id").select("id");
      return del1;
    });
    record("[異常系] 存在しないIDへの削除は0件になる(成功として誤扱いしない)", Array.isArray(doubleDelete?.data) && doubleDelete.data.length === 0, JSON.stringify(doubleDelete));

    await callInPage(client, function () {
      window.__EFB_TEST_FORCE_MULTIROW__ = true;
    });
    await clickButtonByText(client, "クラウドデータを確認");
    await new Promise((r) => setTimeout(r, 300));
    body = await bodyText(client);
    record("[異常系] 複数行検知時もクラッシュしない", errors.filter((e) => /my_team_snapshots|MULTIPLE_ROWS/i.test(e)).length === 0, "");
    record("[異常系] 複数行検知時に安全なエラー文言が表示される", body.includes("想定外の状態を検知したため"), "");
    await callInPage(client, function () {
      window.__EFB_TEST_FORCE_MULTIROW__ = false;
    });

    // ============================================================
    // 処理中の二重送信防止(遅延応答)
    // ============================================================
    // window.__EFB_TEST_MT_DELAY_MS__はページ固有の状態のため、ナビゲート(新規ドキュメント)の後に設定する。
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    await callInPage(client, function () {
      window.__EFB_TEST_MT_DELAY_MS__ = 600;
    });
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    await ackProvenanceCheckboxIfPresent(client);
    await clickButtonByText(client, "保存する");
    await new Promise((r) => setTimeout(r, 150));
    const savingDisabled = await isButtonDisabled(client, "保存中");
    record("[二重送信防止] 保存処理中はボタンが無効化される", savingDisabled === true, `disabled=${savingDisabled}`);
    await waitForCondition(async () => (await bodyText(client)).includes("クラウド保存済み"), { timeoutMs: 4000, intervalMs: 100 });
    await callInPage(client, function () {
      window.__EFB_TEST_MT_DELAY_MS__ = 0;
    });

    // ============================================================
    // 由来チェック(アカウント切替後のローカルデータ誤保存防止)
    // ============================================================
    const ACCOUNT_HINT_KEY = "efootball-team-ai:local-account-hint:v1";
    const ACCOUNT_HINT_VERSION = "my-team-cloud-account-hint/2026-09-13.v2";

    // ここまでに複数回「保存する」が成功しているため、目印は現在のテストダブルの
    // 固定アカウントと一致している(MATCH)はずで、追加警告は表示されない。
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    body = await bodyText(client);
    record("[由来/MATCH] 一致時は別アカウント警告バナーが表示されない", !body.includes("別のアカウントで最後に使用された可能性があります"), "");
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    const checkboxExistsMatch = await evalJson(client, `!!document.querySelector('input[name="my-team-cloud-provenance-ack"]')`);
    record("[由来/MATCH] 一致時は由来確認チェックボックス自体が表示されない", checkboxExistsMatch === false, "");
    const matchConfirmDisabled = await isButtonDisabled(client, "保存する");
    record("[由来/MATCH] 一致時は保存ボタンが最初から有効", matchConfirmDisabled === false, `disabled=${matchConfirmDisabled}`);
    await clickButtonByText(client, "キャンセル");

    // UNKNOWNを模擬する: 目印を完全に削除する(このブラウザーでの初回利用相当)。
    await callInPage(
      client,
      function (key) {
        localStorage.removeItem(key);
      },
      ACCOUNT_HINT_KEY,
    );
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    body = await bodyText(client);
    record("[由来/UNKNOWN] 初回利用相当の穏やかな注記が表示される", body.includes("初めて") || body.includes("確認できません"), "");
    record("[由来/UNKNOWN] 強い警告(別アカウント文言)は表示されない", !body.includes("別のアカウントで最後に使用された可能性があります"), "");
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    const checkboxExistsUnknown = await evalJson(client, `!!document.querySelector('input[name="my-team-cloud-provenance-ack"]')`);
    record("[由来/UNKNOWN] 保存確認でも由来確認チェックボックスが表示される", checkboxExistsUnknown === true, "");
    const unknownConfirmDisabled = await isButtonDisabled(client, "保存する");
    record("[由来/UNKNOWN] チェック前は保存ボタンが無効化される", unknownConfirmDisabled === true, `disabled=${unknownConfirmDisabled}`);

    // 「見た目のdisabled」だけでなく、実際にクリック・キーボード操作しても保存が実行されない
    // (=擬似的な書き込みリクエストが1回も発生しない)ことを、テストダブルの呼び出し回数で直接確認する。
    const upsertCallsBeforeForceClick = await getUpsertCallCount(client);
    await forceClickButtonByText(client, "保存する");
    await new Promise((r) => setTimeout(r, 200));
    const upsertCallsAfterForceClick = await getUpsertCallCount(client);
    record(
      "[由来/UNKNOWN] disabledなボタンを直接.click()しても保存処理は実行されない(書込み試行0回)",
      upsertCallsAfterForceClick === upsertCallsBeforeForceClick,
      `before=${upsertCallsBeforeForceClick} after=${upsertCallsAfterForceClick}`,
    );
    body = await bodyText(client);
    record("[由来/UNKNOWN] 直接クリック後もクラウド保存済み表示にならない", !body.includes("クラウドへ保存しました"), "");

    const enterResult = await pressKeyOnButtonByText(client, "保存する", "Enter");
    await new Promise((r) => setTimeout(r, 150));
    const upsertCallsAfterEnter = await getUpsertCallCount(client);
    record(
      "[由来/UNKNOWN] disabledなボタンへEnterキーを送っても保存処理は実行されない",
      upsertCallsAfterEnter === upsertCallsBeforeForceClick,
      `focused=${enterResult && enterResult.focused} calls=${upsertCallsAfterEnter}`,
    );

    const spaceResult = await pressKeyOnButtonByText(client, "保存する", " ");
    await new Promise((r) => setTimeout(r, 150));
    const upsertCallsAfterSpace = await getUpsertCallCount(client);
    record(
      "[由来/UNKNOWN] disabledなボタンへSpaceキーを送っても保存処理は実行されない",
      upsertCallsAfterSpace === upsertCallsBeforeForceClick,
      `focused=${spaceResult && spaceResult.focused} calls=${upsertCallsAfterSpace}`,
    );
    body = await bodyText(client);
    record("[由来/UNKNOWN] キーボード操作後もクラウド保存済み表示にならない", !body.includes("クラウドへ保存しました"), "");

    // チェックを入れてからキャンセルし、再度開いたときにチェック状態がリセットされていることを確認する。
    await ackProvenanceCheckboxIfPresent(client);
    const checkedBeforeCancel = await evalJson(client, `document.querySelector('input[name="my-team-cloud-provenance-ack"]')?.checked`);
    record("[由来/UNKNOWN] チェック操作自体は反映される(前提確認)", checkedBeforeCancel === true, "");
    await clickButtonByText(client, "キャンセル");
    await new Promise((r) => setTimeout(r, 150));
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    const checkedAfterReopen = await evalJson(client, `document.querySelector('input[name="my-team-cloud-provenance-ack"]')?.checked`);
    record("[由来/再表示] ダイアログを閉じて再度開くとチェックはfalseへ戻る", checkedAfterReopen === false, "");
    const disabledAfterReopen = await isButtonDisabled(client, "保存する");
    record("[由来/再表示] 再表示時は保存ボタンが再び無効化される", disabledAfterReopen === true, `disabled=${disabledAfterReopen}`);

    await clickButtonByText(client, "キャンセル");

    // 旧形式(バージョン管理前の単純な文字列)が残っていても、MATCHとして誤認せず
    // UNKNOWN相当(穏やかな注記・要確認)として安全に扱われることを確認する
    // (旧形式を根拠に自動保存はしない)。
    await setLocalStorageItem(client, ACCOUNT_HINT_KEY, "legacy-plain-string-hint-not-json");
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    body = await bodyText(client);
    record("[由来/旧形式] 旧形式の値はMATCHとして扱われない(強い警告は出ないが穏やかな注記が出る)", body.includes("初めて") || body.includes("確認できません"), "");
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    const legacyConfirmDisabled = await isButtonDisabled(client, "保存する");
    record("[由来/旧形式] 旧形式の値だけでは保存ボタンが有効化されない(自動保存の根拠にしない)", legacyConfirmDisabled === true, `disabled=${legacyConfirmDisabled}`);
    await clickButtonByText(client, "キャンセル");

    // MISMATCHを模擬する: 目印(新形式のJSON)を無関係なハッシュ値へ書き換える(別アカウント由来の可能性)。
    await setLocalStorageItem(
      client,
      ACCOUNT_HINT_KEY,
      JSON.stringify({ version: ACCOUNT_HINT_VERSION, accountHash: "0".repeat(64), updatedAt: new Date().toISOString() }),
    );
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    body = await bodyText(client);
    record("[由来/MISMATCH] 別アカウント由来の可能性がある警告バナーが表示される", body.includes("別のアカウントで最後に使用された可能性があります"), "");

    const localBeforeMismatchSave = await getLocalStorageItem(client, MY_TEAM_KEY);
    await clickButtonByText(client, "クラウドへ保存");
    await new Promise((r) => setTimeout(r, 150));
    body = await bodyText(client);
    record("[由来/MISMATCH] 保存確認画面に由来不明の警告が表示される", body.includes("現在ログイン中のアカウントが作成したものとは限りません"), "");
    const checkboxExistsMismatch = await evalJson(client, `!!document.querySelector('input[name="my-team-cloud-provenance-ack"]')`);
    record("[由来/MISMATCH] 由来確認チェックボックスが表示される", checkboxExistsMismatch === true, "");

    const confirmDisabledBefore = await isButtonDisabled(client, "保存する");
    record("[由来/MISMATCH] チェック前は保存ボタンが無効化される(誤保存防止)", confirmDisabledBefore === true, `disabled=${confirmDisabledBefore}`);
    // チェックしていない状態で保存ボタンをクリックしても何も起きない(disabledのため反応しない)ことを確認する。
    await clickButtonByText(client, "保存する");
    await new Promise((r) => setTimeout(r, 200));
    body = await bodyText(client);
    record("[由来/MISMATCH] 未チェックでは保存が実行されない", !/クラウドへ保存しました/.test(body.slice(body.indexOf("保存前の確認"))), "");

    await ackProvenanceCheckboxIfPresent(client);
    await new Promise((r) => setTimeout(r, 100));
    const confirmDisabledAfter = await isButtonDisabled(client, "保存する");
    record("[由来/MISMATCH] チェック後は保存ボタンが有効になる", confirmDisabledAfter === false, `disabled=${confirmDisabledAfter}`);

    await clickButtonByText(client, "保存する");
    await waitForCondition(async () => (await bodyText(client)).includes("クラウド保存済み"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[由来/MISMATCH確認後] 明示チェック後は保存できる", body.includes("クラウドへ保存しました"), "");
    const localAfterMismatchSave = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[由来/MISMATCH確認後] 保存操作自体はローカルデータを変更しない", localAfterMismatchSave === localBeforeMismatchSave, "");

    // 保存成功後は目印が更新され、再訪問時にMATCH扱いへ戻る(以後の同一アカウントでは警告が出ない)。
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    body = await bodyText(client);
    record("[由来/更新後] 保存成功後は目印が更新され、以後は警告が出ない", !body.includes("別のアカウントで最後に使用された可能性があります"), "");

    // ============================================================
    // セッション: ログアウト後は画面がログイン要求へ戻り、ローカルは維持される
    // ============================================================
    const localBeforeLogout = await getLocalStorageItem(client, MY_TEAM_KEY);
    await callInPage(client, async function () {
      if (window.__EFB_AUTH_TEST_DOUBLE__ && window.__EFB_AUTH_TEST_DOUBLE__.signOut) {
        await window.__EFB_AUTH_TEST_DOUBLE__.signOut();
      }
    });
    await waitForCondition(async () => (await bodyText(client)).includes("ログイン"), { timeoutMs: 4000, intervalMs: 100 });
    body = await bodyText(client);
    record("[セッション] ログアウト後はログイン要求表示に戻る", body.includes("ログイン"), "");
    const localAfterLogout = await getLocalStorageItem(client, MY_TEAM_KEY);
    record("[セッション] ログアウトしてもローカルMy Teamは維持される", localAfterLogout === localBeforeLogout, "");

    // ============================================================
    // 英語(i18n)
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    const enBody = await bodyText(client);
    record("[英語] 画面が英語表示される", enBody.includes("My Team Cloud") || enBody.includes("Save to cloud"), "");
    record("[英語] 日本語固定文が残らない", !/クラウドへ保存|ログインが必要です/.test(enBody), "");
    record("[i18n] 未置換の変数プレースホルダーが残っていない", !UNREPLACED_VAR_RE.test(enBody), "");
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // ============================================================
    // セキュリティ全般
    // ============================================================
    await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
    const html = await evalJson(client, "document.documentElement.outerHTML");
    record("[セキュリティ] Secret key/service_role等の実値が混入していない", !SECRET_LEAK_RE.test(html), "");
    record("[セキュリティ] 実際のメールアドレス形式の値を表示しない", !REAL_LOOKING_EMAIL_RE.test(html), "");
    record("[セキュリティ] 内部UUID/レコードIDを表示しない", !UUID_LIKE_RE.test(html), "");
    const allHrefs = await evalJson(client, `[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))`);
    record("[セキュリティ] javascript:/data:スキームのリンクが存在しない", !allHrefs.some((h) => /^\s*(javascript|data):/i.test(h)), "");
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[セキュリティ] 新規の外部通信が発生していない(実Supabaseを含む)", externalRequests.length === 0, externalRequests.slice(0, 5).join(", "));

    // ============================================================
    // レスポンシブ(1280px / 390px)
    // ============================================================
    for (const width of [1280, 390]) {
      await client.send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
      await navigateAndSettle(client, `${PAGE}?__efbAuth=1`);
      const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
      record(`[レスポンシブ${width}px] 横スクロールが発生しない`, overflow <= 4, `overflow=${overflow}`);
    }
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // 既存機能スモーク回帰
    // ============================================================
    for (const p of ["/", "/players", "/my-team", "/my-builds", "/build-inventory", "/best-xi", "/squads", "/favorites", "/account", "/account/rls-test", "/auth/sign-in"]) {
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
  console.log(`\n[black-box-my-team-cloud] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# My Teamクラウド保存(PoC) ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。ブラウザー側Supabaseクライアント(auth・DBとも)はテストダブルへ差し替え、実Supabaseへは接続しない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。RLS自体の分離証明は実Supabase上のSQL監査・手動検証で別途行う。",
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
  console.log(`[black-box-my-team-cloud] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
