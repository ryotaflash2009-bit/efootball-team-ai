/**
 * ローカルの確認用サーバー（`next start`）の PID の契約（pure）。scripts/local-server.mjs が使う。
 *
 * 契約（2026-10-06・本人指定）:
 * - `./data/server.pid` には、ポートで実際に待ち受けている `next start` の Node の PID を記録する。
 *   親のシェル（cmd.exe・bash）や helper の PID は記録しない。サーバーが無いときは 0。
 * - このワークスペースのサーバーと判断するのは、次をすべて満たすプロセスだけ:
 *   コマンドラインが `next start`・リポジトリのパス（C:\Development\eFootball-Team-AI）を含む・対象のポートで待ち受けている。
 * - 停止は、停止の直前にコマンドライン・ポートを確かめ直した単一の PID だけ。名前での一括停止はしない。
 * - 記録された PID が終了済み・別のプロセスの場合は stale として扱い、それを根拠に停止しない。
 */

/** server.pid の内容を読む。数字だけ（0 を含む）なら pid、それ以外は invalid。 */
export function parsePidFile(text) {
  if (text === null || text === undefined) return { pid: null, state: "missing" };
  const t = String(text).trim();
  if (!/^\d{1,10}$/.test(t)) return { pid: null, state: "invalid" };
  const pid = Number(t);
  return { pid, state: pid === 0 ? "no_server" : "recorded" };
}

/** `netstat -ano`（Windows）の出力から、指定のポートで LISTENING の PID を重複なしで返す。 */
export function parseNetstatListeners(text, port) {
  const out = new Set();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    // Proto  Local Address  Foreign Address  State  PID
    if (cols.length < 5 || cols[0].toUpperCase() !== "TCP" || cols[3].toUpperCase() !== "LISTENING") continue;
    const m = cols[1].match(/:(\d+)$/);
    if (!m || Number(m[1]) !== Number(port)) continue;
    const pid = Number(cols[4]);
    if (Number.isInteger(pid) && pid > 0) out.add(pid);
  }
  return [...out];
}

const norm = (s) => String(s ?? "").replace(/\\+/g, "/").replace(/"/g, "").toLowerCase();

/** このワークスペースの `next start -p <port>` のコマンドラインか。 */
export function isWorkspaceNextStart(commandLine, root, port) {
  const c = norm(commandLine);
  const r = norm(root).replace(/\/+$/, "");
  if (!r || !c.includes(r + "/")) return false;
  if (!/(^|\/)next(\/dist\/bin\/next)?(\.cmd|\.js)?\s+start(\s|$)/.test(c) && !/node_modules\/next\/dist\/bin\/next\s+start(\s|$)/.test(c)) return false;
  const p = c.match(/(?:\s-p\s+|\s--port[=\s]+)(\d+)/);
  return p !== null && Number(p[1]) === Number(port);
}

/**
 * 状態の判定。
 * processes: Map<pid, { commandLine, parentPid }>（存在するプロセスだけ）
 */
export function inspectServer({ pidFileText, listenerPids, processes, root, port }) {
  const file = parsePidFile(pidFileText);
  const listeners = listenerPids.map((pid) => ({ pid, ...(processes.get(pid) ?? { commandLine: null, parentPid: null }) }));
  const workspaceListeners = listeners.filter((l) => isWorkspaceNextStart(l.commandLine, root, port));
  let pidFile = "ok";
  if (file.state === "invalid" || file.state === "missing") pidFile = file.state;
  else if (file.pid === 0) pidFile = listeners.length ? "stale_zero_while_listening" : "ok";
  else if (!processes.has(file.pid)) pidFile = "stale_not_running";
  else if (!listenerPids.includes(file.pid)) pidFile = "stale_not_listener";
  return {
    port,
    pidFile: { ...file, verdict: pidFile },
    listeners,
    workspaceListener: workspaceListeners.length === 1 && listeners.length === 1 ? workspaceListeners[0] : null,
  };
}

/**
 * 停止してよいかの判定（停止の直前に呼ぶ）。
 * adoptListener: server.pid が stale のときに、確認済みのこのワークスペースの待受プロセスを対象にしてよいか（明示の指定だけ）。
 */
export function decideStop(inspection, { adoptListener = false } = {}) {
  const { listeners, workspaceListener, pidFile } = inspection;
  if (listeners.length === 0) return { action: "none", reason: "not_running", writePidZero: pidFile.pid !== 0 };
  if (listeners.length > 1) return { action: "refuse", reason: "multiple_listeners" };
  if (!workspaceListener) return { action: "refuse", reason: "listener_not_workspace_next_start" };
  if (pidFile.verdict === "ok" && pidFile.pid === workspaceListener.pid) return { action: "stop", pid: workspaceListener.pid, reason: "recorded_listener" };
  if (pidFile.verdict === "stale_not_listener") return { action: "refuse", reason: "pid_file_points_to_other_process" };
  if (adoptListener) return { action: "stop", pid: workspaceListener.pid, reason: `adopted_listener_after_${pidFile.verdict}` };
  return { action: "refuse", reason: `pid_file_${pidFile.verdict}` };
}

/** 起動後に記録する PID（待受の PID。起動した子と一致するか、その子孫であること）。 */
export function decideRecordedPid({ childPid, listenerPids, processes, root, port }) {
  if (listenerPids.length !== 1) return { ok: false, reason: listenerPids.length ? "multiple_listeners" : "no_listener" };
  const pid = listenerPids[0];
  const info = processes.get(pid);
  if (!info || !isWorkspaceNextStart(info.commandLine, root, port)) return { ok: false, reason: "listener_not_workspace_next_start" };
  // 起動した子そのもの、またはその子孫であること（別のプロセスを記録しない）
  let cur = pid;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur === childPid) return { ok: true, pid };
    cur = processes.get(cur)?.parentPid ?? null;
  }
  return { ok: false, reason: "listener_not_started_by_this_command" };
}
