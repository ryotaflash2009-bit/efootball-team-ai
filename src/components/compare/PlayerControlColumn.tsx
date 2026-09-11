"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComparisonPlayerInput, CompareBuildMode } from "@/lib/comparison/types";
import type {
  AutoAllocateProfile,
  ManagerContext,
  PointsSummary,
  ProgressionGroup,
  SavedBuild,
  SelectedConditionalBooster,
  ConditionalBoosterSelection,
} from "@/lib/progression/types";
import { listBuilds } from "@/lib/progression/build-storage";
import { BOOSTER_CATALOG, getBoosterDef } from "@/lib/progression/booster-catalog";
import { resolveAttachedBooster } from "@/lib/progression/booster-resolution";
import { ConditionalBoosterControl } from "@/components/world/progression/ConditionalBoosterControl";
import { ComparePlayerIdentityCard } from "./ComparePlayerIdentityCard";
import { CompareTrainingPanel } from "./CompareTrainingPanel";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

const CONFIRMED_BOOSTERS = BOOSTER_CATALOG.filter((b) => b.confirmationStatus === "confirmed");

// 表示ラベルは i18n の bench.mode* に集約。ここは順序と値のみ定義。
const BUILD_MODES: CompareBuildMode[] = ["none", "attack", "defense", "balance", "gk"];

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

/** 1選手ぶんのヘッダー＋育成/監督コントロール（比較画面の各列の上部） */
export function PlayerControlColumn({
  player,
  columnCount,
  groups,
  points,
  canProgress,
  hasManualAllocation,
  onRemove,
  onBuildMode,
  onSavedBuild,
  onManager,
  onOpenManagerPicker,
  onBoosters,
  onConditionalBoosters,
  onSetLevel,
  onAdjustLevel,
  onAutoProfile,
  onResetTraining,
  showTrainingPanel = true,
  buildsRefreshKey = 0,
}: {
  player: ComparisonPlayerInput;
  index: number;
  /** 現在の比較人数（表示のコンパクト化に使用）。 */
  columnCount: number;
  /** このカードの現在の配分でのグループ内訳（親が engine で算出）。 */
  groups: ProgressionGroup[];
  points: PointsSummary;
  canProgress: boolean;
  /** savedAllocation が非空（手動配分 or 保存ビルド由来）か。 */
  hasManualAllocation: boolean;
  /** 育成スライダーをこの列に出すか（2人以上のときは比較コックピットへ集約するので false）。 */
  showTrainingPanel?: boolean;
  /** これが変わると保存ビルド一覧を読み直す。 */
  buildsRefreshKey?: number;
  onRemove: () => void;
  onBuildMode: (mode: CompareBuildMode) => void;
  onSavedBuild: (allocation: Record<string, number> | null, name: string | null) => void;
  onManager: (ctx: ManagerContext | null) => void;
  onOpenManagerPicker: () => void;
  onBoosters: (next: { slot: 1 | 2; boosterKey: string; level: number }[]) => void;
  onConditionalBoosters: (next: SelectedConditionalBooster[]) => void;
  onSetLevel: (groupId: string, level: number) => void;
  onAdjustLevel: (groupId: string, delta: number) => void;
  onAutoProfile: (profile: AutoAllocateProfile) => void;
  onResetTraining: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tpc = (k: keyof Dictionary["playerControlColumn"]) => t("playerControlColumn", k);
  const fillPc = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const buildModeLabels = useBuildModeLabels();
  const d = player.display;

  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  useEffect(() => {
    setBuilds(listBuilds(d.worldCardId));
  }, [d.worldCardId, buildsRefreshKey]);

  const name = resolvePlayerDisplayName(d, locale, fillPc(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: d.worldCardId }));
  const isGk = d.registeredPosition === "GK";

  const trainingLabel = hasManualAllocation
    ? player.savedBuildName
      ? fillPc(tpc("savedBuildTrainingLabelTemplate"), { name: player.savedBuildName })
      : tpc("manualTrainingLabel")
    : buildModeLabels[player.buildMode];

  const attachedBoosters = useMemo(
    () =>
      ([
        [1, player.card.boost1],
        [2, player.card.boost2],
      ] as const)
        .map(([slot, id]) => resolveAttachedBooster("world", slot, id))
        .filter((r): r is NonNullable<typeof r> => r != null),
    [player.card.boost1, player.card.boost2],
  );

  const condSelByKey = useMemo(
    () => new Map((player.selectedConditionalBoosters ?? []).map((c) => [c.boosterKey, c.selection])),
    [player.selectedConditionalBoosters],
  );
  function setConditional(boosterKey: string, sel: ConditionalBoosterSelection) {
    const rest = (player.selectedConditionalBoosters ?? []).filter((c) => c.boosterKey !== boosterKey);
    onConditionalBoosters(sel === "none" ? rest : [...rest, { boosterKey, selection: sel }]);
  }

  const booster = useMemo(() => (player.selectedPlayerBoosters ?? []).find((b) => b.slot === 1) ?? null, [player.selectedPlayerBoosters]);
  const boosterDef = booster ? getBoosterDef(booster.boosterKey) : undefined;
  function setBooster(boosterKey: string | null, level?: number) {
    if (!boosterKey) {
      onBoosters([]);
      return;
    }
    const def = getBoosterDef(boosterKey);
    const lv = Math.max(1, Math.min(def?.maxLevel ?? 5, level ?? booster?.level ?? 1));
    onBoosters([{ slot: 1, boosterKey, level: lv }]);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative">
        <ComparePlayerIdentityCard player={player} trainingLabel={trainingLabel} columnCount={columnCount} />
        <button
          type="button"
          onClick={onRemove}
          aria-label={fillPc(tpc("removeAriaTemplate"), { name })}
          className="absolute right-0 top-0 rounded bg-black/70 px-1.5 py-0.5 text-xs text-danger hover:opacity-80"
        >
          ✕
        </button>
      </div>

      {/* 育成 */}
      <div className="rounded border border-border bg-surface-2/30 p-1.5">
        <label className="block text-[10px] text-text-dim">{tpc("trainingPolicyLabel")}</label>
        <select
          value={hasManualAllocation && player.savedBuildName ? "__saved__" : hasManualAllocation ? "__manual__" : player.buildMode}
          onChange={(e) => {
            if (e.target.value === "__saved__" || e.target.value === "__manual__") return;
            onSavedBuild(null, null);
            onBuildMode(e.target.value as CompareBuildMode);
          }}
          aria-label={fillPc(tpc("trainingPolicyAriaTemplate"), { name })}
          className="w-full rounded border border-border bg-surface px-1 py-1 text-xs"
        >
          {BUILD_MODES.map((m) => (
            <option key={m} value={m}>
              {buildModeLabels[m]}
            </option>
          ))}
          {hasManualAllocation && player.savedBuildName ? (
            <option value="__saved__">{fillPc(tpc("savedBuildOptionTemplate"), { name: player.savedBuildName })}</option>
          ) : hasManualAllocation ? (
            <option value="__manual__">{tpc("manualTrainingOption")}</option>
          ) : null}
        </select>
        {builds.length > 0 ? (
          <select
            value=""
            onChange={(e) => {
              const b = builds.find((x) => x.buildId === e.target.value);
              if (b) onSavedBuild(b.progressionAllocation, b.buildName);
            }}
            aria-label={fillPc(tpc("applyBuildAriaTemplate"), { name })}
            className="mt-1 w-full rounded border border-border bg-surface px-1 py-1 text-xs"
          >
            <option value="">{tpc("applyBuildDefaultOption")}</option>
            {builds.map((b) => (
              <option key={b.buildId} value={b.buildId}>
                {b.buildName}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* 比較画面内育成（スライダー）。2人以上のときは比較コックピットへ集約 */}
      {showTrainingPanel ? (
        <CompareTrainingPanel
          name={name}
          isGk={isGk}
          groups={groups}
          points={points}
          canProgress={canProgress}
          hasManualAllocation={hasManualAllocation}
          onSetLevel={onSetLevel}
          onAdjustLevel={onAdjustLevel}
          onAutoProfile={onAutoProfile}
          onReset={onResetTraining}
        />
      ) : (
        <p className="rounded border border-border bg-surface-2/30 px-2 py-1 text-[10px] text-text-dim">
          {fillPc(tpc("trainingConsolidatedNoteTemplate"), {
            mode: hasManualAllocation ? tpc("manualTrainingLabel") : tpc("followsPolicyLabel"),
            used: String(points.usedPoints),
            total: String(points.totalPoints),
          })}
        </p>
      )}

      {/* ポジション適性（総合値は計算規則未確認のため「—」） */}
      <details className="rounded border border-border bg-surface-2/30 p-1.5 text-[10px]">
        <summary className="cursor-pointer font-semibold text-text-dim">{tpc("positionFitSummary")}</summary>
        <p className="mt-1">
          {tpc("registeredPositionLabel")}
          <b className="text-accent">{d.registeredPosition ?? "—"}</b>
        </p>
        <p className="mt-1 text-text-muted">
          {tpc("currentOverallLabel")}
          <b>{tpc("currentOverallValue")}</b>
          {tpc("currentOverallNote")}
        </p>
        <p className="mt-1 text-text-muted">{tpc("overallExplanation")}</p>
      </details>

      {/* 選手ブースター */}
      <div className="rounded border border-border bg-surface-2/30 p-1.5 text-xs">
        {attachedBoosters.length > 0 ? (
          <ul className="mb-1 flex flex-col gap-0.5">
            {attachedBoosters.map((r) => (
              <li key={r.slot} className="flex flex-wrap items-center gap-1 text-[10px]">
                <span className="text-text-dim">{fillPc(tpc("attachedBoosterPrefixTemplate"), { slot: String(r.slot) })}</span>
                <span className="font-semibold">
                  {r.nameJa ?? r.nameEn} +{r.level}
                </span>
                <span className={r.appliesInStandard ? "text-info" : "text-warning"}>
                  {r.activation === "power_of_many"
                    ? tpc("powerOfManyNote")
                    : r.evidenceLevel === "game_client_verified" || r.evidenceLevel === "screenshot_verified"
                      ? fillPc(tpc("verifiedScreenshotNoteTemplate"), {
                          fixedSuffix: r.activationConfirmed === false ? tpc("fixedEstimateSuffix") : "",
                        })
                      : r.evidenceLevel === "external_cross_verified"
                        ? fillPc(tpc("externalCrossVerifiedNoteTemplate"), {
                            fixedSuffix: r.activationConfirmed === false ? tpc("fixedEstimateSuffix") : "",
                          })
                        : tpc("underVerificationNote")}
                </span>
                {r.activation === "power_of_many" ? (
                  <div className="w-full">
                    <ConditionalBoosterControl
                      boosterId={r.boosterId}
                      nameEn={r.nameEn}
                      nameJa={r.nameJa}
                      level={r.level}
                      affectedStats={r.affectedStats}
                      selection={condSelByKey.get(r.boosterKey) ?? "none"}
                      onChange={(sel) => setConditional(r.boosterKey, sel)}
                      compact
                      idPrefix={`cmp-${d.worldCardId}-${r.slot}`}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <label className="block text-[10px] text-text-dim">
          {tpc("additionalBoosterPrefix")}
          <span className="text-info">{tpc("additionalBoosterHighlight")}</span>
          {tpc("additionalBoosterSuffix")}
        </label>
        <div className="mt-1 flex gap-1">
          <select
            value={booster?.boosterKey ?? ""}
            onChange={(e) => setBooster(e.target.value || null)}
            aria-label={fillPc(tpc("additionalBoosterAriaTemplate"), { name })}
            className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-1 text-xs"
          >
            <option value="">{tpc("noneOption")}</option>
            {CONFIRMED_BOOSTERS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.nameEn}
              </option>
            ))}
          </select>
          {boosterDef ? (
            <select
              value={booster?.level ?? 1}
              onChange={(e) => setBooster(booster!.boosterKey, Number(e.target.value))}
              aria-label={fillPc(tpc("boosterLevelAriaTemplate"), { name })}
              className="rounded border border-border bg-surface px-1 py-1 text-xs"
            >
              {Array.from({ length: boosterDef.maxLevel }, (_, i) => i + 1).map((lv) => (
                <option key={lv} value={lv}>
                  +{lv}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <p className="mt-0.5 text-[9px] text-text-muted">
          {tpc("boosterFootnotePrefix")}
          <b>{tpc("boosterFootnoteHighlight")}</b>
          {tpc("boosterFootnoteSuffix")}
        </p>
      </div>

      {/* 監督 */}
      <div className="rounded border border-border bg-surface-2/30 p-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-dim">{tpc("managerLabel")}</span>
          {player.manager?.internalManagerId ? (
            <button type="button" onClick={() => onManager(null)} className="text-[10px] text-danger hover:opacity-80">
              {tpc("managerClearButton")}
            </button>
          ) : null}
        </div>
        {player.manager?.internalManagerId ? (
          <p className="truncate font-semibold text-accent" title={player.manager.managerName ?? ""}>
            {player.manager.managerName}
          </p>
        ) : (
          <p className="text-text-dim">{tpc("noManagerLabel")}</p>
        )}
        <button
          type="button"
          onClick={onOpenManagerPicker}
          className="mt-1 w-full rounded border border-border bg-surface px-1 py-0.5 text-[11px] hover:border-accent"
        >
          {player.manager?.internalManagerId ? tpc("managerChangeButton") : tpc("managerChooseButton")}
        </button>
      </div>
    </div>
  );
}
