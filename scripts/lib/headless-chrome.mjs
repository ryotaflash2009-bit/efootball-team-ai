/**
 * 最小限のヘッドレス Chrome 駆動ユーティリティ（Chrome DevTools Protocol・生WebSocket）。
 *
 * - 新規 npm 依存を追加しないための実装（Playwright / Puppeteer は本プロジェクトに未導入）。
 *   Node 組み込みの fetch / WebSocket / child_process のみを使用し、
 *   OS に既存インストール済みの Chrome または Edge 実行ファイルをヘッドレス起動する。
 * - 各呼び出しは専用の一時 user-data-dir（隔離プロファイル）を使用し、
 *   終了後に必ず削除する。実ユーザーの Chrome プロファイル／localStorage には一切触れない。
 * - ブラックボックステストの「manager-picker」レール中、1チェックのみの検証に使用。
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const BROWSER_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findBrowserExecutable() {
  for (const c of BROWSER_CANDIDATES) {
    if (existsSync(c)) return c;
  }
  throw new Error("ヘッドレス検証用の Chrome / Edge 実行ファイルが見つかりません（既知パスに存在しない）");
}

async function waitForDevToolsPort(port, timeoutMs) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return true;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`DevTools port ${port} が timeout 内に起動しませんでした: ${lastErr?.message ?? ""}`);
}

/** 隔離されたユーザーデータディレクトリでヘッドレス Chrome/Edge を起動する。 */
export async function launchIsolatedBrowser({ timeoutMs = 10000 } = {}) {
  const exe = findBrowserExecutable();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "efb-bb-headless-"));
  const port = 9222 + Math.floor(Math.random() * 2000);
  const proc = spawn(
    exe,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1280,1000",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-popup-blocking",
      "--disable-sync",
      "--disable-background-networking",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    await waitForDevToolsPort(port, timeoutMs);
  } catch (e) {
    try {
      proc.kill();
    } catch {
      /* noop */
    }
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
  return {
    port,
    userDataDir,
    async close() {
      try {
        proc.kill();
      } catch {
        /* noop */
      }
      await new Promise((r) => setTimeout(r, 150));
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** 新規タブを開く（隔離プロファイル内・実ユーザーのタブには一切影響しない）。 */
export async function openTab(port, url = "about:blank") {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!r.ok) throw new Error(`タブ作成に失敗: HTTP ${r.status}`);
  return r.json();
}

export async function closeTab(port, targetId) {
  await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`, { method: "PUT" }).catch(() => {});
}

/** 最小限の CDP クライアント（JSON-RPC 風の send/on のみ）。 */
export function connectCDP(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("CDP WebSocket 接続エラー")), { once: true });
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message ?? "CDP error"));
      else resolve(msg.result);
    } else if (msg.method) {
      const hs = listeners.get(msg.method);
      if (hs) for (const h of hs) h(msg.params);
    }
  });

  return {
    ready,
    async send(method, params = {}) {
      await ready;
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, handler) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(handler);
    },
    close() {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    },
  };
}

/**
 * Supabase Authブラウザークライアント(`src/lib/supabase/client.ts`)向けの安全なテストダブルを、
 * `Page.addScriptToEvaluateOnNewDocument`でこのタブの以後のすべてのナビゲーションへ注入する。
 *
 * - `.env.local`に実Supabase認証情報が入っていても、ヘッドレスChromeで開くページの
 *   `getSupabaseBrowserClient()`はこのダブルを使い、実Supabaseへは一切接続しない
 *   (サイト全体のヘッダーが認証状態を表示するため、認証と無関係なブラックボックスレールでも
 *   ページを開くだけで実Supabaseへ通信してしまうのを防ぐ)。
 * - `getSupabaseBrowserClient()`はホスト名が`localhost`等(isLocalDevHostname)の場合だけ
 *   このダブルを受け付ける。本番ドメインでは絶対に有効化されない。
 * - 既定(オプション省略)では常に「未ログイン」を返す無害なダブルになる
 *   (認証と無関係なレールが誤って実Supabaseへ接続するのを防ぐ目的)。
 * - `auth-supabase`レールなど、シナリオごとにサインアップ成功・再送信レート制限・
 *   ログイン中状態を切り替えたい場合は、ページ側で`window.__EFB_TEST_RESEND_MODE__`
 *   (`"success" | "rate_limited" | "failure"`)を書き換えるか、URLへ`__efbAuth=1`を
 *   付けて認証済み扱いにする。
 */
export async function installSupabaseAuthTestDouble(client) {
  const source = `
    (function () {
      var params = new URLSearchParams(location.search);
      var authenticated = params.get("__efbAuth") === "1";
      var fakeUser = { id: "efb-test-double-user-id", email: "efb-test-double@example.invalid" };
      var listeners = [];
      function notify(event, session) {
        listeners.slice().forEach(function (cb) {
          try { cb(event, session); } catch (e) { /* noop */ }
        });
      }
      window.__EFB_AUTH_TEST_DOUBLE__ = {
        signUp: async function (p) {
          return { data: { user: { id: "efb-test-double-user-id", email: p.email, identities: [{}] }, session: null }, error: null };
        },
        resend: async function () {
          var mode = window.__EFB_TEST_RESEND_MODE__ || "success";
          if (mode === "rate_limited") {
            return { data: null, error: { status: 429, code: "over_email_send_rate_limit", message: "test double: rate limited" } };
          }
          if (mode === "failure") {
            return { data: null, error: { status: 500, code: "unexpected_failure", message: "test double: unexpected failure" } };
          }
          return { data: {}, error: null };
        },
        getUser: async function () {
          return { data: { user: authenticated ? fakeUser : null }, error: null };
        },
        onAuthStateChange: function (cb) {
          listeners.push(cb);
          return {
            data: {
              subscription: {
                unsubscribe: function () {
                  var i = listeners.indexOf(cb);
                  if (i >= 0) listeners.splice(i, 1);
                },
              },
            },
          };
        },
        signOut: async function () {
          authenticated = false;
          notify("SIGNED_OUT", null);
          return { error: null };
        },
        updateUser: async function () { return { data: {}, error: null }; },
        signInWithPassword: async function () { return { data: {}, error: null }; },
        resetPasswordForEmail: async function () { return { data: {}, error: null }; },
      };
    })();
  `;
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source });
}

/**
 * 決定的な画面状態が現れるまでポーリングする（固定 sleep だけに依存しない）。
 * fn が truthy を返すまで intervalMs 間隔で再試行し、timeoutMs で打ち切る（最後の戻り値を返す＝falsy なら未達）。
 */
export async function waitForCondition(fn, { timeoutMs = 8000, intervalMs = 150 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}
