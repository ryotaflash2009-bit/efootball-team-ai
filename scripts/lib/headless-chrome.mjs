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
      // ?__efbProviders=google でログインの方法を切り替える（Google だけのユーザーの表示の確認用・既定は不明＝従来どおり）
      var providersParam = params.get("__efbProviders");
      var fakeUser = { id: fakeUserId, email: "efb-test-double@example.invalid", app_metadata: providersParam ? { providers: providersParam.split(",") } : {} };
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
        // Google OAuth（2026-10-11）。実 Supabase・Google へは移動しない。呼び出しの引数を window.__EFB_TEST_OAUTH_CALLS__ に記録し、
        // window.__EFB_TEST_OAUTH_MODE__ === "failure" なら失敗を返す。
        signInWithOAuth: async function (p) {
          (window.__EFB_TEST_OAUTH_CALLS__ = window.__EFB_TEST_OAUTH_CALLS__ || []).push(JSON.parse(JSON.stringify(p)));
          if (window.__EFB_TEST_OAUTH_MODE__ === "failure") return { data: {}, error: { status: 400, code: "validation_failed", message: "test double: oauth failure" } };
          return { data: { provider: p.provider, url: "about:blank" }, error: null };
        },
        // メールのリンク確認（/auth/confirm）。window.__EFB_TEST_VERIFY_MODE__ で結果を切り替える（実メール・実Supabaseなし）。
        verifyOtp: async function () {
          var mode = window.__EFB_TEST_VERIFY_MODE__ || "success";
          if (mode === "expired") return { data: {}, error: { status: 403, code: "otp_expired", message: "test double: Email link is invalid or has expired" } };
          if (mode === "invalid") return { data: {}, error: { status: 400, code: "validation_failed", message: "test double: invalid" } };
          if (mode === "rate_limited") return { data: {}, error: { status: 429, code: "over_request_rate_limit", message: "test double: rate limited" } };
          if (mode === "unavailable") return { data: {}, error: { status: 503, code: "unexpected_failure", message: "test double: provider unavailable" } };
          if (mode === "timeout") return new Promise(function (_resolve, reject) { setTimeout(function () { reject(new Error("test double: timeout")); }, 300); });
          authenticated = true;
          notify("SIGNED_IN", { user: fakeUser });
          return { data: { user: fakeUser, session: {} }, error: null };
        },
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

      // saved_builds_snapshots（保存ビルドのクラウド保存・2026-10-11）の最小のインメモリの DB ダブル。my_team_snapshots と同じ形。
      // 画面の移動でも消えないよう sessionStorage に持つ（同じタブの中だけ・テスト専用）
      var BC_KEY = "__efb_test_builds_cloud_row__";
      var bcRow = (function () { try { return JSON.parse(sessionStorage.getItem(BC_KEY) || "null"); } catch (e) { return null; } })();
      var bcIdCounter = 0;
      function bcPersist() { try { if (bcRow) sessionStorage.setItem(BC_KEY, JSON.stringify(bcRow)); else sessionStorage.removeItem(BC_KEY); } catch (e) { /* noop */ } }
      function bcFromTable() {
        return {
          select: async function () {
            if (!authenticated) return { data: [], error: null };
            return { data: bcRow ? [bcRow] : [], error: null };
          },
          upsert: function (payload) {
            return {
              select: async function () {
                window.__EFB_TEST_BC_UPSERT_CALLS__ = (window.__EFB_TEST_BC_UPSERT_CALLS__ || 0) + 1;
                if (!authenticated) return { data: null, error: { status: 401, message: "test double: not authenticated" } };
                if (payload && Object.prototype.hasOwnProperty.call(payload, "user_id")) return { data: null, error: { message: "test double: user_id must not be sent" } };
                var now = new Date().toISOString();
                bcIdCounter += 1;
                bcRow = {
                  id: bcRow ? bcRow.id : "efb-test-bc-row-" + bcIdCounter,
                  schema_version: payload.schema_version,
                  builds_data: JSON.parse(JSON.stringify(payload.builds_data)),
                  item_count: payload.item_count,
                  payload_hash: payload.payload_hash,
                  client_updated_at: payload.client_updated_at,
                  updated_at: now,
                };
                bcPersist();
                return { data: [bcRow], error: null };
              },
            };
          },
          delete: function () {
            return {
              eq: function (_col, id) {
                return {
                  select: async function () {
                    if (!authenticated || !bcRow || bcRow.id !== id) return { data: [], error: null };
                    var removedId = bcRow.id;
                    bcRow = null;
                    bcPersist();
                    return { data: [{ id: removedId }], error: null };
                  },
                };
              },
            };
          },
        };
      }

      // saved_squads_snapshots（保存スカッドのクラウド保存・2026-10-11）の最小のインメモリの DB ダブル。my_team_snapshots と同じ形。
      // 画面の移動でも消えないよう sessionStorage に持つ（同じタブの中だけ・テスト専用）
      var SC_KEY = "__efb_test_squads_cloud_row__";
      var scRow = (function () { try { return JSON.parse(sessionStorage.getItem(SC_KEY) || "null"); } catch (e) { return null; } })();
      var scIdCounter = 0;
      function scPersist() { try { if (scRow) sessionStorage.setItem(SC_KEY, JSON.stringify(scRow)); else sessionStorage.removeItem(SC_KEY); } catch (e) { /* noop */ } }
      function scFromTable() {
        return {
          select: async function () {
            if (!authenticated) return { data: [], error: null };
            return { data: scRow ? [scRow] : [], error: null };
          },
          upsert: function (payload) {
            return {
              select: async function () {
                window.__EFB_TEST_SC_UPSERT_CALLS__ = (window.__EFB_TEST_SC_UPSERT_CALLS__ || 0) + 1;
                if (!authenticated) return { data: null, error: { status: 401, message: "test double: not authenticated" } };
                if (payload && Object.prototype.hasOwnProperty.call(payload, "user_id")) return { data: null, error: { message: "test double: user_id must not be sent" } };
                var now = new Date().toISOString();
                scIdCounter += 1;
                scRow = {
                  id: scRow ? scRow.id : "efb-test-sc-row-" + scIdCounter,
                  schema_version: payload.schema_version,
                  squads_data: JSON.parse(JSON.stringify(payload.squads_data)),
                  item_count: payload.item_count,
                  payload_hash: payload.payload_hash,
                  client_updated_at: payload.client_updated_at,
                  updated_at: now,
                };
                scPersist();
                return { data: [scRow], error: null };
              },
            };
          },
          delete: function () {
            return {
              eq: function (_col, id) {
                return {
                  select: async function () {
                    if (!authenticated || !scRow || scRow.id !== id) return { data: [], error: null };
                    var removedId = scRow.id;
                    scRow = null;
                    scPersist();
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
        if (table === "saved_builds_snapshots") {
          return bcFromTable();
        }
        if (table === "saved_squads_snapshots") {
          return scFromTable();
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
      // コミュニティ 第 1 段階（community_* の関数・2026-10-14）の最小のインメモリのダブル。サーバーの規則（公開範囲・ブロック・
      // ミュート・申請・通報の重複・比較は友達だけ）の要点だけを真似る。相手は架空の 3 人（rival_one: 全体公開・friend_req: URL 限定で
      // 自分へ申請済み・hidden_one: 友達だけ）。window.__EFB_COMMUNITY_RATE_LIMITED__ = true で上限の失敗を返す。sessionStorage に持つ。
      var CM_KEY = "__efb_test_community_state__";
      var CM_SUMMARY = null;
      var cm = (function () { try { return JSON.parse(sessionStorage.getItem(CM_KEY) || "null"); } catch (e) { return null; } })() || {
        me: null,
        others: {
          rival_one: { display_name: "Rival One", visibility: "public" },
          friend_req: { display_name: "Friend Req", visibility: "link" },
          hidden_one: { display_name: "Hidden One", visibility: "friends" },
        },
        rel: { friend_req: "pending_incoming" },
        blocks: {},
        mutes: {},
        reports: [],
        summaries: {},
        // ライバル（第 2 段階）: 架空の相手は rival_one だけが使っている
        rivalOpt: { rival_one: true },
        rivals: [],
      };
      function cmPersist() { try { sessionStorage.setItem(CM_KEY, JSON.stringify(cm)); } catch (e) { /* noop */ } }
      function cmErr(code, message) { return { data: null, error: { code: code, message: message } }; }
      function cmOk(data) { cmPersist(); return { data: data, error: null }; }
      function cmId(v) { return String(v || "").trim().toLowerCase(); }
      function cmVisible(id) {
        var o = cm.others[id];
        if (!o || cm.blocks[id]) return false;
        if (o.visibility === "public" || o.visibility === "link") return true;
        return o.visibility === "friends" && (cm.rel[id] === "friends" || cm.rel[id] === "pending_incoming");
      }
      function communityRpc(fn, a) {
        if (!authenticated) return { data: null, error: { status: 401, message: "test double: not authenticated" } };
        a = a || {};
        var id = cmId(a.p_public_id);
        switch (fn) {
          case "community_my_profile":
            return cmOk(cm.me ? [{ public_id: cm.me.public_id, display_name: cm.me.display_name, visibility: cm.me.visibility, public_id_changed_at: cm.me.changed_at, restricted: false }] : []);
          case "community_save_my_profile": {
            var pid = cmId(a.p_public_id);
            if (!/^[a-z][a-z0-9_]{2,19}$/.test(pid)) return cmErr("23514", "check");
            if (cm.others[pid]) return cmErr("23505", "duplicate");
            if (["private", "link", "friends", "public"].indexOf(a.p_visibility) < 0) return cmErr("23514", "check");
            var created = !cm.me;
            if (cm.me && cm.me.public_id !== pid) return cmErr("P0002", "30 days");
            cm.me = { public_id: pid, display_name: String(a.p_display_name || "").trim(), visibility: a.p_visibility, changed_at: cm.me ? cm.me.changed_at : new Date().toISOString() };
            return cmOk(created ? "created" : "updated");
          }
          case "community_get_profile": {
            if (cm.me && id === cm.me.public_id) return cmOk([{ public_id: id, display_name: cm.me.display_name, visibility: cm.me.visibility, relation: "self", blocked_by_me: false, muted_by_me: false, is_self: true, has_comparison: !!cm.summaries.__me }]);
            if (cm.blocks[id] && cm.others[id]) return cmOk([{ public_id: id, display_name: null, visibility: null, relation: "blocked", blocked_by_me: true, muted_by_me: false, is_self: false, has_comparison: false }]);
            if (!cmVisible(id)) return cmOk([]);
            var r = cm.rel[id] || "none";
            return cmOk([{ public_id: id, display_name: cm.others[id].display_name, visibility: null, relation: r, blocked_by_me: false, muted_by_me: !!cm.mutes[id], is_self: false, has_comparison: r === "friends" && !!cm.summaries[id] }]);
          }
          case "community_search": {
            var q = cmId(a.q);
            if (q.length < 3) return cmOk([]);
            return cmOk(Object.keys(cm.others).filter(function (k) { return k.indexOf(q) === 0 && cm.others[k].visibility === "public" && !cm.blocks[k] && !cm.mutes[k]; }).map(function (k) { return { public_id: k, display_name: cm.others[k].display_name }; }));
          }
          case "community_request_friend":
            if (!cm.me || cm.me.visibility === "private") return cmErr("P0013", "profile_required");
            if (!cmVisible(id)) return cmErr("P0010", "not_found");
            if (window.__EFB_COMMUNITY_RATE_LIMITED__) return cmErr("P0011", "rate_limited");
            if (cm.rel[id] === "friends") return cmOk("already_friends");
            if (cm.rel[id] === "pending_outgoing") return cmOk("already_requested");
            if (cm.rel[id] === "pending_incoming") { cm.rel[id] = "friends"; return cmOk("accepted"); }
            // 架空の相手 rival_one は申請を受けるとすぐ承認し、比較の要約を持つ（友達の比較の確認用）
            if (id === "rival_one") { cm.rel[id] = "friends"; cm.summaries[id] = window.__EFB_COMMUNITY_RIVAL_SUMMARY__ || null; return cmOk("requested"); }
            cm.rel[id] = "pending_outgoing";
            return cmOk("requested");
          case "community_respond_friend":
            if (cm.rel[id] !== "pending_incoming") return cmOk("not_found");
            if (a.p_accept) { cm.rel[id] = "friends"; return cmOk("accepted"); }
            delete cm.rel[id];
            return cmOk("rejected");
          case "community_remove_friend":
            if (cm.rel[id] === "friends" || cm.rel[id] === "pending_outgoing") { delete cm.rel[id]; return cmOk("removed"); }
            return cmOk("none");
          case "community_list_friends":
            return cmOk(Object.keys(cm.rel).filter(function (k) { return cm.others[k] && !cm.blocks[k] && !(cm.rel[k] === "pending_incoming" && cm.mutes[k]); }).map(function (k) { return { public_id: k, display_name: cm.others[k].display_name, state: cm.rel[k], since: new Date().toISOString() }; }));
          case "community_block":
            if (!cm.others[id]) return cmErr("P0010", "not_found");
            if (cm.blocks[id]) return cmOk("already_blocked");
            cm.blocks[id] = new Date().toISOString();
            delete cm.rel[id];
            return cmOk("blocked");
          case "community_unblock":
            if (!cm.blocks[id]) return cmOk("none");
            delete cm.blocks[id];
            return cmOk("unblocked");
          case "community_mute":
            if (!cm.others[id]) return cmErr("P0010", "not_found");
            cm.mutes[id] = new Date().toISOString();
            return cmOk("muted");
          case "community_unmute":
            if (!cm.mutes[id]) return cmOk("none");
            delete cm.mutes[id];
            return cmOk("unmuted");
          case "community_list_safety":
            return cmOk(Object.keys(cm.blocks).map(function (k) { return { kind: "block", public_id: k, created_at: cm.blocks[k] }; }).concat(Object.keys(cm.mutes).map(function (k) { return { kind: "mute", public_id: k, created_at: cm.mutes[k] }; })));
          case "community_report":
            if (cm.me && id === cm.me.public_id) return cmErr("P0014", "self_report");
            if (!cm.others[id]) return cmErr("P0010", "not_found");
            if (cm.reports.some(function (r) { return r.target_public_id === id && r.status === "open"; })) return cmOk("duplicate");
            cm.reports.unshift({ id: cm.reports.length + 1, target_public_id: id, reason: a.p_reason, status: "open", created_at: new Date().toISOString(), note: a.p_note });
            return cmOk("reported");
          case "community_list_my_reports":
            return cmOk(cm.reports.map(function (r) { return { id: r.id, target_public_id: r.target_public_id, reason: r.reason, status: r.status, created_at: r.created_at }; }));
          case "community_withdraw_report": {
            var rep = cm.reports.filter(function (r) { return r.id === a.p_id && r.status === "open"; })[0];
            if (!rep) return cmOk("none");
            rep.status = "withdrawn";
            return cmOk("withdrawn");
          }
          case "community_set_comparison":
            if (!a.p_summary || a.p_summary.k !== "sd") return cmErr("22023", "invalid_summary");
            cm.summaries.__me = a.p_summary;
            return cmOk("saved");
          case "community_clear_comparison":
            if (!cm.summaries.__me) return cmOk("none");
            delete cm.summaries.__me;
            return cmOk("cleared");
          case "community_get_comparison": {
            var key = cm.me && id === cm.me.public_id ? "__me" : id;
            if (key !== "__me" && cm.rel[id] !== "friends") return cmOk([]);
            var sm = cm.summaries[key];
            return cmOk(sm ? [{ summary: sm, updated_at: new Date().toISOString() }] : []);
          }
          case "community_set_rival_opt_in":
            cm.rivalOpt.__me = !!a.p_opted_in;
            if (!a.p_opted_in) cm.rivals = [];
            return cmOk(a.p_opted_in ? "opted_in" : "opted_out");
          case "community_add_rival":
            if (!cm.rivalOpt.__me) return cmErr("P0020", "not_opted_in");
            if (cm.rel[id] !== "friends" || cm.blocks[id]) return cmErr("P0010", "not_found");
            if (!cm.rivalOpt[id]) return cmErr("P0021", "other_not_opted_in");
            if (cm.rivals.indexOf(id) >= 0) return cmOk("already");
            if (cm.rivals.length >= 5) return cmErr("P0022", "rival_limit");
            cm.rivals.push(id);
            return cmOk("added");
          case "community_remove_rival": {
            var i = cm.rivals.indexOf(id);
            if (i < 0) return cmOk("none");
            cm.rivals.splice(i, 1);
            return cmOk("removed");
          }
          case "community_list_rivals": {
            if (!cm.me) return cmOk([]);
            var ov = function (sm) { return sm && typeof sm.o[0] === "number" ? sm.o[0] : null; };
            var out = [{ public_id: cm.me.public_id, display_name: cm.me.display_name, is_self: true, opted_in: !!cm.rivalOpt.__me, overall: ov(cm.summaries.__me), rules_version: null, summary_date: null, growth_week: null, growth_month: null }];
            cm.rivals.filter(function (k) { return cm.rel[k] === "friends" && cm.rivalOpt[k] && !cm.blocks[k]; }).forEach(function (k) {
              out.push({ public_id: k, display_name: cm.others[k].display_name, is_self: false, opted_in: true, overall: ov(cm.summaries[k]), rules_version: null, summary_date: null, growth_week: 3, growth_month: -2 });
            });
            return cmOk(out);
          }
        }
        return cmErr("PGRST202", "test double: unknown function");
      }

      // アカウントの削除（delete_my_account・2026-10-11）。window.__EFB_TEST_DELETE_MODE__:
      // "success"（既定）| "reauth" | "billing" | "unavailable" | "hang"（応答しない）。呼び出しの引数を __EFB_TEST_RPC_CALLS__ に記録する。
      var deleted = false;
      async function rpc(fn, args) {
        (window.__EFB_TEST_RPC_CALLS__ = window.__EFB_TEST_RPC_CALLS__ || []).push({ fn: fn, args: args });
        if (typeof fn === "string" && fn.indexOf("community_") === 0) return communityRpc(fn, args);
        if (fn !== "delete_my_account") return { data: null, error: { code: "PGRST202", message: "test double: unknown function" } };
        var mode = window.__EFB_TEST_DELETE_MODE__ || "success";
        if (mode === "hang") return new Promise(function () {});
        if (mode === "reauth") return { data: null, error: { code: "42501", message: "reauthentication_required" } };
        if (mode === "billing") return { data: null, error: { code: "P0001", message: "billing_active" } };
        if (mode === "unavailable") return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
        if (!args || args.confirm !== "DELETE") return { data: null, error: { code: "22023", message: "confirmation_required" } };
        var already = deleted;
        deleted = true;
        return { data: { deleted: true, alreadyDeleted: already, counts: {} }, error: null };
      }
      window.__EFB_DB_TEST_DOUBLE__ = { from: rlsFrom, rpc: rpc };
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

/**
 * ローカル（localhost・127.0.0.1）で動かす black-box だけ: Vercel の Web Analytics の配信用の経路（`/_vercel/insights/*`）は Vercel の上にしか無く、
 * `next start` では 404（HTML）になり、script の読み込みの console error になる（2026-10-08）。この経路だけを空の script で応答する。
 * - 本番・Preview（https の公開 URL）では何もしない（本物の配信を確かめるため）。
 * - Fetch のドメインを使うため、同じタブで Fetch を使う他のテストダブルと一緒に使わない（使う rail だけで呼ぶ）。
 */
export async function stubVercelInsightsOnLocalhost(client, baseUrl) {
  let host = "";
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return false;
  }
  if (host !== "localhost" && host !== "127.0.0.1") return false;
  client.on("Fetch.requestPaused", (p) => {
    let local = false;
    try {
      const u = new URL(p.request.url);
      local = (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.pathname.startsWith("/_vercel/insights/");
    } catch {
      local = false;
    }
    if (local) {
      client
        .send("Fetch.fulfillRequest", {
          requestId: p.requestId,
          responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "application/javascript; charset=utf-8" }],
          body: Buffer.from("/* local stub: Vercel Web Analytics is served only on Vercel */\n").toString("base64"),
        })
        .catch(() => {});
    } else {
      client.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {});
    }
  });
  await client.send("Fetch.enable", { patterns: [{ urlPattern: "*/_vercel/insights/*" }] });
  return true;
}
