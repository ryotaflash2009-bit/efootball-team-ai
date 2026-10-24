import { POSITION_ORDER } from "./own-tier";

const DEFAULT_POSITION = "CF";

/**
 * ティアリストの転送先（2026-10-24・ミドルウェアで使う）。転送しないときは null。
 * - `/tier` と `/tier?position=xx` → `/tier/XX`（大文字・小文字を問わない。知らないポジションは CF）
 * - `/tier/xx`（小文字など）→ `/tier/XX`（13 のポジションのどれかのときだけ）
 * クエリは引き継がない（同じ中身の URL を増やさない）。
 */
export function tierRedirectTarget(pathname: string, position: string | null): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/tier") {
    const p = (position ?? "").toUpperCase();
    return `/tier/${POSITION_ORDER.includes(p) ? p : DEFAULT_POSITION}`;
  }
  const m = /^\/tier\/([A-Za-z]{2,3})$/.exec(path);
  if (m && m[1] !== m[1].toUpperCase() && POSITION_ORDER.includes(m[1].toUpperCase())) return `/tier/${m[1].toUpperCase()}`;
  return null;
}
