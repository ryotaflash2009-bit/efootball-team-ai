import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  INITIAL_EDITOR_STATE,
  abilityDiffs,
  abilityRole,
  allocationChips,
  allocationWithGroupLevel,
  costBetweenLevels,
  editorReducer,
  focusForGroup,
  focusForStat,
  groupSliderModel,
  levelForKey,
  levelFromRatio,
  nextCostAtLevel,
} from "./ability-direct-editor";
import { getBuild, saveBuild } from "./build-storage";
import { sameAllocation, saveCurrentBuild } from "./save-current-build";
import { buildSavedBuildExportFile, serializeSavedBuildExport } from "./build-export";
import { parseImportText, validateImportBuilds } from "./build-import";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { calculateBuild } from "./engine";
import { adjustGroupLevel, summarizeGroupPoints, usedPoints } from "./group-allocation";
import { PROGRESSION_GROUPS } from "./stat-groups";
import { MESSI_BIGTIME, NEAR_CAP_CARD } from "./fixtures";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import type { ManagerContext } from "./types";

const MESSI = MESSI_BIGTIME; // 最大Lv32 → 62pt

describe("能力値 → カテゴリ・関連能力（stat-groups が唯一の対応表）", () => {
  it("ボールキープはドリブルカテゴリで、関連はボールコントロール・ドリブル・ボールキープ", () => {
    const f = focusForStat("tightPossession");
    expect(f).toEqual({ ok: true, focus: { primaryStat: "tightPossession", groupId: "dribbling", relatedStats: ["ballControl", "dribbling", "tightPossession"] } });
  });

  it("26能力すべてがちょうど1カテゴリに対応し、関連能力はそのカテゴリの対象と一致する", () => {
    for (const key of WORLD_STAT_KEYS) {
      const f = focusForStat(key);
      expect(f.ok, key).toBe(true);
      if (f.ok) expect(PROGRESSION_GROUPS.find((g) => g.groupId === f.focus.groupId)!.affectedStats).toEqual(f.focus.relatedStats);
    }
  });

  it("未知の能力・未知のカテゴリは安全に拒否する", () => {
    expect(focusForStat("unknownStat")).toEqual({ ok: false, error: "unknown_ability" });
    expect(focusForGroup("nope")).toEqual({ ok: false, error: "unknown_category" });
  });

  it("primary / related / unrelated / none を区別する（左右の列に分かれていても同じカテゴリなら related）", () => {
    const f = focusForStat("tightPossession");
    if (!f.ok) throw new Error();
    expect(abilityRole(f.focus, "tightPossession")).toBe("primary");
    expect(abilityRole(f.focus, "ballControl")).toBe("related");
    expect(abilityRole(f.focus, "finishing")).toBe("unrelated");
    expect(abilityRole(null, "finishing")).toBe("none");
    const g = focusForGroup("dribbling");
    if (!g.ok) throw new Error();
    expect(abilityRole(g.focus, "tightPossession")).toBe("related");
  });
});

describe("スライダーのモデル（レベル単位・非線形コスト）", () => {
  it("min 0・現在値・絶対上限（99まで）・到達可能上限・次のコスト", () => {
    const m = groupSliderModel({}, MESSI, "dribbling");
    expect(m).toMatchObject({ min: 0, current: 0, absoluteMax: 13, reachableMax: 13, totalPoints: 62, usedPoints: 0, remainingPoints: 62, nextCost: 1, canIncrease: true, canDecrease: false, atCategoryMax: false, limitedByPoints: false });
  });

  it("累積コストは段階制（0-4は1pt、5-9は2pt、10-は3pt…）で、スライダー値そのものではない", () => {
    expect(costBetweenLevels(0, 5)).toBe(5);
    expect(costBetweenLevels(5, 8)).toBe(6);
    expect(costBetweenLevels(0, 13)).toBe(24);
    expect(costBetweenLevels(8, 5)).toBe(-6);
    expect(costBetweenLevels(3, 3)).toBe(0);
  });

  it("ポイント不足ではその手前（到達可能上限）で止まり、理由として limitedByPoints を返す", () => {
    const m = groupSliderModel({}, MESSI, "defending");
    expect(m.absoluteMax).toBe(57);
    expect(m.reachableMax).toBe(22); // 62pt で届く最大
    expect(m.limitedByPoints).toBe(true);
    const a = allocationWithGroupLevel({}, MESSI, "defending", 57);
    expect(a.defending).toBe(22);
    expect(usedPoints(a)).toBeLessThanOrEqual(62);
  });

  it("他カテゴリで使ったポイントも反映する（残りポイント）", () => {
    const alloc = allocationWithGroupLevel({}, MESSI, "defending", 20); // 50pt
    const m = groupSliderModel(alloc, MESSI, "dribbling");
    expect(m.remainingPoints).toBe(12);
    expect(m.reachableMax).toBe(8); // L8 = 5 + 2*3 = 11 ≤ 12、L9 は 13
  });

  it("残りポイント0では＋不可・－は可", () => {
    const alloc = allocationWithGroupLevel({ defending: 0 }, MESSI, "defending", 22);
    const spent = usedPoints(alloc);
    const m = groupSliderModel(alloc, MESSI, "defending");
    expect(m.canIncrease).toBe(false);
    expect(m.canDecrease).toBe(true);
    const other = groupSliderModel(alloc, MESSI, "shooting");
    expect(other.remainingPoints).toBe(62 - spent);
    expect(other.canIncrease).toBe(62 - spent >= 1);
  });

  it("カテゴリ上限（能力99）で止まる", () => {
    const m = groupSliderModel({}, NEAR_CAP_CARD, "dribbling");
    expect(m.absoluteMax).toBe(2);
    const a = allocationWithGroupLevel({}, NEAR_CAP_CARD, "dribbling", 10);
    expect(a.dribbling).toBe(2);
    expect(groupSliderModel(a, NEAR_CAP_CARD, "dribbling")).toMatchObject({ atCategoryMax: true, canIncrease: false, nextCost: null });
  });

  it("負数・小数・NaN は整数の安全な値へ（負数にならない）", () => {
    expect(allocationWithGroupLevel({ dribbling: 3 }, MESSI, "dribbling", -5).dribbling).toBeUndefined();
    expect(allocationWithGroupLevel({}, MESSI, "dribbling", 2.7).dribbling).toBe(2);
    expect(allocationWithGroupLevel({ dribbling: 3 }, MESSI, "dribbling", Number.NaN)).toEqual({ dribbling: 3 });
  });

  it("スライダーでの設定は＋／－の繰り返しと同じ結果になる（同じ計算）", () => {
    let viaStep: Record<string, number> = {};
    for (let i = 0; i < 8; i++) viaStep = adjustGroupLevel(viaStep, MESSI, "dribbling", 1);
    expect(allocationWithGroupLevel({}, MESSI, "dribbling", 8)).toEqual(viaStep);
  });
});

describe("配分チップ", () => {
  it("全10カテゴリを並べ、合計コストが使用ポイントと一致する", () => {
    let alloc = allocationWithGroupLevel({}, MESSI, "dribbling", 7);
    alloc = allocationWithGroupLevel(alloc, MESSI, "passing", 4);
    const chips = allocationChips(alloc, MESSI);
    expect(chips.map((c) => c.groupId)).toEqual(PROGRESSION_GROUPS.map((g) => g.groupId));
    expect(chips.reduce((s, c) => s + c.cost, 0)).toBe(summarizeGroupPoints(alloc, MESSI).usedPoints);
    expect(chips.find((c) => c.groupId === "dribbling")).toMatchObject({ level: 7, cost: 9, atMax: false });
    expect(chips.filter((c) => c.isGoalkeeping)).toHaveLength(3);
  });
});

describe("プレビュー（育成・監督・ブースターの区別）", () => {
  it("ドリブル+3 でボールキープ等の最終値が +3、無関係な能力は変わらない", () => {
    const before = calculateBuild({ card: MESSI, allocation: {} });
    const after = calculateBuild({ card: MESSI, allocation: allocationWithGroupLevel({}, MESSI, "dribbling", 3) });
    const d = abilityDiffs(before.stats, after.stats);
    expect(d.get("tightPossession")).toMatchObject({ before: 86, after: 89, delta: 3, progressionBefore: 0, progressionAfter: 3 });
    expect(d.get("ballControl")!.delta).toBe(3);
    expect(d.get("finishing")!.delta).toBe(0);
  });

  it("監督補正は育成の差分と別に保たれる（最終値 = 基礎 + 育成 + ブースター + 監督）", () => {
    const manager: ManagerContext = {
      internalManagerId: 1,
      sourceManagerId: "t",
      managerName: "Test",
      boosterEffects: [{ statKey: "tightPossession", statNameEn: "Tight Possession", delta: 1, confirmationStatus: "confirmed" }],
      tacticalProficiencies: null,
      applicationCondition: null,
      ruleVersion: "test",
      confirmationStatus: "confirmed",
    };
    const alloc = allocationWithGroupLevel({}, MESSI, "dribbling", 3);
    const withMgr = calculateBuild({ card: MESSI, allocation: alloc, manager });
    const s = withMgr.stats.find((x) => x.key === "tightPossession")!;
    expect(s.progressionDelta).toBe(3);
    expect(s.managerBoosterDelta).toBe(1);
    expect(s.finalValue).toBe(Math.min(99, s.baseValue + s.progressionDelta + s.playerBoosterDelta + s.managerBoosterDelta + s.otherDelta));
  });
});

describe("共有 reducer（能力タップ・チップ・スライダー）", () => {
  const alloc = { dribbling: 5 };

  it("能力タップで選択し、同じ能力の再タップ・clear で解除する", () => {
    const s1 = editorReducer(INITIAL_EDITOR_STATE, { type: "selectStat", statKey: "tightPossession", allocation: alloc });
    expect(s1.focus?.groupId).toBe("dribbling");
    expect(s1.baseline).toEqual(alloc);
    expect(editorReducer(s1, { type: "selectStat", statKey: "tightPossession", allocation: alloc })).toEqual(INITIAL_EDITOR_STATE);
    expect(editorReducer(s1, { type: "clear" })).toEqual(INITIAL_EDITOR_STATE);
  });

  it("同じカテゴリの別能力へ移っても変更前の基準は保つ。別カテゴリでは新しい基準", () => {
    const s1 = editorReducer(INITIAL_EDITOR_STATE, { type: "selectStat", statKey: "tightPossession", allocation: alloc });
    const s2 = editorReducer(s1, { type: "selectStat", statKey: "ballControl", allocation: { dribbling: 8 } });
    expect(s2.focus?.primaryStat).toBe("ballControl");
    expect(s2.baseline).toEqual(alloc);
    const s3 = editorReducer(s2, { type: "selectStat", statKey: "finishing", allocation: { dribbling: 8 } });
    expect(s3.focus?.groupId).toBe("shooting");
    expect(s3.baseline).toEqual({ dribbling: 8 });
  });

  it("チップでカテゴリを選ぶ（主能力なし）。同じチップの再タップで解除。未知カテゴリは無視", () => {
    const s1 = editorReducer(INITIAL_EDITOR_STATE, { type: "selectGroup", groupId: "passing", allocation: alloc });
    expect(s1.focus).toMatchObject({ primaryStat: null, groupId: "passing" });
    expect(editorReducer(s1, { type: "selectGroup", groupId: "passing", allocation: alloc })).toEqual(INITIAL_EDITOR_STATE);
    expect(editorReducer(s1, { type: "selectGroup", groupId: "zzz", allocation: alloc })).toBe(s1);
  });

  it("ドラッグ: 到達可能上限で止め、到達不能を示す。終了・キャンセルでプレビューを消す", () => {
    const model = groupSliderModel({}, MESSI, "defending");
    let s = editorReducer(INITIAL_EDITOR_STATE, { type: "selectStat", statKey: "tackling", allocation: {} });
    s = editorReducer(s, { type: "dragStart", level: 0 });
    s = editorReducer(s, { type: "dragMove", requested: 5.4, model });
    expect(s.dragLevel).toBe(5);
    s = editorReducer(s, { type: "dragMove", requested: 40, model });
    expect(s).toMatchObject({ dragLevel: 22, dragBlocked: true });
    s = editorReducer(s, { type: "dragMove", requested: -3, model });
    expect(s).toMatchObject({ dragLevel: 0, dragBlocked: false });
    expect(editorReducer(s, { type: "dragCancel" })).toMatchObject({ dragLevel: null, dragOrigin: null });
    expect(editorReducer(s, { type: "dragEnd" }).dragLevel).toBeNull();
  });

  it("未選択ではドラッグを始めない", () => {
    expect(editorReducer(INITIAL_EDITOR_STATE, { type: "dragStart", level: 3 })).toBe(INITIAL_EDITOR_STATE);
  });

  it("スライダー位置 → 整数レベルへ snap、キー操作は ±1・Home・End", () => {
    expect(levelFromRatio(0.5, 13)).toBe(7);
    expect(levelFromRatio(-1, 13)).toBe(0);
    expect(levelFromRatio(2, 13)).toBe(13);
    expect(levelFromRatio(0.5, 0)).toBe(0);
    const m = groupSliderModel({ defending: 3 }, MESSI, "defending");
    expect(levelForKey("ArrowRight", m)).toBe(4);
    expect(levelForKey("ArrowUp", m)).toBe(4);
    expect(levelForKey("ArrowLeft", m)).toBe(2);
    expect(levelForKey("ArrowDown", m)).toBe(2);
    expect(levelForKey("Home", m)).toBe(0);
    expect(levelForKey("End", m)).toBe(22);
    expect(levelForKey("a", m)).toBeNull();
  });
});

describe("次の強化コスト（表示中レベル基準）", () => {
  it("段階コストに従い、上限では null", () => {
    expect(nextCostAtLevel(0, 13)).toBe(1);
    expect(nextCostAtLevel(5, 13)).toBe(2);
    expect(nextCostAtLevel(22, 57)).toBe(5);
    expect(nextCostAtLevel(13, 13)).toBeNull();
  });
});

describe("保存・再読込・JSON export/import（既存の保存契約をそのまま使う）", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    const map = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => void map.set(k, String(v)),
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
        key: (i: number) => [...map.keys()][i] ?? null,
        get length() {
          return map.size;
        },
      },
    });
    setCurrentScope({ kind: "guest" });
  });

  it("スライダーで作った配分を保存 → 再読込 → export → import しても同じ配分・同じ最終値", () => {
    let alloc = allocationWithGroupLevel({}, MESSI, "dribbling", 8);
    alloc = allocationWithGroupLevel(alloc, MESSI, "defending", 57); // 残りで止まる
    const result = calculateBuild({ card: MESSI, allocation: alloc });
    const saved = saveBuild({
      worldCardId: MESSI.worldCardId,
      buildName: "slider",
      progressionAllocation: alloc,
      selectedPlayerBooster: null,
      calculatedStats: Object.fromEntries(result.stats.map((s) => [s.key, s.finalValue])),
      calculatedOvr: result.rating.estimatedOvr,
      calculationMode: result.calculationMode,
      rulesVersion: result.rulesVersion,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const loaded = getBuild(MESSI.worldCardId, saved.build.buildId)!;
    expect(loaded.progressionAllocation).toEqual(alloc);
    const reloaded = calculateBuild({ card: MESSI, allocation: loaded.progressionAllocation });
    expect(reloaded.stats.map((s) => s.finalValue)).toEqual(result.stats.map((s) => s.finalValue));
    expect(reloaded.points).toEqual(result.points);

    const json = serializeSavedBuildExport(buildSavedBuildExportFile([loaded], "2026-09-27T00:00:00.000Z"));
    const parsed = parseImportText(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { valid, invalid } = validateImportBuilds(parsed.rawBuilds);
    expect(invalid).toEqual([]);
    expect(valid[0].progressionAllocation).toEqual(alloc);
  });

  it("壊れた配分（未知カテゴリ・負数・小数・上限超過）は計算時に拒否または上限へ丸め、黙って別の値にしない", () => {
    const r = calculateBuild({ card: NEAR_CAP_CARD, allocation: { zzz: 3, passing: -1, shooting: 1.5, dribbling: 9 } as Record<string, number> });
    expect(r.groups.find((g) => g.groupId === "dribbling")!.allocatedPoints).toBe(2);
    expect(r.groups.find((g) => g.groupId === "passing")!.allocatedPoints).toBe(0);
    expect(r.groups.find((g) => g.groupId === "shooting")!.allocatedPoints).toBe(0);
    expect(r.points.usedPoints).toBe(2);
  });

  it("元に戻す: 選択時点のレベルへ戻すと配分・残りポイントも選択時点と一致する", () => {
    const baseline = allocationWithGroupLevel({}, MESSI, "passing", 4);
    const changed = allocationWithGroupLevel(baseline, MESSI, "passing", 11);
    const reverted = allocationWithGroupLevel(changed, MESSI, "passing", baseline.passing);
    expect(reverted).toEqual(baseline);
    expect(summarizeGroupPoints(reverted, MESSI)).toEqual(summarizeGroupPoints(baseline, MESSI));
  });
});

describe("未保存の判定・1タップ保存（保存欄と同じ保存契約）", () => {
  it("sameAllocation: 0 のカテゴリは無視し、順序に依存しない", () => {
    expect(sameAllocation({ dribbling: 3, passing: 0 }, { dribbling: 3 })).toBe(true);
    expect(sameAllocation({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameAllocation({ dribbling: 3 }, { dribbling: 4 })).toBe(false);
    expect(sameAllocation({}, {})).toBe(true);
  });

  it("saveCurrentBuild は saveBuild と同じ内容（配分・最終値・推定OVR・規則版）を保存する", () => {
    vi.unstubAllGlobals();
    const map = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => void map.set(k, String(v)),
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
        key: (i: number) => [...map.keys()][i] ?? null,
        get length() {
          return map.size;
        },
      },
    });
    setCurrentScope({ kind: "guest" });
    const alloc = allocationWithGroupLevel({}, MESSI, "dribbling", 3);
    const result = calculateBuild({ card: MESSI, allocation: alloc });
    const r = saveCurrentBuild({ worldCardId: MESSI.worldCardId, buildName: "quick", allocation: alloc, result, selectedBooster: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = getBuild(MESSI.worldCardId, r.build.buildId)!;
    expect(b.progressionAllocation).toEqual(alloc);
    expect(b.calculatedStats.tightPossession).toBe(89);
    expect(b.calculatedOvr).toBe(result.rating.estimatedOvr);
    expect(b.rulesVersion).toBe(result.rulesVersion);
  });
});
