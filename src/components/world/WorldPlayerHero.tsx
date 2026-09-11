"use client";

import Link from "next/link";
import type { WorldPlayerDetail } from "@/lib/world/types";
import { WorldCardImage } from "./WorldCardImage";
import { CompareAddButton } from "@/components/compare/CompareAddButton";
import { FavoriteButton } from "@/components/user-cards/FavoriteButton";
import { MyTeamButton } from "@/components/user-cards/MyTeamButton";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/** クライアント安全な選手詳細（生の CDN URL を含まない）。 */
export type SafeWorldPlayerDetail = Omit<WorldPlayerDetail, "imageUrlCandidate" | "mobileImageUrlCandidate">;

/** 選手詳細のヒーロー。画像 + 主要情報 + 操作を常時表示。imageSources は呼び出し側で解決済みのものを渡す。 */
export function WorldPlayerHero({ player, imageSources: sources }: { player: SafeWorldPlayerDetail; imageSources: string[] }) {
  const t = useT();
  const { locale } = useLocale();
  const th = (k: keyof Dictionary["worldPlayerHero"]) => t("worldPlayerHero", k);
  const name = resolvePlayerDisplayName(player, locale, t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", player.worldCardId));

  const facts: { label: string; value: string }[] = [
    { label: th("baseOvrLabel"), value: `${player.ovrBase ?? "–"}` },
    { label: th("maxOvrFactLabel"), value: `${player.ovrMax ?? "–"}` },
    { label: th("maxLevelLabel"), value: `${player.maximumLevel ?? "–"}` },
    { label: th("preferredFootLabel"), value: player.preferredFoot ?? "—" },
    { label: th("heightWeightTemplate"), value: `${player.height ?? "–"}cm / ${player.weight ?? "–"}kg` },
    { label: th("teamLabel"), value: player.team ?? "—" },
  ];

  return (
    <section className="rounded-lg border border-border-strong bg-surface p-4 sm:p-5">
      <Link href="/players" className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-accent">
        <Icon name="chevron-left" size={16} />
        {th("backToList")}
      </Link>

      <div className="mt-3 flex flex-col gap-5 sm:flex-row">
        <div className="mx-auto w-full max-w-[190px] shrink-0 sm:mx-0 sm:w-44">
          <WorldCardImage sources={sources} alt={name} size="detail" priority />
          {sources.length === 0 ? (
            <p className="mt-1 text-center text-2xs text-text-muted">{th("noImage")}</p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-4xl font-black leading-none text-accent tabular-nums sm:text-5xl">
              {player.ovrMax ?? player.ovrBase ?? "–"}
            </span>
            <span className="pb-1 text-xs font-semibold text-text-dim">{th("maxOvrLabel")}</span>
            <span className="pb-1 text-xs text-text-dim">
              {th("baseAndCapTemplate")
                .replace("{base}", String(player.ovrBase ?? "–"))
                .replace("{cap}", String(player.maximumLevel ?? "–"))}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight">{name}</h1>
          <p className="text-sm text-text-dim">{player.nameEn || th("noEnglishName")}</p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {player.registeredPosition ? <Badge tone="neutral">{player.registeredPosition}</Badge> : null}
            {player.cardType ? <Badge tone="outline">{player.cardType}</Badge> : null}
            {player.playingStyle ? <Badge tone="accent">{player.playingStyle}</Badge> : null}
            {player.hasEfhubLink ? (
              <Badge tone="info">eFHUB{player.efhubCardId ? ` ${player.efhubCardId}` : ""}</Badge>
            ) : null}
            <Badge tone="outline">ID {player.worldCardId}</Badge>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-2xs text-text-muted">{f.label}</dt>
                <dd className="truncate font-medium tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FavoriteButton worldCardId={player.worldCardId} variant="detail" />
            <MyTeamButton worldCardId={player.worldCardId} playerName={name} variant="detail" />
            <CompareAddButton worldCardId={player.worldCardId} variant="detail" />
          </div>
        </div>
      </div>
    </section>
  );
}
