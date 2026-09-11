import type { ManagerListQuery, ManagerSortKey } from "./types";

export const MANAGER_MAX_QUERY_LEN = 80;
export const MANAGER_MAX_PAGE_SIZE = 100;
export const MANAGER_DEFAULT_PAGE_SIZE = 24;

/** internal_manager_id: 正の整数 */
export const MANAGER_ID_RE = /^[0-9]{1,12}$/;

export const MANAGER_SORT_KEYS: readonly ManagerSortKey[] = [
  "name",
  "released_desc",
  "released_asc",
  "possession_desc",
  "quick_counter_desc",
  "long_ball_counter_desc",
  "out_wide_desc",
  "long_ball_desc",
  "overload_desc",
] as const;

export function normalizeManagerQuery(raw: string): string {
  return raw.replace(/　/g, " ").trim().replace(/\s+/g, " ").slice(0, MANAGER_MAX_QUERY_LEN);
}

export function parseManagerListQuery(input: {
  page?: string | null;
  pageSize?: string | null;
  q?: string | null;
  sort?: string | null;
  hasBooster?: string | null;
  hasLinkUpPlay?: string | null;
}): ManagerListQuery {
  const pageRaw = Number(input.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

  const psRaw = Number(input.pageSize);
  const pageSize =
    Number.isFinite(psRaw) && psRaw > 0 ? Math.min(Math.trunc(psRaw), MANAGER_MAX_PAGE_SIZE) : MANAGER_DEFAULT_PAGE_SIZE;

  const sort: ManagerSortKey = (MANAGER_SORT_KEYS as readonly string[]).includes(input.sort ?? "")
    ? (input.sort as ManagerSortKey)
    : "name";

  const bool = (v: string | null | undefined): boolean | null =>
    v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : null;

  return {
    page,
    pageSize,
    query: normalizeManagerQuery(typeof input.q === "string" ? input.q : ""),
    sort,
    hasBooster: bool(input.hasBooster),
    hasLinkUpPlay: bool(input.hasLinkUpPlay),
  };
}
