/**
 * F-084 写真付き投稿（ローカル試作）と F-056 安全機能（モック）のブラックボックス。ローカル専用。
 *
 *   NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled で build・start した localhost に対して:
 *   BASE_URL=http://localhost:3000 node scripts/black-box-local-posts.mjs
 *
 * - テスト画像はブラウザー内で作る（iPhone 相当の縦 3024×4032 の JPEG に、GPS を含む EXIF を差し込んだもの）。
 *   偽装ファイル（.png の名前の SVG・.jpg の名前の実行形式・GIF）も作る。実在の写真・個人の情報は使わない。
 * - 保存先は隔離ブラウザーの IndexedDB / localStorage だけ。サーバー・Production へは送らない（通信も確認する）。
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";
import { escapeMarkdownCell } from "../src/lib/testing/markdown-table.ts";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error("local only: BASE_URL must be http://localhost:<port>");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "local-posts.md");
const WORK = path.join(ROOT, "data", "work", "bb-local-posts");
const ROUTE = "/community/local-posts";
const VIEWPORTS = [
  { name: "desktop-1280x720", width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
  { name: "tablet-768x1024", width: 768, height: 1024, deviceScaleFactor: 2, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, deviceScaleFactor: 2, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-393x852", width: 393, height: 852, deviceScaleFactor: 3, mobile: true },
  { name: "mobile-430x932", width: 430, height: 932, deviceScaleFactor: 3, mobile: true },
];
const LOCALE_KEY = "efootball-team-ai:locale:v1";

let client;
let errors = [];
let offOrigin = [];
let writes = [];
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description?.slice(0, 200) ?? r.exceptionDetails.text}`);
  return r.result.value;
}
async function waitFor(fn, ms, label) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (await fn()) return;
    } catch {
      /* 遷移中 */
    }
    await sleep(100);
  }
  throw new Error(`timeout: ${label}`);
}
async function nav(route) {
  await client.send("Page.navigate", { url: `${BASE}${route}` });
  await waitFor(async () => (await ev("document.readyState")) === "complete", 30000, `load ${route}`);
  await sleep(900);
}
const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? ''`);
async function setFile(selector, file) {
  const { root } = await client.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  await client.send("DOM.setFileInputFiles", { nodeId, files: [file] });
}
/** IndexedDB の中身（投稿の数・画像の数・画像の先頭と GPS の文字列の有無）。 */
const DB_STATE = `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("efootball-team-ai-local-posts", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (store) => new Promise((res) => { const t = db.transaction(store, "readonly").objectStore(store).getAll(); t.onsuccess = () => res(t.result); });
  const posts = await all("posts"); const images = await all("images");
  const info = [];
  for (const im of images) { const buf = new Uint8Array(await im.blob.arrayBuffer()); let s = ""; for (let i = 0; i < Math.min(buf.length, 400000); i++) s += String.fromCharCode(buf[i]); info.push({ size: buf.length, head: s.slice(0, 4) + "/" + s.slice(8, 12), gps: s.includes("GPS-LAT"), exif: s.includes("Exif") }); }
  db.close();
  return { posts: posts.map((p) => ({ status: p.status, image: !!p.image, body: p.body, published: p.publishedRemotely, w: p.image && p.image.width, h: p.image && p.image.height })), images: info };
})()`;

async function step(vp, locale, op, fn) {
  errors = [];
  offOrigin = [];
  writes = [];
  let res;
  try {
    res = await fn();
  } catch (e) {
    res = { ok: false, detail: e.message };
  }
  const problems = [];
  if (!res.ok) problems.push(res.detail || "check failed");
  try {
    const overflow = await ev("document.documentElement.scrollWidth - window.innerWidth");
    if (overflow > 0) problems.push(`horizontal overflow ${overflow}px`);
  } catch {
    /* 遷移中 */
  }
  if (errors.length) problems.push(`console/exception: ${errors[0]}`);
  if (offOrigin.length) problems.push(`off-origin request: ${offOrigin[0]}`);
  if (writes.length) problems.push(`non-GET request: ${writes[0]}`);
  const row = { viewport: vp.name, locale, op, ok: problems.length === 0, detail: problems.length ? problems.join(" ; ") : res.detail || "" };
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"}  [${vp.name} ${locale}] ${op}${row.detail ? `  — ${row.detail}` : ""}`);
}

async function makeFiles() {
  // ブラウザーで JPEG を作り、GPS を含む EXIF（APP1）を SOI の直後へ差し込む。
  const b64 = await ev(`(async () => {
    const c = document.createElement("canvas"); c.width = 3024; c.height = 4032;
    const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 3024, 4032); g.addColorStop(0, "#1a7f37"); g.addColorStop(1, "#0b3d91"); x.fillStyle = g; x.fillRect(0, 0, 3024, 4032);
    x.fillStyle = "#fff"; x.font = "200px sans-serif"; x.fillText("TOP", 1200, 400);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
    const buf = new Uint8Array(await blob.arrayBuffer());
    const exif = new TextEncoder().encode("Exif\\0\\0GPS-LAT-35.6812-LON-139.7671-DEVICE-TESTPHONE");
    const seg = new Uint8Array(4 + exif.length); seg[0] = 0xff; seg[1] = 0xe1; seg[2] = ((exif.length + 2) >> 8) & 255; seg[3] = (exif.length + 2) & 255; seg.set(exif, 4);
    const out = new Uint8Array(buf.length + seg.length); out.set(buf.subarray(0, 2), 0); out.set(seg, 2); out.set(buf.subarray(2), 2 + seg.length);
    let s = ""; for (const b of out) s += String.fromCharCode(b); return btoa(s);
  })()`);
  const files = {
    photo: path.join(WORK, "iphone-portrait-with-gps.jpg"),
    svg: path.join(WORK, "looks-like.png"),
    exe: path.join(WORK, "program.jpg"),
    gif: path.join(WORK, "anim.gif"),
  };
  writeFileSync(files.photo, Buffer.from(b64, "base64"));
  writeFileSync(files.svg, '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');
  writeFileSync(files.exe, Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200)]));
  writeFileSync(files.gif, Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(200)]));
  return files;
}

async function main() {
  if (existsSync(WORK)) for (const f of readdirSync(WORK)) rmSync(path.join(WORK, f));
  mkdirSync(WORK, { recursive: true });
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  for (const d of ["Page", "Runtime", "DOM", "Network", "Log"]) await client.send(`${d}.enable`);
  await installSupabaseAuthTestDouble(client);
  client.on("Runtime.exceptionThrown", (p) => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 200)));
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") errors.push((p.args ?? []).map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  });
  client.on("Network.requestWillBeSent", (p) => {
    const url = p.request?.url ?? "";
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (!url.startsWith(BASE)) offOrigin.push(url.split("?")[0]);
    else if (p.request.method !== "GET" && p.request.method !== "HEAD") writes.push(`${p.request.method} ${new URL(url).pathname}`);
  });

  try {
    await nav("/");
    const files = await makeFiles();
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      for (const locale of ["ja", "en"]) {
        await nav("/");
        await ev(`localStorage.clear(); localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)}); indexedDB.deleteDatabase("efootball-team-ai-local-posts")`);
        await sleep(300);

        await step(vp, locale, "page: local-only banner, camera and library inputs, visibility marked as mock", async () => {
          await nav(ROUTE);
          await waitFor(() => has("[data-testid=post-composer]"), 10000, "composer");
          const camera = await ev(`document.querySelector('[data-testid=post-camera]').getAttribute('capture')`);
          const small = await ev(`[...document.querySelectorAll('[data-testid=post-composer] button, [data-testid=post-composer] label')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 36).length`);
          const banner = await has("[data-testid=local-posts-banner]");
          return { ok: banner && camera === "environment" && small === 0, detail: `capture=${camera}` };
        });

        if (vp.name !== "desktop-1280x720" && vp.name !== "mobile-390x844") continue;

        await step(vp, locale, "photo: GPS/EXIF removed, re-encoded, portrait kept, rotate, post, reload, delete", async () => {
          await nav(ROUTE);
          await waitFor(() => has("[data-testid=post-library]"), 10000, "input");
          await setFile("[data-testid=post-library]", files.photo);
          await waitFor(() => has("[data-testid=post-preview] img"), 20000, "preview");
          const w = Number(await ev(`document.querySelector('[data-testid=post-preview] img').dataset.width`));
          const h = Number(await ev(`document.querySelector('[data-testid=post-preview] img').dataset.height`));
          if (!(w === 1536 && h === 2048)) throw new Error(`portrait size ${w}x${h}`);
          if (!(await has("[data-testid=post-privacy-note]"))) throw new Error("privacy note missing");
          await ev(`document.querySelector('[data-testid=post-rotate-right]').click()`);
          await waitFor(async () => Number(await ev(`document.querySelector('[data-testid=post-preview] img')?.dataset.width ?? 0`)) === 2048, 20000, "rotated");
          await ev(`document.querySelector('[data-testid=post-rotate-right]').click()`);
          await ev(`document.querySelector('[data-testid=post-rotate-right]').click()`);
          await ev(`document.querySelector('[data-testid=post-rotate-right]').click()`);
          await waitFor(async () => Number(await ev(`document.querySelector('[data-testid=post-preview] img')?.dataset.width ?? 0`)) === 1536, 20000, "rotated back");
          await ev(`(() => { const t = document.querySelector('[data-testid=post-body]'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'BB test post'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
          await ev(`document.querySelector('[data-visibility=public]').click()`);
          // 二重投稿の防止: 2 回続けて押しても 1 件だけ
          await ev(`(() => { const b = document.querySelector('[data-testid=post-submit]'); b.click(); b.click(); })()`);
          await waitFor(async () => (await count("[data-testid=my-post]")) >= 1, 15000, "posted");
          await sleep(800);
          const db = await ev(DB_STATE);
          if (db.posts.filter((p) => p.status === "posted").length !== 1) throw new Error(`posts ${JSON.stringify(db.posts)}`);
          const im = db.images[0];
          if (!im || im.gps || im.exif || !/^(RIFF\/WEBP|\xff\xd8)/.test(im.head)) throw new Error(`image ${JSON.stringify(im)}`);
          if (db.posts[0].published !== false) throw new Error("published flag");
          await nav(ROUTE);
          await waitFor(() => has("[data-testid=my-post-image]"), 10000, "persisted after reload");
          await ev(`document.querySelector('[data-testid=my-post-image]').closest('button').click()`);
          await waitFor(() => has("[data-testid=my-post-zoom]"), 3000, "zoom");
          await ev(`document.querySelector('[data-testid=my-post-zoom]').click()`);
          await ev(`document.querySelector('[data-testid=my-post-delete]').click()`);
          await ev(`document.querySelector('[data-testid=my-post-delete-confirm]').click()`);
          await waitFor(async () => (await count("[data-testid=my-post]")) === 0, 10000, "deleted");
          const after = await ev(DB_STATE);
          return { ok: after.images.length === 0 && after.posts.every((p) => p.status === "deleted" && p.body === "" && !p.image), detail: `stored ${im.head.startsWith("RIFF") ? "WebP" : "JPEG"} ${Math.round(im.size / 1024)}KB, no GPS/EXIF` };
        });

        await step(vp, locale, "disguised files rejected (SVG as .png, executable as .jpg, GIF); nothing stored", async () => {
          await nav(ROUTE);
          const msgs = [];
          for (const f of [files.svg, files.exe, files.gif]) {
            await setFile("[data-testid=post-library]", f);
            await waitFor(async () => (await text("[data-testid=post-message]")).length > 0, 5000, "message");
            msgs.push(await text("[data-testid=post-message]"));
            if (await has("[data-testid=post-preview]")) throw new Error("preview for a rejected file");
          }
          const db = await ev(DB_STATE);
          return { ok: db.images.length === 0 && msgs.every((m) => m.length > 0), detail: `${msgs.length} rejected` };
        });

        await step(vp, locale, "draft: save, reload, still listed; delete draft", async () => {
          await nav(ROUTE);
          await ev(`(() => { const t = document.querySelector('[data-testid=post-body]'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'BB draft'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
          await ev(`document.querySelector('[data-testid=post-draft]').click()`);
          await waitFor(async () => (await count("[data-testid=my-post][data-status=draft]")) === 1, 10000, "draft saved");
          await nav(ROUTE);
          await waitFor(async () => (await count("[data-testid=draft-load]")) === 1, 10000, "draft after reload");
          await ev(`document.querySelector('[data-testid=my-post-delete]').click()`);
          await ev(`document.querySelector('[data-testid=my-post-delete-confirm]').click()`);
          await waitFor(async () => (await count("[data-testid=my-post]")) === 0, 10000, "draft deleted");
          return { ok: true, detail: "draft round trip" };
        });

        await step(vp, locale, "F-056 mock: block/mute hide, own post cannot be reported, duplicate report refused, admin-hidden", async () => {
          await nav(ROUTE);
          await waitFor(() => has("[data-testid=safety-sample]"), 10000, "safety");
          const decision = (owner) => ev(`document.querySelector('[data-testid=sample-post][data-owner="${owner}"]').dataset.decision`);
          if ((await decision("sample_c")) !== "hidden_by_admin") throw new Error("admin hidden");
          await ev(`document.querySelector('[data-testid=sample-post][data-owner="sample_a"] [data-testid=sample-block]').click()`);
          await waitFor(async () => (await decision("sample_a")) === "hidden_blocked", 3000, "blocked");
          await ev(`document.querySelector('[data-testid=sample-post][data-owner="sample_b"] [data-testid=sample-mute]').click()`);
          await waitFor(async () => (await decision("sample_b")) === "hidden_muted", 3000, "muted");
          await ev(`document.querySelector('[data-testid=sample-post][data-owner="me_local"] [data-testid=sample-report]').click()`);
          await ev(`document.querySelector('[data-testid=report-submit]').click()`);
          const own = await text("[data-testid=safety-message]");
          await ev(`document.querySelector('[data-testid=sample-post][data-owner="sample_a"] [data-testid=sample-report]').click()`);
          await ev(`document.querySelector('[data-testid=report-submit]').click()`);
          await sleep(200);
          await ev(`document.querySelector('[data-testid=sample-post][data-owner="sample_a"] [data-testid=sample-report]').click()`);
          await ev(`document.querySelector('[data-testid=report-submit]').click()`);
          const dup = await text("[data-testid=safety-message]");
          const reports = await count("[data-testid=my-reports] li");
          await nav(ROUTE);
          await waitFor(() => has("[data-testid=safety-sample]"), 10000, "safety after reload");
          const persisted = await decision("sample_a");
          return { ok: own !== dup && reports === 1 && persisted === "hidden_blocked", detail: `reports=${reports}` };
        });
      }
    }
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
    if (existsSync(WORK)) for (const f of readdirSync(WORK)) rmSync(path.join(WORK, f));
  }

  const failed = results.filter((r) => !r.ok);
  const L = [
    "# F-084 写真付き投稿（ローカル試作）・F-056 安全機能（モック） ブラックボックス",
    "",
    `実行日時: ${new Date().toISOString()}`,
    "対象: localhost（内部ページを有効にした Production Build）。画像はブラウザー内で作った合成（GPS 入りの EXIF を差し込んだ縦長 JPEG）。保存は隔離ブラウザーの IndexedDB / localStorage だけ。外部通信・書き込み通信 0 を確認。",
    "",
    "| 結果 | viewport | locale | 確認 | 詳細 |",
    "|---|---|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.viewport} | ${r.locale} | ${escapeMarkdownCell(r.op)} | ${escapeMarkdownCell(String(r.detail))} |`),
    "",
    `## 判定: ${results.length - failed.length}/${results.length} PASS`,
    "",
  ];
  writeFileSync(REPORT, L.join("\n"), "utf8");
  console.log(`\n[black-box-local-posts] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
