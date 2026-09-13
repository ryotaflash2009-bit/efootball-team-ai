import { describe, it, expect, beforeEach, vi } from "vitest";
import { calculateBuild } from "./engine";
import { adjustGroupLevel, summarizeGroupPoints } from "./group-allocation";
import { autoAllocate } from "./auto-allocate";
import { saveBuild, listBuilds, getBuild } from "./build-storage";
import { migrateBuild, statAllocationToGroupLevels } from "./migrate-build";
import { getGroupDef } from "./stat-groups";
import {
  PROGRESSION_RULES_VERSION,
  PROGRESSION_RULES_VERSION_V1,
  PROGRESSION_RULES_VERSION_MISDATED,
} from "./constants";
import { getRuleset, isLegacyRulesVersion, normalizeRulesVersion } from "./progression-rules";
import { MESSI_BIGTIME, CANNAVARO_EPIC } from "./fixtures";
import type { SavedBuild } from "./types";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";

function installMemoryStorage() {
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
}

describe("育成フロー v2（item 15）", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("1-16: 詳細→育成タブ→グループ配分→段階コスト→残り減る→対象能力変化→減らす→自動→リセット", () => {
    const card = MESSI_BIGTIME;

    // 3: 使用可能ポイント
    let build = calculateBuild({ card, allocation: {} });
    expect(build.points.totalPoints).toBe(62);
    expect(build.calculationMode).toBe("confirmed");
    const baseFinishing = build.stats.find((s) => s.key === "finishing")!.finalValue;

    // 4-5: Shooting へ +6（段階コスト: 1+1+1+1+1+2 = 7）
    let alloc = adjustGroupLevel({}, card, "shooting", 6);
    build = calculateBuild({ card, allocation: alloc });
    expect(alloc.shooting).toBe(6);
    expect(build.points.usedPoints).toBe(7); // 5: 段階コスト反映
    expect(build.points.remainingPoints).toBe(55); // 6

    // 7: 対象能力が変化
    const shooting = getGroupDef("shooting")!.affectedStats;
    for (const s of build.stats) {
      if (shooting.includes(s.key)) expect(s.progressionDelta).toBe(6);
      else expect(s.progressionDelta).toBe(0);
    }
    // 次段階コスト表示（level 6 → 2）
    const g = build.groups.find((x) => x.groupId === "shooting")!;
    expect(g.nextLevelCost).toBe(2);

    // 8: ポイント不足時に追加できない（全部使い切る）
    let full = autoAllocate(card, "balance").allocation;
    build = calculateBuild({ card, allocation: full });
    if (build.points.remainingPoints < 1) {
      const before = summarizeGroupPoints(full, card).usedPoints;
      full = adjustGroupLevel(full, card, "shooting", 1);
      expect(summarizeGroupPoints(full, card).usedPoints).toBe(before); // 増えない
    }

    // 9-10: 減らせる / 戻る
    alloc = adjustGroupLevel({ shooting: 6 }, card, "shooting", -3);
    expect(alloc.shooting).toBe(3);
    build = calculateBuild({ card, allocation: alloc });
    expect(build.points.usedPoints).toBe(3);

    // 12-13: 自動育成
    alloc = autoAllocate(card, "attack").allocation;
    build = calculateBuild({ card, allocation: alloc });
    expect(build.points.remainingPoints).toBeGreaterThanOrEqual(0);
    expect(build.stats.every((s) => s.finalValue <= 99)).toBe(true);

    // 15-16: リセット → 基礎
    build = calculateBuild({ card, allocation: {} });
    expect(build.stats.find((s) => s.key === "finishing")!.finalValue).toBe(baseFinishing);
  });

  it("スライダー操作（育成UI刷新）: 目標レベル指定 = target−current の delta で adjustGroupLevel を呼ぶ", () => {
    const card = MESSI_BIGTIME;
    // handleGroupSet(groupId, level) が使う式
    const setLevel = (alloc: Record<string, number>, groupId: string, level: number) =>
      adjustGroupLevel(alloc, card, groupId, level - (alloc[groupId] ?? 0));

    // 0 → 1（トラッククリック相当）
    let alloc = setLevel({}, "shooting", 1);
    expect(alloc.shooting).toBe(1);
    expect(calculateBuild({ card, allocation: alloc }).points.usedPoints).toBe(1);

    // 1 → 0（Home / つまみを左端）
    alloc = setLevel(alloc, "shooting", 0);
    expect(alloc.shooting).toBeUndefined();

    // 0 → 6 を一気に（ドラッグ）: 段階コスト 1+1+1+1+1+2 = 7 を維持
    alloc = setLevel({}, "shooting", 6);
    expect(alloc.shooting).toBe(6);
    expect(calculateBuild({ card, allocation: alloc }).points.usedPoints).toBe(7);

    // ±1 ボタンと同期（6 → 7 は setLevel でも +1 でも同じ）
    expect(setLevel(alloc, "shooting", 7)).toEqual(adjustGroupLevel(alloc, card, "shooting", 1));

    // End 相当: 到達不能な大きい値へドラッグ → 予算内の最大で止まる（マイナス残高を許可しない）
    const maxed = setLevel({}, "shooting", 999);
    const b = calculateBuild({ card, allocation: maxed });
    expect(b.points.overAllocated).toBe(false);
    expect(b.points.remainingPoints).toBeGreaterThanOrEqual(0);
    expect(maxed.shooting).toBeGreaterThan(0);

    // ポイントを使い切った状態で別グループのスライダーを上げても増えない
    const full = autoAllocate(card, "balance").allocation;
    if (calculateBuild({ card, allocation: full }).points.remainingPoints < 1) {
      const before = summarizeGroupPoints(full, card).usedPoints;
      const after = setLevel(full, "aerialStrength", 20);
      expect(summarizeGroupPoints(after, card).usedPoints).toBe(before);
    }
  });

  it("17-20: 保存 → 再読込 → 旧rulesVersion表示 → 新ルールで再計算", () => {
    const card = MESSI_BIGTIME;
    const alloc = autoAllocate(card, "attack").allocation;
    const build = calculateBuild({ card, allocation: alloc });
    const finalStats: Record<string, number> = {};
    for (const s of build.stats) finalStats[s.key] = s.finalValue;

    // 17: 保存（v2）
    const saved = saveBuild({
      worldCardId: card.worldCardId,
      buildName: "攻撃v2",
      progressionAllocation: alloc,
      selectedPlayerBooster: card.boost1,
      calculatedStats: finalStats,
      calculatedOvr: build.rating.estimatedOvr,
      calculationMode: build.calculationMode,
      rulesVersion: build.rulesVersion,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    // 18: 再読込
    expect(listBuilds(card.worldCardId)).toHaveLength(1);
    const loaded = getBuild(card.worldCardId, saved.build.buildId)!;
    expect(loaded.rulesVersion).toBe(PROGRESSION_RULES_VERSION);

    // 19-20: 旧 v1 ビルドの移行
    const legacyBuild: SavedBuild = {
      buildId: "b_legacy",
      worldCardId: card.worldCardId,
      buildName: "旧v1",
      progressionAllocation: { finishing: 8, curl: 3, dribbling: 5 }, // per-stat（v1）
      selectedPlayerBooster: null,
      calculatedStats: {},
      calculatedOvr: null,
      calculationMode: "provisional",
      rulesVersion: PROGRESSION_RULES_VERSION_V1,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
      schemaVersion: 1,
    };
    const mig = migrateBuild(legacyBuild, card);
    expect(mig.fromVersion).toBe(PROGRESSION_RULES_VERSION_V1);
    expect(mig.toVersion).toBe(PROGRESSION_RULES_VERSION);
    expect(mig.changed).toBe(true);
    // shooting = max(finishing 8, setPiece 0, curl 3) = 8, dribbling group = max(0,5,0)=5
    expect(mig.migratedAllocation.shooting).toBeGreaterThan(0);
    expect(mig.migratedAllocation.dribbling).toBeGreaterThan(0);
    // 新ルールで再計算しても予算内
    const remig = calculateBuild({ card, allocation: mig.migratedAllocation });
    expect(remig.points.overAllocated).toBe(false);
    // 元の配分は破壊されていない
    expect(legacyBuild.progressionAllocation).toEqual({ finishing: 8, curl: 3, dribbling: 5 });
  });

  it("engine は per-stat（v1）配分を渡されても自動で v2 グループへ移行する", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: { finishing: 4, curl: 4, setPieceTaking: 4 } });
    expect(r.isLegacyInput).toBe(true);
    // shooting グループへ移行され finishing/curl/setPiece が上がる
    expect(r.stats.find((s) => s.key === "finishing")!.progressionDelta).toBeGreaterThan(0);
  });

  it("別カードのビルドが混ざらない", () => {
    saveBuild({
      worldCardId: MESSI_BIGTIME.worldCardId, buildName: "M",
      progressionAllocation: { shooting: 3 }, selectedPlayerBooster: null,
      calculatedStats: {}, calculatedOvr: null, calculationMode: "provisional",
      rulesVersion: PROGRESSION_RULES_VERSION,
    });
    saveBuild({
      worldCardId: CANNAVARO_EPIC.worldCardId, buildName: "C",
      progressionAllocation: { defending: 3 }, selectedPlayerBooster: null,
      calculatedStats: {}, calculatedOvr: null, calculationMode: "provisional",
      rulesVersion: PROGRESSION_RULES_VERSION,
    });
    expect(listBuilds(MESSI_BIGTIME.worldCardId)).toHaveLength(1);
    expect(listBuilds(CANNAVARO_EPIC.worldCardId)).toHaveLength(1);
  });

  it("statAllocationToGroupLevels: 単体変換", () => {
    expect(statAllocationToGroupLevels({ finishing: 5, curl: 2 })).toEqual({ shooting: 5 });
    expect(statAllocationToGroupLevels({})).toEqual({});
  });

  it("誤日付 v2（2026-08-29）のビルドは v2 として読め、名前だけ正規化される", () => {
    expect(PROGRESSION_RULES_VERSION).toBe("progression/2026-08-28.v2");
    expect(isLegacyRulesVersion(PROGRESSION_RULES_VERSION_MISDATED)).toBe(false);
    expect(normalizeRulesVersion(PROGRESSION_RULES_VERSION_MISDATED)).toBe(PROGRESSION_RULES_VERSION);
    expect(getRuleset(PROGRESSION_RULES_VERSION_MISDATED).version).toBe(PROGRESSION_RULES_VERSION);

    const misdated: SavedBuild = {
      buildId: "b_misdated",
      worldCardId: MESSI_BIGTIME.worldCardId,
      buildName: "誤日付",
      progressionAllocation: { shooting: 4 },
      selectedPlayerBooster: null,
      calculatedStats: {},
      calculatedOvr: null,
      calculationMode: "provisional",
      rulesVersion: PROGRESSION_RULES_VERSION_MISDATED,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
      schemaVersion: 1,
    };
    const mig = migrateBuild(misdated, MESSI_BIGTIME);
    expect(mig.nameOnlyChange).toBe(true);
    expect(mig.changed).toBe(false); // 配分そのまま → 再計算不要
    expect(mig.toVersion).toBe(PROGRESSION_RULES_VERSION);
    expect(mig.migratedAllocation).toEqual({ shooting: 4 });
  });

  it("engine: 誤日付 v2 の rulesetId を渡しても isLegacyInput=false", () => {
    const r = calculateBuild({
      card: MESSI_BIGTIME,
      allocation: { shooting: 3 },
      rulesetId: PROGRESSION_RULES_VERSION_MISDATED,
    });
    expect(r.isLegacyInput).toBe(false);
    expect(r.rulesVersion).toBe(PROGRESSION_RULES_VERSION);
  });
});
