import { describe, it, expect } from "vitest";
import { calculateBuild } from "./engine";
import {
  normalizeGroupAllocation,
  summarizeGroupPoints,
  adjustGroupLevel,
  groupBreakdowns,
} from "./group-allocation";
import { costForNextLevel, cumulativeCost } from "./point-cost";
import { autoAllocate } from "./auto-allocate";
import { getProgressionEligibility } from "./card-eligibility";
import { validateGroupCoverage, PROGRESSION_GROUPS, getGroupDef } from "./stat-groups";
import { getRuleset } from "./progression-rules";
import { STAT_CAP, PROGRESSION_RULES_VERSION, POINTS_PER_LEVEL } from "./constants";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK, LEVEL1_TRENDING, NEAR_CAP_CARD } from "./fixtures";

describe("stat groups", () => {
  it("26能力値をちょうど1回ずつ覆う", () => {
    const r = validateGroupCoverage();
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.duplicated).toEqual([]);
  });
  it("グループは10種", () => expect(PROGRESSION_GROUPS).toHaveLength(10));
  it("Shooting の対象能力値は confirmed = {finishing,setPieceTaking,curl}", () => {
    const g = getGroupDef("shooting")!;
    expect(g.statsConfidence).toBe("confirmed");
    expect(g.affectedStats.sort()).toEqual(["curl", "finishing", "setPieceTaking"]);
  });
});

describe("ポイント/レベル（confirmed: 2/level）", () => {
  const rs = getRuleset();
  it("POINTS_PER_LEVEL = 2 / confidence confirmed", () => {
    expect(POINTS_PER_LEVEL).toBe(2);
    expect(rs.pointsPerLevelConfidence).toBe("confirmed");
    expect(rs.totalPointsConfidence).toBe("confirmed");
  });
  it("Messi lv32 → 62 / Cannavaro lv27 → 52 / lv1・null → 0", () => {
    expect(rs.totalPoints(32)).toBe(62);
    expect(rs.totalPoints(27)).toBe(52);
    expect(rs.totalPoints(1)).toBe(0);
    expect(rs.totalPoints(null)).toBe(0);
  });
});

describe("段階コスト（provisional: 5段階ごと +1）", () => {
  it("costForNextLevel: 0-4 → 1, 5-9 → 2, 10-14 → 3", () => {
    for (let i = 0; i < 5; i++) expect(costForNextLevel(i)).toBe(1);
    for (let i = 5; i < 10; i++) expect(costForNextLevel(i)).toBe(2);
    expect(costForNextLevel(10)).toBe(3);
  });
  it("cumulativeCost: level 5 = 5, level 6 = 7, level 10 = 15", () => {
    expect(cumulativeCost(5)).toBe(5);
    expect(cumulativeCost(6)).toBe(7);
    expect(cumulativeCost(10)).toBe(15);
  });
});

describe("育成不可カードの判定（confirmed）", () => {
  it("TRENDING は育成不可", () => {
    const e = getProgressionEligibility(LEVEL1_TRENDING);
    expect(e.canProgress).toBe(false);
    expect(e.confirmationStatus).toBe("confirmed");
  });
  it("Messi/Cannavaro/GK は育成可", () => {
    expect(getProgressionEligibility(MESSI_BIGTIME).canProgress).toBe(true);
    expect(getProgressionEligibility(CANNAVARO_EPIC).canProgress).toBe(true);
    expect(getProgressionEligibility(NEUER_GK).canProgress).toBe(true);
  });
  it("育成不可カードは配分しても finalValue = base", () => {
    const r = calculateBuild({ card: { ...LEVEL1_TRENDING, boost1: 0, boost2: 0 }, allocation: { shooting: 5 } });
    expect(r.eligibility.canProgress).toBe(false);
    for (const s of r.stats) expect(s.finalValue).toBe(LEVEL1_TRENDING.baseStats[s.key]);
    expect(r.points.totalPoints).toBe(0);
  });
});

describe("normalizeGroupAllocation: 不正入力を拒否", () => {
  it("負数・小数・NaN・Infinity・未知グループを除外", () => {
    const r = normalizeGroupAllocation(
      { shooting: 3, passing: -2, dribbling: 1.5, defending: NaN, dexterity: Infinity, notAGroup: 4 },
      MESSI_BIGTIME,
    );
    expect(r.allocation).toEqual({ shooting: 3 });
    expect(r.rejected.length).toBe(5);
  });
  it("グループ上限で丸め（NEAR_CAP の gk グループは base 40 なので room 59 まで）", () => {
    const r = normalizeGroupAllocation({ goalkeeping3: 100 }, NEAR_CAP_CARD);
    expect(r.allocation.goalkeeping3).toBe(59);
  });
  it("異常に大きい値（>200）は除外", () => {
    const r = normalizeGroupAllocation({ shooting: 5000 }, NEAR_CAP_CARD);
    expect(r.allocation.shooting).toBeUndefined();
  });
});

describe("calculateBuild v2: 基礎値を壊さない / 対象能力だけ変化", () => {
  it("配分ゼロなら final = base、mode=confirmed", () => {
    const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 0, boost2: 0 }, allocation: {} });
    expect(r.calculationMode).toBe("confirmed");
    for (const s of r.stats) expect(s.finalValue).toBe(MESSI_BIGTIME.baseStats[s.key]);
  });
  it("shooting レベル3 → finishing/setPieceTaking/curl だけ +3（要求値）、他は不変", () => {
    const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 0, boost2: 0 }, allocation: { shooting: 3 } });
    expect(r.calculationMode).toBe("provisional");
    const shooting = getGroupDef("shooting")!.affectedStats;
    for (const s of r.stats) {
      if (shooting.includes(s.key)) {
        expect(s.progressionDelta).toBe(3);
        // 最終値は99でクランプ
        expect(s.finalValue).toBe(Math.min(STAT_CAP, MESSI_BIGTIME.baseStats[s.key] + 3));
      } else {
        expect(s.progressionDelta).toBe(0);
      }
    }
  });
  it("同じ入力で同じ結果（決定的）", () => {
    const a = calculateBuild({ card: CANNAVARO_EPIC, allocation: { defending: 4, aerialStrength: 2 } });
    const b = calculateBuild({ card: CANNAVARO_EPIC, allocation: { defending: 4, aerialStrength: 2 } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("99上限を超えない", () => {
    const r = calculateBuild({ card: NEAR_CAP_CARD, allocation: { dribbling: 20 } });
    for (const s of r.stats) expect(s.finalValue).toBeLessThanOrEqual(STAT_CAP);
  });
  it("規則メタ情報（confirmed/provisional/unresolved/eligibility）", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(r.rulesVersion).toBe(PROGRESSION_RULES_VERSION);
    expect(r.confirmedRules.length).toBeGreaterThan(0);
    expect(r.provisionalRules.length).toBeGreaterThan(0);
    expect(r.unresolvedRules.length).toBeGreaterThan(0);
    expect(r.eligibility.canProgress).toBe(true);
  });
});

describe("ポイントサマリー（段階コスト）", () => {
  it("shooting レベル6 の消費 = cumulativeCost(6) = 7", () => {
    const s = summarizeGroupPoints({ shooting: 6 }, MESSI_BIGTIME);
    expect(s.usedPoints).toBe(7);
    expect(s.totalPoints).toBe(62);
    expect(s.remainingPoints).toBe(55);
  });
  it("使いすぎは overAllocated=true", () => {
    const s = summarizeGroupPoints({ shooting: 20, passing: 20 }, CANNAVARO_EPIC);
    expect(s.overAllocated).toBe(true);
    expect(s.valid).toBe(false);
  });
});

describe("adjustGroupLevel", () => {
  it("+1 / -1、残ポイント尊重", () => {
    let a: Record<string, number> = {};
    a = adjustGroupLevel(a, MESSI_BIGTIME, "shooting", 1);
    expect(a.shooting).toBe(1);
    a = adjustGroupLevel(a, MESSI_BIGTIME, "shooting", -1);
    expect(a.shooting).toBeUndefined();
  });
  it("残ポイントを超えて増やせない（段階コストで頭打ち）", () => {
    const a = adjustGroupLevel({}, CANNAVARO_EPIC, "defending", 999);
    const s = summarizeGroupPoints(a, CANNAVARO_EPIC);
    expect(s.usedPoints).toBeLessThanOrEqual(52);
    expect(s.overAllocated).toBe(false);
  });
  it("groupBreakdowns: nextLevelCost を提示（level 4 → 1, level 5 → 2）", () => {
    const g4 = groupBreakdowns({ shooting: 4 }, MESSI_BIGTIME).find((g) => g.groupId === "shooting")!;
    expect(g4.nextLevelCost).toBe(1);
    const g5 = groupBreakdowns({ shooting: 5 }, MESSI_BIGTIME).find((g) => g.groupId === "shooting")!;
    expect(g5.nextLevelCost).toBe(2);
  });
});

describe("リセット", () => {
  it("空配分に戻すと基礎状態へ", () => {
    const card = { ...MESSI_BIGTIME, boost1: 0, boost2: 0 };
    const on = calculateBuild({ card, allocation: { shooting: 3 } });
    const off = calculateBuild({ card, allocation: {} });
    expect(on.stats.find((s) => s.key === "finishing")!.finalValue).not.toBe(
      off.stats.find((s) => s.key === "finishing")!.finalValue,
    );
    for (const s of off.stats) expect(s.finalValue).toBe(MESSI_BIGTIME.baseStats[s.key]);
  });
});

describe("選手ブースター", () => {
  it("MESSI_BIGTIME: Accuracy+4（青・固定）は標準へ自動適用・Ball Protection+3（金・Power of Many）は未適用", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(r.playerBoosters.length).toBe(2);
    const acc = r.playerBoosters.find((b) => b.boosterKey === "accuracy")!;
    const bp = r.playerBoosters.find((b) => b.boosterKey === "ball-protection")!;
    expect(acc.activationType).toBe("fixed");
    expect(acc.autoApplied).toBe(true);
    expect(acc.evidenceLevel).toBe("external_cross_verified");
    expect(bp.activationType).toBe("power_of_many");
    expect(bp.autoApplied).toBe(false); // 金色は標準へ自動適用しない
    expect(bp.manualConditional).toBe(true);
    // Accuracy = lowPass/loftedPass/finishing/kickingPower に各 +4（標準へ）
    expect(r.stats.find((s) => s.key === "finishing")!.playerBoosterDelta).toBe(4);
    // Ball Protection の対象4能力は標準へ入っていない
    expect(r.stats.find((s) => s.key === "ballControl")!.playerBoosterDelta).toBe(0);
    expect(r.stats.find((s) => s.key === "ballControl")!.standardFinalValue).toBe(
      r.stats.find((s) => s.key === "ballControl")!.baseValue,
    );
  });
  it("MESSI_BIGTIME: Ball Protection の段階をユーザー指定 → 対象4能力だけ conditionalFinalValue が変化・Accuracy と標準は不変", () => {
    const base = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    const r = calculateBuild({
      card: MESSI_BIGTIME,
      allocation: {},
      selectedConditionalBoosters: [{ boosterKey: "ball-protection", selection: "league_14_19" }],
    });
    for (const key of ["ballControl", "tightPossession", "balance", "physicalContact"]) {
      const s = r.stats.find((x) => x.key === key)!;
      const b0 = base.stats.find((x) => x.key === key)!;
      expect(s.standardFinalValue).toBe(b0.standardFinalValue); // 標準不変
      expect(s.conditionalBoosterDelta).toBe(2);
      expect(s.conditionalFinalValue).toBe(Math.min(99, s.standardFinalValue + 2));
    }
    // Ball Protection 対象外（speed）は条件反映後も不変
    const sp = r.stats.find((x) => x.key === "speed")!;
    expect(sp.conditionalFinalValue).toBe(sp.standardFinalValue);
    // Accuracy（finishing）は固定のまま
    expect(r.stats.find((s) => s.key === "finishing")!.playerBoosterDelta).toBe(4);
    expect(r.booster.hasConditionalSelection).toBe(true);
    expect(r.booster.conditionalSelections[0]).toMatchObject({ boosterKey: "ball-protection", selection: "league_14_19", level: 2 });
  });
  it("厳密モードでは MESSI_BIGTIME の Accuracy も通常の最終値に入らない（Ball Protection は元から未適用）", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {}, boosterApplicationMode: "strict" });
    expect(r.playerBoosters.every((b) => !b.autoApplied)).toBe(true);
    expect(r.stats.every((s) => s.playerBoosterDelta === 0)).toBe(true);
  });
  it("conditional 付属（total-package）は通常の最終値に入らない", () => {
    const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 }, allocation: {} });
    expect(r.playerBoosters[0].autoApplied).toBe(false);
    expect(r.stats.every((s) => s.playerBoosterDelta === 0)).toBe(true);
    expect(r.stats.every((s) => s.finalValue === s.baseValue)).toBe(true);
  });
  it("total-package の発動条件テキストが PlayerBoosterInfo に載る（v6・全モード未適用）", () => {
    for (const boosterApplicationMode of ["strict", "standard", "experimental"] as const) {
      const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 }, allocation: {}, boosterApplicationMode });
      const pb = r.playerBoosters[0];
      expect(pb.evidenceLevel).toBe("conditional_unverified");
      expect(pb.autoApplied).toBe(false);
      expect(pb.conditionText).toMatch(/The Power of Many/);
      expect(pb.conditionEvaluable).toBe(false);
      expect(r.stats.every((s) => s.playerBoosterDelta === 0)).toBe(true);
      expect(r.stats.every((s) => s.finalValue === s.baseValue)).toBe(true);
    }
  });
  it("screenshot_verified 付属（boost1=14 Ball-carrying+3）は全モードで自動適用される", () => {
    const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 14, boost2: 0 }, allocation: {} });
    expect(r.playerBoosters[0].autoApplied).toBe(true);
    expect(r.stats.find((s) => s.key === "speed")!.playerBoosterDelta).toBe(3);
    expect(r.playerBoosterByStat.speed).toEqual({ gameMeasured: 3, externalVerified: 0, conditional: 0, manualTrial: 0, confirmedB2: 0, experimentalExtra: 0 });
  });
  it("ID 15 = Ball-carrying +5 は自動適用（screenshot 実測）", () => {
    const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 15, boost2: 0 }, allocation: {} });
    expect(r.playerBoosters[0].boosterNameEn).toBe("Ball-carrying");
    expect(r.playerBoosters[0].level).toBe(5);
    expect(r.playerBoosters[0].autoApplied).toBe(true);
    const dr = r.stats.find((s) => s.key === "dribbling")!;
    expect(dr.playerBoosterDelta).toBe(5);
    expect(dr.finalValue).toBe(dr.baseValue + 5);
  });
  it("boost なしカードはブースター0件", () => {
    expect(calculateBuild({ card: NEAR_CAP_CARD, allocation: {} }).playerBoosters).toHaveLength(0);
  });
});

describe("監督補正", () => {
  it("未選択なら applied=false / delta 0", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(r.manager.applied).toBe(false);
    expect(r.stats.every((s) => s.managerBoosterDelta === 0)).toBe(true);
  });
  it("監督のブースター（未確認）は適用しない・育成は維持", () => {
    const r = calculateBuild({
      card: MESSI_BIGTIME,
      allocation: { shooting: 2 },
      manager: {
        internalManagerId: 1, sourceManagerId: "m1", managerName: "Test",
        boosterEffects: [{ statKey: "finishing", statNameEn: "Finishing", delta: 1, confirmationStatus: "provisional" }],
        tacticalProficiencies: null, applicationCondition: null,
        ruleVersion: PROGRESSION_RULES_VERSION, confirmationStatus: "provisional",
      },
    });
    expect(r.manager.applied).toBe(false);
    expect(r.stats.find((s) => s.key === "finishing")!.managerBoosterDelta).toBe(0);
    expect(r.stats.find((s) => s.key === "finishing")!.progressionDelta).toBe(2);
  });

  it("監督のブースター（confirmed）は monager レイヤーへ適用・育成/選手Bと分離", () => {
    const r = calculateBuild({
      card: MESSI_BIGTIME,
      allocation: { shooting: 2 },
      manager: {
        internalManagerId: 42, sourceManagerId: "conte", managerName: "Antonio Conte",
        boosterEffects: [
          { statKey: "defensiveAwareness", statNameEn: "Defensive Awareness", delta: 1, confirmationStatus: "confirmed" },
          { statKey: "kickingPower", statNameEn: "Kicking Power", delta: 1, confirmationStatus: "confirmed" },
        ],
        tacticalProficiencies: null, applicationCondition: null,
        ruleVersion: PROGRESSION_RULES_VERSION, confirmationStatus: "confirmed",
      },
    });
    expect(r.manager.applied).toBe(true);
    expect(r.manager.managerName).toBe("Antonio Conte");
    expect(r.manager.reasons).toHaveLength(2);
    const da = r.stats.find((s) => s.key === "defensiveAwareness")!;
    expect(da.managerBoosterDelta).toBe(1);
    expect(da.progressionDelta).toBe(0);
    expect(da.playerBoosterDelta).toBe(0);
    expect(da.finalValue).toBe(Math.min(99, MESSI_BIGTIME.baseStats.defensiveAwareness + 1));
    // 育成レイヤーは維持
    expect(r.stats.find((s) => s.key === "finishing")!.progressionDelta).toBe(2);
    // 監督対象外の能力は監督デルタ0
    expect(r.stats.find((s) => s.key === "finishing")!.managerBoosterDelta).toBe(0);
  });

  it("監督なし（null）→ managerBoosterDelta 全能力 0・applied=false", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: { shooting: 2 }, manager: null });
    expect(r.manager.applied).toBe(false);
    expect(r.stats.every((s) => s.managerBoosterDelta === 0)).toBe(true);
  });
});

describe("自動育成（v2 グループ）", () => {
  it("使用可能ポイント以内・残りが負にならない・不正な能力値を生成しない", () => {
    for (const profile of ["attack", "defense", "balance", "gk"] as const) {
      const r = autoAllocate(MESSI_BIGTIME, profile);
      expect(r.usedPoints).toBeLessThanOrEqual(r.totalPoints);
      expect(r.remainingPoints).toBeGreaterThanOrEqual(0);
      const build = calculateBuild({ card: MESSI_BIGTIME, allocation: r.allocation });
      expect(build.stats.every((s) => s.finalValue >= 1 && s.finalValue <= STAT_CAP)).toBe(true);
      expect(Object.keys(r.allocation).every((k) => getGroupDef(k))).toBe(true);
    }
  });
  it("攻撃型は攻撃グループへ、守備型は守備グループへ多く配分", () => {
    const atk = autoAllocate(CANNAVARO_EPIC, "attack").allocation;
    const def = autoAllocate(CANNAVARO_EPIC, "defense").allocation;
    expect((atk.shooting ?? 0) + (atk.dribbling ?? 0)).toBeGreaterThan(0);
    expect(def.defending ?? 0).toBeGreaterThan(atk.defending ?? 0);
  });
  it("GK向けは GK グループを対象", () => {
    const gk = autoAllocate(NEUER_GK, "gk").allocation;
    expect((gk.goalkeeping1 ?? 0) + (gk.goalkeeping2 ?? 0) + (gk.goalkeeping3 ?? 0)).toBeGreaterThan(0);
  });
  it("育成不可カードは配分0", () => {
    const r = autoAllocate(LEVEL1_TRENDING, "attack");
    expect(r.usedPoints).toBe(0);
    expect(Object.keys(r.allocation)).toHaveLength(0);
  });
  it("決定的", () => {
    expect(autoAllocate(MESSI_BIGTIME, "balance").allocation).toEqual(
      autoAllocate(MESSI_BIGTIME, "balance").allocation,
    );
  });
});

describe("能力値上限のレイヤー分離（修正）", () => {
  it("base のみ confirmed、progression/playerBooster/managerBooster/final は unresolved", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(r.statCaps.base.confidence).toBe("confirmed");
    expect(r.statCaps.base.value).toBe(99);
    expect(r.statCaps.progression.confidence).toBe("unresolved");
    expect(r.statCaps.playerBooster.confidence).toBe("unresolved");
    expect(r.statCaps.managerBooster.confidence).toBe("unresolved");
    expect(r.statCaps.final.confidence).toBe("unresolved");
  });
  it("最終値が99を超えるとき finalCapApplied=true + 暫定である旨の warning", () => {
    const r = calculateBuild({ card: NEAR_CAP_CARD, allocation: { dribbling: 20 } });
    expect(r.finalCapApplied).toBe(true);
    expect(r.warnings.some((w) => w.includes("確証はまだありません"))).toBe(true);
    expect(r.stats.every((s) => s.finalValue <= 99)).toBe(true);
  });
  it("基礎のみ（配分ゼロ）なら finalCapApplied=false", () => {
    expect(calculateBuild({ card: MESSI_BIGTIME, allocation: {} }).finalCapApplied).toBe(false);
  });
  it("unresolvedRules に最終上限の暫定処理が含まれる", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(r.unresolvedRules.some((x) => x.includes("最終能力値の上限"))).toBe(true);
  });
});

describe("段階コストは confirmed へ昇格しない", () => {
  it("rule-registry の cost.staged は provisional のまま・外挿の注記あり", async () => {
    const { RULE_REGISTRY } = await import("./rule-registry");
    const cost = RULE_REGISTRY.find((r) => r.ruleId === "cost.staged")!;
    expect(cost.confirmationStatus).toBe("provisional");
    expect(cost.evidence).toContain("外挿");
  });
});

describe("グループ日本語名は仮称", () => {
  it("Shooting の日本語候補は「シュート」・『撮影』ではない", () => {
    const g = getGroupDef("shooting")!;
    expect(g.nameJaCandidate).toBe("シュート");
    expect(g.nameJaCandidate).not.toBe("撮影");
  });
  it("多くのグループは日本語名 null（英語表示）", () => {
    const nulls = PROGRESSION_GROUPS.filter((g) => g.nameJaCandidate == null);
    expect(nulls.length).toBeGreaterThan(3);
  });
});

describe("OVR 推定", () => {
  it("estimatedOvr は provisional / note に「検証中」", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(r.rating.confidence).toBe("provisional");
    expect(r.rating.note).toContain("検証中");
    expect(typeof r.rating.estimatedOvr).toBe("number");
    expect(r.rating.storedOvrBase).toBe(90);
    expect(r.rating.storedOvrMax).toBe(105);
  });
});
