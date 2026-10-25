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
    // 選手の詳細: 同じ選手の別のカード（2026-10-11）
    {
      await go(client, `${BASE}/players/world/${RC_A}`);
      await waitForCondition(async () => evalJson(client, `!!document.querySelector('[data-testid="same-player-other-cards"]')`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
      const ids = await evalJson(client, `[...document.querySelectorAll('[data-testid="same-player-other-cards"] a')].map((a) => a.getAttribute("href").split("/").pop())`);
      const key = (id) => (BigInt(id) & ((1n << 20n) - 1n)).toString();
      record(
        "[選手の詳細] 同じ選手の別のカードを出す（人物のキーが同じものだけ・自分は含めない・RC_B を含む）",
        Array.isArray(ids) && ids.length > 0 && ids.every((id) => key(id) === key(RC_A) && id !== RC_A) && ids.includes(RC_B),
        `n=${ids?.length}`,
      );
      // 似ているカード（2026-10-25）: 同じポジション・最大 OVR ±3・同じ選手のカードは含めない・もっと見るは同じ条件の一覧
      await waitForCondition(async () => evalJson(client, `!!document.querySelector('[data-testid="similar-cards"]')`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
      const sim = await evalJson(client, `[...document.querySelectorAll('[data-testid="similar-cards"] li a[href^="/players/world/"]')].map((a) => a.getAttribute("href").split("/").pop())`);
      const more = await evalJson(client, `document.querySelector('[data-testid="similar-cards-more"]')?.getAttribute("href") ?? ""`);
      const cmp = await evalJson(client, `document.querySelector('[data-testid="similar-cards-compare"]')?.getAttribute("href") ?? ""`);
      const me = await evalJson(client, `(async () => (await (await fetch("/api/world/players/${RC_A}")).json()).player ?? null)()`);
      let simOk = Array.isArray(sim) && sim.length > 0 && sim.every((id) => key(id) !== key(RC_A));
      for (const id of (sim ?? []).slice(0, 2)) {
        const p = await evalJson(client, `(async () => (await (await fetch("/api/world/players/${id}")).json()).player ?? null)()`);
        simOk = simOk && !!p && !!me && p.registeredPosition === me.registeredPosition && Math.abs(p.ovrMax - me.ovrMax) <= 3;
      }
      record("[選手の詳細] 似ているカード（同じポジション・最大 OVR ±3・同じ選手は除く）・比べる・もっと見るのリンク", simOk && /^\/players\?position=/.test(more) && cmp === `/compare?ids=${RC_A},${sim?.[0]}`, `n=${sim?.length} more=${more} cmp=${cmp}`);
      // 似ているカード: My Team で所持のカードに「所持済み」（2026-10-25）
      {
        const KEY = "efootball-team-ai:local:guest:my-team:v1";
        const now = new Date().toISOString();
        const recOf = (id) => ({ localRecordId: `mt_${id}`, teamCardId: `tc_${id}`, worldCardId: id, ownershipStatus: "owned", usageStatus: "unused", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: now, updatedAt: now, deletedAt: null, source: "local", syncStatus: "local_only" });
        await evalJson(client, `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: now, records: [...(sim?.[0] ? [recOf(sim[0])] : []), recOf(RC_B)] }))})`);
        await go(client, `${BASE}/players/world/${RC_A}`);
        await waitForCondition(async () => evalJson(client, `!!document.querySelector('[data-testid="similar-owned"]')`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
        const ownedIds = await evalJson(client, `[...document.querySelectorAll('[data-testid="similar-owned"]')].map((b) => b.closest("li").querySelector('a[href^="/players/world/"]').getAttribute("href").split("/").pop())`);
        record("[選手の詳細] 似ているカードのうち所持のカードに「所持済み」", Array.isArray(ownedIds) && ownedIds.length === 1 && ownedIds[0] === sim?.[0], JSON.stringify(ownedIds));
        // 同じ選手の別のカード・比較の列にも同じ印（2026-10-25）
        const sameOwned = await evalJson(client, `[...document.querySelectorAll('[data-testid="same-player-owned"]')].map((b) => b.closest("a").getAttribute("href").split("/").pop())`);
        record("[選手の詳細] 同じ選手の別のカードのうち所持のカードに「所持済み」", Array.isArray(sameOwned) && sameOwned.length === 1 && sameOwned[0] === RC_B, JSON.stringify(sameOwned));
        await go(client, `${BASE}/compare?ids=${RC_A},${RC_B}`);
        await waitForCondition(async () => evalJson(client, `!!document.querySelector('[data-testid="compare-owned"]')`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
        const cmpOwned = await evalJson(client, `document.querySelectorAll('[data-testid="compare-owned"]').length`);
        record("[比較] 所持のカードの列だけに「所持済み」（2 枚のうち 1 枚）", cmpOwned === 1, `n=${cmpOwned}`);
        await evalJson(client, `localStorage.removeItem(${JSON.stringify(KEY)})`);
      }
      // 比較: 1 枚のとき「似ているカードを追加」→ 押すと 2 枚の比較（URL の ids に入る・2026-10-25）
      await go(client, `${BASE}/compare?ids=${RC_A}`);
      await waitForCondition(async () => evalJson(client, `!!document.querySelector('[data-testid="compare-similar-suggestions"] button')`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
      const sugId = await evalJson(client, `document.querySelector('[data-testid="compare-similar-suggestions"] button')?.dataset.worldCardId ?? null`);
      if (sugId) await evalJson(client, `document.querySelector('[data-testid="compare-similar-suggestions"] button').click()`);
      await waitForCondition(async () => evalJson(client, `location.search.includes(${JSON.stringify(`${RC_A},`)})`), { timeoutMs: 15000, intervalMs: 300 }).catch(() => {});
      const search = await evalJson(client, `decodeURIComponent(location.search)`);
      const gone = await evalJson(client, `!document.querySelector('[data-testid="compare-similar-suggestions"]')`);
      record("[比較] 1 枚のとき似ているカードを追加 → 2 枚の比較になり、提案は消える", !!sugId && search.includes(`${RC_A},${sugId}`) && gone === true, `${sugId} ${search}`);
    }
    // 入れ替えの提案（2026-10-11）: 先発の LB に RC_A がいるスカッドへ、RC_B を控えに追加しようとする → 提案 → 入れ替え → LB が RC_B
    {
      const store2 = [squad("sq_bbswaptest01", RC_A, null)];
      await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, ${JSON.stringify(JSON.stringify(store2))})` });
      await go(client, `${BASE}/squads/sq_bbswaptest01?card=${RC_B}`);
      await waitForCondition(async () => evalJson(client, `!![...document.querySelectorAll("button")].find((b) => /ベンチに追加/.test(b.textContent))`), { timeoutMs: 15000, intervalMs: 250 }).catch(() => {});
      await evalJson(client, `[...document.querySelectorAll("button")].find((b) => /ベンチに追加/.test(b.textContent))?.click()`);
      await waitForCondition(async () => evalJson(client, `!!document.querySelector('[data-testid="squad-same-player-swap"]')`), { timeoutMs: 8000, intervalMs: 200 }).catch(() => {});
      const offer = await evalJson(client, `document.querySelector('[data-testid="squad-same-player-swap"]')?.textContent ?? ""`);
      record("[入れ替え] 同じ選手の別のカードを入れようとすると「入れ替えますか」と提案する（名前つき）", /入れ替えますか/.test(offer) && /ロベルト|Roberto/.test(offer), offer.slice(0, 80));
      await evalJson(client, `document.querySelector('[data-testid="squad-same-player-swap-confirm"]')?.click()`);
      await new Promise((r) => setTimeout(r, 800));
      const saved = await evalJson(client, `JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)})).find((x) => x.squadId === "sq_bbswaptest01")`);
      const lb = saved?.slots?.find((x) => x.slotId === "lb")?.worldCardId;
      record("[入れ替え] 入れ替えると、元のカードの位置（LB）に新しいカード・控えには増えない・同じ選手の重複なし", lb === RC_B && (saved?.substitutes?.length ?? -1) === 0, `lb=${lb} subs=${saved?.substitutes?.length}`);
    }
    // スカッドの選手検索: 入力前に My Team の所持カードを出す（2026-10-26）。置いたカードは押せない・所持の印つき
    {
      const KEY = "efootball-team-ai:local:guest:my-team:v1";
      const now = new Date().toISOString();
      const recOf = (id) => ({ localRecordId: `mt_${id}`, teamCardId: `tc_${id}`, worldCardId: id, ownershipStatus: "owned", usageStatus: "unused", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: now, updatedAt: now, deletedAt: null, source: "local", syncStatus: "local_only" });
      await evalJson(client, `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: now, records: [recOf(RC_A), recOf(OTHER)] }))})`);
      await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, ${JSON.stringify(JSON.stringify([squad("sq_bbownedpick1", RC_A, null)]))})` });
      await go(client, `${BASE}/squads/sq_bbownedpick1`);
      await waitForCondition(async () => evalJson(client, `!![...document.querySelectorAll("button")].find((b) => /ベンチ選手を追加/.test(b.textContent))`), { timeoutMs: 15000, intervalMs: 250 }).catch(() => {});
      await evalJson(client, `[...document.querySelectorAll("button")].find((b) => /ベンチ選手を追加/.test(b.textContent))?.click()`);
      await waitForCondition(async () => evalJson(client, `document.querySelectorAll('[data-testid="squad-search-owned"] > ul > li').length >= 2`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
      const rows = await evalJson(client, `[...document.querySelectorAll('[data-testid="squad-search-owned"] > ul > li')].map((li) => ({ id: li.querySelector('a[href^="/players/world/"]')?.getAttribute("href").split("/").pop() ?? null, disabled: !!li.querySelector("button")?.disabled, owned: !!li.querySelector('[data-testid="search-card-owned"]') }))`);
      const a = rows?.find((r) => r.id === RC_A);
      const o = rows?.find((r) => r.id === OTHER);
      record("[スカッドの選手検索] 入力前に所持カードを出す（置いたカードは押せない・所持の印）", Array.isArray(rows) && rows.length === 2 && !!a && a.disabled && !!o && !o.disabled && rows.every((r) => r.owned), JSON.stringify(rows));
      // 比較の「選手を追加」も同じ（比較に入っているカードは押せない）
      await go(client, `${BASE}/compare?ids=${RC_A}`);
      await waitForCondition(async () => evalJson(client, `!![...document.querySelectorAll("button")].find((b) => /人目へ選手を追加/.test(b.textContent))`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
      await evalJson(client, `[...document.querySelectorAll("button")].find((b) => /人目へ選手を追加/.test(b.textContent))?.click()`);
      await waitForCondition(async () => evalJson(client, `document.querySelectorAll('[data-testid="compare-search-owned"] > ul > li').length >= 2`), { timeoutMs: 20000, intervalMs: 300 }).catch(() => {});
      const crow = await evalJson(client, `[...document.querySelectorAll('[data-testid="compare-search-owned"] > ul > li')].map((li) => ({ id: li.querySelector('a[href^="/players/world/"]')?.getAttribute("href").split("/").pop() ?? null, disabled: !!li.querySelector("button")?.disabled }))`);
      const ca = crow?.find((r) => r.id === RC_A);
      const co = crow?.find((r) => r.id === OTHER);
      record("[比較の選手を追加] 入力前に所持カードを出す（比較に入っているカードは押せない）", Array.isArray(crow) && crow.length === 2 && !!ca && ca.disabled && !!co && !co.disabled, JSON.stringify(crow));
      await evalJson(client, `localStorage.removeItem(${JSON.stringify(KEY)})`);
    }
    // 先発の所属の内訳（2026-10-11）: LB と RB に同じ国籍の 2 枚 → 「国籍」に「<国籍> ×2」・選手一覧の絞り込みへのリンク
    {
      const d = await (await fetch(`${BASE}/api/world/players/${RC_A}`)).json().catch(() => null);
      const nat = d?.player?.nationality;
      const s3 = squad("sq_bbaffiliat01", RC_A, null);
      s3.slots = s3.slots.map((x) => (x.slotId === "rb" ? { ...x, worldCardId: RC_B } : x));
      await client.send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, ${JSON.stringify(JSON.stringify([s3]))})` });
      await go(client, `${BASE}/squads/sq_bbaffiliat01`);
      await waitForCondition(async () => /×2/.test(await evalJson(client, `document.querySelector('[data-testid="squad-affiliation-summary"]')?.textContent ?? ""`)), { timeoutMs: 15000, intervalMs: 250 }).catch(() => {});
      const panel = await evalJson(client, `(() => { const p = document.querySelector('[data-testid="squad-affiliation-summary"]'); if (!p) return null; const n = [...p.querySelectorAll('[data-affiliation-kind="nationality"]')].map((e) => e.textContent.trim()); const href = p.querySelector('[data-affiliation-kind="nationality"] a')?.getAttribute("href") ?? ""; return { n, href }; })()`);
      record(
        "[所属の内訳] 先発の同じ国籍を「国籍 ×人数」で示し、選手一覧の絞り込みへリンクする",
        !!nat && Array.isArray(panel?.n) && panel.n.some((x) => x.startsWith(nat) && x.endsWith("×2")) && panel.href.startsWith("/players?nationality="),
        `${nat} ${JSON.stringify(panel)}`,
      );
    }
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
