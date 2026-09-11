"use client";

import type { ProgressionCard } from "@/lib/progression/types";
import type { PlayerAnalysis } from "@/lib/world/player-analysis";
import { WorldStatGrid } from "@/components/world/WorldStatGrid";
import { WorldPlayerHero, type SafeWorldPlayerDetail } from "@/components/world/WorldPlayerHero";
import { ProgressionPanel } from "@/components/world/progression/ProgressionPanel";
import { PageContainer } from "@/components/ui/PageContainer";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { formatDateTime } from "@/lib/i18n/format";

const NOT_YET_FIXED_KEYS = ["Weak Foot Usage", "Weak Foot Accuracy", "Form", "Injury Resistance", "Tier"];

export function WorldPlayerDetailView({
  player,
  progressionCard,
  progressionImageSources,
  heroImageSources,
  playerAnalysis,
  hasEfhubAnalysis,
  initialTab,
}: {
  player: SafeWorldPlayerDetail;
  progressionCard: ProgressionCard;
  progressionImageSources: string[];
  heroImageSources: string[];
  playerAnalysis: PlayerAnalysis;
  hasEfhubAnalysis: boolean;
  initialTab?: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: keyof Dictionary["playerDetailPage"]) => t("playerDetailPage", k);
  const analysisScope = hasEfhubAnalysis ? tp("analysisScopeWorldEfhub") : tp("analysisScopeWorld");
  const notYetKeys = [tp("notYetSecondaryPosition"), ...NOT_YET_FIXED_KEYS];

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : formatDateTime(d, locale);
  };

  const basicInfo: { label: string; value: string }[] = [
    { label: tp("nationalityLabel"), value: player.nationality ?? "—" },
    { label: tp("regionLabel"), value: player.region ?? "—" },
    { label: tp("leagueLabel"), value: player.league ?? "—" },
    { label: tp("teamLabel"), value: player.team ?? "—" },
    { label: tp("ageLabel"), value: player.age != null ? `${player.age}` : "—" },
    { label: tp("heightLabel"), value: player.height != null ? `${player.height} cm` : "—" },
    { label: tp("weightLabel"), value: player.weight != null ? `${player.weight} kg` : "—" },
    { label: tp("preferredFootLabel"), value: player.preferredFoot ?? "—" },
    { label: tp("playingStyleLabel"), value: player.playingStyle ?? "—" },
    { label: tp("playingStyleDefLabel"), value: player.playingStyleDefensive ?? "—" },
    { label: tp("booster1Label"), value: player.boost1 != null ? `${player.boost1}` : "—" },
    { label: tp("booster2Label"), value: player.boost2 != null ? `${player.boost2}` : "—" },
  ];

  const overviewTab = (
    <Surface>
      <SectionHeader title={tp("basicInfoHeading")} as="h2" />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
        {basicInfo.map((row) => (
          <div key={row.label}>
            <dt className="text-2xs text-text-muted">{row.label}</dt>
            <dd className="mt-0.5 font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Surface>
  );

  const statsTab = (
    <Surface>
      <SectionHeader title={tp("statsHeading")} as="h2" hint={tp("statsHint")} />
      <WorldStatGrid stats={player.stats} />
    </Surface>
  );

  const skillsTab = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Surface>
        <SectionHeader title={tp("playerSkillsHeading")} as="h2" hint={`${player.playerSkills.length}`} />
        {player.playerSkills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {player.playerSkills.map((s) => (
              <li key={s}>
                <Badge tone="neutral">{s}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-dim">{tp("noSkills")}</p>
        )}
      </Surface>
      <Surface>
        <SectionHeader title={tp("aiStylesHeading")} as="h2" hint={`${player.aiStyles.length}`} />
        {player.aiStyles.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {player.aiStyles.map((s) => (
              <li key={s}>
                <Badge tone="accent">{s}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-dim">{tp("noAiStyles")}</p>
        )}
      </Surface>
    </div>
  );

  const progressionTab = (
    <Surface>
      <SectionHeader title={tp("progressionHeading")} as="h2" />
      <ProgressionPanel
        card={progressionCard}
        imageSources={progressionImageSources}
        analysis={playerAnalysis}
        analysisScope={analysisScope}
      />
    </Surface>
  );

  const dataTab = (
    <div className="flex flex-col gap-4">
      <Surface>
        <SectionHeader title={tp("dataProvenanceHeading")} as="h2" />
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-2xs text-text-muted">{tp("dataSourceLabel")}</dt>
            <dd className="mt-0.5 font-medium">{player.source === "world" ? "eFootball World" : player.source}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tp("sourceUrlLabel")}</dt>
            <dd className="mt-0.5 break-all font-medium">{player.sourceUrl}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tp("appearanceUpdatedLabel")}</dt>
            <dd className="mt-0.5 font-medium">{fmtDate(player.appearanceUpdatedAt)}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tp("fetchedAtLabel")}</dt>
            <dd className="mt-0.5 font-medium">{fmtDate(player.fetchedAt)}</dd>
          </div>
        </dl>
      </Surface>

      {player.efhubConflicts.length > 0 ? (
        <Surface>
          <SectionHeader title={tp("efhubDiffHeading")} as="h2" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-text-dim">
                <tr>
                  <th className="py-1 pr-3 font-medium">{tp("tableItemHeader")}</th>
                  <th className="py-1 pr-3 font-medium">{tp("tableWorldHeader")}</th>
                  <th className="py-1 font-medium">{tp("tableEfhubHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {player.efhubConflicts.map((c) => (
                  <tr key={c.fieldName} className="border-t border-border">
                    <td className="py-1 pr-3">{c.fieldName}</td>
                    <td className="py-1 pr-3 font-medium">{c.worldValue ?? "—"}</td>
                    <td className="py-1 text-text-dim">{c.efhubValue ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ) : null}

      <Surface tone="outline">
        <SectionHeader title={tp("notYetHeading")} as="h2" hint={tp("notYetHint")} />
        <p className="mb-3 text-2xs text-text-muted">{tp("notYetZeroNote")}</p>
        <ul className="flex flex-wrap gap-1.5">
          {notYetKeys.map((k) => (
            <li key={k}>
              <Badge tone="outline">{`${k}${tp("notYetBadgeSuffix")}`}</Badge>
            </li>
          ))}
        </ul>
      </Surface>
    </div>
  );

  return (
    <PageContainer width="full">
      <div className="flex flex-col gap-4">
        <WorldPlayerHero player={player} imageSources={heroImageSources} />
        <Tabs
          ariaLabel={tp("tabsAriaLabel")}
          sticky
          initial={initialTab}
          items={[
            { id: "overview", label: tp("tabOverview"), content: overviewTab },
            { id: "stats", label: tp("tabStats"), content: statsTab },
            { id: "skills", label: tp("tabSkills"), content: skillsTab },
            { id: "progression", label: tp("tabProgression"), content: progressionTab },
            { id: "data", label: tp("tabData"), content: dataTab },
          ]}
        />
      </div>
    </PageContainer>
  );
}
