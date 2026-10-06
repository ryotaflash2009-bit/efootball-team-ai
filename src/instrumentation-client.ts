import { browserEarlySignals, createNavigationWatchdog } from "@/lib/navigation/navigation-watchdog";

// Next.js が画面の移動の開始ごとに呼ぶ（クライアントだけ）。終わらない移動の安全策は navigation-watchdog.ts を参照。
export const onRouterTransitionStart = createNavigationWatchdog({
  href: () => window.location.href,
  assign: (url) => window.location.assign(url),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  // 止まった移動を早く戻す（RSC の応答の 1.5 秒後・通信が静か）。Resource Timing が無い環境では従来の 5 秒だけ。
  early: typeof performance !== "undefined" && typeof performance.getEntriesByType === "function" ? browserEarlySignals(performance) : undefined,
});
