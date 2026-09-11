"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type DisclaimerKey = keyof Dictionary["disclaimer"];

export function DisclaimerView() {
  const t = useT();
  const td = (key: DisclaimerKey) => t("disclaimer", key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={td("heading")} icon="shield" description={td("intro")} />

      <Surface tone="inset" padding="md">
        <div className="flex items-start gap-2">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold text-text">{td("unofficialHeading")}</p>
            <p className="mt-1.5 text-sm text-text-dim">{td("unofficialBody")}</p>
            <p className="mt-1.5 text-xs text-text-muted">{td("unofficialBody2")}</p>
          </div>
        </div>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{td("rightsHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{td("rightsBody")}</p>
        <p className="mt-1.5 text-xs text-text-muted">{td("rightsBody2")}</p>
        <p className="mt-1.5 text-sm text-text-dim">
          {td("rightsContactPointer")}{" "}
          <Link href="/support" className="text-accent hover:underline">
            {t("footer", "supportLink")}
          </Link>
        </p>
      </Surface>

      <Surface tone="outline" padding="md">
        <p className="text-sm font-semibold text-text">{td("analysisHeading")}</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-text-dim">
          <li>{td("analysisRuleBased")}</li>
          <li>{td("analysisNotOfficial")}</li>
          <li>{td("analysisNoWinGuarantee")}</li>
          <li>{td("analysisNoUsageGuarantee")}</li>
          <li>{td("analysisMayBeOutdated")}</li>
          <li>{td("analysisDataLimits")}</li>
          <li>{td("analysisUserDecision")}</li>
          <li>{td("analysisModeNote")}</li>
          <li>{td("bestXiNote")}</li>
          <li>{td("bestXiPersonDedup")}</li>
          <li>{td("bestXiPositionData")}</li>
        </ul>
      </Surface>

      <p className="text-2xs text-text-muted">{td("draftNotice")}</p>
    </div>
  );
}
