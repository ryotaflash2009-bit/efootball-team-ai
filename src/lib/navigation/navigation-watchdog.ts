/**
 * 画面の移動が終わらないときの安全策（2026-10-05・早めの判定 2026-10-07）。
 *
 * Production の確認で、クライアント側の画面の移動のおよそ 1% が終わらないことが分かった（RSC の応答は 0.3 秒で
 * 届き、必要な JS も読み込み済みだが、Next.js の router の transition が確定せず URL も画面も変わらない。75 秒待っても
 * 変わらない）。こちらのコードは Suspense を起こす API を使っておらず、原因は Next.js / React の内部にある。
 * 利用者が操作の結果を受け取れるように、移動が NAVIGATION_WATCHDOG_MS の間に確定せず、利用者も別の場所へ
 * 移っていなければ、同じ URL へ通常のブラウザーの移動をする（内容は同じ・読み込みが 1 回増えるだけ）。
 *
 * 早めの判定（`early` を渡したときだけ）: 移動先の RSC の応答が届いてから NAVIGATION_EARLY_GRACE_MS たっても確定せず、
 * 通信も NAVIGATION_NETWORK_QUIET_MS 静かなら、5 秒を待たずに同じ通常の移動をする（止まった移動は約 1.8 秒で戻る）。
 * 根拠（2026-10-07・Production・新しい RSC を取る一覧 → 詳細の移動 120 回）: RSC の応答から確定までは p50 23 ms・
 * PC の最大 278 ms・携帯の最大 62 ms。1.5 秒は最大の 5 倍以上（docs/production-readiness/navigation-fallback-v1.1.md）。
 * RSC の応答がまだ（遅い回線・prefetch 済みで要らない）なら早めの判定はせず、従来の 5 秒だけ。
 *
 * - 戻る・進む（traverse）は対象外（ブラウザーの履歴の復元で、同じ問題は確認していない）。
 * - 別のオリジン・同じ URL（ハッシュだけの違いを含む）は対象外。
 * - 新しい移動が始まったら前の見張りは取り消す。
 * - 確定・リダイレクト・利用者の別の操作で URL が変わっていれば何もしない。
 */
export const NAVIGATION_WATCHDOG_MS = 5000;
export const NAVIGATION_EARLY_GRACE_MS = 1500;
export const NAVIGATION_NETWORK_QUIET_MS = 500;
export const NAVIGATION_POLL_MS = 250;

/** 早めの判定に使う、ブラウザーの観測（Resource Timing）。時刻は now() と同じ基準（performance.now()）。 */
export type NavigationEarlySignals = {
  now: () => number;
  /** 移動先の RSC の応答の完了の時刻（`since` 以降に始まったものだけ）。無ければ null。 */
  rscCompletedAt: (target: URL, since: number) => number | null;
  /** 最後に通信が終わった時刻。 */
  lastNetworkActivityAt: () => number;
};

export type NavigationWatchdogEnv = {
  href: () => string;
  assign: (url: string) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  early?: NavigationEarlySignals;
};

export type RouterTransitionType = "push" | "replace" | "traverse";

export function createNavigationWatchdog(env: NavigationWatchdogEnv, ms: number = NAVIGATION_WATCHDOG_MS) {
  let timer: unknown = null;
  let poll: unknown = null;
  const stop = () => {
    if (timer !== null) env.clearTimeout(timer);
    if (poll !== null) env.clearTimeout(poll);
    timer = null;
    poll = null;
  };
  return function onRouterTransitionStart(href: string, type: RouterTransitionType): void {
    stop();
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
    const fallback = () => {
      stop();
      if (env.href() !== from) return;
      env.assign(target.href);
    };
    timer = env.setTimeout(fallback, ms);

    const early = env.early;
    if (!early) return;
    const startedAt = early.now();
    const check = () => {
      poll = null;
      if (timer === null) return; // 取り消し済み・実行済み
      if (env.href() !== from) {
        stop(); // 確定した（または別の移動）
        return;
      }
      const now = early.now();
      const rscAt = early.rscCompletedAt(target, startedAt);
      if (rscAt !== null && now - rscAt >= NAVIGATION_EARLY_GRACE_MS && now - early.lastNetworkActivityAt() >= NAVIGATION_NETWORK_QUIET_MS) {
        fallback();
        return;
      }
      if (now - startedAt < ms) poll = env.setTimeout(check, NAVIGATION_POLL_MS);
    };
    poll = env.setTimeout(check, NAVIGATION_POLL_MS);
  };
}

/** ブラウザーの Resource Timing から早めの判定の観測を作る（instrumentation-client.ts から使う）。 */
export function browserEarlySignals(perf: Performance): NavigationEarlySignals {
  return {
    now: () => perf.now(),
    rscCompletedAt: (target, since) => {
      let latest: number | null = null;
      for (const e of perf.getEntriesByType("resource") as PerformanceResourceTiming[]) {
        if (e.startTime < since || !e.name.includes("_rsc=")) continue;
        let u: URL;
        try {
          u = new URL(e.name);
        } catch {
          continue;
        }
        if (u.origin !== target.origin || u.pathname !== target.pathname) continue;
        if (latest === null || e.responseEnd > latest) latest = e.responseEnd;
      }
      return latest;
    },
    lastNetworkActivityAt: () => {
      let last = 0;
      for (const e of perf.getEntriesByType("resource") as PerformanceResourceTiming[]) if (e.responseEnd > last) last = e.responseEnd;
      return last;
    },
  };
}
