#!/usr/bin/env node
/**
 * ゲームプランの欄（2026-10-07）の black-box。npm run build && npm run start の後に
 *   node scripts/black-box-game-plan.mjs
 * - 分離したヘッドレス Chrome（一時のプロファイル）。実際の利用者の保存データには触れない。
 * - アプリの作成の流れでスカッドを作り、先発 2 人・控え 2 人を入れてから、ゲームプランの欄を操作する。
 * - 確認: 保存（別のキー・スカッドの形は変わらない）・再読み込みでの復元・問題の表示・書き出し・読み込み・
 *   スカッドの削除で消えること・英語の表示・390px で横のはみ出しなし・JS の例外なし。
 */
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, waitForCondition, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const SQUADS_KEY = "efootball-team-ai:local:guest:squads:v1";
const PLANS_KEY = "efootball-team-ai:local:guest:game-plans:v1";
const LOCALE_KEY = "efootball-team-ai:locale:v1";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const players = await (await fetch(`${BASE}/api/world/players?limit=8`)).json();
  const ids = [...new Set(players.players.map((p) => p.worldCardId))].slice(0, 4);
  if (ids.length < 4) throw new Error("World のカードを 4 枚取得できない");

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
    await waitForCondition(async () => (await ev("document.readyState")) === "complete", { timeoutMs: 10000, intervalMs: 100 });
  };
  const click = (text) => ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  const plans = () => ev(`JSON.parse(localStorage.getItem(${JSON.stringify(PLANS_KEY)}) || "null")`);
  const panelOpen = async () => {
    await waitForCondition(async () => (await ev(`!!document.querySelector('[data-testid="game-plan"]')`)) === true, { timeoutMs: 10000, intervalMs: 150 });
    await ev(`document.querySelector('[data-testid="game-plan"]').open = true`);
    await sleep(150);
  };
  /** 欄の中の n 番目の select の値を変える（React の onChange を起こす）。 */
  const setSelect = (labelText, value, nth = 0) =>
    ev(`(() => { const box = document.querySelector('[data-testid="game-plan"]');
      const labels = [...box.querySelectorAll("label")].filter((l) => l.querySelector("span")?.textContent.trim() === ${JSON.stringify(labelText)});
      const sel = labels[${nth}]?.querySelector("select"); if (!sel) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, ${JSON.stringify(value)});
      sel.dispatchEvent(new Event("change", { bubbles: true })); return sel.value; })()`);

  try {
    // 準備: アプリの作成の流れでスカッドを作り、先発 2 人（LWF・CF）と控え 2 人を入れる。
    await nav(`${BASE}/squads`);
    await waitForCondition(async () => (await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "作成して編集"); return !!b && !b.disabled; })()`)) === true, { timeoutMs: 10000, intervalMs: 150 });
    await click("作成して編集");
    await waitForCondition(async () => /\/squads\/sq_/.test(await ev("location.pathname")), { timeoutMs: 10000, intervalMs: 150 });
    const squadPath = await ev("location.pathname");
    const squadId = squadPath.split("/").pop();
    await waitForCondition(async () => (await ev(`(JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)}) || "[]")).length`)) > 0, { timeoutMs: 8000, intervalMs: 150 });
    const seeded = await ev(`(() => { const all = JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)})); const sq = all.find((s) => s.squadId === ${JSON.stringify(squadId)});
      const ids = ${JSON.stringify(ids)};
      sq.slots = sq.slots.map((s) => s.slotId === "lwf" ? { ...s, worldCardId: ids[0] } : s.slotId === "cf" ? { ...s, worldCardId: ids[1] } : s);
      sq.substitutes = [{ subId: "subA00000001", worldCardId: ids[2], buildMode: "none", savedBuildId: null }, { subId: "subB00000002", worldCardId: ids[3], buildMode: "none", savedBuildId: null }];
      localStorage.setItem(${JSON.stringify(SQUADS_KEY)}, JSON.stringify(all)); return true; })()`);
    record("準備: スカッドを作り、先発 2 人・控え 2 人を入れる", seeded === true, squadId);
    await nav(`${BASE}${squadPath}`);
    await panelOpen();
    const squadBefore = await ev(`JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)})).find((s) => s.squadId === ${JSON.stringify(squadId)}).slots)`);

    // チームの指示
    await setSelect("守備のライン", "high");
    await setSelect("プレスの強さ", "low");
    await sleep(200);
    let p = (await plans())?.plans?.[squadId];
    record("チームの指示: 選ぶとすぐ別のキーへ保存される", p?.instructions?.defensiveLine === "high" && p?.instructions?.pressing === "low", JSON.stringify(p?.instructions));

    // 交代: 控えの選手が出るまで待ってから追加
    await waitForCondition(async () => (await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "交代を追加"); return !!b && !b.disabled; })()`)) === true, { timeoutMs: 10000, intervalMs: 150 });
    await click("交代を追加");
    await click("交代を追加");
    await sleep(250);
    p = (await plans())?.plans?.[squadId];
    record("交代を 2 件追加できる（先発の枠・控えの選手）", p?.substitutions?.length === 2 && ids.slice(2).includes(p.substitutions[0].inWorldCardId), JSON.stringify(p?.substitutions?.map((s) => [s.outSlotId, s.inWorldCardId])));
    // 2 件とも同じ枠を下げる → 問題の表示
    await setSelect("下げる選手", "lwf", 0);
    await setSelect("下げる選手", "lwf", 1);
    await sleep(250);
    const issues = await ev(`document.querySelector('[data-testid="game-plan-issues"]')?.innerText ?? ""`);
    record("同じ枠を 2 回下げると「確認が必要な点」に出る（保存は止めない）", /同じ枠を 2 回下げています/.test(issues), issues.split("\n")[1] ?? "");

    // 代わりの計画: 同じではないフォーメーションだけが選べる
    const altOptions = await ev(`(() => { const box = document.querySelector('[data-testid="game-plan"]'); const l = [...box.querySelectorAll("label")].find((x) => x.querySelector("span")?.textContent.trim() === "切り替えるフォーメーション"); return [...l.querySelectorAll("option")].map((o) => o.value); })()`);
    record("代わりの計画: 今のフォーメーション（4-3-3）は選択肢に無い", !altOptions.includes("4-3-3") && altOptions.includes("4-4-2"), altOptions.join(","));
    await setSelect("切り替えるフォーメーション", "4-4-2");
    await setSelect("切り替える場面", "losing");

    // 相手ごとの計画
    await click("相手を追加");
    await sleep(150);
    await ev(`(() => { const box = document.querySelector('[data-testid="game-plan"]'); const l = [...box.querySelectorAll("label")].find((x) => x.textContent.includes("最終ラインを下げる")); l.querySelector("input").click(); return true; })()`);
    await sleep(250);
    p = (await plans())?.plans?.[squadId];
    record("相手ごとの計画と調整が保存される", p?.opponents?.length === 1 && p.opponents[0].adjustments.includes("deeper_defensive_line") && p.alternative.formationId === "4-4-2", JSON.stringify(p?.opponents?.[0]));

    // スカッドの形は変わらない
    const squadAfter = await ev(`JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)})).find((s) => s.squadId === ${JSON.stringify(squadId)}).slots)`);
    record("スカッドの保存の形（先発の枠）は変わらない", squadAfter === squadBefore);

    // 再読み込みで復元
    await nav(`${BASE}${squadPath}`);
    await panelOpen();
    const restored = await ev(`(() => { const box = document.querySelector('[data-testid="game-plan"]'); const l = [...box.querySelectorAll("label")].find((x) => x.querySelector("span")?.textContent.trim() === "守備のライン"); return l.querySelector("select").value; })()`);
    record("再読み込みで欄に復元される", restored === "high", restored);

    // 書き出しの形（画面の関数と同じ書き出しをページの中で作って読み込む）
    const exported = await ev(`(async () => { const s = JSON.parse(localStorage.getItem(${JSON.stringify(PLANS_KEY)})).plans[${JSON.stringify(squadId)}]; const { squadId: _x, ...rest } = s;
      return JSON.stringify({ schema: "game-plan-export/2026-10-07.v1", formationId: "4-3-3", plan: { ...rest, instructions: { ...rest.instructions, pressing: "high" } } }); })()`);
    record("書き出しの形にスカッドの ID を含まない", !exported.includes(squadId));
    await ev(`(() => { const input = document.querySelector('[data-testid="game-plan-import"]'); const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(exported)}], "plan.json", { type: "application/json" })); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
    await waitForCondition(async () => ((await plans())?.plans?.[squadId]?.instructions?.pressing) === "high", { timeoutMs: 5000, intervalMs: 150 }).catch(() => {});
    const imported = (await plans())?.plans?.[squadId];
    const importMsg = await ev(`document.querySelector('[data-testid="game-plan"] [role="status"][aria-live]')?.textContent ?? ""`);
    record("読み込み: 内容が反映され、案内が出る", imported?.instructions?.pressing === "high" && importMsg.includes("読み込みました"), importMsg);
    await ev(`(() => { const input = document.querySelector('[data-testid="game-plan-import"]'); const dt = new DataTransfer(); dt.items.add(new File(["{broken"], "bad.json", { type: "application/json" })); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
    await sleep(400);
    const badMsg = await ev(`document.querySelector('[data-testid="game-plan"] [role="status"][aria-live]')?.textContent ?? ""`);
    record("壊れたファイルは読み込まず、案内だけ（保存の内容は変わらない）", badMsg.includes("読み込めませんでした") && (await plans())?.plans?.[squadId]?.instructions?.pressing === "high", badMsg);

    // 共有画像（2026-10-09）: 端末へ保存する流れ（リンクの click を記録して、PNG の中身を確かめる）。
    const planBeforeImage = JSON.stringify((await plans())?.plans?.[squadId]);
    await ev(`(() => { window.__gpDl = null; window.__gpBlob = null; const oc = URL.createObjectURL; URL.createObjectURL = function (o) { if (o instanceof Blob && o.type === "image/png") window.__gpBlob = o; return oc.call(URL, o); }; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__gpDl = { name: this.download }; else orig.call(this); }; return true; })()`);
    await ev(`document.querySelector('[data-testid="game-plan-image"]').click()`);
    await waitForCondition(async () => !!(await ev("window.__gpDl")), { timeoutMs: 10000, intervalMs: 150 }).catch(() => {});
    const dl = await ev(`(async () => { const d = window.__gpDl; if (!d || !window.__gpBlob) return null; const b = await window.__gpBlob.arrayBuffer(); const u = new Uint8Array(b);
      const png = u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47; const dv = new DataView(b); return { name: d.name, bytes: b.byteLength, png, w: dv.getUint32(16), h: dv.getUint32(20) }; })()`);
    if (process.env.BB_SAVE_IMAGE) {
      const b64 = await ev(`(async () => { const b = new Uint8Array(await window.__gpBlob.arrayBuffer()); let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); })()`);
      (await import("node:fs")).writeFileSync(process.env.BB_SAVE_IMAGE, Buffer.from(b64, "base64"));
    }
    const imgMsg = await ev(`document.querySelector('[data-testid="game-plan"] [role="status"][aria-live]')?.textContent ?? ""`);
    record("共有画像: PNG（1080×1440）を保存し、案内が出る", dl?.png === true && dl.w === 1080 && dl.h === 1440 && dl.bytes > 10000 && /画像を保存しました/.test(imgMsg), dl ? `${dl.name} ${dl.bytes}B ${dl.w}x${dl.h}` : "no download");
    record("共有画像: ファイル名にスカッドの ID・名前を含まない", !!dl && !dl.name.includes(squadId) && /^efootball-team-ai-game-plan-4-3-3-\d{4}-\d{2}-\d{2}\.png$/.test(dl.name), dl?.name);
    record("共有画像: 保存の内容を変えない", JSON.stringify((await plans())?.plans?.[squadId]) === planBeforeImage);

    // 英語の表示
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "en")`);
    await nav(`${BASE}${squadPath}`);
    await panelOpen();
    const enText = await ev(`document.querySelector('[data-testid="game-plan"]').innerText`);
    record("英語: 欄の見出しと項目が英語", /Game plan/.test(enText) && /Substitution plan/.test(enText) && !/[ぁ-ん]/.test(enText.replace(/選手 \d+/g, "")), enText.split("\n")[0]);
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);

    // 390px
    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await nav(`${BASE}${squadPath}`);
    await panelOpen();
    const overflow = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    record("390px: ゲームプランの欄を開いても横のはみ出しなし", overflow <= 1, `overflow ${overflow}px`);
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

    // スカッドの削除でゲームプランも消える（アプリの関数を使う: 一覧の削除の操作と同じ deleteSquad）
    await nav(`${BASE}/squads`);
    await sleep(800);
    const delOk = await ev(`(async () => { const all = JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)})); return all.some((s) => s.squadId === ${JSON.stringify(squadId)}); })()`);
    const deleteButtons = await ev(`[...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "削除").length`);
    if (delOk && deleteButtons > 0) {
      await ev(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "削除").click()`);
      await sleep(300);
      await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /^(削除する|削除を確定)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`);
      await waitForCondition(async () => !(await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)}) || "[]").some((s) => s.squadId === ${JSON.stringify(squadId)})`)), { timeoutMs: 5000, intervalMs: 150 }).catch(() => {});
    }
    const squadGone = !(await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(SQUADS_KEY)}) || "[]").some((s) => s.squadId === ${JSON.stringify(squadId)})`));
    const planGone = !((await plans())?.plans ?? {})[squadId];
    record("スカッドを削除すると、そのゲームプランも消える", squadGone && planGone, `squadGone=${squadGone} planGone=${planGone}`);

    record("ページ内で JS の例外なし", errors.length === 0, errors.slice(0, 3).join(" / "));
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n[black-box-game-plan] ${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
