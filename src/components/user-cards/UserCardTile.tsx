"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { resolveAttachedBooster } from "@/lib/progression/booster-resolution";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { FavoriteButton } from "./FavoriteButton";
import type { OwnershipStatus, UsageStatus } from "@/lib/user-cards/types";
import { addCompareId } from "@/lib/comparison/compare-cart";
import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

export function useOwnershipLabels(): Record<OwnershipStatus, string> {
  const t = useT();
  const key = (k: keyof Dictionary["userCardTile"]) => t("userCardTile", k);
  return {
    owned: key("ownershipOwned"),
    wanted: key("ownershipWanted"),
    released: key("ownershipReleased"),
    unknown: key("ownershipUnknown"),
  };
}

export function useUsageLabels(): Record<UsageStatus, string> {
  const t = useT();
  const key = (k: keyof Dictionary["userCardTile"]) => t("userCardTile", k);
  return {
    main: key("usageMain"),
    rotation: key("usageRotation"),
    reserve: key("usageReserve"),
    unused: key("usageUnused"),
    unknown: key("usageUnknown"),
  };
}

export interface UserCardTileMeta {
  addedAt?: string;
  note?: string;
  tags?: string[];
  ownershipStatus?: OwnershipStatus;
  usageStatus?: UsageStatus;
  buildCount?: number;
  selectedBuildName?: string | null;
  /** このカードを使っているスカッド（横断使用状況） */
  squadUsage?: { squadId: string; label: string }[];
}

/**
 * お気に入り / My Team 一覧の 1 カード。既存の画像取得を再利用（再取得・複製保存しない）。
 * 色だけで状態を表さない（ラベル文字を併記）。お気に入り = ライム、Power of Many = 金 で区別。
 */
export function UserCardTile({
  worldCardId,
  card,
  meta,
  showFavorite = true,
  extraActions,
  onRemove,
  removeLabel,
}: {
  worldCardId: string;
  /** 解決できたカード要約。null = 解決中 or 見つからない。 */
  card: WorldPlayerListItem | null;
  meta?: UserCardTileMeta;
  showFavorite?: boolean;
  /** 追加のアクションボタン（My Team 追加 / スカッドで使用 など）。 */
  extraActions?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const [compareMsg, setCompareMsg] = useState<string | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tuc = (k: keyof Dictionary["userCardTile"]) => t("userCardTile", k);
  const fillUc = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const OWNERSHIP_LABELS = useOwnershipLabels();
  const USAGE_LABELS = useUsageLabels();
  const resolvedRemoveLabel = removeLabel ?? tuc("defaultRemoveLabel");
  const fallbackName = fillUc(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: worldCardId });
  const name = card ? resolvePlayerDisplayName(card, locale, fallbackName) : fallbackName;
  const sources = card
    ? resolveCardImageSources({
        worldCardId: card.worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];

  const boosters = card
    ? [
        [1, card.boost1] as const,
        [2, card.boost2] as const,
      ]
        .map(([slot, id]) => resolveAttachedBooster("world", slot, id))
        .filter((r): r is NonNullable<typeof r> => r != null)
    : [];

  function addToCompare() {
    const r = addCompareId(worldCardId);
    setCompareMsg(
      r.result === "added"
        ? tuc("compareAddedMsg")
        : r.result === "already"
          ? tuc("compareAlreadyMsg")
          : r.result === "full"
            ? tuc("compareFullMsg")
            : tuc("compareFailedMsg"),
    );
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-card border border-border bg-surface">
      {showFavorite ? <FavoriteButton worldCardId={worldCardId} variant="card" /> : null}

      <div className="flex gap-2.5 p-2.5">
        <Link href={`/players/world/${encodeURIComponent(worldCardId)}`} className="w-16 shrink-0 sm:w-20">
          <WorldCardImage sources={sources} alt={name} size="card" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/players/world/${encodeURIComponent(worldCardId)}`}
            className="block truncate text-sm font-semibold hover:text-accent"
            title={name}
          >
            {name}
          </Link>
          <p className="truncate text-2xs text-text-dim">{card?.nameEn || `ID ${worldCardId}`}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {card?.registeredPosition ? <Badge tone="neutral" size="xs">{card.registeredPosition}</Badge> : null}
            {card?.cardType ? <Badge tone="outline" size="xs">{card.cardType}</Badge> : null}
            {card ? (
              <span className="text-2xs font-bold text-accent tabular-nums">
                {card.ovrMax ?? card.ovrBase ?? "–"}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-2xs text-text-muted">
            {[card?.team, card?.nationality].filter(Boolean).join(" · ") || (card ? "" : tuc("resolvingCardInfo"))}
          </p>

          {boosters.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {boosters.map((b) => (
                <li key={b.slot}>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold ${
                      b.activation === "power_of_many"
                        ? "bg-warning/15 text-warning"
                        : "bg-info/15 text-info"
                    }`}
                  >
                    {b.activation === "power_of_many" ? tuc("boosterGold") : tuc("boosterBlue")} {b.nameEn} +{b.level}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {meta?.ownershipStatus || meta?.usageStatus ? (
            <p className="mt-1 flex flex-wrap gap-1 text-2xs">
              {meta.ownershipStatus ? (
                <Badge tone="accent" size="xs">{OWNERSHIP_LABELS[meta.ownershipStatus]}</Badge>
              ) : null}
              {meta.usageStatus && meta.usageStatus !== "unknown" ? (
                <Badge tone="neutral" size="xs">{USAGE_LABELS[meta.usageStatus]}</Badge>
              ) : null}
            </p>
          ) : null}

          {meta?.tags && meta.tags.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {meta.tags.map((t) => (
                <li key={t}>
                  <span className="rounded-pill bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-dim">{t}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {meta?.note ? (
            <p className="mt-1 line-clamp-2 text-2xs text-text-dim" title={meta.note}>
              {meta.note}
            </p>
          ) : null}
          {meta?.buildCount != null ? (
            <p className="mt-1 text-2xs text-text-muted">
              {meta.buildCount === 0
                ? tuc("noBuildsSaved")
                : meta.selectedBuildName
                  ? fillUc(tuc("selectedBuildTemplate"), { name: meta.selectedBuildName, count: String(meta.buildCount) })
                  : fillUc(tuc("buildsSavedTemplate"), { count: String(meta.buildCount) })}
            </p>
          ) : null}
          {meta?.squadUsage && meta.squadUsage.length > 0 ? (
            <div className="mt-1 text-2xs text-text-muted">
              <span>{fillUc(tuc("usedInSquadsCountTemplate"), { count: String(meta.squadUsage.length) })}</span>
              {meta.squadUsage.map((u, i) => (
                <span key={u.squadId}>
                  {i > 0 ? " / " : ""}
                  <Link href={`/squads/${u.squadId}`} className="text-accent hover:underline">
                    {u.label}
                  </Link>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-2.5 py-2">
        <Link
          href={`/players/world/${encodeURIComponent(worldCardId)}`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="players" size={12} />
          {tuc("detailLink")}
        </Link>
        <Link
          href={`/players/world/${encodeURIComponent(worldCardId)}?tab=progression`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="sliders" size={12} />
          {tuc("progressionLink")}
        </Link>
        <button
          type="button"
          onClick={addToCompare}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="compare" size={12} />
          {tuc("addToCompareButton")}
        </button>
        {extraActions}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs text-danger hover:border-danger"
          >
            <Icon name="trash" size={12} />
            {resolvedRemoveLabel}
          </button>
        ) : null}
      </div>
      {compareMsg ? <p className="px-2.5 pb-2 text-2xs text-accent" role="status">{compareMsg}</p> : null}
    </div>
  );
}
