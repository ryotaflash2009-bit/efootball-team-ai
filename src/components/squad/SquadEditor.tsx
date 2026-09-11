"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { WorldPlayerDetail } from "@/lib/world/types";
import type { ManagerContext } from "@/lib/progression/types";
import type { ManagerDetail } from "@/lib/managers/types";
import type { SavedBuild } from "@/lib/progression/types";
import { managerToContext } from "@/lib/managers/to-context";
import { getBuild, listBuilds } from "@/lib/progression/build-storage";
import { toProgressionCard } from "@/lib/progression/from-world";
import { worldDetailToSquadDisplay } from "@/lib/squad/from-world";
import { buildSquad } from "@/lib/squad/build-squad";
import { diagnoseSquad, buildSquadDiagnosisInput } from "@/lib/squad/squad-diagnosis";
import { buildTacticalPlacementInputs } from "@/lib/squad/squad-tactical-review";
import { assignWorldCardToSlot, addWorldCardToBench, type SquadAssignErrorCode } from "@/lib/squad/assign";
import {
  applySquadMove,
  removeSquadPlayer,
  mirrorSquadPositions,
  type SquadLoc,
  type SquadMoveErrorCode,
} from "@/lib/squad/moves";
import {
  clampCoord,
  inferFreshRole,
  inferPlacementRole,
  isPlacementRole,
  PLACEMENT_ROLES,
} from "@/lib/squad/role-inference";
import { calculateSnapCandidate, type SnapSettings } from "@/lib/squad/position-snapping";
import {
  getEditorPreferences,
  setEditorPreferences,
  DEFAULT_EDITOR_PREFERENCES,
  type EditorPreferences,
} from "@/lib/squad/editor-preferences";
import { changeFormation } from "@/lib/squad/formation-change";
import { saveTemplateFromSquad } from "@/lib/squad/templates";
import { squadCompareHref } from "@/lib/squad/to-compare";
import { getFormation, DEFAULT_FORMATION_ID, isFormationId } from "@/lib/squad/formations";
import {
  getSquad,
  saveSquad,
  renameSquad,
  duplicateSquad,
  isSquadStorageAvailable,
  newSubId,
} from "@/lib/squad/squad-storage";
import {
  MAX_SUBSTITUTES,
  SQUAD_NAME_MAX,
  WORLD_CARD_ID_RE,
  BUILD_ID_RE,
  type StoredSquad,
  type SquadBuildMode,
  type SquadEntryInput,
  type StoredLinkUp,
} from "@/lib/squad/types";
import type { SquadBuildUsageRowInput } from "@/lib/progression/my-builds";
import { FormationSelect } from "./FormationSelect";
import { SquadPitch } from "./SquadPitch";
import { SlotPlayerPanel } from "./SlotPlayerPanel";
import { SquadBuildPanel } from "./SquadBuildPanel";
import { SquadBuildUsagePanel } from "./SquadBuildUsagePanel";
import { SquadBench, type BenchRow } from "./SquadBench";
import { SquadManagerPanel } from "./SquadManagerPanel";
import { TeamSummaryPanel } from "./TeamSummaryPanel";
import { SquadDiagnosisPanel } from "./SquadDiagnosisPanel";
import { LinkUpPanel } from "./LinkUpPanel";
import { PlayerSearchPanel } from "./PlayerSearchPanel";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type LoadedCard = { card: ReturnType<typeof toProgressionCard>; display: ReturnType<typeof worldDetailToSquadDisplay> };
type CardState = LoadedCard | "loading" | "error";
type PickTarget = { kind: "slot"; slotId: string } | { kind: "bench" } | null;
type MobileTab = "pitch" | "bench" | "manager" | "summary" | "linkup";
/** 「保存ビルドを選ぶ」パネルの対象枠（開いた時点の worldCardId を保持し、別タブでの入れ替えを検出）。 */
type BuildPanelTarget =
  | { area: "starter"; slotId: string; worldCardId: string }
  | { area: "bench"; subId: string; worldCardId: string };

function useAssignErrorMessage(): Record<SquadAssignErrorCode, string> {
  const t = useT();
  const key = (k: keyof Dictionary["squadEditor"]) => t("squadEditor", k);
  const benchFull = key("assignErrorBenchFullTemplate").replace("{max}", String(MAX_SUBSTITUTES));
  return {
    invalid_world_card_id: key("assignErrorInvalidCard"),
    invalid_slot_id: key("assignErrorInvalidSlot"),
    slot_not_found: key("assignErrorSlotNotFound"),
    duplicate_not_allowed: key("assignErrorDuplicate"),
    slot_occupied: key("assignErrorSlotOccupied"),
    bench_full: benchFull,
  };
}

function useMoveErrorMessage(): Record<SquadMoveErrorCode, string> {
  const t = useT();
  const key = (k: keyof Dictionary["squadEditor"]) => t("squadEditor", k);
  const benchFull = key("assignErrorBenchFullTemplate").replace("{max}", String(MAX_SUBSTITUTES));
  return {
    invalid_squad: key("moveErrorInvalidSquad"),
    invalid_source: key("moveErrorInvalidSource"),
    invalid_target: key("moveErrorInvalidTarget"),
    source_empty: key("moveErrorSourceEmpty"),
    target_not_found: key("moveErrorTargetNotFound"),
    same_location: "",
    bench_full: benchFull,
  };
}

export function SquadEditor({
  squadId,
  initialFormationId,
  pendingWorldCardId = null,
  pendingBuildId = null,
}: {
  squadId: string;
  initialFormationId?: string | null;
  /** My Team「スカッドで使用」からの追加候補（URL の ?card=）。開いただけでは配置しない。 */
  pendingWorldCardId?: string | null;
  /** My Team側で選択されていた保存ビルド（URL の ?build=）。pendingWorldCardIdとセットでのみ有効。 */
  pendingBuildId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const { locale } = useLocale();
  const tse = useCallback((k: keyof Dictionary["squadEditor"]) => t("squadEditor", k), [t]);
  const fillSe = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );
  const ASSIGN_ERROR_MESSAGE = useAssignErrorMessage();
  const MOVE_ERROR_MESSAGE = useMoveErrorMessage();
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "nostorage">("loading");
  const [squad, setSquad] = useState<StoredSquad | null>(null);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [managerDetail, setManagerDetail] = useState<ManagerDetail | null>(null);
  const [managerContext, setManagerContext] = useState<ManagerContext | null>(null);
  const [savedBuildsByCard, setSavedBuildsByCard] = useState<Record<string, SavedBuild[]>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [buildPanelTarget, setBuildPanelTarget] = useState<BuildPanelTarget | null>(null);
  /** 移動・交代モードの移動元（先発スロット or ベンチ index）。クリック / ドラッグ / キーボード共通。 */
  const [moveSource, setMoveSource] = useState<SquadLoc | null>(null);
  /** 位置調整モード対象の先発スロット（矢印キー / タップで座標を微調整）。 */
  const [posAdjust, setPosAdjust] = useState<string | null>(null);
  const [confirmResetPos, setConfirmResetPos] = useState(false);
  const [confirmMirror, setConfirmMirror] = useState(false);
  /** 配置編集の表示設定（スカッド固有ではない・別 localStorage キー）。 */
  const [prefs, setPrefs] = useState<EditorPreferences>(DEFAULT_EDITOR_PREFERENCES);
  useEffect(() => {
    setPrefs(getEditorPreferences());
  }, []);
  const updatePref = useCallback((patch: Partial<EditorPreferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      setEditorPreferences(next);
      return next;
    });
  }, []);
  const snapSettings: SnapSettings = useMemo(
    () => ({
      enabled: prefs.snapEnabled,
      snapToLines: true,
      snapToCenter: true,
      snapToSymmetry: true,
    }),
    [prefs.snapEnabled],
  );
  /** 直前の配置操作の1回 Undo（再読込では保持しない）。 */
  const [undo, setUndo] = useState<{ squad: StoredSquad; label: string } | null>(null);
  const [compareSel, setCompareSel] = useState<string[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>("pitch");
  const [toast, setToast] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 最後に localStorage へ書けた squad の参照（＝これと同じなら未変更）。 */
  const savedSquadRef = useRef<StoredSquad | null>(null);
  /** すでに詳細取得を開始した worldCardId（成功後も保持。失敗時のみ解除して再試行可能にする）。 */
  const requestedCardsRef = useRef<Set<string>>(new Set());
  /** My Team からの追加候補（有効な数字 ID のみ）。開いた時点では配置しない。 */
  const [pendingAdd, setPendingAdd] = useState<string | null>(
    pendingWorldCardId && WORLD_CARD_ID_RE.test(pendingWorldCardId) ? pendingWorldCardId : null,
  );
  /** pendingAdd と一緒に My Team 側で選択されていた保存ビルド(未選択なら null)。 */
  const [pendingAddBuildId, setPendingAddBuildId] = useState<string | null>(
    pendingWorldCardId && WORLD_CARD_ID_RE.test(pendingWorldCardId) && pendingBuildId && BUILD_ID_RE.test(pendingBuildId)
      ? pendingBuildId
      : null,
  );
  useEffect(() => {
    if (pendingWorldCardId && WORLD_CARD_ID_RE.test(pendingWorldCardId)) {
      setPendingAdd(pendingWorldCardId);
      setPendingAddBuildId(pendingBuildId && BUILD_ID_RE.test(pendingBuildId) ? pendingBuildId : null);
    }
  }, [pendingWorldCardId, pendingBuildId]);

  const fallbackFormationId =
    initialFormationId && isFormationId(initialFormationId) ? initialFormationId : DEFAULT_FORMATION_ID;

  // ---- 初回ロード ----
  useEffect(() => {
    const s = getSquad(squadId);
    if (s) {
      savedSquadRef.current = s; // 読み込んだ状態 = 保存済み（hydration 前に「保存済み」と誤表示しない）
      setSquad(s);
      setStatus("ready");
      setSaveState("idle");
    } else if (!isSquadStorageAvailable()) {
      setStatus("nostorage");
    } else {
      setStatus("notfound");
    }
  }, [squadId]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ---- 配置カードの詳細を取得 ----
  const placedIds = useMemo(() => {
    if (!squad) return [] as string[];
    const ids = new Set<string>();
    for (const sl of squad.slots) if (sl.worldCardId) ids.add(sl.worldCardId);
    for (const sub of squad.substitutes) ids.add(sub.worldCardId);
    return [...ids];
  }, [squad]);

  const resolveCard = useCallback((id: string) => {
    // 取得中／取得済みは二重要求しない（cards を依存に入れず ref で判定 → setCards による自己再実行で
    // 取得結果が破棄されるバグを防ぐ）。
    if (requestedCardsRef.current.has(id)) return;
    requestedCardsRef.current.add(id);
    setCards((c) => (c[id] && c[id] !== "error" ? c : { ...c, [id]: "loading" }));
    setSavedBuildsByCard((m) => (m[id] ? m : { ...m, [id]: listBuilds(id) }));
    fetch(`/api/world/players/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { player: WorldPlayerDetail }) => {
        setCards((c) => ({
          ...c,
          [id]: { card: toProgressionCard(data.player), display: worldDetailToSquadDisplay(data.player) },
        }));
      })
      .catch(() => {
        // 失敗は再試行できるように要求済みフラグを外す。worldCardId 自体は squad に残す。
        requestedCardsRef.current.delete(id);
        setCards((c) => ({ ...c, [id]: "error" }));
      });
  }, []);

  useEffect(() => {
    for (const id of placedIds) resolveCard(id);
  }, [placedIds, resolveCard]);

  // 追加候補（My Team 由来）の選手名も解決しておく
  useEffect(() => {
    if (pendingAdd) resolveCard(pendingAdd);
  }, [pendingAdd, resolveCard]);

  /** 追加候補(カード・ビルド)を解除し、URL の ?card=/?build= を落とす（再読込で再発火しないように）。 */
  const clearPendingAdd = useCallback(() => {
    setPendingAdd(null);
    setPendingAddBuildId(null);
    if (pendingWorldCardId) router.replace(pathname, { scroll: false });
  }, [pendingWorldCardId, router, pathname]);

  /** pendingAddBuildId が指す保存ビルド(取得できなければ null)。削除済み・不正なIDは安全にnullになる。 */
  const pendingAddBuild: SavedBuild | null = pendingAdd && pendingAddBuildId ? getBuild(pendingAdd, pendingAddBuildId) : null;
  /** ビルドIDが指定されているのに解決できない(削除済み・不正)場合。カードだけは引き継いで良いかを判定する。 */
  const pendingAddBuildInvalid = !!pendingAdd && !!pendingAddBuildId && !pendingAddBuild;

  // Escape で移動・交代モードをキャンセル
  useEffect(() => {
    if (!moveSource) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoveSource(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSource]);

  // ---- 監督詳細を取得 ----
  useEffect(() => {
    const mid = squad?.managerId ?? null;
    if (mid == null) {
      setManagerDetail(null);
      setManagerContext(null);
      return;
    }
    if (managerDetail?.internalManagerId === mid) return;
    let cancelled = false;
    fetch(`/api/managers/${mid}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { manager: ManagerDetail }) => {
        if (cancelled) return;
        setManagerDetail(data.manager);
        setManagerContext(managerToContext(data.manager));
      })
      .catch(() => {
        if (!cancelled) flashToast(tse("managerFetchFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [squad?.managerId, managerDetail?.internalManagerId, flashToast, tse]);

  /** 保存を実行し、結果を saveState に反映（自動保存・手動保存・再試行の共通経路）。 */
  const runSave = useCallback((s: StoredSquad) => {
    const r = saveSquad(s);
    if (r.ok) {
      savedSquadRef.current = s;
      setSaveState("saved");
    } else {
      setSaveState("error");
    }
    return r;
  }, []);

  // ---- 自動保存（Zod 検証はストレージ層・hydration 前や未変更では走らせない） ----
  useEffect(() => {
    if (status !== "ready" || !squad) return;
    if (squad === savedSquadRef.current) return; // 変更なし
    setSaveState("saving");
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => runSave(squad), 500);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, [squad, status, runSave]);

  // ---- ミューテーション ----
  const patch = useCallback((fn: (s: StoredSquad) => StoredSquad) => {
    setSquad((s) => (s ? { ...fn(s), updatedAt: new Date().toISOString() } : s));
  }, []);

  // 選手配置の検証は「現在の squad」で行う（古いクロージャを掴まないよう ref を使う）
  const squadRef = useRef<StoredSquad | null>(squad);
  squadRef.current = squad;

  /**
   * 「保存ビルドを選ぶ」パネルから、対象枠の savedBuildId だけを設定・解除する。
   * 更新直前に現在の編集 state で対象枠・worldCardId・（設定時は）保存ビルドを再検証し、
   * 対象枠 1 件のみ patch する（他枠・座標・配置・キャプテン・セットプレー・監督・他スカッドは変更しない）。
   * My Team の selectedBuildId / favoriteBuildId には一切触れない。
   */
  const applySquadBuild = useCallback(
    (target: BuildPanelTarget, buildId: string | null) => {
      const cur = squadRef.current;
      if (!cur) return;
      if (!isSquadStorageAvailable()) {
        flashToast(tse("storageUnavailableShort"));
        return;
      }
      if (target.area === "starter") {
        const sl = cur.slots.find((s) => s.slotId === target.slotId);
        if (!sl) {
          flashToast(tse("slotNotFoundReopen"));
          return;
        }
        if (sl.worldCardId == null || sl.worldCardId !== target.worldCardId) {
          flashToast(tse("slotCardChangedReopen"));
          return;
        }
        if ((sl.savedBuildId ?? null) === buildId) return;
        if (buildId != null && !getBuild(target.worldCardId, buildId)) {
          flashToast(tse("buildNotFoundDeleted"));
          return;
        }
        patch((s) => ({
          ...s,
          slots: s.slots.map((x) => (x.slotId === target.slotId ? { ...x, savedBuildId: buildId } : x)),
        }));
      } else {
        const sub = cur.substitutes.find((s) => s.subId === target.subId);
        if (!sub) {
          flashToast(tse("slotNotFoundReopen"));
          return;
        }
        if (sub.worldCardId !== target.worldCardId) {
          flashToast(tse("slotCardChangedReopen"));
          return;
        }
        if ((sub.savedBuildId ?? null) === buildId) return;
        if (buildId != null && !getBuild(target.worldCardId, buildId)) {
          flashToast(tse("buildNotFoundDeleted"));
          return;
        }
        patch((s) => ({
          ...s,
          substitutes: s.substitutes.map((x) => (x.subId === target.subId ? { ...x, savedBuildId: buildId } : x)),
        }));
      }
    },
    [patch, flashToast, tse],
  );

  /** 別タブ更新後、編集中スカッドを storage の最新へ読み直す（このタブの未保存差分は破棄）。 */
  const reloadSquadFromStorage = useCallback(() => {
    const s = getSquad(squadId);
    if (s) {
      savedSquadRef.current = s;
      setSquad(s);
      setSaveState("idle");
      flashToast(tse("reloadedFromStorage"));
    }
  }, [squadId, flashToast, tse]);

  const placedWhere = useCallback(
    (worldCardId: string): string | null => {
      if (!squad) return null;
      const f = getFormation(squad.formationId);
      const sl = squad.slots.find((x) => x.worldCardId === worldCardId);
      if (sl) return f.slots.find((fs) => fs.slotId === sl.slotId)?.position ?? tse("starterFallbackLabel");
      if (squad.substitutes.some((x) => x.worldCardId === worldCardId)) return tse("benchAreaFallbackLabel");
      return null;
    },
    [squad, tse],
  );

  /**
   * 単一の配置処理を通す（ピッチ枠／ベンチ／My Team 導線すべて共通）。true = 配置できた。
   * `savedBuildId` を渡すと、配置と同じ1回の squad 更新の中で保存ビルド参照も一緒に設定する
   * (setSquad は非同期に反映されるため、配置後に別途 squadRef.current 経由でビルドを紐付けようとすると
   * 更新前のsquadRefを参照してしまい失敗する。そのため必ず同一の更新内でまとめて行う)。
   * ビルドIDが指定されても保存ビルドが見つからない(削除済み・不正)場合は、配置自体は行うが
   * ビルドは紐付けない(既存のapplySquadBuildと同じ安全確認)。
   */
  const placeInSlot = useCallback(
    (slotId: string, worldCardId: string, savedBuildId?: string | null): boolean => {
      const cur = squadRef.current;
      if (!cur) return false;
      const r = assignWorldCardToSlot(cur, slotId, worldCardId);
      if (!r.ok) {
        flashToast(ASSIGN_ERROR_MESSAGE[r.errorCode]);
        return false;
      }
      const verifiedBuildId = savedBuildId && getBuild(worldCardId, savedBuildId) ? savedBuildId : null;
      const finalSquad = verifiedBuildId
        ? { ...r.squad, slots: r.squad.slots.map((x) => (x.slotId === slotId ? { ...x, savedBuildId: verifiedBuildId } : x)) }
        : r.squad;
      setSquad(finalSquad);
      setPickTarget(null);
      setSelectedSlotId(slotId);
      return true;
    },
    [flashToast, ASSIGN_ERROR_MESSAGE],
  );

  /** ベンチへ追加する（成功時は新規subId、失敗時はnullを返す。呼び出し側で保存ビルド紐付け等に使える）。 */
  const addBench = useCallback(
    (worldCardId: string, savedBuildId?: string | null): string | null => {
      const cur = squadRef.current;
      if (!cur) return null;
      const r = addWorldCardToBench(cur, worldCardId, newSubId);
      if (!r.ok) {
        flashToast(ASSIGN_ERROR_MESSAGE[r.errorCode]);
        return null;
      }
      const verifiedBuildId = savedBuildId && getBuild(worldCardId, savedBuildId) ? savedBuildId : null;
      const finalSquad = verifiedBuildId
        ? {
            ...r.squad,
            substitutes: r.squad.substitutes.map((x) => (x.worldCardId === worldCardId ? { ...x, savedBuildId: verifiedBuildId } : x)),
          }
        : r.squad;
      setSquad(finalSquad);
      setPickTarget(null);
      const added = finalSquad.substitutes.find((s) => s.worldCardId === worldCardId);
      return added?.subId ?? null;
    },
    [flashToast, ASSIGN_ERROR_MESSAGE],
  );

  /** 配置操作の直前状態を Undo 用に退避（再読込では保持しない）。 */
  const snapshotForUndo = useCallback((label: string) => {
    const cur = squadRef.current;
    if (cur) setUndo({ squad: cur, label });
  }, []);

  /** 移動・交代の単一エントリ（クリック / ドラッグ / キーボード共通）。 */
  const applyMove = useCallback(
    (from: SquadLoc, to: SquadLoc) => {
      const cur = squadRef.current;
      if (!cur) return;
      const r = applySquadMove(cur, from, to, newSubId);
      setMoveSource(null);
      if (!r.ok) {
        if (r.errorCode !== "same_location") flashToast(MOVE_ERROR_MESSAGE[r.errorCode]);
        return;
      }
      snapshotForUndo(r.operation);
      setSquad(r.squad);
      if (to.area === "starter") setSelectedSlotId(to.slotId);
      flashToast(r.warnings.length ? `${r.operation}（${r.warnings.join(" / ")}）` : r.operation);
    },
    [flashToast, snapshotForUndo, MOVE_ERROR_MESSAGE],
  );

  const removeFromSlot = useCallback(
    (slotId: string) => {
      const cur = squadRef.current;
      if (!cur) return;
      const r = removeSquadPlayer(cur, { area: "starter", slotId });
      if (!r.ok) return;
      snapshotForUndo(r.operation);
      setSquad(r.squad);
      if (r.warnings.length) flashToast(r.warnings.join(" / "));
    },
    [flashToast, snapshotForUndo],
  );

  const removeFromBench = useCallback(
    (index: number) => {
      const cur = squadRef.current;
      if (!cur) return;
      const r = removeSquadPlayer(cur, { area: "bench", index });
      if (!r.ok) return;
      snapshotForUndo(r.operation);
      setSquad(r.squad);
    },
    [snapshotForUndo],
  );

  const moveSlotToBench = useCallback(
    (slotId: string) => {
      const cur = squadRef.current;
      if (cur) applyMove({ area: "starter", slotId }, { area: "bench", index: cur.substitutes.length });
    },
    [applyMove],
  );

  /** ベンチ内の並び替え（トースト無しの軽量版）。 */
  const reorderBenchAt = useCallback(
    (from: number, to: number) => {
      const cur = squadRef.current;
      if (!cur || from === to) return;
      const r = applySquadMove(cur, { area: "bench", index: from }, { area: "bench", index: to }, newSubId);
      if (!r.ok) return;
      snapshotForUndo(r.operation);
      setSquad(r.squad);
    },
    [snapshotForUndo],
  );

  /** 先発スロットを自由座標へ配置（ロールは座標＋直前ロールから判定・ドロップ時に 1 回確定）。 */
  const applyFreePosition = useCallback(
    (slotId: string, x: number, y: number, opts?: { silent?: boolean; disableSnap?: boolean }) => {
      const cur = squadRef.current;
      if (!cur) return;
      const sl = cur.slots.find((s) => s.slotId === slotId);
      if (!sl?.worldCardId) return;
      const fdef = new Map(getFormation(cur.formationId).slots.map((s) => [s.slotId, s]));
      // 配置補助スナップ（弱い補助）。他の配置済み先発を参照。
      const others = cur.slots
        .filter((s) => s.worldCardId && s.slotId !== slotId)
        .map((s) => {
          const fs = fdef.get(s.slotId);
          return { slotId: s.slotId, x: clampCoord(s.x ?? fs?.x ?? 50), y: clampCoord(s.y ?? fs?.y ?? 50) };
        });
      const snap = calculateSnapCandidate({
        movingSlotId: slotId,
        proposedX: x,
        proposedY: y,
        existingPlacements: others,
        settings: snapSettings,
        disableSnap: opts?.disableSnap,
      });
      const nx = snap.x;
      const ny = snap.y;
      // ロール判定は「スナップ後の最終座標」に対して行う。
      const prevRole = isPlacementRole(sl.roleOverride)
        ? sl.roleOverride
        : inferFreshRole(clampCoord(sl.x ?? 50), clampCoord(sl.y ?? 50));
      const inf = inferPlacementRole(nx, ny, prevRole);
      snapshotForUndo(snap.snapApplied ? tse("undoLabelMovedSnap") : tse("undoLabelMoved"));
      setSquad({
        ...cur,
        slots: cur.slots.map((s) => (s.slotId === slotId ? { ...s, x: nx, y: ny } : s)),
        updatedAt: new Date().toISOString(),
      });
      setSelectedSlotId(slotId);
      if (!opts?.silent) {
        const role = isPlacementRole(sl.roleOverride) ? sl.roleOverride : inf.role;
        const snapNote = snap.snapApplied
          ? `・${snap.snapTypes
              .map((st) => (st === "horizontal" ? tse("snapTypeHorizontal") : st === "center" ? tse("snapTypeCenter") : tse("snapTypeSymmetry")))
              .join("/")}`
          : "";
        flashToast(
          `${tse("placementRoleToastPrefix")}${role}${isPlacementRole(sl.roleOverride) ? tse("placementRoleManualSuffix") : ""}${snapNote}`,
        );
      }
    },
    [snapshotForUndo, flashToast, snapSettings, tse],
  );

  /** 配置ロールの手動上書き（auto / 特定ロール）。 */
  const setRoleOverride = useCallback(
    (slotId: string, role: string | null) => {
      const cur = squadRef.current;
      if (!cur) return;
      const next = role && isPlacementRole(role) ? role : null;
      snapshotForUndo(next ? fillSe(tse("roleManualOverrideTemplate"), { role: next }) : tse("roleAutoRestored"));
      setSquad({
        ...cur,
        slots: cur.slots.map((s) => (s.slotId === slotId ? { ...s, roleOverride: next } : s)),
        updatedAt: new Date().toISOString(),
      });
    },
    [snapshotForUndo, tse, fillSe],
  );

  /** 全先発を現在フォーメーションの初期位置へ戻す（選手・ビルド・ブースター・役割設定は保持）。 */
  const resetToFormationPositions = useCallback(() => {
    const cur = squadRef.current;
    if (!cur) return;
    const fdef = new Map(getFormation(cur.formationId).slots.map((s) => [s.slotId, s]));
    snapshotForUndo(tse("undoLabelResetToFormation"));
    setSquad({
      ...cur,
      slots: cur.slots.map((s) => {
        const fs = fdef.get(s.slotId);
        return fs ? { ...s, x: fs.x, y: fs.y, roleOverride: null } : s;
      }),
      updatedAt: new Date().toISOString(),
    });
    flashToast(tse("freePositionReset"));
  }, [snapshotForUndo, flashToast, tse]);

  /** 先発配置だけを左右反転（選手・ビルド・ブースター・キャプテン・セットプレー・ベンチは維持）。 */
  const doMirror = useCallback(() => {
    const cur = squadRef.current;
    if (!cur) return;
    const r = mirrorSquadPositions(cur);
    if (!r.ok) return;
    snapshotForUndo(r.operation);
    setSquad(r.squad);
    setPosAdjust(null);
    flashToast(tse("mirrorApplied"));
  }, [snapshotForUndo, flashToast, tse]);

  // 位置調整モード: 矢印キーで座標を微調整（Shift で大きく）、Enter/Esc で終了
  useEffect(() => {
    if (!posAdjust) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        setPosAdjust(null);
        return;
      }
      const step = e.shiftKey ? 6 : 2;
      const dxy: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = dxy[e.key];
      if (!d) return;
      e.preventDefault();
      const cur = squadRef.current;
      const sl = cur?.slots.find((s) => s.slotId === posAdjust);
      if (!cur || !sl?.worldCardId) return;
      // 矢印での微調整は既定でスナップ、Alt+矢印でスナップなし（§37）。
      applyFreePosition(posAdjust, clampCoord(sl.x ?? 50) + d[0], clampCoord(sl.y ?? 50) + d[1], {
        silent: true,
        disableSnap: e.altKey,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [posAdjust, applyFreePosition]);

  const doUndo = useCallback(() => {
    setUndo((u) => {
      if (u) {
        setSquad(u.squad);
        setMoveSource(null);
        flashToast(fillSe(tse("undoDoneTemplate"), { label: u.label }));
      }
      return null;
    });
  }, [flashToast, tse, fillSe]);

  const setFormation = useCallback(
    (formationId: string) => {
      setSquad((s) => {
        if (!s) return s;
        const { squad: next, movedToBench, dropped } = changeFormation(s, formationId);
        if (movedToBench.length) flashToast(fillSe(tse("movedToBenchTemplate"), { count: String(movedToBench.length) }));
        if (dropped.length) flashToast(fillSe(tse("droppedBenchFullTemplate"), { count: String(dropped.length) }));
        return next;
      });
      setSelectedSlotId(null);
      setMoveSource(null);
      setPosAdjust(null);
      setConfirmMirror(false);
      setConfirmResetPos(false);
      setUndo(null);
    },
    [flashToast, tse, fillSe],
  );

  /** 移動・交代モードを開始（先発スロット / ベンチ index）。 */
  const beginMove = useCallback((loc: SquadLoc) => {
    setMoveSource(loc);
    setPickTarget(null);
    if (loc.area === "starter") setSelectedSlotId(loc.slotId);
  }, []);

  const onSlotClick = useCallback(
    (slotId: string) => {
      // 移動・交代モード中はスロットを移動先として扱う
      if (moveSource) {
        applyMove(moveSource, { area: "starter", slotId });
        return;
      }
      setSelectedSlotId(slotId);
      const empty = squad?.slots.find((x) => x.slotId === slotId && !x.worldCardId);
      // My Team からの追加候補がある場合は、空き枠タップで検索を挟まず直接配置する
      // (保存ビルドIDが指定されているのに解決できない間は、スカッドを変更せずブロックする)。
      if (empty && pendingAdd && !pendingAddBuildInvalid) {
        if (placeInSlot(slotId, pendingAdd, pendingAddBuildId)) {
          flashToast(tse("pendingPlacedNotice"));
        }
        clearPendingAdd();
        return;
      }
      if (empty) setPickTarget({ kind: "slot", slotId });
      else setPickTarget(null);
    },
    [moveSource, applyMove, squad, pendingAdd, pendingAddBuildId, pendingAddBuildInvalid, placeInSlot, clearPendingAdd, flashToast, tse],
  );

  /** ベンチ枠（選手 or 空き）をクリック。 */
  const onBenchClick = useCallback(
    (index: number) => {
      if (moveSource) {
        applyMove(moveSource, { area: "bench", index });
        return;
      }
      const cur = squadRef.current;
      if (cur && index < cur.substitutes.length) beginMove({ area: "bench", index });
    },
    [moveSource, applyMove, beginMove],
  );

  const toggleCompare = useCallback((worldCardId: string) => {
    setCompareSel((prev) =>
      prev.includes(worldCardId) ? prev.filter((x) => x !== worldCardId) : prev.length >= 4 ? prev : [...prev, worldCardId],
    );
  }, []);

  const doReset = useCallback(() => {
    patch((s) => ({
      ...s,
      slots: getFormation(s.formationId).slots.map((fs) => ({ slotId: fs.slotId, worldCardId: null, buildMode: "none", savedBuildId: null })),
      substitutes: [],
      managerId: null,
      captainSlotId: null,
      setPieces: { corners: null, freeKicks: null, penalties: null },
      linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    }));
    setCompareSel([]);
    setSelectedSlotId(null);
    setConfirmReset(false);
    setMoveSource(null);
    setPosAdjust(null);
    setUndo(null);
  }, [patch]);

  // ---- 計算 ----
  const makeEntry = useCallback(
    (
      worldCardId: string,
      buildMode: SquadBuildMode,
      savedBuildId: string | null,
      boosters?: SquadEntryInput["selectedPlayerBoosters"],
      conditionalBoosters?: SquadEntryInput["selectedConditionalBoosters"],
    ): SquadEntryInput | null => {
      const c = cards[worldCardId];
      if (!c || c === "loading" || c === "error") return null;
      let savedAllocation: Record<string, number> | null = null;
      let savedBuildName: string | null = null;
      let savedBuildRulesVersion: string | null = null;
      if (savedBuildId) {
        const b = (savedBuildsByCard[worldCardId] ?? []).find((x) => x.buildId === savedBuildId);
        if (b) {
          savedAllocation = b.progressionAllocation;
          savedBuildName = b.buildName;
          savedBuildRulesVersion = b.rulesVersion;
        }
      }
      return {
        card: c.card,
        display: c.display,
        buildMode,
        savedAllocation,
        savedBuildName,
        savedBuildRulesVersion,
        selectedPlayerBoosters: boosters ?? [],
        selectedConditionalBoosters: conditionalBoosters ?? [],
      };
    },
    [cards, savedBuildsByCard],
  );

  // slotId → { x, y, inferredRole, roleOverride, effectiveRole }
  const placements = useMemo(() => {
    const out: Record<
      string,
      { x: number; y: number; inferredRole: string; roleOverride: string | null; role: string }
    > = {};
    if (!squad) return out;
    const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
    for (const sl of squad.slots) {
      if (!sl.worldCardId) continue;
      const fs = fdef.get(sl.slotId);
      const x = clampCoord(sl.x ?? fs?.x ?? 50);
      const y = clampCoord(sl.y ?? fs?.y ?? 50);
      const inferredRole = inferFreshRole(x, y);
      const roleOverride = isPlacementRole(sl.roleOverride) ? sl.roleOverride : null;
      out[sl.slotId] = { x, y, inferredRole, roleOverride, role: roleOverride ?? inferredRole };
    }
    return out;
  }, [squad]);

  const computed = useMemo(() => {
    const formationId = squad?.formationId ?? fallbackFormationId;
    const entries: Record<string, SquadEntryInput | null> = {};
    const slotPlacements: Record<string, { x: number; y: number; role: string }> = {};
    if (squad) {
      for (const sl of squad.slots) {
        entries[sl.slotId] = sl.worldCardId
          ? makeEntry(sl.worldCardId, sl.buildMode, sl.savedBuildId, sl.boosters, sl.conditionalBoosters)
          : null;
        const p = placements[sl.slotId];
        if (p) slotPlacements[sl.slotId] = { x: p.x, y: p.y, role: p.role };
      }
    }
    const substitutes = squad
      ? squad.substitutes
          .map((sub) => {
            const e = makeEntry(sub.worldCardId, sub.buildMode, sub.savedBuildId, sub.boosters, sub.conditionalBoosters);
            return e ? { subId: sub.subId, entry: e } : null;
          })
          .filter((x): x is { subId: string; entry: SquadEntryInput } => x != null)
      : [];
    return buildSquad({
      formationId,
      entries,
      substitutes,
      manager: managerContext,
      managerLinkUpPlays: managerDetail?.linkUpPlays ?? null,
      captainSlotId: squad?.captainSlotId ?? null,
      linkUpSelection: squad?.linkUp ?? { centerPieceSlotId: null, keyManSlotId: null },
      savedRulesVersion: squad?.rulesVersion ?? null,
      slotPlacements,
    });
  }, [squad, managerContext, managerDetail, makeEntry, fallbackFormationId, placements]);

  // ---- スカッド診断（読み取り専用・純関数）----
  const managerResolved = squad?.managerId == null || managerContext != null;
  const diagnosis = useMemo(() => {
    if (!squad) return null;
    const buildsById = new Map<string, SavedBuild>();
    for (const list of Object.values(savedBuildsByCard)) {
      for (const b of list) buildsById.set(b.buildId, b);
    }
    const input = buildSquadDiagnosisInput({ squad, computed, buildsById, managerResolved });
    return diagnoseSquad(input);
  }, [squad, computed, savedBuildsByCard, managerResolved]);

  const tacticalPlacements = useMemo(
    () => buildTacticalPlacementInputs({ formation: computed.formation, slots: computed.slots }),
    [computed],
  );

  const selectedSlot = computed.slots.find((s) => s.slotId === selectedSlotId) ?? null;
  const selectedStoredSlot = squad?.slots.find((x) => x.slotId === selectedSlotId) ?? null;
  const starterOptions = useMemo(
    () =>
      computed.slots
        .filter((s) => s.entry)
        .map((s) => ({
          slotId: s.slotId,
          label: `${s.position} · ${resolvePlayerDisplayName(s.entry!.display, locale, s.entry!.display.worldCardId)}`,
        })),
    [computed, locale],
  );

  // ベンチ行（index は squad.substitutes と 1:1・未解決カードでもズレない）
  const benchRows = useMemo(() => {
    if (!squad) return [] as BenchRow[];
    return squad.substitutes.map((sub, index): BenchRow => {
      const c = cards[sub.worldCardId];
      const resolved = c && c !== "loading" && c !== "error" ? c : null;
      const cs = computed.substitutes.find((x) => x.subId === sub.subId) ?? null;
      return {
        index,
        subId: sub.subId,
        worldCardId: sub.worldCardId,
        name: resolvePlayerDisplayName(
          resolved?.display ?? {},
          locale,
          fillSe(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: sub.worldCardId }),
        ),
        registeredPosition: resolved?.display.registeredPosition ?? null,
        displayedOvr: cs?.displayedOvr ?? null,
        buildMode: sub.buildMode,
        staleBuild: cs?.staleBuild ?? false,
        savedBuildId: sub.savedBuildId ?? null,
        savedBuildName: cs?.savedBuildName ?? null,
        state: c === "error" ? "error" : resolved ? "ok" : "loading",
      };
    });
  }, [squad, cards, computed, fillSe, t, locale]);
  const starterPlacementRefs = useMemo(
    () => Object.entries(placements).map(([slotId, p]) => ({ slotId, x: p.x, y: p.y })),
    [placements],
  );

  // ビルド使用状況サマリー（現在の 1 スカッドのみ・表示専用）用の行
  const buildUsageRows = useMemo<SquadBuildUsageRowInput[]>(() => {
    if (!squad) return [];
    const posBySlot = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s.position]));
    const out: SquadBuildUsageRowInput[] = [];
    for (const sl of squad.slots) {
      if (!sl.worldCardId) continue;
      const disp = computed.slots.find((x) => x.slotId === sl.slotId)?.entry?.display ?? null;
      out.push({
        key: sl.slotId,
        area: "starter",
        slotLabel: posBySlot.get(sl.slotId) ?? tse("starterFallbackLabel"),
        worldCardId: sl.worldCardId,
        playerName: resolvePlayerDisplayName(disp ?? {}, locale, fillSe(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: sl.worldCardId })),
        savedBuildId: sl.savedBuildId ?? null,
      });
    }
    squad.substitutes.forEach((sub, i) => {
      const disp = computed.substitutes.find((x) => x.subId === sub.subId)?.display ?? null;
      out.push({
        key: sub.subId,
        area: "bench",
        slotLabel: `${t("bench", "benchSlotLabel")} ${i + 1}`,
        worldCardId: sub.worldCardId,
        playerName: resolvePlayerDisplayName(disp ?? {}, locale, fillSe(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: sub.worldCardId })),
        savedBuildId: sub.savedBuildId ?? null,
      });
    });
    return out;
  }, [squad, computed, t, tse, fillSe, locale]);

  /** サマリー一覧の「保存ビルドを選ぶ」→ 対象枠の M1 パネルを開く。 */
  const openBuildPanelFor = useCallback((row: { area: "starter" | "bench"; key: string }) => {
    const cur = squadRef.current;
    if (!cur) return;
    if (row.area === "starter") {
      const sl = cur.slots.find((s) => s.slotId === row.key);
      if (sl?.worldCardId) setBuildPanelTarget({ area: "starter", slotId: row.key, worldCardId: sl.worldCardId });
    } else {
      const sub = cur.substitutes.find((s) => s.subId === row.key);
      if (sub) setBuildPanelTarget({ area: "bench", subId: row.key, worldCardId: sub.worldCardId });
    }
  }, []);

  const hasCustomPositioningNow = useMemo(() => {
    if (!squad) return false;
    const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
    return squad.slots.some((sl) => {
      if (!sl.worldCardId) return false;
      if (sl.roleOverride) return true;
      const fs = fdef.get(sl.slotId);
      if (!fs || sl.x == null || sl.y == null) return false;
      return Math.abs(sl.x - fs.x) > 1.5 || Math.abs(sl.y - fs.y) > 1.5;
    });
  }, [squad]);

  const moveSourceName = useMemo(() => {
    if (!moveSource) return null;
    if (moveSource.area === "starter") {
      const e = computed.slots.find((s) => s.slotId === moveSource.slotId)?.entry;
      return (
        e?.display.nameJa ||
        e?.display.nameEn ||
        fillSe(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: squad?.slots.find((x) => x.slotId === moveSource.slotId)?.worldCardId ?? "" })
      );
    }
    return benchRows[moveSource.index]?.name ?? `${t("bench", "benchSlotLabel")} ${moveSource.index + 1}`;
  }, [moveSource, computed, squad, benchRows, t, fillSe]);
  const allPlacedSet = useMemo(() => {
    const set = new Set<string>();
    if (squad) {
      for (const sl of squad.slots) if (sl.worldCardId) set.add(sl.worldCardId);
      for (const sub of squad.substitutes) set.add(sub.worldCardId);
    }
    return set;
  }, [squad]);

  // 配置済みだが選手詳細を解決できていないカード（空きスロットとは区別して表示する）
  const cardResolution = useMemo(() => {
    const loading: string[] = [];
    const failed: string[] = [];
    for (const id of placedIds) {
      const st = cards[id];
      if (st === "error") failed.push(id);
      else if (!st || st === "loading") loading.push(id);
    }
    return { loading, failed };
  }, [placedIds, cards]);

  const pendingCardState = pendingAdd ? cards[pendingAdd] : undefined;
  const pendingName =
    pendingCardState && pendingCardState !== "loading" && pendingCardState !== "error"
      ? pendingCardState.display.nameJa ||
        pendingCardState.display.nameEn ||
        fillSe(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: pendingAdd ?? "" })
      : pendingAdd
        ? fillSe(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: pendingAdd })
        : "";
  const pendingAlreadyPlaced = !!pendingAdd && allPlacedSet.has(pendingAdd);

  const retryCard = useCallback(
    (id: string) => {
      requestedCardsRef.current.delete(id);
      setCards((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
      resolveCard(id);
    },
    [resolveCard],
  );

  // ---- レンダリング（状態別） ----
  if (status === "loading") {
    return <SkeletonEditor computed={computed} />;
  }
  if (status === "nostorage") {
    return <Notice title={tse("noStorageTitle")}>{tse("noStorageDescription")}</Notice>;
  }
  if (status === "notfound" || !squad) {
    return (
      <Notice title={tse("notFoundTitle")}>
        {tse("notFoundDescription")}
        <div className="mt-3">
          <Link href="/squads" className="text-sm text-accent">
            ← {tse("backToSquadList")}
          </Link>
        </div>
      </Notice>
    );
  }

  const compareHref = squadCompareHref(
    compareSel.map((id) => {
      const sl = squad.slots.find((x) => x.worldCardId === id);
      const sub = squad.substitutes.find((x) => x.worldCardId === id);
      return { worldCardId: id, buildMode: (sl?.buildMode ?? sub?.buildMode ?? "none") as SquadBuildMode };
    }),
    squad.managerId,
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/squads" className="inline-flex w-fit items-center gap-1 text-sm text-text-dim hover:text-accent">
        <Icon name="chevron-left" size={16} />
        {tse("backToSquadList")}
      </Link>

      {/* ヘッダー（スティッキー） */}
      <Surface
        tone="raised"
        padding="sm"
        className="sticky top-header z-20 flex flex-col gap-2 !bg-surface/95 backdrop-blur"
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={squad.squadName}
            maxLength={SQUAD_NAME_MAX}
            onChange={(e) => patch((s) => ({ ...s, squadName: e.target.value }))}
            aria-label={tse("squadNameAriaLabel")}
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 text-base font-bold focus-visible:border-accent"
          />
          <FormationSelect value={squad.formationId} onChange={setFormation} />
          <Button
            variant="primary"
            size="sm"
            iconLeft={savedFlash ? "check" : undefined}
            onClick={() => {
              if (autosaveRef.current) clearTimeout(autosaveRef.current);
              const r = runSave(squad);
              if (r.ok) {
                setSavedFlash(true);
                setTimeout(() => setSavedFlash(false), 1500);
              } else flashToast(r.error);
            }}
          >
            {savedFlash ? tse("savedButtonLabel") : tse("saveButtonLabel")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            aria-live="polite"
            className={
              saveState === "error"
                ? "font-semibold text-danger"
                : saveState === "saving"
                  ? "text-warning"
                  : saveState === "saved"
                    ? "text-accent"
                    : "text-text-muted"
            }
          >
            {saveState === "saving"
              ? tse("saveStateSaving")
              : saveState === "saved"
                ? tse("saveStateSaved")
                : saveState === "error"
                  ? tse("saveStateError")
                  : tse("saveStateIdle")}
          </span>
          {saveState === "error" ? (
            <button
              type="button"
              onClick={() => {
                if (autosaveRef.current) clearTimeout(autosaveRef.current);
                const r = runSave(squad);
                if (!r.ok) flashToast(r.error);
              }}
              className="rounded-md border border-danger px-2 py-0.5 text-danger hover:opacity-80"
            >
              {tse("retrySaveButton")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const r = duplicateSquad(squad.squadId);
              if (r.ok) router.push(`/squads/${r.squad.squadId}`);
              else flashToast(r.error);
            }}
            className="rounded-md border border-border px-2.5 py-1 hover:border-accent"
          >
            {tse("duplicateButton")}
          </button>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(tse("templateNamePromptLabel"), `${squad.squadName}${tse("templateNamePromptSuffix")}`);
              if (name == null) return;
              const r = saveTemplateFromSquad(squad, name);
              flashToast(r.ok ? tse("templateSavedNotice") : r.error);
            }}
            className="rounded-md border border-border px-2.5 py-1 hover:border-accent"
          >
            {tse("saveAsTemplateButton")}
          </button>
          <Link href="/squads/templates" className="rounded-md border border-border px-2.5 py-1 hover:border-accent">
            {tse("templateListLink")}
          </Link>
          <Link
            href={`/squads/compare?a=${encodeURIComponent(squad.squadId)}`}
            className="rounded-md border border-border px-2.5 py-1 hover:border-accent"
            title={tse("compareWithAnotherTitle")}
          >
            {tse("compareWithAnotherLink")}
          </Link>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(tse("renamePromptLabel"), squad.squadName);
              if (name == null) return;
              const r = renameSquad(squad.squadId, name);
              if (r.ok) {
                savedSquadRef.current = r.squad;
                setSquad(r.squad);
                setSaveState("saved");
              } else flashToast(r.error);
            }}
            className="rounded-md border border-border px-2.5 py-1 hover:border-accent"
          >
            {tse("renameButton")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-md border border-border px-2.5 py-1 text-danger hover:opacity-80"
          >
            {tse("resetButton")}
          </button>
        </div>
        {computed.rulesOutdated ? (
          <p className="rounded bg-warning/10 px-2 py-1 text-xs text-warning">{tse("rulesOutdatedNotice")}</p>
        ) : null}
      </Surface>

      {toast ? (
        <p className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text">{toast}</p>
      ) : null}

      {cardResolution.loading.length > 0 ? (
        <p className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-dim">
          {fillSe(tse("loadingPlacedCardsTemplate"), { count: String(cardResolution.loading.length) })}
        </p>
      ) : null}
      {cardResolution.failed.length > 0 ? (
        <div className="rounded-md border border-danger/50 bg-danger/5 px-3 py-2 text-xs">
          <p className="text-danger">
            {fillSe(tse("failedPlacedCardsTemplate"), { count: String(cardResolution.failed.length) })}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {cardResolution.failed.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => retryCard(id)}
                  className="rounded border border-border px-2 py-0.5 hover:border-accent"
                >
                  {fillSe(tse("retryWithIdTemplate"), { id })}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirmReset ? (
        <div className="rounded-md border border-danger/50 bg-surface p-3 text-sm">
          <p>{fillSe(tse("confirmResetTemplate"), { name: squad.squadName })}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={doReset} className="rounded border border-danger px-3 py-1 text-xs text-danger">
              {tse("confirmResetButton")}
            </button>
            <button type="button" onClick={() => setConfirmReset(false)} className="rounded border border-border px-3 py-1 text-xs">
              {tse("cancelActionButton")}
            </button>
          </div>
        </div>
      ) : null}

      {/* モバイルタブ */}
      <div className="flex gap-1 overflow-x-auto lg:hidden">
        {(
          [
            ["pitch", tse("mobileTabPitch")],
            ["bench", tse("mobileTabBench")],
            ["manager", tse("mobileTabManager")],
            ["summary", tse("mobileTabSummary")],
            ["linkup", tse("mobileTabLinkUp")],
          ] as [MobileTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs ${
              mobileTab === id ? "border-accent bg-accent/10 text-accent" : "border-border text-text-dim"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* 左: ピッチ */}
        <div className={`flex flex-col gap-3 ${mobileTab === "pitch" ? "" : "hidden"} lg:flex`}>
          {moveSource ? (
            <p
              aria-live="polite"
              className="rounded border border-accent bg-accent/10 px-2 py-1.5 text-xs text-accent"
            >
              {fillSe(tse("moveBannerTemplate"), { name: moveSourceName ?? tse("moveBannerFallbackName") })}
              <button type="button" onClick={() => setMoveSource(null)} className="ml-2 underline">
                {tse("moveBannerCancel")}
              </button>
            </p>
          ) : undo ? (
            <p className="flex items-center gap-2 rounded border border-border bg-surface-2/40 px-2 py-1 text-xs text-text-dim">
              {fillSe(tse("undoBannerTemplate"), { label: undo.label })}
              <button
                type="button"
                onClick={doUndo}
                className="rounded border border-border px-2 py-0.5 text-text hover:border-accent"
              >
                {tse("undoButton")}
              </button>
            </p>
          ) : null}

          {pendingAdd ? (
            <div className="rounded-md border border-accent/60 bg-accent-soft/40 px-3 py-2 text-xs">
              {pendingAddBuildInvalid ? (
                <div role="alert" className="flex flex-wrap items-center gap-2">
                  <span>{tse("pendingBuildNotFoundText")}</span>
                  <Link href="/my-team" className="rounded border border-border px-2 py-0.5 hover:border-accent">
                    {tse("pendingGoToMyTeamLink")}
                  </Link>
                  <button
                    type="button"
                    onClick={clearPendingAdd}
                    className="rounded border border-border px-2 py-0.5 hover:border-accent"
                  >
                    {tse("pendingCancelButton")}
                  </button>
                </div>
              ) : pendingAlreadyPlaced ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>{fillSe(tse("pendingAlreadyPlacedTemplate"), { name: pendingName })}</span>
                  <button
                    type="button"
                    onClick={clearPendingAdd}
                    className="rounded border border-border px-2 py-0.5 hover:border-accent"
                  >
                    {tse("pendingOkButton")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>{fillSe(tse("pendingChooseTargetTemplate"), { name: pendingName })}</span>
                  {pendingAddBuild ? (
                    <span className="text-text-dim">
                      {fillSe(tse("pendingBuildNameTemplate"), { buildName: pendingAddBuild.buildName })}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      addBench(pendingAdd, pendingAddBuildId);
                      clearPendingAdd();
                    }}
                    className="rounded border border-accent px-2 py-0.5 text-accent hover:bg-accent/10"
                  >
                    {tse("pendingAddToBenchButton")}
                  </button>
                  <button
                    type="button"
                    onClick={clearPendingAdd}
                    className="rounded border border-border px-2 py-0.5 hover:border-accent"
                  >
                    {tse("pendingCancelButton")}
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {/* 配置補助 */}
          <div className="flex flex-wrap items-center gap-1.5 text-2xs">
            <span className="font-semibold text-text-dim">{tse("placementAidLabel")}</span>
            <button
              type="button"
              aria-pressed={prefs.snapEnabled}
              onClick={() => updatePref({ snapEnabled: !prefs.snapEnabled })}
              className={`rounded border px-2 py-0.5 ${prefs.snapEnabled ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim"}`}
            >
              {fillSe(tse("snapToggleTemplate"), { state: prefs.snapEnabled ? "ON" : "OFF" })}
            </button>
            <button
              type="button"
              aria-pressed={prefs.showGuides}
              onClick={() => updatePref({ showGuides: !prefs.showGuides })}
              className={`rounded border px-2 py-0.5 ${prefs.showGuides ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim"}`}
            >
              {fillSe(tse("guidesToggleTemplate"), { state: prefs.showGuides ? "ON" : "OFF" })}
            </button>
            <button
              type="button"
              aria-pressed={prefs.showGrid}
              onClick={() => updatePref({ showGrid: !prefs.showGrid })}
              className={`rounded border px-2 py-0.5 ${prefs.showGrid ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim"}`}
            >
              {fillSe(tse("gridToggleTemplate"), { state: prefs.showGrid ? "ON" : "OFF" })}
            </button>
            <button
              type="button"
              onClick={() => setConfirmMirror(true)}
              className="rounded border border-border px-2 py-0.5 text-text-dim hover:border-accent"
            >
              {tse("mirrorPlacementButton")}
            </button>
            {hasCustomPositioningNow ? (
              <button
                type="button"
                onClick={() => setConfirmResetPos(true)}
                className="rounded border border-border px-2 py-0.5 text-text-dim hover:border-accent"
              >
                {tse("resetToFormationButton")}
              </button>
            ) : null}
          </div>

          <SquadPitch
            slots={computed.slots}
            selectedSlotId={selectedSlotId}
            onSlotClick={onSlotClick}
            moveActive={moveSource != null}
            moveSourceSlotId={moveSource?.area === "starter" ? moveSource.slotId : null}
            onSlotDragStart={(slotId) => beginMove({ area: "starter", slotId })}
            onSlotDrop={(slotId) =>
              moveSource ? applyMove(moveSource, { area: "starter", slotId }) : undefined
            }
            posAdjustSlotId={posAdjust}
            onFreeDrop={(x, y, o) => {
              if (posAdjust) applyFreePosition(posAdjust, x, y, { disableSnap: o?.disableSnap });
              else if (moveSource?.area === "starter")
                applyFreePosition(moveSource.slotId, x, y, { disableSnap: o?.disableSnap });
              setMoveSource(null);
            }}
            snapContext={{
              placements: starterPlacementRefs,
              settings: snapSettings,
              showGuides: prefs.showGuides,
              showGrid: prefs.showGrid,
            }}
          />
          <p className="text-center text-[10px] text-text-dim">
            {tse("pitchCaptionMain")}
            <span className="text-accent">●</span> {tse("pitchLegendMatch")}
            <span className="text-yellow-300">●</span> {tse("pitchLegendUnresolved")}
            <span className="text-danger">●</span> {tse("pitchLegendMismatch")}
          </p>
          {confirmMirror ? (
            <div className="rounded-md border border-border bg-surface p-3 text-xs">
              <p>{tse("confirmMirrorText")}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    doMirror();
                    setConfirmMirror(false);
                  }}
                  className="rounded border border-accent px-3 py-1 text-accent"
                >
                  {tse("confirmMirrorButton")}
                </button>
                <button type="button" onClick={() => setConfirmMirror(false)} className="rounded border border-border px-3 py-1">
                  {tse("cancelActionButton")}
                </button>
              </div>
            </div>
          ) : null}
          {confirmResetPos ? (
            <div className="rounded-md border border-border bg-surface p-3 text-xs">
              <p>{fillSe(tse("confirmResetPosTemplate"), { formationId: squad.formationId })}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetToFormationPositions();
                    setConfirmResetPos(false);
                  }}
                  className="rounded border border-accent px-3 py-1 text-accent"
                >
                  {tse("confirmResetPosButton")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetPos(false)}
                  className="rounded border border-border px-3 py-1"
                >
                  {tse("cancelActionButton")}
                </button>
              </div>
            </div>
          ) : null}
          {posAdjust ? (
            <p aria-live="polite" className="rounded border border-accent bg-accent/10 px-2 py-1.5 text-xs text-accent">
              {tse("posAdjustBanner")}
              <button type="button" onClick={() => setPosAdjust(null)} className="ml-2 underline">
                {tse("posAdjustEndButton")}
              </button>
            </p>
          ) : null}

          {pickTarget ? (
            (() => {
              const pos =
                pickTarget.kind === "slot"
                  ? computed.slots.find((s) => s.slotId === pickTarget.slotId)?.position ?? null
                  : null;
              return (
                <PlayerSearchPanel
                  title={
                    pickTarget.kind === "slot"
                      ? fillSe(tse("addPlayerToSlotTitleTemplate"), { position: pos ?? "" })
                      : tse("addPlayerToBenchTitle")
                  }
                  targetLabel={
                    pickTarget.kind === "slot"
                      ? fillSe(tse("addToSlotLabelTemplate"), { position: pos ?? tse("emptySlotHeadingSuffix") })
                      : tse("addToBenchLabel")
                  }
                  targetPosition={pos}
                  placedIds={allPlacedSet}
                  placedLabel={placedWhere}
                  onClose={() => setPickTarget(null)}
                  onPick={(id) => (pickTarget.kind === "slot" ? placeInSlot(pickTarget.slotId, id) : addBench(id))}
                />
              );
            })()
          ) : selectedStoredSlot?.worldCardId && !selectedSlot?.entry ? (
            <div className="rounded-md border border-border bg-surface p-3 text-sm">
              <h3 className="font-semibold">
                {selectedSlot?.position ?? ""} <span className="text-xs font-normal text-text-dim">{tse("emptySlotHeadingSuffix")}</span>
              </h3>
              {cards[selectedStoredSlot.worldCardId] === "error" ? (
                <div className="mt-2">
                  <p className="text-xs text-danger">
                    {fillSe(tse("slotCardFetchFailedTemplate"), { id: selectedStoredSlot.worldCardId })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => retryCard(selectedStoredSlot.worldCardId!)}
                      className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                    >
                      {tse("retryButton")}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromSlot(selectedStoredSlot.slotId)}
                      className="rounded border border-border px-2 py-1 text-xs text-danger hover:opacity-80"
                    >
                      {tse("removeFromSlotButton")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-dim">
                  {fillSe(tse("slotCardLoadingTemplate"), { id: selectedStoredSlot.worldCardId })}
                </p>
              )}
            </div>
          ) : selectedSlot ? (
            <SlotPlayerPanel
              slot={selectedSlot}
              savedBuilds={selectedSlot.entry ? savedBuildsByCard[selectedSlot.entry.display.worldCardId] ?? [] : []}
              savedBuildId={selectedStoredSlot?.savedBuildId ?? null}
              onOpenBuildPanel={() => {
                const wc = selectedSlot.entry?.display.worldCardId ?? selectedStoredSlot?.worldCardId ?? null;
                if (wc) setBuildPanelTarget({ area: "starter", slotId: selectedSlot.slotId, worldCardId: wc });
              }}
              inCompare={!!selectedSlot.entry && compareSel.includes(selectedSlot.entry.display.worldCardId)}
              compareFull={compareSel.length >= 4}
              moveArmed={moveSource?.area === "starter" && moveSource.slotId === selectedSlot.slotId}
              placement={placements[selectedSlot.slotId]}
              placementRoles={PLACEMENT_ROLES}
              posAdjustActive={posAdjust === selectedSlot.slotId}
              onStartPosAdjust={() =>
                setPosAdjust((p) => (p === selectedSlot.slotId ? null : selectedSlot.slotId))
              }
              onRoleOverride={(role) => setRoleOverride(selectedSlot.slotId, role)}
              onAddPlayer={() => setPickTarget({ kind: "slot", slotId: selectedSlot.slotId })}
              onRemove={() => removeFromSlot(selectedSlot.slotId)}
              onMoveToBench={() => moveSlotToBench(selectedSlot.slotId)}
              onBuildMode={(mode) =>
                patch((s) => ({ ...s, slots: s.slots.map((x) => (x.slotId === selectedSlot.slotId ? { ...x, buildMode: mode } : x)) }))
              }
              onSavedBuild={(buildId) =>
                patch((s) => ({
                  ...s,
                  slots: s.slots.map((x) => (x.slotId === selectedSlot.slotId ? { ...x, savedBuildId: buildId } : x)),
                }))
              }
              onToggleCaptain={() =>
                patch((s) => ({ ...s, captainSlotId: s.captainSlotId === selectedSlot.slotId ? null : selectedSlot.slotId }))
              }
              onStartMove={() => beginMove({ area: "starter", slotId: selectedSlot.slotId })}
              onCancelMove={() => setMoveSource(null)}
              onToggleCompare={() => selectedSlot.entry && toggleCompare(selectedSlot.entry.display.worldCardId)}
              onBoosters={(next) =>
                patch((s) => ({
                  ...s,
                  slots: s.slots.map((x) => (x.slotId === selectedSlot.slotId ? { ...x, boosters: next.length ? next : undefined } : x)),
                }))
              }
              onConditionalBoosters={(next) =>
                patch((s) => ({
                  ...s,
                  slots: s.slots.map((x) =>
                    x.slotId === selectedSlot.slotId ? { ...x, conditionalBoosters: next.length ? next : undefined } : x,
                  ),
                }))
              }
            />
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-text-dim">
              {tse("selectSlotHint")}
            </p>
          )}

          {/* 比較へ */}
          <div className="rounded-md border border-border bg-surface p-3 text-xs">
            <p className="font-semibold">{tse("compareHeading")}</p>
            <p className="mt-1 text-text-dim">
              {fillSe(tse("compareSelectedCountTemplate"), { count: String(compareSel.length) })}
              {compareSel.length > 0
                ? ` — ${compareSel
                    .map((id) => {
                      const e = computed.slots.find((s) => s.entry?.display.worldCardId === id)?.entry;
                      return resolvePlayerDisplayName(e?.display ?? {}, locale, id);
                    })
                    .join(", ")}`
                : tse("compareSelectedHint")}
            </p>
            <div className="mt-2 flex gap-2">
              <Link
                href={compareHref}
                aria-disabled={compareSel.length < 2}
                className={`rounded border px-3 py-1 ${
                  compareSel.length >= 2 ? "border-accent text-accent hover:bg-accent/10" : "pointer-events-none border-border text-text-dim"
                }`}
              >
                {tse("compareGoLink")}
              </Link>
              {compareSel.length > 0 ? (
                <button type="button" onClick={() => setCompareSel([])} className="rounded border border-border px-2 py-1 text-text-dim">
                  {tse("compareClearButton")}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* 右: パネル群 */}
        <div className="flex flex-col gap-3">
          <div className={`${mobileTab === "manager" ? "" : "hidden"} lg:block`}>
            <SquadManagerPanel
              manager={managerContext}
              detail={managerDetail}
              boostedCount={computed.teamSummary.managerBoostedCount}
              onSelect={(id, ctx, d) => {
                setManagerContext(ctx);
                setManagerDetail(d);
                patch((s) => ({ ...s, managerId: id }));
              }}
            />
          </div>
          <div className={`${mobileTab === "bench" ? "" : "hidden"} lg:block`}>
            <SquadBench
              rows={benchRows}
              onAdd={() => setPickTarget({ kind: "bench" })}
              onRemove={removeFromBench}
              onBuildMode={(index, mode) =>
                patch((s) => ({
                  ...s,
                  substitutes: s.substitutes.map((x, i) => (i === index ? { ...x, buildMode: mode } : x)),
                }))
              }
              onOpenBuildPanel={(index) => {
                const sub = squadRef.current?.substitutes[index];
                if (sub) setBuildPanelTarget({ area: "bench", subId: sub.subId, worldCardId: sub.worldCardId });
              }}
              onReorder={reorderBenchAt}
              onBenchClick={onBenchClick}
              onBenchEndTarget={() => {
                const cur = squadRef.current;
                if (cur && moveSource) applyMove(moveSource, { area: "bench", index: cur.substitutes.length });
              }}
              moveActive={moveSource != null}
              moveSourceIndex={moveSource?.area === "bench" ? moveSource.index : null}
              onDragStartSub={(index) => beginMove({ area: "bench", index })}
              onDropSub={(index) => (moveSource ? applyMove(moveSource, { area: "bench", index }) : undefined)}
              onDropEnd={() => {
                const cur = squadRef.current;
                if (cur && moveSource) applyMove(moveSource, { area: "bench", index: cur.substitutes.length });
              }}
            />
          </div>
          <div className={`${mobileTab === "summary" ? "" : "hidden"} lg:block`}>
            <TeamSummaryPanel
              summary={computed.teamSummary}
              conditionalSummary={computed.conditionalTeamSummary}
              hasAnyConditionalSelection={computed.hasAnyConditionalSelection}
            />
          </div>
          <div className={`${mobileTab === "summary" ? "" : "hidden"} lg:block`}>
            <SquadBuildUsagePanel
              rows={buildUsageRows}
              buildsByCard={savedBuildsByCard}
              onOpenBuildPanel={openBuildPanelFor}
            />
          </div>
          <div className={`${mobileTab === "summary" ? "" : "hidden"} lg:block`}>
            <div className="rounded-md border border-border bg-surface p-3 text-xs">
              <p className="mb-2 text-sm font-semibold">{tse("roleSettingsHeading")}</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-text-dim">{tse("captainLabel")}</span>
                  <select
                    value={squad.captainSlotId ?? ""}
                    onChange={(e) =>
                      patch((s) => ({ ...s, captainSlotId: e.target.value || null }))
                    }
                    aria-label={tse("captainLabel")}
                    className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-0.5"
                  >
                    <option value="">{tse("roleUnsetOption")}</option>
                    {starterOptions.map((o) => (
                      <option key={o.slotId} value={o.slotId}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    ["freeKicks", tse("freeKickLabel")],
                    ["corners", tse("cornerLabel")],
                    ["penalties", tse("penaltyLabel")],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-2">
                    <span className="text-text-dim">{label}</span>
                    <select
                      value={squad.setPieces?.[key] ?? ""}
                      onChange={(e) =>
                        patch((s) => ({
                          ...s,
                          setPieces: { ...s.setPieces, [key]: e.target.value || null },
                        }))
                      }
                      aria-label={label}
                      className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-0.5"
                    >
                      <option value="">{tse("roleUnsetOption")}</option>
                      {starterOptions.map((o) => (
                        <option key={o.slotId} value={o.slotId}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-text-muted">{tse("roleAutoClearNote")}</p>
            </div>
          </div>
          <div className={`${mobileTab === "linkup" ? "" : "hidden"} lg:block`}>
            <LinkUpPanel
              linkUps={computed.linkUps}
              notice={computed.linkUpNotice}
              slots={computed.slots}
              selection={squad.linkUp}
              hasManager={managerContext != null}
              onSelect={(next: StoredLinkUp) => patch((s) => ({ ...s, linkUp: next }))}
            />
          </div>
          {computed.warnings.length > 0 ? (
            <div className="rounded-md border border-border bg-surface p-3 text-xs">
              <p className="font-semibold">{fillSe(tse("warningsHeadingTemplate"), { count: String(computed.warnings.length) })}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-text-dim">
                {computed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* 下段: スカッド診断（編成エリア全体の下・PC/モバイル共通で常時表示・SquadDiagnosisPanelは1回だけレンダリング） */}
      <div className="mt-2">
        <SquadDiagnosisPanel
          result={diagnosis}
          squadName={squad?.squadName ?? ""}
          formationLabel={computed.formation.name}
          tacticalPlacements={tacticalPlacements}
        />
      </div>

      {buildPanelTarget
        ? (() => {
            const bpt = buildPanelTarget;
            const wc = bpt.worldCardId;
            const cardState = cards[wc];
            const display =
              cardState && cardState !== "loading" && cardState !== "error" ? cardState.display : null;
            let slotExists = false;
            let currentSlotWorldCardId: string | null = null;
            let currentSavedBuildId: string | null = null;
            let areaLabel = "";
            let slotLabel = "";
            if (bpt.area === "starter") {
              const sl = squad.slots.find((s) => s.slotId === bpt.slotId);
              slotExists = !!sl;
              currentSlotWorldCardId = sl?.worldCardId ?? null;
              currentSavedBuildId = sl?.savedBuildId ?? null;
              areaLabel = tse("starterFallbackLabel");
              slotLabel = computed.slots.find((s) => s.slotId === bpt.slotId)?.position ?? tse("starterSlotFallbackLabel");
            } else {
              const idx = squad.substitutes.findIndex((s) => s.subId === bpt.subId);
              const sub = idx >= 0 ? squad.substitutes[idx] : null;
              slotExists = !!sub;
              currentSlotWorldCardId = sub?.worldCardId ?? null;
              currentSavedBuildId = sub?.savedBuildId ?? null;
              areaLabel = tse("benchAreaFallbackLabel");
              slotLabel = idx >= 0 ? `${t("bench", "benchSlotLabel")} ${idx + 1}` : tse("benchAreaFallbackLabel");
            }
            return (
              <SquadBuildPanel
                squadId={squad.squadId}
                squadName={squad.squadName}
                areaLabel={areaLabel}
                slotLabel={slotLabel}
                worldCardId={wc}
                card={display}
                currentSavedBuildId={currentSavedBuildId}
                currentSlotWorldCardId={currentSlotWorldCardId}
                slotExists={slotExists}
                onSet={(buildId) => applySquadBuild(bpt, buildId)}
                onClear={() => applySquadBuild(bpt, null)}
                onRequestReload={reloadSquadFromStorage}
                onClose={() => setBuildPanelTarget(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

function SkeletonEditor({ computed }: { computed: ReturnType<typeof buildSquad> }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="flex flex-col gap-3">
          <SquadPitch slots={computed.slots} selectedSlotId={null} onSlotClick={() => {}} />
          <p className="text-center text-xs text-text-dim">{t("squadEditor", "skeletonLoading")}</p>
        </div>
        <div className="hidden flex-col gap-3 lg:flex">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <EmptyState icon="squad" variant="no-results" title={title} description={children} />
  );
}
