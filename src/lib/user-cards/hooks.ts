"use client";

import { useCallback, useSyncExternalStore } from "react";
import { subscribeUserCards } from "./store-events";
import {
  getFavorites,
  isFavoritesStorageAvailable,
  toggleFavorite as toggleFavoriteStore,
} from "./favorites-storage";
import { getMyTeam, isMyTeamStorageAvailable, getMyTeamByWorldId } from "./my-team-storage";
import type { FavoriteRecord, MyTeamRecord } from "./types";

/** SSR / hydration 前は空スナップショットを返す（安定参照）。 */
const EMPTY_FAVS: FavoriteRecord[] = [];
const EMPTY_TEAM: MyTeamRecord[] = [];

export function useFavorites(): {
  favorites: FavoriteRecord[];
  favoriteIds: Set<string>;
  isFavorite: (worldCardId: string) => boolean;
  toggle: (worldCardId: string) => { ok: boolean; favorite: boolean; error?: string };
  available: boolean;
} {
  const favorites = useSyncExternalStore(
    (cb) => subscribeUserCards("favorites", cb),
    () => getFavorites(),
    () => EMPTY_FAVS,
  );
  const available = useSyncExternalStore(
    (cb) => subscribeUserCards("favorites", cb),
    () => isFavoritesStorageAvailable(),
    () => true,
  );
  const favoriteIds = new Set(favorites.map((r) => r.worldCardId));
  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favorites]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = useCallback((id: string) => toggleFavoriteStore(id), []);
  return { favorites, favoriteIds, isFavorite, toggle, available };
}

export function useMyTeam(): {
  myTeam: MyTeamRecord[];
  myTeamIds: Set<string>;
  getByWorldId: (worldCardId: string) => MyTeamRecord | null;
  available: boolean;
} {
  const myTeam = useSyncExternalStore(
    (cb) => subscribeUserCards("my-team", cb),
    () => getMyTeam(),
    () => EMPTY_TEAM,
  );
  const available = useSyncExternalStore(
    (cb) => subscribeUserCards("my-team", cb),
    () => isMyTeamStorageAvailable(),
    () => true,
  );
  const myTeamIds = new Set(myTeam.map((r) => r.worldCardId));
  const getByWorldId = useCallback((id: string) => getMyTeamByWorldId(id), [myTeam]); // eslint-disable-line react-hooks/exhaustive-deps
  return { myTeam, myTeamIds, getByWorldId, available };
}
