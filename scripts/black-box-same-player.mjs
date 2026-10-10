/**
 * 同じ選手の別のカード（2026-10-10 本人のゲームの画面の確認: 同じスカッドに 2 枚編成できない）のブラックボックス。
 *
 *   node scripts/black-box-same-player.mjs   （事前に npm run build・node scripts/local-server.mjs start）
 *
 * - 既存の保存データに同じ選手の 2 枚（先発と控え）があるスカッドを開くと、消さずに知らせる（`squad-same-player-warning`）。
 * - 読み込んだだけでは保存データを変えない。
 * - 同じ選手がいないスカッドでは知らせない。
 * 隔離したヘッドレス Chrome の localStorage だけを使う（実ユーザーのデータ・SQLite は変えない）。実在のカード ID だけを使う。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "same-player.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SQUADS_KEY = "efootball-team-ai:local:guest:squads:v1";
const NOW = "2026-10-10T00:00:00.000Z";
// 実データ: Roberto Carlos の 2 枚（カード ID の下位 20 ビットが同じ）と、別の選手（Costacurta）
const RC_A = "88039581945292";
const RC_B = "88033139494348";
const OTHER = "88036360587367";
const SLOTS = [["gk", 50, 92], ["lb", 15, 72], ["lcb", 38, 77], ["rcb", 62, 77], ["rb", 85, 72], ["dmf", 50, 58], ["lcmf", 33, 44], ["rcmf", 67, 44], ["lwf", 16, 22], ["cf", 50, 15], ["rwf", 84, 22]];

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

function squad(squadId, lbCard, subCard) {
  return {
    squadId,
    squadName: squadId,
    formationId: "4-3-3",
    managerId: null,
    slots: SLOTS.map(([slotId, x, y]) => ({ slotId, worldCardId: slotId === "lb" ? lbCard : null, buildMode: "none", savedBuildId: null, x, y, roleOverride: null })),
    substitutes: subCard ? [{ subId: "sub_bb000001", worldCardId: subCard, buildMode: "none", savedBuildId: null }] : [],
    captainSlotId: null,
    setPieces: { corners: null, freeKicks: null, penalties: null },
    linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    coordinateVersion: "squad-positioning/2026-08-30.v1",
    rulesVersion: "progression/2026-08-28.v2",
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function evalJson(client, expression) {
  const res = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res?.exceptionDetails) throw new Error(`eval exception: ${res.exceptionDetails.text}`);
  return res?.result?.value;
}
async function go(client, url) {
  await client.send("Page.navigate", { url });
  await waitForCondition(async () => (await evalJson(client, "document.readyState")) === "complete", { timeoutMs: 10000, intervalMs: 100 });
}

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
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.text ?? "exception"));

  try {
    await go(client, `${BASE}/squads`);
    const store = [squad("sq_bbsameplayer1", RC_A, RC_B), squad("sq_bbdifferent01", RC_A, OTHER)];
    const raw = JSON.stringify(store);
    await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, ${JSON.stringify(raw)})` });

    await go(client, `${BASE}/squads/sq_bbsameplayer1`);
    const warnText = () => evalJson(client, `document.querySelector('[data-testid="squad-same-player-warning"]')?.textContent ?? ""`);
    // 選手の名前はカードの読み込みの後に入る（それまではカード ID）。名前が入るまで待つ。
    await waitForCondition(async () => /同じ選手/.test(await warnText()) && !/: \d{6,}（/.test(await warnText()), { timeoutMs: 20000, intervalMs: 250 }).catch(() => {});
    const warn = await warnText();
    record("[既存の保存データ] 同じ選手の 2 枚（先発と控え）を知らせる", /同じ選手が 2 枚以上/.test(warn) && /Roberto Carlos|ロベルト・カルロス|ロベルト カルロス/.test(warn), warn.slice(0, 120));
    record("[既存の保存データ] 自動では変えない旨を示す", /自動では変えていません/.test(warn), "");
    await new Promise((r) => setTimeout(r, 800));
    const after = await evalJson(client, `localStorage.getItem(${JSON.stringify(SQUADS_KEY)})`);
    const ids = (s) => JSON.parse(s ?? "[]").find((x) => x.squadId === "sq_bbsameplayer1");
    const a = ids(after);
    const b = ids(raw);
    record(
      "[既存の保存データ] 開いただけでは 2 枚とも残る（消さない・変えない）",
      !!a && a.slots.find((s) => s.slotId === "lb")?.worldCardId === RC_A && a.substitutes.map((s) => s.worldCardId).join() === b.substitutes.map((s) => s.worldCardId).join(),
      a ? `lb=${a.slots.find((s) => s.slotId === "lb")?.worldCardId} subs=${a.substitutes.map((s) => s.worldCardId).join(",")}` : "squad missing",
    );

    await go(client, `${BASE}/squads/sq_bbdifferent01`);
    await waitForCondition(async () => /Costacurta|コスタクルタ/.test(await evalJson(client, "document.body.innerText")), { timeoutMs: 15000, intervalMs: 200 }).catch(() => {});
    const none = await evalJson(client, `!!document.querySelector('[data-testid="squad-same-player-warning"]')`);
    record("[別の選手] 同じ選手がいないスカッドでは知らせない", none === false, "");
    record("ページ内で JS の例外が起きない", errors.length === 0, errors.slice(0, 2).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-same-player] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 同じ選手の別のカード ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（Production Build 上の隔離ヘッドレス Chrome）`,
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
