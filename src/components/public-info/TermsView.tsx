"use client";

import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type TermsKey = keyof Dictionary["terms"];

const PROSE_SECTIONS: { headingKey: TermsKey; bodyKey: TermsKey }[] = [
  { headingKey: "section1Heading", bodyKey: "section1Body" },
  { headingKey: "section2Heading", bodyKey: "section2Body" },
  { headingKey: "section3Heading", bodyKey: "section3Body" },
];

const PROSE_SECTIONS_AFTER_PROHIBITED: { headingKey: TermsKey; bodyKey: TermsKey }[] = [
  { headingKey: "section5Heading", bodyKey: "section5Body" },
  { headingKey: "section6Heading", bodyKey: "section6Body" },
  { headingKey: "section7Heading", bodyKey: "section7Body" },
  { headingKey: "section8Heading", bodyKey: "section8Body" },
  { headingKey: "section9Heading", bodyKey: "section9Body" },
  { headingKey: "section10Heading", bodyKey: "section10Body" },
  { headingKey: "section11Heading", bodyKey: "section11Body" },
  { headingKey: "section12Heading", bodyKey: "section12Body" },
  { headingKey: "section13Heading", bodyKey: "section13Body" },
];

const PROHIBITED_ITEM_KEYS: TermsKey[] = [
  "section4ProhibitUnauthorizedAccess",
  "section4ProhibitVulnerabilityAbuse",
  "section4ProhibitDataTheft",
  "section4ProhibitRightsInfringement",
  "section4ProhibitExcessiveLoad",
  "section4ProhibitMaliciousJsonOrScript",
  "section4ProhibitMisrepresentAsOfficial",
  "section4ProhibitUnlawfulUse",
];

export function TermsView() {
  const t = useT();
  const tt = (key: TermsKey) => t("terms", key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={tt("heading")} icon="shield" description={tt("intro")} />

      <Surface tone="inset" padding="sm" className="text-xs text-warning">
        {tt("draftNotice")}
      </Surface>

      {PROSE_SECTIONS.map((s) => (
        <Surface key={s.headingKey} padding="md">
          <p className="text-sm font-semibold text-text">{tt(s.headingKey)}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-text-dim">{tt(s.bodyKey)}</p>
        </Surface>
      ))}

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tt("section4Heading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tt("section4Intro")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          {PROHIBITED_ITEM_KEYS.map((key) => (
            <li key={key}>{tt(key)}</li>
          ))}
        </ul>
      </Surface>

      {PROSE_SECTIONS_AFTER_PROHIBITED.map((s) => (
        <Surface key={s.headingKey} padding="md">
          <p className="text-sm font-semibold text-text">{tt(s.headingKey)}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-text-dim">{tt(s.bodyKey)}</p>
        </Surface>
      ))}

      <Surface tone="outline" padding="sm" className="text-xs text-text-dim">
        {tt("ownerConfirmationNotice")}
      </Surface>
    </div>
  );
}
