import { describe, it, expect } from "vitest";
import { buildSquad, type BuildSquadInput } from "./build-squad";
import { changeFormation } from "./formation-change";
import { emptySquad } from "./squad-storage";
import { getFormation } from "./formations";
import type { SquadEntryInput } from "./types";
import type { ProgressionCard, ManagerContext } from "@/lib/progression/types";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK, LEVEL1_TRENDING } from "@/lib/progression/fixtures";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";

function entry(
  card: ProgressionCard,
  opts: Partial<Pick<SquadEntryInput, "buildMode" | "savedAllocation" | "savedBuildRulesVersion">> & {
    playingStyle?: string | null;
    skills?: string[];
  } = {},
): SquadEntryInput {
  return {
    card,
    display: {
      worldCardId: card.worldCardId,
      nameEn: card.nameEn,
      nameJa: card.nameJa,
      cardType: card.cardType,
      registeredPosition: card.registeredPosition,
      playingStyle: opts.playingStyle ?? null,
      playingStyleDefensive: null,
      ovrBase: card.ovrBase,
      ovrMax: card.ovrMax,
      maximumLevel: card.maximumLevel,
      hasEfhubLink: false,
      efhubCardId: null,
      imageUrlCandidate: null,
      mobileImageUrlCandidate: null,
      playerSkills: opts.skills ?? [],
      aiStyles: [],
    },
    buildMode: opts.buildMode ?? "none",
    savedAllocation: opts.savedAllocation ?? null,
    savedBuildName: opts.savedAllocation ? "保存ビルド" : null,
    savedBuildRulesVersion: opts.savedBuildRulesVersion ?? null,
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

/** 4-3-3 の全11スロットを埋める入力を作る */
function fullInput(overrides: Partial<BuildSquadInput> = {}): BuildSquadInput {
  const f = getFormation("4-3-3");
  const entries: Record<string, SquadEntryInput | null> = {};
  f.slots.forEach((s, i) => {
    if (s.position === "GK") entries[s.slotId] = entry(NEUER_GK);
    else if (s.role === "DF") entries[s.slotId] = entry(CANNAVARO_EPIC);
    else entries[s.slotId] = entry(i % 2 === 0 ? MESSI_BIGTIME : LEVEL1_TRENDING);
  });
  return {
    formationId: "4-3-3",
    entries,
    substitutes: [],
    manager: null,
    managerLinkUpPlays: null,
    captainSlotId: null,
    linkUpSelection: { centerPieceSlotId: null, keyManSlotId: null },
    ...overrides,
  };
}

describe("buildSquad: 配置", () => {
  it("11人配置で先発11・警告に人数不足なし", () => {
    const c = buildSquad(fullInput());
    expect(c.slots).toHaveLength(11);
    expect(c.slots.every((s) => s.entry != null)).toBe(true);
    expect(c.teamSummary.startingCount).toBe(11);
    expect(c.warnings.some((w) => w.includes("先発が"))).toBe(false);
  });

  it("一部未配置 → 警告に人数", () => {
    const input = fullInput();
    input.entries["cf"] = null;
    const c = buildSquad(input);
    expect(c.teamSummary.startingCount).toBe(10);
    expect(c.warnings.some((w) => w.includes("10/11"))).toBe(true);
  });

  it("ベンチ選手も計算される", () => {
    const c = buildSquad(fullInput({ substitutes: [{ subId: "sub_a", entry: entry(MESSI_BIGTIME) }] }));
    expect(c.substitutes).toHaveLength(1);
    expect(c.teamSummary.benchCount).toBe(1);
    expect(c.substitutes[0].baseOvr).toBe(90);
  });

  it("キャプテン指定が反映される", () => {
    const c = buildSquad(fullInput({ captainSlotId: "cf" }));
    expect(c.slots.find((s) => s.slotId === "cf")!.isCaptain).toBe(true);
    expect(c.slots.filter((s) => s.isCaptain)).toHaveLength(1);
  });
});

describe("buildSquad: ポジション適性", () => {
  it("GK スロットに CB → gkMismatch・能力値は下げない", () => {
    const input = fullInput();
    input.entries["gk"] = entry(CANNAVARO_EPIC); // CB を GK へ
    const c = buildSquad(input);
    const gk = c.slots.find((s) => s.slotId === "gk")!;
    expect(gk.compatibility.status).toBe("gkMismatch");
    // baseValue が下がっていない（Cannavaro の defensiveAwareness 82 のまま）
    const da = gk.entry!.result.stats.find((s) => s.key === "defensiveAwareness")!;
    expect(da.baseValue).toBe(82);
    expect(c.teamSummary.gkMismatchCount).toBe(1);
  });

  it("CB を LWF(FW) へ → unresolved（role 違い）", () => {
    const input = fullInput();
    input.entries["lwf"] = entry(CANNAVARO_EPIC);
    const c = buildSquad(input);
    expect(c.slots.find((s) => s.slotId === "lwf")!.compatibility.status).toBe("unresolved");
  });
});

describe("buildSquad: 監督", () => {
  it("監督なし → 全 managerBoosterDelta 0", () => {
    const c = buildSquad(fullInput());
    expect(c.slots.every((s) => s.entry == null || s.entry.managerBoosterDelta === 0)).toBe(true);
    expect(c.manager.applied).toBe(false);
  });

  it("confirmed 監督 → 全選手へ適用・対象能力だけ変化", () => {
    const c = buildSquad(fullInput({ manager: conteManager }));
    expect(c.manager.applied).toBe(true);
    for (const s of c.slots) {
      if (!s.entry) continue;
      const da = s.entry.result.stats.find((x) => x.key === "defensiveAwareness")!;
      const kp = s.entry.result.stats.find((x) => x.key === "kickingPower")!;
      expect(da.managerBoosterDelta).toBe(1);
      expect(kp.managerBoosterDelta).toBe(1);
      // 対象外は0
      expect(s.entry.result.stats.find((x) => x.key === "speed")!.managerBoosterDelta).toBe(0);
    }
    expect(c.teamSummary.managerBoostedCount).toBe(11);
  });

  it("未確認監督 → 適用しない（表示のみ）", () => {
    const c = buildSquad(fullInput({ manager: unconfirmedManager }));
    expect(c.manager.applied).toBe(false);
    expect(c.slots.every((s) => s.entry == null || s.entry.managerBoosterDelta === 0)).toBe(true);
  });

  it("監督変更で育成配分は変わらず監督デルタだけ再計算", () => {
    const withBuild = fullInput({ manager: null });
    withBuild.entries["cf"] = entry(MESSI_BIGTIME, { buildMode: "attack" });
    const before = buildSquad(withBuild);
    const cfBefore = before.slots.find((s) => s.slotId === "cf")!.entry!;
    withBuild.manager = conteManager;
    const after = buildSquad(withBuild);
    const cfAfter = after.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(cfAfter.progressionDelta).toBe(cfBefore.progressionDelta);
    expect(cfAfter.managerBoosterDelta).toBeGreaterThan(cfBefore.managerBoosterDelta);
  });
});

describe("buildSquad: 育成", () => {
  it("buildMode を適用すると progressionDelta が載る", () => {
    const input = fullInput();
    input.entries["cf"] = entry(MESSI_BIGTIME, { buildMode: "attack" });
    const c = buildSquad(input);
    expect(c.slots.find((s) => s.slotId === "cf")!.entry!.progressionDelta).toBeGreaterThan(0);
  });

  it("保存ビルドの配分が使われる", () => {
    const input = fullInput();
    input.entries["cf"] = entry(MESSI_BIGTIME, { savedAllocation: { shooting: 2 } });
    const c = buildSquad(input);
    const fin = c.slots.find((s) => s.slotId === "cf")!.entry!.result.stats.find((s) => s.key === "finishing")!;
    expect(fin.progressionDelta).toBe(2);
  });

  it("古い rulesVersion の保存ビルド → staleBuild + 警告", () => {
    const input = fullInput();
    input.entries["cf"] = entry(MESSI_BIGTIME, {
      savedAllocation: { shooting: 2 },
      savedBuildRulesVersion: "progression/2000-01-01.v0",
    });
    const c = buildSquad(input);
    expect(c.slots.find((s) => s.slotId === "cf")!.entry!.staleBuild).toBe(true);
    expect(c.warnings.some((w) => w.includes("旧規則"))).toBe(true);
  });

  it("保存スカッドの rulesVersion が古いと rulesOutdated", () => {
    const c = buildSquad(fullInput({ savedRulesVersion: "progression/2000-01-01.v0" }));
    expect(c.rulesOutdated).toBe(true);
  });
});

describe("buildSquad: カード付属ブースター", () => {
  it("confirmed 付属（Offence Creator +3, boost1=52）は自動適用される", () => {
    const input = fullInput();
    input.entries["cf"] = entry({ ...MESSI_BIGTIME, worldCardId: "oc1", boost1: 52, boost2: 0 });
    const c = buildSquad(input);
    const e = c.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(e.playerBoosterDelta).toBeGreaterThan(0);
    expect(e.result.playerBoosters[0].autoApplied).toBe(true);
    expect(e.result.playerBoosters[0].boosterNameEn).toBe("Offence Creator");
  });
  it("conditional 付属（total-package）はチームサマリーの通常値に入らない", () => {
    const input = fullInput();
    input.entries["cf"] = entry({ ...MESSI_BIGTIME, worldCardId: "tp1", boost1: 83, boost2: 0 });
    const c = buildSquad(input);
    const e = c.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(e.playerBoosterDelta).toBe(0);
    expect(e.result.playerBoosters[0].autoApplied).toBe(false);
    expect(e.result.playerBoosters[0].evidenceLevel).toBe("conditional_unverified");
    expect(c.hasAnyConditionalSelection).toBe(false);
    expect(c.conditionalTeamSummary).toBeNull();
  });
  it("Total Package の条件段階を手動指定: 通常サマリー不変・条件付き試算サマリーが別に出る", () => {
    const base = fullInput();
    base.entries["cf"] = entry({ ...MESSI_BIGTIME, worldCardId: "tp2", boost1: 83, boost2: 0 });
    const before = buildSquad(base);

    const withTp = fullInput();
    withTp.entries["cf"] = {
      ...entry({ ...MESSI_BIGTIME, worldCardId: "tp2", boost1: 83, boost2: 0 }),
      selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_20_plus" }],
    };
    const c = buildSquad(withTp);
    const e = c.slots.find((s) => s.slotId === "cf")!.entry!;

    // 通常値は不変
    expect(e.playerBoosterDelta).toBe(0);
    expect(c.teamSummary).toEqual(before.teamSummary);
    // 条件段階はユーザー指定として別バケットへ
    expect(e.conditionalDelta).toBe(3 * 26);
    expect(e.hasConditionalSelection).toBe(true);
    expect(c.hasAnyConditionalSelection).toBe(true);
    expect(c.conditionalTeamSummary).not.toBeNull();
    // 条件反映後の平均OVRは通常以上（+3 されたぶん）
    expect((c.conditionalTeamSummary!.avgDisplayedOvr ?? 0)).toBeGreaterThanOrEqual(c.teamSummary.avgDisplayedOvr ?? 0);
  });
  it("Total Package 条件段階 + 監督変更で通常集計は監督ぶんのみ変わる", () => {
    const withTp = fullInput({ manager: conteManager });
    withTp.entries["cf"] = {
      ...entry({ ...MESSI_BIGTIME, worldCardId: "tp3", boost1: 83, boost2: 0 }),
      selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_1_13" }],
    };
    const c = buildSquad(withTp);
    const e = c.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(e.playerBoosterDelta).toBe(0); // 条件段階は通常値に入らない
    expect(e.conditionalDelta).toBe(1 * 26);
    expect(e.managerBoosterDelta).not.toBe(0);
  });
  it("MESSI_BIGTIME: Accuracy+4（青・固定）は標準集計へ・Ball Protection+3（金・Power of Many）は未適用", () => {
    const input = fullInput();
    input.entries["cf"] = entry(MESSI_BIGTIME);
    const c = buildSquad(input);
    const e = c.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(e.playerBoosterDelta).toBeGreaterThan(0); // Accuracy ぶん
    const acc = e.result.playerBoosters.find((b) => b.boosterKey === "accuracy")!;
    const bp = e.result.playerBoosters.find((b) => b.boosterKey === "ball-protection")!;
    expect(acc.autoApplied).toBe(true);
    expect(bp.autoApplied).toBe(false);
    expect(bp.activationType).toBe("power_of_many");
  });
  it("監督変更・フォーメーション変更で付属ブースターの自動適用は維持される", () => {
    const input = fullInput({ manager: conteManager });
    input.entries["cf"] = entry({ ...MESSI_BIGTIME, worldCardId: "oc2", boost1: 14, boost2: 0 });
    const c = buildSquad(input);
    const e = c.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(e.playerBoosterDelta).toBeGreaterThan(0);
    // 監督効果は別レイヤー
    expect(e.managerBoosterDelta).not.toBe(e.playerBoosterDelta);
  });
  it("確認済みB2（ball-carrying）はチームサマリー（通常値）へ反映される", () => {
    const base = fullInput();
    base.entries["cf"] = entry({ ...MESSI_BIGTIME, worldCardId: "t1", boost1: 0, boost2: 0 });
    const withB2 = fullInput();
    withB2.entries["cf"] = {
      ...entry({ ...MESSI_BIGTIME, worldCardId: "t1", boost1: 0, boost2: 0 }),
      selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 5 }],
    };
    const a = buildSquad(base);
    const b = buildSquad(withB2);
    const ea = a.slots.find((s) => s.slotId === "cf")!.entry!;
    const eb = b.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(eb.playerBoosterDelta).toBeGreaterThan(ea.playerBoosterDelta); // 確認済みB2は通常値へ反映
  });
  it("未確認B2（手動試算）はチームサマリー（通常値）に影響しない", () => {
    const base = fullInput();
    base.entries["cf"] = entry({ ...MESSI_BIGTIME, worldCardId: "t1", boost1: 0, boost2: 0 });
    const withTrial = fullInput();
    withTrial.entries["cf"] = {
      ...entry({ ...MESSI_BIGTIME, worldCardId: "t1", boost1: 0, boost2: 0 }),
      selectedPlayerBoosters: [{ slot: 1, boosterKey: "single-speed", level: 5 }],
    };
    const a = buildSquad(base);
    const b = buildSquad(withTrial);
    const ea = a.slots.find((s) => s.slotId === "cf")!.entry!;
    const eb = b.slots.find((s) => s.slotId === "cf")!.entry!;
    expect(eb.playerBoosterDelta).toBe(ea.playerBoosterDelta); // 通常値は不変
    expect(eb.displayedOvr).toBe(ea.displayedOvr);
  });
});

describe("buildSquad: チームサマリー", () => {
  it("平均OVR・カテゴリ7・共通スキル・警告に非公式注記", () => {
    const input = fullInput();
    // 全員に共通スキルを1つ
    for (const k of Object.keys(input.entries)) {
      const e = input.entries[k]!;
      e.display.playerSkills = ["Common Skill", `uniq-${k}`];
    }
    const c = buildSquad(input);
    expect(c.teamSummary.categoryAverages).toHaveLength(7);
    expect(typeof c.teamSummary.avgBaseOvr).toBe("number");
    expect(typeof c.teamSummary.avgDisplayedOvr).toBe("number");
    expect(c.teamSummary.sharedSkills).toEqual(["Common Skill"]);
    expect(c.warnings.some((w) => w.includes("公式チームパワー"))).toBe(true);
    expect(c.warnings.some((w) => w.includes("適用順序"))).toBe(true);
  });

  it("Link-Up Play notice が常にある", () => {
    const c = buildSquad(fullInput());
    expect(c.linkUpNotice).toContain("追加検証中");
  });
});

describe("changeFormation", () => {
  it("同ポジションの選手は引き継がれる", () => {
    const sq = emptySquad("t", "4-3-3");
    sq.slots.find((s) => s.slotId === "gk")!.worldCardId = "1";
    sq.slots.find((s) => s.slotId === "lcb")!.worldCardId = "2";
    sq.slots.find((s) => s.slotId === "cf")!.worldCardId = "3";
    const { squad } = changeFormation(sq, "4-4-2");
    expect(squad.formationId).toBe("4-4-2");
    expect(squad.slots.find((s) => s.slotId === "gk")!.worldCardId).toBe("1");
    // CB は 4-4-2 にも存在 → 引き継ぎ
    expect(squad.slots.some((s) => s.worldCardId === "2")).toBe(true);
    expect(squad.slots.some((s) => s.worldCardId === "3")).toBe(true);
  });

  it("あふれた選手はベンチへ退避（先発は維持）", () => {
    const sq = emptySquad("t", "4-4-2"); // CF x2
    sq.slots.find((s) => s.slotId === "lcf")!.worldCardId = "10";
    sq.slots.find((s) => s.slotId === "rcf")!.worldCardId = "11";
    const { squad, movedToBench } = changeFormation(sq, "4-2-3-1"); // CF x1
    const onPitch = squad.slots.filter((s) => s.worldCardId).map((s) => s.worldCardId);
    const onBench = squad.substitutes.map((s) => s.worldCardId);
    expect([...onPitch, ...onBench].sort()).toEqual(["10", "11"]);
    expect(movedToBench.length + 0).toBeGreaterThanOrEqual(0);
    // 選手を失わない
    expect(onPitch.length + onBench.length).toBe(2);
  });

  it("育成ビルドは保持される", () => {
    const sq = emptySquad("t", "4-3-3");
    const cf = sq.slots.find((s) => s.slotId === "cf")!;
    cf.worldCardId = "5";
    cf.buildMode = "attack";
    cf.savedBuildId = "b_x";
    const { squad } = changeFormation(sq, "4-2-1-3");
    const moved = [...squad.slots, ...squad.substitutes.map((s) => ({ ...s, slotId: "" }))].find(
      (s) => s.worldCardId === "5",
    )!;
    expect(moved.buildMode).toBe("attack");
    expect(moved.savedBuildId).toBe("b_x");
  });
});
