import { checkRelationChange, checkReport, reportSchema, type Report, type ReportCheck, type ReportReason, type ReportTarget } from "./safety-model";

/**
 * F-056 安全機能のローカル/モックの保存（この端末・この領域だけ。サーバーへ送らない）。
 * 架空のサンプル投稿に対する通報・ブロック・ミュートの動きを確かめるためのもの。
 */
export interface SafetyState {
  reports: Report[];
  blocked: string[];
  muted: string[];
  blockLog: string[];
}
/** 毎回新しい配列を返す（共有の配列へ書き込んで別の領域へ漏れないように）。 */
const empty = (): SafetyState => ({ reports: [], blocked: [], muted: [], blockLog: [] });

export function safetyStorageKey(scopeKey: string): string {
  return scopeKey === "guest" ? "efootball-team-ai:local:guest:safety-mock:v1" : `efootball-team-ai:local:${scopeKey}:safety-mock:v1`;
}

export function readSafety(ls: Storage, scopeKey: string): SafetyState {
  try {
    const raw = ls.getItem(safetyStorageKey(scopeKey));
    if (!raw) return empty();
    const j = JSON.parse(raw) as Partial<SafetyState>;
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[a-z0-9_-]{3,40}$/.test(x)) : []);
    return {
      reports: Array.isArray(j.reports) ? j.reports.filter((r) => reportSchema.safeParse(r).success) : [],
      blocked: strings(j.blocked),
      muted: strings(j.muted),
      blockLog: Array.isArray(j.blockLog) ? j.blockLog.filter((x): x is string => typeof x === "string").slice(-200) : [],
    };
  } catch {
    return empty();
  }
}

function write(ls: Storage, scopeKey: string, s: SafetyState): boolean {
  try {
    ls.setItem(safetyStorageKey(scopeKey), JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function submitReport(
  ls: Storage,
  scopeKey: string,
  input: { reporter: string; targetKind: ReportTarget; targetId: string; targetOwner: string; reason: ReportReason; note: string },
  now: Date,
  newId: () => string,
): ReportCheck | { ok: false; reason: "write_failed" } {
  const s = readSafety(ls, scopeKey);
  const check = checkReport(input, s.reports, now.getTime());
  if (!check.ok) return check;
  const iso = now.toISOString();
  s.reports.push({ id: newId(), ...input, note: input.note.trim(), status: "open", createdAt: iso, updatedAt: iso });
  return write(ls, scopeKey, s) ? { ok: true } : { ok: false, reason: "write_failed" };
}

export function withdrawReport(ls: Storage, scopeKey: string, reportId: string, now: Date): boolean {
  const s = readSafety(ls, scopeKey);
  const r = s.reports.find((x) => x.id === reportId && (x.status === "open" || x.status === "reviewing"));
  if (!r) return false;
  r.status = "withdrawn";
  r.updatedAt = now.toISOString();
  return write(ls, scopeKey, s);
}

export function setRelation(ls: Storage, scopeKey: string, self: string, kind: "block" | "mute", target: string, on: boolean, now: Date): { ok: true } | { ok: false; reason: "self" | "rate_limited" | "invalid" | "write_failed" } {
  const s = readSafety(ls, scopeKey);
  const dayAgo = now.getTime() - 86_400_000;
  const recent = s.blockLog.filter((t) => Date.parse(t) > dayAgo).length;
  if (on) {
    const c = checkRelationChange(kind, self, target, recent);
    if (!c.ok) return c;
  }
  const list = kind === "block" ? s.blocked : s.muted;
  const next = on ? [...new Set([...list, target])] : list.filter((x) => x !== target);
  if (kind === "block") {
    s.blocked = next;
    if (on) s.blockLog.push(now.toISOString());
  } else s.muted = next;
  return write(ls, scopeKey, s) ? { ok: true } : { ok: false, reason: "write_failed" };
}
