/**
 * 画面の移動が終わらないときの安全策（2026-10-05）。
 *
 * Production の確認で、クライアント側の画面の移動のおよそ 1% が終わらないことが分かった（RSC の応答は 0.3 秒で
 * 届き、必要な JS も読み込み済みだが、Next.js の router の transition が確定せず URL も画面も変わらない。75 秒待っても
 * 変わらない）。こちらのコードは Suspense を起こす API を使っておらず、原因は Next.js / React の内部にある。
 * 利用者が操作の結果を受け取れるように、移動が NAVIGATION_WATCHDOG_MS の間に確定せず、利用者も別の場所へ
 * 移っていなければ、同じ URL へ通常のブラウザーの移動をする（内容は同じ・読み込みが 1 回増えるだけ）。
 *
 * - 戻る・進む（traverse）は対象外（ブラウザーの履歴の復元で、同じ問題は確認していない）。
 * - 別のオリジン・同じ URL（ハッシュだけの違いを含む）は対象外。
 * - 新しい移動が始まったら前の見張りは取り消す。
 * - 確定・リダイレクト・利用者の別の操作で URL が変わっていれば何もしない。
 */
export const NAVIGATION_WATCHDOG_MS = 5000;

export type NavigationWatchdogEnv = {
  href: () => string;
  assign: (url: string) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type RouterTransitionType = "push" | "replace" | "traverse";

export function createNavigationWatchdog(env: NavigationWatchdogEnv, ms: number = NAVIGATION_WATCHDOG_MS) {
  let timer: unknown = null;
  return function onRouterTransitionStart(href: string, type: RouterTransitionType): void {
    if (timer !== null) {
      env.clearTimeout(timer);
      timer = null;
    }
    if (type === "traverse") return;
    const from = env.href();
    let fromUrl: URL;
    let target: URL;
    try {
      fromUrl = new URL(from);
      target = new URL(href, from);
    } catch {
      return;
    }
    if (target.origin !== fromUrl.origin) return;
    if (target.pathname + target.search === fromUrl.pathname + fromUrl.search) return;
    timer = env.setTimeout(() => {
      timer = null;
      if (env.href() !== from) return;
      env.assign(target.href);
    }, ms);
  };
}
