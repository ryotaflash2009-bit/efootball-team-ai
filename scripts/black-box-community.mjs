/**
 * コミュニティ 第 1 段階（公開プロフィール・友達・ブロック・ミュート・通報・友達との比較・2026-10-14）のブラックボックス。
 *
 *   node scripts/black-box-community.mjs   （事前に npm run build・node scripts/local-server.mjs start）
 *
 * 隔離したヘッドレス Chrome・認証と community_* の関数のテストダブル（localhost だけ）。実 Supabase へは接続しない。
 * サーバーの規則（RLS・公開範囲・上限）は src/lib/community/community-stage1.postgres.test.ts（使い捨ての PostgreSQL）で検証する。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "community.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOCALE_KEY = "efootball-team-ai:locale:v1";
const MODE = (await fs.readFile(path.join(ROOT, "src", "lib", "supabase", "community-mode.ts"), "utf8")).match(/COMMUNITY_MODE: CommunityMode = "(\w+)"/)?.[1] ?? "unknown";
const AUTH = "__efbAuth=1&__efbUserId=efb-community-user";

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
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.click()`);
  const waitFor = (sel, ms = 10000) => waitForCondition(() => has(sel), { timeoutMs: ms, intervalMs: 150 }).catch(() => {});
  const waitText = (re, ms = 10000) => waitForCondition(async () => re.test(await text()), { timeoutMs: ms, intervalMs: 150 }).catch(() => {});
  const setValue = (sel, value) =>
    ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  const rpcCalls = async () => (await ev("(window.__EFB_TEST_RPC_CALLS__ || []).map((c) => c.fn)")) ?? [];
  const viewport = (width, height, mobile) => client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });

  try {
    await viewport(1280, 900, false);
    await go(`${BASE}/auth/sign-in`);
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja"); sessionStorage.clear()`);

    // 入口・既定の状態
    await go(`${BASE}/account?${AUTH}`);
    await waitFor('[data-testid="account-community-entry"]');
    record("アカウントの画面にコミュニティの入口がある", await has('a[href="/account/community"]'), "");
    await go(`${BASE}/account/community?${AUTH}`);
    if (MODE === "enabled") {
      await waitFor('[data-testid="community-profile"]');
      record("有効: 準備中の案内を出さず、プロフィールの欄を出す", (await has('[data-testid="community-profile"]')) && !(await has('[data-testid="community-unavailable"]')), MODE);
    } else {
      await waitFor('[data-testid="community-unavailable"]');
      record("既定（本番の関数の適用前）は準備中の案内だけ・関数を呼ばない", (await has('[data-testid="community-unavailable"]')) && (await rpcCalls()).length === 0, MODE);
    }
    await go(`${BASE}/account/community?communityPreview=1`);
    await waitFor('[data-testid="community-signin"]');
    record("ログインしていなければログインの案内だけ", (await has('[data-testid="community-signin"]')) && !(await has('[data-testid="community-profile"]')), "");
    await go(`${BASE}/u/rival_one?communityPreview=1`);
    await waitFor('[data-testid="user-profile-signin"]');
    record("/u/<ID>: ログインしていなければ案内だけ（中身を取得しない）", (await has('[data-testid="user-profile-signin"]')) && !(await has('[data-testid="user-profile-card"]')), "");
    const robots = await ev(`document.querySelector('meta[name="robots"]')?.content ?? ""`);
    record("/u/<ID> は noindex・題名に ID を入れない", /noindex/.test(robots) && !/rival_one/.test(await ev("document.title")), robots);

    // プロフィールの作成（既定は非公開）
    const P = `?${AUTH}&communityPreview=1`;
    await go(`${BASE}/account/community${P}`);
    await waitFor('[data-testid="community-profile"]');
    record("プロフィールが無い: 作成の案内・既定の公開範囲は非公開", /まだプロフィールがありません/.test(await text()) && (await ev(`document.querySelector('[data-testid="community-visibility-private"]').checked`)) === true, "");
    await setValue('[data-testid="community-id-input"]', "admin");
    await setValue('[data-testid="community-name-input"]', "テスト");
    await waitText(/公開 ID の形が正しくないか/);
    record("予約語の ID は画面でも止める（作成のボタンを押せない）", (await ev(`document.querySelector('[data-testid="community-profile-save"]').disabled`)) === true, "");
    await setValue('[data-testid="community-id-input"]', "Taro_01");
    await setValue('[data-testid="community-name-input"]', "公式スタッフ");
    await waitText(/表示名が正しくありません/);
    record("運営を装う表示名は止める", (await ev(`document.querySelector('[data-testid="community-profile-save"]').disabled`)) === true, "");
    await setValue('[data-testid="community-name-input"]', "たろう");
    await new Promise((r) => setTimeout(r, 200));
    await click('[data-testid="community-profile-save"]');
    await waitText(/プロフィールを作成しました/);
    const saveCall = await ev(`(window.__EFB_TEST_RPC_CALLS__ || []).filter((c) => c.fn === "community_save_my_profile").pop()?.args ?? null`);
    record("作成: ID は正規化（小文字）して送り、user_id は送らない", saveCall?.p_public_id === "taro_01" && saveCall?.p_visibility === "private" && !("user_id" in (saveCall ?? {})), JSON.stringify(saveCall));
    record("作成の後、自分のプロフィールの URL を出す", (await ev(`document.querySelector('[data-testid="community-profile-link"]')?.getAttribute("href")`)) === "/u/taro_01", "");

    // 非公開のままでは申請できない
    await go(`${BASE}/u/rival_one${P}`);
    await waitFor('[data-testid="user-profile-request"]');
    record("全体公開の相手のプロフィールが見える", /Rival One/.test(await text()) && /@rival_one/.test(await text()), "");
    await click('[data-testid="user-profile-request"]');
    await waitText(/非公開ではない自分のプロフィールが必要/);
    record("非公開のプロフィールでは友達の申請ができない（理由を表示）", /非公開ではない自分のプロフィールが必要/.test(await text()), "");

    // 公開範囲を「ID を知っている人」に変える
    await go(`${BASE}/account/community${P}`);
    await waitFor('[data-testid="community-visibility-link"]');
    await click('[data-testid="community-visibility-link"]');
    await click('[data-testid="community-profile-save"]');
    await waitText(/プロフィールを保存しました/);
    record("公開範囲の変更を保存できる", /プロフィールを保存しました/.test(await text()), "");

    // 届いた申請を承認
    record("届いた申請が一覧に出る", (await has('[data-testid="community-accept-friend_req"]')) && /届いた友達の申請（1）/.test(await text()), "");
    await click('[data-testid="community-accept-friend_req"]');
    await waitText(/友達になりました/);
    record("承認すると友達の一覧に入る", /友達（1）/.test(await text()) && !(await has('[data-testid="community-accept-friend_req"]')), "");

    // 検索（全体公開だけ）
    await setValue('[data-testid="community-search-input"]', "riv");
    await click('[data-testid="community-search"]');
    await waitFor('[data-testid="community-search-results"]');
    record("検索: 全体公開の相手が出る", /Rival One/.test((await ev(`document.querySelector('[data-testid="community-search-results"]')?.textContent`)) ?? ""), "");
    await setValue('[data-testid="community-search-input"]', "hid");
    await click('[data-testid="community-search"]');
    await waitFor('[data-testid="community-search-empty"]');
    record("検索: 友達だけの相手は出ない", await has('[data-testid="community-search-empty"]'), "");

    // 友達だけの相手は見えない（存在しないのと同じ表示）
    await go(`${BASE}/u/hidden_one${P}`);
    await waitFor('[data-testid="user-profile-missing"]');
    const missingHidden = await text();
    await go(`${BASE}/u/nobody_here${P}`);
    await waitFor('[data-testid="user-profile-missing"]');
    record("友達だけの相手・存在しない ID は同じ「表示できません」", /表示できません/.test(missingHidden) && /表示できません/.test(await text()) && !/Hidden One/.test(missingHidden), "");

    // 比較: 自分の診断を設定 → 相手に申請（テストダブルの相手はすぐ承認・要約あり）→ 比較の表
    // 共有 URL は画面の部品と同じ規則で作る（src/lib/squad/squad-diagnosis-share-url.ts の encodeSharePayload と同じ: base64url + FNV-1a）
    const CATS = ["attack", "defense", "aerial", "speed", "passBuildUp", "dribblePossession", "pressResistance", "counterAttack"];
    const tierOf = (n) => (n >= 85 ? "S" : n >= 70 ? "A" : n >= 55 ? "B" : n >= 40 ? "C" : "D");
    const mkPayload = (base) => ({ v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: "2026-10-14", o: [base, tierOf(base)], c: Object.fromEntries(CATS.map((c, i) => [c, [base - i, tierOf(base - i)]])), s: null, w: null });
    const fnv = (t) => { let h = 0x811c9dc5; for (const by of Buffer.from(t, "utf8")) { h ^= by; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
    const token = (p) => { const body = Buffer.from(JSON.stringify(p), "utf8").toString("base64url"); return `sd1.${body}.${fnv(body)}`; };
    const shareUrl = `${BASE}/share/diagnosis#${token(mkPayload(72))}`;
    const rivalPayload = JSON.stringify(mkPayload(65));
    if (shareUrl && rivalPayload) {
      await go(`${BASE}/account/community${P}`);
      await waitFor('[data-testid="community-share-input"]');
      await setValue('[data-testid="community-share-input"]', "https://example.invalid/share/diagnosis#sd1.broken.00000000");
      await click('[data-testid="community-comparison-save"]');
      await waitText(/共有 URL を読み取れませんでした/);
      record("比較: 壊れた共有 URL は保存しない", /共有 URL を読み取れませんでした/.test(await text()) && !(await rpcCalls()).includes("community_set_comparison"), "");
      await setValue('[data-testid="community-share-input"]', shareUrl);
      await click('[data-testid="community-comparison-save"]');
      await waitText(/比較に使う診断を保存しました/);
      record("比較: 共有 URL から診断の要約を保存し、設定済みと表示", /設定済み（総合/.test((await ev(`document.querySelector('[data-testid="community-comparison-status"]')?.textContent`)) ?? ""), "");
      await ev(`window.__EFB_COMMUNITY_RIVAL_SUMMARY__ = ${rivalPayload}`);
      await go(`${BASE}/u/rival_one${P}`);
      await ev(`window.__EFB_COMMUNITY_RIVAL_SUMMARY__ = ${rivalPayload}`);
      await waitFor('[data-testid="user-profile-request"]');
      await click('[data-testid="user-profile-request"]');
      await waitFor('[data-testid="user-profile-compare-table"]');
      const table = (await ev(`document.querySelector('[data-testid="user-profile-compare-table"]')?.innerText`)) ?? "";
      record("比較: 友達になると、自分と友達の診断を項目ごとに並べる（差つき）", /総合/.test(table) && /あなた/.test(table) && /友達/.test(table) && /[+-]\d/.test(table), table.split("\n").slice(0, 3).join(" / "));
    } else {
      record("比較: 共有 URL の準備（COMMUNITY_SHARE_URL_MINE・COMMUNITY_RIVAL_PAYLOAD）", false, "環境変数なし");
    }

    // ミュート・通報・ブロック
    await go(`${BASE}/u/rival_one${P}`);
    await waitFor('[data-testid="user-profile-mute"]');
    await click('[data-testid="user-profile-mute"]');
    await waitText(/ミュートしました/);
    record("ミュートできる（ボタンが解除に変わる）", /ミュートを解除/.test((await ev(`document.querySelector('[data-testid="user-profile-mute"]')?.textContent`)) ?? ""), "");
    await click('[data-testid="user-profile-report-open"]');
    await waitFor('[data-testid="user-profile-report-form"]');
    await ev(`(() => { const s = document.querySelector('[data-testid="user-profile-report-reason"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "minor_safety"); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await waitText(/警察などへ直接連絡/);
    record("通報: 子どもの安全の理由では緊急の連絡先の案内を出す", /警察などへ直接連絡/.test(await text()), "");
    await setValue('[data-testid="user-profile-report-note"]', "テストの通報");
    await click('[data-testid="user-profile-report-submit"]');
    await waitText(/通報を送りました/);
    record("通報を送れる（運営が確認する旨）", /通報を送りました/.test(await text()), "");
    await click('[data-testid="user-profile-report-open"]');
    await waitFor('[data-testid="user-profile-report-submit"]');
    await click('[data-testid="user-profile-report-submit"]');
    await waitText(/確認待ちのものがあります/);
    record("同じ相手への 2 回目の通報は重複として扱う", /確認待ちのものがあります/.test(await text()), "");
    await click('[data-testid="user-profile-block"]');
    await waitFor('[data-testid="user-profile-block-confirm"]');
    record("ブロックは確認してから（1 クリックで実行しない）", (await has('[data-testid="user-profile-block-confirm"]')) && !(await rpcCalls()).includes("community_block"), "");
    await click('[data-testid="user-profile-block-yes"]');
    await waitFor('[data-testid="user-profile-blocked"]');
    record("ブロックすると相手の名前を出さず、解除のボタンだけ", (await has('[data-testid="user-profile-unblock"]')) && !/Rival One/.test(await text()), "");

    // 安全の一覧・通報の記録
    await go(`${BASE}/account/community${P}`);
    await waitFor('[data-testid="community-safety"]');
    const safetyText = (await ev(`document.querySelector('[data-testid="community-safety"]')?.innerText`)) ?? "";
    record("ブロック・ミュートの一覧と自分の通報（受付）が出る", /ブロック中 @rival_one/.test(safetyText) && /ミュート中 @rival_one/.test(safetyText) && /子どもの安全に関わる問題/.test(safetyText) && /受付/.test(safetyText), "");
    record("ブロックすると友達の関係も消える（友達は 1 人のまま: friend_req）", /友達（1）/.test(await text()), "");
    await click('[data-testid="community-unblock-rival_one"]');
    await waitText(/ブロックを解除しました/);
    record("一覧からブロックを解除できる", !(await has('[data-testid="community-unblock-rival_one"]')), "");

    // 上限
    await go(`${BASE}/u/rival_one${P}`);
    await ev("window.__EFB_COMMUNITY_RATE_LIMITED__ = true");
    await waitFor('[data-testid="user-profile-request"]');
    await click('[data-testid="user-profile-request"]');
    await waitText(/1 日の上限に達しました/);
    const t = await text();
    record("1 日の上限: 理由を表示し、生のエラー文は出さない", /1 日の上限に達しました/.test(t) && !/P0011|rate_limited|test double/.test(t), "");

    // 英語・モバイル
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "en")`);
    await viewport(390, 844, true);
    await go(`${BASE}/account/community${P}`);
    await waitFor('[data-testid="community-profile"]');
    const en = await text();
    record("英語で表示（日本語の残りなし: 見出し）", /Public profile/.test(en) && /Friends/.test(en) && !/公開プロフィール/.test(en), "");
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("390px で横のはみ出しなし", overflow <= 1, `overflow=${overflow}`);
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);

    record("ページ内で JS の例外が起きない", errors.length === 0, errors.slice(0, 2).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-community] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# コミュニティ 第 1 段階 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build 上の隔離ヘッドレス Chrome・認証と community_* の関数のテストダブル。実 Supabase へは接続しない）`,
    `公開の状態: COMMUNITY_MODE = ${MODE}`,
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
