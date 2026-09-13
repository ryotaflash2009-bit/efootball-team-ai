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
      // ?__efbUserId=<id>で偽ユーザーIDを切り替えられる(アカウント別localStorage名前空間の
      // 分離を、同一の固定テストダブルのままA/B相当で検証するため)。省略時は既存の固定IDのまま。
      var fakeUserId = params.get("__efbUserId") || "efb-test-double-user-id";
      var fakeUser = { id: fakeUserId, email: "efb-test-double@example.invalid" };
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

      // rls_probe_records用の最小インメモリDBダブル(実Supabaseへは一切接続しない)。
      // 「認証済みなら自分の行だけが見える」という点だけを模擬する
      // (実際のRLS分離そのものの証明は実Supabase上のSQL監査・手動検証で行う。
      // ここはUI/アプリ層が0件更新・0件削除を成功と誤表示しないか等を検証する目的)。
      var rlsRows = [];
      var rlsIdCounter = 0;
      function rlsMakeId() {
        rlsIdCounter += 1;
        return "efb-test-row-" + rlsIdCounter;
      }
      function rlsEmptySelect() {
        return async function () {
          return { data: [], error: null };
        };
      }
      // my_team_snapshots用の最小インメモリDBダブル(実Supabaseへは一切接続しない)。
      // 「1ユーザーにつき最大1行」「user_idはクライアントから送らない」という
      // 実際のテーブル設計だけを模擬する。RLS分離そのものの証明は実Supabase上の
      // SQL監査・手動検証で行う(rls_probe_recordsと同じ方針)。
      var mtRow = null;
      var mtIdCounter = 0;
      function mtMakeId() {
        mtIdCounter += 1;
        return "efb-test-mt-row-" + mtIdCounter;
      }
      // テスト側からwindow.__EFB_TEST_FORCE_MULTIROW__ = trueを設定すると、
      // 「異常系: 複数行が返る」を模擬できる(通常はunique(user_id)+RLSにより起こり得ない)。
      // テスト側からwindow.__EFB_TEST_MT_DELAY_MS__に数値を設定すると、応答前に
      // その分だけ待機する(処理中表示・二重送信防止・古い応答の破棄をテストするため)。
      async function mtMaybeDelay() {
        var ms = window.__EFB_TEST_MT_DELAY_MS__;
        if (typeof ms === "number" && ms > 0) {
          await new Promise(function (r) {
            setTimeout(r, ms);
          });
        }
      }
      function mtFromTable() {
        return {
          // 実コードはawait supabase.from(table).select(cols)の形で直接awaitするため、
          // select自体をasync関数にしてPromiseをそのまま返す(rls_probe_records用の
          // ダブルとは異なり、.order(...)のような追加チェーンを挟まない形状のため)。
          select: async function () {
            await mtMaybeDelay();
            if (!authenticated) return { data: [], error: null };
            if (window.__EFB_TEST_FORCE_MULTIROW__ && mtRow) {
              return { data: [mtRow, Object.assign({}, mtRow, { id: mtMakeId() })], error: null };
            }
            return { data: mtRow ? [mtRow] : [], error: null };
          },
          upsert: function (payload) {
            return {
              select: async function () {
                // 実際に(擬似的な)書き込みリクエストが発生した回数を数える。
                // UIのdisabled属性やボタン文言だけでなく、「本当に保存処理が実行されなかったか」を
                // 独立して検証できるようにするためのテスト専用カウンター。
                window.__EFB_TEST_MT_UPSERT_CALLS__ = (window.__EFB_TEST_MT_UPSERT_CALLS__ || 0) + 1;
                await mtMaybeDelay();
                if (!authenticated) {
                  return { data: null, error: { status: 401, message: "test double: not authenticated" } };
                }
                var now = new Date().toISOString();
                mtRow = {
                  id: mtRow ? mtRow.id : mtMakeId(),
                  schema_version: payload.schema_version,
                  team_data: payload.team_data,
                  item_count: payload.item_count,
                  payload_hash: payload.payload_hash,
                  client_updated_at: payload.client_updated_at,
                  created_at: mtRow ? mtRow.created_at : now,
                  updated_at: now,
                };
                return { data: [mtRow], error: null };
              },
            };
          },
          delete: function () {
            return {
              eq: function (_col, id) {
                return {
                  select: async function () {
                    await mtMaybeDelay();
                    if (!authenticated || !mtRow || mtRow.id !== id) {
                      return { data: [], error: null };
                    }
                    var removedId = mtRow.id;
                    mtRow = null;
                    return { data: [{ id: removedId }], error: null };
                  },
                };
              },
            };
          },
        };
      }

      function rlsFrom(table) {
        if (table === "my_team_snapshots") {
          return mtFromTable();
        }
        if (table !== "rls_probe_records") {
          return {
            select: function () {
              return { order: rlsEmptySelect() };
            },
            insert: function () {
              return {
                select: function () {
                  return {
                    single: async function () {
                      return { data: null, error: { message: "unknown table" } };
                    },
                  };
                },
              };
            },
            update: function () {
              return { eq: function () { return { select: rlsEmptySelect() }; } };
            },
            delete: function () {
              return { eq: function () { return { select: rlsEmptySelect() }; } };
            },
          };
        }
        return {
          select: function () {
            return {
              order: async function () {
                if (!authenticated) return { data: [], error: null };
                // 挿入順は作成順と一致するため、reverse()で作成日時降順を模擬する。
                return { data: rlsRows.slice().reverse(), error: null };
              },
            };
          },
          insert: function (payload) {
            return {
              select: function () {
                return {
                  single: async function () {
                    if (!authenticated) return { data: null, error: { status: 401, message: "test double: not authenticated" } };
                    var now = new Date().toISOString();
                    var row = { id: rlsMakeId(), label: payload.label, created_at: now, updated_at: now };
                    rlsRows.push(row);
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
          update: function (payload) {
            return {
              eq: function (_col, id) {
                return {
                  select: async function () {
                    if (!authenticated) return { data: [], error: null };
                    var row = null;
                    for (var i = 0; i < rlsRows.length; i++) {
                      if (rlsRows[i].id === id) { row = rlsRows[i]; break; }
                    }
                    if (!row) return { data: [], error: null };
                    row.label = payload.label;
                    row.updated_at = new Date().toISOString();
                    return { data: [row], error: null };
                  },
                };
              },
            };
          },
          delete: function () {
            return {
              eq: function (_col, id) {
                return {
                  select: async function () {
                    if (!authenticated) return { data: [], error: null };
                    var idx = -1;
                    for (var i = 0; i < rlsRows.length; i++) {
                      if (rlsRows[i].id === id) { idx = i; break; }
                    }
                    if (idx === -1) return { data: [], error: null };
                    var removed = rlsRows.splice(idx, 1)[0];
                    return { data: [{ id: removed.id }], error: null };
                  },
                };
              },
            };
          },
        };
      }
      window.__EFB_DB_TEST_DOUBLE__ = { from: rlsFrom };
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
