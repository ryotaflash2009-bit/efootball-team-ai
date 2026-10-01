"use client";

import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { decideDisplay, PENDING_EXTERNAL_SOURCE, SYNTHETIC_PACK, SYNTHETIC_TIER_LIST, TIER_PACK_MODEL_VERSION, type DataSource } from "@/lib/tier-pack/model";

type Key = keyof Dictionary["tierPackPreview"];

/** F-090/F-092 の表示の試作（内部ページ・合成データだけ）。 */
export function TierPackPreview() {
  const t = useT();
  const { locale } = useLocale();
  const p = (k: Key) => t("tierPackPreview", k);

  const SourceLine = ({ source }: { source: DataSource }) => (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-text-muted">
      <div className="flex gap-1"><dt>{p("source")}:</dt><dd>{source.label}</dd></div>
      <div className="flex gap-1"><dt>{p("updatedAt")}:</dt><dd className="tabular-nums">{source.updatedAt.slice(0, 10)}</dd></div>
      <div className="flex gap-1"><dt>{p("rights")}:</dt><dd><Badge tone={source.rightsStatus === "pending" ? "warning" : "outline"}>{p(`rights_${source.rightsStatus}` as Key)}</Badge></dd></div>
    </dl>
  );

  const tierOk = decideDisplay(SYNTHETIC_TIER_LIST.source, "internal_preview").display;
  const packOk = decideDisplay(SYNTHETIC_PACK.source, "internal_preview").display;
  const external = decideDisplay(PENDING_EXTERNAL_SOURCE, "internal_preview");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={p("pageTitle")} icon="tier" description={p("pageDescription")} />
      <p role="note" className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="tier-pack-banner">
        {p("banner")}
      </p>
      {locale !== "ja" ? <p className="text-2xs text-text-muted">{p("jaOnlyNote")}</p> : null}

      <Surface className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">{p("tierHeading")}: {SYNTHETIC_TIER_LIST.title}</h2>
        <SourceLine source={SYNTHETIC_TIER_LIST.source} />
        {tierOk ? (
          <ul className="flex flex-col gap-1 text-sm" data-testid="tier-entries">
            {SYNTHETIC_TIER_LIST.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{e.rank}</Badge>
                <span>{e.name}</span>
                <span className="text-2xs text-text-muted">{e.position}</span>
                <span className="text-2xs text-text-muted">{e.basis}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Surface>

      <Surface className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">{p("packHeading")}: {SYNTHETIC_PACK.title}</h2>
        <SourceLine source={SYNTHETIC_PACK.source} />
        {packOk ? (
          <>
            <p className="text-2xs text-text-muted">{p("period")}: {SYNTHETIC_PACK.period.from} – {SYNTHETIC_PACK.period.to}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {SYNTHETIC_PACK.featured.map((f) => (
                <li key={f.name}>{f.name} <span className="text-2xs text-text-muted">{f.position}</span></li>
              ))}
            </ul>
          </>
        ) : null}
      </Surface>

      <Surface className="flex flex-col gap-2 p-4" data-testid="tier-pack-external">
        <SourceLine source={PENDING_EXTERNAL_SOURCE} />
        {!external.display ? <p className="text-xs text-warning">{p("hiddenPending")}</p> : null}
      </Surface>

      <p className="text-2xs text-text-muted font-mono">{TIER_PACK_MODEL_VERSION}</p>
    </div>
  );
}
