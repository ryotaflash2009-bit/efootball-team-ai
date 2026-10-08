/**
 * 別のサイトからの書き込みの要求を見分ける（2026-10-09・NEW-39・多層防御）。
 * Origin が無い（同じサイトの古いブラウザー・サーバー間）ときは同じサイトとして扱う。Origin が壊れていれば別のサイト扱い。
 */
export function isCrossOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}
