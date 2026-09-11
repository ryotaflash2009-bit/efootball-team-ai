"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComparisonPlayerInput, CompareBuildMode, ComparisonState } from "@/lib/comparison/types";
import { COMPARISON_MAX } from "@/lib/comparison/types";
import { buildComparison } from "@/lib/comparison/build-comparison";
import { worldDetailToComparisonInput } from "@/lib/comparison/from-world";
import { serializeComparisonState } from "@/lib/comparison/schemas";
import type { AutoAllocateProfile, ManagerContext, SelectedConditionalBooster } from "@/lib/progression/types";
import { parseTotalPackageSelection } from "@/lib/progression/conditional-boosters";
import { resolveAllocation } from "@/lib/progression/resolve-allocation";
import { adjustGroupLevel, groupBreakdowns, summarizeGroupPoints } from "@/lib/progression/group-allocation";
import { autoAllocate } from "@/lib/progression/auto-allocate";
import type { WorldPlayerDetail } from "@/lib/world/types";
import { AddPlayerSearch } from "./AddPlayerSearch";
import { PlayerControlColumn } from "./PlayerControlColumn";
import { ComparisonCockpit } from "./ComparisonCockpit";
import { ComparisonTables } from "./ComparisonTables";
import type { RadarMode } from "@/lib/comparison/ability-radar";
import { ManagerPicker } from "@/components/managers/ManagerPicker";
import { Surface } from "@/components/ui/Surface";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

// 表示ラベルは i18n の bench.mode* に集約。ここは順序と値のみ定義。
const SHARED_MODES: CompareBuildMode[] = ["none", "attack", "defense", "balance", "gk"];

function useBuildModeLabels(): Record<CompareBuildMode, string> {
  const t = useT();
  return {
    none: t("bench", "modeNone"),
    attack: t("bench", "modeAttack"),
    defense: t("bench", "modeDefense"),
    balance: t("bench", "modeBalance"),
    gk: t("bench", "modeGk"),
  };
}

export function ComparisonBoard({ initialInputs }: { initialInputs: ComparisonPlayerInput[] }) {
  const t = useT();
  const { locale } = useLocale();
  const tcb = useCallback((k: keyof Dictionary["comparisonBoard"]) => t("comparisonBoard", k), [t]);
  const fillCb = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );
  const buildModeLabels = useBuildModeLabels();
  const [players, setPlayers] = useState<ComparisonPlayerInput[]>(initialInputs);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [buildsRefreshKey, setBuildsRefreshKey] = useState(0);

  const comparison = useMemo(() => (players.length >= 2 ? buildComparison(players) : null), [players]);

  /** 各カードの「現在の配分」＋そのグループ内訳・ポイント（比較表と同じ resolveAllocation を使う）。 */
  const perBuild = useMemo(
    () =>
      players.map((p) => {
        const allocation = resolveAllocation(p.card, p.buildMode, p.savedAllocation ?? null);
        const manualAllocation = !!p.savedAllocation && Object.keys(p.savedAllocation).length > 0;
        return {
          allocation,
          manualAllocation,
          groups: groupBreakdowns(allocation, p.card),
          points: summarizeGroupPoints(allocation, p.card),
          canProgress: (p.card.maximumLevel ?? 0) > 1,
        };
      }),
    [players],
  );

  useEffect(() => {
    const state: ComparisonState = {
      ids: players.map((p) => p.display.worldCardId),
      buildModes: players.map((p) => p.buildMode),
      managerIds: players.map((p) => p.manager?.internalManagerId ?? null),
      conditionalTiers: players.map((p) =>
        parseTotalPackageSelection(p.selectedConditionalBoosters?.[0]?.selection),
      ),
      allocations: players.map((p) =>
        p.savedAllocation && Object.keys(p.savedAllocation).length > 0 ? p.savedAllocation : null,
      ),
    };
    const q = serializeComparisonState(state);
    window.history.replaceState(null, "", q ? `/compare?${q}` : "/compare");
  }, [players]);

  const addPlayer = useCallback(
    async (worldCardId: string): Promise<boolean> => {
      setAddError(null);
      if (players.length >= COMPARISON_MAX) {
        setAddError(fillCb(tcb("maxPlayersErrorTemplate"), { max: String(COMPARISON_MAX) }));
        return false;
      }
      // worldCardId は文字列のまま比較（数値化しない）
      if (players.some((p) => p.display.worldCardId === worldCardId)) {
        setAddError(tcb("duplicateCardError"));
        return false;
      }
      try {
        const r = await fetch(`/api/world/players/${encodeURIComponent(worldCardId)}`);
        if (!r.ok) {
          setAddError(tcb("fetchPlayerFailedError"));
          return false;
        }
        const data = (await r.json()) as { player: WorldPlayerDetail };
        setPlayers((prev) => [...prev, worldDetailToComparisonInput(data.player)]);
        return true;
      } catch {
        setAddError(tcb("fetchPlayerErrorGeneric"));
        return false;
      }
    },
    [players, tcb, fillCb],
  );

  function removePlayer(idx: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== idx));
  }
  function patch(idx: number, next: Partial<ComparisonPlayerInput>) {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...next } : p)));
  }

  const doApplySharedMode = useCallback((mode: CompareBuildMode) => {
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, buildMode: mode, savedAllocation: null, savedBuildName: null })),
    );
  }, []);
  /** 全員へ育成方針を適用。手動配分／保存ビルドがある列があれば確認する（無ければ即適用）。 */
  const [confirmSharedMode, setConfirmSharedMode] = useState<CompareBuildMode | null>(null);
  function applySharedMode(mode: CompareBuildMode) {
    const overwritten = players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.savedAllocation && Object.keys(p.savedAllocation).length > 0);
    if (overwritten.length > 0) {
      setConfirmSharedMode(mode);
      return;
    }
    doApplySharedMode(mode);
  }

  function applySharedManager(ctx: ManagerContext | null) {
    setPlayers((prev) => prev.map((p) => ({ ...p, manager: ctx })));
  }

  // ---- 比較列内育成（既存 engine の group-allocation をそのまま使う） ----
  const setLevel = useCallback((idx: number, groupId: string, level: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const cur = resolveAllocation(p.card, p.buildMode, p.savedAllocation ?? null);
        const next = adjustGroupLevel(cur, p.card, groupId, level - (cur[groupId] ?? 0));
        return { ...p, savedAllocation: next, savedBuildName: null };
      }),
    );
  }, []);
  const adjustLevel = useCallback((idx: number, groupId: string, delta: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const cur = resolveAllocation(p.card, p.buildMode, p.savedAllocation ?? null);
        const next = adjustGroupLevel(cur, p.card, groupId, delta);
        return { ...p, savedAllocation: next, savedBuildName: null };
      }),
    );
  }, []);
  const autoProfilePlayer = useCallback((idx: number, profile: AutoAllocateProfile) => {
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === idx
          ? { ...p, savedAllocation: autoAllocate(p.card, profile).allocation, savedBuildName: null }
          : p,
      ),
    );
  }, []);
  const resetTraining = useCallback((idx: number) => {
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, savedAllocation: null, savedBuildName: null, buildMode: "none" } : p,
      ),
    );
  }, []);

  const onBuildSaved = useCallback(
    (idx: number, build: { buildId: string; buildName: string }) => {
      setBuildsRefreshKey((k) => k + 1);
      // 現在の比較列へ関連付け（配分は既に savedAllocation・26 能力値/レーダーは変えない）
      setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, savedBuildName: build.buildName } : p)));
      setNotice(fillCb(tcb("buildSavedNoticeTemplate"), { name: build.buildName }));
      setTimeout(() => setNotice(null), 6000);
    },
    [tcb, fillCb],
  );

  const [sharedPickerOpen, setSharedPickerOpen] = useState(false);
  const [perPlayerPicker, setPerPlayerPicker] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const addTriggerRef = useRef<HTMLButtonElement>(null);

  // ---- 比較コックピット（UI 状態のみ・URL には入れない） ----
  const [radarMode, setRadarMode] = useState<RadarMode>("standard");
  const [showPreBuild, setShowPreBuild] = useState(false);
  const [activeIndex, setActiveIndexRaw] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("shooting");
  const setActiveIndex = useCallback((i: number) => setActiveIndexRaw(Math.max(0, i)), []);
  useEffect(() => {
    // 選手が減ったら育成対象インデックスを丸める
    if (activeIndex > players.length - 1) setActiveIndexRaw(Math.max(0, players.length - 1));
  }, [players.length, activeIndex]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    // Escape / 追加成功 / 閉じる のいずれでも元の「＋」ボタンへフォーカスを戻す
    requestAnimationFrame(() => addTriggerRef.current?.focus());
  }, []);

  const slotsToShow = Math.max(2, Math.min(players.length + 1, COMPARISON_MAX));
  const sharedManagerId = players.length > 0 && players.every((p) => p.manager?.internalManagerId === players[0].manager?.internalManagerId)
    ? players[0].manager?.internalManagerId ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 共有コントロール */}
      <Surface tone="raised" padding="sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-text-dim">{tcb("sameTrainingLabel")}</span>
          {SHARED_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applySharedMode(m)}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs hover:border-accent"
            >
              {buildModeLabels[m]}
            </button>
          ))}
          <span className="ml-2 text-xs text-text-dim">{tcb("sameManagerLabel")}</span>
          <button
            type="button"
            onClick={() => setSharedPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs hover:border-accent"
          >
            <Icon name="managers" size={13} />
            {tcb("chooseFromManagerListButton")}
          </button>
          <button
            type="button"
            onClick={() => applySharedManager(null)}
            className="rounded-md border border-border px-2 py-1 text-xs text-danger hover:opacity-80"
          >
            {tcb("clearAllManagersButton")}
          </button>
          <span className="text-2xs text-text-muted">{tcb("perPlayerManagerNote")}</span>
        </div>
      </Surface>

      <ManagerPicker
        open={sharedPickerOpen}
        onClose={() => setSharedPickerOpen(false)}
        currentManagerId={sharedManagerId}
        title={tcb("sharedManagerPickerTitle")}
        onSelect={(ctx) => applySharedManager(ctx)}
      />
      {perPlayerPicker != null && players[perPlayerPicker] ? (
        <ManagerPicker
          open
          onClose={() => setPerPlayerPicker(null)}
          currentManagerId={players[perPlayerPicker].manager?.internalManagerId ?? null}
          title={fillCb(tcb("perPlayerManagerPickerTitleTemplate"), {
            name: resolvePlayerDisplayName(players[perPlayerPicker].display, locale, tcb("fallbackPlayerName")),
          })}
          onSelect={(ctx) => patch(perPlayerPicker, { manager: ctx })}
        />
      ) : null}

      {addError ? <p className="text-xs text-danger">{addError}</p> : null}
      {notice ? (
        <p aria-live="polite" className="rounded border border-accent/40 bg-accent-soft/40 px-2 py-1 text-xs text-accent">
          {notice}
        </p>
      ) : null}

      {confirmSharedMode != null ? (
        <div role="alertdialog" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
          <p className="font-semibold text-warning">
            {fillCb(tcb("confirmOverwriteWarningTemplate"), { mode: buildModeLabels[confirmSharedMode] })}
          </p>
          <p className="mt-1 text-text-dim">
            {tcb("overwriteTargetsLabel")}
            {players
              .map((p, i) => ({ p, i }))
              .filter(({ p }) => p.savedAllocation && Object.keys(p.savedAllocation).length > 0)
              .map(({ p, i }) =>
                fillCb(tcb("overwriteTargetTemplate"), {
                  index: String(i + 1),
                  name: resolvePlayerDisplayName(p.display, locale, p.display.worldCardId),
                }),
              )
              .join(" / ")}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                doApplySharedMode(confirmSharedMode);
                setConfirmSharedMode(null);
              }}
              className="rounded border border-warning px-3 py-1 text-warning"
            >
              {tcb("overwriteApplyButton")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSharedMode(null)}
              className="rounded border border-border px-3 py-1"
            >
              {tcb("overwriteCancelButton")}
            </button>
          </div>
        </div>
      ) : null}

      {/* 選手ヘッダー列 + 空きスロット */}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[560px] gap-3"
          style={{ gridTemplateColumns: `repeat(${slotsToShow}, minmax(180px, 1fr))` }}
        >
          {players.map((p, i) => (
            <PlayerControlColumn
              key={p.display.worldCardId}
              player={p}
              index={i}
              columnCount={players.length}
              groups={perBuild[i]?.groups ?? []}
              points={
                perBuild[i]?.points ?? {
                  totalPoints: 0,
                  usedPoints: 0,
                  remainingPoints: 0,
                  totalPointsConfidence: "provisional",
                  canAdd: false,
                  canReduce: false,
                  atCap: false,
                  overAllocated: false,
                  valid: true,
                }
              }
              canProgress={perBuild[i]?.canProgress ?? false}
              hasManualAllocation={perBuild[i]?.manualAllocation ?? false}
              showTrainingPanel={players.length < 2}
              buildsRefreshKey={buildsRefreshKey}
              onRemove={() => removePlayer(i)}
              onBuildMode={(mode) => patch(i, { buildMode: mode })}
              onSavedBuild={(alloc, name) => patch(i, { savedAllocation: alloc, savedBuildName: name })}
              onManager={(ctx: ManagerContext | null) => patch(i, { manager: ctx })}
              onOpenManagerPicker={() => setPerPlayerPicker(i)}
              onBoosters={(next) => patch(i, { selectedPlayerBoosters: next })}
              onConditionalBoosters={(next: SelectedConditionalBooster[]) =>
                patch(i, { selectedConditionalBoosters: next.length ? next : undefined })
              }
              onSetLevel={(groupId, level) => setLevel(i, groupId, level)}
              onAdjustLevel={(groupId, delta) => adjustLevel(i, groupId, delta)}
              onAutoProfile={(profile) => autoProfilePlayer(i, profile)}
              onResetTraining={() => resetTraining(i)}
            />
          ))}
          {Array.from({ length: Math.max(0, slotsToShow - players.length) }).map((_, i) => (
            <div
              key={`slot-${i}`}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-surface/50 p-3 text-center"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon name="plus" size={18} />
              </span>
              <p className="text-xs font-medium text-text-dim">
                {fillCb(tcb("selectSlotOrdinalTemplate"), { n: String(players.length + i + 1) })}
              </p>
              {players.length + i === players.length ? (
                <button
                  ref={addTriggerRef}
                  type="button"
                  onClick={() => setSearchOpen((v) => !v)}
                  disabled={players.length >= COMPARISON_MAX}
                  aria-expanded={searchOpen}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {fillCb(tcb("addPlayerToSlotButtonTemplate"), { n: String(players.length + 1) })}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {searchOpen && players.length < COMPARISON_MAX ? (
        <AddPlayerSearch
          existingIds={players.map((p) => p.display.worldCardId)}
          targetIndex={players.length}
          onAdd={addPlayer}
          onClose={closeSearch}
        />
      ) : null}

      {players.length >= COMPARISON_MAX ? (
        <p className="text-xs text-text-dim">
          {fillCb(tcb("maxPlayersNoteTemplate"), { max: String(COMPARISON_MAX) })}
        </p>
      ) : null}

      {players.length < 2 ? (
        <Surface tone="outline" className="text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="compare" size={22} />
          </span>
          <p className="text-sm font-semibold">{tcb("needTwoPlayersTitle")}</p>
          <p className="mt-1 text-xs text-text-dim">
            {fillCb(tcb("needTwoPlayersDescriptionTemplate"), { max: String(COMPARISON_MAX) })}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.assign("/players?sort=ovr_max_desc")}
            >
              {tcb("browseHighOvrButton")}
            </Button>
          </div>
        </Surface>
      ) : comparison ? (
        <>
          <ComparisonCockpit
            players={players}
            comparison={comparison}
            perBuild={perBuild}
            radarMode={radarMode}
            onRadarMode={setRadarMode}
            showPreBuild={showPreBuild}
            onTogglePreBuild={() => setShowPreBuild((v) => !v)}
            activeIndex={activeIndex}
            onActiveIndex={setActiveIndex}
            activeCategory={activeCategory}
            onActiveCategory={setActiveCategory}
            onSetLevel={setLevel}
            onAdjustLevel={adjustLevel}
            onAutoProfile={autoProfilePlayer}
            onResetTraining={resetTraining}
            onBuildSaved={onBuildSaved}
            buildsRefreshKey={buildsRefreshKey}
          />
          <div id="compare-abilities" className="scroll-mt-24">
            <ComparisonTables comparison={comparison} players={players} />
          </div>
        </>
      ) : null}
    </div>
  );
}
