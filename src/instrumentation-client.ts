import { createNavigationWatchdog } from "@/lib/navigation/navigation-watchdog";

// Next.js が画面の移動の開始ごとに呼ぶ（クライアントだけ）。終わらない移動の安全策は navigation-watchdog.ts を参照。
export const onRouterTransitionStart = createNavigationWatchdog({
  href: () => window.location.href,
  assign: (url) => window.location.assign(url),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
});
