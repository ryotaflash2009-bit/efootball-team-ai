/**
 * 限定ベータRelease Gateのブラウザー確認(desktop 1280 / mobile 390)。
 *
 *   node scripts/beta-release-gate-browser-check.mjs   (next start を localhost:3000 で起動済みであること)
 *
 * 主要ページ(検索拒否の表示を含む)を開き、console error・未捕捉例外・想定外の通信失敗・
 * 同一originの5xx・横スクロール(overflow)・内部情報の露出が0件であることを確認する。
 * localhost以外へは移動しない。ヘッダーの認証表示は既存のテストダブルで実Supabase Authへ接続させない。
 * ブラウザーは既存helper(scripts/lib/headless-chrome.mjs)の隔離プロファイルで起動し、終了時に破棄する。
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

// 既定はlocalhost。本人承認のある読み取り専用の公開サイト確認だけ BASE_URL(https) を指定する。
// 結果は既定のレポート(localhost用)を上書きしないよう、BASE_URL指定時は REPORT_PATH(リポジトリ内・git管理外の./data配下)へ書く。
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = resolveReport(process.env.REPORT_PATH, path.join(ROOT, "docs", "black-box-tests", "beta-release-gate-browser.md"));
function resolveReport(custom, fallback) {
  if (!custom) {
    if (!IS_LOCAL) throw new Error("REPORT_PATH is required when BASE_URL is not localhost");
    return fallback;
  }
  const p = path.resolve(ROOT, custom);
  if (!p.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
  return p;
}
const PAYLOAD = encodeURIComponent("'; DROP TABLE world_player_cards;--");
const PAGES = [
  "/", "/players", "/players?q=messi", `/players?q=${PAYLOAD}`, "/managers", `/managers?q=${encodeURIComponent("'; DROP TABLE managers; --")}`,
  "/compare", "/squads", "/my-team", "/my-builds", "/best-xi", "/favorites", "/support", "/data-management", "/about", "/terms",
];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
];
const LEAK_RE = /DROP TABLE|ilike|PostgREST|supabase\.co|stack trace|WORLD_QUERY_FAILED|42501/i;

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/** Markdown表のセル用: バックスラッシュを先にエスケープしてから`|`をエスケープし、改行は空白にする。 */
function escapeTableCell(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

async function evalJson(client, expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  const start = Date.now();
  while (Date.now() - start < 20000) {
    const state = await evalJson(client, "document.readyState").catch(() => null);
    if (state === "complete") break;
    await new Promise((r) => setTimeout(r, 150));
  }
  await new Promise((r) => setTimeout(r, 800));
}

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  const client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  // 利用者(日本)のブラウザーの時間帯で確認する。サーバー(Vercel)はUTCのため、最終確認ではサーバーを TZ=UTC で起動し、
  // 時間帯の違いによるhydration不一致(React #418)を検出する(2026-09-24に公開サイトで検出・修正済み)。
  await client.send("Emulation.setTimezoneOverride", { timezoneId: process.env.GATE_BROWSER_TZ ?? "Asia/Tokyo" });
  await installSupabaseAuthTestDouble(client);

  let current = { console: [], exceptions: [], failed: [], serverErrors: [], offOrigin: [] };
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") current.console.push((p.args ?? []).map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  });
  client.on("Runtime.exceptionThrown", (p) => current.exceptions.push(String(p.exceptionDetails?.text ?? "exception").slice(0, 200)));
  client.on("Network.loadingFailed", (p) => {
    if (p.canceled || /ERR_ABORTED/.test(p.errorText ?? "")) return; // 画面遷移による中断は通信失敗として数えない
    current.failed.push(p.errorText ?? "failed");
  });
  client.on("Network.responseReceived", (p) => {
    const url = p.response?.url ?? "";
    if (url.startsWith(BASE) && p.response.status >= 500) current.serverErrors.push(`${p.response.status} ${url.replace(BASE, "")}`);
  });
  client.on("Network.requestWillBeSent", (p) => {
    const url = p.request?.url ?? "";
    if (!url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("blob:")) current.offOrigin.push(url.split("?")[0]);
  });

  try {
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      for (const page of PAGES) {
        current = { console: [], exceptions: [], failed: [], serverErrors: [], offOrigin: [] };
        await navigate(client, `${BASE}${page}`);
        const overflow = await evalJson(client, "document.documentElement.scrollWidth - window.innerWidth");
        const text = await evalJson(client, "document.body.innerText");
        const label = `[${vp.name}] ${decodeURIComponent(page)}`;
        record(`${label} console error 0`, current.console.length === 0 && current.exceptions.length === 0, [...current.console, ...current.exceptions].join(" | "));
        record(`${label} 想定外の通信失敗・5xx 0`, current.failed.length === 0 && current.serverErrors.length === 0, [...current.failed, ...current.serverErrors].join(" | "));
        record(`${label} 横スクロール 0`, overflow <= 0, `overflow=${overflow}`);
        record(`${label} 内部情報の露出なし`, !LEAK_RE.test(String(text ?? "")), "");
        record(`${label} 対象origin以外への通信なし`, current.offOrigin.length === 0, [...new Set(current.offOrigin)].slice(0, 3).join(" | "));
      }
    }
  } finally {
    client.close();
    await closeTab(browser.port, tab.id);
    await browser.close();
  }

  const pass = results.filter((r) => r.ok).length;
  const lines = [
    "# 限定ベータ Release Gate ブラウザー確認",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${IS_LOCAL ? `${BASE}(localhost のみ)` : "公開サイト(読み取り専用GETのみ)"}  viewport: desktop 1280 / mobile 390`,
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${escapeTableCell(r.name)} | ${escapeTableCell(r.detail)} |`),
    "",
    `**${pass}/${results.length} PASS**`,
    "",
  ];
  writeFileSync(REPORT, lines.join("\n"), "utf8");
  console.log(`\n[beta-release-gate-browser] ${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
