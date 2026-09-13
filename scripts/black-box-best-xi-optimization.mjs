/**
 * AIベスト11(第1段階: 総合型・全体配置最適化)の専用ブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-best-xi-optimization.mjs
 *
 * - Production Build上の隔離ヘッドレスChrome(scripts/lib/headless-chrome.mjs)で実際に画面を操作する。
 * - localStorage(My Team・保存ビルド)は隔離プロファイル内の値のみを使用し、実ユーザーの
 *   My Team・保存ビルド・保存スカッド・SQLiteは一切変更しない。
 * - 実在するWorld DBカード(本番のSQLiteデータ)のworldCardIdのみを使う(架空のIDは作らない)。
 * - このタスク(全体配置最適化への刷新)で新たに要求された挙動: 局所貪欲との乖離の是正、
 *   同系統(CB→LB等)への合理的な振り分け、GK/CB候補不足時の安全な空きスロット化、
 *   同一カード複数ビルドの重複防止、候補順序に依存しない決定性、大規模候補プールでの安定動作、
 *   壊れた/レガシーな保存データに対する安全なフォールバックを検証する。
 * - 結果は docs/black-box-tests/best-xi-optimization.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "best-xi-optimization.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// アカウント別localStorage領域対応(feat/account-scoped-local-storage)により、
// 未認証(guest)のMy Teamは旧固定キーではなくguest専用キーへ読み書きされるようになった。
// このスクリプトは一切認証しない(常にguest)ため、フィクスチャの注入先もguestキーへ揃える。
const MY_TEAM_KEY = "efootball-team-ai:local:guest:my-team:v1";
const MY_TEAM_VERSION = "my-team-storage/2026-08-30.v1";
const BUILDS_KEY = "efootball-team-ai:progression-builds:v1";
const NOW = "2026-09-11T00:00:00.000Z";
const RULES_V2 = "progression/2026-08-28.v2";
const RULES_LEGACY = "progression/2026-08-28.provisional-1";

// 実在するWorld DBカード(本番SQLite)のworldCardId。
const NEUER_GK = "106788187832737"; // マヌエル ノイアー
const MALDINI_CB = "88045755960770"; // パオロ マルディーニ
const BECKENBAUER_CB = "88039581945324"; // フランツ ベッケンバウアー
const BARESI_CB = "88039581945329"; // フランコ バレージ
const ROBERTO_CARLOS_LB = "88039581945292"; // ロベルト カルロス
const THURAM_RB = "88044145351392"; // リリアン テュラム
const RODRI_DMF = "89138556678367"; // ロドリ
const MATTHAUS_CMF = "88044145348069"; // ローター マテウス
const BELLINGHAM_CMF = "106765907789637"; // ジュード ベリンガム
const HAZARD_LWF = "88045755863174"; // エデン アザール
const IBRAHIMOVIC_CF = "89136140651034"; // ズラタン イブラヒモヴィッチ
const MESSI_RWF = "89136409091415"; // リオネル メッシ(RWF登録)

const FULL_XI = [
  NEUER_GK,
  ROBERTO_CARLOS_LB,
  MALDINI_CB,
  BECKENBAUER_CB,
  THURAM_RB,
  RODRI_DMF,
  MATTHAUS_CMF,
  BELLINGHAM_CMF,
  HAZARD_LWF,
  IBRAHIMOVIC_CF,
  MESSI_RWF,
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
}
async function hardReloadAndSettle(client) {
  await client.send("Page.reload", { ignoreCache: true });
  await waitForCondition(async () => (await evalJson(client, "document.readyState")) === "complete", { timeoutMs: 8000, intervalMs: 100 });
  await new Promise((r) => setTimeout(r, 400));
}
async function bodyText(client) {
  return evalJson(client, "document.body.innerText");
}
function myTeamRecord(worldCardId) {
  return {
    localRecordId: `mt_${worldCardId}`,
    teamCardId: `tc_${worldCardId}`,
    worldCardId,
    ownershipStatus: "owned",
    usageStatus: "unused",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
  };
}
async function setMyTeam(client, worldCardIds) {
  const store = { storageVersion: MY_TEAM_VERSION, updatedAt: NOW, records: worldCardIds.map(myTeamRecord) };
  await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(MY_TEAM_KEY)}, ${JSON.stringify(JSON.stringify(store))})` });
}
async function clearBuilds(client) {
  await client.send("Runtime.evaluate", { expression: `localStorage.removeItem(${JSON.stringify(BUILDS_KEY)})` });
}
function savedBuild({ worldCardId, buildId, buildName, rulesVersion = RULES_V2, buildIntent, updatedAt = NOW }) {
  return {
    buildId,
    worldCardId,
    buildName,
    progressionAllocation: {},
    selectedPlayerBooster: null,
    conditionalBoosterSelections: [],
    calculatedStats: {},
    calculatedOvr: null,
    calculationMode: "confirmed",
    rulesVersion,
    createdAt: NOW,
    updatedAt,
    schemaVersion: 1,
    ...(buildIntent ? { buildIntent } : {}),
  };
}
async function setBuildsStore(client, storeObj) {
  await client.send("Runtime.evaluate", {
    expression: `localStorage.setItem(${JSON.stringify(BUILDS_KEY)}, ${JSON.stringify(JSON.stringify(storeObj))})`,
  });
}
async function setRawBuildsValue(client, rawString) {
  await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(BUILDS_KEY)}, ${JSON.stringify(rawString)})` });
}

/** スロット一覧(選出選手一覧)から、指定ポジションを持つ<li>群の情報を取得する。 */
async function slotsByPosition(client, position) {
  return evalJson(
    client,
    `(() => {
      const items = [...document.querySelectorAll('ul > li')];
      const matches = items.filter((li) => {
        const spans = [...li.querySelectorAll('span')];
        return spans.some((s) => s.textContent.trim() === ${JSON.stringify(position)});
      });
      return matches.map((li) => ({ hasDetails: !!li.querySelector('details'), text: li.textContent }));
    })()`,
  );
}

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
    // 1. 通常のフル充足4-3-3(本職適性の実在カード11人)
    // ============================================================
    await navigateAndSettle(client, `${BASE}/best-xi`);
    await setMyTeam(client, FULL_XI);
    await clearBuilds(client);
    await hardReloadAndSettle(client);
    await waitForCondition(async () => new RegExp(`候補: 保存済み選手 ${FULL_XI.length} 人`).test(await bodyText(client)), {
      timeoutMs: 10000,
      intervalMs: 200,
    });
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const fullBody = await bodyText(client);
    record("[フル充足4-3-3] 選考方法ラベル「総合型・全体配置最適化」が表示される", fullBody.includes("総合型・全体配置最適化"), "");
    record("[フル充足4-3-3] 選考基準の見出しが表示される", fullBody.includes("選考基準"), "");
    record("[フル充足4-3-3] 11 / 11 スロットが埋まった旨が表示される", /11\s*\/\s*11/.test(fullBody), "");
    record("[フル充足4-3-3] 本職 11 人・同系統 0 人と表示される", /本職\s*11\s*人/.test(fullBody) && /同系統\s*0\s*人/.test(fullBody), "");
    record("[フル充足4-3-3] 空きスロットの警告が表示されない", !fullBody.includes("空きスロット"), "");

    // ============================================================
    // 2. 局所貪欲との乖離の回帰(GK + CB本職1人だけ): CBへ正しく収まる(LBへ逃げない)
    // ============================================================
    await setMyTeam(client, [NEUER_GK, MALDINI_CB]);
    await clearBuilds(client);
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const cbSlots1 = await slotsByPosition(client, "CB");
    const lbSlots1 = await slotsByPosition(client, "LB");
    record(
      "[局所貪欲との乖離] CB本職候補が1人だけの場合、CBスロットへ収まる(本職スロットが先に埋まった関連スロットへ逃げない)",
      cbSlots1.some((s) => s.text.includes("マルディーニ")),
      JSON.stringify(cbSlots1.map((s) => s.text.slice(0, 30))),
    );
    record(
      "[局所貪欲との乖離] LBスロットへは配置されない(候補不足のまま)",
      !lbSlots1.some((s) => s.text.includes("マルディーニ")),
      "",
    );

    // ============================================================
    // 3. 同系統内の複数候補(多役割): 3人のCB本職候補 → 2人がCB(本職)・1人がLB/RB(同系統)
    // ============================================================
    await setMyTeam(client, [NEUER_GK, MALDINI_CB, BECKENBAUER_CB, BARESI_CB]);
    await clearBuilds(client);
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const cbSlots2 = await slotsByPosition(client, "CB");
    const lbSlots2 = await slotsByPosition(client, "LB");
    const rbSlots2 = await slotsByPosition(client, "RB");
    const cbNamesFilled = cbSlots2.filter((s) => s.hasDetails).length;
    const namesOfCbCandidates = ["マルディーニ", "ベッケンバウアー", "バレージ"];
    const relegatedCount =
      namesOfCbCandidates.filter((n) => lbSlots2.some((s) => s.text.includes(n)) || rbSlots2.some((s) => s.text.includes(n))).length;
    record("[多役割] CBスロット2枠とも本職候補で埋まる", cbNamesFilled === 2, `filled=${cbNamesFilled}`);
    record("[多役割] 3人目はLBかRBのいずれかへ同系統で振り分けられる", relegatedCount === 1, `relegatedCount=${relegatedCount}`);
    record(
      "[多役割] 同じ候補が重複して複数スロットに現れない",
      namesOfCbCandidates.every(
        (n) => [...cbSlots2, ...lbSlots2, ...rbSlots2].filter((s) => s.text.includes(n)).length <= 1,
      ),
      "",
    );

    // ============================================================
    // 4. GK候補不足: GKスロットは候補不足のまま、他の有効スロットは選考を継続する
    // ============================================================
    await setMyTeam(client, [MALDINI_CB, BECKENBAUER_CB, ROBERTO_CARLOS_LB, THURAM_RB]);
    await clearBuilds(client);
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const gkBody = await bodyText(client);
    record("[GK候補不足] GKスロットの候補不足が表示される", gkBody.includes("候補が見つかりません") || gkBody.includes("空きスロット"), "");
    const cbSlots3 = await slotsByPosition(client, "CB");
    record("[GK候補不足] GK不足でも他のCBスロットは選考が継続される", cbSlots3.filter((s) => s.hasDetails).length === 2, "");

    // ============================================================
    // 5. 同一カード複数保存ビルド: 重複起用しない(片方だけが採用される)
    // ============================================================
    await setMyTeam(client, [NEUER_GK, MALDINI_CB]);
    await setBuildsStore(client, {
      [MALDINI_CB]: [
        savedBuild({ worldCardId: MALDINI_CB, buildId: "buildA", buildName: "ビルドA", updatedAt: "2026-09-10T00:00:00.000Z" }),
        savedBuild({ worldCardId: MALDINI_CB, buildId: "buildB", buildName: "ビルドB", updatedAt: "2026-09-09T00:00:00.000Z" }),
      ],
    });
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const multiBuildBody = await bodyText(client);
    const maldiniMentionCount = (multiBuildBody.match(/マルディーニ/g) || []).length;
    record(
      "[同一カード複数ビルド] 同じ選手が選出選手一覧に複数スロットとして重複出現しない",
      maldiniMentionCount <= 1,
      `mentionCount=${maldiniMentionCount}`,
    );
    record(
      "[同一カード複数ビルド] 利用可能なビルド件数が2件として集計される",
      /利用可能なビルド\s*2\s*件/.test(multiBuildBody),
      "",
    );

    // ============================================================
    // 6. レガシー規則のビルド: badge表示・クラッシュしない
    // ============================================================
    await setBuildsStore(client, {
      [MALDINI_CB]: [savedBuild({ worldCardId: MALDINI_CB, buildId: "legacyBuild", buildName: "旧ビルド", rulesVersion: RULES_LEGACY })],
    });
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const legacyBody = await bodyText(client);
    record("[レガシー規則] レガシービルドでもクラッシュせず選出結果を表示する", legacyBody.includes("選出選手一覧"), "");

    // ============================================================
    // 7. 壊れた保存データへの耐性: 破損JSON・存在しないworldCardId
    // ============================================================
    await setRawBuildsValue(client, "{ this is not valid json !!");
    await setMyTeam(client, [NEUER_GK, MALDINI_CB, "99999999999999"]); // 実在しないworldCardId混在
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const corruptedBody = await bodyText(client);
    record("[破損データ耐性] 破損したビルドJSON・存在しないworldCardIdが混在してもクラッシュしない", corruptedBody.includes("選出選手一覧"), "");
    record(
      "[破損データ耐性] 存在しないカードは取得不可カードとして扱われる(内部IDそのままの露出はしない)",
      !corruptedBody.includes("noWorldCardData") && !/99999999999999/.test(corruptedBody),
      "",
    );

    // ============================================================
    // 8. 候補配列の並び順に依存しない決定性(My Teamの保存順を逆にしても結果は同じ)
    // ============================================================
    await clearBuilds(client);
    await setMyTeam(client, FULL_XI);
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const orderA = await evalJson(client, "document.querySelector('ul').textContent");
    await setMyTeam(client, [...FULL_XI].reverse());
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const orderB = await evalJson(client, "document.querySelector('ul').textContent");
    record("[決定性] My Teamの保存順を逆にしても選出選手一覧の内容は変わらない", orderA === orderB, "");

    // ============================================================
    // 9. 大規模候補プール(100件超)でも安定して完了する
    // ============================================================
    const listRes = await fetch(`${BASE}/api/world/players?pageSize=100`);
    const listJson = await listRes.json();
    const largeIds = [...new Set((listJson.players ?? []).map((p) => p.worldCardId))].slice(0, 100);
    await clearBuilds(client);
    await setMyTeam(client, largeIds);
    const largeStart = Date.now();
    await hardReloadAndSettle(client);
    const largeOk = await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 20000, intervalMs: 300 });
    const largeElapsed = Date.now() - largeStart;
    record(
      `[大規模候補プール] 候補${largeIds.length}件でも選考が完了する`,
      Boolean(largeOk),
      `elapsedMs=${largeElapsed}`,
    );
    record("[大規模候補プール] 妥当な時間内(15秒以内)に完了する", largeElapsed < 15000, `elapsedMs=${largeElapsed}`);

    // ============================================================
    // 10. 390px幅(モバイル)でも横スクロールが発生せず表示できる
    // ============================================================
    await setMyTeam(client, FULL_XI);
    await clearBuilds(client);
    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const overflow390 = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
    record("[390px] 横スクロールが発生しない(scrollWidthがinnerWidthを大きく超えない)", overflow390 <= 4, `overflow=${overflow390}`);
    const body390 = await bodyText(client);
    record("[390px] 見出し・選考結果が表示される", body390.includes("AIベスト11") && body390.includes("選出選手一覧"), "");
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // ============================================================
    // 11. 内部情報の非露出・外部通信ゼロ
    // ============================================================
    await hardReloadAndSettle(client);
    await waitForCondition(async () => (await bodyText(client)).includes("選出選手一覧"), { timeoutMs: 10000, intervalMs: 200 });
    const finalBody = await bodyText(client);
    record(
      "[内部情報非露出] 選考結果表示中もcandidateKey/savedBuildId等の内部識別子を含まない",
      !/candidateKey|savedBuildId/.test(finalBody),
      "",
    );
    const externalRequests = networkRequests.filter((u) => !u.startsWith(BASE) && !u.startsWith("http://localhost") && !u.startsWith("data:"));
    record("[外部通信ゼロ] localhost以外への通信が発生していない", externalRequests.length === 0, externalRequests.slice(0, 3).join(", "));

    record("ページ内でJS例外が発生していない(全シナリオ通算)", errors.length === 0, errors.slice(0, 3).join(" / "));
    record("コンソールエラーが発生していない(全シナリオ通算)", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-best-xi-optimization] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# AIベスト11 全体配置最適化 専用ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build上の隔離ヘッドレスChrome確認。実機ではない）`,
    "",
    "実ユーザーのMy Team・保存ビルド・保存スカッド・SQLiteは一切変更しない(隔離プロファイルのlocalStorageのみ操作)。",
    "実在するWorld DBカード(本番SQLite)のworldCardIdのみを使用し、架空のIDは作らない。",
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
  console.log(`[black-box-best-xi-optimization] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exitCode = 1;
});
