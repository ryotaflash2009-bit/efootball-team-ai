import { describe, it, expect } from "vitest";
import { buildComparison } from "./build-comparison";
import type { ComparisonPlayerInput } from "./types";
import type { ProgressionCard, ManagerContext } from "@/lib/progression/types";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK, NEAR_CAP_CARD } from "@/lib/progression/fixtures";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import { calculateBuild } from "@/lib/progression/engine";
import { adjustGroupLevel } from "@/lib/progression/group-allocation";

function input(
  card: ProgressionCard,
  opts: Partial<
    Pick<
      ComparisonPlayerInput,
      | "buildMode"
      | "savedAllocation"
      | "manager"
      | "selectedPlayerBoosters"
      | "selectedConditionalBoosters"
      | "applyProvisionalBoosters"
      | "experimentalModeEnabled"
    >
  > & {
    skills?: string[];
    ai?: string[];
  } = {},
): ComparisonPlayerInput {
  return {
    card,
    display: {
      worldCardId: card.worldCardId,
      nameEn: card.nameEn,
      nameJa: card.nameJa,
      cardType: card.cardType,
      registeredPosition: card.registeredPosition,
      playingStyle: null,
      playingStyleDefensive: null,
      nationality: null,
      region: null,
      league: null,
      team: null,
      age: null,
      height: null,
      weight: null,
      preferredFoot: null,
      ovrBase: card.ovrBase,
      ovrMax: card.ovrMax,
      maximumLevel: card.maximumLevel,
      hasEfhubLink: false,
      efhubCardId: null,
      imageUrlCandidate: null,
      mobileImageUrlCandidate: null,
      playerSkills: opts.skills ?? [],
      aiStyles: opts.ai ?? [],
    },
    buildMode: opts.buildMode ?? "none",
    savedAllocation: opts.savedAllocation ?? null,
    savedBuildName: null,
    manager: opts.manager ?? null,
    selectedPlayerBoosters: opts.selectedPlayerBoosters,
    selectedConditionalBoosters: opts.selectedConditionalBoosters,
    applyProvisionalBoosters: opts.applyProvisionalBoosters,
    experimentalModeEnabled: opts.experimentalModeEnabled,
  };
}

const conteManager: ManagerContext = {
  internalManagerId: 42,
  sourceManagerId: "conte",
  managerName: "Antonio Conte",
  boosterEffects: [
    { statKey: "defensiveAwareness", statNameEn: "Defensive Awareness", delta: 1, confirmationStatus: "confirmed" },
    { statKey: "kickingPower", statNameEn: "Kicking Power", delta: 1, confirmationStatus: "confirmed" },
  ],
  tacticalProficiencies: null,
  applicationCondition: null,
  ruleVersion: PROGRESSION_RULES_VERSION,
  confirmationStatus: "confirmed",
};
const unconfirmedManager: ManagerContext = {
  ...conteManager,
  internalManagerId: 7,
  managerName: "Unknown",
  boosterEffects: [{ statKey: "finishing", statNameEn: "Finishing", delta: 1, confirmationStatus: "provisional" }],
  confirmationStatus: "provisional",
};

describe("buildComparison: 人数", () => {
  it("2人", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    expect(c.players).toHaveLength(2);
    expect(c.stats).toHaveLength(26);
    expect(c.stats[0].perPlayer).toHaveLength(2);
  });
  it("3人・4人", () => {
    expect(buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC), input(NEUER_GK)]).players).toHaveLength(3);
    expect(
      buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC), input(NEUER_GK), input(NEAR_CAP_CARD)]).players,
    ).toHaveLength(4);
  });
});

describe("buildComparison: 能力値の差分・最高/最低", () => {
  it("最終値の最大がハイライト対象・spread が正しい", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    const dribbling = c.stats.find((s) => s.key === "dribbling")!;
    // Messi 87 vs Cannavaro 62
    expect(dribbling.perPlayer[0].finalValue).toBe(87);
    expect(dribbling.perPlayer[1].finalValue).toBe(62);
    expect(dribbling.highestPlayerIdx).toEqual([0]);
    expect(dribbling.lowestPlayerIdx).toEqual([1]);
    expect(dribbling.spread).toBe(25);
  });
  it("同値なら両方 highest かつ lowest・spread 0", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(MESSI_BIGTIME)]);
    const s = c.stats[0];
    expect(s.spread).toBe(0);
    expect(s.highestPlayerIdx).toEqual([0, 1]);
  });
});

describe("buildComparison: 育成の反映（エンジン再利用）", () => {
  it("育成方針を適用すると対象能力の育成デルタが載る・基礎のみは0", () => {
    const none = buildComparison([input(MESSI_BIGTIME)]);
    const atk = buildComparison([input(MESSI_BIGTIME, { buildMode: "attack" })]);
    const finNone = none.stats.find((s) => s.key === "finishing")!.perPlayer[0];
    const finAtk = atk.stats.find((s) => s.key === "finishing")!.perPlayer[0];
    expect(finNone.progressionDelta).toBe(0);
    expect(finAtk.progressionDelta).toBeGreaterThan(0);
  });
  it("savedAllocation が buildMode より優先", () => {
    const c = buildComparison([input(MESSI_BIGTIME, { buildMode: "attack", savedAllocation: { shooting: 2 } })]);
    const fin = c.stats.find((s) => s.key === "finishing")!.perPlayer[0];
    expect(fin.progressionDelta).toBe(2); // shooting 2 → finishing +2（attack ではない）
  });
  it("個別に異なる育成を適用できる", () => {
    const c = buildComparison([
      input(MESSI_BIGTIME, { buildMode: "attack" }),
      input(CANNAVARO_EPIC, { buildMode: "defense" }),
    ]);
    const p0Off = c.categories.find((x) => x.category === "攻撃")!.totalByPlayer[0];
    const p1Def = c.categories.find((x) => x.category === "守備")!.totalByPlayer[1];
    expect(p0Off).toBeGreaterThan(0);
    expect(p1Def).toBeGreaterThan(0);
  });

  it("比較列内で adjustGroupLevel した配分は、選手詳細（calculateBuild 直接）と 26 能力値が一致する", () => {
    // 比較画面のスライダー操作と同じ経路: adjustGroupLevel を積む
    let alloc: Record<string, number> = {};
    alloc = adjustGroupLevel(alloc, MESSI_BIGTIME, "shooting", 4);
    alloc = adjustGroupLevel(alloc, MESSI_BIGTIME, "dribbling", 3);
    alloc = adjustGroupLevel(alloc, MESSI_BIGTIME, "dexterity", 2);

    const direct = calculateBuild({ card: MESSI_BIGTIME, allocation: alloc, manager: null });
    const viaCompare = buildComparison([input(MESSI_BIGTIME, { savedAllocation: alloc })]);

    for (const row of viaCompare.stats) {
      const d = direct.stats.find((s) => s.key === row.key)!;
      expect(row.perPlayer[0].finalValue).toBe(d.finalValue);
      expect(row.perPlayer[0].baseValue).toBe(d.baseValue);
      expect(row.perPlayer[0].progressionDelta).toBe(d.progressionDelta);
    }
  });

  it("adjustGroupLevel は残りポイント・グループ上限を超えない（不正配分を作らない）", () => {
    let alloc: Record<string, number> = {};
    // 過大な delta を要求しても engine が残ポイント / 上限で丸める
    alloc = adjustGroupLevel(alloc, MESSI_BIGTIME, "shooting", 9999);
    const c = buildComparison([input(MESSI_BIGTIME, { savedAllocation: alloc })]);
    expect(c.players[0].result.points.overAllocated).toBe(false);
    expect(c.players[0].result.points.remainingPoints).toBeGreaterThanOrEqual(0);
  });
});

describe("buildComparison: 監督補正", () => {
  it("監督なし → managerBoosterDelta 全能力0", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    expect(c.stats.every((s) => s.perPlayer.every((b) => b.managerBoosterDelta === 0))).toBe(true);
  });
  it("同一監督（confirmed）を両者へ → 対象能力に監督デルタ、選手B/育成とは分離", () => {
    const c = buildComparison([
      input(MESSI_BIGTIME, { manager: conteManager }),
      input(CANNAVARO_EPIC, { manager: conteManager }),
    ]);
    const da0 = c.stats.find((s) => s.key === "defensiveAwareness")!.perPlayer[0];
    const da1 = c.stats.find((s) => s.key === "defensiveAwareness")!.perPlayer[1];
    expect(da0.managerBoosterDelta).toBe(1);
    expect(da1.managerBoosterDelta).toBe(1);
    expect(da0.progressionDelta).toBe(0);
    expect(da0.playerBoosterDelta).toBe(0);
    expect(c.players[0].result.manager.applied).toBe(true);
  });
  it("異なる監督を個別適用 → 片方だけ補正", () => {
    const c = buildComparison([input(MESSI_BIGTIME, { manager: conteManager }), input(CANNAVARO_EPIC)]);
    expect(c.stats.find((s) => s.key === "kickingPower")!.perPlayer[0].managerBoosterDelta).toBe(1);
    expect(c.stats.find((s) => s.key === "kickingPower")!.perPlayer[1].managerBoosterDelta).toBe(0);
  });
  it("未確認監督は適用しない（表示のみ）", () => {
    const c = buildComparison([input(MESSI_BIGTIME, { manager: unconfirmedManager })]);
    expect(c.players[0].result.manager.applied).toBe(false);
    expect(c.stats.every((s) => s.perPlayer[0].managerBoosterDelta === 0)).toBe(true);
  });
});

describe("buildComparison: 選手ブースター（通常値と試算値の分離）", () => {
  it("カード付属の effect_confirmed ブースターは通常の finalValue に自動反映（比較に影響）", () => {
    const bc: ProgressionCard = { ...MESSI_BIGTIME, worldCardId: "cc1", boost1: 14, boost2: 0 }; // Ball-carrying +3
    const c = buildComparison([input(bc), input({ ...CANNAVARO_EPIC, boost1: 0, boost2: 0 })]);
    const sp = c.stats.find((s) => s.key === "speed")!;
    expect(sp.perPlayer[0].playerBoosterDelta).toBe(3);
    expect(sp.perPlayer[0].finalValue).toBe(sp.perPlayer[0].baseValue + 3);
    expect(sp.perPlayer[1].playerBoosterDelta).toBe(0);
  });
  it("未解決・条件付きの付属ブースターは通常の finalValue を動かさない", () => {
    for (const b1 of [59 /* unresolved */, 83 /* total-package conditional */]) {
      const c = buildComparison([input({ ...MESSI_BIGTIME, boost1: b1, boost2: 0 })]);
      expect(c.stats.every((s) => s.perPlayer[0].playerBoosterDelta === 0)).toBe(true);
      expect(c.stats.every((s) => s.perPlayer[0].finalValue === s.perPlayer[0].baseValue)).toBe(true);
    }
  });
  it("Total Package 条件段階の手動指定: 通常順位は不変・conditionalFinalValue にのみ反映", () => {
    const tpCard: ProgressionCard = { ...MESSI_BIGTIME, boost1: 83, boost2: 0 };
    const base = buildComparison([input(tpCard), input(CANNAVARO_EPIC)]);
    const withTp = buildComparison([
      input(tpCard, { selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_14_19" }] }),
      input(CANNAVARO_EPIC),
    ]);
    expect(base.hasAnyConditionalSelection).toBe(false);
    expect(withTp.hasAnyConditionalSelection).toBe(true);
    // 通常の順位・finalValue は不変
    expect(withTp.stats.map((s) => s.perPlayer[0].finalValue)).toEqual(
      base.stats.map((s) => s.perPlayer[0].finalValue),
    );
    expect(withTp.totalStatByPlayer).toEqual(base.totalStatByPlayer);
    // conditionalFinalValue には +2 反映
    const sp = withTp.stats.find((s) => s.key === "speed")!.perPlayer[0];
    expect(sp.conditionalBoosterDelta).toBe(2);
    expect(sp.conditionalFinalValue).toBe(Math.min(99, sp.standardFinalValue + 2));
    expect(sp.finalValue).toBe(sp.standardFinalValue);
  });
  it("v7: MESSI_BIGTIME の Ball Protection（金・PoM）は比較順位に不反映・段階指定で対象4能力だけ conditionalFinalValue が変化", () => {
    const base = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    // 標準の finalValue に Ball Protection ぶんは入っていない
    const bcBase = base.stats.find((s) => s.key === "ballControl")!.perPlayer[0];
    expect(bcBase.playerBoosterDelta).toBe(0);
    // Accuracy（固定）は入っている
    expect(base.stats.find((s) => s.key === "finishing")!.perPlayer[0].playerBoosterDelta).toBe(4);

    const withBp = buildComparison([
      input(MESSI_BIGTIME, { selectedConditionalBoosters: [{ boosterKey: "ball-protection", selection: "league_20_plus" }] }),
      input(CANNAVARO_EPIC),
    ]);
    expect(withBp.hasAnyConditionalSelection).toBe(true);
    // 通常順位は不変
    expect(withBp.stats.map((s) => s.perPlayer[0].finalValue)).toEqual(base.stats.map((s) => s.perPlayer[0].finalValue));
    const bc = withBp.stats.find((s) => s.key === "ballControl")!.perPlayer[0];
    expect(bc.conditionalBoosterDelta).toBe(3);
    expect(bc.conditionalFinalValue).toBe(Math.min(99, bc.standardFinalValue + 3));
    // Ball Protection 対象外（speed）は不変
    const sp = withBp.stats.find((s) => s.key === "speed")!.perPlayer[0];
    expect(sp.conditionalFinalValue).toBe(sp.standardFinalValue);
  });
  it("確認済みB2（ball-carrying）は通常の finalValue へ反映・二重加算しない", () => {
    const clean: ProgressionCard = { ...MESSI_BIGTIME, boost1: 0, boost2: 0 };
    const c = buildComparison([
      input(clean, { selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 3 }] }),
    ]);
    const sp = c.stats.find((s) => s.key === "speed")!.perPlayer[0];
    expect(sp.confirmedB2BoosterDelta).toBe(3);
    expect(sp.playerBoosterDelta).toBe(3);
    expect(sp.finalValue).toBe(Math.min(99, sp.baseValue + 3));
    expect(sp.experimentalFinalValue).toBe(sp.finalValue); // 二重加算しない
  });
  it("未確認B2（single-speed）は通常の finalValue を変えず experimentalFinalValue にのみ乗る", () => {
    const clean: ProgressionCard = { ...MESSI_BIGTIME, boost1: 0, boost2: 0 };
    const c = buildComparison([
      input(clean, { selectedPlayerBoosters: [{ slot: 1, boosterKey: "single-speed", level: 3 }] }),
    ]);
    const sp = c.stats.find((s) => s.key === "speed")!.perPlayer[0];
    expect(sp.confirmedB2BoosterDelta).toBe(0);
    expect(sp.playerBoosterDelta).toBe(0);
    expect(sp.finalValue).toBe(sp.baseValue);
    expect(sp.experimentalPlayerBoosterDelta).toBe(3);
    expect(sp.experimentalFinalValue).toBe(Math.min(99, sp.baseValue + 3));
  });
  it("experimentalModeEnabled は比較の finalValue に影響しない（表示フラグ）", () => {
    const clean: ProgressionCard = { ...MESSI_BIGTIME, boost1: 0, boost2: 0 };
    const opts = { selectedPlayerBoosters: [{ slot: 1 as const, boosterKey: "shooting", level: 4 }] };
    const off = buildComparison([input(clean, opts)]);
    const on = buildComparison([input(clean, { ...opts, experimentalModeEnabled: true })]);
    expect(off.stats.map((s) => s.perPlayer[0].finalValue)).toEqual(
      on.stats.map((s) => s.perPlayer[0].finalValue),
    );
  });
});

describe("buildComparison: スキル比較", () => {
  it("共通/一部/固有を分類・スキル数", () => {
    const c = buildComparison([
      input(MESSI_BIGTIME, { skills: ["A", "B", "C"] }),
      input(CANNAVARO_EPIC, { skills: ["B", "C", "D"] }),
      input(NEUER_GK, { skills: ["C", "E"] }),
    ]);
    expect(c.playerSkills.shared).toEqual(["C"]);
    expect(c.playerSkills.uniqueByPlayer[0]).toEqual(["A"]);
    expect(c.playerSkills.uniqueByPlayer[1]).toEqual(["D"]);
    expect(c.playerSkills.uniqueByPlayer[2]).toEqual(["E"]);
    expect(c.playerSkills.partial.find((p) => p.skill === "B")?.playerIdx).toEqual([0, 1]);
    expect(c.playerSkills.countByPlayer).toEqual([3, 3, 2]);
  });
  it("スキルなしでもクラッシュしない", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    expect(c.playerSkills.shared).toEqual([]);
    expect(c.aiStyles.shared).toEqual([]);
  });
});

describe("buildComparison: カテゴリ・メタ", () => {
  it("カテゴリは7分類・単純合計/平均・警告に「公式評価ではない」", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    expect(c.categories).toHaveLength(7);
    expect(c.warnings.some((w) => w.includes("公式") && w.includes("単純"))).toBe(true);
  });
  it("rulesVersion / 推定OVR / positionMatch", () => {
    const c = buildComparison([input(MESSI_BIGTIME), input(CANNAVARO_EPIC)]);
    expect(c.rulesVersion).toBe(PROGRESSION_RULES_VERSION);
    expect(c.estimatedOvrByPlayer.every((v) => typeof v === "number")).toBe(true);
    expect(c.positionMatch).toBe(false);
    expect(buildComparison([input(CANNAVARO_EPIC), input(NEAR_CAP_CARD)]).positionMatch).toBe(false);
  });
  it("同一人物の別カード（別 worldCardId）は別選手として比較", () => {
    const alt: ProgressionCard = { ...MESSI_BIGTIME, worldCardId: "89136409091415", ovrBase: 89 };
    const c = buildComparison([input(MESSI_BIGTIME), input(alt)]);
    expect(c.players).toHaveLength(2);
    expect(c.basicInfo.find((r) => r.label === "基礎OVR")!.perPlayer).toEqual([90, 89]);
  });
});
