/**
 * ローカルの確認用サーバー（`next start`）の起動・停止・状態（このワークスペースだけ）。
 *
 *   node scripts/local-server.mjs status   [--port 3000]
 *   node scripts/local-server.mjs start    [--port 3000]        （事前に npm run build）
 *   node scripts/local-server.mjs stop     [--port 3000] [--adopt-listener]
 *   node scripts/local-server.mjs restart  [--port 3000] [--adopt-listener]
 *
 * 契約は scripts/lib/local-server-lifecycle.mjs の先頭のコメント（./data/server.pid = 待受の next start の PID）。
 * - start: シェルを通さず `node node_modules/next/dist/bin/next start -p <port>` を起動し、待受の PID を確かめて記録する。
 * - stop: 停止の直前にコマンドライン・リポジトリのパス・ポートを確かめ直し、単一の PID だけを停止する（taskkill /PID・/T なし）。
 *   server.pid が stale のときは停止しない（--adopt-listener を明示した場合だけ、確認済みの待受プロセスを対象にする）。
 * - 記録: ./data/server-lifecycle.log（JSON Lines・Git 管理外）に、実際の PID・コマンドライン・結果を追記する。
 * - Windows（netstat・PowerShell の CIM）を前提とする。それ以外の OS では status だけ（ps・lsof）を試みる。
 */
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, openSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideRecordedPid, decideStop, inspectServer, parseNetstatListeners } from "./lib/local-server-lifecycle.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const PID_FILE = path.join(DATA, "server.pid");
const LOG_FILE = path.join(DATA, "server-lifecycle.log");
const args = process.argv.slice(2);
const cmd = args[0] ?? "status";
const portArg = args.indexOf("--port");
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 3000;
const ADOPT = args.includes("--adopt-listener");
const WIN = process.platform === "win32";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw new Error("--port must be 1024-65535");

function listenerPids() {
  if (WIN) return parseNetstatListeners(execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }), PORT);
  try {
    return execFileSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

/** pid → { commandLine, parentPid }（存在するプロセスだけ）。 */
function processInfo(pids) {
  const map = new Map();
  const list = [...new Set(pids.filter((p) => Number.isInteger(p) && p > 0))];
  if (list.length === 0) return map;
  if (WIN) {
    const filter = list.map((p) => `ProcessId=${p}`).join(" OR ");
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", `@(Get-CimInstance Win32_Process -Filter '${filter}' | Select-Object ProcessId,ParentProcessId,CommandLine) | ConvertTo-Json -Compress`],
      { encoding: "utf8" },
    ).trim();
    let rows = [];
    try {
      rows = out ? JSON.parse(out) : [];
    } catch {
      // PowerShell が JSON 以外（警告など）を返したときは「分からない」として空を返す（呼び出し側が再試行する）。
      return map;
    }
    for (const r of Array.isArray(rows) ? rows : [rows]) map.set(Number(r.ProcessId), { commandLine: r.CommandLine ?? "", parentPid: Number(r.ParentProcessId) || null });
    return map;
  }
  for (const p of list) {
    try {
      const [ppid, ...rest] = execFileSync("ps", ["-o", "ppid=,args=", "-p", String(p)], { encoding: "utf8" }).trim().split(/\s+/);
      map.set(p, { commandLine: rest.join(" "), parentPid: Number(ppid) || null });
    } catch {
      /* 存在しない */
    }
  }
  return map;
}

/** 親をたどるための情報も集める（記録の確認用）。 */
function processInfoWithAncestors(pids) {
  const map = processInfo(pids);
  for (let i = 0; i < 4; i++) {
    const missing = [...map.values()].map((v) => v.parentPid).filter((p) => p && !map.has(p));
    if (missing.length === 0) break;
    for (const [k, v] of processInfo(missing)) map.set(k, v);
  }
  return map;
}

function readPidFile() {
  return existsSync(PID_FILE) ? readFileSync(PID_FILE, "utf8") : null;
}

function inspect() {
  const listeners = listenerPids();
  const text = readPidFile();
  const recorded = /^\s*\d+\s*$/.test(text ?? "") ? Number(text) : null;
  const processes = processInfo([...listeners, ...(recorded ? [recorded] : [])]);
  return inspectServer({ pidFileText: text, listenerPids: listeners, processes, root: ROOT, port: PORT });
}

function log(event) {
  mkdirSync(DATA, { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), port: PORT, ...event }) + "\n");
}

function writePid(pid) {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(PID_FILE, `${pid}\n`);
}

async function stop() {
  const before = inspect();
  const d = decideStop(before, { adoptListener: ADOPT });
  if (d.action === "none") {
    if (d.writePidZero) writePid(0);
    log({ event: "stop", result: "not_running", pidFile: before.pidFile });
    console.log(`stop: not running on port ${PORT} (Node 停止なし)${d.writePidZero ? "; server.pid set to 0" : ""}`);
    return true;
  }
  if (d.action === "refuse") {
    log({ event: "stop", result: "refused", reason: d.reason, pidFile: before.pidFile, listeners: before.listeners });
    console.error(`stop: refused (${d.reason}). Node 停止なし。`);
    console.error(JSON.stringify(before, null, 2));
    return false;
  }
  // 停止の直前に、同じ PID がまだ同じポート・同じコマンドラインかを確かめ直す
  const again = inspect();
  if (again.workspaceListener?.pid !== d.pid) {
    log({ event: "stop", result: "refused", reason: "changed_before_stop", pid: d.pid });
    console.error("stop: refused (the listener changed before stopping). Node 停止なし。");
    return false;
  }
  const commandLine = again.workspaceListener.commandLine;
  if (WIN) execFileSync("taskkill", ["/PID", String(d.pid), "/F"], { encoding: "utf8" });
  else process.kill(d.pid, "SIGTERM");
  for (let i = 0; i < 60 && listenerPids().includes(d.pid); i++) await sleep(250);
  const freed = !listenerPids().includes(d.pid);
  if (freed) writePid(0);
  log({ event: "stop", result: freed ? "stopped" : "still_listening", pid: d.pid, reason: d.reason, commandLine, command: WIN ? `taskkill /PID ${d.pid} /F` : `kill ${d.pid}` });
  console.log(freed ? `stop: stopped PID ${d.pid} (${d.reason}); server.pid = 0` : `stop: PID ${d.pid} still listening; server.pid unchanged`);
  return freed;
}

async function start() {
  const before = inspect();
  if (before.listeners.length > 0) {
    log({ event: "start", result: "refused", reason: "port_in_use", listeners: before.listeners });
    console.error(`start: port ${PORT} is in use by ${before.listeners.map((l) => l.pid).join(", ")}; not starting.`);
    return false;
  }
  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.error("start: no production build (.next/BUILD_ID). Run npm run build first.");
    return false;
  }
  mkdirSync(DATA, { recursive: true });
  const out = openSync(path.join(DATA, "start-latest.log"), "w");
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], { cwd: ROOT, detached: true, stdio: ["ignore", out, out], windowsHide: true });
  child.unref();
  let decision = { ok: false, reason: "no_listener" };
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try {
      const listeners = listenerPids();
      if (listeners.length === 0) continue;
      decision = decideRecordedPid({ childPid: child.pid, listenerPids: listeners, processes: processInfoWithAncestors(listeners), root: ROOT, port: PORT });
      // プロセスの情報が一時的に取れなかったときは、待ち時間（最大 60 秒）の範囲で取り直す。
      if (!decision.ok && decision.reason === "listener_not_workspace_next_start" && i < 119) continue;
      break;
    } catch (e) {
      // netstat / PowerShell の一時的な失敗で落ちない（2026-10-09: build の直後に server.pid が 0 のまま残ることがあった）。
      decision = { ok: false, reason: `inspect_error:${String(e?.message ?? e).slice(0, 80)}` };
    }
  }
  if (!decision.ok) {
    writePid(0);
    log({ event: "start", result: "failed", reason: decision.reason, childPid: child.pid });
    console.error(`start: failed (${decision.reason}); server.pid = 0. Started child PID ${child.pid} was not stopped automatically; check data/start-latest.log.`);
    return false;
  }
  writePid(decision.pid);
  const info = processInfo([decision.pid]).get(decision.pid);
  log({ event: "start", result: "started", pid: decision.pid, childPid: child.pid, commandLine: info?.commandLine ?? null });
  console.log(`start: listening on ${PORT}; server.pid = ${decision.pid}`);
  return true;
}

if (cmd === "status") {
  const s = inspect();
  console.log(JSON.stringify(s, null, 2));
} else if (cmd === "stop") {
  process.exitCode = (await stop()) ? 0 : 1;
} else if (cmd === "start") {
  process.exitCode = (await start()) ? 0 : 1;
} else if (cmd === "restart") {
  process.exitCode = (await stop()) && (await start()) ? 0 : 1;
} else {
  console.error("usage: node scripts/local-server.mjs status|start|stop|restart [--port 3000] [--adopt-listener]");
  process.exitCode = 2;
}
