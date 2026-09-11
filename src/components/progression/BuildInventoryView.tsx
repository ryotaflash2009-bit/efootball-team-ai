"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SavedBuild } from "@/lib/progression/types";
import type { StoredSquad } from "@/lib/squad/types";
import type { WorldPlayerListItem, WorldPlayerDetail } from "@/lib/world/types";
import { toProgressionCard } from "@/lib/progression/from-world";
import type { AbilityCardInput } from "@/lib/progression/build-ability-impact";
import { isBuildStorageAvailable, listAllBuilds, saveBuildIntent, deleteBuildIntent } from "@/lib/progression/build-storage";
import {
  normalizeSavedBuildIntent,
  restoreBuildIntentFromSaved,
  isSavedIntentCurrent,
  type BuildIntentSource,
} from "@/lib/progression/build-intent-persistence";
import { BUILD_STORAGE_KEY } from "@/lib/progression/constants";
import { isSquadStorageAvailable, listSquads } from "@/lib/squad/squad-storage";
import { SQUAD_STORAGE_KEY } from "@/lib/squad/types";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { MY_TEAM_STORAGE_KEY } from "@/lib/user-cards/types";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import {
  BUILD_INVENTORY_SORT_KEYS,
  DEFAULT_BUILD_INVENTORY_FILTER,
  buildInventory,
  filterBuildInventory,
  filterBuildInventoryIssues,
  legacyOnlyFilter,
  resolveAnalyzingBuildId,
  sortBuildInventory,
  summarizeLegacyBuilds,
  type BuildInventoryFilter,
  type BuildInventorySortKey,
  type IssueFilterKind,
} from "@/lib/progression/build-inventory";
import {
  buildAllocationRows,
  buildPointSummary,
  describeBuildPoM,
  formatBuildTimestamp,
} from "@/lib/progression/my-builds";
import { buildDuplicateReview } from "@/lib/progression/build-duplicate-review";
import { DuplicateReviewSection } from "./DuplicateReviewSection";
import { analyzeSavedBuild, buildSiblingInputs, toBuildAnalysisCardInput } from "@/lib/progression/build-analysis";
import {
  analyzeBuildIntent,
  emptyBuildIntent,
  normalizeBuildIntent,
  resolveIntentOnCardChange,
  type BuildIntentInput,
  type IntentSiblingInput,
  type GroupPriorityState,
  type PrimaryGoalId,
} from "@/lib/progression/build-intent-analysis";
import {
  applyExtractionToIntent,
  validateBuildIntentExtraction,
  type BuildIntentExtraction,
  type BuildIntentExtractionError,
  type BuildIntentExtractionStatus,
  type BuildIntentClarificationPatch,
} from "@/lib/ai/build-intent-extractor";
import {
  getPresetById,
  presetDerivedGroupPriorities,
  composeDraftIntent,
  detectPresetConflicts,
  MAX_SUB_PRESETS,
  type PresetCategoryId,
} from "@/lib/progression/build-intent-presets";
import { PROGRESSION_GROUPS } from "@/lib/progression/stat-groups";
import { BuildAnalysisPanel, type PresetIntentStatus } from "./BuildAnalysisPanel";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { LocalStorageNotice } from "@/components/user-cards/LocalStorageNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { BuildInventoryItem, BuildInventoryIssue } from "@/lib/progression/build-inventory";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { PageHeader } from "@/components/ui/PageHeader";

/** groupPriorities/primaryGoal を除いた BuildIntentInput(プリセットが既定値を持たない、常に手動値のみのフィールド)。 */
function omitGoalAndPriorities(intent: BuildIntentInput): Omit<BuildIntentInput, "primaryGoal" | "groupPriorities"> {
  const { primaryGoal: _primaryGoal, groupPriorities: _groupPriorities, ...rest } = intent;
  return rest;
}

/** 2つの BuildIntentInput が実質的に同じ内容かどうか(キー順序の違いを無視して比較する)。 */
function buildIntentsEqual(a: BuildIntentInput, b: BuildIntentInput): boolean {
  if (a.primaryGoal !== b.primaryGoal) return false;
  if (a.comparisonTargetBuildId !== b.comparisonTargetBuildId) return false;
  if (a.freeText !== b.freeText) return false;
  const arraysEqual = (x: string[], y: string[]) => x.length === y.length && [...x].sort().join(",") === [...y].sort().join(",");
  if (!arraysEqual(a.intendedPositions, b.intendedPositions)) return false;
  if (!arraysEqual(a.avoidOverinvestmentGroups, b.avoidOverinvestmentGroups)) return false;
  if (!arraysEqual(a.intentionallyIgnoredGroups, b.intentionallyIgnoredGroups)) return false;
  if (!arraysEqual(a.comparisonFocusGroups, b.comparisonFocusGroups)) return false;
  if (!arraysEqual(a.strengthsToPreserve, b.strengthsToPreserve)) return false;
  const allGroupIds = new Set([...Object.keys(a.groupPriorities), ...Object.keys(b.groupPriorities)]);
  for (const g of allGroupIds) {
    if ((a.groupPriorities[g] ?? "normal") !== (b.groupPriorities[g] ?? "normal")) return false;
  }
  return true;
}

function useSortLabels(): Record<BuildInventorySortKey, string> {
  const t = useT();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  return {
    updated_desc: biv("sortUpdatedDesc"),
    updated_asc: biv("sortUpdatedAsc"),
    created_desc: biv("sortCreatedDesc"),
    player_asc: biv("sortPlayerAsc"),
    name_asc: biv("sortNameAsc"),
    refs_desc: biv("sortRefsDesc"),
    refs_asc: biv("sortRefsAsc"),
    problem_first: biv("sortProblemFirst"),
    unused_first: biv("sortUnusedFirst"),
  };
}

function useIssueKindLabels(): Record<Exclude<IssueFilterKind, "all">, string> {
  const t = useT();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  return {
    missing: biv("issueMissing"),
    "world-card-mismatch": biv("issueMismatch"),
    "invalid-build-id": biv("issueInvalidBuildId"),
    unknown: biv("issueUnknown"),
  };
}

export function BuildInventoryView() {
  const t = useT();
  const { locale } = useLocale();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  const fillBiv = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const SORT_LABEL = useSortLabels();
  const ISSUE_KIND_LABEL = useIssueKindLabels();
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [squads, setSquads] = useState<StoredSquad[]>([]);
  const [buildAvail, setBuildAvail] = useState(true);
  const [squadAvail, setSquadAvail] = useState(true);
  const [staleBuild, setStaleBuild] = useState(false);
  const [staleMyTeam, setStaleMyTeam] = useState(false);
  const [staleSquad, setStaleSquad] = useState(false);
  const [filter, setFilter] = useState<BuildInventoryFilter>(DEFAULT_BUILD_INVENTORY_FILTER);
  const [sort, setSort] = useState<BuildInventorySortKey>("updated_desc");
  const [issueKind, setIssueKind] = useState<IssueFilterKind>("all");
  const [issueQuery, setIssueQuery] = useState("");

  const { myTeam, available: myTeamAvail } = useMyTeam();

  const reload = useCallback(() => {
    setBuildAvail(isBuildStorageAvailable());
    setSquadAvail(isSquadStorageAvailable());
    setBuilds(listAllBuilds());
    setSquads(listSquads());
    setStaleBuild(false);
    setStaleMyTeam(false);
    setStaleSquad(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 別タブ更新（3 キーのみ監視・自動リロード/自動差し替えはしない）
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key == null || e.key === BUILD_STORAGE_KEY) setStaleBuild(true);
      if (e.key == null || e.key === MY_TEAM_STORAGE_KEY) setStaleMyTeam(true);
      if (e.key == null || e.key === SQUAD_STORAGE_KEY) setStaleSquad(true);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const cardIds = useMemo(() => {
    const s = new Set<string>();
    for (const b of builds) s.add(b.worldCardId);
    for (const r of myTeam) s.add(r.worldCardId);
    for (const sq of squads) {
      for (const sl of sq.slots) if (sl.worldCardId) s.add(sl.worldCardId);
      for (const sub of sq.substitutes) if (sub.worldCardId) s.add(sub.worldCardId);
    }
    return [...s];
  }, [builds, myTeam, squads]);
  const { cards, loading: cardsLoading, error: cardsError } = useResolvedCards(cardIds);

  const inv = useMemo(() => buildInventory(builds, myTeam, squads, cards), [builds, myTeam, squads, cards]);
  const visibleItems = useMemo(
    () => sortBuildInventory(filterBuildInventory(inv.items, filter), sort),
    [inv.items, filter, sort],
  );
  const visibleIssues = useMemo(
    () => filterBuildInventoryIssues(inv.issues, issueKind, issueQuery),
    [inv.issues, issueKind, issueQuery],
  );
  const legacy = useMemo(() => summarizeLegacyBuilds(inv.items), [inv.items]);
  const dup = useMemo(() => buildDuplicateReview(inv), [inv]);
  const usedBuildIds = useMemo(() => new Set(inv.items.filter((i) => i.used).map((i) => i.build.buildId)), [inv.items]);
  const [analyzingBuildId, setAnalyzingBuildId] = useState<string | null>(null);
  // 現在の検索・フィルター結果（visibleItems）に含まれるものだけを分析対象にする。
  const analyzingItem = useMemo(
    () => visibleItems.find((i) => i.build.buildId === analyzingBuildId) ?? null,
    [visibleItems, analyzingBuildId],
  );
  // 検索・フィルターで分析中のビルドが一覧から外れたら、見えないまま保持せずパネルを閉じる。
  useEffect(() => {
    setAnalyzingBuildId((cur) => resolveAnalyzingBuildId(cur, visibleItems));
  }, [visibleItems]);
  const analysisPanelId = analyzingItem ? `build-analysis-${analyzingItem.build.buildId}` : null;

  // 能力値分析用のカード（育成前26能力値）をオンデマンド取得する（squad editor の resolveCard と同じ方式）。
  // undefined = 未取得（分析パネルは能力値なしで先に表示） / null = 取得を試みたが確認できなかった / オブジェクト = 取得済み。
  const [abilityCards, setAbilityCards] = useState<Record<string, AbilityCardInput | null>>({});
  const abilityRequestedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const worldCardId = analyzingItem?.build.worldCardId;
    if (!worldCardId) return;
    if (abilityRequestedRef.current.has(worldCardId)) return;
    abilityRequestedRef.current.add(worldCardId);
    fetch(`/api/world/players/${encodeURIComponent(worldCardId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { player: WorldPlayerDetail }) => {
        const c = toProgressionCard(data.player);
        setAbilityCards((m) => ({
          ...m,
          [worldCardId]: { worldCardId: c.worldCardId, baseStats: c.baseStats, maximumLevel: c.maximumLevel, registeredPosition: c.registeredPosition },
        }));
      })
      .catch(() => {
        abilityRequestedRef.current.delete(worldCardId);
        setAbilityCards((m) => ({ ...m, [worldCardId]: null }));
      });
  }, [analyzingItem?.build.worldCardId]);

  // 分析エンジンは、現在選択中の1件についてのみ、ここで1回だけ実行する。
  const analysis = useMemo(() => {
    if (!analyzingItem) return null;
    const siblings = buildSiblingInputs(builds, analyzingItem.build.buildId, analyzingItem.build.worldCardId, usedBuildIds);
    return analyzeSavedBuild({
      build: analyzingItem.build,
      card: toBuildAnalysisCardInput(analyzingItem.card),
      ruleKind: analyzingItem.ruleKind,
      hasReferenceAnomaly: analyzingItem.mismatchRefCount > 0,
      isUsed: analyzingItem.used,
      siblings,
      abilityCard: abilityCards[analyzingItem.build.worldCardId],
    });
  }, [analyzingItem, builds, usedBuildIds, abilityCards]);
  const analyzingName = analyzingItem
    ? resolvePlayerDisplayName(analyzingItem.card ?? {}, locale, t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", analyzingItem.build.worldCardId))
    : "";

  // 分析目的(試験的機能): 保存しない・画面遷移で消える。同一カードの別ビルドへの切り替えでは引き継ぎ、
  // 別カードへ切り替えた場合はリセットする(目的の誤適用を避けるため)。パネルを閉じただけでは変更しない。
  // 確定済み(analyzeBuildIntent へ渡す実際の入力)は常にこの intent が正本。標準UIでは目的プリセット
  // 方式(下記 draftMainPresetId 等)で構築するが、詳細設定のみを使う手動運用も引き続き可能。
  const [intent, setIntent] = useState<BuildIntentInput>(emptyBuildIntent());

  // ------------------------------------------------------------------------
  // 育成目的プリセット方式(標準UIのメイン導線)。保存しない・別カードへ切り替えたらリセットする。
  // 「選択中(draft)」と「確定済み(confirmedMainPresetId/confirmedSubPresetIds + intent)」を分離し、
  // 選択しただけでは通常/辛口評価へ反映しない([presetIntent仕様] セクション16/18)。
  // ------------------------------------------------------------------------
  const [draftMainPresetId, setDraftMainPresetId] = useState<string | null>(null);
  const [draftSubPresetIds, setDraftSubPresetIds] = useState<string[]>([]);
  // ユーザーが詳細設定で明示的に変更した groupId だけを保持する(値は "normal" も含む=明示的な解除)。
  // プリセット既定値そのものはここに含めない(プリセット変更時に正しく再計算するため)。
  const [manualGroupOverrides, setManualGroupOverrides] = useState<Partial<Record<string, GroupPriorityState>>>({});
  const [manualPrimaryGoalOverride, setManualPrimaryGoalOverride] = useState<PrimaryGoalId | null>(null);
  // プリセットが既定値を持たないフィールド(ポジション・比較対象・維持したい長所等)は常に手動値のみ。
  const [draftManualFields, setDraftManualFields] = useState<Omit<BuildIntentInput, "primaryGoal" | "groupPriorities">>(() => omitGoalAndPriorities(emptyBuildIntent()));
  const [confirmedMainPresetId, setConfirmedMainPresetId] = useState<string | null>(null);
  const [confirmedSubPresetIds, setConfirmedSubPresetIds] = useState<string[]>([]);
  const [presetSearchQuery, setPresetSearchQuery] = useState("");
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<PresetCategoryId | "all">("all");
  // 「手動設定を使用」で解決した競合は、選択・詳細設定が変わるまで再表示しない(検出するだけで自動解消はしない)。
  const [suppressedConflictGroups, setSuppressedConflictGroups] = useState<Set<string>>(new Set());
  // 同一カードの別ビルドへ切り替え、確定済み目的を引き継いだ直後だけ案内を表示する。
  const [justCarriedOverFromSiblingBuild, setJustCarriedOverFromSiblingBuild] = useState(false);

  // ------------------------------------------------------------------------
  // 確定済み育成目的の永続保存(保存ビルドへの明示保存・復元)。
  // 保存対象はBuildIntent(構造化データ)のみ。診断結果・PNG・表示文章・自由記述は保存しない。
  // ------------------------------------------------------------------------
  const [intentSaveStatus, setIntentSaveStatus] = useState<"idle" | "saving" | "success" | "failed">("idle");
  const [intentDeleteStatus, setIntentDeleteStatus] = useState<"idle" | "confirming" | "deleting" | "failed">("idle");
  const [restoredIntentNotice, setRestoredIntentNotice] = useState<{ presetUnresolved: boolean; comparisonTargetInvalidated: boolean } | null>(null);
  const intentSavingRef = useRef(false);
  const intentSaveResetTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (intentSaveResetTimerRef.current != null) window.clearTimeout(intentSaveResetTimerRef.current);
    };
  }, []);

  const draftIntent = useMemo(
    () => composeDraftIntent(draftMainPresetId, draftSubPresetIds, manualGroupOverrides, manualPrimaryGoalOverride, draftManualFields),
    [draftMainPresetId, draftSubPresetIds, manualGroupOverrides, manualPrimaryGoalOverride, draftManualFields],
  );
  const presetConflicts = useMemo(
    () => detectPresetConflicts(draftMainPresetId, draftSubPresetIds, draftIntent).filter((c) => !suppressedConflictGroups.has(c.groupId)),
    [draftMainPresetId, draftSubPresetIds, draftIntent, suppressedConflictGroups],
  );
  const presetUserModified = useMemo(() => {
    const derived = presetDerivedGroupPriorities(confirmedMainPresetId, confirmedSubPresetIds);
    const mainPreset = getPresetById(confirmedMainPresetId);
    if (intent.primaryGoal !== (mainPreset?.primaryGoal ?? "unspecified")) return true;
    return PROGRESSION_GROUPS.some((g) => (intent.groupPriorities[g.groupId] ?? "normal") !== (derived[g.groupId] ?? "normal"));
  }, [confirmedMainPresetId, confirmedSubPresetIds, intent]);
  const presetStatus = useMemo<PresetIntentStatus>(() => {
    if (presetConflicts.length > 0) return "conflicted";
    const mainOrSubChanged = draftMainPresetId !== confirmedMainPresetId || [...draftSubPresetIds].sort().join(",") !== [...confirmedSubPresetIds].sort().join(",");
    const hasConfirmed = confirmedMainPresetId != null || confirmedSubPresetIds.length > 0 || intent.primaryGoal !== "unspecified" || Object.keys(intent.groupPriorities).length > 0;
    if (hasConfirmed) return !mainOrSubChanged && buildIntentsEqual(draftIntent, intent) ? "confirmed" : "modified";
    return draftMainPresetId != null || draftSubPresetIds.length > 0 ? "draft" : "unselected";
  }, [presetConflicts.length, draftMainPresetId, draftSubPresetIds, draftIntent, confirmedMainPresetId, confirmedSubPresetIds, intent]);

  const onSelectMainPreset = useCallback((id: string) => {
    setDraftMainPresetId((cur) => (cur === id ? null : id));
    setDraftSubPresetIds((cur) => cur.filter((s) => s !== id));
    setSuppressedConflictGroups(new Set());
    setJustCarriedOverFromSiblingBuild(false);
  }, []);
  const onToggleSubPreset = useCallback(
    (id: string) => {
      setDraftSubPresetIds((cur) => {
        if (cur.includes(id)) return cur.filter((s) => s !== id);
        if (id === draftMainPresetId || cur.length >= MAX_SUB_PRESETS) return cur;
        return [...cur, id];
      });
      setSuppressedConflictGroups(new Set());
      setJustCarriedOverFromSiblingBuild(false);
    },
    [draftMainPresetId],
  );
  const onDraftIntentChange = useCallback(
    (next: BuildIntentInput) => {
      const mainPreset = getPresetById(draftMainPresetId);
      const presetGoal = mainPreset?.primaryGoal ?? "unspecified";
      setManualPrimaryGoalOverride(next.primaryGoal === presetGoal ? null : next.primaryGoal);
      const derived = presetDerivedGroupPriorities(draftMainPresetId, draftSubPresetIds);
      const overrides: Partial<Record<string, GroupPriorityState>> = {};
      for (const g of PROGRESSION_GROUPS) {
        const nextState = next.groupPriorities[g.groupId] ?? "normal";
        const derivedState = derived[g.groupId] ?? "normal";
        if (nextState !== derivedState) overrides[g.groupId] = nextState;
      }
      setManualGroupOverrides(overrides);
      setDraftManualFields(omitGoalAndPriorities(next));
      setSuppressedConflictGroups(new Set());
      setJustCarriedOverFromSiblingBuild(false);
    },
    [draftMainPresetId, draftSubPresetIds],
  );
  const onResetPresetDefaults = useCallback(() => {
    setManualGroupOverrides({});
    setManualPrimaryGoalOverride(null);
    setSuppressedConflictGroups(new Set());
  }, []);
  const onDiscardManualEdits = useCallback(() => {
    setManualGroupOverrides({});
    setManualPrimaryGoalOverride(null);
    setDraftManualFields(omitGoalAndPriorities(emptyBuildIntent()));
    setSuppressedConflictGroups(new Set());
  }, []);
  const onResolveConflictUsePreset = useCallback((groupId: string) => {
    setManualGroupOverrides((cur) => {
      const next = { ...cur };
      delete next[groupId];
      return next;
    });
    setDraftManualFields((cur) => ({ ...cur, intentionallyIgnoredGroups: cur.intentionallyIgnoredGroups.filter((g) => g !== groupId) }));
  }, []);
  const onResolveConflictUseManual = useCallback((groupId: string) => {
    setSuppressedConflictGroups((cur) => new Set([...cur, groupId]));
  }, []);
  const onConfirmPresetIntent = useCallback(() => {
    if (presetConflicts.length > 0) return;
    setIntent(draftIntent);
    setConfirmedMainPresetId(draftMainPresetId);
    setConfirmedSubPresetIds(draftSubPresetIds);
    setSuppressedConflictGroups(new Set());
    setJustCarriedOverFromSiblingBuild(false);
  }, [presetConflicts.length, draftIntent, draftMainPresetId, draftSubPresetIds]);
  /** 現在の確定済み目的(confirmedMainPresetId/confirmedSubPresetIds + intent)から、ドラフトを再構成する。 */
  const syncDraftFromConfirmed = useCallback((confMain: string | null, confSub: string[], confIntent: BuildIntentInput) => {
    setDraftMainPresetId(confMain);
    setDraftSubPresetIds(confSub);
    const derived = presetDerivedGroupPriorities(confMain, confSub);
    const overrides: Partial<Record<string, GroupPriorityState>> = {};
    for (const g of PROGRESSION_GROUPS) {
      const cur = confIntent.groupPriorities[g.groupId] ?? "normal";
      const der = derived[g.groupId] ?? "normal";
      if (cur !== der) overrides[g.groupId] = cur;
    }
    setManualGroupOverrides(overrides);
    const mainPreset = getPresetById(confMain);
    setManualPrimaryGoalOverride(confIntent.primaryGoal !== (mainPreset?.primaryGoal ?? "unspecified") ? confIntent.primaryGoal : null);
    setDraftManualFields(omitGoalAndPriorities(confIntent));
  }, []);
  const onRevertToConfirmedPreset = useCallback(() => {
    syncDraftFromConfirmed(confirmedMainPresetId, confirmedSubPresetIds, intent);
    setSuppressedConflictGroups(new Set());
  }, [syncDraftFromConfirmed, confirmedMainPresetId, confirmedSubPresetIds, intent]);
  const onReturnToGeneralAnalysis = useCallback(() => {
    setIntent(emptyBuildIntent());
    setConfirmedMainPresetId(null);
    setConfirmedSubPresetIds([]);
    setDraftMainPresetId(null);
    setDraftSubPresetIds([]);
    setManualGroupOverrides({});
    setManualPrimaryGoalOverride(null);
    setDraftManualFields(omitGoalAndPriorities(emptyBuildIntent()));
    setSuppressedConflictGroups(new Set());
    setJustCarriedOverFromSiblingBuild(false);
  }, []);

  // 別カードへ切り替え: プリセット選択・確定済み目的・詳細設定を完全にリセットする(誤適用を避けるため)。
  // 同一カードの別ビルドへ切り替え: 確定済み目的を引き継ぎ、ドラフトを確定済みへ同期する(intent 自体は
  // 既存の resolveIntentOnCardChange により据え置かれる=別ロジックで引き継がれている)。
  const prevPresetSyncWorldCardIdRef = useRef<string | null>(null);
  const prevPresetSyncBuildIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextWorldCardId = analyzingItem?.build.worldCardId ?? null;
    const nextBuildId = analyzingBuildId;
    const prevWorldCardId = prevPresetSyncWorldCardIdRef.current;
    const prevBuildId = prevPresetSyncBuildIdRef.current;
    if (nextBuildId !== prevBuildId) {
      if (nextWorldCardId !== prevWorldCardId) {
        setDraftMainPresetId(null);
        setDraftSubPresetIds([]);
        setManualGroupOverrides({});
        setManualPrimaryGoalOverride(null);
        setDraftManualFields(omitGoalAndPriorities(emptyBuildIntent()));
        setConfirmedMainPresetId(null);
        setConfirmedSubPresetIds([]);
        setSuppressedConflictGroups(new Set());
        setJustCarriedOverFromSiblingBuild(false);
      } else if (prevBuildId != null) {
        syncDraftFromConfirmed(confirmedMainPresetId, confirmedSubPresetIds, intent);
        setJustCarriedOverFromSiblingBuild(confirmedMainPresetId != null || confirmedSubPresetIds.length > 0);
      }
    }
    prevPresetSyncWorldCardIdRef.current = nextWorldCardId;
    prevPresetSyncBuildIdRef.current = nextBuildId;
  }, [analyzingBuildId, analyzingItem?.build.worldCardId, confirmedMainPresetId, confirmedSubPresetIds, intent, syncDraftFromConfirmed]);

  // 「育成の狙い」のAI解析ライフサイクル(試験的機能・標準UIからは非表示。将来の自然言語入力再導入のため保持)。
  const [extractionStatus, setExtractionStatus] = useState<BuildIntentExtractionStatus>("not-analyzed");
  const [pendingExtraction, setPendingExtraction] = useState<BuildIntentExtraction | null>(null);
  const [extractionError, setExtractionError] = useState<BuildIntentExtractionError | null>(null);
  // 候補確認(clarifications)の選択状態: clarificationId → 選択済みoptionId。保存しない・確認前のみ保持する。
  // 未選択の候補は onConfirmExtraction で一切適用しない(選択肢のうち選ばれたものだけを反映する)。
  const [clarificationSelections, setClarificationSelections] = useState<Record<string, string>>({});
  // 確認済みAI抽出結果を、確認後に手動修正したか(true の間は「AIの解釈をユーザーが修正」と表示する)。
  const [userModifiedAfterConfirm, setUserModifiedAfterConfirm] = useState(false);
  const extractionAbortRef = useRef<AbortController | null>(null);
  const extractionRequestIdRef = useRef(0);
  // pendingExtraction の根拠となった自由文(確認前の解析結果が古くなっていないかの判定に使う)。
  const analyzedFreeTextRef = useRef<string | null>(null);
  // 確定済み構造化意図の根拠となった自由文(確定後に自由文が変わっていないかの判定に使う)。
  const confirmedFreeTextRef = useRef<string | null>(null);
  // "analyzing" へ遷移する直前の状態("manual" だった場合、キャンセル/破棄後に manual へ戻すために使う)。
  const preAnalysisStatusRef = useRef<BuildIntentExtractionStatus>("not-analyzed");
  const analyzingBuildIdLiveRef = useRef<string | null>(null);
  useEffect(() => {
    analyzingBuildIdLiveRef.current = analyzingBuildId;
  }, [analyzingBuildId]);

  /**
   * 解析中の状態を安全に手放した後、どの状態へ戻すべきかを一意に決定する。
   * - 既に確定済み構造化意図がある場合: 自由文が一致していれば confirmed、変わっていれば stale。
   * - 確定済み構造化意図がなく、解析開始前が手動設定(manual)だった場合: manual を維持する。
   * - どちらでもなければ not-analyzed。
   */
  const computeFallbackStatus = useCallback(
    (freeText: string): BuildIntentExtractionStatus => {
      if (confirmedFreeTextRef.current != null) return confirmedFreeTextRef.current === freeText ? "confirmed" : "stale";
      return preAnalysisStatusRef.current === "manual" ? "manual" : "not-analyzed";
    },
    [],
  );

  const resetExtractionState = useCallback(() => {
    extractionAbortRef.current?.abort();
    extractionAbortRef.current = null;
    extractionRequestIdRef.current += 1;
    analyzedFreeTextRef.current = null;
    confirmedFreeTextRef.current = null;
    preAnalysisStatusRef.current = "not-analyzed";
    setPendingExtraction(null);
    setExtractionError(null);
    setExtractionStatus("not-analyzed");
    setUserModifiedAfterConfirm(false);
    setClarificationSelections({});
  }, []);

  const prevAnalyzingWorldCardIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextWorldCardId = analyzingItem?.build.worldCardId ?? null;
    // 直後に ref を更新するため、setIntent の更新関数（React が後で・StrictMode では複数回呼ぶ）が
    // 常に同じ結果になるよう、比較対象の前回値をここでスナップショットしてから渡す（ref のライブ読み取りにしない）。
    const previousWorldCardId = prevAnalyzingWorldCardIdRef.current;
    setIntent((cur) => resolveIntentOnCardChange(cur, previousWorldCardId, nextWorldCardId));
    // 別カードへ切り替えた場合のみ、AI解析の状態も完全にリセットする(誤適用を避けるため)。
    if (previousWorldCardId !== nextWorldCardId) resetExtractionState();
    if (nextWorldCardId != null) prevAnalyzingWorldCardIdRef.current = nextWorldCardId;
  }, [analyzingItem?.build.worldCardId, resetExtractionState]);

  // 同一worldCardIdの他の保存ビルドのbuildId集合(自分自身は含まない)。比較対象の保存時/復元時の実在確認に使う。
  const siblingBuildIds = useMemo(() => {
    const worldCardId = analyzingItem?.build.worldCardId;
    const selfId = analyzingItem?.build.buildId;
    if (!worldCardId) return new Set<string>();
    return new Set(builds.filter((b) => b.worldCardId === worldCardId && b.buildId !== selfId).map((b) => b.buildId));
  }, [builds, analyzingItem?.build.worldCardId, analyzingItem?.build.buildId]);

  // 保存済み育成目的の復元: 対象ビルドが切り替わり、かつ保存済みbuildIntentがあれば、
  // 上記の(同一カード引き継ぎ/別カードリセット)効果を上書きして復元する。読み取りと再計算のみ行い、
  // 復元しただけでは保存データを書き戻さない。保存済みbuildIntentが無ければ、既存の引き継ぎ/リセットのまま。
  const prevRestoredBuildIdRef = useRef<string | null>(null);
  useEffect(() => {
    const buildId = analyzingItem?.build.buildId ?? null;
    if (buildId === prevRestoredBuildIdRef.current) return;
    prevRestoredBuildIdRef.current = buildId;
    setIntentSaveStatus("idle");
    setIntentDeleteStatus("idle");
    setRestoredIntentNotice(null);
    if (!buildId) return;
    const saved = analyzingItem?.build.buildIntent;
    if (!saved) return;
    const restored = restoreBuildIntentFromSaved(saved, buildId, siblingBuildIds);
    setIntent(restored.intent);
    setConfirmedMainPresetId(restored.mainPresetId);
    setConfirmedSubPresetIds(restored.subPresetIds);
    syncDraftFromConfirmed(restored.mainPresetId, restored.subPresetIds, restored.intent);
    setSuppressedConflictGroups(new Set());
    setJustCarriedOverFromSiblingBuild(false);
    if (restored.presetUnresolved || restored.comparisonTargetInvalidated) {
      setRestoredIntentNotice({ presetUnresolved: restored.presetUnresolved, comparisonTargetInvalidated: restored.comparisonTargetInvalidated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzingItem?.build.buildId, analyzingItem?.build.buildIntent, siblingBuildIds, syncDraftFromConfirmed]);

  /** 現在の確定済み設定(source/userModified含む)。保存・差分判定・更新の正本。 */
  const currentIntentSource: BuildIntentSource = confirmedMainPresetId != null || confirmedSubPresetIds.length > 0 ? "preset" : "manual";
  const currentIntentForSave = {
    intent,
    mainPresetId: confirmedMainPresetId,
    subPresetIds: confirmedSubPresetIds,
    source: currentIntentSource,
    userModified: presetUserModified,
  };
  const hasConfirmedIntent = confirmedMainPresetId != null || confirmedSubPresetIds.length > 0 || intent.primaryGoal !== "unspecified" || Object.keys(intent.groupPriorities).length > 0;
  const savedBuildIntentForCurrent = analyzingItem?.build.buildIntent ?? null;
  const savedIntentMatchesCurrent = savedBuildIntentForCurrent != null && hasConfirmedIntent ? isSavedIntentCurrent(savedBuildIntentForCurrent, currentIntentForSave) : false;
  /** 未確定の変更がある間(draft ≠ confirmed)は保存/画像保存いずれも不可にする(既存PNG機能と同じ方針)。 */
  const hasPendingIntentChanges = presetStatus === "modified" || presetStatus === "conflicted";

  const onSaveBuildIntent = useCallback(() => {
    if (intentSavingRef.current) return;
    if (!analyzingItem || hasPendingIntentChanges || !hasConfirmedIntent) return;
    intentSavingRef.current = true;
    setIntentSaveStatus("saving");
    try {
      const normalized = normalizeSavedBuildIntent({
        intent,
        mainPresetId: confirmedMainPresetId,
        subPresetIds: confirmedSubPresetIds,
        source: currentIntentSource,
        userModified: presetUserModified,
        currentBuildId: analyzingItem.build.buildId,
        siblingBuildIds,
        now: new Date().toISOString(),
      });
      const result = saveBuildIntent(analyzingItem.build.worldCardId, analyzingItem.build.buildId, normalized);
      if (result.ok) {
        reload();
        setIntentSaveStatus("success");
      } else {
        setIntentSaveStatus("failed");
      }
    } catch {
      setIntentSaveStatus("failed");
    } finally {
      intentSavingRef.current = false;
      if (intentSaveResetTimerRef.current != null) window.clearTimeout(intentSaveResetTimerRef.current);
      intentSaveResetTimerRef.current = window.setTimeout(() => setIntentSaveStatus("idle"), 3000);
    }
  }, [analyzingItem, hasPendingIntentChanges, hasConfirmedIntent, intent, confirmedMainPresetId, confirmedSubPresetIds, currentIntentSource, presetUserModified, siblingBuildIds, reload]);

  const onRequestDeleteBuildIntent = useCallback(() => setIntentDeleteStatus("confirming"), []);
  const onCancelDeleteBuildIntent = useCallback(() => setIntentDeleteStatus("idle"), []);
  const onConfirmDeleteBuildIntent = useCallback(() => {
    if (!analyzingItem) return;
    setIntentDeleteStatus("deleting");
    const result = deleteBuildIntent(analyzingItem.build.worldCardId, analyzingItem.build.buildId);
    if (result.ok) {
      reload();
      onReturnToGeneralAnalysis();
      setIntentDeleteStatus("idle");
    } else {
      setIntentDeleteStatus("failed");
    }
  }, [analyzingItem, reload, onReturnToGeneralAnalysis]);

  const onRevertToSavedBuildIntent = useCallback(() => {
    if (!analyzingItem?.build.buildIntent) return;
    const restored = restoreBuildIntentFromSaved(analyzingItem.build.buildIntent, analyzingItem.build.buildId, siblingBuildIds);
    setIntent(restored.intent);
    setConfirmedMainPresetId(restored.mainPresetId);
    setConfirmedSubPresetIds(restored.subPresetIds);
    syncDraftFromConfirmed(restored.mainPresetId, restored.subPresetIds, restored.intent);
    setSuppressedConflictGroups(new Set());
    setJustCarriedOverFromSiblingBuild(false);
  }, [analyzingItem, siblingBuildIds, syncDraftFromConfirmed]);

  // 同一カードの別ビルドへ切り替えた場合: 確定済み/確認待ちの状態は引き継ぐが(反映状況欄で可視化される)、
  // 解析中の通信中リクエストだけは、切り替え後のビルドへ誤って適用しないよう中断する。
  const prevAnalyzingBuildIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevAnalyzingBuildIdRef.current;
    if (prevId !== analyzingBuildId && extractionAbortRef.current) {
      extractionAbortRef.current.abort();
      extractionAbortRef.current = null;
      extractionRequestIdRef.current += 1;
      setExtractionStatus(computeFallbackStatus(intent.freeText));
      setPendingExtraction(null);
      setClarificationSelections({});
    }
    prevAnalyzingBuildIdRef.current = analyzingBuildId;
  }, [analyzingBuildId, intent.freeText, computeFallbackStatus]);

  // 自由文が、確認待ち/確定済みの解析結果の根拠となった内容から変わったら「古い」状態にする
  // (古い解析結果を新しい自由文へ黙って適用しない)。
  useEffect(() => {
    if (extractionStatus === "awaiting-confirmation" && analyzedFreeTextRef.current !== null && intent.freeText !== analyzedFreeTextRef.current) {
      setExtractionStatus("stale");
      setPendingExtraction(null);
      setClarificationSelections({});
    } else if (extractionStatus === "confirmed" && confirmedFreeTextRef.current !== null && intent.freeText !== confirmedFreeTextRef.current) {
      setExtractionStatus("stale");
    }
  }, [intent.freeText, extractionStatus]);

  const intentSiblings = useMemo<IntentSiblingInput[]>(() => {
    if (!analyzingItem || !analysis) return [];
    const siblings = buildSiblingInputs(builds, analyzingItem.build.buildId, analyzingItem.build.worldCardId, usedBuildIds);
    return siblings.map((s) => {
      const abilityDiff = analysis.abilityImpact.comparisonDifferences.find((d) => d.otherBuildId === s.buildId);
      const summary = analysis.comparisonSummary.find((c) => c.otherBuildId === s.buildId);
      return {
        buildId: s.buildId,
        buildName: s.buildName,
        calculatedStats: s.calculatedStats ?? {},
        conditionDifference: abilityDiff?.conditionDifference ?? null,
        usedPointsDiff: summary?.usedPointsDiff ?? null,
        calculatedOvrDiff: summary?.calculatedOvrDiff ?? null,
        topAbilityDifferences: abilityDiff?.topDifferences.map((d) => ({ abilityId: d.abilityId, diff: d.diff })) ?? [],
      };
    });
  }, [analyzingItem, analysis, builds, usedBuildIds]);

  const availableComparisonBuilds = useMemo(
    () => intentSiblings.map((s) => ({ buildId: s.buildId, buildName: s.buildName })),
    [intentSiblings],
  );

  const onRequestExtraction = useCallback(() => {
    const freeText = intent.freeText.trim();
    if (!freeText || extractionStatus === "analyzing") return;
    extractionAbortRef.current?.abort();
    const controller = new AbortController();
    extractionAbortRef.current = controller;
    const myRequestId = ++extractionRequestIdRef.current;
    const buildIdAtRequest = analyzingBuildId;
    const comparisonBuildsAtRequest = availableComparisonBuilds;
    const positionsAtRequest = inv.positions;
    preAnalysisStatusRef.current = extractionStatus;
    setPendingExtraction(null);
    setExtractionError(null);
    setExtractionStatus("analyzing");
    setClarificationSelections({});
    fetch("/api/build-intent/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freeText: intent.freeText,
        locale,
        availablePositions: positionsAtRequest,
        availableComparisonBuilds: comparisonBuildsAtRequest,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data: { extraction?: unknown; error?: BuildIntentExtractionError } | null = await res.json().catch(() => null);
        if (extractionRequestIdRef.current !== myRequestId) return;
        if (buildIdAtRequest !== analyzingBuildIdLiveRef.current) return;
        if (!res.ok || !data?.extraction) {
          const error: BuildIntentExtractionError = data?.error ?? { code: "UNKNOWN", message: "Unknown error" };
          setExtractionError(error);
          // 既に手動設定/確定済み構造化意図がある場合は、そちらの状態(source)を失わない
          // (AI試行の失敗表示は extractionError 側で別途行い、分析の実際の情報源は変えない)。
          const fallback = computeFallbackStatus(freeText);
          setExtractionStatus(fallback !== "not-analyzed" ? fallback : error.code === "NOT_CONFIGURED" ? "not-configured" : "failed");
          return;
        }
        const validated = validateBuildIntentExtraction(data.extraction, {
          availablePositions: positionsAtRequest,
          availableComparisonBuildIds: comparisonBuildsAtRequest.map((b) => b.buildId),
        });
        analyzedFreeTextRef.current = freeText;
        setPendingExtraction(validated);
        setExtractionStatus("awaiting-confirmation");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (extractionRequestIdRef.current !== myRequestId) return;
        setExtractionError({ code: "UNKNOWN", message: "Network error while requesting build intent extraction." });
        const fallback = computeFallbackStatus(freeText);
        setExtractionStatus(fallback !== "not-analyzed" ? fallback : "failed");
      });
  }, [intent.freeText, extractionStatus, analyzingBuildId, locale, inv.positions, availableComparisonBuilds, computeFallbackStatus]);

  const onCancelExtraction = useCallback(() => {
    extractionAbortRef.current?.abort();
    extractionAbortRef.current = null;
    extractionRequestIdRef.current += 1;
    setPendingExtraction(null);
    setExtractionStatus(computeFallbackStatus(intent.freeText));
    setClarificationSelections({});
  }, [intent.freeText, computeFallbackStatus]);

  const onSelectClarificationOption = useCallback((clarificationId: string, optionId: string) => {
    setClarificationSelections((cur) => ({ ...cur, [clarificationId]: optionId }));
  }, []);

  const onConfirmExtraction = useCallback(() => {
    if (!pendingExtraction) return;
    // 全ての候補確認へ回答済みであることを確認する(未回答のまま確定しない)。
    if (pendingExtraction.clarifications.some((c) => !clarificationSelections[c.id])) return;
    const appliedFreeText = analyzedFreeTextRef.current;
    // 選択された候補のpatchだけを反映する(「どれにも当てはまらない」・未選択は一切適用しない)。
    const resolvedClarificationPatches: BuildIntentClarificationPatch[] = pendingExtraction.clarifications
      .map((c) => {
        const selectedOptionId = clarificationSelections[c.id];
        if (!selectedOptionId || selectedOptionId === "none") return null;
        return c.options.find((o) => o.id === selectedOptionId)?.patch ?? null;
      })
      .filter((p): p is BuildIntentClarificationPatch => p !== null);
    setIntent((cur) => applyExtractionToIntent(cur, pendingExtraction, resolvedClarificationPatches));
    confirmedFreeTextRef.current = appliedFreeText;
    setUserModifiedAfterConfirm(false);
    setExtractionStatus("confirmed");
    setPendingExtraction(null);
    setClarificationSelections({});
  }, [pendingExtraction, clarificationSelections]);

  const onDiscardExtraction = useCallback(() => {
    setPendingExtraction(null);
    setExtractionError(null);
    setClarificationSelections({});
    setExtractionStatus(computeFallbackStatus(intent.freeText));
  }, [intent.freeText, computeFallbackStatus]);

  /** 自由記述(freeText)だけの変更(AI解析対象・stale判定用。手動確定へは遷移させない)。 */
  const onFreeTextChange = useCallback((freeText: string) => {
    setIntent((cur) => normalizeBuildIntent({ ...cur, freeText }).intent);
  }, []);

  /**
   * 自由記述以外(手動詳細設定)の変更。
   * - 確定済み/古い状態からの変更: 直接の手動編集を最優先とし、confirmed + userModified=true として扱う
   *   (「ユーザーが確認後に手動修正した確定値」を最優先で分析へ反映する)。
   * - 確認待ち/解析中からの変更: 未確定のAI提案は使わず、手動編集を優先して破棄する。
   * - それ以外(未解析/AI未設定/失敗/手動): 手動設定(manual)として確定する。
   */
  const onManualIntentChange = useCallback(
    (next: BuildIntentInput) => {
      setIntent(next);
      setExtractionError(null);
      if (extractionStatus === "confirmed" || extractionStatus === "stale") {
        confirmedFreeTextRef.current = next.freeText;
        setUserModifiedAfterConfirm(true);
        setExtractionStatus("confirmed");
      } else if (extractionStatus === "awaiting-confirmation" || extractionStatus === "analyzing") {
        extractionAbortRef.current?.abort();
        extractionAbortRef.current = null;
        extractionRequestIdRef.current += 1;
        setPendingExtraction(null);
        setExtractionStatus("manual");
      } else {
        setExtractionStatus("manual");
      }
    },
    [extractionStatus],
  );

  // 分析目的の評価も、能力値APIの再取得なしにここで純関数として計算する。
  const intentAnalysis = useMemo(() => {
    if (!analyzingItem || !analysis) return analyzeBuildIntent({
      intent: emptyBuildIntent(),
      allocation: {},
      groupImpact: [],
      abilityAvailable: false,
      baseAbilities: null,
      finalAbilities: null,
      abilityDeltas: null,
      remainingPoints: null,
      totalPoints: null,
      siblings: [],
    });
    return analyzeBuildIntent({
      intent,
      allocation: analyzingItem.build.progressionAllocation,
      groupImpact: analysis.abilityImpact.groupImpact,
      abilityAvailable: analysis.abilityImpact.available,
      baseAbilities: analysis.abilityImpact.baseAbilities,
      finalAbilities: analysis.abilityImpact.finalAbilities,
      abilityDeltas: analysis.abilityImpact.abilityDeltas,
      remainingPoints: analysis.remainingPoints,
      totalPoints: analysis.totalPoints,
      siblings: intentSiblings,
    });
  }, [analyzingItem, analysis, intent, intentSiblings]);
  const analysisPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!analyzingBuildId) return;
    if (typeof window === "undefined") return;
    const el = analysisPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (alreadyVisible) return;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }, [analyzingBuildId]);
  const legacyOnlyActive =
    filter.rules === "legacy" &&
    filter.q.trim() === "" &&
    filter.usage === "all" &&
    !filter.myTeamSelected &&
    !filter.myTeamFavorite &&
    !filter.squad &&
    !filter.multiUse &&
    !filter.pom &&
    !filter.experimental &&
    !filter.problemRef &&
    filter.cardType == null &&
    filter.position == null;

  const filterActive =
    filter.q.trim() !== "" ||
    filter.usage !== "all" ||
    filter.myTeamSelected ||
    filter.myTeamFavorite ||
    filter.squad ||
    filter.multiUse ||
    filter.rules !== "all" ||
    filter.pom ||
    filter.experimental ||
    filter.problemRef ||
    filter.cardType != null ||
    filter.position != null;

  const s = inv.summary;
  const anyIssue = inv.issues.length > 0;
  const storageDegraded = !buildAvail || !squadAvail || !myTeamAvail;

  if (builds.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={biv("pageTitle")} icon="database" description={biv("pageDescription")} />
        <LocalStorageNotice kind="builds" />
        {storageDegraded ? <StorageWarning buildAvail={buildAvail} myTeamAvail={myTeamAvail} squadAvail={squadAvail} /> : null}
        <EmptyState
          icon="database"
          title={biv("emptyTitle")}
          description={biv("emptyDescription")}
          action={
            <Link href="/players" className={buttonClasses("primary", "sm")}>
              {t("myTeam", "findPlayersLink")}
            </Link>
          }
          secondaryAction={
            <Link href="/compare" className={buttonClasses("secondary", "sm")}>
              {biv("openCompareLink")}
            </Link>
          }
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/my-builds" className={buttonClasses("outline", "sm")}>
              {biv("openMyBuildsLink")}
            </Link>
            <Link href="/my-team" className={buttonClasses("outline", "sm")}>
              {biv("openMyTeamLink")}
            </Link>
            <Link href="/squads" className={buttonClasses("outline", "sm")}>
              {biv("openSquadsLink")}
            </Link>
          </div>
        </EmptyState>
        <LegacyBuildGuide
          legacy={legacy}
          currentRulesBuilds={s.currentRulesBuilds}
          unknownRulesBuilds={s.unknownRulesBuilds}
          totalBuilds={s.totalBuilds}
          legacyOnlyActive={false}
          onShowLegacyOnly={() => setFilter(legacyOnlyFilter())}
          onClearFilter={() => setFilter(DEFAULT_BUILD_INVENTORY_FILTER)}
        />
        <DuplicateReviewSection
          review={dup}
          staleBuild={staleBuild}
          staleMyTeam={staleMyTeam}
          staleSquad={staleSquad}
          onReload={reload}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={biv("pageTitle")} icon="database" description={biv("pageDescription")} />
      <LocalStorageNotice kind="builds" />
      {storageDegraded ? <StorageWarning buildAvail={buildAvail} myTeamAvail={myTeamAvail} squadAvail={squadAvail} /> : null}
      {cardsError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-2xs text-danger">
          {cardsError}
          {biv("cardsErrorSuffix")}
        </p>
      ) : null}
      {(staleBuild || staleMyTeam || staleSquad) && (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-2xs text-info"
        >
          <Icon name="refresh" size={14} className="shrink-0" />
          <span>
            {fillBiv(biv("staleNoticeTemplate"), {
              targets: [staleBuild ? biv("staleBuildLabel") : null, staleMyTeam ? biv("staleMyTeamLabel") : null, staleSquad ? biv("staleSquadLabel") : null]
                .filter(Boolean)
                .join(" / "),
            })}
          </span>
          <button
            type="button"
            onClick={reload}
            className="rounded border border-info/50 px-2 py-0.5 font-semibold hover:bg-info/10"
          >
            {t("buildExportModal", "reloadButton")}
          </button>
        </div>
      )}
      {cardsLoading ? <p className="text-2xs text-text-muted">{t("myTeam", "resolvingCards")}</p> : null}

      {/* 全体サマリー */}
      <Surface padding="sm">
        <p className="text-sm font-semibold">
          {biv("summaryHeading")}{" "}
          <span className={anyIssue ? "text-warning" : "text-accent"}>
            {biv("statusPrefix")}
            {anyIssue ? biv("statusWarning") : biv("statusNormal")}
          </span>
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <SummaryStat label={biv("totalBuildsLabel")} value={s.totalBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("usedLabel")} value={s.usedBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("unusedLabel")} value={s.unusedBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("multiUseLabel")} value={s.multiUseBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("myTeamSelectedLabel")} value={s.myTeamSelectedRefs} unit={biv("unitCountSuffix")} />
          <SummaryStat label={biv("myTeamFavoriteLabel")} value={s.myTeamFavoriteRefs} unit={biv("unitCountSuffix")} />
          <SummaryStat label={biv("squadUsedLabel")} value={s.squadRefs} unit={biv("unitSlotSuffix")} />
          <SummaryStat label={biv("currentRulesLabel")} value={s.currentRulesBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("legacyRulesLabel")} value={s.legacyRulesBuilds} unit={biv("unitBuildSuffix")} warn={s.legacyRulesBuilds > 0} />
          <SummaryStat label={biv("unknownRulesLabel")} value={s.unknownRulesBuilds} unit={biv("unitBuildSuffix")} warn={s.unknownRulesBuilds > 0} />
          <SummaryStat label={biv("pomBuildsLabel")} value={s.pomBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("experimentalBuildsLabel")} value={s.experimentalBuilds} unit={biv("unitBuildSuffix")} />
          <SummaryStat label={biv("missingMyTeamRefsLabel")} value={s.missingMyTeamRefs} unit={biv("unitCountSuffix")} warn={s.missingMyTeamRefs > 0} />
          <SummaryStat label={biv("missingSquadRefsLabel")} value={s.missingSquadRefs} unit={biv("unitCountSuffix")} warn={s.missingSquadRefs > 0} />
          <SummaryStat label={biv("mismatchRefsLabel")} value={s.worldCardMismatchRefs} unit={biv("unitCountSuffix")} warn={s.worldCardMismatchRefs > 0} />
          <SummaryStat label={biv("invalidBuildIdRefsLabel")} value={s.invalidBuildIdRefs} unit={biv("unitCountSuffix")} warn={s.invalidBuildIdRefs > 0} />
          <SummaryStat label={biv("unknownRefsLabel")} value={s.unknownRefs} unit={biv("unitCountSuffix")} warn={s.unknownRefs > 0} />
        </dl>
        <p className="mt-2 text-2xs text-text-muted">{biv("summaryFootnote")}</p>
      </Surface>

      {/* 旧規則ビルド確認ガイド */}
      <LegacyBuildGuide
        legacy={legacy}
        currentRulesBuilds={s.currentRulesBuilds}
        unknownRulesBuilds={s.unknownRulesBuilds}
        totalBuilds={s.totalBuilds}
        legacyOnlyActive={legacyOnlyActive}
        onShowLegacyOnly={() => setFilter(legacyOnlyFilter())}
        onClearFilter={() => setFilter(DEFAULT_BUILD_INVENTORY_FILTER)}
      />

      {/* 保存ビルド重複候補 */}
      <DuplicateReviewSection
        review={dup}
        staleBuild={staleBuild}
        staleMyTeam={staleMyTeam}
        staleSquad={staleSquad}
        onReload={reload}
      />

      {/* 問題参照一覧 */}
      <details open={anyIssue} className="rounded-md border border-border bg-surface-2/30 [&_summary]:list-none">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-text-dim">
          <Icon name="warning" size={14} className={anyIssue ? "text-warning" : ""} />
          {fillBiv(biv("issuesSummaryTemplate"), { count: String(inv.issues.length) })}
        </summary>
        <div className="border-t border-border/60 p-3">
          {inv.issues.length === 0 ? (
            <p className="text-2xs text-text-muted">{biv("noIssuesLabel")}</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-2xs">
                {(["all", "missing", "world-card-mismatch", "invalid-build-id", "unknown"] as IssueFilterKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setIssueKind(k)}
                    aria-pressed={issueKind === k}
                    className={`rounded border px-2 py-0.5 ${
                      issueKind === k
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-text-dim hover:border-accent"
                    }`}
                  >
                    {k === "all" ? biv("allFilterLabel") : ISSUE_KIND_LABEL[k]}
                  </button>
                ))}
                <input
                  type="text"
                  value={issueQuery}
                  onChange={(e) => setIssueQuery(e.target.value)}
                  placeholder={biv("searchIssuesPlaceholder")}
                  aria-label={biv("searchIssuesAriaLabel")}
                  className="min-w-[10rem] flex-1 rounded border border-border bg-surface px-2 py-1 text-2xs"
                />
              </div>
              {visibleIssues.length === 0 ? (
                <p className="text-2xs text-text-muted">{biv("noMatchingIssuesLabel")}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {visibleIssues.map((issue, i) => (
                    <IssueRow key={i} issue={issue} cards={cards} />
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[9px] text-text-muted">{biv("issuesFootnote")}</p>
            </>
          )}
        </div>
      </details>

      {/* 検索・絞り込み・並び替え */}
      <details open className="rounded-md border border-border bg-surface-2/30 [&_summary]:list-none">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-text-dim">
          <Icon name="filter" size={14} />
          {biv("searchFilterSortHeading")}
          {filterActive ? <span className="rounded bg-accent-soft px-1.5 py-0.5 text-2xs text-accent">{biv("filterActiveLabel")}</span> : null}
        </summary>
        <div className="flex flex-col gap-2 border-t border-border/60 p-3">
          <label className="flex flex-col gap-1 text-2xs text-text-dim">
            {biv("searchLabel")}
            <input
              type="text"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              placeholder={biv("searchPlaceholderExample")}
              aria-label={biv("searchAriaLabel")}
              className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SelectField
              label={biv("usageFilterLabel")}
              value={filter.usage}
              onChange={(v) => setFilter((f) => ({ ...f, usage: v as BuildInventoryFilter["usage"] }))}
              options={[
                ["all", biv("allOption")],
                ["used", biv("usedOption")],
                ["unused", biv("unusedOption")],
              ]}
            />
            <SelectField
              label={biv("rulesFilterLabel")}
              value={filter.rules}
              onChange={(v) => setFilter((f) => ({ ...f, rules: v as BuildInventoryFilter["rules"] }))}
              options={[
                ["all", biv("allOption")],
                ["current", biv("currentRulesOption")],
                ["legacy", biv("legacyRulesOption")],
                ["unknown", biv("unknownRulesOption")],
              ]}
            />
            <SelectField
              label={biv("cardTypeFilterLabel")}
              value={filter.cardType ?? ""}
              onChange={(v) => setFilter((f) => ({ ...f, cardType: v || null }))}
              options={[["", biv("allOption")], ...inv.cardTypes.map((ct) => [ct, ct] as [string, string])]}
            />
            <SelectField
              label={biv("registeredPositionFilterLabel")}
              value={filter.position ?? ""}
              onChange={(v) => setFilter((f) => ({ ...f, position: v || null }))}
              options={[["", biv("allOption")], ...inv.positions.map((p) => [p, p] as [string, string])]}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs">
            <Check label={biv("myTeamSelectedCheckLabel")} checked={filter.myTeamSelected} onChange={(c) => setFilter((f) => ({ ...f, myTeamSelected: c }))} />
            <Check label={biv("myTeamFavoriteCheckLabel")} checked={filter.myTeamFavorite} onChange={(c) => setFilter((f) => ({ ...f, myTeamFavorite: c }))} />
            <Check label={biv("squadUsedCheckLabel")} checked={filter.squad} onChange={(c) => setFilter((f) => ({ ...f, squad: c }))} />
            <Check label={biv("multiUseCheckLabel")} checked={filter.multiUse} onChange={(c) => setFilter((f) => ({ ...f, multiUse: c }))} />
            <Check label={biv("pomCheckLabel")} checked={filter.pom} onChange={(c) => setFilter((f) => ({ ...f, pom: c }))} />
            <Check label={biv("experimentalCheckLabel")} checked={filter.experimental} onChange={(c) => setFilter((f) => ({ ...f, experimental: c }))} />
            <Check label={biv("problemRefCheckLabel")} checked={filter.problemRef} onChange={(c) => setFilter((f) => ({ ...f, problemRef: c }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-2xs text-text-dim">
              {biv("sortAriaLabel")}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as BuildInventorySortKey)}
                aria-label={biv("sortAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                {BUILD_INVENTORY_SORT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {filterActive ? (
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_BUILD_INVENTORY_FILTER)}
                className="rounded border border-border px-2 py-1 text-2xs hover:border-accent"
              >
                {biv("clearSearchButton")}
              </button>
            ) : null}
          </div>
        </div>
      </details>

      <Surface padding="sm">
        <p className="text-2xs text-text-dim">
          {biv("showingCountPrefix")}
          <b className="tabular-nums">{visibleItems.length}</b>
          {biv("showingCountMiddle")}
          <b className="tabular-nums">{inv.items.length}</b>
          {biv("showingCountSuffix")}
        </p>
      </Surface>

      {visibleItems.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={biv("noResultsTitle")}
          description={biv("noResultsDescription")}
          action={
            <button
              type="button"
              onClick={() => setFilter(DEFAULT_BUILD_INVENTORY_FILTER)}
              className={buttonClasses("primary", "sm")}
            >
              {biv("clearSearchButton")}
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleItems.map((item) => (
            <li key={item.build.buildId}>
              <InventoryCard
                item={item}
                isAnalyzing={analyzingBuildId === item.build.buildId}
                analysisPanelId={`build-analysis-${item.build.buildId}`}
                onToggleAnalyze={() =>
                  setAnalyzingBuildId((cur) => (cur === item.build.buildId ? null : item.build.buildId))
                }
              />
            </li>
          ))}
        </ul>
      )}

      {analyzingItem && analysis && analysisPanelId ? (
        <BuildAnalysisPanel
          ref={analysisPanelRef}
          analysis={analysis}
          playerName={analyzingName}
          buildName={analyzingItem.build.buildName}
          panelId={analysisPanelId}
          onClose={() => setAnalyzingBuildId(null)}
          abilityLoading={abilityCards[analyzingItem.build.worldCardId] === undefined}
          intent={intent}
          onFreeTextChange={onFreeTextChange}
          onManualIntentChange={onManualIntentChange}
          intentAnalysis={intentAnalysis}
          availablePositions={inv.positions}
          availableComparisonBuilds={availableComparisonBuilds}
          extractionStatus={extractionStatus}
          userModifiedAfterConfirm={userModifiedAfterConfirm}
          pendingExtraction={pendingExtraction}
          extractionError={extractionError}
          onRequestExtraction={onRequestExtraction}
          onCancelExtraction={onCancelExtraction}
          onConfirmExtraction={onConfirmExtraction}
          onDiscardExtraction={onDiscardExtraction}
          clarificationSelections={clarificationSelections}
          onSelectClarificationOption={onSelectClarificationOption}
          presetIntent={{
            presetSearchQuery,
            onPresetSearchQueryChange: setPresetSearchQuery,
            presetCategoryFilter,
            onPresetCategoryFilterChange: setPresetCategoryFilter,
            draftMainPresetId,
            draftSubPresetIds,
            onSelectMainPreset,
            onToggleSubPreset,
            draftIntent,
            onDraftIntentChange,
            onResetPresetDefaults,
            onDiscardManualEdits,
            conflicts: presetConflicts,
            onResolveConflictUsePreset,
            onResolveConflictUseManual,
            confirmedMainPresetId,
            confirmedSubPresetIds,
            presetStatus,
            presetUserModified,
            onConfirmPresetIntent,
            onRevertToConfirmedPreset,
            onReturnToGeneralAnalysis,
            justCarriedOverFromSiblingBuild,
          }}
          savedIntent={{
            hasSavedIntent: savedBuildIntentForCurrent != null,
            matchesCurrent: savedIntentMatchesCurrent,
            hasPendingChanges: hasPendingIntentChanges,
            hasConfirmedIntent,
            saveStatus: intentSaveStatus,
            deleteStatus: intentDeleteStatus,
            restoredNotice: restoredIntentNotice,
            onSave: onSaveBuildIntent,
            onRequestDelete: onRequestDeleteBuildIntent,
            onCancelDelete: onCancelDeleteBuildIntent,
            onConfirmDelete: onConfirmDeleteBuildIntent,
            onRevertToSaved: onRevertToSavedBuildIntent,
          }}
        />
      ) : null}
    </div>
  );
}

function LegacyBuildGuide({
  legacy,
  currentRulesBuilds,
  unknownRulesBuilds,
  totalBuilds,
  legacyOnlyActive,
  onShowLegacyOnly,
  onClearFilter,
}: {
  legacy: ReturnType<typeof summarizeLegacyBuilds>;
  currentRulesBuilds: number;
  unknownRulesBuilds: number;
  totalBuilds: number;
  legacyOnlyActive: boolean;
  onShowLegacyOnly: () => void;
  onClearFilter: () => void;
}) {
  const t = useT();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  const fillBiv = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const has = legacy.total > 0;
  return (
    <details open={has} className="rounded-md border border-border bg-surface-2/30 [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-text-dim">
        <Icon name="warning" size={14} className={has ? "text-warning" : ""} />
        {fillBiv(biv("legacyGuideHeadingTemplate"), { count: String(legacy.total) })}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border/60 p-3 text-2xs">
        <p className="text-text-dim">{biv("legacyGuideIntro")}</p>
        {has ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <SummaryStat label={biv("totalBuildsLabel")} value={legacy.total} unit={biv("unitBuildSuffix")} warn={legacy.total > 0} />
              <SummaryStat label={biv("usedLabel")} value={legacy.used} unit={biv("unitBuildSuffix")} warn={legacy.used > 0} />
              <SummaryStat label={biv("unusedLabel")} value={legacy.unused} unit={biv("unitBuildSuffix")} />
              <SummaryStat label={biv("multiUseLabel")} value={legacy.multiUse} unit={biv("unitBuildSuffix")} warn={legacy.multiUse > 0} />
              <SummaryStat label={biv("myTeamSelectedLabel")} value={legacy.myTeamSelectedRefs} unit={biv("unitCountSuffix")} warn={legacy.myTeamSelectedRefs > 0} />
              <SummaryStat label={biv("myTeamFavoriteLabel")} value={legacy.myTeamFavoriteRefs} unit={biv("unitCountSuffix")} warn={legacy.myTeamFavoriteRefs > 0} />
              <SummaryStat label={biv("squadUsedLabel")} value={legacy.squadRefs} unit={biv("unitSlotSuffix")} warn={legacy.squadRefs > 0} />
              <SummaryStat label={biv("pomBuildsLabel")} value={legacy.pom} unit={biv("unitBuildSuffix")} />
              <SummaryStat label={biv("experimentalBuildsLabel")} value={legacy.experimental} unit={biv("unitBuildSuffix")} />
              <SummaryStat label={biv("problemRefCheckLabel")} value={legacy.withProblemRef} unit={biv("unitBuildSuffix")} warn={legacy.withProblemRef > 0} />
            </dl>
            <p className="text-text-muted">{biv("legacyUnitFootnote")}</p>

            <div className="rounded border border-info/40 bg-info/10 p-2 text-info">
              <p className="font-semibold">{biv("legacyGuideCaution")}</p>
              <ul className="mt-0.5 list-disc pl-4">
                {biv("legacyGuideCautionNotes")
                  .split("｜")
                  .map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold text-text-dim">{biv("legacyStepsHeading")}</p>
              <ol className="mt-0.5 list-decimal pl-4 text-text-dim">
                <li>{biv("legacyStep1")}</li>
                <li>{biv("legacyStep2")}</li>
                <li>{biv("legacyStep3")}</li>
                <li>{biv("legacyStep4")}</li>
                <li>{biv("legacyStep5")}</li>
                <li>{biv("legacyStep6")}</li>
              </ol>
              <ul className="mt-1 list-disc pl-4 text-text-muted">
                <li>{biv("legacyNote1")}</li>
                <li>{biv("legacyNote2")}</li>
                <li>{biv("legacyNote3")}</li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onShowLegacyOnly}
                aria-pressed={legacyOnlyActive}
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 font-semibold ${
                  legacyOnlyActive ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent"
                }`}
              >
                <Icon name="filter" size={12} />
                {biv("showLegacyOnlyButton")}
              </button>
              {legacyOnlyActive ? (
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
                >
                  {biv("clearFilterButton")}
                </button>
              ) : null}
              <Link
                href="/my-builds"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {biv("manageInMyBuildsLink")}
              </Link>
              <Link
                href="/my-team"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="shirt" size={12} />
                {biv("openMyTeamLink")}
              </Link>
              <Link
                href="/squads"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="squad" size={12} />
                {biv("openSquadsLink")}
              </Link>
            </div>
            <p className="text-text-muted">{biv("perRowGuideNote")}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-text">{biv("noLegacyTitle")}</p>
            <p className="text-text-dim">{biv("noLegacyDescription")}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <SummaryStat label={biv("totalBuildsLabel")} value={totalBuilds} unit={biv("unitBuildSuffix")} />
              <SummaryStat label={biv("currentRulesLabel")} value={currentRulesBuilds} unit={biv("unitBuildSuffix")} />
              <SummaryStat label={biv("unknownRulesLabel")} value={unknownRulesBuilds} unit={biv("unitBuildSuffix")} warn={unknownRulesBuilds > 0} />
            </dl>
            <div>
              <Link
                href="/my-builds"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {biv("manageInMyBuildsLink")}
              </Link>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function StorageWarning({
  buildAvail,
  myTeamAvail,
  squadAvail,
}: {
  buildAvail: boolean;
  myTeamAvail: boolean;
  squadAvail: boolean;
}) {
  const t = useT();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  const fillBiv = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const missing = [
    !buildAvail ? biv("missingBuildsLabel") : null,
    !myTeamAvail ? biv("missingMyTeamLabel") : null,
    !squadAvail ? biv("missingSquadLabel") : null,
  ].filter(Boolean);
  return (
    <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-2xs text-warning">
      {fillBiv(biv("storageWarningTemplate"), { missing: missing.join(" / ") })}
    </p>
  );
}

function SummaryStat({
  label,
  value,
  unit,
  warn = false,
}: {
  label: string;
  value: number;
  unit: string;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-2xs text-text-muted">{label}</dt>
      <dd className={`font-bold tabular-nums ${warn && value > 0 ? "text-warning" : ""}`}>
        {value} <span className="text-2xs font-normal text-text-muted">{unit}</span>
      </dd>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-2xs text-text-dim">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-text-dim">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function IssueRow({
  issue,
  cards,
}: {
  issue: BuildInventoryIssue;
  cards: Map<string, WorldPlayerListItem>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  const fillBiv = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const ISSUE_KIND_LABEL = useIssueKindLabels();
  const card = cards.get(issue.refWorldCardId) ?? null;
  const name = resolvePlayerDisplayName(card ?? {}, locale, t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", issue.refWorldCardId));
  const kindLabel = ISSUE_KIND_LABEL[issue.kind];
  const src = issue.source;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-warning/40 bg-warning/5 p-2 text-2xs">
      <Badge tone="warning" size="xs">
        {kindLabel}
      </Badge>
      <span className="font-semibold">{name}</span>
      <span className="text-text-muted">World ID {issue.refWorldCardId}</span>
      <span className="text-text-muted">buildId {issue.buildId}</span>
      {src.kind === "squad-starter" || src.kind === "squad-bench" ? (
        <span className="text-text-muted">
          {src.kind === "squad-starter" ? biv("starterAreaLabel") : biv("benchAreaLabel")}・{src.squadName}（{src.squadId}）・{src.slotLabel}
        </span>
      ) : (
        <span className="text-text-muted">
          {src.kind === "my-team-selected"
            ? fillBiv(biv("myTeamSelectedSourceTemplate"), { teamCardId: String(src.teamCardId) })
            : fillBiv(biv("myTeamFavoriteSourceTemplate"), { teamCardId: String(src.teamCardId) })}
        </span>
      )}
      <span className="w-full text-text-dim">{issue.description}</span>
      <span className="flex w-full flex-wrap gap-1.5">
        {src.kind === "squad-starter" || src.kind === "squad-bench" ? (
          <Link
            href={`/squads/${encodeURIComponent(src.squadId)}`}
            className="rounded border border-border px-2 py-0.5 hover:border-accent"
          >
            {biv("openSquadLink")}
          </Link>
        ) : (
          <Link href="/my-team" className="rounded border border-border px-2 py-0.5 hover:border-accent">
            {biv("openMyTeamLink")}
          </Link>
        )}
        <Link
          href={`/players/world/${encodeURIComponent(issue.refWorldCardId)}`}
          className="rounded border border-border px-2 py-0.5 hover:border-accent"
        >
          {t("myBuildCard", "playerDetailLink")}
        </Link>
        <Link href="/my-builds" className="rounded border border-border px-2 py-0.5 hover:border-accent">
          {biv("manageInMyBuildsLink")}
        </Link>
      </span>
    </li>
  );
}

function InventoryCard({
  item,
  isAnalyzing,
  onToggleAnalyze,
  analysisPanelId,
}: {
  item: BuildInventoryItem;
  isAnalyzing: boolean;
  onToggleAnalyze: () => void;
  analysisPanelId: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const biv = (k: keyof Dictionary["buildInventoryView"]) => t("buildInventoryView", k);
  const fillBiv = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const { build, card } = item;
  const fallbackName = t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", build.worldCardId);
  const name = resolvePlayerDisplayName(card ?? {}, locale, fallbackName);
  const ruleLabel =
    item.ruleKind === "current"
      ? t("buildUsage", "ruleCurrentLabel")
      : item.ruleKind === "legacy"
        ? t("buildUsage", "ruleLegacyLabel")
        : t("buildUsage", "ruleUnknownLabel");
  const sources = card
    ? resolveCardImageSources({
        worldCardId: card.worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];
  const points = buildPointSummary(build, card?.maximumLevel ?? null);
  const pom = describeBuildPoM(build);
  const activeRows = buildAllocationRows(build.progressionAllocation).filter((r) => r.level > 0);
  const allRows = buildAllocationRows(build.progressionAllocation);
  const detailHref = `/players/world/${encodeURIComponent(build.worldCardId)}`;
  const pointsText =
    points.totalPoints == null
      ? fillBiv(t("squadBuildPanel", "pointsUsedNoTotalTemplate"), { used: String(points.usedPoints) })
      : fillBiv(t("squadBuildPanel", "pointsUsedTotalTemplate"), { used: String(points.usedPoints), total: String(points.totalPoints) });
  const remainingText =
    points.remainingPoints == null
      ? t("squadBuildPanel", "remainingUnknown")
      : fillBiv(t("squadBuildPanel", "remainingTemplate"), { remaining: String(points.remainingPoints) });
  return (
    <div className={`flex flex-col overflow-hidden rounded-card border bg-surface ${isAnalyzing ? "border-accent" : "border-border"}`}>
      <div className="flex gap-2.5 p-2.5">
        <Link href={detailHref} className="w-16 shrink-0 sm:w-20" aria-label={fillBiv(t("myBuildCard", "selectPlayerDetailAriaTemplate"), { name })}>
          <WorldCardImage
            sources={sources}
            alt={card ? fillBiv(t("squadBuildPanel", "cardImageAltTemplate"), { name }) : t("myBuildCard", "cardImageAltResolving")}
            size="card"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" title={build.buildName}>
            {build.buildName}
          </p>
          <Link href={detailHref} className="block truncate text-xs text-text-dim hover:text-accent" title={name}>
            {name}
          </Link>
          <p className="truncate text-2xs text-text-muted">{card?.nameEn || `ID ${build.worldCardId}`}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {card?.registeredPosition ? <Badge tone="neutral" size="xs">{card.registeredPosition}</Badge> : null}
            {card?.cardType ? <Badge tone="outline" size="xs">{card.cardType}</Badge> : null}
            <Badge tone={item.ruleKind === "current" ? "neutral" : "warning"} size="xs">
              {ruleLabel}
            </Badge>
            {item.used ? (
              <Badge tone="accent" size="xs">
                {fillBiv(biv("usedRefTemplate"), { count: String(item.refCount) })}
              </Badge>
            ) : (
              <Badge tone="warning" size="xs">
                {biv("unusedLabel")}
              </Badge>
            )}
            {item.multiUse ? <Badge tone="accent" size="xs">{biv("multiUseBadge")}</Badge> : null}
            {item.mismatchRefCount > 0 ? (
              <Badge tone="warning" size="xs">
                {fillBiv(biv("mismatchRefTemplate"), { count: String(item.mismatchRefCount) })}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-2xs text-text-muted">
            World ID {build.worldCardId} · buildId {build.buildId}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 px-2.5 py-2 text-2xs">
        <p className="font-semibold text-text-dim">{t("myBuildCard", "allocationHeading")}</p>
        {activeRows.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {activeRows.map((r) => (
              <li key={r.groupId}>
                {r.label} <span className="font-semibold tabular-nums">Lv {r.level}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-text-muted">{t("squadBuildPanel", "noAllocationBase")}</p>
        )}
        <details className="mt-1">
          <summary className="cursor-pointer text-text-muted hover:text-text">{t("myBuildCard", "viewAllAllocationsSummary")}</summary>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
            {allRows.map((r) => (
              <li key={r.groupId} className={r.level > 0 ? "text-text" : "text-text-muted"}>
                {r.label}: Lv {r.level}
              </li>
            ))}
          </ul>
        </details>
        <p className="mt-1">
          <span className="tabular-nums">{pointsText}</span>
          <span className="ml-2 text-text-dim tabular-nums">{remainingText}</span>
          {points.overAllocated ? <span className="ml-2 text-danger">{t("squadBuildPanel", "overAllocated")}</span> : null}
        </p>
        <p className="mt-0.5 text-text-dim">
          {t("squadBuildPanel", "pomRowLabel")}
          {pom.has ? pom.tierLabel : t("squadBuildPanel", "pomUnspecified")}
          {fillBiv(biv("experimentalSuffixTemplate"), { value: item.experimental ? biv("experimentalYesLabel") : biv("experimentalNoLabel") })}
        </p>
        <p className="mt-0.5 text-text-dim">
          {fillBiv(t("myBuildCard", "estimatedOvrTemplate"), {
            ovr: String(build.calculatedOvr ?? "—"),
            mode:
              build.calculationMode === "confirmed"
                ? t("squadBuildPanel", "calcModeConfirmed")
                : build.calculationMode === "unsupported"
                  ? t("squadBuildPanel", "calcModeUnsupported")
                  : t("squadBuildPanel", "calcModeProvisional"),
          })}
        </p>
        <p className="mt-0.5 text-text-muted">{t("squadBuildPanel", "totalOvrPlaceholder")}</p>
        <p className="mt-0.5 text-text-muted">
          {fillBiv(t("squadBuildPanel", "createdUpdatedTemplate"), {
            created: formatBuildTimestamp(build.createdAt),
            updated: formatBuildTimestamp(build.updatedAt),
          })}
        </p>
      </div>

      <div className="border-t border-border/60 px-2.5 py-2 text-2xs">
        <p className="font-semibold text-text-dim">{fillBiv(biv("usageHeadingTemplate"), { count: String(item.refCount) })}</p>
        {item.used ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {item.myTeamSelectedCount > 0 ? (
              <li className="text-accent">{fillBiv(biv("myTeamSelectedCountTemplate"), { count: String(item.myTeamSelectedCount) })}</li>
            ) : null}
            {item.myTeamFavoriteCount > 0 ? (
              <li className="text-yellow-300">{fillBiv(biv("myTeamFavoriteCountTemplate"), { count: String(item.myTeamFavoriteCount) })}</li>
            ) : null}
            {item.squads.map((sq) => (
              <li key={sq.squadId}>
                <Link href={`/squads/${sq.squadId}`} className="text-accent hover:underline">
                  {fillBiv(t("myBuildCard", "squadUsingLinkTemplate"), { name: sq.squadName })}
                </Link>
                <span className="text-text-muted">
                  {fillBiv(biv("squadAreaSuffixTemplate"), {
                    areas: [
                      sq.starterSlots ? fillBiv(biv("starterSlotsTemplate"), { count: String(sq.starterSlots) }) : null,
                      sq.benchSlots ? fillBiv(biv("benchSlotsTemplate"), { count: String(sq.benchSlots) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" / "),
                    squadId: sq.squadId,
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-text-muted">{biv("notUsedLabel")}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-2.5 py-2">
        <Link
          href="/my-builds"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="sliders" size={12} />
          {biv("manageInMyBuildsLink")}
        </Link>
        <Link
          href={detailHref}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="players" size={12} />
          {t("myBuildCard", "playerDetailLink")}
        </Link>
        <Link
          href={`${detailHref}?tab=progression`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="sliders" size={12} />
          {t("myBuildCard", "openProgressionLink")}
        </Link>
        {item.myTeamSelectedCount > 0 || item.myTeamFavoriteCount > 0 ? (
          <Link
            href="/my-team"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
          >
            <Icon name="shirt" size={12} />
            {biv("myTeamLinkLabel")}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onToggleAnalyze}
          aria-expanded={isAnalyzing}
          aria-controls={analysisPanelId}
          className={`inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 text-2xs ${
            isAnalyzing ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent"
          }`}
        >
          <Icon name="sparkles" size={12} />
          {t("buildAnalysis", "analyzeButtonLabel")}
          {isAnalyzing ? (
            <Badge tone="accent" size="xs" className="ml-1">
              {t("buildAnalysis", "analyzingStatusLabel")}
            </Badge>
          ) : null}
        </button>
      </div>
    </div>
  );
}
