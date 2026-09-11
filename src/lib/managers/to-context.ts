import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import type { ManagerContext } from "@/lib/progression/types";
import type { ManagerDetail } from "./types";

/**
 * 監督詳細 → 育成エンジンの ManagerContext。
 * ブースター効果の対象能力が World キーへ変換でき、confirmation_status が confirmed のものだけ
 * 実際に適用される（calculate-manager-booster.ts）。
 */
export function managerToContext(m: ManagerDetail): ManagerContext {
  const effects = m.boosters.map((b) => ({
    statKey: b.statKey,
    statNameEn: b.statNameEn,
    delta: b.delta,
    confirmationStatus: b.confirmationStatus,
  }));
  const allConfirmed =
    effects.length > 0 && effects.every((e) => e.confirmationStatus === "confirmed" && e.statKey);

  return {
    internalManagerId: m.internalManagerId,
    sourceManagerId: m.sourceManagerId,
    managerName: m.nameEn,
    boosterEffects: effects,
    tacticalProficiencies: {
      possessionGame: m.proficiencies.possessionGame,
      quickCounter: m.proficiencies.quickCounter,
      longBallCounter: m.proficiencies.longBallCounter,
      outWide: m.proficiencies.outWide,
      longBall: m.proficiencies.longBall,
      overload: m.proficiencies.overload,
    },
    applicationCondition: null,
    ruleVersion: PROGRESSION_RULES_VERSION,
    confirmationStatus: allConfirmed ? "confirmed" : effects.length > 0 ? "provisional" : "unresolved",
  };
}
