import { describe, it, expect } from "vitest";
import {
  BOOSTER_CATALOG,
  getBoosterDef,
  boosterDeltas,
  isB2SelectableCandidate,
  isConfirmedB2Candidate,
} from "./booster-catalog";
import {
  resolveAttachedBooster,
  appliesInMode,
  auditActivation,
  WORLD_BOOST1_MAP,
  WORLD_BOOST2_MAP,
  SCREENSHOT_VERIFIED_KEYS,
  EXTERNAL_CROSS_VERIFIED_KEYS,
  RESOLUTION_COVERAGE,
} from "./booster-resolution";
import { calculatePlayerBooster } from "./calculate-player-booster";
import { calculateBuild } from "./engine";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEAR_CAP_CARD } from "./fixtures";
import { PROGRESSION_RULES_VERSION } from "./constants";
import type { ProgressionCard } from "./types";

describe("BOOSTER_CATALOG: 証拠レベル", () => {
  it("全ブースターの対象能力は World 26キーのみ", () => {
    for (const b of BOOSTER_CATALOG) {
      for (const k of b.affectedStats) expect(WORLD_STAT_KEYS).toContain(k);
      expect(b.affectedStats.length).toBeGreaterThan(0);
    }
  });
  it("screenshot_verified は ball-carrying / offence-creator の 2 種のみ", () => {
    const gm = BOOSTER_CATALOG.filter((b) => b.evidenceLevel === "screenshot_verified").map((b) => b.key).sort();
    expect(gm).toEqual(["ball-carrying", "offence-creator"]);
    expect([...SCREENSHOT_VERIFIED_KEYS].sort()).toEqual(gm);
  });
  it("game_client_verified は 0 件", () => {
    expect(BOOSTER_CATALOG.filter((b) => b.evidenceLevel === "game_client_verified")).toHaveLength(0);
  });
  it("external_cross_verified は 27 種（STANDARD10 + EXTENDED17）", () => {
    const xv = BOOSTER_CATALOG.filter((b) => b.evidenceLevel === "external_cross_verified").map((b) => b.key).sort();
    expect(xv).toHaveLength(27);
    expect([...EXTERNAL_CROSS_VERIFIED_KEYS].sort()).toEqual(xv);
  });
  it("total-package は conditional_unverified、単一能力は effect_provisional", () => {
    expect(getBoosterDef("total-package")?.evidenceLevel).toBe("conditional_unverified");
    expect(getBoosterDef("single-speed")?.evidenceLevel).toBe("effect_provisional");
  });
  it("件数の整合: 総数 44 = category 別（standard 29 / single 6 / special 9）= evidenceLevel 別（重複なし）", () => {
    expect(BOOSTER_CATALOG).toHaveLength(44);
    expect(new Set(BOOSTER_CATALOG.map((b) => b.key)).size).toBe(44); // キー重複なし

    const byCat: Record<string, number> = {};
    for (const b of BOOSTER_CATALOG) byCat[b.category] = (byCat[b.category] ?? 0) + 1;
    expect(byCat).toEqual({ standard: 29, single: 6, special: 9 });

    const byEv: Record<string, number> = {};
    for (const b of BOOSTER_CATALOG) byEv[b.evidenceLevel] = (byEv[b.evidenceLevel] ?? 0) + 1;
    expect(byEv).toEqual({
      screenshot_verified: 2,
      external_cross_verified: 27,
      effect_provisional: 14,
      conditional_unverified: 1,
    });
    expect(Object.values(byEv).reduce((a, x) => a + x, 0)).toBe(44);
  });
  it("effect_provisional 14 種 = 単一能力 category:single 6 種 ＋ レジェンド系 8 種", () => {
    const prov = BOOSTER_CATALOG.filter((b) => b.evidenceLevel === "effect_provisional");
    expect(prov).toHaveLength(14);
    const single = prov.filter((b) => b.category === "single").map((b) => b.key).sort();
    expect(single).toEqual(
      ["single-aggression", "single-balance", "single-ball-control", "single-jump", "single-physical-contact", "single-speed"],
    );
    const legends = prov.filter((b) => b.category === "special");
    expect(legends).toHaveLength(8);
    expect(legends.every((b) => !b.conditional)).toBe(true);
  });
  it("category:single は 6 種すべて maxLevel 6・単一能力へ +level", () => {
    const single = BOOSTER_CATALOG.filter((b) => b.category === "single");
    expect(single).toHaveLength(6);
    for (const b of single) {
      expect(b.maxLevel).toBe(6);
      expect(b.affectedStats).toHaveLength(1);
    }
  });
  it("confirmationStatus は screenshot_verified/external_cross_verified → confirmed（後方互換）", () => {
    expect(getBoosterDef("ball-carrying")?.confirmationStatus).toBe("confirmed");
    expect(getBoosterDef("shooting")?.confirmationStatus).toBe("confirmed");
    expect(getBoosterDef("total-package")?.confirmationStatus).toBe("provisional");
  });
  it("Goalkeeping の対象能力（World 実測で修正済み）", () => {
    expect(getBoosterDef("goalkeeping")?.affectedStats.sort()).toEqual(
      ["gkAwareness", "gkCatching", "gkParrying", "gkReflexes"].sort(),
    );
  });
  it("boosterDeltas: level ぶん各能力へ加算・上限クランプ", () => {
    const def = getBoosterDef("fantasista")!;
    expect(boosterDeltas(def, 3)).toEqual({ ballControl: 3, dribbling: 3, finishing: 3, balance: 3 });
    expect(boosterDeltas(def, 99)).toEqual(boosterDeltas(def, def.maxLevel));
  });
});

describe("isB2SelectableCandidate / isConfirmedB2Candidate（B2 選択肢の適格性・単一の真実源）", () => {
  it("conditional: true（total-package）は B2 選択肢から除外", () => {
    const tp = getBoosterDef("total-package")!;
    expect(tp.conditional).toBe(true);
    expect(isB2SelectableCandidate(tp)).toBe(false);
    expect(isConfirmedB2Candidate(tp)).toBe(false);
  });

  it("conditional: false のカタログ定義はすべて B2 選択肢として適格", () => {
    for (const b of BOOSTER_CATALOG) {
      if (!b.conditional) expect(isB2SelectableCandidate(b)).toBe(true);
    }
  });

  it("B2 選択肢は BOOSTER_CATALOG から conditional な 1 件だけを除いた 43 件", () => {
    const selectable = BOOSTER_CATALOG.filter(isB2SelectableCandidate);
    expect(selectable).toHaveLength(43);
    expect(selectable.some((b) => b.key === "total-package")).toBe(false);
  });

  it("確認済み B2 候補 = confirmationStatus:confirmed（screenshot_verified 2 + external_cross_verified 27 = 29 件）", () => {
    const confirmed = BOOSTER_CATALOG.filter(isConfirmedB2Candidate);
    expect(confirmed).toHaveLength(29);
    expect(confirmed.every((b) => b.confirmationStatus === "confirmed")).toBe(true);
    expect(confirmed.every((b) => !b.conditional)).toBe(true);
  });

  it("confirmationStatus:confirmed だが conditional な定義は存在しない（現状 total-package は provisional のため二重の理由で除外）", () => {
    const confirmedButConditional = BOOSTER_CATALOG.filter((b) => b.confirmationStatus === "confirmed" && b.conditional);
    expect(confirmedButConditional).toHaveLength(0);
  });

  it("「コードに定義がある」だけでは確認済みにしない: effect_provisional は isConfirmedB2Candidate で false", () => {
    for (const b of BOOSTER_CATALOG.filter((x) => x.evidenceLevel === "effect_provisional")) {
      expect(isConfirmedB2Candidate(b)).toBe(false);
    }
  });
});

describe("resolveAttachedBooster / appliesInMode", () => {
  it("対応表のキーはすべて BOOSTER_CATALOG に存在・level は maxLevel 以内", () => {
    for (const map of [WORLD_BOOST1_MAP, WORLD_BOOST2_MAP]) {
      for (const { key, level } of Object.values(map)) {
        const def = getBoosterDef(key);
        expect(def, key).toBeTruthy();
        expect(level).toBeLessThanOrEqual(def!.maxLevel);
      }
    }
  });
  it("boost1 と boost2 は別 ID 体系", () => {
    expect(resolveAttachedBooster("world", 1, 73)?.boosterKey).toBe("strength");
    expect(resolveAttachedBooster("world", 2, 73)?.boosterKey).toBe("single-ball-control");
  });
  it("ID 15 = Ball-carrying +5（screenshot_verified）→ 厳密/標準で適用", () => {
    const r = resolveAttachedBooster("world", 1, 15)!;
    expect(r).toMatchObject({ boosterKey: "ball-carrying", level: 5, evidenceLevel: "screenshot_verified", appliesInStrict: true, appliesInStandard: true });
    expect(r.perStatDelta).toEqual({ dribbling: 5, tightPossession: 5, speed: 5, balance: 5 });
  });
  it("Shooting +3（external_cross_verified）→ 標準では適用・厳密では不適用", () => {
    const r = resolveAttachedBooster("world", 1, 65)!;
    expect(r.evidenceLevel).toBe("external_cross_verified");
    expect(r.appliesInStrict).toBe(false);
    expect(r.appliesInStandard).toBe(true);
  });
  it("total-package（conditional）はどのモードでも通常値へ適用しない", () => {
    const r = resolveAttachedBooster("world", 1, 83)!;
    expect(r.evidenceLevel).toBe("conditional_unverified");
    expect(r.appliesInStrict).toBe(false);
    expect(r.appliesInStandard).toBe(false);
  });
  it("total-package: 発動条件は判明・ただし評価不能・全モードで未適用（v6）", () => {
    const def = getBoosterDef("total-package")!;
    expect(def.conditional).toBe(true);
    expect(def.evidenceLevel).toBe("conditional_unverified");
    expect(def.maxLevel).toBe(5);
    expect(def.affectedStats).toHaveLength(26);
    expect(def.conditionEvaluable).toBe(false);
    expect(def.conditionText).toMatch(/The Power of Many/);
    expect(def.conditionText).toMatch(/Game Plan/);
    const r = resolveAttachedBooster("world", 1, 83)!;
    expect(r.conditionText).toBe(def.conditionText);
    expect(r.conditionEvaluable).toBe(false);
    for (const m of ["strict", "standard", "experimental"] as const) {
      expect(appliesInMode("conditional_unverified", m)).toBe(false);
    }
  });
  it("非 conditional ブースターは conditionText なし・解決時 conditionEvaluable true", () => {
    const s = getBoosterDef("shooting")!;
    expect(s.conditionText ?? null).toBeNull();
    const r = resolveAttachedBooster("world", 1, 65)!; // Shooting +3
    expect(r.conditionText).toBeNull();
    expect(r.conditionEvaluable).toBe(true);
  });
  it("v7: 発動方式 activation を効果名と分離。boost2=44 = Ball Protection・power_of_many（金色）", () => {
    const r = resolveAttachedBooster("world", 2, 44)!;
    expect(r.boosterKey).toBe("ball-protection");
    expect(r.level).toBe(3);
    expect(r.evidenceLevel).toBe("external_cross_verified"); // 効果（4能力）の証拠は不変
    expect(r.activation).toBe("power_of_many");
    expect(r.appliesInStrict).toBe(false); // 金色はどのモードでも自動適用しない
    expect(r.appliesInStandard).toBe(false);
    expect(r.affectedStats.sort()).toEqual(["balance", "ballControl", "physicalContact", "tightPossession"].sort());
  });
  it("v7: 同じ効果名でも boost1=12 = Ball Protection・fixed（青）は標準へ適用", () => {
    const r = resolveAttachedBooster("world", 1, 12)!;
    expect(r.boosterKey).toBe("ball-protection");
    expect(r.activation).toBe("fixed");
    expect(r.appliesInStandard).toBe(true);
  });
  it("v8: boost1=12（derived fixed）は activationEvidence=provisional・activationConfirmed=false（推定）", () => {
    const r = resolveAttachedBooster("world", 1, 12)!;
    expect(r.activationEvidence).toBe("provisional");
    expect(r.activationConfirmed).toBe(false);
    // 挙動は不変: 標準へ自動適用は継続（1,931 を一括停止しない）
    expect(r.appliesInStandard).toBe(true);
    expect(r.reason).toMatch(/推定|区別できません/);
  });
  it("v8: boost2=44（Ball Protection PoM）は activationEvidence=screenshot_verified・confirmed", () => {
    const r = resolveAttachedBooster("world", 2, 44)!;
    expect(r.activationEvidence).toBe("screenshot_verified");
    expect(r.activationConfirmed).toBe(true);
  });
  it("v8: 代表的な derived fixed（Accuracy boost1=90 / Shooting boost1=65）はすべて provisional", () => {
    for (const [slot, id] of [[1, 90], [1, 65], [2, 30], [1, 42]] as const) {
      const r = resolveAttachedBooster("world", slot, id)!;
      expect(r.activation).toBe("fixed");
      expect(r.activationEvidence).toBe("provisional");
      expect(r.activationConfirmed).toBe(false);
    }
  });
  it("v7: total-package も activation=power_of_many（catalog conditional から導出）", () => {
    const r = resolveAttachedBooster("world", 1, 83)!;
    expect(r.activation).toBe("power_of_many");
    expect(r.affectedStats).toHaveLength(26);
    expect(r.activationEvidence).toBe("official_verified"); // v8: KONAMI 公式で明記
    expect(r.activationConfirmed).toBe(true);
  });
  it("v7: appliesInMode は power_of_many を全モードで false（証拠レベルに関係なく）", () => {
    for (const m of ["strict", "standard", "experimental"] as const) {
      expect(appliesInMode("external_cross_verified", m, "power_of_many")).toBe(false);
      expect(appliesInMode("screenshot_verified", m, "power_of_many")).toBe(false);
    }
    expect(appliesInMode("external_cross_verified", "standard", "fixed")).toBe(true);
  });
  it("v8: appliesInMode は live_update / unresolved も全モードで false", () => {
    for (const m of ["strict", "standard", "experimental"] as const) {
      expect(appliesInMode("game_client_verified", m, "live_update")).toBe(false);
      expect(appliesInMode("external_cross_verified", m, "unresolved")).toBe(false);
    }
  });
  it("appliesInMode: screenshot_verified は全モード、external は standard/experimental のみ", () => {
    expect(appliesInMode("screenshot_verified", "strict")).toBe(true);
    expect(appliesInMode("game_client_verified", "strict")).toBe(true);
    expect(appliesInMode("external_cross_verified", "strict")).toBe(false);
    expect(appliesInMode("external_cross_verified", "standard")).toBe(true);
    expect(appliesInMode("external_cross_verified", "experimental")).toBe(true);
    expect(appliesInMode("effect_provisional", "experimental")).toBe(false);
    expect(appliesInMode("conditional_unverified", "experimental")).toBe(false);
  });
  it("対応表に無い ID は null", () => {
    expect(resolveAttachedBooster("world", 1, 999)).toBeNull();
    expect(resolveAttachedBooster("world", 1, 59)).toBeNull();
  });
  it("カバレッジ定数", () => {
    expect(RESOLUTION_COVERAGE.worldBoost1Ids).toBeGreaterThanOrEqual(70);
    expect(RESOLUTION_COVERAGE.worldBoost2Ids).toBeGreaterThanOrEqual(14);
  });
  it("v8: auditActivation — confirmed_fixed は 0、fixed の大半は provisional（推定）、confirmed PoM は 2", () => {
    const a = auditActivation();
    // World のみ（eFHUB 2 ID を含めない）
    expect(a.world.confirmedFixedIdCount).toBe(0);
    expect(a.world.provisionalFixedIdCount).toBe(83); // boost1 70 + boost2 13
    expect(a.world.confirmedPowerOfManyIdCount).toBe(2); // total-package(83) + ball-protection(44)
    // eFHUB 2 ID を含める集計
    expect(a.withEfhub.confirmedFixedIdCount).toBe(0);
    expect(a.withEfhub.provisionalFixedIdCount).toBe(85);
    expect(a.withEfhub.confirmedPowerOfManyIdCount).toBe(2);
    // カード数（v8 で不変）
    expect(a.standardAppliedCardCount).toBe(1931);
    expect(a.conditionalSelectableCardCount).toBe(344);
    // World-only と with-eFHUB の PoM は同数（eFHUB マップに PoM は無い）
    expect(a.world.confirmedPowerOfManyIdCount).toBe(a.withEfhub.confirmedPowerOfManyIdCount);
  });
});

describe("calculatePlayerBooster: モード別のデルタ", () => {
  it("standard: screenshot_verified + external_cross_verified を appliedDeltas に", () => {
    const card: ProgressionCard = { ...MESSI_BIGTIME, boost1: 14 /* ball-carrying+3 */, boost2: 65 /* boost2 に 65 は無い→null */ };
    const r = calculatePlayerBooster(card, [], "standard");
    expect(r.gameMeasuredDeltas).toEqual({ dribbling: 3, tightPossession: 3, speed: 3, balance: 3 });
    expect(r.appliedDeltas.speed).toBe(3);
  });
  it("standard: external_cross_verified 付属（Shooting+3, boost1=65）は appliedDeltas に載る", () => {
    const card: ProgressionCard = { ...MESSI_BIGTIME, boost1: 65, boost2: 0 };
    const r = calculatePlayerBooster(card, [], "standard");
    expect(r.externalVerifiedDeltas).toEqual({ ballControl: 3, finishing: 3, kickingPower: 3, physicalContact: 3 });
    expect(r.appliedDeltas.finishing).toBe(3);
  });
  it("strict: external_cross_verified は appliedDeltas に載らず experimentalExtra へ", () => {
    const card: ProgressionCard = { ...MESSI_BIGTIME, boost1: 65, boost2: 0 };
    const r = calculatePlayerBooster(card, [], "strict");
    expect(r.appliedDeltas).toEqual({});
    expect(r.experimentalExtraDeltas.finishing).toBe(3);
  });
  it("strict: screenshot_verified は appliedDeltas に載る", () => {
    const card: ProgressionCard = { ...MESSI_BIGTIME, boost1: 15 /* ball-carrying+5 */, boost2: 0 };
    const r = calculatePlayerBooster(card, [], "strict");
    expect(r.appliedDeltas).toEqual({ dribbling: 5, tightPossession: 5, speed: 5, balance: 5 });
  });
  it("conditional 付属（total-package）は指定なしなら何も加算しない（自動判定しない）", () => {
    const tp: ProgressionCard = { ...MESSI_BIGTIME, boost1: 83, boost2: 0 };
    const r = calculatePlayerBooster(tp, [], "standard");
    expect(r.appliedDeltas).toEqual({});
    expect(Object.keys(r.experimentalExtraDeltas).length).toBe(0);
    expect(Object.keys(r.conditionalUserDeltas).length).toBe(0);
    expect(r.conditionalSelections).toEqual([]);
    // 最大効果候補は表示用として保持（最終値には足さない）
    expect(r.conditionalAttachedDeltas.speed).toBe(3);
  });
  it("conditional 付属: ユーザーが段階を手動指定すると conditionalUserDeltas に全26能力 +段階値", () => {
    const tp: ProgressionCard = { ...MESSI_BIGTIME, boost1: 83, boost2: 0 };
    const r = calculatePlayerBooster(tp, [], "standard", [
      { boosterKey: "total-package", selection: "league_14_19" },
    ]);
    expect(r.appliedDeltas).toEqual({}); // 標準値は不変
    expect(Object.keys(r.conditionalUserDeltas).length).toBe(26);
    expect(r.conditionalUserDeltas.speed).toBe(2);
    expect(r.experimentalExtraDeltas.speed).toBe(2);
    expect(r.conditionalSelections).toHaveLength(1);
    expect(r.conditionalSelections[0]).toMatchObject({ boosterKey: "total-package", selection: "league_14_19", level: 2 });
  });
  it("conditional 付属: 不正な段階・別ブースターへの指定は無視", () => {
    const tp: ProgressionCard = { ...MESSI_BIGTIME, boost1: 83, boost2: 0 };
    const r = calculatePlayerBooster(tp, [], "standard", [
      { boosterKey: "total-package", selection: "garbage" as never },
      { boosterKey: "shooting", selection: "league_20_plus" as never },
    ]);
    expect(Object.keys(r.conditionalUserDeltas).length).toBe(0);
    expect(r.conditionalSelections).toEqual([]);
  });
  it("conditional 付属を持たないカードで段階を指定しても何も起きない", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 0, boost2: 0 };
    const r = calculatePlayerBooster(card, [], "standard", [
      { boosterKey: "total-package", selection: "league_20_plus" },
    ]);
    expect(Object.keys(r.conditionalUserDeltas).length).toBe(0);
    expect(r.conditionalSelections).toEqual([]);
  });
  it("確認済みB2（ball-carrying・isConfirmedB2Candidate）は confirmedB2Deltas へ入り experimentalExtra には入らない", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 0, boost2: 0 };
    const r = calculatePlayerBooster(card, [{ slot: 1, boosterKey: "ball-carrying", level: 5 }], "standard");
    expect(r.confirmedB2Deltas.speed).toBe(5);
    expect(r.experimentalExtraDeltas.speed).toBeUndefined();
    expect(r.manualTrialDeltas.speed).toBe(5); // 後方互換: 全件を維持
    expect(r.selection.anyProvisional).toBe(false);
  });
  it("未確認B2（single-speed・effect_provisional）は常に experimentalExtra（通常値に入らない）", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 0, boost2: 0 };
    const r = calculatePlayerBooster(card, [{ slot: 1, boosterKey: "single-speed", level: 6 }], "standard");
    expect(r.appliedDeltas).toEqual({});
    expect(r.confirmedB2Deltas).toEqual({});
    expect(r.experimentalExtraDeltas.speed).toBe(6);
    expect(r.manualTrialDeltas.speed).toBe(6);
    expect(r.selection.anyProvisional).toBe(true);
  });
  it("evidenceSummary が証拠レベル別にラベルを持つ", () => {
    const card: ProgressionCard = { ...MESSI_BIGTIME, boost1: 15, boost2: 0 };
    const r = calculatePlayerBooster(card, [], "standard");
    expect(r.evidenceSummary.gameMeasured).toContain("Ball-carrying +5");
  });
});

describe("calculateBuild: strict / standard / experimental の最終値", () => {
  it("standard（既定）: screenshot_verified + external を finalValue へ", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 65 /* Shooting+3 */, boost2: 0 };
    const r = calculateBuild({ card, allocation: {} });
    const fin = r.stats.find((s) => s.key === "finishing")!;
    expect(fin.playerBoosterDelta).toBe(3);
    expect(fin.finalValue).toBe(fin.baseValue + 3);
    expect(fin.strictFinalValue).toBe(fin.baseValue); // 厳密では未適用
    expect(fin.standardFinalValue).toBe(fin.baseValue + 3);
  });
  it("strict: external_cross_verified は finalValue を動かさない（strictFinalValue = base）", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 65, boost2: 0 };
    const r = calculateBuild({ card, allocation: {}, boosterApplicationMode: "strict" });
    const fin = r.stats.find((s) => s.key === "finishing")!;
    expect(fin.playerBoosterDelta).toBe(0);
    expect(fin.finalValue).toBe(fin.baseValue);
    expect(fin.standardFinalValue).toBe(fin.baseValue + 3); // 常に持つ
  });
  it("ID 15 = Ball-carrying +5（screenshot_verified）は strict でも finalValue へ", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 15, boost2: 0 };
    const strict = calculateBuild({ card, allocation: {}, boosterApplicationMode: "strict" });
    const dr = strict.stats.find((s) => s.key === "dribbling")!;
    expect(dr.playerBoosterDelta).toBe(5);
    expect(dr.finalValue).toBe(dr.baseValue + 5);
  });
  it("conditional 付属（total-package）: 段階未指定なら標準・条件反映後・試算がすべて同じ", () => {
    const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 }, allocation: {} });
    const s = r.stats.find((x) => x.key === "speed")!;
    expect(s.finalValue).toBe(s.standardFinalValue);
    expect(s.playerBoosterDelta).toBe(0);
    expect(s.conditionalBoosterDelta).toBe(0);
    expect(s.experimentalPlayerBoosterDelta).toBe(0);
    expect(s.conditionalFinalValue).toBe(s.standardFinalValue);
    expect(s.experimentalFinalValue).toBe(s.standardFinalValue);
    expect(r.booster.hasConditionalAttached).toBe(true);
    expect(r.booster.hasConditionalSelection).toBe(false);
  });
  it("conditional 付属（total-package）: 段階を手動指定すると conditionalFinalValue だけ変化", () => {
    const base = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 }, allocation: {} });
    const r = calculateBuild({
      card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 },
      allocation: {},
      selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_20_plus" }],
    });
    const s = r.stats.find((x) => x.key === "speed")!;
    const b0 = base.stats.find((x) => x.key === "speed")!;
    expect(s.strictFinalValue).toBe(b0.strictFinalValue); // 不変
    expect(s.standardFinalValue).toBe(b0.standardFinalValue); // 不変
    expect(s.finalValue).toBe(s.standardFinalValue); // 通常モード値は不変
    expect(s.playerBoosterDelta).toBe(0);
    expect(s.conditionalBoosterDelta).toBe(3);
    expect(s.manualTrialBoosterDelta).toBe(0);
    expect(s.conditionalFinalValue).toBe(Math.min(99, s.standardFinalValue + 3));
    expect(s.conditionalFinalValue).not.toBe(s.standardFinalValue);
    expect(r.booster.hasConditionalSelection).toBe(true);
    expect(r.booster.conditionalTotal).toBe(3 * 26);
    expect(r.booster.conditionalSelections[0]).toMatchObject({ selection: "league_20_plus", level: 3 });
    expect(r.booster.conditionalRulesVersion).toBe("conditional-booster/2026-08-28.v2");
  });
  it("conditional 付属（total-package）: 段階指定 + 手動試算（別スロット）は別バケット（混ざらない）", () => {
    const r = calculateBuild({
      card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 },
      allocation: {},
      selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_1_13" }],
      selectedPlayerBoosters: [{ slot: 2, boosterKey: "single-speed", level: 6 }],
    });
    const s = r.stats.find((x) => x.key === "speed")!;
    expect(s.conditionalBoosterDelta).toBe(1); // Total Package 段階
    expect(s.manualTrialBoosterDelta).toBe(6); // 手動試算（single-speed）
    expect(s.conditionalFinalValue).toBe(Math.min(99, s.standardFinalValue + 1));
    expect(s.experimentalPlayerBoosterDelta).toBe(7); // 条件1 + 試算6
  });
  it("確認済みB2（ball-carrying）は standardFinalValue へ反映・experimentalFinalValue は二重加算しない", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 0, boost2: 0 };
    const base = calculateBuild({ card, allocation: {} });
    const r = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 3 }] });
    const s = r.stats.find((x) => x.key === "dribbling")!;
    const b0 = base.stats.find((x) => x.key === "dribbling")!;
    expect(s.confirmedB2BoosterDelta).toBe(3);
    expect(s.playerBoosterDelta).toBe(3); // standard モードの採用値へ反映
    expect(s.standardFinalValue).toBe(Math.min(99, b0.standardFinalValue + 3));
    expect(s.finalValue).toBe(s.standardFinalValue); // 現在モード（standard）値と一致
    expect(s.experimentalFinalValue).toBe(s.standardFinalValue); // 二重加算しない（標準に既に含む）
    expect(r.booster.hasManualTrial).toBe(true);
    expect(r.booster.hasConfirmedB2).toBe(true);
    expect(r.booster.confirmedB2Total).toBe(3 * 4); // ball-carrying の対象4能力
  });
  it("未確認B2（single-speed）は finalValue 不変・experimentalFinalValue にのみ乗る", () => {
    const card: ProgressionCard = { ...CANNAVARO_EPIC, boost1: 0, boost2: 0 };
    const r = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "single-speed", level: 3 }] });
    const s = r.stats.find((x) => x.key === "speed")!;
    expect(s.confirmedB2BoosterDelta).toBe(0);
    expect(s.playerBoosterDelta).toBe(0);
    expect(s.finalValue).toBe(s.standardFinalValue);
    expect(s.experimentalFinalValue).toBe(Math.min(99, s.standardFinalValue + 3));
    expect(r.booster.hasManualTrial).toBe(true);
    expect(r.booster.hasConfirmedB2).toBe(false);
    expect(r.booster.confirmedB2Total).toBe(0);
  });
  it("booster サマリ: applicationMode / evidenceSummary / warnings", () => {
    const r = calculateBuild({ card: { ...CANNAVARO_EPIC, boost1: 65, boost2: 0 }, allocation: {} });
    expect(r.booster.applicationMode).toBe("standard");
    expect(r.booster.evidenceSummary.externalCrossVerified).toContain("Shooting +3");
    expect(r.booster.warnings.length).toBeGreaterThan(0); // KONAMI 公式未確認の注記
    const strict = calculateBuild({ card: { ...CANNAVARO_EPIC, boost1: 65, boost2: 0 }, allocation: {}, boosterApplicationMode: "strict" });
    expect(strict.booster.warnings).toEqual([]);
  });
});

describe("B2標準統合: confirmedB2Deltas / standardFinalValue（本マイルストーン）", () => {
  const CLEAN = (card: ProgressionCard = CANNAVARO_EPIC): ProgressionCard => ({ ...card, boost1: 0, boost2: 0 });

  describe("B2なし（回帰）", () => {
    it("confirmedB2BoosterDelta は全能力で 0・非対象能力は不変", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {} });
      for (const s of r.stats) {
        expect(s.confirmedB2BoosterDelta).toBe(0);
        expect(s.playerBoosterDelta).toBe(0);
        expect(s.finalValue).toBe(s.baseValue);
        expect(s.standardFinalValue).toBe(s.baseValue);
        expect(s.experimentalFinalValue).toBe(s.baseValue);
        expect(s.conditionalFinalValue).toBe(s.baseValue);
      }
      expect(r.booster.confirmedB2Total).toBe(0);
      expect(r.booster.hasConfirmedB2).toBe(false);
      expect(Object.values(r.playerBoosterByStat).every((v) => v.confirmedB2 === 0)).toBe(true);
    });
    it("B1（付属）のみの結果は本マイルストーン前後で不変", () => {
      const r = calculateBuild({ card: { ...CANNAVARO_EPIC, boost1: 65, boost2: 0 }, allocation: {} });
      const fin = r.stats.find((s) => s.key === "finishing")!;
      expect(fin.playerBoosterDelta).toBe(3);
      expect(fin.standardFinalValue).toBe(fin.baseValue + 3);
      expect(fin.confirmedB2BoosterDelta).toBe(0);
      expect(r.booster.hasConfirmedB2).toBe(false);
    });
    it("Power of Many（total-package・未指定）は不変", () => {
      const r = calculateBuild({ card: { ...MESSI_BIGTIME, boost1: 83, boost2: 0 }, allocation: {} });
      const s = r.stats.find((x) => x.key === "speed")!;
      expect(s.conditionalBoosterDelta).toBe(0);
      expect(s.confirmedB2BoosterDelta).toBe(0);
      expect(s.finalValue).toBe(s.standardFinalValue);
      expect(r.booster.hasConditionalAttached).toBe(true);
      expect(r.booster.hasConfirmedB2).toBe(false);
    });
    it("監督補正は不変（confirmedB2 と独立）", () => {
      const r = calculateBuild({
        card: MESSI_BIGTIME,
        allocation: {},
        manager: {
          internalManagerId: 42, sourceManagerId: "conte", managerName: "Antonio Conte",
          boosterEffects: [{ statKey: "kickingPower", statNameEn: "Kicking Power", delta: 1, confirmationStatus: "confirmed" }],
          tacticalProficiencies: null, applicationCondition: null,
          ruleVersion: PROGRESSION_RULES_VERSION, confirmationStatus: "confirmed",
        },
      });
      const kp = r.stats.find((s) => s.key === "kickingPower")!;
      expect(kp.managerBoosterDelta).toBe(1);
      expect(kp.confirmedB2BoosterDelta).toBe(0);
      expect(r.manager.applied).toBe(true);
    });
  });

  describe("確認済みB2", () => {
    it("対象能力だけが定義値ぶん上昇・非対象能力は不変", () => {
      const card = CLEAN();
      const r = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 4 }] });
      const targets = ["dribbling", "tightPossession", "speed", "balance"];
      for (const s of r.stats) {
        if (targets.includes(s.key)) {
          expect(s.confirmedB2BoosterDelta).toBe(4);
          expect(s.standardFinalValue).toBe(s.baseValue + 4);
        } else {
          expect(s.confirmedB2BoosterDelta).toBe(0);
          expect(s.standardFinalValue).toBe(s.baseValue);
        }
      }
    });
    it("B2効果は1回だけ加算される（standard 側で1回・experimental 側では加算しない）", () => {
      const card = CLEAN();
      const r = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 4 }] });
      const s = r.stats.find((x) => x.key === "speed")!;
      // uncapped 合計 = base + confirmedB2（1回のみ）と一致する内訳になっていること
      expect(s.baseValue + s.confirmedB2BoosterDelta).toBe(s.standardFinalValue);
      expect(s.experimentalFinalValue).toBe(s.standardFinalValue);
      expect(s.experimentalPlayerBoosterDelta).toBe(0);
    });
    it("conditionalFinalValue は新しい standardFinalValue の上に正しく積み上がる", () => {
      const card = CLEAN();
      const withB2 = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 2 }] });
      const s = withB2.stats.find((x) => x.key === "speed")!;
      expect(s.conditionalFinalValue).toBe(s.standardFinalValue); // 条件未指定なら同値
    });
    it("B1（付属・別スロット）との併用: それぞれ独立に加算", () => {
      const card = { ...CANNAVARO_EPIC, boost1: 65 /* Shooting+3 → finishing */, boost2: 0 };
      const r = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 2, boosterKey: "ball-carrying", level: 2 }] });
      const fin = r.stats.find((s) => s.key === "finishing")!;
      const spd = r.stats.find((s) => s.key === "speed")!;
      expect(fin.standardFinalValue).toBe(fin.baseValue + 3); // B1 のみ
      expect(fin.confirmedB2BoosterDelta).toBe(0);
      expect(spd.standardFinalValue).toBe(spd.baseValue + 2); // B2 のみ
      expect(spd.confirmedB2BoosterDelta).toBe(2);
    });
    it("Power of Many（別スロット・段階指定）との併用: バケットが混ざらない", () => {
      const card = { ...MESSI_BIGTIME, boost1: 83 /* total-package */, boost2: 0 };
      const r = calculateBuild({
        card,
        allocation: {},
        selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_20_plus" }],
        selectedPlayerBoosters: [{ slot: 2, boosterKey: "ball-carrying", level: 2 }],
      });
      const s = r.stats.find((x) => x.key === "speed")!; // total-package と ball-carrying 両方の対象
      expect(s.conditionalBoosterDelta).toBe(3); // PoM 段階分のみ
      expect(s.confirmedB2BoosterDelta).toBe(2); // 確認済み B2 分のみ
      expect(s.standardFinalValue).toBe(Math.min(99, s.baseValue + 2)); // PoM は標準値に含まない
      expect(s.conditionalFinalValue).toBe(Math.min(99, s.standardFinalValue + 3));
    });
    it("監督補正（別能力）との併用: 独立に加算", () => {
      const r = calculateBuild({
        card: CLEAN(),
        allocation: {},
        selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 3 }],
        manager: {
          internalManagerId: 1, sourceManagerId: "m1", managerName: "Test",
          boosterEffects: [{ statKey: "kickingPower", statNameEn: "Kicking Power", delta: 2, confirmationStatus: "confirmed" }],
          tacticalProficiencies: null, applicationCondition: null,
          ruleVersion: PROGRESSION_RULES_VERSION, confirmationStatus: "confirmed",
        },
      });
      const kp = r.stats.find((s) => s.key === "kickingPower")!;
      const spd = r.stats.find((s) => s.key === "speed")!;
      expect(kp.managerBoosterDelta).toBe(2);
      expect(kp.confirmedB2BoosterDelta).toBe(0);
      expect(spd.managerBoosterDelta).toBe(0);
      expect(spd.confirmedB2BoosterDelta).toBe(3);
      expect(spd.standardFinalValue).toBe(spd.baseValue + 3);
    });
    it("能力値上限: confirmedB2 込みで 99 にクランプされる", () => {
      const r = calculateBuild({ card: { ...NEAR_CAP_CARD, boost1: 0, boost2: 0 }, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 5 }] });
      const dr = r.stats.find((s) => s.key === "dribbling")!; // baseValue 99
      expect(dr.baseValue + dr.confirmedB2BoosterDelta).toBeGreaterThan(99);
      expect(dr.standardFinalValue).toBe(99);
      expect(dr.capApplied).toBe(true);
      expect(r.finalCapApplied).toBe(true);
    });
    it("丸め規則: レベルは 1..maxLevel へクランプ・整数化（既存 boosterDeltas のまま）", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 2.9 }] });
      const s = r.stats.find((x) => x.key === "speed")!;
      expect(s.confirmedB2BoosterDelta).toBe(2); // Math.trunc(2.9) = 2
      const over = calculateBuild({ card: CLEAN(), allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 99 }] });
      const so = over.stats.find((x) => x.key === "speed")!;
      expect(so.confirmedB2BoosterDelta).toBe(5); // maxLevel でクランプ
    });
    it("B2解除で基準値へ戻る", () => {
      const card = CLEAN();
      const withB2 = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 3 }] });
      const cleared = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [] });
      const s0 = withB2.stats.find((x) => x.key === "speed")!;
      const s1 = cleared.stats.find((x) => x.key === "speed")!;
      expect(s0.standardFinalValue).toBe(s0.baseValue + 3);
      expect(s1.standardFinalValue).toBe(s1.baseValue);
      expect(s1.confirmedB2BoosterDelta).toBe(0);
    });
    it("B2変更時に前の効果が残らない（純関数・内部状態を持たない）", () => {
      const card = CLEAN();
      const first = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 5 }] });
      const second = calculateBuild({ card, allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "offence-creator", level: 4 }] });
      const speedAfterSwitch = second.stats.find((x) => x.key === "speed")!;
      const oaAfterSwitch = second.stats.find((x) => x.key === "offensiveAwareness")!;
      expect(speedAfterSwitch.confirmedB2BoosterDelta).toBe(0); // ball-carrying の効果が残っていない
      expect(oaAfterSwitch.confirmedB2BoosterDelta).toBe(4); // offence-creator のみ
      expect(first).not.toBe(second);
    });
    it("複数スロットの確認済みB2: 対象能力ごとに正しく内訳が積み上がり二重集計しない", () => {
      const card = CLEAN();
      const r = calculateBuild({
        card,
        allocation: {},
        selectedPlayerBoosters: [
          { slot: 1, boosterKey: "ball-carrying", level: 2 }, // dribbling/tightPossession/speed/balance
          { slot: 2, boosterKey: "offence-creator", level: 3 }, // offensiveAwareness/ballControl/lowPass/kickingPower
        ],
      });
      const speed = r.stats.find((s) => s.key === "speed")!;
      const oa = r.stats.find((s) => s.key === "offensiveAwareness")!;
      const finishing = r.stats.find((s) => s.key === "finishing")!; // どちらの対象にも含まれない
      expect(speed.confirmedB2BoosterDelta).toBe(2);
      expect(oa.confirmedB2BoosterDelta).toBe(3);
      expect(finishing.confirmedB2BoosterDelta).toBe(0);
      expect(r.booster.confirmedB2Total).toBe(2 * 4 + 3 * 4); // 各4能力 × レベル
      expect(r.booster.hasConfirmedB2).toBe(true);
    });
  });

  describe("未確認B2", () => {
    it("confirmedB2Deltas へ入らず標準値へ昇格しない・既存 experimental 経路を維持", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "single-speed", level: 4 }] });
      const s = r.stats.find((x) => x.key === "speed")!;
      expect(s.confirmedB2BoosterDelta).toBe(0);
      expect(s.standardFinalValue).toBe(s.baseValue);
      expect(s.experimentalPlayerBoosterDelta).toBe(4);
      expect(s.experimentalFinalValue).toBe(s.baseValue + 4);
      expect(r.booster.hasConfirmedB2).toBe(false);
    });
    it("未確認B2の保存値を削除・自動変換しない（selection.applied に残る）", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "single-speed", level: 4 }] });
      expect(r.playerBoosterSelection.applied).toHaveLength(1);
      expect(r.playerBoosterSelection.applied[0]).toMatchObject({ boosterKey: "single-speed", level: 4, applied: true });
      expect(r.playerBoosterSelection.anyProvisional).toBe(true);
    });
  });

  describe("total-package（Power of Many 専用・B2 候補から除外）", () => {
    it("isConfirmedB2Candidate は false（正式B2候補へ入らない）", () => {
      const def = getBoosterDef("total-package")!;
      expect(isConfirmedB2Candidate(def)).toBe(false);
      expect(isB2SelectableCandidate(def)).toBe(false);
    });
    it("過去の B2 保存値（total-package）は破棄せず試算経路のまま維持", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "total-package", level: 2 }] });
      expect(r.playerBoosterSelection.applied).toHaveLength(1); // 削除しない
      const s = r.stats.find((x) => x.key === "speed")!;
      expect(s.confirmedB2BoosterDelta).toBe(0); // 標準値へは昇格しない
      expect(s.experimentalPlayerBoosterDelta).toBe(2); // 試算のみ
    });
    it("conditionalBoosterSelections（Power of Many の正規経路）とは区分を維持", () => {
      const card = { ...MESSI_BIGTIME, boost1: 83, boost2: 0 };
      const r = calculateBuild({
        card,
        allocation: {},
        selectedConditionalBoosters: [{ boosterKey: "total-package", selection: "league_1_13" }],
      });
      const s = r.stats.find((x) => x.key === "speed")!;
      expect(s.conditionalBoosterDelta).toBe(1);
      expect(s.confirmedB2BoosterDelta).toBe(0); // B2 経路とは無関係
      expect(r.booster.hasConditionalSelection).toBe(true);
      expect(r.booster.hasConfirmedB2).toBe(false);
    });
  });

  describe("型とサマリー", () => {
    it("0件: confirmedB2Total=0・hasConfirmedB2=false・playerBoosterByStat 全 confirmedB2=0", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {} });
      expect(r.booster.confirmedB2Total).toBe(0);
      expect(r.booster.hasConfirmedB2).toBe(false);
      expect(Object.values(r.playerBoosterByStat).every((v) => v.confirmedB2 === 0)).toBe(true);
    });
    it("1件・単一対象能力群: confirmedB2Total と playerBoosterByStat が一致", () => {
      const r = calculateBuild({ card: CLEAN(), allocation: {}, selectedPlayerBoosters: [{ slot: 1, boosterKey: "ball-carrying", level: 3 }] });
      expect(r.booster.confirmedB2Total).toBe(3 * 4);
      expect(r.booster.hasConfirmedB2).toBe(true);
      expect(r.playerBoosterByStat.speed.confirmedB2).toBe(3);
      expect(r.playerBoosterByStat.finishing?.confirmedB2 ?? 0).toBe(0); // 対象外のためキー自体が無いこともある
      expect(r.stats.find((s) => s.key === "speed")!.confirmedB2BoosterDelta).toBe(3);
    });
    it("複数対象能力・2件選択: 合計が能力ごと・全体ともに二重集計なし", () => {
      const r = calculateBuild({
        card: CLEAN(),
        allocation: {},
        selectedPlayerBoosters: [
          { slot: 1, boosterKey: "ball-carrying", level: 2 },
          { slot: 2, boosterKey: "offence-creator", level: 1 },
        ],
      });
      const sumFromStats = r.stats.reduce((acc, s) => acc + s.confirmedB2BoosterDelta, 0);
      expect(sumFromStats).toBe(r.booster.confirmedB2Total);
      expect(r.booster.confirmedB2Total).toBe(2 * 4 + 1 * 4);
      expect(r.playerBoosterByStat.speed.confirmedB2).toBe(2);
      expect(r.playerBoosterByStat.offensiveAwareness.confirmedB2).toBe(1);
    });
  });
});
