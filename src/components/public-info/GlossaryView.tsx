"use client";

import "@/lib/i18n/dictionaries/ja-ns/glossary";
import { useT } from "@/lib/i18n/LocaleContext";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type GlossaryKey = keyof Dictionary["glossary"];

/** 用語（並び順・アンカー）。説明は TeamAIXI での使い方だけ（ゲームの仕様の公式な説明ではない）。 */
export const GLOSSARY_TERMS: readonly { id: string; term: GlossaryKey; body: GlossaryKey }[] = [
  { id: "ovr-base", term: "ovrBaseTerm", body: "ovrBaseBody" },
  { id: "ovr-max", term: "ovrMaxTerm", body: "ovrMaxBody" },
  { id: "level-cap", term: "levelCapTerm", body: "levelCapBody" },
  { id: "registered-position", term: "positionTerm", body: "positionBody" },
  { id: "position-suitability", term: "suitabilityTerm", body: "suitabilityBody" },
  { id: "playing-style", term: "styleTerm", body: "styleBody" },
  { id: "booster", term: "boosterTerm", body: "boosterBody" },
  { id: "manager-boost", term: "managerBoostTerm", body: "managerBoostBody" },
  { id: "link-up-play", term: "linkUpTerm", body: "linkUpBody" },
  { id: "provisional-card", term: "provisionalTerm", body: "provisionalBody" },
  { id: "same-player", term: "samePlayerTerm", body: "samePlayerBody" },
  { id: "tier", term: "tierTerm", body: "tierBody" },
];

/** 用語集（F-104・2026-10-20）。 */
export function GlossaryView() {
  const t = useT();
  const tg = (k: GlossaryKey) => t("glossary", k);
  usePageTitle(tg("pageTitle"));
  return (
    <div className="flex flex-col gap-5" data-testid="glossary">
      <PageHeader title={tg("heading")} icon="info" description={tg("intro")} />
      <nav aria-label={tg("tocLabel")}>
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {GLOSSARY_TERMS.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`} className="inline-block rounded-md border border-border px-2 py-1 text-text-dim hover:border-accent hover:text-text">
                {tg(g.term)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <dl className="flex flex-col gap-3">
        {GLOSSARY_TERMS.map((g) => (
          <Surface key={g.id} padding="md" className="scroll-mt-20" id={g.id} data-testid="glossary-term">
            <dt className="text-sm font-semibold text-text">{tg(g.term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-text-dim">{tg(g.body)}</dd>
          </Surface>
        ))}
      </dl>
    </div>
  );
}
