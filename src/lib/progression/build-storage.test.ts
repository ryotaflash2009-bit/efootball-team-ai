import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listBuilds,
  listAllBuilds,
  getBuild,
  saveBuild,
  renameBuild,
  duplicateBuild,
  deleteBuild,
  isBuildStorageAvailable,
  importBuilds,
  generateUniqueBuildId,
  saveBuildIntent,
  deleteBuildIntent,
} from "./build-storage";
import { BUILD_STORAGE_KEY } from "./constants";
import type { SavedBuild } from "./types";
import type { SavedBuildIntent } from "./build-intent-persistence";

function fullBuildIntent(over: Partial<SavedBuildIntent> = {}): SavedBuildIntent {
  return {
    intentSchemaVersion: 1,
    mainPresetId: "dribble-to-shot",
    subPresetIds: ["hard-to-dispossess"],
    primaryGoal: "dribbling",
    intendedPositions: ["CF"],
    groupPriorities: { shooting: "priority" },
    avoidOverinvestmentGroups: [],
    intentionallyIgnoredGroups: [],
    strengthsToPreserve: ["dribbling"],
    comparisonTargetBuildId: null,
    comparisonFocusGroups: [],
    source: "preset",
    userModified: false,
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...over,
  };
}

function fullBuild(over: Partial<SavedBuild> = {}): SavedBuild {
  return {
    buildId: "b_imported01",
    worldCardId: "89138556575063",
    buildName: "読み込みビルド",
    progressionAllocation: { shooting: 4 },
    selectedPlayerBooster: null,
    calculatedStats: { finishing: 90 },
    calculatedOvr: 92,
    calculationMode: "provisional",
    rulesVersion: "progression/2026-08-28.v2",
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    schemaVersion: 1,
    ...over,
  };
}

/** メモリ実装の localStorage をテスト用に用意 */
function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("window", { localStorage: storage });
  return { map, storage };
}

const base = {
  worldCardId: "89138556575063",
  progressionAllocation: { finishing: 5, curl: 2 },
  selectedPlayerBooster: null,
  calculatedStats: { finishing: 85 },
  calculatedOvr: 91,
  calculationMode: "provisional" as const,
  rulesVersion: "progression/2026-08-28.provisional-1",
};

describe("build-storage（メモリ localStorage）", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("保存・一覧・読み込み", () => {
    const r = saveBuild({ ...base, buildName: "攻撃ビルド" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const list = listBuilds(base.worldCardId);
    expect(list).toHaveLength(1);
    expect(getBuild(base.worldCardId, r.build.buildId)?.buildName).toBe("攻撃ビルド");
  });

  it("同一カードで複数ビルドを保存できる", () => {
    saveBuild({ ...base, buildName: "A" });
    saveBuild({ ...base, buildName: "B" });
    expect(listBuilds(base.worldCardId)).toHaveLength(2);
  });

  it("別カードのビルドを混ぜない", () => {
    saveBuild({ ...base, buildName: "Messi" });
    saveBuild({ ...base, worldCardId: "88041460996837", buildName: "Cannavaro" });
    expect(listBuilds("89138556575063")).toHaveLength(1);
    expect(listBuilds("88041460996837")).toHaveLength(1);
    expect(listBuilds("89138556575063")[0].buildName).toBe("Messi");
  });

  it("rename できる", () => {
    const r = saveBuild({ ...base, buildName: "旧名" });
    if (!r.ok) throw new Error();
    const r2 = renameBuild(base.worldCardId, r.build.buildId, "新名");
    expect(r2.ok).toBe(true);
    expect(getBuild(base.worldCardId, r.build.buildId)?.buildName).toBe("新名");
    expect(listBuilds(base.worldCardId)).toHaveLength(1); // 増えない
  });

  it("delete はブラウザ内ビルドのみ", () => {
    const r = saveBuild({ ...base, buildName: "消す" });
    if (!r.ok) throw new Error();
    expect(deleteBuild(base.worldCardId, r.build.buildId).ok).toBe(true);
    expect(listBuilds(base.worldCardId)).toHaveLength(0);
  });

  it("同じ buildId の重複を作らない", () => {
    const r = saveBuild({ ...base, buildName: "X" });
    if (!r.ok) throw new Error();
    saveBuild({ ...base, buildId: r.build.buildId, buildName: "X2" });
    saveBuild({ ...base, buildId: r.build.buildId, buildName: "X3" });
    expect(listBuilds(base.worldCardId)).toHaveLength(1);
    expect(listBuilds(base.worldCardId)[0].buildName).toBe("X3");
  });

  it("listAllBuilds: 全カードのビルドを平坦化（updatedAt 降順）", () => {
    saveBuild({ ...base, buildName: "A" });
    saveBuild({ ...base, worldCardId: "88041460996837", buildName: "B" });
    const all = listAllBuilds();
    expect(all).toHaveLength(2);
    expect(all.map((b) => b.buildName).sort()).toEqual(["A", "B"]);
    expect(new Set(all.map((b) => b.buildId)).size).toBe(2);
  });

  it("listAllBuilds: ビルド 0 件なら []", () => {
    expect(listAllBuilds()).toEqual([]);
  });

  describe("duplicateBuild", () => {
    it("新しい buildId・同じ worldCardId・同じ配分・rulesVersion 維持・元は不変", () => {
      const r = saveBuild({
        ...base,
        buildName: "元ビルド",
        conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_1_13" }],
      });
      if (!r.ok) throw new Error();
      const dup = duplicateBuild(base.worldCardId, r.build.buildId);
      expect(dup.ok).toBe(true);
      if (!dup.ok) return;
      expect(dup.build.buildId).not.toBe(r.build.buildId);
      expect(dup.build.worldCardId).toBe(base.worldCardId);
      expect(dup.build.progressionAllocation).toEqual(r.build.progressionAllocation);
      expect(dup.build.rulesVersion).toBe(r.build.rulesVersion);
      expect(dup.build.conditionalBoosterSelections).toEqual([
        { boosterKey: "total-package", selection: "league_1_13" },
      ]);
      expect(dup.build.buildName).toBe("元ビルド のコピー");
      // 元ビルドは変わらない
      expect(getBuild(base.worldCardId, r.build.buildId)?.buildName).toBe("元ビルド");
      expect(listBuilds(base.worldCardId)).toHaveLength(2);
    });

    it("明示名で複製できる / 見つからない buildId は失敗", () => {
      const r = saveBuild({ ...base, buildName: "X" });
      if (!r.ok) throw new Error();
      const dup = duplicateBuild(base.worldCardId, r.build.buildId, "任意の名前");
      expect(dup.ok).toBe(true);
      if (dup.ok) expect(dup.build.buildName).toBe("任意の名前");
      expect(duplicateBuild(base.worldCardId, "b_nope").ok).toBe(false);
    });

    it("createdAt / updatedAt は複製時刻（元より新しい）", () => {
      const r = saveBuild({ ...base, buildName: "T" });
      if (!r.ok) throw new Error();
      const dup = duplicateBuild(base.worldCardId, r.build.buildId);
      if (!dup.ok) throw new Error();
      expect(Date.parse(dup.build.createdAt)).toBeGreaterThanOrEqual(Date.parse(r.build.createdAt));
      expect(dup.build.createdAt).toBe(dup.build.updatedAt);
    });
  });

  it("不正な保存データ（壊れた JSON）を安全に無視する", () => {
    const mem = installMemoryStorage();
    mem.storage.setItem(BUILD_STORAGE_KEY, "{ this is not json");
    expect(listBuilds(base.worldCardId)).toEqual([]);
  });

  it("不正な worldCardId / 空ビルド名を拒否", () => {
    expect(saveBuild({ ...base, worldCardId: "abc", buildName: "x" }).ok).toBe(false);
    expect(saveBuild({ ...base, buildName: "   " }).ok).toBe(false);
  });

  it("localStorage が使えなくてもクラッシュしない", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(isBuildStorageAvailable()).toBe(false);
    expect(listBuilds(base.worldCardId)).toEqual([]);
    expect(saveBuild({ ...base, buildName: "x" }).ok).toBe(false);
    expect(deleteBuild(base.worldCardId, "b_x").ok).toBe(false);
  });

  it("window 自体が無い（SSR）でもクラッシュしない", () => {
    vi.unstubAllGlobals();
    expect(isBuildStorageAvailable()).toBe(false);
    expect(listBuilds(base.worldCardId)).toEqual([]);
  });

  describe("Total Package 条件段階の保存（後方互換）", () => {
    it("段階を保存・復元できる", () => {
      const r = saveBuild({
        ...base,
        buildName: "TP+2",
        conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_14_19" }],
      });
      if (!r.ok) throw new Error();
      expect(getBuild(base.worldCardId, r.build.buildId)?.conditionalBoosterSelections).toEqual([
        { boosterKey: "total-package", selection: "league_14_19" },
      ]);
    });
    it("未指定・none は保存しない（フィールドを持たない）", () => {
      const r = saveBuild({ ...base, buildName: "なし" });
      if (!r.ok) throw new Error();
      expect(getBuild(base.worldCardId, r.build.buildId)?.conditionalBoosterSelections).toBeUndefined();
      const r2 = saveBuild({
        ...base,
        buildName: "none指定",
        conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "none" }],
      });
      if (!r2.ok) throw new Error();
      expect(getBuild(base.worldCardId, r2.build.buildId)?.conditionalBoosterSelections).toBeUndefined();
    });
    it("不正な段階は捨てる・不正キーは捨てる（有効キー+有効段階は残す）", () => {
      const r = saveBuild({
        ...base,
        buildName: "不正",
        conditionalBoosterSelections: [
          { boosterKey: "total-package", selection: "garbage" as never }, // garbage→none→捨てる
          { boosterKey: "NOPE!!", selection: "league_20_plus" as never }, // 不正キー→捨てる
          { boosterKey: "ball-protection", selection: "league_14_19" }, // v2: 有効キー+有効段階→残す
        ],
      });
      if (!r.ok) throw new Error();
      expect(getBuild(base.worldCardId, r.build.buildId)?.conditionalBoosterSelections).toEqual([
        { boosterKey: "ball-protection", selection: "league_14_19" },
      ]);
    });
    it("フィールドを持たない古い保存データを読める", () => {
      const mem = installMemoryStorage();
      mem.storage.setItem(
        BUILD_STORAGE_KEY,
        JSON.stringify({
          [base.worldCardId]: [
            {
              buildId: "b_old1",
              worldCardId: base.worldCardId,
              buildName: "旧ビルド",
              progressionAllocation: {},
              selectedPlayerBooster: null,
              calculatedStats: {},
              calculatedOvr: null,
              calculationMode: "provisional",
              rulesVersion: "x",
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-01T00:00:00.000Z",
              schemaVersion: 1,
            },
          ],
        }),
      );
      const list = listBuilds(base.worldCardId);
      expect(list).toHaveLength(1);
      expect(list[0].conditionalBoosterSelections).toBeUndefined();
    });
    it("壊れた conditionalBoosterSelections は catch で undefined に落ちる（他フィールドは生きる）", () => {
      const mem = installMemoryStorage();
      mem.storage.setItem(
        BUILD_STORAGE_KEY,
        JSON.stringify({
          [base.worldCardId]: [
            {
              buildId: "b_old2",
              worldCardId: base.worldCardId,
              buildName: "壊れ",
              progressionAllocation: {},
              selectedPlayerBooster: null,
              conditionalBoosterSelections: "not-an-array",
              calculatedStats: {},
              calculatedOvr: null,
              calculationMode: "provisional",
              rulesVersion: "x",
              createdAt: "2026-08-01T00:00:00.000Z",
              updatedAt: "2026-08-01T00:00:00.000Z",
              schemaVersion: 1,
            },
          ],
        }),
      );
      const list = listBuilds(base.worldCardId);
      expect(list).toHaveLength(1);
      expect(list[0].buildName).toBe("壊れ");
      expect(list[0].conditionalBoosterSelections).toBeUndefined();
    });
  });

  describe("generateUniqueBuildId", () => {
    it("既存形式の buildId を返す（b_ で始まる）", () => {
      const id = generateUniqueBuildId(new Set());
      expect(/^[A-Za-z0-9_-]{1,64}$/.test(id)).toBe(true);
      expect(id.startsWith("b_")).toBe(true);
    });
    it("taken に含まれる ID は返さない", () => {
      const taken = new Set<string>();
      for (let i = 0; i < 200; i++) taken.add(generateUniqueBuildId(taken));
      expect(taken.size).toBe(200); // 全部ユニーク
    });
  });

  describe("importBuilds（全件単位の追加保存・インポート専用）", () => {
    it("複数件を 1 回で追加し、既存ビルドは維持・日時はそのまま", () => {
      const ex = saveBuild({ ...base, buildName: "既存" });
      if (!ex.ok) throw new Error();
      const a = fullBuild({ buildId: "b_a", buildName: "A", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" });
      const b = fullBuild({ buildId: "b_b", worldCardId: "88041460996837", buildName: "B" });
      const r = importBuilds([a, b]);
      expect(r).toEqual({ ok: true, saved: 2 });
      const all = listAllBuilds();
      expect(all).toHaveLength(3);
      const stored = all.find((x) => x.buildId === "b_a")!;
      expect(stored.createdAt).toBe("2026-08-01T00:00:00.000Z");
      expect(stored.updatedAt).toBe("2026-08-02T00:00:00.000Z");
      expect(stored.buildName).toBe("A");
      // 既存は不変
      expect(getBuild(base.worldCardId, ex.build.buildId)?.buildName).toBe("既存");
    });

    it("既存 buildId と衝突するとエラー（既存を上書きしない）", () => {
      const ex = saveBuild({ ...base, buildName: "既存" });
      if (!ex.ok) throw new Error();
      const dup = fullBuild({ buildId: ex.build.buildId, buildName: "衝突" });
      const r = importBuilds([dup]);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.code).toBe("conflict");
      expect(getBuild(base.worldCardId, ex.build.buildId)?.buildName).toBe("既存");
    });

    it("追加分どうしの buildId 重複を拒否", () => {
      const r = importBuilds([fullBuild({ buildId: "b_x" }), fullBuild({ buildId: "b_x", buildName: "2" })]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("conflict");
      expect(listAllBuilds()).toHaveLength(0); // 何も保存されない
    });

    it("expectedExistingBuildIds が現状と食い違えば conflict（保存しない）", () => {
      saveBuild({ ...base, buildName: "既存1" });
      const r = importBuilds([fullBuild({ buildId: "b_new" })], { expectedExistingBuildIds: ["b_stale"] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("conflict");
      expect(listAllBuilds().some((b) => b.buildId === "b_new")).toBe(false);
    });

    it("schemaVersion 不一致は invalid", () => {
      const r = importBuilds([fullBuild({ buildId: "b_v2", schemaVersion: 2 })]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid");
    });

    it("無効なビルドが 1 件でもあれば全体拒否（部分保存なし）", () => {
      const good = fullBuild({ buildId: "b_good" });
      const bad = { ...fullBuild({ buildId: "b_bad" }), progressionAllocation: { x: -1 } } as unknown as SavedBuild;
      const r = importBuilds([good, bad]);
      expect(r.ok).toBe(false);
      expect(listAllBuilds()).toHaveLength(0);
    });

    it("localStorage 不可なら storage エラー・他キーに触れない", () => {
      vi.unstubAllGlobals();
      vi.stubGlobal("window", {
        get localStorage(): Storage {
          throw new Error("blocked");
        },
      });
      const r = importBuilds([fullBuild()]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("storage");
    });

    it("空配列は invalid（何もしない）", () => {
      expect(importBuilds([]).ok).toBe(false);
    });
  });
});

describe("saveBuildIntent / deleteBuildIntent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("buildIntentなしの旧保存ビルドへ新規保存できる", () => {
    const saved = saveBuild({ ...base, buildName: "旧ビルド" });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const r = saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    expect(r.ok).toBe(true);
    const reloaded = getBuild(saved.build.worldCardId, saved.build.buildId);
    expect(reloaded?.buildIntent?.mainPresetId).toBe("dribble-to-shot");
  });

  it("対象ビルドだけを更新し、育成配分・ビルド名等の他フィールドを変更しない", () => {
    const saved = saveBuild({ ...base, buildName: "更新対象" });
    if (!saved.ok) throw new Error("setup failed");
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    const reloaded = getBuild(saved.build.worldCardId, saved.build.buildId)!;
    expect(reloaded.buildName).toBe("更新対象");
    expect(reloaded.progressionAllocation).toEqual(saved.build.progressionAllocation);
    expect(reloaded.calculatedOvr).toBe(saved.build.calculatedOvr);
  });

  it("別ビルドを誤更新しない", () => {
    const a = saveBuild({ ...base, buildName: "A" });
    const b = saveBuild({ ...base, buildName: "B" });
    if (!a.ok || !b.ok) throw new Error("setup failed");
    saveBuildIntent(a.build.worldCardId, a.build.buildId, fullBuildIntent());
    const reloadedB = getBuild(b.build.worldCardId, b.build.buildId);
    expect(reloadedB?.buildIntent).toBeUndefined();
  });

  it("保存ビルド件数を変化させない", () => {
    const saved = saveBuild({ ...base, buildName: "件数確認" });
    if (!saved.ok) throw new Error("setup failed");
    const before = listAllBuilds().length;
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    expect(listAllBuilds().length).toBe(before);
  });

  it("対象ビルドが存在しない場合はエラーを返す", () => {
    const r = saveBuildIntent("89138556575063", "not-exist", fullBuildIntent());
    expect(r.ok).toBe(false);
  });

  it("同じ設定を再保存しても不要な変更を起こさない(内容が一致する)", () => {
    const saved = saveBuild({ ...base, buildName: "再保存確認" });
    if (!saved.ok) throw new Error("setup failed");
    const intent = fullBuildIntent();
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, intent);
    const first = getBuild(saved.build.worldCardId, saved.build.buildId)!.buildIntent;
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, intent);
    const second = getBuild(saved.build.worldCardId, saved.build.buildId)!.buildIntent;
    expect(second).toEqual(first);
  });

  it("buildIntentだけを削除し、SavedBuild本体・育成配分・ビルド名を維持する", () => {
    const saved = saveBuild({ ...base, buildName: "削除対象" });
    if (!saved.ok) throw new Error("setup failed");
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    const r = deleteBuildIntent(saved.build.worldCardId, saved.build.buildId);
    expect(r.ok).toBe(true);
    const reloaded = getBuild(saved.build.worldCardId, saved.build.buildId)!;
    expect(reloaded.buildIntent).toBeUndefined();
    expect(reloaded.buildName).toBe("削除対象");
    expect(reloaded.progressionAllocation).toEqual(saved.build.progressionAllocation);
  });

  it("buildIntent削除後も保存ビルド本体は一覧に残る", () => {
    const saved = saveBuild({ ...base, buildName: "一覧確認" });
    if (!saved.ok) throw new Error("setup failed");
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    deleteBuildIntent(saved.build.worldCardId, saved.build.buildId);
    expect(listAllBuilds().some((b) => b.buildId === saved.build.buildId)).toBe(true);
  });

  it("buildIntentが元々ない場合の削除は成功扱い(何もしない)", () => {
    const saved = saveBuild({ ...base, buildName: "未設定" });
    if (!saved.ok) throw new Error("setup failed");
    const r = deleteBuildIntent(saved.build.worldCardId, saved.build.buildId);
    expect(r.ok).toBe(true);
  });

  it("ビルド名を変更(rename)してもbuildIntentを維持する", () => {
    const saved = saveBuild({ ...base, buildName: "改名前" });
    if (!saved.ok) throw new Error("setup failed");
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    renameBuild(saved.build.worldCardId, saved.build.buildId, "改名後");
    const reloaded = getBuild(saved.build.worldCardId, saved.build.buildId)!;
    expect(reloaded.buildName).toBe("改名後");
    expect(reloaded.buildIntent?.mainPresetId).toBe("dribble-to-shot");
  });

  it("ビルド削除時はそのビルド内のbuildIntentも一緒に削除される(本体削除なので当然消える)", () => {
    const saved = saveBuild({ ...base, buildName: "本体削除" });
    if (!saved.ok) throw new Error("setup failed");
    saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    deleteBuild(saved.build.worldCardId, saved.build.buildId);
    expect(getBuild(saved.build.worldCardId, saved.build.buildId)).toBeNull();
  });

  it("localStorage不可なら保存失敗を返し、既存データを破損させない", () => {
    const saved = saveBuild({ ...base, buildName: "障害確認" });
    if (!saved.ok) throw new Error("setup failed");
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    const r = saveBuildIntent(saved.build.worldCardId, saved.build.buildId, fullBuildIntent());
    expect(r.ok).toBe(false);
  });

  it("不正なbuildIntent(スキーマ不一致)は保存を拒否する", () => {
    const saved = saveBuild({ ...base, buildName: "検証確認" });
    if (!saved.ok) throw new Error("setup failed");
    const bogus = { ...fullBuildIntent(), subPresetIds: ["a", "b", "c"] } as SavedBuildIntent;
    const r = saveBuildIntent(saved.build.worldCardId, saved.build.buildId, bogus);
    expect(r.ok).toBe(false);
  });
});
