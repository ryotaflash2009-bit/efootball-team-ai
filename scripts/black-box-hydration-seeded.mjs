#!/usr/bin/env node
/**
 * 端末に保存したデータがある状態での hydration の black-box（2026-10-09）。npm run build && npm run start の後に
 *   node scripts/black-box-hydration-seeded.mjs
 *   BASE_URL=https://<公開サイト> node scripts/black-box-hydration-seeded.mjs   （読み取りだけ・保存は分離したブラウザーの中だけ）
 *
 * 2026-10-09 に「My Team に入れたカードの詳細で React #418」が本番で見つかった（保存データがあるときだけ起きる）。
 * My Team・お気に入り・保存ビルド・スカッド・ゲームプラン・保存した絞り込みを入れた状態（日本語・英語）で公開の画面を回り、
 * React #418 / #423 / #425（hydration）・JS の例外・console の error が 0 であることを確かめる。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble, stubVercelInsightsOnLocalhost } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const NOW = "2026-10-09T00:00:00.000Z";
const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const HYDRATION = /Minified React error #(418|423|425)|Hydration failed|did not match/;

async function main() {
  const list = await (await fetch(`${BASE}/api/world/players?pageSize=8`)).json();
  const ids = [...new Set(list.players.map((p) => p.worldCardId))].slice(0, 6);
  const mgr = await (await fetch(`${BASE}/api/managers?pageSize=1`)).json();
  const managerId = mgr.managers?.[0]?.internalManagerId ?? mgr.items?.[0]?.internalManagerId ?? null;

  const myTeam = {
    storageVersion: "my-team-storage/2026-08-30.v1",
    updatedAt: NOW,
    records: ids.slice(0, 4).map((id) => ({ localRecordId: `mt_${id}`, teamCardId: `tc_${id}`, worldCardId: id, ownershipStatus: "owned", usageStatus: "unused", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: NOW, updatedAt: NOW, deletedAt: null, source: "local", syncStatus: "local_only" })),
  };
  const builds = Object.fromEntries(
    ids.slice(0, 3).map((id, i) => [
      id,
      [{ buildId: `bh${i}build01`, worldCardId: id, buildName: `H${i}`, progressionAllocation: { shooting: 4, dribbling: 3 }, selectedPlayerBooster: null, conditionalBoosterSelections: [], calculatedStats: {}, calculatedOvr: null, calculationMode: "provisional", rulesVersion: "progression/2026-08-28.v2", costRuleId: "staged-2026-10-08", createdAt: NOW, updatedAt: NOW, schemaVersion: 1 }],
    ]),
  );

  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
  await stubVercelInsightsOnLocalhost(client, BASE);
  let errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? "exception"));
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") errors.push("console: " + (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  });
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const visit = async (path) => {
    errors = [];
    await client.send("Page.navigate", { url: `${BASE}${path}` });
    await waitForCondition(async () => String(await ev("location.href")).startsWith(`${BASE}${path.split("?")[0]}`), { timeoutMs: 10000, intervalMs: 100 });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 15000, intervalMs: 100 });
    await new Promise((r) => setTimeout(r, 2500));
    return errors.slice();
  };

  try {
    await visit("/");
    // 端末の保存データ（分離したブラウザーの中だけ）
    await ev(`localStorage.setItem("efootball-team-ai:local:guest:my-team:v1", ${JSON.stringify(JSON.stringify(myTeam))})`);
    await ev(`localStorage.setItem("efootball-team-ai:local:guest:favorites:v1", ${JSON.stringify(JSON.stringify({ storageVersion: "favorites-storage/2026-08-30.v1", updatedAt: NOW, records: ids.slice(2, 5).map((id) => ({ localRecordId: `fav_${id}`, worldCardId: id, note: "", tags: [], addedAt: NOW, updatedAt: NOW, source: "local", syncStatus: "local_only" })) }))})`);
    await ev(`localStorage.setItem("efootball-team-ai:local:guest:progression-builds:v1", ${JSON.stringify(JSON.stringify(builds))})`);
    await ev(`localStorage.setItem("efootball-team-ai:local:guest:saved-player-filters:v1", ${JSON.stringify(JSON.stringify({ schema: "saved-player-filters/2026-10-09.v1", items: [{ id: "sf_hydra01", name: "CF", query: "position=CF", createdAt: NOW }] }))})`);

    // 保存データが画面に反映されていること（反映されていなければ、この確認は意味が無い）
    await visit("/my-team");
    record("準備: My Team に 4 枚が出る", (await ev(`document.querySelectorAll("main a[href^='/players/world/']").length`)) >= 4);
    await visit("/favorites");
    record("準備: お気に入りに 3 枚が出る", (await ev(`document.querySelectorAll("main a[href^='/players/world/']").length`)) >= 3);
    await visit(`/players/world/${ids[0]}`);
    record("準備: 選手の詳細で My Team 登録済みが出る", /My Team 登録済み|In My Team/.test(await ev(`document.querySelector("main")?.innerText ?? ""`)));

    const pages = [
      "/", "/players", "/players?position=CF", `/players/world/${ids[0]}`, `/players/world/${ids[0]}?tab=progression`, `/players/world/${ids[3]}?tab=stats`, `/players/world/${ids[5]}`,
      "/managers", ...(managerId ? [`/managers/${managerId}`] : []), "/compare", `/compare?ids=${ids[0]},${ids[1]}`, "/squads", "/squads/templates", "/best-xi", "/boosters",
      "/my-team", "/my-builds", "/favorites", "/build-inventory", "/diagnosis-history", "/data-management", "/about", "/support",
    ];
    for (const locale of ["ja", "en"]) {
      await ev(`localStorage.setItem("efootball-team-ai:locale:v1", "${locale}")`);
      for (const vp of [{ name: "desktop", w: 1280, h: 900, m: false }, { name: "mobile", w: 390, h: 844, m: true }]) {
        await client.send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: vp.m ? 2 : 1, mobile: vp.m });
        for (const p of pages) {
          const errs = await visit(p);
          const hydration = errs.filter((e) => HYDRATION.test(e));
          record(`[${locale} ${vp.name}] ${p} hydration 0・例外 0・console error 0`, errs.length === 0, [...hydration, ...errs].slice(0, 2).join(" | ").slice(0, 220));
        }
      }
    }
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
