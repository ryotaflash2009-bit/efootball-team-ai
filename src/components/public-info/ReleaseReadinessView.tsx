"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { AVAILABLE_FEATURE_KEYS, BETA_FEATURE_KEYS, NOT_PROVIDED_FEATURE_KEYS } from "@/lib/public-info/feature-catalog";
import { buildReleaseReadinessItems, type ReleaseReadinessStatus } from "@/lib/public-info/release-readiness";
import { resolveSupportChannels } from "@/lib/public-info/support-config";

type ReleaseReadinessKey = keyof Dictionary["releaseReadiness"];

const STATUS_LABEL_KEY: Record<ReleaseReadinessStatus, ReleaseReadinessKey> = {
  complete: "statusComplete",
  partial: "statusPartial",
  "not-started": "statusNotStarted",
  "not-applicable": "statusNotApplicable",
  "requires-owner-action": "statusRequiresOwnerAction",
  "requires-specialist-review": "statusRequiresSpecialistReview",
};

const STATUS_TONE: Record<ReleaseReadinessStatus, "accent" | "warning" | "outline" | "danger"> = {
  complete: "accent",
  partial: "warning",
  "not-started": "outline",
  "not-applicable": "outline",
  "requires-owner-action": "warning",
  "requires-specialist-review": "danger",
};

export function ReleaseReadinessView() {
  const t = useT();
  const tr = (key: ReleaseReadinessKey) => t("releaseReadiness", key);
  const items = useMemo(() => buildReleaseReadinessItems(), []);
  const channels = useMemo(() => resolveSupportChannels(), []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={tr("heading")} icon="info" description={tr("intro")} />

      <Surface tone="inset" padding="md">
        <p className="text-sm font-semibold text-text">{tr("currentStageHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tr("currentStageBody")}</p>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tr("availableHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {AVAILABLE_FEATURE_KEYS.map((key) => (
            <li key={key}>{t("about", key)}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-text">{tr("betaHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {BETA_FEATURE_KEYS.map((key) => (
            <li key={key}>{t("about", key)}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-text">{tr("notProvidedHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {NOT_PROVIDED_FEATURE_KEYS.map((key) => (
            <li key={key}>{t("about", key)}</li>
          ))}
        </ul>
      </Surface>

      <Surface tone="inset" padding="md">
        <p className="text-sm font-semibold text-warning">{tr("dataCautionHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tr("dataCautionBody")}</p>
        <p className="mt-2 text-sm font-semibold text-text">{tr("knownLimitationsHeading")}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tr("limitationBestXiDedup")}</li>
          <li>{tr("limitationSubPosition")}</li>
          <li>{tr("limitationRuleBasedNotOfficial")}</li>
        </ul>
        <p className="mt-2 text-sm text-text-dim">{tr("noGenerativeAiNotice")}</p>
        <p className="mt-1 text-sm text-text-dim">{tr("notOfficialNotice")}</p>
      </Surface>

      {!channels.hasAnyChannel ? (
        <Surface tone="outline" padding="sm" className="flex items-start gap-2 text-sm text-text-dim">
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-text-muted" />
          <div>
            <p className="text-xs font-semibold text-text-dim">{tr("contactStatusHeading")}</p>
            <p className="mt-0.5">{tr("contactStatusUnset")}</p>
          </div>
        </Surface>
      ) : null}

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tr("checklistHeading")}</p>
        <p className="mt-1 text-xs text-text-dim">{tr("checklistIntro")}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-border/60 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text">{tr(item.titleKey)}</span>
                <Badge tone={STATUS_TONE[item.status]}>{tr(STATUS_LABEL_KEY[item.status])}</Badge>
              </div>
              <p className="mt-1 text-xs text-text-dim">{tr(item.descriptionKey)}</p>
            </li>
          ))}
        </ul>
      </Surface>

      <p className="text-2xs text-text-muted">{tr("draftNotice")}</p>
    </div>
  );
}
