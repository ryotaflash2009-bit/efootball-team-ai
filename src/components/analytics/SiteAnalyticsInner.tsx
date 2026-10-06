"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { readAnalyticsEnv, sanitizeAnalyticsEvent } from "@/lib/analytics/sanitize-analytics-event";

/**
 * Vercel Web Analytics（Hobby・Page Views と Visitors だけ・Custom Event なし・Cookie なし）。root layout に 1 回だけ置く。
 * 送る前に URL を整える（query・fragment を落とす・認証・アカウント・内部ページは送らない・自動のブラウザーは送らない）。
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return sanitizeAnalyticsEvent(event, readAnalyticsEnv());
}

export default function SiteAnalyticsInner() {
  return <Analytics beforeSend={beforeSend} />;
}
