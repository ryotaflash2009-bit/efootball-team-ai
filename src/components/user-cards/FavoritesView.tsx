"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFavorites, useMyTeam } from "@/lib/user-cards/hooks";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import { removeFavorite } from "@/lib/user-cards/favorites-storage";
import { filterAndSortUserCards, facetsFromRows, type UserCardRow } from "@/lib/user-cards/filter";
import { UserCardFilters, DEFAULT_FILTER, type UserCardFilterState } from "./UserCardFilters";
import { UserCardTile } from "./UserCardTile";
import { LocalStorageNotice } from "./LocalStorageNotice";
import { MyTeamButton } from "./MyTeamButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";

export function FavoritesView() {
  const t = useT();
  const { favorites, available } = useFavorites();
  const { myTeamIds } = useMyTeam();
  const ids = useMemo(() => favorites.map((f) => f.worldCardId), [favorites]);
  const { cards, loading, error } = useResolvedCards(ids);
  const [filter, setFilter] = useState<UserCardFilterState>(DEFAULT_FILTER);

  const rows: UserCardRow[] = useMemo(
    () =>
      favorites.map((f) => ({
        worldCardId: f.worldCardId,
        addedAt: f.addedAt,
        card: cards.get(f.worldCardId) ?? null,
        inMyTeam: myTeamIds.has(f.worldCardId),
      })),
    [favorites, cards, myTeamIds],
  );

  const facets = useMemo(() => facetsFromRows(rows), [rows]);
  const visible = useMemo(() => filterAndSortUserCards(rows, filter), [rows, filter]);
  const favByWorldId = useMemo(() => new Map(favorites.map((f) => [f.worldCardId, f])), [favorites]);

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("favoritesView", "pageTitle")} icon="star" description={t("favoritesView", "pageDescription")} />
        <LocalStorageNotice kind="favorites" />
        <EmptyState
          icon="star"
          title={t("favoritesView", "emptyTitle")}
          description={t("favoritesView", "emptyDescription")}
          action={
            <Link href="/players" className={buttonClasses("primary", "sm")}>
              {t("myTeam", "findPlayersLink")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("favoritesView", "pageTitle")} icon="star" description={t("favoritesView", "pageDescription")} />
      <LocalStorageNotice kind="favorites" />
      {!available ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-2xs text-warning">
          {t("myTeam", "notAvailableNotice")}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-2xs text-danger">{error}</p>
      ) : null}

      <UserCardFilters
        state={filter}
        onChange={setFilter}
        positions={facets.positions}
        cardTypes={facets.cardTypes}
        total={favorites.length}
        shown={visible.length}
      />

      {visible.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={t("favoritesView", "noResultsTitle")}
          description={t("myTeam", "noResultsDescription")}
          action={
            <button
              type="button"
              onClick={() => setFilter(DEFAULT_FILTER)}
              className={buttonClasses("primary", "sm")}
            >
              {t("myTeam", "clearFiltersButton")}
            </button>
          }
        />
      ) : (
        <>
          {loading ? <p className="text-2xs text-text-muted">{t("myTeam", "resolvingCards")}</p> : null}
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((row) => {
              const fav = favByWorldId.get(row.worldCardId);
              const player = row.card;
              const name =
                player?.nameJa ||
                player?.nameEn ||
                t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", row.worldCardId);
              return (
                <li key={row.worldCardId}>
                  <UserCardTile
                    worldCardId={row.worldCardId}
                    card={player}
                    meta={{
                      addedAt: fav?.addedAt,
                      note: fav?.note,
                      tags: fav?.tags,
                    }}
                    showFavorite
                    extraActions={<MyTeamButton worldCardId={row.worldCardId} playerName={name} variant="compact" />}
                    onRemove={() => removeFavorite(row.worldCardId)}
                    removeLabel={t("favoritesView", "removeLabel")}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
