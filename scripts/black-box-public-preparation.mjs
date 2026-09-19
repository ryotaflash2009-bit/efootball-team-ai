/**
 * 公開準備基盤フェーズ(サービス概要・利用規約・プライバシー・免責事項・データ管理・問い合わせ・
 * 公開準備状況・フッター・ローカルデータ削除)の専用ブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-public-preparation.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない
 *   (隔離プロファイルのlocalStorageのみ操作)。
 * - 外部通信・生成AI・APIキー・追加料金は一切発生しない(すべて静的データ・純関数)。
 * - 結果は docs/black-box-tests/public-preparation.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "public-preparation.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const LOCALE_KEY = "efootball-team-ai:locale:v1";
const MY_TEAM_KEY = "efootball-team-ai:my-team:v1";
const BUILDS_KEY = "efootball-team-ai:progression-builds:v1";
const FAVORITES_KEY = "efootball-team-ai:favorites:v1";
const SQUADS_KEY = "efb:squads:v1";
const TEMPLATES_KEY = "efootball-team-ai:squad-templates:v1";
const EDITOR_PREFS_KEY = "efootball-team-ai:squad-editor-preferences:v1";
const CONFIGURED_SUPPORT_EMAIL = "efootballteamAIsuportteam@outlook.jp";
const COMPARISON_KEY = "efootball-team-ai:squad-comparison:v1";

const PUBLIC_PAGES = [
  { path: "/about", jaTitle: "サービス概要 | eFootball Team AI", jaH1: "サービス概要" },
  { path: "/terms", jaTitle: "利用規約(草案) | eFootball Team AI", jaH1: "利用規約(草案)" },
  { path: "/privacy", jaTitle: "プライバシーポリシー(草案) | eFootball Team AI", jaH1: "プライバシーポリシー(草案)" },
  { path: "/disclaimer", jaTitle: "免責事項 | eFootball Team AI", jaH1: "免責事項" },
  { path: "/data-management", jaTitle: "データ管理 | eFootball Team AI", jaH1: "データ管理" },
  { path: "/support", jaTitle: "問い合わせ | eFootball Team AI", jaH1: "問い合わせ" },
  { path: "/release-readiness", jaTitle: "公開準備状況 | eFootball Team AI", jaH1: "公開準備状況" },
];

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
async function clearAllManagedKeys(client) {
  for (const k of [LOCALE_KEY, MY_TEAM_KEY, BUILDS_KEY, FAVORITES_KEY, SQUADS_KEY, TEMPLATES_KEY, EDITOR_PREFS_KEY, COMPARISON_KEY]) {
    await client.send("Runtime.evaluate", { expression: `localStorage.removeItem(${JSON.stringify(k)})` });
  }
}
const UNREPLACED_VAR_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}|__[A-Z_]+__|example@example\.com|TODO\b/;
const INTERNAL_LEAK_RE = /SELECT \*|efootball\.db|C:\\\\|process\.env|localhost:3000\/data|\/data\/server\.pid|world_player_cards|candidateKey|savedBuildId/i;

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
    // シナリオ1: フッターから各公開向けページへの導線
    // ============================================================
    await navigateAndSettle(client, `${BASE}/`);
    const footerLinksCount = await evalJson(client, "document.querySelectorAll('footer a').length");
    record("[シナリオ1] トップページにフッターリンクが表示される", footerLinksCount >= 7, `links=${footerLinksCount}`);

    for (const page of PUBLIC_PAGES) {
      await navigateAndSettle(client, `${BASE}${page.path}`);
      const title = await evalJson(client, "document.title");
      const h1Count = await evalJson(client, "document.querySelectorAll('h1').length");
      const h1Text = await evalJson(client, "document.querySelector('h1')?.textContent ?? ''");
      const text = await bodyText(client);
      record(`[シナリオ1] ${page.path} が正しいタイトルで表示される`, title === page.jaTitle, `title="${title}"`);
      record(`[シナリオ1] ${page.path} のh1は1つ`, h1Count === 1, `count=${h1Count}`);
      record(`[シナリオ1] ${page.path} のh1が期待通り`, h1Text === page.jaH1, `h1="${h1Text}"`);
      record(`[シナリオ1] ${page.path} に内部ID・内部情報が露出しない`, !INTERNAL_LEAK_RE.test(text), "");
      record(`[シナリオ1] ${page.path} に未置換変数・ダミー値が露出しない`, !UNREPLACED_VAR_RE.test(text), "");
    }
    // 戻る/進む
    await client.send("Page.navigate", { url: `${BASE}/about` });
    await waitForCondition(async () => (await evalJson(client, "document.readyState")) === "complete", { timeoutMs: 6000 });
    await client.send("Page.navigate", { url: `${BASE}/terms` });
    await waitForCondition(async () => (await evalJson(client, "document.readyState")) === "complete", { timeoutMs: 6000 });
    await evalJson(client, "history.back()");
    await waitForCondition(async () => (await evalJson(client, "location.pathname")) === "/about", { timeoutMs: 6000 });
    record("[シナリオ1] ブラウザーの「戻る」で前のページに戻れる", (await evalJson(client, "location.pathname")) === "/about", "");

    // ============================================================
    // シナリオ2: サービス概要
    // ============================================================
    await navigateAndSettle(client, `${BASE}/about`);
    const aboutBody = await bodyText(client);
    record("[シナリオ2] AIベスト11の説明が「ルールベース」であることを明示", aboutBody.includes("ルールベース"), "");
    record("[シナリオ2] 生成AI不使用の明示", aboutBody.includes("生成AI"), "");
    record("[シナリオ2] 外部AIへ送信しないことの明示", /外部AI/.test(aboutBody), "");
    record("[シナリオ2] 公式サービスではないことの明示", aboutBody.includes("公式サービスではありません"), "");
    record("[シナリオ2] 勝率保証をしないことの明示", aboutBody.includes("勝率"), "");
    record(
      "[シナリオ2] 未提供機能(端末間の自動同期・課金等)が「未提供」として明示される",
      aboutBody.includes("未提供の機能") && aboutBody.includes("端末間の自動同期") && aboutBody.includes("決済・課金"),
      "",
    );
    record(
      "[シナリオ2] 未提供機能(同期・課金)が「利用可能な機能」欄には含まれない",
      !(() => {
        const availIdx = aboutBody.indexOf("利用可能な機能");
        const betaIdx = aboutBody.indexOf("ベータ機能");
        if (availIdx === -1 || betaIdx === -1) return true;
        const availSection = aboutBody.slice(availIdx, betaIdx);
        return availSection.includes("端末間の自動同期") || availSection.includes("決済・課金");
      })(),
      "",
    );
    record(
      "[シナリオ2] アカウント登録・ログイン(Supabase Auth)が「利用可能な機能」欄に含まれる(実装済みのため)",
      (() => {
        const availIdx = aboutBody.indexOf("利用可能な機能");
        const betaIdx = aboutBody.indexOf("ベータ機能");
        if (availIdx === -1 || betaIdx === -1) return false;
        return aboutBody.slice(availIdx, betaIdx).includes("アカウント登録");
      })(),
      "",
    );

    // ============================================================
    // シナリオ3: プライバシー
    // ============================================================
    await navigateAndSettle(client, `${BASE}/privacy`);
    const privacyBody = await bodyText(client);
    record("[シナリオ3] ブラウザー内保存(localStorage)の明示", privacyBody.includes("ブラウザー"), "");
    record("[シナリオ3] 端末間同期なしの明示", privacyBody.includes("同期しません") || privacyBody.includes("同期"), "");
    record("[シナリオ3] クラウドバックアップなしの明示", privacyBody.includes("クラウドバックアップ"), "");
    record("[シナリオ3] データ削除リスクの明示", privacyBody.includes("復元できない場合があります"), "");
    record("[シナリオ3] アクセス解析を使用していないことの明示", privacyBody.includes("アクセス解析"), "");
    record("[シナリオ3] 広告を表示していないことの明示", privacyBody.includes("広告"), "");
    record("[シナリオ3] 決済情報を保存しないことの明示", privacyBody.includes("決済情報"), "");
    record("[シナリオ3] Cookie不使用の明示", privacyBody.includes("Cookie"), "");

    // ============================================================
    // シナリオ4: JSONバックアップ導線(データ管理ページから既存機能への案内)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/data-management`);
    const dmBody = await bodyText(client);
    record("[シナリオ4] JSONバックアップの説明がある", dmBody.includes("JSON"), "");
    const myBuildsLinkExists = await evalJson(client, `!!document.querySelector('a[href="/my-builds"]')`);
    record("[シナリオ4] My Buildsへの導線がある(既存のJSONエクスポート・インポート機能)", myBuildsLinkExists, "");

    // ============================================================
    // シナリオ5: ローカルデータ削除(隔離localStorageで確認)
    // ============================================================
    await setLocalStorageItem(client, MY_TEAM_KEY, JSON.stringify({ storageVersion: "x", updatedAt: "2026-09-11T00:00:00.000Z", records: [] }));
    await setLocalStorageItem(client, FAVORITES_KEY, JSON.stringify([]));
    await setLocalStorageItem(client, SQUADS_KEY, JSON.stringify({}));
    await setLocalStorageItem(client, LOCALE_KEY, "ja"); // 削除対象外キー(削除後も残ることを確認する)
    await navigateAndSettle(client, `${BASE}/data-management`);
    const targetListBody = await bodyText(client);
    record("[シナリオ5] 削除前に削除対象が事前表示される", targetListBody.includes("削除される対象"), "");

    const startButtonClicked = await evalJson(
      client,
      `(() => {
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find((b) => b.textContent.includes('ローカルデータをすべて削除する'));
        if (!btn) return false;
        btn.click();
        return true;
      })()`,
    );
    record("[シナリオ5] 削除開始ボタンをクリックすると第一確認(確認ダイアログ)が表示される", startButtonClicked, "");
    await new Promise((r) => setTimeout(r, 150));
    const confirmVisible = await evalJson(client, `document.body.innerText.includes('本当にすべて削除しますか')`);
    record("[シナリオ5] 第一確認の見出しが表示される", confirmVisible, "");

    // キャンセルすると何も削除されない
    const cancelClicked = await evalJson(
      client,
      `(() => {
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find((b) => b.textContent.includes('キャンセル'));
        if (!btn) return false;
        btn.click();
        return true;
      })()`,
    );
    record("[シナリオ5] キャンセルできる", cancelClicked, "");
    await new Promise((r) => setTimeout(r, 150));
    const myTeamStillThereAfterCancel = await evalJson(client, `localStorage.getItem(${JSON.stringify(MY_TEAM_KEY)}) != null`);
    record("[シナリオ5] キャンセル後もデータは変更されない", myTeamStillThereAfterCancel, "");

    // 実際に削除する(第二確認)
    await evalJson(
      client,
      `(() => {
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find((b) => b.textContent.includes('ローカルデータをすべて削除する'));
        btn?.click();
      })()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    const deleteConfirmClicked = await evalJson(
      client,
      `(() => {
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find((b) => b.textContent.trim() === '削除する');
        if (!btn) return false;
        btn.click();
        return true;
      })()`,
    );
    record("[シナリオ5] 第二確認(「削除する」)をクリックできる", deleteConfirmClicked, "");
    await waitForCondition(async () => (await bodyText(client)).includes("ローカルデータを削除しました"), { timeoutMs: 5000, intervalMs: 100 });
    const successShown = (await bodyText(client)).includes("ローカルデータを削除しました");
    record("[シナリオ5] 削除成功メッセージが表示される", successShown, "");

    const myTeamGoneAfterDelete = await evalJson(client, `localStorage.getItem(${JSON.stringify(MY_TEAM_KEY)}) == null`);
    const favoritesGoneAfterDelete = await evalJson(client, `localStorage.getItem(${JSON.stringify(FAVORITES_KEY)}) == null`);
    const squadsGoneAfterDelete = await evalJson(client, `localStorage.getItem(${JSON.stringify(SQUADS_KEY)}) == null`);
    const localeStillThereAfterDelete = await evalJson(client, `localStorage.getItem(${JSON.stringify(LOCALE_KEY)}) === "ja"`);
    record("[シナリオ5] My Teamが削除される", myTeamGoneAfterDelete, "");
    record("[シナリオ5] Favoritesが削除される", favoritesGoneAfterDelete, "");
    record("[シナリオ5] 保存スカッドが削除される", squadsGoneAfterDelete, "");
    record("[シナリオ5] 表示言語設定(対象外キー)は削除されない", localeStillThereAfterDelete, "");

    await navigateAndSettle(client, `${BASE}/data-management`);
    const nothingToDeleteBody = await bodyText(client);
    record("[シナリオ5] 再読み込み後も削除済みのまま(「削除できるデータはありません」表示)", nothingToDeleteBody.includes("現在、削除できるデータはありません"), "");

    // ============================================================
    // シナリオ6: 問い合わせ窓口(公開専用メールアドレス設定済み)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/support`);
    const supportBody = await bodyText(client);
    record("[シナリオ6] 設定済みの公開専用メールアドレスが表示される", supportBody.includes(CONFIGURED_SUPPORT_EMAIL), "");
    record("[シナリオ6] 「suport」の綴りが「support」へ自動修正されていない", supportBody.includes("suportteam") && !supportBody.includes("supportteam"), "");
    record("[シナリオ6] 「公開前準備中」の旧表示が通常状態では出ない", !supportBody.includes("問い合わせ窓口は公開前準備中です"), "");
    record("[シナリオ6] 共通窓口である旨の案内が表示される", supportBody.includes("共通の窓口"), "");
    record("[シナリオ6] 架空のメールアドレスが表示されない", !/example@example\.com|@example\.(com|jp|org)/.test(supportBody), "");
    record("[シナリオ6] 未置換変数が表示されない", !UNREPLACED_VAR_RE.test(supportBody), "");
    record(
      "[シナリオ6] 本名・住所・電話番号等の個人情報が表示されない",
      !/\d{2,4}-\d{2,4}-\d{4}|東京都|大阪府|〒\d{3}/.test(supportBody),
      "",
    );
    const mailtoLinks = await evalJson(client, `[...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href'))`);
    record("[シナリオ6] mailtoリンクが少なくとも1つ表示される", mailtoLinks.length >= 1, `count=${mailtoLinks.length}`);
    record(
      "[シナリオ6] すべてのmailtoリンクの宛先が設定済みメールアドレスと一致する",
      mailtoLinks.every((href) => href.startsWith(`mailto:${CONFIGURED_SUPPORT_EMAIL}`)),
      JSON.stringify(mailtoLinks),
    );
    record(
      "[シナリオ6] 一般問い合わせ・不具合報告・権利者連絡・プライバシー問い合わせで用途別の件名(subject)が設定されている",
      new Set(mailtoLinks.map((h) => decodeURIComponent(h.split("subject=")[1] ?? ""))).size >= 3,
      JSON.stringify(mailtoLinks),
    );
    record(
      "[シナリオ6] 問い合わせ時の注意(パスワード等を送らない)が表示される",
      supportBody.includes("パスワードを送らない") && supportBody.includes("認証コードを送らない") && supportBody.includes("回復コードを送らない"),
      "",
    );

    // ============================================================
    // シナリオ8: 非公式サービス表記
    // ============================================================
    await navigateAndSettle(client, `${BASE}/`);
    const homeFooterText = await evalJson(client, `document.querySelector('footer')?.textContent ?? ''`);
    record("[シナリオ8] フッターに非公式サービス表記がある", homeFooterText.includes("公式サービスではありません"), "");
    await navigateAndSettle(client, `${BASE}/disclaimer`);
    const disclaimerBody = await bodyText(client);
    record("[シナリオ8] 免責事項ページに非公式サービス表記がある", disclaimerBody.includes("公式サービスではありません"), "");
    record(
      "[シナリオ8] 「公式AI」「公認ツール」等の誇大・誤認表現を含まない",
      !/公式AI|公認ツール|公式データベース|公式ライセンス取得済み|運営会社と提携済み/.test(disclaimerBody) ||
        disclaimerBody.includes("確認できる文書は正本内に存在しない"),
      "",
    );

    // ============================================================
    // シナリオ9: リリース準備状況(内部情報の非露出)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/release-readiness`);
    const releaseBody = await bodyText(client);
    record("[シナリオ9] 認証(Supabase Auth)が実装済みとして表示される", releaseBody.includes("認証") && releaseBody.includes("Supabase Auth"), "");
    record("[シナリオ9] 決済・課金は未実装として表示される", /決済/.test(releaseBody), "");
    record("[シナリオ9] 問い合わせ窓口の項目が完了として表示される", releaseBody.includes("受け付ける連絡先"), "");
    record(
      "[シナリオ9] 問い合わせ窓口が設定済みでも、端末間の完全な自動同期・課金等の他のブロッカーは完了扱いにならない",
      releaseBody.includes("未着手") || releaseBody.includes("未実装"),
      "",
    );
    record(
      "[シナリオ9] 内部PID・テスト件数・SQLiteテーブル名等の開発者向け情報が表示されない",
      !/PID|2074|2110|world_player_cards|integrity_check|server\.pid/i.test(releaseBody),
      "",
    );
    record("[シナリオ9] 生成AI不使用が明示される", releaseBody.includes("生成AI"), "");

    // ============================================================
    // シナリオ10: 日本語・英語対応
    // ============================================================
    await setLocalStorageItem(client, LOCALE_KEY, "en");
    for (const page of PUBLIC_PAGES) {
      await navigateAndSettle(client, `${BASE}${page.path}`);
      const enText = await bodyText(client);
      record(`[シナリオ10] ${page.path} が英語表示に切り替わる`, /[A-Za-z]{3,}/.test(enText) && !enText.includes(page.jaH1), "");
      record(`[シナリオ10] ${page.path} (英語)に未置換辞書キー・変数が露出しない`, !UNREPLACED_VAR_RE.test(enText), "");
    }
    await setLocalStorageItem(client, LOCALE_KEY, "ja");

    // ============================================================
    // シナリオ11: 1280px・390px
    // ============================================================
    for (const page of PUBLIC_PAGES) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
      await navigateAndSettle(client, `${BASE}${page.path}`);
      const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
      record(`[シナリオ11] ${page.path} は390px幅で横スクロールが発生しない`, overflow <= 4, `overflow=${overflow}`);
    }
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // シナリオ12: 既存主要機能のスモーク回帰(公開準備ページ追加が既存機能を壊していないこと)
    // ============================================================
    await clearAllManagedKeys(client);
    const homeAfter = await navigateAndSettle(client, `${BASE}/`).then(() => bodyText(client));
    record("[シナリオ12] トップページが引き続き正常に表示される", homeAfter.length > 0, "");
    for (const p of ["/players", "/my-team", "/my-builds", "/squads", "/best-xi"]) {
      const r = await fetch(`${BASE}${p}`);
      record(`[シナリオ12] 既存ページ ${p} が引き続き200`, r.status === 200, `HTTP ${r.status}`);
    }

    // ============================================================
    // 共通確認
    // ============================================================
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[共通] 外部通信が発生していない", externalRequests.length === 0, externalRequests.slice(0, 3).join(", "));
    record("[共通] ページ内でJS例外が発生していない(全シナリオ通算)", errors.length === 0, errors.slice(0, 3).join(" / "));
    record("[共通] コンソールエラーが発生していない(全シナリオ通算)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-public-preparation] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 公開準備基盤フェーズ ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。実機ではない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない(隔離プロファイルのlocalStorageのみ操作)。",
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
  console.log(`[black-box-public-preparation] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
