#!/usr/bin/env node
/**
 * F-045 スカッドの事実（集計）の black-box（2026-10-09）。npm run build && npm run start の後に
 *   node scripts/black-box-diagnosis-facts.mjs
 * - 分離したヘッドレス Chrome（一時のプロファイル）。実際の利用者の保存データには触れない。
 * - アプリの作成の流れでスカッドを作り、先発 11 人・控え 2 人を入れてから、診断の下の「スカッドの事実」を確かめる。
 * - 確認: 6 観点だけ・値は数か「計算しない」・折りたたみの外・暫定の比較は既定で閉じたまま・総合評価の値が変わらない
 *   （再読み込みで同じ）・英語の表示・390px で横のはみ出しなし・JS の例外なし・保存データを書き換えない。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const SQUADS_KEY = "efootball-team-ai:local:guest:squads:v1";
const LOCALE_KEY = "efootball-team-ai:locale:v1";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function main() {
  const players = await (await fetch(`${BASE}/api/world/players?limit=40`)).json();
  const ids = [...new Set(players.players.map((p) => p.worldCardId))].slice(0, 13);
  if (ids.length < 13) throw new Error("World のカードを 13 枚取得できない");

  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await installSupabaseAuthTestDouble(client);
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const errors = [];
  client.on("Runtime.exceptionThrown", (p) => errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? p.exceptionDetails?.text ?? "exception"));
  const ev = async (expression) => {
    const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r?.result?.value;
  };
  const nav = async (url) => {
    await client.send("Page.navigate", { url });
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 15000, intervalMs: 100 });
  };
  const click = (text) => ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  const facts = () =>
    ev(`(() => { const s = document.querySelector('[data-testid="diagnosis-perspective-facts"]'); if (!s) return null;
      return { inDetails: !!s.closest("details"), title: s.querySelector("h3")?.textContent ?? "", rows: [...s.querySelectorAll("dl > div")].map((d) => ({ label: d.querySelector("dt")?.textContent ?? "", value: d.querySelector("dd")?.textContent ?? "" })),
        note: s.querySelector("p")?.textContent ?? "", detailsOpen: document.querySelector('[data-testid="diagnosis-perspectives"]')?.open ?? null }; })()`);

  try {
    await nav(`${BASE}/squads`);
    await waitForCondition(async () => (await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "作成して編集"); return !!b && !b.disabled; })()`)) === true, { timeoutMs: 15000, intervalMs: 150 });
    await click("作成して編集");
    await waitForCondition(async () => /\/squads\/sq_/.test(await ev("location.pathname")), { timeoutMs: 15000, intervalMs: 150 });
    const squadPath = await ev("location.pathname");
    const squadId = squadPath.split("/").pop();
    await waitForCondition(async () => (await ev(`(JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)}) || "[]")).length`)) > 0, { timeoutMs: 8000, intervalMs: 150 });
    const seeded = await ev(`(() => { const all = JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)})); const sq = all.find((s) => s.squadId === ${JSON.stringify(squadId)});
      const ids = ${JSON.stringify(ids)};
      sq.slots = sq.slots.map((s, i) => ({ ...s, worldCardId: ids[i] ?? null }));
      sq.substitutes = [{ subId: "subA00000001", worldCardId: ids[11], buildMode: "none", savedBuildId: null }, { subId: "subB00000002", worldCardId: ids[12], buildMode: "none", savedBuildId: null }];
      localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, JSON.stringify(all)); return sq.slots.filter((s) => s.worldCardId).length; })()`);
    record("準備: 先発 11 人・控え 2 人のスカッド", seeded === 11, `先発 ${seeded}`);

    await nav(`${BASE}${squadPath}`);
    const stable = async () => {
      await waitForCondition(async () => (await facts()) !== null, { timeoutMs: 20000, intervalMs: 200 });
      let prev = "";
      for (let i = 0; i < 40; i++) {
        const cur = JSON.stringify(await facts());
        if (cur === prev && !/計算しない|Not computed/.test(cur)) break;
        prev = cur;
        await new Promise((r) => setTimeout(r, 500));
      }
      return facts();
    };
    const f = await stable();
    const stored = await ev(`localStorage.getItem(${JSON.stringify(SQUADS_KEY)})`);
    record("スカッドの事実が診断の下に出る（折りたたみの外）", f && f.inDetails === false, f?.title);
    record("6 観点だけ（監督との相性・空中戦（身長）は出さない）", f?.rows.length === 6 && !f.rows.some((r) => /監督|身長/.test(r.label)), f?.rows.map((r) => r.label.split("（")[0]).join(" / "));
    record("値は数か「計算しない」（NaN・undefined なし）", f?.rows.every((r) => /^(-?\d+(\.\d+)?\S*|計算しない)$/.test(r.value.trim())), f?.rows.map((r) => r.value).join(" / "));
    record("点数・総合評価に入れない旨の説明", /総合評価/.test(f?.note ?? ""), f?.note.slice(0, 40));
    record("暫定の比較は既定で閉じたまま", f?.detailsOpen === false);
    const scoreBefore = await ev(`[...document.querySelectorAll("p")].find((p) => p.textContent.trim() === "総合評価")?.parentElement?.textContent ?? null`);
    await nav(`${BASE}${squadPath}`);
    const f2 = await stable();
    const scoreAfter = await ev(`[...document.querySelectorAll("p")].find((p) => p.textContent.trim() === "総合評価")?.parentElement?.textContent ?? null`);
    record("再読み込みで同じ値（決定的）", JSON.stringify(f2?.rows) === JSON.stringify(f?.rows));
    record("総合評価は再読み込みで変わらない", scoreBefore !== null && scoreBefore === scoreAfter, `${scoreBefore} / ${scoreAfter}`);
    record("保存データを書き換えない", (await ev(`localStorage.getItem(${JSON.stringify(SQUADS_KEY)})`)) === stored);

    // 改善シミュレーション: フォーメーションの変更（2026-10-09）
    const t0 = Date.now();
    await ev(`(() => { const d = document.querySelector('[data-testid="improvement-simulation"]'); d.open = true; d.dispatchEvent(new Event("toggle")); return true; })()`);
    await waitForCondition(async () => (await ev(`!!document.querySelector('[data-testid="improvement-simulation"]')?.innerText.includes("フォーメーションを変えた場合")`)) === true, { timeoutMs: 10000, intervalMs: 100 });
    await new Promise((r) => setTimeout(r, 300));
    const fsim = await ev(`(() => { const box = document.querySelector('[data-testid="improvement-simulation"]'); const items = [...box.querySelectorAll('[data-testid="formation-simulation"] li')];
      return { text: box.innerText, items: items.map((li) => ({ f: li.dataset.formation, text: li.innerText })) }; })()`);
    const ms = Date.now() - t0;
    const deltasOk = fsim.items.every((it) => /総合 \+\d/.test(it.text) || /\+\d/.test(it.text));
    record("フォーメーションの変更: 見出しと、候補（最大 3 件・総合が上がるものだけ）または「ありません」", /フォーメーションを変えた場合/.test(fsim.text) && fsim.items.length <= 3 && (fsim.items.length > 0 ? deltasOk : /総合が上がるフォーメーションの変更はありません/.test(fsim.text)), fsim.items.map((i) => i.f).join(",") || "none");
    record("フォーメーションの変更: 今のフォーメーションは候補に出ない・重複なし", !fsim.items.some((i) => i.f === "4-3-3") && new Set(fsim.items.map((i) => i.f)).size === fsim.items.length);
    record("フォーメーションの変更: 開いてから表示まで 3 秒以内", ms < 3000, `${ms} ms`);
    record("フォーメーションの変更: 保存データを書き換えない", (await ev(`localStorage.getItem(${JSON.stringify(SQUADS_KEY)})`)) === stored);

    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await nav(`${BASE}${squadPath}`);
    await waitForCondition(async () => (await facts()) !== null, { timeoutMs: 20000, intervalMs: 200 });
    record("390px で横のはみ出しなし", (await ev("document.documentElement.scrollWidth <= window.innerWidth + 1")) === true, String(await ev("document.documentElement.scrollWidth")));

    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "en")`);
    await nav(`${BASE}${squadPath}`);
    await waitForCondition(async () => (await facts())?.title === "Squad facts (counts)", { timeoutMs: 20000, intervalMs: 200 });
    const fe = await facts();
    record("英語の表示", fe?.title === "Squad facts (counts)" && /overall rating/.test(fe.note), fe?.title);
    record("JS の例外なし", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    client.close?.();
    await closeTab(browser.port, tab.id).catch(() => {});
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
