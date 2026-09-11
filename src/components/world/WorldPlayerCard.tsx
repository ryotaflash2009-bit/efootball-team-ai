"use client";

import Link from "next/link";
import { WorldCardImage } from "./WorldCardImage";
import { CompareAddButton } from "@/components/compare/CompareAddButton";
import { FavoriteButton } from "@/components/user-cards/FavoriteButton";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

/**
 * クライアントへは生の CDN URL（imageUrlCandidate 等）を渡さず、解決済み imageSources だけ渡す
 * （RSC の flight payload へ raw CDN URL が直列化されて露出するのを防ぐため）。
 */
export interface WorldPlayerCardData {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  ovrMax: number | null;
  ovrBase: number | null;
  maximumLevel: number | null;
  registeredPosition: string | null;
  cardType: string | null;
  hasEfhubLink: boolean;
  imageSources: string[];
}

/**
 * World 選手カード。画像（3:4）+ 左上 OVR + 下部に名前。
 * OVR は「最大 OVR」を大きく、基礎 OVR を小さく併記。ホバーで比較追加を表示。
 */
export function WorldPlayerCard({ player }: { player: WorldPlayerCardData }) {
  const t = useT();
  const { locale } = useLocale();
  const imageSources = player.imageSources;
  const fallbackName = t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", player.worldCardId);
  const name = resolvePlayerDisplayName(player, locale, fallbackName);
  const ovr = player.ovrMax ?? player.ovrBase;

  return (
    <div className="group relative overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-accent">
      <FavoriteButton worldCardId={player.worldCardId} variant="card" />
      <Link href={`/players/world/${encodeURIComponent(player.worldCardId)}`} className="block">
        <div className="relative">
          <WorldCardImage sources={imageSources} alt={name} size="card" />
          <span className="absolute left-1 top-1 flex items-baseline gap-1 rounded bg-black/75 px-1.5 py-0.5 leading-none">
            <span className="text-lg font-black text-accent tabular-nums">{ovr ?? "–"}</span>
            <span className="text-[9px] font-semibold text-text-dim">MAX</span>
          </span>
          {player.registeredPosition ? (
            <span className="absolute right-1 top-10 rounded bg-black/75 px-1.5 py-0.5 text-2xs font-bold text-text">
              {player.registeredPosition}
            </span>
          ) : null}
          {player.cardType ? (
            <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-dim">
              {player.cardType}
            </span>
          ) : null}
        </div>

        <div className="p-2">
          <p className="truncate text-sm font-semibold text-text" title={name}>
            {name}
          </p>
          <p className="truncate text-2xs text-text-dim" title={player.nameEn ?? undefined}>
            {player.nameEn || t("worldPlayerCard", "noEnglishName")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-2xs text-text-muted">
            <span>{t("worldPlayerCard", "baseOvrLabel").replace("{value}", String(player.ovrBase ?? "–"))}</span>
            <span aria-hidden>·</span>
            <span>{t("worldPlayerCard", "levelCapLabel").replace("{value}", String(player.maximumLevel ?? "–"))}</span>
            {player.hasEfhubLink ? <span className="rounded bg-accent-soft px-1 text-accent">eFHUB</span> : null}
          </p>
        </div>
      </Link>
      <div className="px-2 pb-2">
        <CompareAddButton worldCardId={player.worldCardId} variant="card" />
      </div>
    </div>
  );
}
