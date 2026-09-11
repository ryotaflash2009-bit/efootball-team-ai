"use client";

import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { AVAILABLE_FEATURE_KEYS, BETA_FEATURE_KEYS, NOT_PROVIDED_FEATURE_KEYS } from "@/lib/public-info/feature-catalog";

type AboutKey = keyof Dictionary["about"];

export function AboutView() {
  const t = useT();
  const ta = (key: AboutKey) => t("about", key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("heading")} icon="info" description={ta("intro")} />

      <Surface tone="inset" padding="sm" className="text-xs text-text-dim">
        <p>{ta("ruleBasedNotice")}</p>
        <p className="mt-1">{ta("externalAiNotice")}</p>
        <p className="mt-1">{ta("scopeNotice")}</p>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{ta("availableHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {AVAILABLE_FEATURE_KEYS.map((key) => (
            <li key={key}>{ta(key)}</li>
          ))}
        </ul>
      </Surface>

      <Surface tone="outline" padding="md">
        <p className="text-sm font-semibold text-text">{ta("betaHeading")}</p>
        <p className="mt-1 text-xs text-text-dim">{ta("betaBestXiIntro")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {BETA_FEATURE_KEYS.map((key) => (
            <li key={key}>{ta(key)}</li>
          ))}
        </ul>
      </Surface>

      <Surface tone="inset" padding="md">
        <p className="text-sm font-semibold text-text">{ta("notProvidedHeading")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {NOT_PROVIDED_FEATURE_KEYS.map((key) => (
            <li key={key}>{ta(key)}</li>
          ))}
        </ul>
      </Surface>

      <Surface tone="outline" padding="sm" className="flex items-start gap-2 text-xs text-text-dim">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-text-muted" />
        <div>
          <p>{ta("notOfficialNotice")}</p>
          <p className="mt-1">{ta("winRateNotice")}</p>
        </div>
      </Surface>

      <p className="text-2xs text-text-muted">{ta("draftNotice")}</p>
    </div>
  );
}
