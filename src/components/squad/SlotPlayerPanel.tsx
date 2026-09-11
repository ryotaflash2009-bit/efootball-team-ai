"use client";

import Link from "next/link";
import type {
  SavedBuild,
  SelectedPlayerBooster,
  SelectedConditionalBooster,
  ConditionalBoosterSelection,
} from "@/lib/progression/types";
import type { SquadSlotResult, SquadBuildMode } from "@/lib/squad/types";
import { SQUAD_BUILD_MODES } from "@/lib/squad/types";
import { BOOSTER_CATALOG, getBoosterDef } from "@/lib/progression/booster-catalog";
import { ConditionalBoosterControl } from "@/components/world/progression/ConditionalBoosterControl";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

const CONFIRMED_BOOSTERS = BOOSTER_CATALOG.filter((b) => b.confirmationStatus === "confirmed");

const COMPAT_CLASS: Record<string, string> = {
  exact: "text-accent",
  related: "text-yellow-300",
  unresolved: "text-yellow-300",
  gkMismatch: "text-danger",
  empty: "text-text-dim",
};

function useBuildModeLabels(): Record<SquadBuildMode, string> {
  const t = useT();
  return {
    none: t("bench", "modeNone"),
    attack: t("bench", "modeAttack"),
    defense: t("bench", "modeDefense"),
    balance: t("bench", "modeBalance"),
    gk: t("bench", "modeGk"),
  };
}

export function SlotPlayerPanel({
  slot,
  savedBuilds,
  savedBuildId,
  inCompare,
  compareFull,
  moveArmed,
  placement,
  placementRoles,
  posAdjustActive,
  onAddPlayer,
  onRemove,
  onMoveToBench,
  onBuildMode,
  onSavedBuild,
  onOpenBuildPanel,
  onToggleCaptain,
  onStartMove,
  onCancelMove,
  onStartPosAdjust,
  onRoleOverride,
  onToggleCompare,
  onBoosters,
  onConditionalBoosters,
}: {
  slot: SquadSlotResult;
  savedBuilds: SavedBuild[];
  /** この枠に現在保存されている savedBuildId（StoredSlot 由来・削除済み参照の検出に使う）。 */
  savedBuildId: string | null;
  inCompare: boolean;
  compareFull: boolean;
  moveArmed: boolean;
  /** 自由配置の座標・自動判定ロール・手動上書き。 */
  placement?: { x: number; y: number; inferredRole: string; roleOverride: string | null; role: string };
  placementRoles: readonly string[];
  posAdjustActive: boolean;
  onAddPlayer: () => void;
  onRemove: () => void;
  onMoveToBench: () => void;
  onBuildMode: (mode: SquadBuildMode) => void;
  onSavedBuild: (buildId: string | null) => void;
  /** 「保存ビルドを選ぶ」パネルを開く。 */
  onOpenBuildPanel: () => void;
  onToggleCaptain: () => void;
  onStartMove: () => void;
  onCancelMove: () => void;
  onStartPosAdjust: () => void;
  onRoleOverride: (role: string | null) => void;
  onToggleCompare: () => void;
  onBoosters: (next: SelectedPlayerBooster[]) => void;
  onConditionalBoosters: (next: SelectedConditionalBooster[]) => void;
}) {
  const t = useT();
  const tsp = (k: keyof Dictionary["slotPlayerPanel"]) => t("slotPlayerPanel", k);
  const fillSp = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const buildModeLabels = useBuildModeLabels();
  const e = slot.entry;
  const condSelByKey = new Map((e?.selectedConditionalBoosters ?? []).map((c) => [c.boosterKey, c.selection]));
  function setConditional(boosterKey: string, sel: ConditionalBoosterSelection) {
    const rest = (e?.selectedConditionalBoosters ?? []).filter((c) => c.boosterKey !== boosterKey);
    onConditionalBoosters(sel === "none" ? rest : [...rest, { boosterKey, selection: sel }]);
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {slot.position} <span className="text-xs font-normal text-text-dim">{tsp("slotSuffix")}</span>
        </h3>
        {moveArmed ? (
          <button type="button" onClick={onCancelMove} className="rounded border border-accent px-2 py-0.5 text-xs text-accent">
            {tsp("movingCancelButton")}
          </button>
        ) : null}
      </div>

      {!e ? (
        <div className="mt-2">
          <p className="text-xs text-text-dim">{tsp("emptySlotNote")}</p>
          <button
            type="button"
            onClick={onAddPlayer}
            className="mt-2 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm hover:border-accent"
          >
            {tsp("addPlayerButton")}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <p className="font-semibold">
              {e.display.nameJa ||
                e.display.nameEn ||
                fillSp(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: e.display.worldCardId })}
            </p>
            <p className="text-[11px] text-text-dim">
              {e.display.nameEn} · {e.display.registeredPosition ?? "?"} · {e.display.cardType ?? "?"} · ID {e.display.worldCardId}
            </p>
          </div>

          {/* 配置ロール（座標から自動判定）と 選手適性（カード本来のデータ）は別物 */}
          <div className="rounded border border-border/60 bg-surface-2/30 p-2 text-xs">
            <p>
              {tsp("placementRoleLabel")}
              <span className="font-bold text-accent">{slot.position}</span>
              {placement && placement.roleOverride ? (
                <span className="ml-1 text-[10px] text-text-dim">
                  {fillSp(tsp("autoInferredTemplate"), { role: placement.inferredRole })}
                </span>
              ) : null}
            </p>
            <p className={`mt-0.5 ${COMPAT_CLASS[slot.compatibility.status] ?? "text-text-dim"}`}>
              {fillSp(tsp("suitabilityLabelTemplate"), {
                label: slot.compatibility.label,
                position: slot.compatibility.registeredPosition ?? "?",
              })}
            </p>
            {slot.compatibility.note ? (
              <p className="text-[10px] text-text-dim/80">{slot.compatibility.note}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onStartPosAdjust}
                className={`rounded border px-2 py-0.5 text-[11px] ${
                  posAdjustActive ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent"
                }`}
              >
                {tsp("adjustPositionButton")}
              </button>
              <label className="flex items-center gap-1 text-[11px] text-text-dim">
                {tsp("roleLabel")}
                <select
                  value={placement?.roleOverride ?? ""}
                  onChange={(ev) => onRoleOverride(ev.target.value || null)}
                  aria-label={fillSp(tsp("roleAriaLabelTemplate"), { position: slot.position })}
                  className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]"
                >
                  <option value="">{fillSp(tsp("autoRoleOptionTemplate"), { role: placement?.inferredRole ?? slot.position })}</option>
                  {placementRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* OVR / デルタ */}
          <div className="rounded border border-border/60 bg-surface-2/30 p-2 text-xs">
            <p>
              {fillSp(tsp("baseToDisplayedOvrPrefixTemplate"), { base: String(e.baseOvr ?? "–") })}
              <span className="font-bold text-accent">{e.displayedOvr ?? "–"}</span>
              <span className="ml-1 text-[10px] text-text-dim">{tsp("estimateNote")}</span>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
              <span>{fillSp(tsp("progressionDeltaTemplate"), { delta: fmt(e.progressionDelta) })}</span>
              <span>{fillSp(tsp("playerBoosterDeltaTemplate"), { delta: fmt(e.playerBoosterDelta) })}</span>
              <span>{fillSp(tsp("managerDeltaTemplate"), { delta: fmt(e.managerBoosterDelta) })}</span>
            </p>
            {!e.canProgress ? <p className="mt-1 text-[10px] text-text-dim">{tsp("cannotProgressNote")}</p> : null}
          </div>

          {/* 選手ブースター（このカード固有） */}
          <div>
            {e.result.playerBoosters.filter((b) => b.boosterNameEn).length > 0 ? (
              <ul className="mb-1 flex flex-col gap-0.5 text-[10px]">
                {e.result.playerBoosters
                  .filter((b) => b.boosterNameEn)
                  .map((b) => (
                    <li key={b.slot} className="flex flex-wrap items-center gap-1">
                      <span className="text-text-dim">{fillSp(tsp("attachedBoosterSlotTemplate"), { slot: String(b.slot) })}</span>
                      <span className="font-semibold">
                        {b.boosterNameJa ?? b.boosterNameEn} +{b.level}
                      </span>
                      <span className={b.autoApplied ? "text-info" : "text-warning"}>
                        {b.activationType === "power_of_many"
                          ? tsp("powerOfManyNote")
                          : b.evidenceLevel === "game_client_verified" || b.evidenceLevel === "screenshot_verified"
                            ? fillSp(tsp("verifiedScreenTemplate"), {
                                fixedNote: b.activationConfirmed === false ? tsp("fixedTypeEstimateSuffix") : "",
                              })
                            : b.evidenceLevel === "external_cross_verified"
                              ? fillSp(tsp("externalVerifiedTemplate"), {
                                  fixedNote: b.activationConfirmed === false ? tsp("fixedTypeEstimateSuffix") : "",
                                })
                              : tsp("underVerificationNote")}
                      </span>
                      {b.evidenceLevel === "conditional_unverified" && b.conditionText ? (
                        <span className="w-full text-[9px] text-warning/80">{b.conditionText}</span>
                      ) : null}
                      {b.manualConditional && b.boosterKey ? (
                        <div className="w-full">
                          <ConditionalBoosterControl
                            boosterId={b.boosterId}
                            nameEn={b.boosterNameEn}
                            nameJa={b.boosterNameJa}
                            level={b.level}
                            affectedStats={b.affectedStats}
                            selection={condSelByKey.get(b.boosterKey) ?? "none"}
                            onChange={(sel) => setConditional(b.boosterKey!, sel)}
                            compact
                            idPrefix={`sq-${slot.slotId}-${b.slot}`}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
              </ul>
            ) : null}
            <label className="block text-[11px] text-text-dim">
              {tsp("experimentalBoosterPrefix")}
              <span className="text-yellow-300/80">{tsp("experimentalBoosterTeamNote")}</span>
              {tsp("experimentalBoosterSuffix")}
            </label>
            <div className="mt-1 flex gap-1">
              <select
                value={e.selectedPlayerBoosters[0]?.boosterKey ?? ""}
                onChange={(ev) => {
                  const k = ev.target.value;
                  if (!k) return onBoosters([]);
                  const def = getBoosterDef(k);
                  const lv = Math.min(def?.maxLevel ?? 5, e.selectedPlayerBoosters[0]?.level ?? 1);
                  onBoosters([{ slot: 1, boosterKey: k, level: lv }]);
                }}
                aria-label={fillSp(tsp("boosterSlotAriaTemplate"), { position: slot.position })}
                className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-1 text-xs"
              >
                <option value="">{tsp("noBoosterOption")}</option>
                {CONFIRMED_BOOSTERS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.nameEn}
                  </option>
                ))}
              </select>
              {e.selectedPlayerBoosters[0] ? (
                <select
                  value={e.selectedPlayerBoosters[0].level}
                  onChange={(ev) => onBoosters([{ slot: 1, boosterKey: e.selectedPlayerBoosters[0].boosterKey, level: Number(ev.target.value) }])}
                  aria-label={fillSp(tsp("boosterLevelAriaTemplate"), { position: slot.position })}
                  className="rounded border border-border bg-surface px-1 py-1 text-xs"
                >
                  {Array.from({ length: getBoosterDef(e.selectedPlayerBoosters[0].boosterKey)?.maxLevel ?? 5 }, (_, i) => i + 1).map((lv) => (
                    <option key={lv} value={lv}>
                      +{lv}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <p className="mt-0.5 text-[10px] text-text-dim/80">{tsp("boosterIdMismatchNote")}</p>
          </div>

          {/* 育成ビルド */}
          <label className="block text-[11px] text-text-dim">
            {tsp("progressionPolicyLabel")}
            <select
              value={e.savedBuildName != null ? "__saved__" : e.buildMode}
              onChange={(ev) => {
                if (ev.target.value === "__saved__") return;
                onSavedBuild(null);
                onBuildMode(ev.target.value as SquadBuildMode);
              }}
              aria-label={fillSp(tsp("buildModeAriaTemplate"), { position: slot.position })}
              className="mt-1 w-full rounded border border-border bg-surface px-1 py-1 text-xs"
            >
              {SQUAD_BUILD_MODES.map((m) => (
                <option key={m} value={m}>
                  {buildModeLabels[m]}
                </option>
              ))}
              {e.savedBuildName != null ? (
                <option value="__saved__">{fillSp(tsp("savedBuildOptionTemplate"), { name: e.savedBuildName })}</option>
              ) : null}
            </select>
          </label>
          {savedBuilds.length > 0 ? (
            <select
              value=""
              onChange={(ev) => ev.target.value && onSavedBuild(ev.target.value)}
              aria-label={fillSp(tsp("savedBuildAriaTemplate"), { position: slot.position })}
              className="w-full rounded border border-border bg-surface px-1 py-1 text-xs"
            >
              <option value="">{tsp("applySavedBuildOption")}</option>
              {savedBuilds.map((b) => (
                <option key={b.buildId} value={b.buildId}>
                  {b.buildName}
                  {b.rulesVersion !== e.result.rulesVersion ? tsp("legacyRuleSuffix") : ""}
                </option>
              ))}
            </select>
          ) : null}
          {/* スカッド用ビルド（この枠の savedBuildId・My Team とは別系統） */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-text-dim">
              {tsp("squadBuildLabel")}{" "}
              {savedBuildId == null ? (
                <span className="text-text-muted">{tsp("notSetLabel")}</span>
              ) : e.savedBuildName != null ? (
                <span className="text-accent">{e.savedBuildName}</span>
              ) : (
                <span className="text-yellow-300">{tsp("notFoundDeletedLabel")}</span>
              )}
            </span>
            <button
              type="button"
              onClick={onOpenBuildPanel}
              className="inline-flex min-h-[36px] items-center gap-1 rounded border border-border px-2 font-semibold hover:border-accent"
            >
              {tsp("chooseSavedBuildButton")}
            </button>
          </div>
          {e.staleBuild ? (
            <p className="text-[10px] text-yellow-300">{tsp("staleBuildNote")}</p>
          ) : null}

          {/* 主要操作: 移動・交代 / ベンチへ / 外す */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onStartMove}
              className={`rounded border px-2 py-1 text-xs font-semibold ${
                moveArmed ? "border-accent bg-accent-soft text-accent" : "border-accent text-accent hover:bg-accent/10"
              }`}
            >
              {tsp("moveSwapButton")}
            </button>
            <button type="button" onClick={onMoveToBench} className="rounded border border-border px-2 py-1 text-xs hover:border-accent">
              {tsp("moveToBenchButton")}
            </button>
            <button type="button" onClick={onRemove} className="rounded border border-border px-2 py-1 text-xs text-danger hover:opacity-80">
              {tsp("removeFromSlotButton")}
            </button>
          </div>

          {/* その他 */}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={onToggleCaptain} className="rounded border border-border px-2 py-1 text-xs hover:border-accent">
              {slot.isCaptain ? tsp("clearCaptainButton") : tsp("setCaptainButton")}
            </button>
            <button
              type="button"
              onClick={onToggleCompare}
              disabled={!inCompare && compareFull}
              className={`rounded border px-2 py-1 text-xs ${
                inCompare ? "border-accent text-accent" : "border-border hover:border-accent"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {inCompare
                ? t("compareAddButton", "inCompareCheckedLabel")
                : compareFull
                  ? tsp("compareFullLabel")
                  : t("compareAddButton", "addToCompareLabel")}
            </button>
            <Link
              href={`/players/world/${encodeURIComponent(e.display.worldCardId)}`}
              className="rounded border border-border px-2 py-1 text-xs text-accent hover:border-accent"
            >
              {tsp("playerDetailLink")}
            </Link>
            <Link
              href={`/players/world/${encodeURIComponent(e.display.worldCardId)}?tab=progression`}
              className="rounded border border-border px-2 py-1 text-xs text-accent hover:border-accent"
            >
              {tsp("progressionLinkLabel")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
