"use client";

import Link from "next/link";
import { PlayerImage } from "@/components/PlayerImage";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { formatDateTime } from "@/lib/i18n/format";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

interface LegacyPlayer {
  id: string;
  nameJa: string | null;
  nameEn: string | null;
  ovr: number;
}

interface LegacyPlayerMeta {
  source: string;
  sourceUrl: string;
  method: string;
  fetchedAt: string;
}

export function LegacyPlayerDetailView({ player, meta }: { player: LegacyPlayer; meta: LegacyPlayerMeta | null }) {
  const t = useT();
  const { locale } = useLocale();
  const tl = (k: keyof Dictionary["legacyPlayerDetail"]) => t("legacyPlayerDetail", k);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/players" className="text-sm text-accent">
        {tl("backToList")}
      </Link>

      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
          <div className="mx-auto w-full max-w-[220px] shrink-0 sm:mx-0 sm:w-60">
            <PlayerImage
              playerId={player.id}
              alt={resolvePlayerDisplayName(player, locale, t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", player.id))}
              size="detail"
              priority
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black leading-none text-accent">{player.ovr}</span>
              <span className="text-xs font-semibold text-text-dim">OVR</span>
            </div>
            <h1 className="mt-3 text-xl font-bold">{player.nameJa || tl("noJapaneseName")}</h1>
            <p className="text-sm text-text-dim">{player.nameEn || tl("noEnglishName")}</p>

            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-dim">{tl("efhubIdLabel")}</dt>
                <dd className="break-all font-medium">{player.id}</dd>
              </div>
              <div>
                <dt className="text-text-dim">{tl("ovrLabel")}</dt>
                <dd className="font-medium">{player.ovr}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">{tl("provenanceHeading")}</h2>
        {meta ? (
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-dim">{tl("dataSourceLabel")}</dt>
              <dd className="font-medium">{meta.source}</dd>
            </div>
            <div>
              <dt className="text-text-dim">{tl("sourceUrlLabel")}</dt>
              <dd className="break-all font-medium">{meta.sourceUrl}</dd>
            </div>
            <div>
              <dt className="text-text-dim">{tl("httpMethodLabel")}</dt>
              <dd className="font-medium">{meta.method}</dd>
            </div>
            <div>
              <dt className="text-text-dim">{tl("fetchedAtLabel")}</dt>
              <dd className="font-medium">{(() => {
                const d = new Date(meta.fetchedAt);
                return Number.isNaN(d.getTime()) ? meta.fetchedAt : formatDateTime(d, locale);
              })()}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-text-dim">{tl("noSourceInfo")}</p>
        )}
      </section>

      <section className="rounded-card border border-dashed border-border bg-surface p-5">
        <h2 className="text-base font-semibold">{tl("futureHeading")}</h2>
        <p className="mt-2 text-sm text-text-dim">{tl("futureDescription")}</p>
        <p className="mt-2 text-xs text-text-dim/70">{tl("imageProxyNote")}</p>
      </section>
    </div>
  );
}
