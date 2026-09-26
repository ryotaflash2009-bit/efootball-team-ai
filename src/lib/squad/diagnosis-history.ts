import { getCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import type { StorageScope } from "@/lib/local-storage-scope/types";
import { validateSharePayload, type SquadDiagnosisSharePayloadV1 } from "./squad-diagnosis-share-url";

/**
 * スカッド診断の履歴（F-060）。**ブラウザー内（localStorage）だけ**に保存する。
 *
 * - サーバー・Production DB・アカウント同期・分析/ログ送信は一切しない。
 * - 保存する診断データは共有URLと同じ要約（`SquadDiagnosisSharePayloadV1`：名前・IDを含まない契約）。
 *   加えて、この端末の中だけで使う表示ラベル（スカッド名）と、同じスカッドの履歴をまとめるための
 *   スカッドID（画面には表示しない・共有URLやエクスポートへは出さない）を持つ。
 * - 保存領域は現在のスコープ（未ログイン=guest / アカウント別）ごとに分ける（他のローカルデータと同じ方針）。
 *   スコープ未解決（認証状態の確認中）の間は、読み込みは空、書き込みは拒否。
 * - 上限: 50件・64KB。超える分は古いものから削除する。
 * - 壊れたデータ: 項目単位で除外し、残りは使う。全体が読めない場合は、上書きする前に隔離キーへ退避する。
 * - 書き込みは読み戻して確認し、確認できなければ失敗として返す（成功と誤表示しない）。
 */

export const DIAGNOSIS_HISTORY_SCHEMA = "efb-diagnosis-history/v1";
export const DIAGNOSIS_HISTORY_MAX_ENTRIES = 50;
export const DIAGNOSIS_HISTORY_MAX_BYTES = 64 * 1024;
const LABEL_MAX = 60;

export interface DiagnosisHistoryEntry {
  id: string;
  /** 保存日時（ISO 8601）。 */
  savedAt: string;
  /** 同じスカッドの履歴をまとめるためのローカルID（表示・共有・エクスポートしない）。 */
  squadId: string;
  /** この端末で表示するためのラベル（スカッド名）。共有URL・エクスポートへは出さない。 */
  squadLabel: string;
  payload: SquadDiagnosisSharePayloadV1;
}

export type HistoryReadStatus = "ok" | "unavailable" | "scope_pending";
export interface HistoryRead {
  status: HistoryReadStatus;
  entries: DiagnosisHistoryEntry[];
  /** 除外した壊れた項目の数（全体が読めない場合は1）。 */
  corrupted: number;
}
export type HistoryWriteFailure = "unavailable" | "scope_pending" | "write_failed" | "invalid";
export type HistoryWriteResult<T = object> = ({ ok: true } & T) | { ok: false; reason: HistoryWriteFailure };

export function diagnosisHistoryKey(scope: StorageScope): string {
  return scope.kind === "guest"
    ? "efootball-team-ai:local:guest:diagnosis-history:v1"
    : `efootball-team-ai:local:account:${scope.scopeId}:diagnosis-history:v1`;
}
export function diagnosisHistoryQuarantineKey(scope: StorageScope): string {
  return diagnosisHistoryKey(scope).replace(/:v1$/, ":quarantine:v1");
}

/** テストから差し替えられる保存先（既定は window.localStorage。使えなければ null）。 */
export interface HistoryEnv {
  storage: () => Storage | null;
  scope: () => StorageScope | null;
  now: () => Date;
  randomId: () => string;
}

export const defaultHistoryEnv: HistoryEnv = {
  storage: () => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const probe = "__efb_history_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch {
      return null;
    }
  },
  scope: getCurrentScope,
  now: () => new Date(),
  randomId: () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18),
};

const ID_RE = /^dh_[a-z0-9]{8,32}$/;
const SQUAD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function cleanLabel(label: string): string {
  // 表示専用。制御文字を取り除き、長さを制限する（Reactが表示時にエスケープする）。
  const cleaned = [...label.normalize("NFC")].filter((ch) => {
    const c = ch.codePointAt(0)!;
    return c >= 0x20 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x202a && c <= 0x202e) && !(c >= 0x2066 && c <= 0x2069);
  });
  return cleaned.join("").trim().slice(0, LABEL_MAX);
}

function isEntry(v: unknown): v is DiagnosisHistoryEntry {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  const keys = Object.keys(e).sort().join(",");
  if (keys !== "id,payload,savedAt,squadId,squadLabel") return false;
  return (
    typeof e.id === "string" && ID_RE.test(e.id) &&
    typeof e.savedAt === "string" && !Number.isNaN(Date.parse(e.savedAt)) &&
    typeof e.squadId === "string" && SQUAD_ID_RE.test(e.squadId) &&
    typeof e.squadLabel === "string" && e.squadLabel.length <= LABEL_MAX &&
    validateSharePayload(e.payload) === null
  );
}

type RawRead = { kind: "empty" } | { kind: "ok"; entries: DiagnosisHistoryEntry[]; corrupted: number } | { kind: "unreadable"; raw: string };

function readRaw(ls: Storage, key: string): RawRead {
  let raw: string | null;
  try {
    raw = ls.getItem(key);
  } catch {
    return { kind: "unreadable", raw: "" };
  }
  if (raw == null) return { kind: "empty" };
  try {
    const d = JSON.parse(raw) as { schema?: unknown; entries?: unknown };
    if (!d || d.schema !== DIAGNOSIS_HISTORY_SCHEMA || !Array.isArray(d.entries)) return { kind: "unreadable", raw };
    const entries = d.entries.filter(isEntry);
    return { kind: "ok", entries, corrupted: d.entries.length - entries.length };
  } catch {
    return { kind: "unreadable", raw };
  }
}

export function readDiagnosisHistory(env: HistoryEnv = defaultHistoryEnv): HistoryRead {
  const scope = env.scope();
  if (!scope) return { status: "scope_pending", entries: [], corrupted: 0 };
  const ls = env.storage();
  if (!ls) return { status: "unavailable", entries: [], corrupted: 0 };
  const r = readRaw(ls, diagnosisHistoryKey(scope));
  if (r.kind === "empty") return { status: "ok", entries: [], corrupted: 0 };
  if (r.kind === "unreadable") return { status: "ok", entries: [], corrupted: 1 };
  return { status: "ok", entries: sortNewestFirst(r.entries), corrupted: r.corrupted };
}

function sortNewestFirst(entries: DiagnosisHistoryEntry[]): DiagnosisHistoryEntry[] {
  return entries.slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id));
}

/** 上限（件数・容量）に収めて書き込み、読み戻して確認する。全体が読めなかったデータは先に隔離キーへ退避する。 */
function writeEntries(ls: Storage, scope: StorageScope, entries: DiagnosisHistoryEntry[], unreadableRaw: string | null): { ok: true; trimmed: number } | { ok: false } {
  let kept = sortNewestFirst(entries).slice(0, DIAGNOSIS_HISTORY_MAX_ENTRIES);
  let text = JSON.stringify({ schema: DIAGNOSIS_HISTORY_SCHEMA, entries: kept });
  while (kept.length > 0 && new TextEncoder().encode(text).length > DIAGNOSIS_HISTORY_MAX_BYTES) {
    kept = kept.slice(0, -1);
    text = JSON.stringify({ schema: DIAGNOSIS_HISTORY_SCHEMA, entries: kept });
  }
  const key = diagnosisHistoryKey(scope);
  try {
    if (unreadableRaw) ls.setItem(diagnosisHistoryQuarantineKey(scope), unreadableRaw.slice(0, DIAGNOSIS_HISTORY_MAX_BYTES));
    if (kept.length === 0) ls.removeItem(key);
    else ls.setItem(key, text);
    const back = ls.getItem(key);
    if (kept.length === 0 ? back != null : back !== text) return { ok: false };
  } catch {
    return { ok: false };
  }
  return { ok: true, trimmed: entries.length - kept.length };
}

function sameResult(a: SquadDiagnosisSharePayloadV1, b: SquadDiagnosisSharePayloadV1): boolean {
  // 日付だけが違う同じ結果は重複とみなす。
  return JSON.stringify({ ...a, d: "" }) === JSON.stringify({ ...b, d: "" });
}

export function addDiagnosisHistory(
  input: { payload: SquadDiagnosisSharePayloadV1; squadId: string; squadLabel: string },
  env: HistoryEnv = defaultHistoryEnv,
): HistoryWriteResult<{ entry: DiagnosisHistoryEntry; duplicate: boolean; trimmed: number }> {
  const scope = env.scope();
  if (!scope) return { ok: false, reason: "scope_pending" };
  const ls = env.storage();
  if (!ls) return { ok: false, reason: "unavailable" };
  if (validateSharePayload(input.payload) !== null || !SQUAD_ID_RE.test(input.squadId)) return { ok: false, reason: "invalid" };
  const r = readRaw(ls, diagnosisHistoryKey(scope));
  const existing = r.kind === "ok" ? sortNewestFirst(r.entries) : [];
  const latestSame = existing.find((e) => e.squadId === input.squadId);
  if (latestSame && sameResult(latestSame.payload, input.payload)) return { ok: true, entry: latestSame, duplicate: true, trimmed: 0 };
  const entry: DiagnosisHistoryEntry = {
    id: `dh_${env.randomId().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16).padEnd(8, "0")}`,
    savedAt: env.now().toISOString(),
    squadId: input.squadId,
    squadLabel: cleanLabel(input.squadLabel),
    payload: input.payload,
  };
  const w = writeEntries(ls, scope, [entry, ...existing], r.kind === "unreadable" ? r.raw : null);
  if (!w.ok) return { ok: false, reason: "write_failed" };
  return { ok: true, entry, duplicate: false, trimmed: w.trimmed };
}

export function removeDiagnosisHistoryEntry(id: string, env: HistoryEnv = defaultHistoryEnv): HistoryWriteResult<{ removed: boolean }> {
  const scope = env.scope();
  if (!scope) return { ok: false, reason: "scope_pending" };
  const ls = env.storage();
  if (!ls) return { ok: false, reason: "unavailable" };
  const r = readRaw(ls, diagnosisHistoryKey(scope));
  if (r.kind !== "ok") return { ok: true, removed: false };
  const next = r.entries.filter((e) => e.id !== id);
  if (next.length === r.entries.length) return { ok: true, removed: false };
  const w = writeEntries(ls, scope, next, null);
  return w.ok ? { ok: true, removed: true } : { ok: false, reason: "write_failed" };
}

export function clearDiagnosisHistory(env: HistoryEnv = defaultHistoryEnv): HistoryWriteResult {
  const scope = env.scope();
  if (!scope) return { ok: false, reason: "scope_pending" };
  const ls = env.storage();
  if (!ls) return { ok: false, reason: "unavailable" };
  try {
    ls.removeItem(diagnosisHistoryKey(scope));
    ls.removeItem(diagnosisHistoryQuarantineKey(scope));
    if (ls.getItem(diagnosisHistoryKey(scope)) != null || ls.getItem(diagnosisHistoryQuarantineKey(scope)) != null) return { ok: false, reason: "write_failed" };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
  return { ok: true };
}

/** 端末へ保存するJSON（スカッドID・内部IDは含めない。スカッド名はこの端末の利用者自身の表示ラベルとして含める）。 */
export function exportDiagnosisHistoryJson(entries: readonly DiagnosisHistoryEntry[], exportedAt: Date): string {
  return `${JSON.stringify(
    {
      schema: "efb-diagnosis-history-export/v1",
      exportedAt: exportedAt.toISOString(),
      entries: entries.map((e) => ({ savedAt: e.savedAt, squadLabel: e.squadLabel, payload: e.payload })),
    },
    null,
    2,
  )}\n`;
}
