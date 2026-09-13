"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { subscribeUserCards } from "./store-events";
import {
  getFavorites,
  isFavoritesStorageAvailable,
  toggleFavorite as toggleFavoriteStore,
} from "./favorites-storage";
import { getMyTeam, isMyTeamStorageAvailable, getMyTeamByWorldId } from "./my-team-storage";
import type { FavoriteRecord, MyTeamRecord } from "./types";
import { useStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";

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

/**
 * My Teamのアカウント別スコープを解決し、プレーンなストレージモジュール
 * (`my-team-storage.ts`)へ同期する。My Teamを扱うすべての画面がこのフックを
 * 経由することで、スコープの解決状況(`scopeStatus`)を一貫して取得できる。
 */
export function useMyTeam(): {
  myTeam: MyTeamRecord[];
  myTeamIds: Set<string>;
  getByWorldId: (worldCardId: string) => MyTeamRecord | null;
  available: boolean;
  /** "loading": 認証状態確認中(My Teamを読み書きしない)。"guest"/"account": 解決済み。 */
  scopeStatus: "loading" | "guest" | "account";
} {
  const scopeState = useStorageScope();

  useEffect(() => {
    setCurrentScope(scopeState.status === "resolved" ? scopeState.scope : null);
    // アンマウント時に自分が設定したスコープを取り消す必要はない
    // (他のuseMyTeam呼び出し元や、次のスコープ解決が上書きするため)。
  }, [scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const scopeStatus: "loading" | "guest" | "account" = scopeState.status === "loading" ? "loading" : scopeState.scope.kind;
  return { myTeam, myTeamIds, getByWorldId, available, scopeStatus };
}
