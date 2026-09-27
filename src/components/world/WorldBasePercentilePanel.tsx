"use client";

import { useMemo, useState } from "react";
import type { WorldStatValue, WorldStatGroup } from "@/lib/world/types";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { Badge } from "@/components/ui/Badge";
import { useWorldBasePercentiles } from "@/lib/percentiles/use-world-base-percentiles";
import { cardBasePercentiles, scopeKeyFor, type PercentileScopeChoice } from "@/lib/percentiles/card-percentiles";
import type { PercentileBucket } from "@/lib/percentiles/distribution";

type BpKey = keyof Dictionary["basePercentile"];

export const BUCKET_LABEL_KEY: Record<PercentileBucket, BpKey> = {
  top_lt1: "bucketTopLt1",
  top1: "bucketTop1",
  top5: "bucketTop5",
  top10: "bucketTop10",
  top25: "bucketTop25",
  top50: "bucketTop50",
  below_median: "bucketBelowMedian",
};
const BUCKET_TONE: Record<PercentileBucket, "accent" | "info" | "neutral" | "outline"> = {
  top_lt1: "accent",
  top1: "accent",
  top5: "info",
  top10: "info",
  top25: "neutral",
  top50: "neutral",
  below_median: "outline",
};
const GROUP_ORDER: WorldStatGroup[] = ["offense", "defense", "physical", "gk"];

/**
 * F-071: 選手詳細の「能力値」タブ。育成前の基礎能力値が、現在の World カードの分布のどこにあるか（範囲は1つずつ）。
 * 成果物が applied-state と一致しないときは、照合できない旨だけを表示する（推測の値を出さない）。
 */
export function WorldBasePercentilePanel({ stats, registeredPosition }: { stats: WorldStatValue[]; registeredPosition: string | null }) {
  const t = useT();
  const { locale } = useLocale();
  const bp = (k: BpKey) => t("basePercentile", k);
  const data = useWorldBasePercentiles();
  const [choice, setChoice] = useState<PercentileScopeChoice>("all");

  const scopeKey = scopeKeyFor(choice, registeredPosition);
  const rows = useMemo(() => {
    if (data.state !== "ready" || !scopeKey) return null;
    return cardBasePercentiles(data.scopes.get(scopeKey), stats);
  }, [data, scopeKey, stats]);

  const isGk = registeredPosition === "GK";
  const choices: { id: PercentileScopeChoice; label: string }[] = [
    { id: "all", label: bp("scopeAll") },
    ...(registeredPosition ? [{ id: "position" as const, label: bp("scopePositionTemplate").replace("{pos}", registeredPosition) }] : []),
    ...(registeredPosition ? [{ id: "role" as const, label: isGk ? bp("scopeGk") : bp("scopeField") }] : []),
  ];

  return (
    <section className="mt-4 rounded-md border border-border bg-surface-2/40 p-3" data-testid="base-percentile-panel" aria-labelledby="base-percentile-heading">
      <h3 id="base-percentile-heading" className="text-sm font-bold">
        {bp("heading")}
      </h3>
      <p className="mt-1 text-xs text-text-dim">{bp("explanation")}</p>
      <p className="mt-0.5 text-2xs text-text-muted">{bp("notBuildNotice")}</p>

      {data.state === "unavailable" ? (
        <p className="mt-2 text-xs text-warning" role="status" data-testid="base-percentile-unavailable">
          {bp("fallback")}
        </p>
      ) : data.state === "loading" ? (
        <p className="mt-2 text-xs text-text-muted" role="status">
          {bp("loading")}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={bp("scopeLabel")}>
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={choice === c.id}
                onClick={() => setChoice(c.id)}
                className={`min-h-[36px] rounded border px-2.5 text-xs ${choice === c.id ? "border-accent bg-accent/15 font-semibold text-text" : "border-border text-text-dim hover:border-accent"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {rows && rows.size > 0 ? (
            <>
              <p className="mt-1.5 text-2xs text-text-muted" data-testid="base-percentile-population">
                {bp("populationTemplate")
                  .replace("{n}", [...rows.values()][0].n.toLocaleString(locale === "ja" ? "ja-JP" : "en-US"))
                  .replace("{date}", data.generatedAt.slice(0, 10))}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {GROUP_ORDER.map((group) => {
                  const list = stats.filter((s) => s.group === group && rows.has(s.key));
                  if (list.length === 0) return null;
                  return (
                    <dl key={group} className="flex min-w-0 flex-col gap-1">
                      {list.map((s) => {
                        const r = rows.get(s.key)!;
                        return (
                          <div key={s.key} className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 odd:bg-black/10">
                            <dt className="min-w-0 truncate text-xs">{abilityName(s.key, locale)}</dt>
                            <dd className="shrink-0" data-bucket={r.bucket}>
                              <Badge tone={BUCKET_TONE[r.bucket]} size="xs">
                                {bp(BUCKET_LABEL_KEY[r.bucket])}
                              </Badge>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-text-muted" role="status">
              {bp("scopeTooSmall")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
