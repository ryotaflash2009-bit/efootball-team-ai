/**
 * 新しいカードの画面（/players/new・2026-10-17）のブラックボックス。
 *
 *   node scripts/black-box-new-cards.mjs   （事前に npm run build・node scripts/local-server.mjs start）
 *
 * - 最近追加された正式なカードの一覧が出る（直近 7 日・枚数の表示）。
 * - My Team が空なら「My Team に登録すると…」の案内。
 * - My Team に弱いカード（CF）を「所持」で入れると、それより強い新しいカード（CF）が比較の一覧に出る。
 * - スカッドの画面: 弱い CF を CF の枠に入れると、その枠に「今の選手より +差」の新しいカード、空いている枠に「空いている枠」の提案が出る。
 * - 390px で横のはみ出しなし・JS の例外なし。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition } from "./lib/headless-chrome.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "new-cards.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MY_TEAM_KEY = "efootball-team-ai:local:guest:my-team:v1";
const SQUADS_KEY = "efootball-team-ai:local:guest:squads:v1";
const SLOTS = [["gk", 50, 92], ["lb", 15, 72], ["lcb", 38, 77], ["rcb", 62, 77], ["rb", 85, 72], ["dmf", 50, 58], ["lcmf", 33, 44], ["rcmf", 67, 44], ["lwf", 16, 22], ["cf", 50, 15], ["rwf", 84, 22]];
const squadFixture = (squadId, cfCard) => ({ squadId, squadName: squadId, formationId: "4-3-3", managerId: null, slots: SLOTS.map(([slotId, x, y]) => ({ slotId, worldCardId: slotId === "cf" ? cfCard : null, buildMode: "none", savedBuildId: null, x, y, roleOverride: null })), substitutes: [], captainSlotId: null, setPieces: { corners: null, freeKicks: null, penalties: null }, linkUp: { centerPieceSlotId: null, keyManSlotId: null }, coordinateVersion: "squad-positioning/2026-08-30.v1", rulesVersion: "progression/2026-08-28.v2", schemaVersion: 1, createdAt: NOW, updatedAt: NOW });
const NOW = "2026-10-17T00:00:00.000Z";
const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const myTeamRecord = (id) => ({ localRecordId: `mt_${id}`, teamCardId: `tc_${id}`, worldCardId: id, ownershipStatus: "owned", usageStatus: "unused", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: NOW, updatedAt: NOW, deletedAt: null, source: "local", syncStatus: "local_only" });

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.text ?? "exception"));
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const go = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 15000, intervalMs: 100 });
    await new Promise((r) => setTimeout(r, 800));
  };
  const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
  const waitFor = (sel, ms = 12000) => waitForCondition(() => has(sel), { timeoutMs: ms, intervalMs: 200 }).catch(() => {});
  try {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await go(`${BASE}/players/new`);
    await ev(`localStorage.setItem("efootball-team-ai:locale:v1", "ja"); localStorage.removeItem(${JSON.stringify(MY_TEAM_KEY)})`);
    await go(`${BASE}/players/new`);
    const heading = (await ev(`document.querySelector('[data-testid="recently-added"]')?.innerText ?? ""`)) || "";
    const recentCount = (await ev(`document.querySelectorAll('[data-testid="recently-added-grid"] a[href^="/players/world/"]').length`)) ?? 0;
    // 正式なデータの取り込みが 7 日以上止まると 0 枚になる（2026-10-24: 取得元の機械判定）。0 枚なら「まだありません」の表示を確かめる
    const recentEmpty = await has('[data-testid="recently-added-empty"]');
    record("最近追加されたカードの一覧（直近 7 日・枚数の表示）", /最近追加されたカード（直近 7 日・\d+ 枚）/.test(heading) && (recentCount > 0 || recentEmpty), `${recentCount} cards${recentEmpty ? " (empty notice)" : ""}`);
    // 日ごとの見出しの下にその日のカード（最初は 12 枚まで・残りはボタン）
    const days = (await ev(`[...document.querySelectorAll('[data-testid="added-day"]')].map((d) => ({ shown: d.querySelectorAll('[data-testid="recently-added-grid"] > li').length, more: !!d.querySelector('[data-testid="added-day-more"]'), n: Number((/（(\\d+) 枚）/.exec(d.innerText) || [])[1] || 0) }))`)) ?? [];
    record("日ごとに見出しとカード（最初は 12 枚まで・残りはボタン）", (recentCount === 0 ? days.length === 0 : days.length > 0) && days.every((d) => d.shown <= 12 && (d.n <= 12 || d.more)), JSON.stringify(days));
    if (days[0]?.more) {
      await ev(`document.querySelector('[data-testid="added-day-more"]').click()`);
      await new Promise((r) => setTimeout(r, 500));
      const after = await ev(`document.querySelector('[data-testid="added-day"] [data-testid="recently-added-grid"]').children.length`);
      record("「残りを表示」でその日のカードがすべて出る", after === days[0].n, `${after}/${days[0].n}`);
    }
    // 追加された日ごと → パック診断
    const batch = await ev(`(() => { const a = document.querySelector('[data-testid="added-batch-pack-check"]'); if (!a) return null; const m = /（(\\d+) 枚）/.exec(a.parentElement.innerText); return { href: a.getAttribute("href"), count: m ? Number(m[1]) : null }; })()`);
    if (recentCount > 0) {
      const ids = batch?.href ? new URL(batch.href, BASE).searchParams.get("ids").split(",") : [];
      record("追加された日ごとのまとまりとパック診断へのリンク", !!batch && ids.length === Math.min(batch.count ?? -1, 30), `${batch?.count} cards → ${ids.length} ids`);
      await go(`${BASE}${batch.href}`);
      await waitForCondition(async () => (await ev(`document.querySelectorAll('[data-testid="pack-check-list"] li').length`)) === ids.length, { timeoutMs: 15000, intervalMs: 200 }).catch(() => {});
      const shown = await ev(`document.querySelectorAll('[data-testid="pack-check-list"] li').length`);
      record("リンク先のパック診断にその日のカードが出る", shown === ids.length, `${shown}/${ids.length}`);
      await go(`${BASE}/players/new`);
    }
    await waitFor('[data-testid="new-cards-impact-no-team"]');
    record("My Team が空なら登録の案内", await has('[data-testid="new-cards-impact-no-team"]'), "");

    // 最近追加された CF のカードの最小の OVR より弱い CF のカードを所持にする
    const recentCf = await ev(`(async () => {
      const ids = [...new Set([...document.querySelectorAll('[data-testid="recently-added-grid"] a[href^="/players/world/"]')].map((a) => a.getAttribute("href").split("/").pop()))];
      const j = await (await fetch("/api/world/players/by-ids?ids=" + ids.slice(0, 200).join(","))).json();
      return (j.players || []).filter((p) => p.registeredPosition === "CF").map((p) => p.ovrMax ?? p.ovrBase).filter((v) => typeof v === "number");
    })()`);
    const weak = await ev(`(async () => (await (await fetch("/api/world/players?pageSize=1&sort=ovr_max_asc&position=CF")).json()).players?.[0]?.worldCardId ?? null)()`);
    await ev(`localStorage.setItem(${JSON.stringify(MY_TEAM_KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: NOW, records: weak ? [myTeamRecord(weak)] : [] }))})`);
    await go(`${BASE}/players/new`);
    await waitFor('[data-testid="new-cards-impact-list"]', 15000);
    const initialRows = await ev(`document.querySelectorAll('[data-testid="new-cards-impact-list"] li').length`);
    record("比較は最初は 5 行まで（すべて表示のボタン）", initialRows <= 5 && (initialRows < 5 || (await has('[data-testid="new-cards-impact-toggle"]'))), `rows=${initialRows}`);
    if (await has('[data-testid="new-cards-impact-toggle"]')) await ev(`document.querySelector('[data-testid="new-cards-impact-toggle"]').click()`);
    await new Promise((r) => setTimeout(r, 300));
    const rows = (await ev(`[...document.querySelectorAll('[data-testid="new-cards-impact-list"] li')].map((li) => li.innerText.replace(/\\s+/g, " "))`)) ?? [];
    const cfRows = rows.filter((r) => /^CF /.test(r));
    record("所持の弱い CF より強い新しい CF が比較に出る（+差・あなたのカード名）", recentCf.length === 0 ? true : cfRows.length > 0 && cfRows.every((r) => /より \+\d+/.test(r)), `${cfRows.length} CF rows / ${rows.length} rows; e.g. ${rows[0] ?? "-"}`);
    record("持っていないポジションは「まだ持っていません」と出る", rows.some((r) => /まだ持っていません/.test(r)), "");

    // スカッドの画面の提案
    if (weak) {
      await ev(`localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, ${JSON.stringify(JSON.stringify([squadFixture("sq_bbnewcards01", weak)]))})`);
      await go(`${BASE}/squads/sq_bbnewcards01`);
      // 提案の欄は画面に近づいたときだけ読む: 開いただけでは要求しないことを確かめてから、欄までスクロールする
      await waitFor('[data-testid="squad-new-cards-sentinel"]', 15000);
      const before = await ev(`performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/world/new-cards")).length`);
      record("スカッド: 新しいカードの一覧の要求は 1 回まで（サイドメニューと共有）", before <= 1, `requests=${before}`);
      await ev(`document.querySelector('[data-testid="squad-new-cards-sentinel"]').scrollIntoView()`);
      await waitFor('[data-testid="squad-new-cards-list"]', 15000);
      const sInitial = await ev(`document.querySelectorAll('[data-testid="squad-new-cards-list"] li').length`);
      record("スカッド: 提案は最初は 5 行まで（すべて表示のボタン）", sInitial <= 5, `rows=${sInitial}`);
      if (await has('[data-testid="squad-new-cards-toggle"]')) await ev(`document.querySelector('[data-testid="squad-new-cards-toggle"]').click()`);
      await new Promise((r) => setTimeout(r, 300));
      const srows = (await ev(`[...document.querySelectorAll('[data-testid="squad-new-cards-list"] li')].map((li) => li.innerText.replace(/\\s+/g, " "))`)) ?? [];
      const cfRow = srows.find((r) => /^CF /.test(r));
      record("スカッド: 弱い CF の枠に「今の選手より +差」の新しいカード", recentCf.length === 0 ? true : !!cfRow && /より \+\d+/.test(cfRow), cfRow ?? `${srows.length} rows`);
      record("スカッド: 空いている枠に提案が出る（空いている枠を先に）", srows.length > 0 && /空いている枠/.test(srows[0]), srows[0] ?? "-");
      const linkOk = await ev(`[...document.querySelectorAll('[data-testid="squad-new-cards-list"] a:not([data-testid="compare-with-owned"])')].every((a) => /^\\/players\\/world\\/\\d+$/.test(a.getAttribute("href")))`);
      record("スカッド: 提案のリンクがカードの詳細へ", !!linkOk, "");
      const hrefs = (await ev(`[...document.querySelectorAll('[data-testid="squad-new-cards-list"] a:not([data-testid="compare-with-owned"])')].map((a) => a.getAttribute("href"))`)) ?? [];
      const cmpHref = await ev(`[...document.querySelectorAll('[data-testid="squad-new-cards-list"] li')].find((li) => /^CF/.test(li.innerText))?.querySelector('[data-testid="compare-with-owned"]')?.getAttribute("href") ?? null`);
      record("スカッド: 今の選手と能力を比べるリンク（新しいカード,今の選手）", recentCf.length === 0 ? true : cmpHref === `/compare?ids=${(cmpHref || "").split("=")[1]?.split(",")[0]},${weak}`, String(cmpHref));
      record("スカッド: 同じカードを 2 つの枠に出さない", hrefs.length > 0 && new Set(hrefs).size === hrefs.length, `${hrefs.length} links`);
      await ev(`localStorage.removeItem(${JSON.stringify(SQUADS_KEY)})`);
    } else record("スカッド: 弱い CF のカードを取得", false, "no CF card");

    // AI ベスト11: 新しいカードを入れたら（My Team は弱い CF だけ → CF の入れ替えと空き枠に新しいカード）
    if (weak) {
      await ev(`localStorage.setItem(${JSON.stringify(MY_TEAM_KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: NOW, records: [myTeamRecord(weak)] }))})`);
      await go(`${BASE}/best-xi`);
      await waitFor('[data-testid="best-xi-new-cards-run"]', 20000);
      const reqBefore = await ev(`performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/world/players/")).length`);
      await ev(`document.querySelector('[data-testid="best-xi-new-cards-run"]').click()`);
      await waitFor('[data-testid="best-xi-new-cards-list"], [data-testid="best-xi-new-cards-no-change"], [data-testid="best-xi-new-cards-none"]', 30000);
      const bxRows = (await ev(`[...document.querySelectorAll('[data-testid="best-xi-new-cards-list"] li')].map((li) => li.innerText.replace(/\\s+/g, " "))`)) ?? [];
      const reqAfter = await ev(`performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/world/players/")).length`);
      const cfRow = bxRows.find((r) => /^CF /.test(r));
      const leaving = (await ev(`document.querySelector('[data-testid="best-xi-new-cards-leaving"]')?.innerText ?? ""`)) || "";
      record("AI ベスト11: 先発に入る新しいカード（CF を含む）と、先発から外れる選手（今の CF）", bxRows.length > 0 && (!recentCf.length || (!!cfRow && /先発から外れる: .+/.test(leaving))), `${cfRow ?? `${bxRows.length} rows`} / ${leaving}`);
      record("AI ベスト11: 新しいカードの詳細の取得は枠のポジションごとに 3 枚まで", reqAfter - reqBefore <= 9 * 3, `requests=${reqAfter - reqBefore}`);
      const bxLinks = (await ev(`[...document.querySelectorAll('[data-testid="best-xi-new-cards-list"] a')].map((a) => a.getAttribute("href"))`)) ?? [];
      record("AI ベスト11: 同じカードを 2 つの枠に入れない", new Set(bxLinks).size === bxLinks.length, `${bxLinks.length} links`);
    }

    // トップ: 新しいカードのうち My Team より強い枚数（My Team は弱い CF だけ）
    if (weak) {
      await ev(`localStorage.setItem(${JSON.stringify(MY_TEAM_KEY)}, ${JSON.stringify(JSON.stringify({ storageVersion: "my-team-storage/2026-08-30.v1", updatedAt: NOW, records: [myTeamRecord(weak)] }))})`);
      await go(`${BASE}/`);
      await waitFor('[data-testid="home-new-cards-upgrade"]', 15000);
      const up = (await ev(`document.querySelector('[data-testid="home-new-cards-upgrade"]')?.innerText ?? ""`)) || "";
      record("トップ: My Team より強い新しいカードの枚数とリンク", recentCf.length === 0 ? true : /\d+ 枚が、あなたの My Team より強い/.test(up), up);
      // My Team: ポジション別のまとめ（13 ポジション・CF は 1 枚・持っていないポジションには探すリンク・2026-10-25）
      await go(`${BASE}/my-team`);
      await waitFor('[data-testid="my-team-position-summary"]', 15000);
      const ps = await ev(`(() => { const lis = [...document.querySelectorAll('[data-testid="my-team-position-summary"] li')]; const cf = lis.find((li) => li.dataset.position === "CF"); const gk = lis.find((li) => li.dataset.position === "GK"); return { n: lis.length, cf: cf?.dataset.count, cfText: cf?.innerText.replace(/\\s+/g, " ") ?? "", gkFind: gk?.querySelector('a[href^="/players?"]')?.getAttribute("href") ?? null }; })()`);
      record("My Team: ポジション別のまとめ（13 行・CF 1 枚と最高のカード・空きは探すリンク）", ps?.n === 13 && ps.cf === "1" && /最高|\d/.test(ps.cfText) && ps.gkFind === "/players?position=GK&sort=ovr_max_desc", `${ps?.n} rows / ${ps?.cfText} / ${ps?.gkFind}`);
      // 選手の一覧: My Team で所持のカードに「所持済み」の印（2026-10-25）
      const weakName = await ev(`(async () => (await (await fetch("/api/world/players/${weak}")).json()).player?.nameEn ?? null)()`);
      if (weakName) {
        await go(`${BASE}/players?q=${encodeURIComponent(weakName)}`);
        await waitFor('[data-testid="card-owned-badge"]', 15000).catch(() => {});
        const owned = (await ev(`[...document.querySelectorAll('[data-testid="card-owned-badge"]')].map((b) => b.closest("div.group")?.querySelector('a[href^="/players/world/"]')?.getAttribute("href").split("/").pop())`)) ?? [];
        record("選手の一覧: 所持のカードだけに「所持済み」の印", owned.length === 1 && owned[0] === weak, `${weakName}: ${owned.join(",")}`);
      } else record("選手の一覧: 所持のカードだけに「所持済み」の印", false, "no name");
      await ev(`localStorage.removeItem(${JSON.stringify(MY_TEAM_KEY)})`);
      await go(`${BASE}/`);
      await new Promise((r) => setTimeout(r, 1500));
      record("トップ: My Team が空なら出さない", !(await has('[data-testid="home-new-cards-upgrade"]')), "");
    }

    // 選手の一覧: 最近 7 日に追加されたカードに「NEW」の印（追加の新しい順で先頭のカード）
    await go(`${BASE}/players?sort=added_desc`);
    const firstNew = await ev(`!!document.querySelector('a[href^="/players/world/"] [data-testid="card-new-badge"]')`);
    const firstHref = await ev(`document.querySelector('a[href^="/players/world/"]')?.getAttribute("href") ?? null`);
    if (firstHref) {
      await go(`${BASE}${firstHref}`);
      const detailNew = await has('[data-testid="detail-new-badge"]');
      const addedText = (await ev(`document.body.innerText`)) || "";
      record("選手の詳細: 新しいカードに NEW と「TeamAIXI に追加」の日付", recentCount === 0 ? true : detailNew && /TeamAIXI に追加\s*\d{4}年\d{1,2}月\d{1,2}日/.test(addedText), firstHref);
    }
    await go(`${BASE}/players?sort=ovr_max_asc`);
    const oldCount = await ev(`document.querySelectorAll('[data-testid="card-new-badge"]').length`);
    record("選手の一覧: 新しいカードに NEW の印（古いカードには出ない）", recentCount === 0 ? true : firstNew === true && oldCount === 0, `first=${firstNew} oldPage=${oldCount}`);

    // 暫定のカード（最大 OVR が無い）は左上の OVR を「BASE」と出す（MAX と誤解させない・2026-10-25）
    await go(`${BASE}/players/new`);
    const provLabel = await ev(`document.querySelector('[data-testid="provisional-cards-grid"] li')?.innerText.replace(/\\s+/g, " ") ?? null`);
    record("暫定のカードの OVR は BASE と表示（最大 OVR が無いとき）", provLabel == null || /BASE/.test(provLabel), (provLabel ?? "no provisional").slice(0, 60));

    // 新しいカード: ポジションで絞る（2026-10-25）。押したポジションのカードだけになり、「すべて」で戻る
    if (await has('[data-testid="new-cards-position-filter"]')) {
      const before = await ev(`document.querySelectorAll('[data-testid="recently-added-grid"] li, [data-testid="provisional-cards-grid"] li').length`);
      const pos = await ev(`document.querySelectorAll('[data-testid="new-cards-position-filter"] button')[1]?.dataset.position ?? null`);
      await ev(`document.querySelector('[data-testid="new-cards-position-filter"] button[data-position="${pos}"]').click()`);
      await new Promise((r) => setTimeout(r, 500));
      const items = (await ev(`[...document.querySelectorAll('[data-testid="recently-added-grid"] li, [data-testid="provisional-cards-grid"] li')].map((li) => li.innerText.split(/\\s+/))`)) ?? [];
      const pressed = await ev(`document.querySelector('[data-testid="new-cards-position-filter"] button[data-position="${pos}"]').getAttribute("aria-pressed")`);
      await ev(`document.querySelector('[data-testid="new-cards-position-filter"] button[data-position="all"]').click()`);
      await new Promise((r) => setTimeout(r, 500));
      const after = await ev(`document.querySelectorAll('[data-testid="recently-added-grid"] li, [data-testid="provisional-cards-grid"] li').length`);
      record("新しいカード: ポジションで絞る（そのポジションだけ・すべてで戻る）", items.length > 0 && items.every((w) => w.includes(pos)) && pressed === "true" && after === before, `${pos}: ${items.length} / all ${before}→${after}`);
    } else record("新しいカード: ポジションで絞る（そのポジションだけ・すべてで戻る）", true, "1 position or fewer");

    // 選手の検索: 暫定のカードも検索で見つかる（2026-10-24）
    const prov = await ev(`(async () => ((await (await fetch("/api/world/new-cards")).json()).cards || []).find((c) => c.provisional && c.nameEn) ?? null)()`);
    if (prov) {
      const word = prov.nameEn.split(" ").slice(-1)[0];
      const api = await ev(`(async () => (await (await fetch("/api/world/players?pageSize=1&query=" + encodeURIComponent(${JSON.stringify(word)}))).json()).provisionalMatches?.map((p) => p.worldCardId) ?? [])()`);
      await go(`${BASE}/players?q=${encodeURIComponent(word)}`);
      const shown = await ev(`[...document.querySelectorAll('[data-testid="provisional-search-results"] a[href^="/players/world/"]')].map((a) => a.getAttribute("href").split("/").pop())`);
      record("選手の検索: 暫定のカードも見つかる（API と一覧の画面）", api.includes(prov.worldCardId) && (shown ?? []).includes(prov.worldCardId), `${word} → api ${api.length} / page ${(shown ?? []).length}`);
    } else record("選手の検索: 暫定のカードも見つかる（API と一覧の画面）", true, "no provisional cards");

    // サイドメニューの「新しいカード」の件数（前回見たあとに追加された枚数）
    const SEEN_KEY = "efootball-team-ai:new-cards-seen:v1";
    await ev(`localStorage.removeItem(${JSON.stringify(SEEN_KEY)})`);
    await go(`${BASE}/`);
    await waitFor('[data-testid="nav-new-cards-badge"]', 15000);
    const badge1 = (await ev(`document.querySelector('[data-testid="nav-new-cards-badge"]')?.textContent ?? ""`)) || "";
    record("未訪問ならサイドメニューに新しいカードの件数が出る", /^(\d+|99\+)$/.test(badge1) && badge1 !== "0", `badge=${badge1}`);
    await go(`${BASE}/players/new`);
    const seen = await ev(`localStorage.getItem(${JSON.stringify(SEEN_KEY)})`);
    const activeNav = await ev(`[...document.querySelectorAll('nav a[aria-current="page"]')].map((a) => a.getAttribute("href"))`);
    record("新しいカードを開くと「見た」になり、メニューは「新しいカード」だけが現在のページ", !!seen && !(await has('[data-testid="nav-new-cards-badge"]')) && activeNav.every((h) => h === "/players/new"), `seen=${seen} active=${JSON.stringify(activeNav)}`);
    await go(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 1500));
    record("見たあとは件数が消える（その後の追加が無い限り）", !(await has('[data-testid="nav-new-cards-badge"]')), "");
    await ev(`localStorage.removeItem(${JSON.stringify(SEEN_KEY)})`);

    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await go(`${BASE}/players/new`);
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("390px で横のはみ出しなし", overflow <= 1, `overflow=${overflow}`);
    record("ページ内で JS の例外が起きない", errors.length === 0, errors.slice(0, 2).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const L = ["# 新しいカードの画面 ブラックボックステスト結果", "", `実行日時: ${new Date().toISOString()}`, `対象: ${BASE}`, "", "| 結果 | 項目 | 詳細 |", "|---|---|---|", ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`), "", `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`, ""];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`\n[black-box-new-cards] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
