"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorldPlayerDetail } from "@/lib/world/types";
import type { ManagerDetail } from "@/lib/managers/types";
import type { ManagerContext, SavedBuild } from "@/lib/progression/types";
import { managerToContext } from "@/lib/managers/to-context";
import { listBuilds } from "@/lib/progression/build-storage";
import { getSquad, isSquadStorageAvailable } from "@/lib/squad/squad-storage";
import { SQUAD_STORAGE_KEY, SQUAD_ID_RE, type StoredSquad } from "@/lib/squad/types";
import { buildSquad } from "@/lib/squad/build-squad";
import { assembleBuildSquadInput } from "@/lib/squad/assemble-build-input";
import type { CompareSideInput, ResolvedCompareCard } from "@/lib/squad/compare-squads";

const WORLD_ID_RE = /^[0-9]{1,20}$/;

export interface SquadCompareData {
  storageOk: boolean;
  loadingSquads: boolean;
  loadingCards: boolean;
  a: CompareSideInput | null;
  b: CompareSideInput | null;
  aSquad: StoredSquad | null;
  bSquad: StoredSquad | null;
  aMissing: boolean;
  bMissing: boolean;
  failedCardIds: string[];
  cardError: string | null;
  externalUpdate: boolean;
  reload: () => void;
}

/** 解決済み computed から worldCardId → 表示・計算結果マップを作る。 */
function resolvedMapFromComputed(computed: ReturnType<typeof buildSquad>): Map<string, ResolvedCompareCard> {
  const m = new Map<string, ResolvedCompareCard>();
  for (const s of computed.slots) {
    const e = s.entry;
    if (!e) continue;
    m.set(e.display.worldCardId, {
      display: e.display,
      baseOvr: e.baseOvr,
      displayedOvr: e.displayedOvr,
      playerSkills: e.display.playerSkills,
      boosters: e.result.playerBoosters,
      hasConditionalSelection: e.result.booster.hasConditionalSelection,
      conditionalSelections: e.result.booster.conditionalSelections,
      staleBuild: e.staleBuild,
      savedBuildName: e.savedBuildName,
    });
  }
  for (const s of computed.substitutes) {
    if (m.has(s.display.worldCardId)) continue;
    m.set(s.display.worldCardId, {
      display: s.display,
      baseOvr: s.baseOvr,
      displayedOvr: s.displayedOvr,
      playerSkills: s.display.playerSkills,
      boosters: s.result.playerBoosters,
      hasConditionalSelection: s.result.booster.hasConditionalSelection,
      conditionalSelections: s.result.booster.conditionalSelections,
      staleBuild: s.staleBuild,
      savedBuildName: s.savedBuildName,
    });
  }
  return m;
}

function squadCardIds(squad: StoredSquad): string[] {
  const ids = new Set<string>();
  for (const sl of squad.slots) if (sl.worldCardId) ids.add(sl.worldCardId);
  for (const sub of squad.substitutes) ids.add(sub.worldCardId);
  return [...ids].filter((id) => WORLD_ID_RE.test(id));
}

/**
 * 比較ビューのデータ読み込み（読み取り専用）。
 *  - スカッド 2 件を localStorage から読む（内容は書き換えない）。
 *  - 必要な worldCardId を Set で統合し、既存の by-id API で重複なく取得（全 13,009 走査なし）。
 *  - 監督詳細・保存ビルドも取得し、既存 buildSquad で集計する（比較専用の計算はしない）。
 *  - 別タブでのスカッド更新（storage イベント）を検知して再読込を促す。
 */
export function useSquadCompareData(rawA: string | null, rawB: string | null): SquadCompareData {
  const idA = rawA && SQUAD_ID_RE.test(rawA) ? rawA : null;
  const idB = rawB && SQUAD_ID_RE.test(rawB) ? rawB : null;

  const [storageOk, setStorageOk] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [aSquad, setASquad] = useState<StoredSquad | null>(null);
  const [bSquad, setBSquad] = useState<StoredSquad | null>(null);
  const [aMissing, setAMissing] = useState(false);
  const [bMissing, setBMissing] = useState(false);
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [externalUpdate, setExternalUpdate] = useState(false);

  const [details, setDetails] = useState<Map<string, WorldPlayerDetail>>(new Map());
  const [failedCardIds, setFailedCardIds] = useState<string[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const requestedRef = useRef<Set<string>>(new Set());

  const [managers, setManagers] = useState<Map<number, ManagerDetail>>(new Map());
  const [savedBuilds, setSavedBuilds] = useState<Map<string, SavedBuild[]>>(new Map());

  const reload = useCallback(() => {
    requestedRef.current = new Set();
    setDetails(new Map());
    setFailedCardIds([]);
    setManagers(new Map());
    setSavedBuilds(new Map());
    setExternalUpdate(false);
    setNonce((n) => n + 1);
  }, []);

  // --- スカッド読み込み ---
  useEffect(() => {
    setStorageOk(isSquadStorageAvailable());
    setLoadingSquads(true);
    const a = idA ? getSquad(idA) : null;
    const b = idB ? getSquad(idB) : null;
    setASquad(a);
    setBSquad(b);
    setAMissing(idA != null && a == null);
    setBMissing(idB != null && b == null);
    setLoadingSquads(false);
  }, [idA, idB, nonce]);

  // --- 別タブでのスカッド更新を検知 ---
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SQUAD_STORAGE_KEY) setExternalUpdate(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // --- 必要な worldCardId を統合して取得 ---
  const neededCardIds = useMemo(() => {
    const s = new Set<string>();
    if (aSquad) for (const id of squadCardIds(aSquad)) s.add(id);
    if (bSquad) for (const id of squadCardIds(bSquad)) s.add(id);
    return [...s];
  }, [aSquad, bSquad]);

  useEffect(() => {
    const missing = neededCardIds.filter((id) => !requestedRef.current.has(id)).slice(0, 500);
    if (missing.length === 0) return;
    for (const id of missing) requestedRef.current.add(id);
    let cancelled = false;
    setLoadingCards(true);
    setCardError(null);
    Promise.allSettled(
      missing.map((id) =>
        fetch(`/api/world/players/${encodeURIComponent(id)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((data: { player: WorldPlayerDetail }) => ({ id, player: data.player })),
      ),
    )
      .then((settled) => {
        if (cancelled) return;
        const ok = new Map<string, WorldPlayerDetail>();
        const failed: string[] = [];
        settled.forEach((res, i) => {
          if (res.status === "fulfilled" && res.value.player) ok.set(res.value.id, res.value.player);
          else failed.push(missing[i]);
        });
        setDetails((prev) => {
          const next = new Map(prev);
          for (const [k, v] of ok) next.set(k, v);
          return next;
        });
        setSavedBuilds((prev) => {
          const next = new Map(prev);
          for (const id of missing) if (!next.has(id)) next.set(id, listBuilds(id));
          return next;
        });
        if (failed.length) {
          setFailedCardIds((prev) => [...new Set([...prev, ...failed])]);
          setCardError("一部の選手情報を取得できませんでした。");
          // 再試行できるよう要求済みフラグを外す
          for (const id of failed) requestedRef.current.delete(id);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [neededCardIds]);

  // --- 監督詳細 ---
  const managerIds = useMemo(() => {
    const s = new Set<number>();
    if (aSquad?.managerId != null) s.add(aSquad.managerId);
    if (bSquad?.managerId != null) s.add(bSquad.managerId);
    return [...s];
  }, [aSquad?.managerId, bSquad?.managerId]);

  useEffect(() => {
    const missing = managerIds.filter((id) => !managers.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.allSettled(
      missing.map((id) =>
        fetch(`/api/managers/${id}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((data: { manager: ManagerDetail }) => ({ id, manager: data.manager })),
      ),
    ).then((settled) => {
      if (cancelled) return;
      setManagers((prev) => {
        const next = new Map(prev);
        for (const res of settled) {
          if (res.status === "fulfilled" && res.value.manager) next.set(res.value.id, res.value.manager);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [managerIds, managers]);

  // --- 各サイドの CompareSideInput を組み立てる ---
  const buildSide = useCallback(
    (squad: StoredSquad | null): CompareSideInput | null => {
      if (!squad) return null;
      const managerDetail = squad.managerId != null ? managers.get(squad.managerId) ?? null : null;
      const managerContext: ManagerContext | null = managerDetail ? managerToContext(managerDetail) : null;
      const cardIds = squadCardIds(squad);
      const savedBuildsByCard = new Map<string, SavedBuild[]>();
      for (const id of cardIds) savedBuildsByCard.set(id, savedBuilds.get(id) ?? listBuilds(id));
      const input = assembleBuildSquadInput({
        squad,
        details,
        savedBuildsByCard,
        manager: managerContext,
        managerLinkUpPlays: managerDetail?.linkUpPlays ?? null,
      });
      const computed = buildSquad(input);
      const failed = cardIds.filter((id) => failedCardIds.includes(id) && !details.has(id));
      return {
        squad,
        computed,
        managerDetail,
        resolved: resolvedMapFromComputed(computed),
        failedCardIds: failed,
        savedBuildsByCard,
      };
    },
    [managers, details, savedBuilds, failedCardIds],
  );

  const a = useMemo(() => buildSide(aSquad), [buildSide, aSquad]);
  const b = useMemo(() => buildSide(bSquad), [buildSide, bSquad]);

  return {
    storageOk,
    loadingSquads,
    loadingCards,
    a,
    b,
    aSquad,
    bSquad,
    aMissing,
    bMissing,
    failedCardIds,
    cardError,
    externalUpdate,
    reload,
  };
}
