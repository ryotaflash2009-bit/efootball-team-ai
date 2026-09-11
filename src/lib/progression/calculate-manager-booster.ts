import { PROGRESSION_RULES_VERSION } from "./constants";
import type { ManagerBoosterReason, ManagerContext, ProgressionCard } from "./types";

/**
 * 監督補正のレイヤー。
 *
 * 適用条件: 監督ブースターの「対象能力 + 上昇量」を複数の公開データで確認できた場合のみ適用する。
 *   確認状態は ManagerContext.confirmationStatus / boosterEffects[].confirmationStatus に反映される。
 *   （amine250 managers.json + コミュニティソース照合 + eFHUB RSC `"{stat} +1"` 形式 → confirmed）
 *
 * 適用順序（育成前/後）は未確認のため、engine は「基礎 → 育成 → 選手ブースター → 監督 → その他 → 上限」
 * の固定加算で扱う。判明したら差し替え可能。
 *
 * 監督補正・選手ブースター・育成は別レイヤー（managerBoosterDelta / playerBoosterDelta / progressionDelta）
 * として保持し、同じ delta へ混ぜない。
 */

export interface ManagerBoosterResult {
  applied: boolean;
  deltas: Record<string, number>;
  reasons: ManagerBoosterReason[];
  managerName: string | null;
  note: string;
}

export function emptyManagerContext(): ManagerContext {
  return {
    internalManagerId: null,
    sourceManagerId: null,
    managerName: null,
    boosterEffects: [],
    tacticalProficiencies: null,
    applicationCondition: null,
    ruleVersion: PROGRESSION_RULES_VERSION,
    confirmationStatus: "unresolved",
  };
}

export function calculateManagerBooster(
  card: ProgressionCard,
  manager?: ManagerContext | null,
): ManagerBoosterResult {
  void card;
  if (!manager || !manager.internalManagerId) {
    return { applied: false, deltas: {}, reasons: [], managerName: null, note: "監督は未選択。" };
  }

  const deltas: Record<string, number> = {};
  const reasons: ManagerBoosterReason[] = [];
  let anyUnconfirmed = false;

  for (const eff of manager.boosterEffects) {
    if (eff.confirmationStatus !== "confirmed" || !eff.statKey) {
      anyUnconfirmed = true;
      continue;
    }
    const d = Math.trunc(eff.delta);
    if (d === 0) continue;
    deltas[eff.statKey] = (deltas[eff.statKey] ?? 0) + d;
    reasons.push({
      statKey: eff.statKey,
      statNameEn: eff.statNameEn,
      delta: d,
      managerName: manager.managerName,
    });
  }

  const applied = reasons.length > 0;
  let note: string;
  if (applied && !anyUnconfirmed) {
    note = `監督「${manager.managerName ?? "?"}」のブースターを適用しました（対象能力へ +N・複数ソースで確認済み）。`;
  } else if (applied && anyUnconfirmed) {
    note = `監督「${manager.managerName ?? "?"}」の一部ブースターのみ適用（未確認の効果は適用していません）。`;
  } else {
    note = `監督「${manager.managerName ?? "?"}」のブースター効果は未確認のため適用していません。`;
  }

  return { applied, deltas, reasons, managerName: manager.managerName ?? null, note };
}
