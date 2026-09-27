"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { Badge } from "@/components/ui/Badge";
import { useBestXiProgressionCards } from "@/lib/best-xi/use-candidate-cards";
import { useWorldBasePercentiles } from "@/lib/percentiles/use-world-base-percentiles";
import { cardBasePercentiles, scopeKeyFor } from "@/lib/percentiles/card-percentiles";
import { discoverYourBest, YOUR_BEST_RULES_VERSION } from "@/lib/titles/your-best";
import { BUCKET_LABEL_KEY } from "@/components/world/WorldBasePercentilePanel";
import { RULE_LABEL_KEY } from "./PlayerTitles";

/**
 * F-073「あなたの一番」（My Team）。開いたときだけ、My Team のカードの基礎能力値を読み込む（閉じている間は通信しない）。
 * F-071 の分布が照合できないときは、照合できない旨だけを表示する。
 */
export function YourBestPanel({ ids, nameOf }: { ids: string[]; nameOf: (id: string) => string }) {
  const t = useT();
  const yb = (k: keyof Dictionary["yourBest"]) => t("yourBest", k);
  const [open, setOpen] = useState(false);
  const data = useWorldBasePercentiles(open);
  const { cards, loading } = useBestXiProgressionCards(open ? ids : []);

  const entries = useMemo(() => {
    if (data.state !== "ready") return null;
    const inputs = [...cards.values()].flatMap((c) => {
      const scopeKey = scopeKeyFor("role", c.registeredPosition);
      if (!scopeKey) return [];
      const missing = new Set(c.missingBaseStatKeys ?? []);
      const stats = Object.entries(c.baseStats)
        .filter(([k]) => !missing.has(k))
        .map(([key, value]) => ({ key, value }));
      return [{ worldCardId: c.worldCardId, role: scopeKey === "gk" ? ("gk" as const) : ("field" as const), percentiles: cardBasePercentiles(data.scopes.get(scopeKey), stats) }];
    });
    return discoverYourBest(inputs);
  }, [data, cards]);

  return (
    <details className="rounded-card border border-border bg-surface p-3" data-testid="your-best" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex min-h-[36px] cursor-pointer items-center text-sm font-semibold">{yb("heading")}</summary>
      <p className="mt-1 text-2xs text-text-dim">{yb("explanation")}</p>
      {!open ? null : data.state === "unavailable" ? (
        <p className="mt-2 text-xs text-warning" role="status">
          {t("basePercentile", "fallback")}
        </p>
      ) : data.state === "loading" || loading || !entries ? (
        <p className="mt-2 text-xs text-text-muted" role="status">
          {t("basePercentile", "loading")}
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted" role="status">
          {yb("none")}
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2" data-testid="your-best-list">
          {entries.map((e) => (
            <li key={e.ruleId} className="flex min-w-0 items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5 text-xs" data-rule={e.ruleId}>
              <span className="shrink-0 font-semibold">{t("titles", RULE_LABEL_KEY[e.ruleId])}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <Link href={`/players/world/${encodeURIComponent(e.worldCardId)}`} className="min-w-0 truncate text-accent hover:underline">
                  {nameOf(e.worldCardId)}
                </Link>
                <Badge tone="outline" size="xs">
                  {t("basePercentile", BUCKET_LABEL_KEY[e.weakestBucket])}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      {open ? <p className="mt-1.5 text-2xs text-text-muted">{t("titles", "rulesVersionTemplate").replace("{version}", YOUR_BEST_RULES_VERSION)}</p> : null}
    </details>
  );
}
