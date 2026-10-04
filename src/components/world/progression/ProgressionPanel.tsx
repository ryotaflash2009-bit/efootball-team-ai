"use client";

import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";
import "@/lib/i18n/dictionaries/ja-ns/basePercentile";
import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { useCallback, useMemo, useState } from "react";
import { listBuilds } from "@/lib/progression/build-storage";
import { sameAllocation, saveCurrentBuild } from "@/lib/progression/save-current-build";
import { localizeBuildStorageError } from "@/lib/progression/build-storage-errors";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { abilityName, categoryName } from "@/lib/progression/ability-editor-labels";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import type {
  ProgressionCard,
  AutoAllocateProfile,
  SavedBuild,
  BuildMigration,
  ManagerContext,
  SelectedPlayerBooster,
  SelectedConditionalBooster,
  BoosterApplicationMode,
  PointsSummary,
} from "@/lib/progression/types";
import { validateConditionalBoosterSelection } from "@/lib/progression/conditional-boosters";
import type { ManagerDetail } from "@/lib/managers/types";
import { calculateBuild } from "@/lib/progression/engine";
import { adjustGroupLevel } from "@/lib/progression/group-allocation";
import { autoAllocate } from "@/lib/progression/auto-allocate";
import { migrateBuild } from "@/lib/progression/migrate-build";
import { isV2RulesVersion } from "@/lib/progression/progression-rules";
import { RulesNotice } from "./RulesNotice";
import { BuildBar } from "./BuildBar";
import { MigrationNotice } from "./MigrationNotice";
import { PlayerBoosterPanel } from "./PlayerBoosterPanel";
import { StatComparison } from "./StatComparison";
import { ProgressionSlider } from "./ProgressionSlider";
import { AbilityProgressionEditor } from "./ability-editor/AbilityProgressionEditor";
import { ProgressionSummary, ProgressionStickyBar } from "./ProgressionSummary";
import { PlayerAnalysisRail } from "./PlayerAnalysisRail";
import { PlayerSkillsPanel } from "./PlayerSkillsPanel";
import type { PlayerAnalysis } from "@/lib/world/player-analysis";
import type { WorldStatValue } from "@/lib/world/types";
import { WorldBasePercentilePanel } from "@/components/world/WorldBasePercentilePanel";
import { ManagerPicker } from "@/components/managers/ManagerPicker";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";

// 表示ラベルは辞書（progressionTab.buildMode*）。ここは順序と値のみ定義。
const PROFILES: AutoAllocateProfile[] = ["attack", "defense", "balance", "gk"];
const PROFILE_LABEL_KEY: Record<AutoAllocateProfile, keyof Dictionary["progressionTab"]> = {
  attack: "buildModeAttack",
  defense: "buildModeDefense",
  balance: "buildModeBalance",
  gk: "buildModeGk",
};

export function ProgressionPanel({
  card,
  imageSources = [],
  analysis = null,
  analysisScope,
  worldStats,
  registeredPosition = null,
}: {
  card: ProgressionCard;
  /** F-071: 育成前の World の能力値（欠けた値を既定値で埋めていないもの）。あれば基礎能力値のパーセンタイルを別枠で出す。 */
  worldStats?: WorldStatValue[];
  registeredPosition?: string | null;
  imageSources?: string[];
  /** 選手分析レール用の整形済み表示データ（無ければレールを出さない）。 */
  analysis?: PlayerAnalysis | null;
  analysisScope?: string;
}) {
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [manager, setManager] = useState<ManagerContext | null>(null);
  const [managerDetail, setManagerDetail] = useState<ManagerDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedBoosters, setSelectedBoosters] = useState<SelectedPlayerBooster[]>([]);
  const [conditionalSelections, setConditionalSelections] = useState<SelectedConditionalBooster[]>([]);
  const [boosterMode, setBoosterMode] = useState<BoosterApplicationMode>("standard");
  const [pending, setPending] = useState<{ build: SavedBuild; migration: BuildMigration } | null>(null);
  // 保存済み（または読み込んだ）配分。現在の配分と違えば「未保存」。
  const [savedAllocation, setSavedAllocation] = useState<Record<string, number>>({});
  const [buildsRefresh, setBuildsRefresh] = useState(0);
  // 全リセット直前の配分（取り消し用）。次の変更で消える。
  const [undoAllocation, setUndoAllocation] = useState<Record<string, number> | null>(null);
  // ドラッグ中のプレビュー（上部バーの残りポイントも同じ値にするため）。
  const [previewPoints, setPreviewPoints] = useState<PointsSummary | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: keyof Dictionary["progressionTab"]) => t("progressionTab", k);

  // 同じ条件（監督・ブースター・モード）での計算。能力値直接操作UIのプレビューも同じ関数を使う。
  const calculate = useCallback(
    (alloc: Record<string, number>) =>
      calculateBuild({
        card,
        allocation: alloc,
        manager,
        selectedPlayerBoosters: selectedBoosters,
        selectedConditionalBoosters: conditionalSelections,
        boosterApplicationMode: boosterMode,
      }),
    [card, manager, selectedBoosters, conditionalSelections, boosterMode],
  );
  const result = useMemo(() => calculate(allocation), [calculate, allocation]);
  const canProgress = result.eligibility.canProgress;

  function handleGroupAdjust(groupId: string, delta: number) {
    setUndoAllocation(null);
    setAllocation((prev) => adjustGroupLevel(prev, card, groupId, delta));
  }
  /** スライダーで目標レベルへ（engine が段階コスト・残ポイント・上限で丸める）。 */
  function handleGroupSet(groupId: string, level: number) {
    setUndoAllocation(null);
    setAllocation((prev) => adjustGroupLevel(prev, card, groupId, level - (prev[groupId] ?? 0)));
  }
  function goToSave() {
    const el = typeof document !== "undefined" ? document.getElementById("progression-build-bar") : null;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
  }
  function resetAll() {
    if (Object.keys(allocation).length === 0) return;
    setUndoAllocation(allocation);
    setAllocation({});
  }
  function undoReset() {
    if (!undoAllocation) return;
    setAllocation(undoAllocation);
    setUndoAllocation(null);
  }
  /** 育成パネルからの1タップ保存（既存の保存契約・保存欄と同じ関数）。 */
  function quickSave(): { ok: boolean; message: string } {
    const r = saveCurrentBuild({
      worldCardId: card.worldCardId,
      buildName: t("abilityEditor", "quickSaveName").replace("{n}", String(listBuilds(card.worldCardId).length + 1)),
      allocation,
      result,
      selectedBooster: null,
      conditionalBoosterSelections: conditionalSelections,
    });
    if (!r.ok) return { ok: false, message: t("abilityEditor", "saveFailed").replace("{reason}", localizeBuildStorageError(r.error, locale)) };
    setSavedAllocation({ ...allocation });
    setBuildsRefresh((n) => n + 1);
    return { ok: true, message: t("abilityEditor", "saveSucceeded").replace("{name}", r.build.buildName) };
  }
  function handleAuto(profile: AutoAllocateProfile) {
    setUndoAllocation(null);
    setAllocation(autoAllocate(card, profile).allocation);
  }
  function handleLoad(build: SavedBuild) {
    const migration = migrateBuild(build, card);
    setConditionalSelections(validateConditionalBoosterSelection(build.conditionalBoosterSelections));
    setUndoAllocation(null);
    if (isV2RulesVersion(build.rulesVersion) && !migration.changed) {
      setPending(null);
      setAllocation(migration.migratedAllocation);
      setSavedAllocation(migration.migratedAllocation);
      return;
    }
    // 旧規則からの移行で値が変わる場合は、読み込んだ時点で未保存（再保存が必要）。
    setSavedAllocation(build.progressionAllocation);
    setPending({ build, migration });
    setAllocation(migration.migratedAllocation);
  }

  const hasAllocation = Object.keys(allocation).length > 0;
  const dirty = !sameAllocation(allocation, savedAllocation);
  const isGk = card.registeredPosition === "GK";
  const fieldGroups = result.groups.filter((g) => !g.groupId.startsWith("goalkeeping"));
  const gkGroups = result.groups.filter((g) => g.groupId.startsWith("goalkeeping"));
  const gkAllocated = gkGroups.reduce((n, g) => n + g.allocatedPoints, 0);

  return (
    <div className="flex flex-col gap-4">
      <ProgressionStickyBar
        card={card}
        imageSources={imageSources}
        points={previewPoints ?? result.points}
        onReset={resetAll}
        canReset={hasAllocation}
        onUndoReset={undoAllocation ? undoReset : null}
      />

      {pending ? (
        <MigrationNotice
          migration={pending.migration}
          onRecalculate={() => {
            if (pending) setAllocation(pending.migration.migratedAllocation);
            setPending(null);
          }}
          onDismiss={() => setPending(null)}
        />
      ) : null}

      {!canProgress ? (
        <div className="rounded-md border border-border bg-surface-2/40 p-3 text-sm text-text-dim">
          {(card.cardType ?? "").toUpperCase() === "TRENDING"
            ? tp("eligibilityTrending")
            : (card.maximumLevel ?? 0) <= 1
              ? tp("eligibilityMaxLevel1")
              : tp("cannotProgressFallback")}
          {tp("baseValuesKept")}
        </div>
      ) : null}

      <ProgressionSummary
        card={card}
        imageSources={imageSources}
        points={result.points}
        attached={result.playerBoosters}
        attachedNote={result.playerBoosterAttached.note}
        conditionalSelections={conditionalSelections}
        onConditionalChange={setConditionalSelections}
        selectedBoosters={selectedBoosters}
        appliedBoosters={result.playerBoosterSelection.applied}
        onSelectedBoostersChange={setSelectedBoosters}
        manager={manager}
        managerDetail={managerDetail}
        managerReasons={result.manager.reasons}
        onOpenPicker={() => setPickerOpen(true)}
        onClearManager={() => {
          setManager(null);
          setManagerDetail(null);
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] [@media(min-width:1400px)]:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,300px)] 2xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)_minmax(0,340px)]">
        {/* 中央: 能力値一覧（育成の入口）+ スキル + 計算根拠。DOM 先頭 = モバイルで最初に表示。PC では2列目。 */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">
          <div>
            <SectionHeader
              title={tp("statComparisonTitle")}
              as="h3"
              action={
                <span className="text-xs text-text-dim">
                  {tp("estimatedOvr")} <span className="font-bold text-accent">{result.rating.estimatedOvr ?? "—"}</span>{" "}
                  <span className="text-2xs text-warning/80">{tp("underVerification")}</span>
                </span>
              }
            />
            <AbilityProgressionEditor
              card={card}
              allocation={allocation}
              result={result}
              calculate={calculate}
              canProgress={canProgress}
              showConditional={result.booster.hasConditionalSelection}
              onSetLevel={handleGroupSet}
              onAdjust={handleGroupAdjust}
              onGoToSave={goToSave}
              onQuickSave={quickSave}
              dirty={dirty}
              onPreviewPoints={setPreviewPoints}
            />
          </div>

          {worldStats && worldStats.length > 0 ? (
            <details className="rounded-md border border-border bg-surface-2/20" data-testid="progression-base-percentile">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{t("basePercentile", "heading")}</summary>
              <div className="border-t border-border px-3 pb-3">
                <WorldBasePercentilePanel stats={worldStats} registeredPosition={registeredPosition} />
              </div>
            </details>
          ) : null}

          {analysis ? <PlayerSkillsPanel skills={analysis.skills} /> : null}

          {/* 計算根拠・証拠情報（通常画面から一段奥へ） */}
          <details className="rounded-md border border-border bg-surface-2/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
              {tp("calculationDetailsSummary")}
            </summary>
            <div className="flex flex-col gap-4 border-t border-border p-3">
              <RulesNotice result={result} />

              <PlayerBoosterPanel mode={boosterMode} onModeChange={setBoosterMode} />

              <div>
                <SectionHeader title={tp("detailedBreakdownTitle")} as="h3" />
                <StatComparison
                  stats={result.stats}
                  byStat={result.playerBoosterByStat}
                  mode={boosterMode}
                  showExperimental={boosterMode === "experimental" && result.booster.hasExperimentalExtra}
                  showConditional={result.booster.hasConditionalSelection}
                  conditionalSelections={result.booster.conditionalSelections}
                />
              </div>
            </div>
          </details>
        </div>

        {/* 左: 配分方針・カテゴリ別スライダー一覧・保存 */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <div>
            <SectionHeader
              title={tp("autoAllocationTitle")}
              as="h3"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAll}
                  disabled={!hasAllocation}
                  className="text-danger"
                >
                  {tp("resetProgression")}
                </Button>
              }
            />
            <div className="flex flex-wrap gap-2">
              {PROFILES.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!canProgress}
                  onClick={() => handleAuto(p)}
                  className="min-h-[44px] rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:text-text-muted hover:enabled:border-accent"
                >
                  {tp(PROFILE_LABEL_KEY[p])}
                </button>
              ))}
            </div>
            <p className="mt-2 text-2xs text-text-muted">
              {tp("autoAllocationNote")}
            </p>
          </div>

          <div>
            <SectionHeader
              title={tp("groupsTitle")}
              as="h3"
              hint={tp("groupsHint").replace("{shooting}", categoryName("shooting", locale))}
            />
            <div className="flex flex-col gap-2.5">
              {fieldGroups.map((g) => (
                <ProgressionSlider
                  key={g.groupId}
                  group={g}
                  disabled={!canProgress}
                  onSet={handleGroupSet}
                  onAdjust={handleGroupAdjust}
                />
              ))}
            </div>

            {gkGroups.length > 0 ? (
              <details open={isGk} className="mt-2.5 rounded-md border border-border bg-surface-2/20">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
                  <span>{tp("gkGroupsSummary")}</span>
                  <span className="min-w-0 text-right text-2xs font-normal text-text-dim">
                    {tp(isGk ? "gkAllocatedGk" : "gkAllocatedNonGk").replace("{level}", String(gkAllocated))}
                  </span>
                </summary>
                <div className="border-t border-border p-2">
                  <p className="mb-2 text-2xs text-text-muted">
                    {tp("gkGroupsNote").replace(
                      "{stats}",
                      ["gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach"].map((k) => abilityName(k, locale)).join(" / "),
                    )}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {gkGroups.map((g) => (
                      <ProgressionSlider
                        key={g.groupId}
                        group={g}
                        disabled={!canProgress}
                        onSet={handleGroupSet}
                        onAdjust={handleGroupAdjust}
                      />
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </div>

          <div id="progression-build-bar" className="scroll-mt-32">
          <BuildBar
            worldCardId={card.worldCardId}
            result={result}
            allocation={allocation}
            selectedBooster={null}
            conditionalBoosterSelections={conditionalSelections}
            onLoad={handleLoad}
            onSaved={(b) => setSavedAllocation(b.progressionAllocation)}
            refreshKey={buildsRefresh}
          />
          </div>
        </div>

        {/* 右（PC）/ 中央下（狭幅）: 選手分析レール */}
        {analysis ? (
          <div className="lg:col-span-2 [@media(min-width:1400px)]:col-span-1">
            <PlayerAnalysisRail analysis={analysis} scopeLabel={analysisScope ?? tp("analysisScopeDefault")} />
          </div>
        ) : null}
      </div>

      <ManagerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentManagerId={manager?.internalManagerId ?? null}
        onSelect={(ctx, detail) => {
          setManager(ctx);
          setManagerDetail(detail);
        }}
      />
    </div>
  );
}
