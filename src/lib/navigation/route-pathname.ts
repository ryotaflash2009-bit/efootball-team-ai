/**
 * ナビの「現在のページ」の判定に使うパス名（2026-10-26）。
 * Vercel でホーム（ISR）を作り直すと、サーバーの描画で usePathname() が "/index" を返す（HTML の c: ["", "index"]）。
 * ブラウザーでは "/" なので、そのまま比べるとサイドメニューの印が食い違い React #418 になっていた。"/index" は "/" として扱う。
 */
export function routePathname(pathname: string | null | undefined): string {
  if (!pathname || pathname === "/index") return "/";
  return pathname;
}
