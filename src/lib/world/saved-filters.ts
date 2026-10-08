import { getCurrentScope } from "@/lib/local-storage-scope/current-scope-store";

/**
 * 選手一覧の保存した絞り込み（NEW-31・2026-10-09・端末だけ）。
 * - 今の絞り込み（URL のクエリ）を名前をつけて保存し、選ぶと同じ条件の一覧へ移る。最大 10 件。
 * - 保存するのは決まった絞り込みの項目だけ（ページ番号・未知の項目は保存しない）。値の長さも制限する。
 * - キーはスコープ（ゲスト・アカウント）ごと。サーバーへは送らない。
 */
export const SAVED_FILTERS_SCHEMA = "saved-player-filters/2026-10-09.v1";
export const MAX_SAVED_FILTERS = 10;
export const SAVED_FILTER_NAME_MAX = 30;
export const SAVED_FILTER_PARAMS = ["q", "position", "cardType", "playingStyle", "playingStyleDef", "minOvr", "maxOvr", "hasBooster", "sort"] as const;
const VALUE_MAX = 60;
const ID_RE = /^sf_[a-z0-9]{6,16}$/;

export interface SavedPlayerFilter {
  id: string;
  name: string;
  /** URLSearchParams の文字列（決まった項目だけ・並びは SAVED_FILTER_PARAMS の順）。 */
  query: string;
  createdAt: string;
}

interface Store {
  schema: typeof SAVED_FILTERS_SCHEMA;
  items: SavedPlayerFilter[];
}

export function savedFiltersStorageKey(scope: { kind: "guest" } | { kind: "account"; scopeId: string }): string {
  return scope.kind === "guest" ? "efootball-team-ai:local:guest:saved-player-filters:v1" : `efootball-team-ai:local:account:${scope.scopeId}:saved-player-filters:v1`;
}

export function activeSavedFiltersKey(): string | null {
  const scope = getCurrentScope();
  return scope ? savedFiltersStorageKey(scope) : null;
}

/** 名前を表示用に整える（制御文字・双方向の制御文字を除き、空白をまとめ、長さを制限）。空なら null。 */
export function cleanFilterName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\t\n\r]/g, " ").replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return [...s].slice(0, SAVED_FILTER_NAME_MAX).join("");
}

/** 絞り込みのクエリを決まった項目だけに整える（ページ番号・未知の項目を除く）。何も無ければ空文字。 */
export function normalizeFilterQuery(input: string | URLSearchParams): string {
  const src = typeof input === "string" ? new URLSearchParams(input.replace(/^\?/, "")) : input;
  const out = new URLSearchParams();
  for (const k of SAVED_FILTER_PARAMS) {
    const v = src.get(k);
    if (v == null) continue;
    // eslint-disable-next-line no-control-regex
    const clean = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (clean) out.set(k, [...clean].slice(0, VALUE_MAX).join(""));
  }
  return out.toString();
}

function sanitizeItem(raw: unknown): SavedPlayerFilter | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const name = cleanFilterName(o.name);
  if (typeof o.id !== "string" || !ID_RE.test(o.id) || !name || typeof o.query !== "string" || typeof o.createdAt !== "string") return null;
  return { id: o.id, name, query: normalizeFilterQuery(o.query), createdAt: o.createdAt.slice(0, 40) };
}

export function loadSavedFilters(ls: Storage | null, key: string | null): SavedPlayerFilter[] {
  if (!ls || !key) return [];
  try {
    const raw = ls.getItem(key);
    if (!raw) return [];
    const d = JSON.parse(raw) as Partial<Store>;
    if (d?.schema !== SAVED_FILTERS_SCHEMA || !Array.isArray(d.items)) return [];
    return d.items.map(sanitizeItem).filter((x): x is SavedPlayerFilter => x !== null).slice(0, MAX_SAVED_FILTERS);
  } catch {
    return [];
  }
}

function write(ls: Storage, key: string, items: SavedPlayerFilter[]): boolean {
  try {
    ls.setItem(key, JSON.stringify({ schema: SAVED_FILTERS_SCHEMA, items } satisfies Store));
    return true;
  } catch {
    return false;
  }
}

export type SaveFilterResult = { ok: true; items: SavedPlayerFilter[]; replaced: boolean } | { ok: false; reason: "invalid_name" | "empty_query" | "full" | "storage" };

/** 保存（同じ名前があれば上書き）。 */
export function saveFilter(ls: Storage | null, key: string | null, rawName: unknown, query: string, now: string, newId: () => string): SaveFilterResult {
  if (!ls || !key) return { ok: false, reason: "storage" };
  const name = cleanFilterName(rawName);
  if (!name) return { ok: false, reason: "invalid_name" };
  const q = normalizeFilterQuery(query);
  if (!q) return { ok: false, reason: "empty_query" };
  const items = loadSavedFilters(ls, key);
  const i = items.findIndex((x) => x.name === name);
  let next: SavedPlayerFilter[];
  if (i >= 0) next = items.map((x, j) => (j === i ? { ...x, query: q } : x));
  else {
    if (items.length >= MAX_SAVED_FILTERS) return { ok: false, reason: "full" };
    next = [...items, { id: newId(), name, query: q, createdAt: now }];
  }
  return write(ls, key, next) ? { ok: true, items: next, replaced: i >= 0 } : { ok: false, reason: "storage" };
}

export function deleteFilter(ls: Storage | null, key: string | null, id: string): SavedPlayerFilter[] | null {
  if (!ls || !key) return null;
  const next = loadSavedFilters(ls, key).filter((x) => x.id !== id);
  return write(ls, key, next) ? next : null;
}

export function newSavedFilterId(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `sf_${[...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12)}`;
}
