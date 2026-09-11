"use client";

import { useMemo, useState } from "react";
import type {
  ProgressionCard,
  AutoAllocateProfile,
  SavedBuild,
  BuildMigration,
  ManagerContext,
  SelectedPlayerBooster,
  SelectedConditionalBooster,
  BoosterApplicationMode,
} from "@/lib/progression/types";
import { validateConditionalBoosterSelection } from "@/lib/progression/conditional-boosters";
import type { ManagerDetail } from "@/lib/managers/types";
import { calculateBuild } from "@/lib/progression/engine";
import { adjustGroupLevel } from "@/lib/progression/group-allocation";
import { autoAllocate } from "@/lib/progression/auto-allocate";
import { migrateBuild } from "@/lib/progression/migrate-build";
import { isV2RulesVersion } from "@/lib/progression/progression-rules";
import { buildModeLabelJa, groupLabelJa, statListJa } from "@/lib/world/stat-labels";
import { RulesNotice } from "./RulesNotice";
import { BuildBar } from "./BuildBar";
import { MigrationNotice } from "./MigrationNotice";
import { PlayerBoosterPanel } from "./PlayerBoosterPanel";
import { StatComparison } from "./StatComparison";
import { ProgressionSlider } from "./ProgressionSlider";
import { CompactStatGrid } from "./CompactStatGrid";
import { ProgressionSummary, ProgressionStickyBar } from "./ProgressionSummary";
import { PlayerAnalysisRail } from "./PlayerAnalysisRail";
import { PlayerSkillsPanel } from "./PlayerSkillsPanel";
import type { PlayerAnalysis } from "@/lib/world/player-analysis";
import { ManagerPicker } from "@/components/managers/ManagerPicker";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";

// 表示ラベルは stat-labels.ts の buildModeLabelJa に集約。ここは順序と値のみ定義。
const PROFILES: AutoAllocateProfile[] = ["attack", "defense", "balance", "gk"];

export function ProgressionPanel({
  card,
  imageSources = [],
  analysis = null,
  analysisScope = "World データ",
}: {
  card: ProgressionCard;
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

  const result = useMemo(
    () =>
      calculateBuild({
        card,
        allocation,
        manager,
        selectedPlayerBoosters: selectedBoosters,
        selectedConditionalBoosters: conditionalSelections,
        boosterApplicationMode: boosterMode,
      }),
    [card, allocation, manager, selectedBoosters, conditionalSelections, boosterMode],
  );
  const canProgress = result.eligibility.canProgress;

  function handleGroupAdjust(groupId: string, delta: number) {
    setAllocation((prev) => adjustGroupLevel(prev, card, groupId, delta));
  }
  /** スライダーで目標レベルへ（engine が段階コスト・残ポイント・上限で丸める）。 */
  function handleGroupSet(groupId: string, level: number) {
    setAllocation((prev) => adjustGroupLevel(prev, card, groupId, level - (prev[groupId] ?? 0)));
  }
  function handleAuto(profile: AutoAllocateProfile) {
    setAllocation(autoAllocate(card, profile).allocation);
  }
  function handleLoad(build: SavedBuild) {
    const migration = migrateBuild(build, card);
    setConditionalSelections(validateConditionalBoosterSelection(build.conditionalBoosterSelections));
    if (isV2RulesVersion(build.rulesVersion) && !migration.changed) {
      setPending(null);
      setAllocation(migration.migratedAllocation);
      return;
    }
    setPending({ build, migration });
    setAllocation(migration.migratedAllocation);
  }

  const hasAllocation = Object.keys(allocation).length > 0;
  const isGk = card.registeredPosition === "GK";
  const fieldGroups = result.groups.filter((g) => !g.groupId.startsWith("goalkeeping"));
  const gkGroups = result.groups.filter((g) => g.groupId.startsWith("goalkeeping"));
  const gkAllocated = gkGroups.reduce((n, g) => n + g.allocatedPoints, 0);

  return (
    <div className="flex flex-col gap-4">
      <ProgressionStickyBar
        card={card}
        imageSources={imageSources}
        points={result.points}
        onReset={() => setAllocation({})}
        canReset={hasAllocation}
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
          {result.eligibility.reason ?? "このカードは育成できません。"}（能力値は基礎値のまま表示します）
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
        {/* 左: 配分方針・育成スライダー */}
        <div className="flex flex-col gap-4">
          <div>
            <SectionHeader
              title="自動育成（配分方針）"
              as="h3"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllocation({})}
                  disabled={!hasAllocation}
                  className="text-danger"
                >
                  育成リセット
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
                  {buildModeLabelJa(p)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-2xs text-text-muted">
              自動育成は「配分方針」のヒューリスティックです。ゲーム内の自動配分アルゴリズムとは異なり、OVR の最大化は保証しません。実行後も各スライダーで手動調整できます。
            </p>
          </div>

          <div>
            <SectionHeader
              title="能力値グループ（カテゴリレベル）"
              as="h3"
              hint={`${groupLabelJa("shooting")}の対象能力は確認済 / 他は検証中`}
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
                  <span>GK育成 3 項目</span>
                  <span className="shrink-0 text-2xs font-normal text-text-dim">
                    {`配分 Lv ${gkAllocated}${!isGk ? "（非GK・初期折りたたみ）" : "（GK・初期展開）"}`}
                  </span>
                </summary>
                <div className="border-t border-border p-2">
                  <p className="mb-2 text-2xs text-text-muted">
                    {statListJa(["gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach"])} を調整します。
                    折りたたんでも配分・使用ポイント・段階コストは保持します。
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

          <BuildBar
            worldCardId={card.worldCardId}
            result={result}
            allocation={allocation}
            selectedBooster={null}
            conditionalBoosterSelections={conditionalSelections}
            onLoad={handleLoad}
          />
        </div>

        {/* 中央: 能力値一覧 + スキル + 計算根拠 */}
        <div className="flex flex-col gap-4">
          <div>
            <SectionHeader
              title="能力値比較（育成前後）"
              as="h3"
              action={
                <span className="text-xs text-text-dim">
                  推定OVR <span className="font-bold text-accent">{result.rating.estimatedOvr ?? "—"}</span>{" "}
                  <span className="text-2xs text-warning/80">検証中</span>
                </span>
              }
            />
            <CompactStatGrid
              stats={result.stats}
              mode={boosterMode}
              showConditional={result.booster.hasConditionalSelection}
              showExperimental={boosterMode === "experimental" && result.booster.hasExperimentalExtra}
              defaultOpenGk={isGk}
            />
          </div>

          {analysis ? <PlayerSkillsPanel skills={analysis.skills} /> : null}

          {/* 計算根拠・証拠情報（通常画面から一段奥へ） */}
          <details className="rounded-md border border-border bg-surface-2/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
              計算根拠とデータの出所を見る（モード・証拠レベル・規則バージョン・詳細な内訳）
            </summary>
            <div className="flex flex-col gap-4 border-t border-border p-3">
              <RulesNotice result={result} />

              <PlayerBoosterPanel mode={boosterMode} onModeChange={setBoosterMode} />

              <div>
                <SectionHeader title="詳細な内訳（表形式）" as="h3" />
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

        {/* 右（PC）/ 中央下（狭幅）: 選手分析レール */}
        {analysis ? (
          <div className="lg:col-span-2 [@media(min-width:1400px)]:col-span-1">
            <PlayerAnalysisRail analysis={analysis} scopeLabel={analysisScope} />
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
