/**
 * 新規登録の限定テスト（カスタム SMTP の配信確認まで一般の新規登録を受け付けない）の公開ブラックボックス。
 * 8 viewport × 日本語/英語。
 *
 *   node scripts/black-box-public-signup-limited.mjs                          (next start を localhost:3000 で起動済み)
 *   BASE_URL=https://<公開サイト> REPORT_PATH=./data/<folder>/signup-limited.md node scripts/black-box-public-signup-limited.mjs
 *
 * - GET と画面表示だけ。フォームは送信しない（ログイン・新規登録・再設定メール・リンク確認のどれも実行しない
 *   = 本番メール送信 0・本番書き込み 0）。ログインは「入力欄とボタンが使える状態で表示される」ことまでを見る。
 * - ブラウザーは既存 helper の隔離プロファイル。Supabase のテストダブルは localhost でだけ有効
 *   （公開サイトでは実クライアントのまま。ただし未ログイン・送信なしのため Supabase への通信は発生しない想定で、
 *   発生したら off-origin request として FAIL にする）。
 * - `?signupPreview=1`: localhost ではフォームが開く（開発時の確認用）。公開サイトでは開かないこと。
 * - 結果は要約だけ（route・viewport・locale・pass/fail）。HTML・本文は保存しない。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchIsolatedBrowser, openTab, closeTab, connectCDP, installSupabaseAuthTestDouble } from "./lib/headless-chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!/^(http:\/\/localhost:\d+|https:\/\/[a-z0-9.-]+)$/.test(BASE)) throw new Error("BASE_URL must be http://localhost:<port> or an https origin");
const IS_LOCAL = BASE.startsWith("http://localhost");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = (() => {
  const custom = process.env.REPORT_PATH;
  if (!custom) {
    if (!IS_LOCAL) throw new Error("REPORT_PATH is required when BASE_URL is not localhost");
    return path.join(ROOT, "docs", "black-box-tests", "public-signup-limited.md");
  }
  const p = path.resolve(ROOT, custom);
  if (!p.startsWith(path.join(ROOT, "data") + path.sep)) throw new Error("REPORT_PATH must be inside ./data");
  return p;
})();

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
const TEXT = {
  ja: { limited: "限定テスト中", signInTitle: "ログイン" },
  en: { limited: "limited testing", signInTitle: "Sign in" },
};
const LEAK_RE = /sb_secret_|service_role|postgres(ql)?:\/\/|SUPABASE_[A-Z_]+|supabase\.co|AuthApiError|AuthRetryableFetchError|otp_expired|over_email_send_rate_limit|stack trace|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HYDRATION_RE = /hydrat|Minified React error #(418|423|425)|did not match/i;
const FAKE_TOKEN_HASH = "efbtestdouble" + "0".repeat(40); // 明示的な偽値（検証は実行しない）

let client;
let cap;
const resetCap = () => (cap = { consoleErrors: [], warnings: [], exceptions: [], failed: [], s5xx: [], s4xx: [], offOrigin: [], writes: [] });
resetCap();
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ev(expression) {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.text}`);
  return r.result.value;
}
async function waitFor(fn, timeoutMs, label) {
  const until = Date.now() + timeoutMs;
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
  await sleep(600); // hydration と effect（URL の置き換え等）を待つ
}
const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const bodyText = () => ev("document.body ? document.body.innerText : ''");

async function step(vp, locale, route, op, fn, { allow4xx = [] } = {}) {
  resetCap();
  let res;
  try {
    res = await fn();
  } catch (e) {
    res = { ok: false, detail: e.message };
  }
  const problems = [];
  if (!res.ok) problems.push(res.detail || "check failed");
  let text = "";
  let overflow = 0;
  try {
    text = await bodyText();
    overflow = await ev("document.documentElement.scrollWidth - window.innerWidth");
  } catch {
    /* 遷移中 */
  }
  if (cap.consoleErrors.length) problems.push(`console error: ${cap.consoleErrors[0]}`);
  if (cap.exceptions.length) problems.push(`exception: ${cap.exceptions[0]}`);
  if (cap.warnings.length) problems.push(`console warning: ${cap.warnings[0]}`);
  if (cap.failed.length) problems.push(`network error: ${cap.failed[0]}`);
  if (cap.s5xx.length) problems.push(`5xx: ${cap.s5xx[0]}`);
  const u4 = cap.s4xx.filter((s) => !allow4xx.some((re) => re.test(s)));
  if (u4.length) problems.push(`unexpected 4xx: ${u4[0]}`);
  if (cap.offOrigin.length) problems.push(`off-origin request: ${cap.offOrigin[0]}`);
  if (cap.writes.length) problems.push(`non-GET request: ${cap.writes[0]}`);
  if (LEAK_RE.test(text)) problems.push(`internal information shown: ${LEAK_RE.exec(text)[0].slice(0, 30)}`);
  if ([...cap.consoleErrors, ...cap.exceptions].some((m) => HYDRATION_RE.test(m))) problems.push("hydration mismatch");
  if (overflow > 0) problems.push(`horizontal overflow ${overflow}px`);
  const row = { viewport: vp.name, locale, route, op, ok: problems.length === 0, detail: problems.length ? problems.join(" ; ") : res.detail || "" };
  results.push(row);
  console.log(`${row.ok ? "PASS" : "FAIL"}  [${vp.name} ${locale}] ${route} ${op}${row.detail ? `  — ${row.detail}` : ""}`);
}

async function main() {
  const browser = await launchIsolatedBrowser();
  const tab = await openTab(browser.port, "about:blank");
  client = connectCDP(tab.webSocketDebuggerUrl);
  await client.ready;
  for (const d of ["Page", "Runtime", "Network", "Log"]) await client.send(`${d}.enable`);
  await installSupabaseAuthTestDouble(client); // localhost でだけ有効（公開サイトでは何もしない）

  const fmtArgs = (p) => (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").replace(/\s+/g, " ").slice(0, 200);
  client.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error" || p.type === "assert") cap.consoleErrors.push(fmtArgs(p));
    else if (p.type === "warning") cap.warnings.push(fmtArgs(p));
  });
  client.on("Runtime.exceptionThrown", (p) => cap.exceptions.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception").split("\n")[0].slice(0, 200)));
  client.on("Log.entryAdded", (p) => {
    if (p.entry.source === "network") return;
    if (p.entry.level === "error") cap.consoleErrors.push(`[${p.entry.source}] ${String(p.entry.text).slice(0, 200)}`);
    else if (p.entry.level === "warning" && p.entry.source !== "other") cap.warnings.push(`[${p.entry.source}] ${String(p.entry.text).slice(0, 200)}`);
  });
  const reqPath = new Map();
  client.on("Network.requestWillBeSent", (p) => {
    const url = p.request?.url ?? "";
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (!url.startsWith(BASE)) {
      cap.offOrigin.push(url.split("?")[0].replace(/^https?:\/\/([^/]+).*/, "$1"));
      return;
    }
    const u = new URL(url);
    reqPath.set(p.requestId, u.pathname);
    if (p.request.method !== "GET" && p.request.method !== "HEAD") cap.writes.push(`${p.request.method} ${u.pathname}`);
  });
  client.on("Network.responseReceived", (p) => {
    const url = p.response?.url ?? "";
    if (!url.startsWith(BASE)) return;
    const s = p.response.status;
    const tag = `${s} ${p.type} ${new URL(url).pathname}`;
    if (s >= 500) cap.s5xx.push(tag);
    else if (s >= 400) cap.s4xx.push(tag);
  });
  client.on("Network.loadingFailed", (p) => {
    if (p.canceled || /ERR_ABORTED/.test(p.errorText ?? "")) return;
    cap.failed.push(`${p.errorText} ${reqPath.get(p.requestId) ?? ""}`);
  });

  try {
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      await client.send("Emulation.setTouchEmulationEnabled", { enabled: vp.mobile });
      for (const locale of ["ja", "en"]) {
        const T = TEXT[locale];
        await nav("/");
        await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, ${JSON.stringify(locale)})`);

        await step(vp, locale, "/auth/sign-up", "limited notice, no form", async () => {
          await nav("/auth/sign-up");
          if (!(await has("[data-testid=signup-limited]"))) throw new Error("limited notice missing");
          if (!(await bodyText()).includes(T.limited)) throw new Error(`text missing: ${T.limited}`);
          if ((await count("input[type=password]")) !== 0) throw new Error("sign-up form shown");
          if (!(await has("[data-testid=signup-limited] a[href='/players']"))) throw new Error("no link to /players");
          if (!(await has("a[href='/auth/sign-in']"))) throw new Error("no link to sign-in");
          const robots = await ev("document.querySelector('meta[name=robots]')?.content ?? ''");
          if (!/noindex/.test(robots)) throw new Error(`robots=${robots}`);
          return { ok: true, detail: "limited, noindex" };
        });

        await step(vp, locale, "/auth/sign-up?signupPreview=1", IS_LOCAL ? "preview opens on localhost only" : "preview flag ignored in production", async () => {
          await nav("/auth/sign-up?signupPreview=1");
          await sleep(300);
          const pw = await count("input[type=password]");
          if (IS_LOCAL) return { ok: pw === 2, detail: `password inputs=${pw}` };
          if (pw !== 0 || !(await has("[data-testid=signup-limited]"))) throw new Error("sign-up form opened by query");
          return { ok: true, detail: "still limited" };
        });

        await step(vp, locale, "/auth/sign-in", "sign-in usable (not submitted)", async () => {
          await nav("/auth/sign-in");
          const h1 = await ev("(document.querySelector('main h1, h1')||{}).textContent||''");
          if (!h1.includes(T.signInTitle)) throw new Error(`heading=${h1}`);
          if (!(await ev("(() => { const e = document.querySelector('input[type=email]'); const p = document.querySelector('input[type=password]'); const b = document.querySelector('form button[type=submit]'); return !!e && !!p && !!b && !e.disabled && !p.disabled && !b.disabled; })()"))) throw new Error("sign-in inputs not usable");
          if (!(await bodyText()).includes(T.limited)) throw new Error("no limited-signup notice on sign-in");
          if (!(await has("a[href='/auth/forgot-password']"))) throw new Error("no reset link");
          return { ok: true, detail: "form ready" };
        });

        await step(vp, locale, "/auth/forgot-password", "reset notice (not submitted)", async () => {
          await nav("/auth/forgot-password");
          if (!(await has("[data-testid=password-reset-limited]"))) throw new Error("reset limited notice missing");
          if (!(await has("[data-testid=support-privacy-notice]"))) throw new Error("support privacy notice missing");
          return { ok: true, detail: "notices shown" };
        });

        await step(vp, locale, "/auth/confirm", "token removed from URL, not verified automatically", async () => {
          await nav(`/auth/confirm?token_hash=${FAKE_TOKEN_HASH}&type=email`);
          const href = await ev("location.href");
          if (href.includes("token_hash")) throw new Error("token left in URL");
          if (!(await has("[data-testid=confirm-button]"))) throw new Error("confirm button missing");
          const ref = await ev("document.querySelector('meta[name=referrer]')?.content ?? ''");
          if (ref !== "no-referrer") throw new Error(`referrer=${ref}`);
          return { ok: true, detail: "waiting for click" };
        });

        await step(vp, locale, "/auth/confirm (bad type)", "rejected without verification", async () => {
          await nav(`/auth/confirm?token_hash=${FAKE_TOKEN_HASH}&type=evil`);
          if (!(await has("[data-testid=confirm-error]"))) throw new Error("error not shown");
          if (await has("[data-testid=confirm-button]")) throw new Error("confirm button shown");
          return { ok: true, detail: "invalid link view" };
        });

        await step(vp, locale, "/account", "signed-out view", async () => {
          await nav("/account");
          if (!(await has("a[href='/auth/sign-in']"))) throw new Error("no sign-in link");
          if (await has("[data-testid=email-change-section]")) throw new Error("email change shown while signed out");
          return { ok: true, detail: "sign-in prompt" };
        });
      }
    }

    // 内部ページは 404（viewport に依存しないので1回）。
    const vp0 = VIEWPORTS[0];
    await nav("/");
    await ev(`localStorage.setItem(${JSON.stringify(LOCALE_KEY)}, "ja")`);
    for (const route of ["/account/rls-test", "/release-readiness"]) {
      await step(vp0, "ja", route, "internal page is 404", async () => {
        await nav(route);
        if (!(await bodyText()).includes("ページが見つかりません")) throw new Error("not-found view missing");
        return { ok: true, detail: "404" };
      }, { allow4xx: [new RegExp(`^404 Document ${route.replace(/\//g, "\\/")}$`)] });
    }
  } finally {
    await closeTab(browser.port, tab.id).catch(() => {});
    client.close();
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const L = [
    "# 新規登録の限定テスト 公開ブラックボックス",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${IS_LOCAL ? "localhost（Production Build）" : "公開サイト"}  viewport: ${VIEWPORTS.length}  locale: ja, en`,
    "",
    "フォームは送信しない（ログイン・新規登録・再設定メール・リンク確認を実行しない。本番メール送信 0・書き込み 0）。",
    "",
    "| 結果 | viewport | locale | route | 確認 | 詳細 |",
    "|---|---|---|---|---|---|",
    ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.viewport} | ${r.locale} | ${r.route} | ${r.op} | ${String(r.detail).replace(/\|/g, "\\|")} |`),
    "",
    `## 判定: ${results.length - failed.length}/${results.length} PASS${failed.length ? `（${failed.length} 件 FAIL）` : ""}`,
    "",
  ];
  mkdirSync(path.dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, L.join("\n"), "utf8");
  console.log(`\n[black-box-public-signup-limited] ${results.length - failed.length}/${results.length} PASS  レポート: ${path.relative(ROOT, REPORT)}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
