import { describe, expect, it } from "vitest";
import {
  decideRecordedPid,
  decideStop,
  inspectServer,
  isWorkspaceNextStart,
  parseNetstatListeners,
  parsePidFile,
} from "../../scripts/lib/local-server-lifecycle.mjs";

const ROOT = "C:\\Development\\eFootball-Team-AI";
const NEXT = '"node"   "C:\\Development\\eFootball-Team-AI\\node_modules\\.bin\\\\..\\next\\dist\\bin\\next" start -p 3000';
const DIRECT = '"C:\\Program Files\\nodejs\\node.exe" C:\\Development\\eFootball-Team-AI\\node_modules\\next\\dist\\bin\\next start -p 3000';
const CMD = "C:\\Windows\\system32\\cmd.exe /d /s /c next start -p 3000";
const OTHER = '"node" "C:\\Other\\project\\node_modules\\next\\dist\\bin\\next" start -p 3000';

const NETSTAT = [
  "  Proto  Local Address          Foreign Address        State           PID",
  "  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       31268",
  "  TCP    [::]:3000              [::]:0                 LISTENING       31268",
  "  TCP    0.0.0.0:30000          0.0.0.0:0              LISTENING       555",
  "  TCP    127.0.0.1:3000         127.0.0.1:50000        ESTABLISHED     31268",
  "  TCP    127.0.0.1:50000        127.0.0.1:3000         ESTABLISHED     777",
].join("\r\n");

const procs = (entries: Array<[number, string, number | null]>) => new Map(entries.map(([pid, commandLine, parentPid]) => [pid, { commandLine, parentPid }]));

describe("ローカルサーバーの PID の契約: 読み取り", () => {
  it("server.pid は数字だけ。0 はサーバーなし", () => {
    expect(parsePidFile("31268\n")).toEqual({ pid: 31268, state: "recorded" });
    expect(parsePidFile("0")).toEqual({ pid: 0, state: "no_server" });
    expect(parsePidFile("abc")).toEqual({ pid: null, state: "invalid" });
    expect(parsePidFile(null)).toEqual({ pid: null, state: "missing" });
  });

  it("netstat から対象のポートの LISTENING の PID だけを取る（30000・接続中の行は除く）", () => {
    expect(parseNetstatListeners(NETSTAT, 3000)).toEqual([31268]);
    expect(parseNetstatListeners(NETSTAT, 3200)).toEqual([]);
  });

  it("このワークスペースの next start だけを認める（親のシェル・別のプロジェクト・別のポートは認めない）", () => {
    expect(isWorkspaceNextStart(NEXT, ROOT, 3000)).toBe(true);
    expect(isWorkspaceNextStart(DIRECT, ROOT, 3000)).toBe(true);
    expect(isWorkspaceNextStart(CMD, ROOT, 3000)).toBe(false);
    expect(isWorkspaceNextStart(OTHER, ROOT, 3000)).toBe(false);
    expect(isWorkspaceNextStart(NEXT, ROOT, 3200)).toBe(false);
    expect(isWorkspaceNextStart(NEXT.replace(" start ", " dev "), ROOT, 3000)).toBe(false);
    expect(isWorkspaceNextStart(NEXT, "C:\\Development\\eFootball-Team-AI-backup", 3000)).toBe(false);
  });
});

describe("ローカルサーバーの PID の契約: 停止", () => {
  it("記録の PID が待受の next start なら、その PID だけを停止する", () => {
    const s = inspectServer({ pidFileText: "31268", listenerPids: [31268], processes: procs([[31268, NEXT, 91956]]), root: ROOT, port: 3000 });
    expect(s.pidFile.verdict).toBe("ok");
    expect(decideStop(s)).toEqual({ action: "stop", pid: 31268, reason: "recorded_listener" });
  });

  it("記録の PID が終了済み（stale）なら停止しない。明示の指定があるときだけ確認済みの待受を対象にする", () => {
    const s = inspectServer({ pidFileText: "26257", listenerPids: [31268], processes: procs([[31268, NEXT, 91956]]), root: ROOT, port: 3000 });
    expect(s.pidFile.verdict).toBe("stale_not_running");
    expect(decideStop(s)).toEqual({ action: "refuse", reason: "pid_file_stale_not_running" });
    expect(decideStop(s, { adoptListener: true })).toEqual({ action: "stop", pid: 31268, reason: "adopted_listener_after_stale_not_running" });
  });

  it("記録の PID が別のプロセス（再利用）なら、指定があっても停止しない", () => {
    const s = inspectServer({ pidFileText: "4242", listenerPids: [31268], processes: procs([[31268, NEXT, 91956], [4242, "chrome.exe", 1]]), root: ROOT, port: 3000 });
    expect(s.pidFile.verdict).toBe("stale_not_listener");
    expect(decideStop(s, { adoptListener: true })).toEqual({ action: "refuse", reason: "pid_file_points_to_other_process" });
  });

  it("待受がこのワークスペースの next start でなければ停止しない（別のプロジェクト・dev・不明）", () => {
    for (const cmdline of [OTHER, NEXT.replace(" start ", " dev "), ""]) {
      const s = inspectServer({ pidFileText: "31268", listenerPids: [31268], processes: procs([[31268, cmdline, 1]]), root: ROOT, port: 3000 });
      expect(decideStop(s, { adoptListener: true })).toEqual({ action: "refuse", reason: "listener_not_workspace_next_start" });
    }
  });

  it("待受が複数なら停止しない。待受が無ければ何も停止せず server.pid を 0 にする", () => {
    const multi = inspectServer({ pidFileText: "1", listenerPids: [1, 2], processes: procs([[1, NEXT, 0], [2, NEXT, 0]]), root: ROOT, port: 3000 });
    expect(decideStop(multi, { adoptListener: true })).toEqual({ action: "refuse", reason: "multiple_listeners" });
    const none = inspectServer({ pidFileText: "26257", listenerPids: [], processes: procs([]), root: ROOT, port: 3000 });
    expect(decideStop(none)).toEqual({ action: "none", reason: "not_running", writePidZero: true });
    const zero = inspectServer({ pidFileText: "0", listenerPids: [], processes: procs([]), root: ROOT, port: 3000 });
    expect(decideStop(zero)).toEqual({ action: "none", reason: "not_running", writePidZero: false });
  });
});

describe("ローカルサーバーの PID の契約: 起動後の記録", () => {
  it("記録するのは待受の PID（起動した子、またはその子孫）。親のシェルの PID は記録しない", () => {
    expect(decideRecordedPid({ childPid: 500, listenerPids: [500], processes: procs([[500, DIRECT, 1]]), root: ROOT, port: 3000 })).toEqual({ ok: true, pid: 500 });
    expect(decideRecordedPid({ childPid: 500, listenerPids: [600], processes: procs([[600, DIRECT, 500], [500, CMD, 1]]), root: ROOT, port: 3000 })).toEqual({ ok: true, pid: 600 });
  });

  it("別のプロセスが待ち受けている・待受が無い・複数なら記録しない", () => {
    expect(decideRecordedPid({ childPid: 500, listenerPids: [700], processes: procs([[700, DIRECT, 1]]), root: ROOT, port: 3000 })).toEqual({ ok: false, reason: "listener_not_started_by_this_command" });
    expect(decideRecordedPid({ childPid: 500, listenerPids: [500], processes: procs([[500, OTHER, 1]]), root: ROOT, port: 3000 })).toEqual({ ok: false, reason: "listener_not_workspace_next_start" });
    expect(decideRecordedPid({ childPid: 500, listenerPids: [], processes: procs([]), root: ROOT, port: 3000 })).toEqual({ ok: false, reason: "no_listener" });
    expect(decideRecordedPid({ childPid: 500, listenerPids: [1, 2], processes: procs([]), root: ROOT, port: 3000 })).toEqual({ ok: false, reason: "multiple_listeners" });
  });
});
