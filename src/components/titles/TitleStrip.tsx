"use client";

import "@/lib/i18n/dictionaries/ja-ns/titles";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

export interface TitleItem {
  id: string;
  label: string;
  /** なぜこの称号・バッジなのか（根拠の値）。 */
  reason: string;
}

/**
 * F-072 称号（最大1つ）とバッジ（最大4つ）の表示。根拠と規則の版は「理由」を開くと見える。
 */
export function TitleStrip({
  primary,
  badges,
  explanation,
  rulesVersion,
  testId,
}: {
  primary: TitleItem | null;
  badges: TitleItem[];
  explanation: string;
  rulesVersion: string;
  testId: string;
}) {
  const t = useT();
  const tt = (k: keyof Dictionary["titles"]) => t("titles", k);
  if (!primary && badges.length === 0) {
    return (
      <p className="text-2xs text-text-muted" data-testid={testId} data-title-count="0">
        {tt("none")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId} data-title-count={(primary ? 1 : 0) + badges.length}>
      <div className="flex flex-wrap items-center gap-1.5">
        {primary ? (
          <span className="flex items-center gap-1" data-title-kind="primary" data-title-id={primary.id}>
            <span className="text-2xs text-text-dim">{tt("primaryLabel")}</span>
            <Badge tone="accent" size="sm">
              {primary.label}
            </Badge>
          </span>
        ) : null}
        {badges.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1" aria-label={tt("badgesLabel")}>
            {badges.map((b) => (
              <span key={b.id} data-title-kind="badge" data-title-id={b.id}>
                <Badge tone="outline" size="xs">
                  {b.label}
                </Badge>
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <details className="text-2xs text-text-dim">
        <summary className="inline-flex min-h-[32px] cursor-pointer items-center">{tt("whySummary")}</summary>
        <ul className="mt-1 flex flex-col gap-0.5">
          {[...(primary ? [primary] : []), ...badges].map((x) => (
            <li key={x.id}>
              <span className="font-semibold text-text">{x.label}</span>: {x.reason}
            </li>
          ))}
        </ul>
        <p className="mt-1">{explanation}</p>
        <p className="mt-0.5 text-text-muted">{tt("rulesVersionTemplate").replace("{version}", rulesVersion)}</p>
      </details>
    </div>
  );
}
