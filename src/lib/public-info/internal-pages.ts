/**
 * 開発者向けの内部ページ(一般利用者へ見せない)の表示可否。
 *
 * fail-closed: 表示するのは「ローカル開発(NODE_ENV=development)」か、
 * `NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled` を明示した場合だけ。Production build・Vercel Preview・
 * test・未設定・想定外の値ではすべて非表示(ページは404、フッター等の導線も出さない)。
 * `NEXT_PUBLIC_*` はクライアントへ埋め込まれるが、真偽の切替だけで秘密情報ではない。
 */

export const INTERNAL_PAGE_PATHS = Object.freeze(["/account/rls-test", "/release-readiness"] as const);

export interface InternalPagesEnv {
  readonly NODE_ENV?: string;
  readonly NEXT_PUBLIC_EFTA_INTERNAL_PAGES?: string;
}

export function areInternalPagesVisible(
  env: InternalPagesEnv = { NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_EFTA_INTERNAL_PAGES: process.env.NEXT_PUBLIC_EFTA_INTERNAL_PAGES },
): boolean {
  if (env.NEXT_PUBLIC_EFTA_INTERNAL_PAGES === "enabled") return true;
  return env.NODE_ENV === "development";
}

export function isInternalPagePath(href: string): boolean {
  return (INTERNAL_PAGE_PATHS as readonly string[]).includes(href);
}
