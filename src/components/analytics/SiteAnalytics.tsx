"use client";

import dynamic from "next/dynamic";

/**
 * Vercel Web Analytics を別の chunk で遅れて読み込む（最初の表示の JS を増やさない・SSR しない）。
 * 本体と URL の整理は SiteAnalyticsInner.tsx・src/lib/analytics/sanitize-analytics-event.ts。
 */
const SiteAnalyticsInner = dynamic(() => import("./SiteAnalyticsInner"), { ssr: false });

export function SiteAnalytics() {
  return <SiteAnalyticsInner />;
}
