"use client";

import { ProvisionalBadge } from "@/components/world/ProvisionalCardNotice";
import "@/lib/i18n/dictionaries/ja-ns/squadBuildPanel";
import "@/lib/i18n/dictionaries/ja-ns/worldPlayerCard";
import Link from "next/link";
import { WorldCardImage } from "./WorldCardImage";
import { CompareAddButton } from "@/components/compare/CompareAddButton";
import { FavoriteButton } from "@/components/user-cards/FavoriteButton";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { useMyTeam } from "@/lib/user-cards/hooks";

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
  /** 暫定のカード（2026-10-15）。 */
  provisional?: boolean;
  /** 最近 7 日に追加されたカード（サーバーで判定・2026-10-20）。 */
  isNew?: boolean;
}

/**
 * World 選手カード。画像（3:4）+ 左上 OVR + 下部に名前。
 * OVR は「最大 OVR」を大きく、基礎 OVR を小さく併記。ホバーで比較追加を表示。
 */
export function WorldPlayerCard({ player, imagePriority = false }: { player: WorldPlayerCardData; imagePriority?: boolean }) {
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
          <WorldCardImage sources={imageSources} alt={name} size="card" priority={imagePriority} />
          <span className="absolute start-1 top-1 flex items-baseline gap-1 rounded bg-black/75 px-1.5 py-0.5 leading-none">
            <span className="text-lg font-black text-accent tabular-nums">{ovr ?? "–"}</span>
            {/* 最大 OVR が無い（暫定のカードなど）ときは基本の OVR なので「BASE」と出す（2026-10-25） */}
            <span className="text-[9px] font-semibold text-text-dim">{player.ovrMax != null ? "MAX" : "BASE"}</span>
          </span>
          {player.isNew ? (
            <span className="absolute start-1 top-9 rounded bg-accent px-1.5 py-0.5 text-[9px] font-black leading-none text-accent-ink" data-testid="card-new-badge">
              NEW
            </span>
          ) : null}
          {player.registeredPosition ? (
            <span className="absolute end-1 top-10 rounded bg-black/75 px-1.5 py-0.5 text-2xs font-bold text-text">
              {player.registeredPosition}
            </span>
          ) : null}
          <OwnedBadge worldCardId={player.worldCardId} />
          {player.cardType ? (
            <span className="absolute bottom-1 start-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-dim">
              {player.cardType}
            </span>
          ) : null}
        </div>

        <div className="p-2">
          {player.provisional ? <ProvisionalBadge /> : null}
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

/**
 * My Team で「所持」のカードに「所持済み」の印（2026-10-25）。サーバーの描画・hydration の最初は My Team が空なので出ない（#418 を起こさない）。
 */
function OwnedBadge({ worldCardId }: { worldCardId: string }) {
  const t = useT();
  const { getByWorldId } = useMyTeam();
  const rec = getByWorldId(worldCardId);
  if (!rec || rec.ownershipStatus !== "owned" || rec.deletedAt) return null;
  return (
    <span className="absolute end-1 top-[4.25rem] rounded bg-success/90 px-1.5 py-0.5 text-[9px] font-bold leading-none text-black" data-testid="card-owned-badge">
      {t("worldPlayerCard", "ownedBadge")}
    </span>
  );
}
