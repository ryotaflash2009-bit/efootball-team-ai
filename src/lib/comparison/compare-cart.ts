import { COMPARISON_MAX } from "./types";

/**
 * 「比較へ追加」の一時保持（sessionStorage）。World カード ID のみ。個人情報・秘密情報は保存しない。
 * 各ページから追加でき、/compare がこれと URL の ?ids を読む。
 */
const KEY = "efb:compare-ids:v1";
const WORLD_ID_RE = /^[0-9]{1,20}$/;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.sessionStorage;
    s.setItem("__efb_probe__", "1");
    s.removeItem("__efb_probe__");
    return s;
  } catch {
    return null;
  }
}

export function getCompareIds(): string[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const v of arr) {
      if (typeof v === "string" && WORLD_ID_RE.test(v) && !out.includes(v) && out.length < COMPARISON_MAX) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export type AddResult = "added" | "already" | "full" | "invalid";

export function addCompareId(worldCardId: string): { result: AddResult; ids: string[] } {
  if (!WORLD_ID_RE.test(worldCardId)) return { result: "invalid", ids: getCompareIds() };
  const ids = getCompareIds();
  if (ids.includes(worldCardId)) return { result: "already", ids };
  if (ids.length >= COMPARISON_MAX) return { result: "full", ids };
  const next = [...ids, worldCardId];
  write(next);
  return { result: "added", ids: next };
}

export function removeCompareId(worldCardId: string): string[] {
  const next = getCompareIds().filter((id) => id !== worldCardId);
  write(next);
  return next;
}

export function setCompareIds(ids: string[]): void {
  const clean: string[] = [];
  for (const id of ids) {
    if (WORLD_ID_RE.test(id) && !clean.includes(id) && clean.length < COMPARISON_MAX) clean.push(id);
  }
  write(clean);
}
