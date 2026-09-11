import { calculateBuild } from "@/lib/progression/engine";
import { estimateOvr } from "@/lib/progression/calculate-rating";
import { resolveAllocation } from "@/lib/progression/resolve-allocation";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import type { ManagerContext } from "@/lib/progression/types";
import type { LinkUpPlay } from "@/lib/managers/types";
import { getFormation } from "./formations";
import { evaluateCompatibility, emptyCompatibility, roleOfPosition } from "./position";
import { evaluateLinkUpPlays, LINK_UP_NOTICE, type LinkUpPlayer } from "./link-up";
import { buildTeamSummary } from "./team-summary";
import type {
  SquadComputed,
  SquadEntryInput,
  SquadSlotResult,
  SquadSubResult,
  StoredLinkUp,
} from "./types";

export interface BuildSquadInput {
  formationId: string;
  /** slotId → 選手（未配置は含めない or null） */
  entries: Record<string, SquadEntryInput | null>;
  substitutes: { subId: string; entry: SquadEntryInput }[];
  manager: ManagerContext | null;
  managerLinkUpPlays: LinkUpPlay[] | null;
  captainSlotId: string | null;
  linkUpSelection: StoredLinkUp;
  /** 保存時の rulesVersion（なければ現行扱い） */
  savedRulesVersion?: string | null;
  /**
   * 自由配置: slotId → { x, y, role }。role は座標から判定済みの effectiveRole（内部コード）。
   * 指定があればその slot の position / x / y / role をこれで上書きする。
   */
  slotPlacements?: Record<string, { x: number; y: number; role: string }>;
}

function computeEntry(input: SquadEntryInput, manager: ManagerContext | null) {
  const allocation = resolveAllocation(input.card, input.buildMode, input.savedAllocation);
  const selectedConditionalBoosters = input.selectedConditionalBoosters ?? [];
  const result = calculateBuild({
    card: input.card,
    allocation,
    manager,
    selectedPlayerBoosters: input.selectedPlayerBoosters ?? [],
    selectedConditionalBoosters,
  });
  const sum = (pick: (b: (typeof result.stats)[number]) => number) =>
    result.stats.reduce((acc, b) => acc + pick(b), 0);
  const staleBuild =
    input.savedAllocation != null &&
    input.savedBuildRulesVersion != null &&
    input.savedBuildRulesVersion !== PROGRESSION_RULES_VERSION;
  const hasConditionalSelection = result.booster.hasConditionalSelection;
  const conditionalDisplayedOvr = hasConditionalSelection
    ? estimateOvr(
        result.stats.map((s) => ({ ...s, finalValue: s.conditionalFinalValue })),
        input.display.registeredPosition,
      )
    : result.rating.estimatedOvr;
  return {
    display: input.display,
    buildMode: input.buildMode,
    savedBuildName: input.savedBuildName,
    selectedPlayerBoosters: input.selectedPlayerBoosters ?? [],
    selectedConditionalBoosters,
    result,
    baseOvr: input.display.ovrBase,
    displayedOvr: result.rating.estimatedOvr,
    progressionDelta: sum((b) => b.progressionDelta),
    playerBoosterDelta: sum((b) => b.playerBoosterDelta),
    managerBoosterDelta: sum((b) => b.managerBoosterDelta),
    conditionalDelta: sum((b) => b.conditionalBoosterDelta),
    conditionalDisplayedOvr,
    hasConditionalSelection,
    eligibilityStatus: "confirmed" as const,
    canProgress: result.eligibility.canProgress,
    warnings: result.warnings,
    staleBuild,
  };
}

export function buildSquad(input: BuildSquadInput): SquadComputed {
  const formation = getFormation(input.formationId);
  const manager = input.manager;

  const slots: SquadSlotResult[] = formation.slots.map((fs) => {
    const placement = input.slotPlacements?.[fs.slotId];
    const position = placement?.role ?? fs.position;
    const role = roleOfPosition(position) ?? fs.role;
    const x = placement?.x ?? fs.x;
    const y = placement?.y ?? fs.y;
    const entryInput = input.entries[fs.slotId] ?? null;
    const isCaptain = input.captainSlotId === fs.slotId && entryInput != null;
    if (!entryInput) {
      return {
        slotId: fs.slotId,
        position,
        role,
        x,
        y,
        isCaptain: false,
        entry: null,
        compatibility: emptyCompatibility(position),
      };
    }
    return {
      slotId: fs.slotId,
      position,
      role,
      x,
      y,
      isCaptain,
      entry: computeEntry(entryInput, manager),
      compatibility: evaluateCompatibility(entryInput.display.registeredPosition, position),
    };
  });

  const substitutes: SquadSubResult[] = input.substitutes.map(({ subId, entry }) => {
    const c = computeEntry(entry, manager);
    return {
      subId,
      display: c.display,
      buildMode: c.buildMode,
      savedBuildName: c.savedBuildName,
      result: c.result,
      baseOvr: c.baseOvr,
      displayedOvr: c.displayedOvr,
      progressionDelta: c.progressionDelta,
      playerBoosterDelta: c.playerBoosterDelta,
      managerBoosterDelta: c.managerBoosterDelta,
      staleBuild: c.staleBuild,
    };
  });

  // Link-Up Play（照合のみ）
  const linkUpPlayers: LinkUpPlayer[] = slots
    .filter((s) => s.entry != null)
    .map((s) => ({
      slotId: s.slotId,
      assignedPosition: s.position,
      registeredPosition: s.entry!.display.registeredPosition,
      playingStyle: s.entry!.display.playingStyle,
    }));
  const linkUps = evaluateLinkUpPlays(input.managerLinkUpPlays, linkUpPlayers, input.linkUpSelection);

  // 警告の集約
  const warnings: string[] = [];
  const wset = new Set<string>();
  const push = (w: string) => {
    if (!wset.has(w)) {
      wset.add(w);
      warnings.push(w);
    }
  };
  for (const s of slots) {
    if (!s.entry) continue;
    if (s.entry.staleBuild) {
      push(`${s.entry.display.nameJa || s.entry.display.nameEn || s.slotId}: 保存ビルドが旧規則で作成されています（現行規則で再計算しています。配分の解釈が変わる場合があります）。`);
    }
    if (s.compatibility.status === "gkMismatch") {
      push(`${s.entry.display.nameJa || s.entry.display.nameEn || s.slotId}: ${s.position} は不適性の可能性があります（能力値は下げていません）。`);
    }
  }
  const filledCount = slots.filter((s) => s.entry != null).length;
  if (filledCount < 11) push(`先発が ${filledCount}/11 人です。`);

  const rulesOutdated =
    input.savedRulesVersion != null && input.savedRulesVersion !== PROGRESSION_RULES_VERSION;
  if (rulesOutdated) {
    push("このスカッドは旧い規則バージョンで保存されています。現行規則で再計算して表示しています。");
  }

  push("カテゴリ平均・チーム評価は単純計算です（eFootball の公式チームパワー・カテゴリ重みとは異なります）。");
  push("監督ブースターの適用順序（育成前 / 育成後）は未確認です。");

  const teamSummary = buildTeamSummary(slots, substitutes, warnings.length);

  const hasAnyConditionalSelection = slots.some((s) => s.entry?.hasConditionalSelection);
  const conditionalTeamSummary = hasAnyConditionalSelection
    ? buildTeamSummary(slots, substitutes, warnings.length, {
        statValue: (st) => st.conditionalFinalValue,
        ovrValue: (e) => e.conditionalDisplayedOvr,
      })
    : null;

  return {
    formation,
    slots,
    substitutes,
    manager: {
      context: manager,
      applied: !!manager && manager.confirmationStatus === "confirmed",
      note: !manager
        ? "監督は未選択（managerBoosterDelta = 0）。"
        : manager.confirmationStatus === "confirmed"
          ? `監督「${manager.managerName ?? "?"}」の確認済みブースターを全選手へ適用しています。`
          : `監督「${manager.managerName ?? "?"}」のブースター効果は未確認のため適用していません（表示のみ）。`,
    },
    teamSummary,
    conditionalTeamSummary,
    hasAnyConditionalSelection,
    linkUps,
    linkUpNotice: LINK_UP_NOTICE,
    warnings,
    rulesVersion: PROGRESSION_RULES_VERSION,
    rulesOutdated,
  };
}
