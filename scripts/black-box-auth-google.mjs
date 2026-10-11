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
// コードの入口のモード（src/lib/supabase/oauth.ts）。2026-10-11 に一般公開（enabled）。期待値はモードに合わせる。
const OAUTH_MODE = (await fs.readFile(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "src", "lib", "supabase", "oauth.ts"), "utf8")).match(/GOOGLE_OAUTH_MODE: GoogleOAuthMode = "(\w+)"/)?.[1] ?? "unknown";
const PUBLIC = OAUTH_MODE === "enabled";
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
    if (PUBLIC) {
      await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
      record("[一般公開] 確認用の URL なしでも Google のボタンを出す", await has('[data-testid="google-sign-in-button"]'), OAUTH_MODE);
      record("[一般公開] 限定テストの案内・メールの新規登録の「限定テスト中」を出さない", !(await has('[data-testid="google-limited-test-notice"]')) && !/限定テスト中/.test(await text()), "");
    } else {
      record("[既定・無効] Google のボタンを出さない", !(await has('[data-testid="google-sign-in-button"]')), OAUTH_MODE);
      record("[既定・無効] パスワードの再設定の導線は従来どおり", await ev(`!!document.querySelector('a[href="/auth/forgot-password"]')`), "");
    }

    // ローカルのプレビュー
    await go(`${BASE}/auth/sign-in?oauthPreview=1&next=%2Fsquads`);
    await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
    const t1 = await text();
    record("[プレビュー] Google のボタン「Google で続ける」を出す", /Google で続ける/.test(t1), "");
    if (PUBLIC) record("[一般公開] 確認用の URL でも限定テストの案内は出さない", !(await has('[data-testid="google-limited-test-notice"]')), "");
    else record("[プレビュー] 限定テスト中であることを画面に明示（一般公開中と誤解させない）", (await has('[data-testid="google-limited-test-notice"]')) && /限定テスト中/.test(t1), "");
    record("[プレビュー] パスワードの再設定の導線を出さない（パスワードでのログインを一般に提供しないため）", !(await ev(`!!document.querySelector('a[href="/auth/forgot-password"]')`)), "");
    record("[プレビュー] 以前のアカウントでパスワードを忘れた人の代わりの導線（サポート）", await has('[data-testid="password-forgot-support"]'), "");
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
    // Google の画面からブラウザーの「戻る」で帰ったとき（bfcache の復元）、ボタンが押せる状態に戻る（2026-10-11 本番の PC Chrome で発見）
    const disabledBefore = await ev(`document.querySelector('[data-testid="google-sign-in-button"]').disabled`);
    await ev(`window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))`);
    await waitForCondition(async () => (await ev(`document.querySelector('[data-testid="google-sign-in-button"]').disabled`)) === false, { timeoutMs: 3000 }).catch(() => {});
    const disabledAfter = await ev(`document.querySelector('[data-testid="google-sign-in-button"]').disabled`);
    record("[プレビュー] 「戻る」で復元された画面では Google のボタンを押し直せる（移動中のまま止まらない）", disabledBefore === true && disabledAfter === false, `before=${disabledBefore} after=${disabledAfter}`);

    // 限定テストのタブでは、ログアウトの後などの「ログイン」の導線も確認用の URL（Google のボタンが消えない）
    await go(`${BASE}/account`);
    await waitForCondition(async () => /ログインが必要/.test(await text()), { timeoutMs: 8000 }).catch(() => {});
    const signInLinks = await ev(`[...document.querySelectorAll('a')].filter((a) => a.textContent.trim() === "ログイン").map((a) => a.getAttribute("href"))`);
    if (PUBLIC) record("[一般公開] 「ログイン」の導線は通常の /auth/sign-in（確認用のクエリを付けない）", (signInLinks ?? []).length > 0 && signInLinks.every((h) => h === "/auth/sign-in"), JSON.stringify(signInLinks));
    else record("[限定テスト] 確認用の URL を開いたタブでは「ログイン」の導線が ?oauthPreview=1", (signInLinks ?? []).length > 0 && signInLinks.every((h) => h === "/auth/sign-in?oauthPreview=1"), JSON.stringify(signInLinks));

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
    if (PUBLIC) {
      await waitForCondition(() => has('[data-testid="signup-google"]'), { timeoutMs: 8000 }).catch(() => {});
      record("[一般公開] 新規登録は確認用の URL なしでも Google で作成（パスワードの入力欄なし）", (await has('[data-testid="signup-google"]')) && !(await has('input[type="password"]')), "");
    } else {
      await waitForCondition(() => has('[data-testid="signup-limited"]'), { timeoutMs: 8000 }).catch(() => {});
      record("[既定・無効] 新規登録は従来どおり「限定テスト中」", await has('[data-testid="signup-limited"]'), "");
    }

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
    // ゲストのデータの引き継ぎの実行と競合: 1 回目は追加・同じ ID で内容が違う記録は「競合」でアカウントの側を上書きしない
    {
      await ev(`[...document.querySelectorAll("button")].find((b) => /新規追加分を移行する/.test(b.textContent))?.click()`);
      await new Promise((r) => setTimeout(r, 400));
      const ackBox = await ev(`(() => { const c = [...document.querySelectorAll('input[type="checkbox"]')].find((x) => /アカウントの領域へコピーします/.test(x.closest("label")?.textContent ?? "")); if (c && !c.checked) c.click(); return !!c; })()`);
      await ev(`[...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "移行する").pop()?.click()`);
      await waitForCondition(async () => ((await ev(`Object.keys(localStorage).filter((k) => k.startsWith("efootball-team-ai:local:account:") && k.endsWith(":my-team:v1")).length`)) ?? 0) > 0, { timeoutMs: 6000 }).catch(() => {});
      const afterKeys = await ev(`Object.keys(localStorage).filter((k) => k.startsWith("efootball-team-ai:local:account:") && k.endsWith(":my-team:v1"))`);
      record("[引き継ぎ] 実行するとアカウントの領域へ追加・ゲストのデータは残る", ackBox && (afterKeys ?? []).length === 1 && (await ev(`localStorage.getItem(${JSON.stringify(GUEST_MY_TEAM)})`)) === guestBefore, `keys=${(afterKeys ?? []).length}`);
      if ((afterKeys ?? []).length === 1) {
        // ページから得たキーをコードに埋め込まない（同じ条件で読み直す）
        const ACCOUNT_MY_TEAM = `localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("efootball-team-ai:local:account:") && k.endsWith(":my-team:v1")))`;
        const accBefore = await ev(ACCOUNT_MY_TEAM);
        await ev(`(() => { const g = JSON.parse(localStorage.getItem(${JSON.stringify(GUEST_MY_TEAM)})); g.records[0].note = "guest-edit"; g.records[0].updatedAt = "2026-10-11T01:00:00.000Z"; localStorage.setItem(${JSON.stringify(GUEST_MY_TEAM)}, JSON.stringify(g)); })()`);
        await go(`${BASE}/account/local-data-migration?source=guest&__efbAuth=1&__efbUserId=efb-google-user-1`);
        await waitForCondition(async () => /ゲストとして保存したデータ（この端末）/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
        await ev(`document.querySelector('input[name="local-data-migration-select-myTeam"]').click()`);
        await ev(`[...document.querySelectorAll("button")].find((b) => /プレビュー/.test(b.textContent))?.click()`);
        await waitForCondition(async () => /競合/.test(await text()), { timeoutMs: 5000 }).catch(() => {});
        record("[引き継ぎ] 同じ ID で内容が違う記録は「競合」として数える", /競合/.test(await text()), "");
        record("[引き継ぎ] 競合はアカウントの側を上書きしない", (await ev(ACCOUNT_MY_TEAM)) === accBefore, "");
      }
    }

    // ゲストのデータをまとめてコピー（2026-10-11）: 別の新しいアカウントの領域へ、5 種類を不足分だけ一度に
    {
      const guestBeforeAll = await ev(`localStorage.getItem(${JSON.stringify(GUEST_MY_TEAM)})`);
      await go(`${BASE}/account/local-data-migration?source=guest&__efbAuth=1&__efbUserId=efb-copyall-user`);
      await waitForCondition(() => has('[data-testid="local-data-migration-copy-all"]'), { timeoutMs: 10000 }).catch(() => {});
      record("[まとめてコピー] ゲストを選んだときだけ「まとめてコピー」の欄を出す", await has('[data-testid="local-data-migration-copy-all"]'), "");
      const disabledBefore = await ev(`document.querySelector('[data-testid="local-data-migration-copy-all-button"]')?.disabled ?? null`);
      await ev(`document.querySelector('input[name="local-data-migration-copy-all-ack"]').click()`);
      await ev(`document.querySelector('[data-testid="local-data-migration-copy-all-button"]').click()`);
      await waitForCondition(() => has('[data-testid="local-data-migration-copy-all-result"]'), { timeoutMs: 8000 }).catch(() => {});
      const res = await ev(`document.querySelector('[data-testid="local-data-migration-copy-all-result"]')?.textContent ?? ""`);
      record("[まとめてコピー] 確認のチェックまで押せない・実行すると追加の件数を表示・ゲストのデータは残る", disabledBefore === true && /追加 1 件/.test(res) && (await ev(`localStorage.getItem(${JSON.stringify(GUEST_MY_TEAM)})`)) === guestBeforeAll, res);
    }

    // アプリ内ブラウザー（User-Agent を差し替え）
    const UAS = {
      iosLine: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
      androidX: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240705.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 TwitterAndroid",
      iosX: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.50",
      iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    };
    const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    await viewport(390, 844, true);
    for (const [name, ua] of Object.entries(UAS)) {
      await client.send("Emulation.setUserAgentOverride", { userAgent: ua });
      await go(`${BASE}/auth/sign-in?oauthPreview=1&next=%2Fsquads&authError=oauth_cancelled`);
      await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
      const notice = await has('[data-testid="in-app-browser-notice"]');
      const ext = await ev(`document.querySelector('[data-testid="in-app-open-external"]')?.getAttribute("href") ?? null`);
      const tn = await text();
      const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
      if (name === "iosSafari") {
        record("[アプリ内] 通常の Safari では案内を出さない", !notice, "");
        continue;
      }
      record(`[アプリ内 ${name}] 案内を出し、Google のボタンは残す（遮断しない）`, notice && (await has('[data-testid="google-sign-in-button"]')), "");
      if (name === "iosLine") record("[アプリ内 iosLine] LINE は openExternalBrowser=1・認証のエラー等の値を含めない", ext === `${BASE}/auth/sign-in?next=%2Fsquads&openExternalBrowser=1`, String(ext));
      if (name === "androidX") record("[アプリ内 androidX] Android は Chrome の intent・Android の手順", String(ext).startsWith("intent://") && String(ext).includes("package=com.android.chrome") && /⋮/.test(tn) && !/Safari で開く/.test(tn), String(ext).slice(0, 60));
      if (name === "iosX") record("[アプリ内 iosX] iPhone では「Chrome で開く」を出さない・Safari の手順とコピー", ext === null && /Safari で開く/.test(tn) && (await has('[data-testid="in-app-copy-url"]')), "");
      record(`[アプリ内 ${name}] 390px で横のはみ出しなし`, overflow <= 0, `overflow=${overflow}`);
    }
    await client.send("Emulation.setUserAgentOverride", { userAgent: DESKTOP_UA });
    await viewport(1280, 900, false);

    // Google の失敗の後は、通常のブラウザーでも開き直しの一般の案内
    await go(`${BASE}/auth/sign-in?oauthPreview=1&authError=oauth_failed`);
    await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    record("[失敗の後] 通常のブラウザーでも開き直しの案内を出す", await has('[data-testid="oauth-browser-hint"]'), "");

    // 緊急停止（Supabase の Google の Provider を Disable）を模擬 → Supabase の画面へ移さず案内
    await go(`${BASE}/auth/sign-in?oauthPreview=1`);
    await waitForCondition(() => has('[data-testid="google-sign-in-button"]'), { timeoutMs: 8000 }).catch(() => {});
    await ev(`window.__EFB_TEST_OAUTH_CALLS__ = []; window.__EFB_TEST_GOOGLE_PROVIDER__ = false; document.querySelector('[data-testid="google-sign-in-button"]').click()`);
    await waitForCondition(async () => /一時的に停止しています/.test(await text()), { timeoutMs: 5000 }).catch(() => {});
    record("[緊急停止] Provider が無効なら Google へ移らず「一時的に停止」の案内", /一時的に停止しています/.test(await text()) && (await ev("window.__EFB_TEST_OAUTH_CALLS__.length")) === 0, "");

    // Google だけでログインする人にはメールアドレスの変更を出さない・メールのアカウントには従来どおり
    await go(`${BASE}/account?__efbAuth=1&__efbUserId=efb-google-only&__efbProviders=google`);
    await waitForCondition(async () => /ログイン中/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
    record("[アカウント] Google だけのユーザーにはメールアドレスの変更の欄を出さない", /ログイン中/.test(await text()) && !/メールアドレスの変更/.test(await text()), "");
    await go(`${BASE}/account?__efbAuth=1&__efbUserId=efb-email-user&__efbProviders=email`);
    await waitForCondition(async () => /ログイン中/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
    record("[アカウント] メールのアカウントにはメールアドレスの変更の欄を従来どおり出す", /メールアドレスの変更/.test(await text()), "");

    // 保存ビルドのクラウド保存（2026-10-11）: 既定は準備中（Supabase を呼ばない）・ローカルのプレビューで保存 → 端末から消す → 足りないものを追加 → 削除
    {
      const BC_USER = "efb-builds-cloud-user";
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("efootball-team-ai:local-storage-scope:v1:" + BC_USER));
      const scopeId = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const BUILDS_KEY = `efootball-team-ai:local:account:${scopeId}:progression-builds:v1`;
      const mkB = (buildId) => ({ buildId, worldCardId: "89136409091415", buildName: `Cloud ${buildId}`, progressionAllocation: { shooting: 2 }, selectedPlayerBooster: null, calculatedStats: { finishing: 90 }, calculatedOvr: 90, calculationMode: "provisional", rulesVersion: "progression/2026-08-28.v2", createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z", schemaVersion: 1 });
      const setBuilds = (list) => ev(`localStorage.setItem(${JSON.stringify(BUILDS_KEY)}, ${JSON.stringify(JSON.stringify({ "89136409091415": list }))})`);
      const localIds = async () => ev(`(JSON.parse(localStorage.getItem(${JSON.stringify(BUILDS_KEY)}) || "{}")["89136409091415"] || []).map((b) => b.buildId).sort().join(",")`);
      await go(`${BASE}/account?__efbAuth=1&__efbUserId=${BC_USER}`);
      await waitForCondition(() => has('[data-testid="account-builds-cloud-entry"]'), { timeoutMs: 10000 }).catch(() => {});
      record("[ビルドのクラウド] アカウントの画面に入口がある", await has('a[href="/account/builds-cloud"]'), "");
      await go(`${BASE}/account/builds-cloud?__efbAuth=1&__efbUserId=${BC_USER}`);
      await waitForCondition(() => has('[data-testid="builds-cloud-unavailable"]'), { timeoutMs: 10000 }).catch(() => {});
      record("[ビルドのクラウド] 既定（本番の表の作成前）は準備中の案内だけ・保存のボタンなし", (await has('[data-testid="builds-cloud-unavailable"]')) && !(await has('[data-testid="builds-cloud-save"]')), "");
      await setBuilds([mkB("b_cloud1"), mkB("b_cloud2")]);
      await go(`${BASE}/account/builds-cloud?__efbAuth=1&__efbUserId=${BC_USER}&buildsCloudPreview=1`);
      await waitForCondition(async () => (await ev(`document.querySelector('[data-testid="builds-cloud-local-count"]')?.textContent`)) === "2", { timeoutMs: 10000 }).catch(() => {});
      const calls0 = (await ev("window.__EFB_TEST_BC_UPSERT_CALLS__ || 0")) ?? 0;
      record("[ビルドのクラウド] 画面を開いただけでは送信しない（端末の 2 件を表示）", calls0 === 0 && (await ev(`document.querySelector('[data-testid="builds-cloud-local-count"]')?.textContent`)) === "2", `calls=${calls0}`);
      await ev(`document.querySelector('[data-testid="builds-cloud-save"]').click()`);
      await waitForCondition(() => has('[data-testid="builds-cloud-confirm"]'), { timeoutMs: 5000 }).catch(() => {});
      await ev(`document.querySelector('[data-testid="builds-cloud-confirm-yes"]').click()`);
      await waitForCondition(async () => /クラウドへ保存しました/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
      record("[ビルドのクラウド] 確認の後に保存（2 件）・状態に件数", /クラウドへ保存しました/.test(await text()) && /2 件/.test((await ev(`document.querySelector('[data-testid="builds-cloud-status"]')?.textContent`)) ?? ""), "");
      await setBuilds([mkB("b_cloud1")]); // 端末から 1 件消えた（別の端末を想定）
      await go(`${BASE}/account/builds-cloud?__efbAuth=1&__efbUserId=${BC_USER}&buildsCloudPreview=1`);
      await waitForCondition(() => has('[data-testid="builds-cloud-check"]'), { timeoutMs: 10000 }).catch(() => {});
      await ev(`document.querySelector('[data-testid="builds-cloud-check"]').click()`);
      await waitForCondition(() => has('[data-testid="builds-cloud-restore-plan"]'), { timeoutMs: 10000 }).catch(() => {});
      const planText = (await ev(`document.querySelector('[data-testid="builds-cloud-restore-plan"]')?.textContent`)) ?? "";
      record("[ビルドのクラウド] 確認すると、追加できる 1 件・すでにある 1 件と示す", /追加できるビルド 1 件/.test(planText) && /すでにあるもの 1 件/.test(planText), planText.slice(0, 80));
      await ev(`document.querySelector('[data-testid="builds-cloud-restore"]').click()`);
      await waitForCondition(async () => /1 件のビルドを端末に追加しました/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
      record("[ビルドのクラウド] 足りないビルドだけを端末に追加（既存は変えない）", (await localIds()) === "b_cloud1,b_cloud2" && /1 件のビルドを端末に追加しました/.test(await text()), await localIds());
      await ev(`document.querySelector('[data-testid="builds-cloud-delete"]').click()`);
      await waitForCondition(() => has('[data-testid="builds-cloud-confirm"]'), { timeoutMs: 5000 }).catch(() => {});
      await ev(`document.querySelector('[data-testid="builds-cloud-confirm-yes"]').click()`);
      await waitForCondition(async () => /クラウドデータを削除しました/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
      record("[ビルドのクラウド] 削除するとクラウドは無し・端末の保存ビルドは残る", /クラウドデータなし/.test((await ev(`document.querySelector('[data-testid="builds-cloud-status"]')?.textContent`)) ?? "") && (await localIds()) === "b_cloud1,b_cloud2", "");
      await go(`${BASE}/account/builds-cloud?buildsCloudPreview=1`);
      await waitForCondition(() => has('[data-testid="builds-cloud-signin"]'), { timeoutMs: 10000 }).catch(() => {});
      record("[ビルドのクラウド] ログインしていなければログインの案内だけ", (await has('[data-testid="builds-cloud-signin"]')) && !(await has('[data-testid="builds-cloud-save"]')), "");
    }

    // 保存スカッドのクラウド保存（2026-10-11）: 既定は準備中・プレビューで保存 → 端末から 1 件消す → 足りないものを追加 → 削除
    {
      const SC_USER = "efb-squads-cloud-user";
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("efootball-team-ai:local-storage-scope:v1:" + SC_USER));
      const scopeId = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const SQUADS_KEY = `efootball-team-ai:local:account:${scopeId}:squads:v1`;
      const SLOTS = ["gk", "lb", "lcb", "rcb", "rb", "dmf", "lcmf", "rcmf", "lwf", "cf", "rwf"];
      const mkS = (squadId, name) => ({ squadId, squadName: name, formationId: "4-3-3", managerId: null, slots: SLOTS.map((slotId) => ({ slotId, worldCardId: slotId === "cf" ? "89136409091415" : null, buildMode: "none", savedBuildId: null })), substitutes: [], captainSlotId: null, setPieces: { corners: null, freeKicks: null, penalties: null }, linkUp: { centerPieceSlotId: null, keyManSlotId: null }, rulesVersion: "progression/2026-08-28.v2", schemaVersion: 1, createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z" });
      const setSquads = (list) => ev(`localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, ${JSON.stringify(JSON.stringify(list))})`);
      const localIds = async () => ev(`(JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)}) || "[]")).map((s) => s.squadId).sort().join(",")`);
      const statusText = async () => (await ev(`document.querySelector('[data-testid="squads-cloud-status"]')?.textContent`)) ?? "";
      await go(`${BASE}/account?__efbAuth=1&__efbUserId=${SC_USER}`);
      await waitForCondition(() => has('[data-testid="account-squads-cloud-entry"]'), { timeoutMs: 10000 }).catch(() => {});
      record("[スカッドのクラウド] アカウントの画面に入口がある", await has('a[href="/account/squads-cloud"]'), "");
      await go(`${BASE}/account/squads-cloud?__efbAuth=1&__efbUserId=${SC_USER}`);
      await waitForCondition(() => has('[data-testid="squads-cloud-unavailable"]'), { timeoutMs: 10000 }).catch(() => {});
      record("[スカッドのクラウド] 既定（本番の表の作成前）は準備中の案内だけ", (await has('[data-testid="squads-cloud-unavailable"]')) && !(await has('[data-testid="squads-cloud-save"]')), "");
      await setSquads([mkS("sq_cloudtest00001", "Cloud A"), mkS("sq_cloudtest00002", "Cloud B")]);
      await go(`${BASE}/account/squads-cloud?__efbAuth=1&__efbUserId=${SC_USER}&squadsCloudPreview=1`);
      await waitForCondition(async () => (await ev(`document.querySelector('[data-testid="squads-cloud-local-count"]')?.textContent`)) === "2", { timeoutMs: 10000 }).catch(() => {});
      const calls0 = (await ev("window.__EFB_TEST_SC_UPSERT_CALLS__ || 0")) ?? 0;
      record("[スカッドのクラウド] 画面を開いただけでは送信しない（端末の 2 件）", calls0 === 0 && (await ev(`document.querySelector('[data-testid="squads-cloud-local-count"]')?.textContent`)) === "2", `calls=${calls0}`);
      await ev(`document.querySelector('[data-testid="squads-cloud-save"]').click()`);
      await waitForCondition(() => has('[data-testid="squads-cloud-confirm"]'), { timeoutMs: 5000 }).catch(() => {});
      await ev(`document.querySelector('[data-testid="squads-cloud-confirm-yes"]').click()`);
      await waitForCondition(async () => /クラウドへ保存しました/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
      record("[スカッドのクラウド] 確認の後に保存（2 件）", /クラウドへ保存しました/.test(await text()) && /2 件/.test(await statusText()), await statusText());
      await setSquads([mkS("sq_cloudtest00001", "Cloud A")]);
      await go(`${BASE}/account/squads-cloud?__efbAuth=1&__efbUserId=${SC_USER}&squadsCloudPreview=1`);
      await waitForCondition(() => has('[data-testid="squads-cloud-check"]'), { timeoutMs: 10000 }).catch(() => {});
      await ev(`document.querySelector('[data-testid="squads-cloud-check"]').click()`);
      await waitForCondition(() => has('[data-testid="squads-cloud-restore-plan"]'), { timeoutMs: 10000 }).catch(() => {});
      const planText = (await ev(`document.querySelector('[data-testid="squads-cloud-restore-plan"]')?.textContent`)) ?? "";
      record("[スカッドのクラウド] 確認すると、追加できる 1 件・すでにある 1 件", /追加できるスカッド 1 件/.test(planText) && /すでにあるもの 1 件/.test(planText), planText.slice(0, 80));
      await ev(`document.querySelector('[data-testid="squads-cloud-restore"]').click()`);
      await waitForCondition(async () => /1 件のスカッドを端末に追加しました/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
      record("[スカッドのクラウド] 足りないスカッドだけを端末に追加", (await localIds()) === "sq_cloudtest00001,sq_cloudtest00002", await localIds());
      await ev(`document.querySelector('[data-testid="squads-cloud-delete"]').click()`);
      await waitForCondition(() => has('[data-testid="squads-cloud-confirm"]'), { timeoutMs: 5000 }).catch(() => {});
      await ev(`document.querySelector('[data-testid="squads-cloud-confirm-yes"]').click()`);
      await waitForCondition(async () => /クラウドデータを削除しました/.test(await text()), { timeoutMs: 10000 }).catch(() => {});
      record("[スカッドのクラウド] 削除するとクラウドは無し・端末のスカッドは残る", /クラウドデータなし/.test(await statusText()) && (await localIds()) === "sq_cloudtest00001,sq_cloudtest00002", "");
    }

    // アカウントの削除: 既定（無効）は手動の案内・アカウントの画面から入れる
    await go(`${BASE}/account?__efbAuth=1&__efbUserId=efb-delete-user`);
    await waitForCondition(() => has('[data-testid="account-delete-entry"]'), { timeoutMs: 10000 }).catch(() => {});
    record("[削除] アカウントの画面に削除の入口と、運営への連絡の案内", (await has('a[href="/account/delete"]')) && /運営への連絡で受け付けています/.test(await text()), "");
    await go(`${BASE}/account/delete?__efbAuth=1&__efbUserId=efb-delete-user`);
    await waitForCondition(() => has('[data-testid="account-deletion"]'), { timeoutMs: 10000 }).catch(() => {});
    const td = await text();
    record(
      "[削除・無効] 削除されるもの・されないもの・再登録の扱い・手動の削除（サポート）の案内だけ（実行の欄なし）",
      /削除されるもの/.test(td) && /削除されないもの/.test(td) && /新しい空のアカウント/.test(td) && (await has('[data-testid="account-deletion-manual"]')) && !(await has('[data-testid="account-deletion-form"]')) && (await has('a[href="/support"]')),
      "",
    );

    // アカウントの削除: ローカルのプレビュー（テストダブル）
    await go(`${BASE}/account/delete?deletionPreview=1&__efbAuth=1&__efbUserId=efb-delete-user`);
    await waitForCondition(() => has('[data-testid="account-deletion-form"]'), { timeoutMs: 10000 }).catch(() => {});
    const btnDisabled = () => ev(`[...document.querySelectorAll("button")].find((b) => /アカウントを完全に削除する|削除しています/.test(b.textContent))?.disabled ?? null`);
    const clickDelete = (extra = "") => ev(`${extra}; [...document.querySelectorAll("button")].find((b) => /アカウントを完全に削除する/.test(b.textContent)).click()`);
    const typePhrase = async (v) => {
      await ev(`(() => { const i = document.querySelector('input[name="account-deletion-phrase"]'); i.focus(); i.select(); })()`);
      await client.send("Input.insertText", { text: v });
    };
    record("[削除] 最初はボタンを押せない（1 クリックで消さない）", (await btnDisabled()) === true, "");
    await ev(`document.querySelector('input[name="account-deletion-ack"]').click()`);
    record("[削除] 確認のチェックだけでは押せない", (await btnDisabled()) === true, "");
    await typePhrase("削除");
    record("[削除] 確認の語が違えば押せない", (await btnDisabled()) === true, "");
    await typePhrase("削除する");
    record("[削除] チェックと確認の語がそろうと押せる", (await btnDisabled()) === false, "");
    await clickDelete(`window.__EFB_TEST_DELETE_MODE__ = "reauth"`);
    await waitForCondition(() => has('[data-testid="account-deletion-reauth"]'), { timeoutMs: 5000 }).catch(() => {});
    record("[削除] 最近の認証が無ければ再認証を求める", (await has('[data-testid="account-deletion-reauth"]')) && /10 分以内/.test(await text()), "");
    await clickDelete(`window.__EFB_TEST_DELETE_MODE__ = "unavailable"`);
    await waitForCondition(async () => /削除を受け付けられません/.test(await text()), { timeoutMs: 5000 }).catch(() => {});
    const tu = await text();
    record("[削除] 関数が無い・障害は「何も削除されていません」と案内（生の文なし）", /何も削除されていません/.test(tu) && !/test double|Could not find/.test(tu), "");
    await ev(`localStorage.setItem("efootball-team-ai:local:guest:favorites:v1", "[]")`);
    await ev(`window.__EFB_TEST_DELETE_MODE__ = "success"; window.__EFB_TEST_RPC_CALLS__ = []; (() => { const b = [...document.querySelectorAll("button")].find((x) => /アカウントを完全に削除する/.test(x.textContent)); b.click(); b.click(); })()`);
    await waitForCondition(() => has('[data-testid="account-deletion-done"]'), { timeoutMs: 8000 }).catch(() => {});
    const calls = (await ev("window.__EFB_TEST_RPC_CALLS__ || []")) ?? [];
    record("[削除] 成功: 完了を表示・関数は DELETE で 1 回だけ（二重の押下でも 1 回）", (await has('[data-testid="account-deletion-done"]')) && calls.length === 1 && calls[0].fn === "delete_my_account" && calls[0].args?.confirm === "DELETE", `calls=${calls.length}`);
    record("[削除] 成功: この端末のゲストのデータは残す", (await ev(`localStorage.getItem("efootball-team-ai:local:guest:favorites:v1")`)) === "[]", "");

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
