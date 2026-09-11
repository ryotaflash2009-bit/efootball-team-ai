import { describe, it, expect } from "vitest";
import {
  normalizeSavedBuildIntent,
  restoreBuildIntentFromSaved,
  isSavedIntentCurrent,
  BUILD_INTENT_SCHEMA_VERSION,
  type SavedBuildIntent,
} from "./build-intent-persistence";
import { emptyBuildIntent, type BuildIntentInput } from "./build-intent-analysis";

function makeIntent(overrides: Partial<BuildIntentInput> = {}): BuildIntentInput {
  return { ...emptyBuildIntent(), ...overrides };
}

const NOW = "2026-09-10T00:00:00.000Z";

describe("normalizeSavedBuildIntent", () => {
  it("有効な目的設定を保存モデルへ変換する", () => {
    const intent = makeIntent({ primaryGoal: "dribbling", intendedPositions: ["CF"], groupPriorities: { shooting: "priority" } });
    const saved = normalizeSavedBuildIntent({
      intent,
      mainPresetId: "dribble-to-shot",
      subPresetIds: [],
      source: "preset",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.primaryGoal).toBe("dribbling");
    expect(saved.intendedPositions).toEqual(["CF"]);
    expect(saved.groupPriorities).toEqual({ shooting: "priority" });
    expect(saved.mainPresetId).toBe("dribble-to-shot");
    expect(saved.intentSchemaVersion).toBe(BUILD_INTENT_SCHEMA_VERSION);
    expect(saved.updatedAt).toBe(NOW);
  });

  it("入力(intent)を変更しない", () => {
    const intent = makeIntent({ groupPriorities: { shooting: "priority" }, avoidOverinvestmentGroups: ["passing"] });
    const before = JSON.stringify(intent);
    normalizeSavedBuildIntent({ intent, mainPresetId: null, subPresetIds: [], source: "manual", userModified: false, currentBuildId: "b1", siblingBuildIds: new Set(), now: NOW });
    expect(JSON.stringify(intent)).toBe(before);
  });

  it("表示文章・自由記述・診断結果・通常/辛口モード・UI状態・内部生成結果を含まない", () => {
    const intent = makeIntent({ freeText: "自由記述テキスト", primaryGoal: "dribbling" });
    const saved = normalizeSavedBuildIntent({ intent, mainPresetId: null, subPresetIds: [], source: "manual", userModified: false, currentBuildId: "b1", siblingBuildIds: new Set(), now: NOW });
    const json = JSON.stringify(saved);
    expect(json).not.toContain("自由記述テキスト");
    expect(saved).not.toHaveProperty("freeText");
    expect(saved).not.toHaveProperty("mode");
    expect(saved).not.toHaveProperty("analysisMode");
    expect(saved).not.toHaveProperty("headline");
    expect(saved).not.toHaveProperty("achievementItems");
  });

  it("無効なpresetIdを除外する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent(),
      mainPresetId: "not-a-real-preset-id",
      subPresetIds: [],
      source: "preset",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.mainPresetId).toBeNull();
  });

  it("サブ目的は最大2件までしか保持しない", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent(),
      mainPresetId: null,
      subPresetIds: ["hard-to-dispossess", "tight-space-possession", "dribble-to-shot"],
      source: "preset",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.subPresetIds.length).toBeLessThanOrEqual(2);
  });

  it("重複サブ目的を除去する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent(),
      mainPresetId: null,
      subPresetIds: ["hard-to-dispossess", "hard-to-dispossess"],
      source: "preset",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.subPresetIds).toEqual(["hard-to-dispossess"]);
  });

  it("メインとサブの重複を除去する(メイン優先)", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent(),
      mainPresetId: "dribble-to-shot",
      subPresetIds: ["dribble-to-shot", "hard-to-dispossess"],
      source: "preset",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.mainPresetId).toBe("dribble-to-shot");
    expect(saved.subPresetIds).not.toContain("dribble-to-shot");
  });

  it("無効なpositionを除外する(既存normalizeBuildIntentを再利用)", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ intendedPositions: ["", "x".repeat(100)] }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.intendedPositions).toEqual([]);
  });

  it("無効なgroupIdを除外する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ groupPriorities: { "not-a-real-group": "priority", shooting: "priority" } }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.groupPriorities).toEqual({ shooting: "priority" });
  });

  it("無効な優先度値を拒否する(通常=キー不在へ丸める)", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ groupPriorities: { shooting: "bogus" as never } }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.groupPriorities.shooting).toBeUndefined();
  });

  it("配列を固定順(ソート済み)へ正規化する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ avoidOverinvestmentGroups: ["passing", "dribbling"] }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.avoidOverinvestmentGroups).toEqual(["dribbling", "passing"]);
  });

  it("比較対象の自分自身指定を除去する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ comparisonTargetBuildId: "b1" }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(["b1", "b2"]),
      now: NOW,
    });
    expect(saved.comparisonTargetBuildId).toBeNull();
  });

  it("他カード(存在しない・siblingでない)の比較対象を除去する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ comparisonTargetBuildId: "other-card-build" }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(["b2", "b3"]),
      now: NOW,
    });
    expect(saved.comparisonTargetBuildId).toBeNull();
  });

  it("同一カードの実在する比較対象は保持する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ comparisonTargetBuildId: "b2" }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(["b2", "b3"]),
      now: NOW,
    });
    expect(saved.comparisonTargetBuildId).toBe("b2");
  });

  it("重複領域(strengthsToPreserve等)を除去する", () => {
    const saved = normalizeSavedBuildIntent({
      intent: makeIntent({ strengthsToPreserve: ["dribbling", "dribbling", "passing"] }),
      mainPresetId: null,
      subPresetIds: [],
      source: "manual",
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set(),
      now: NOW,
    });
    expect(saved.strengthsToPreserve).toEqual(["dribbling", "passing"]);
  });

  it("同じ入力から同じ保存構造を返す(決定的)", () => {
    const input = {
      intent: makeIntent({ groupPriorities: { shooting: "priority" as const, passing: "low" as const } }),
      mainPresetId: "dribble-to-shot",
      subPresetIds: ["hard-to-dispossess"],
      source: "preset" as const,
      userModified: false,
      currentBuildId: "b1",
      siblingBuildIds: new Set<string>(),
      now: NOW,
    };
    const a = normalizeSavedBuildIntent(input);
    const b = normalizeSavedBuildIntent(input);
    expect(a).toEqual(b);
  });
});

describe("restoreBuildIntentFromSaved", () => {
  const baseSaved: SavedBuildIntent = {
    intentSchemaVersion: BUILD_INTENT_SCHEMA_VERSION,
    mainPresetId: "dribble-to-shot",
    subPresetIds: ["hard-to-dispossess"],
    primaryGoal: "dribbling",
    intendedPositions: ["CF"],
    groupPriorities: { shooting: "priority" },
    avoidOverinvestmentGroups: [],
    intentionallyIgnoredGroups: [],
    strengthsToPreserve: ["dribbling"],
    comparisonTargetBuildId: "b2",
    comparisonFocusGroups: [],
    source: "preset",
    userModified: false,
    updatedAt: NOW,
  };

  it("メイン目的・サブ目的・使用予定ポジション・4段階優先度・維持する長所・比較対象・比較観点を復元する", () => {
    const r = restoreBuildIntentFromSaved(baseSaved, "b1", new Set(["b2", "b3"]));
    expect(r.mainPresetId).toBe("dribble-to-shot");
    expect(r.subPresetIds).toEqual(["hard-to-dispossess"]);
    expect(r.intent.primaryGoal).toBe("dribbling");
    expect(r.intent.intendedPositions).toEqual(["CF"]);
    expect(r.intent.groupPriorities).toEqual({ shooting: "priority" });
    expect(r.intent.strengthsToPreserve).toEqual(["dribbling"]);
    expect(r.intent.comparisonTargetBuildId).toBe("b2");
    expect(r.presetUnresolved).toBe(false);
    expect(r.comparisonTargetInvalidated).toBe(false);
  });

  it("入力(saved)を変更しない", () => {
    const before = JSON.stringify(baseSaved);
    restoreBuildIntentFromSaved(baseSaved, "b1", new Set(["b2"]));
    expect(JSON.stringify(baseSaved)).toBe(before);
  });

  it("存在しないmainPresetIdは表示せず除外し、presetUnresolvedをtrueにする", () => {
    const saved: SavedBuildIntent = { ...baseSaved, mainPresetId: "removed-preset-id" };
    const r = restoreBuildIntentFromSaved(saved, "b1", new Set(["b2"]));
    expect(r.mainPresetId).toBeNull();
    expect(r.presetUnresolved).toBe(true);
  });

  it("存在しないsubPresetIdsは除外し、presetUnresolvedをtrueにする", () => {
    const saved: SavedBuildIntent = { ...baseSaved, subPresetIds: ["removed-sub-preset"] };
    const r = restoreBuildIntentFromSaved(saved, "b1", new Set(["b2"]));
    expect(r.subPresetIds).toEqual([]);
    expect(r.presetUnresolved).toBe(true);
  });

  it("有効な詳細設定(groupPriorities等)は無効プリセットでも復元する", () => {
    const saved: SavedBuildIntent = { ...baseSaved, mainPresetId: "removed-preset-id" };
    const r = restoreBuildIntentFromSaved(saved, "b1", new Set(["b2"]));
    expect(r.intent.groupPriorities).toEqual({ shooting: "priority" });
  });

  it("削除済み比較対象は比較対象なしで復元し、他の目的設定は維持する", () => {
    const r = restoreBuildIntentFromSaved(baseSaved, "b1", new Set(["b3"])); // b2は存在しない
    expect(r.intent.comparisonTargetBuildId).toBeNull();
    expect(r.comparisonTargetInvalidated).toBe(true);
    expect(r.intent.primaryGoal).toBe("dribbling");
    expect(r.intent.groupPriorities).toEqual({ shooting: "priority" });
  });

  it("比較対象が現在のビルド自身を指す場合は無効化する", () => {
    const saved: SavedBuildIntent = { ...baseSaved, comparisonTargetBuildId: "b1" };
    const r = restoreBuildIntentFromSaved(saved, "b1", new Set(["b1"]));
    expect(r.intent.comparisonTargetBuildId).toBeNull();
    expect(r.comparisonTargetInvalidated).toBe(true);
  });

  it("比較対象がnullの場合はcomparisonTargetInvalidatedをfalseにする", () => {
    const saved: SavedBuildIntent = { ...baseSaved, comparisonTargetBuildId: null };
    const r = restoreBuildIntentFromSaved(saved, "b1", new Set(["b2"]));
    expect(r.comparisonTargetInvalidated).toBe(false);
  });

  it("内部presetId等の危険/不正な文字列を含んでいても例外を投げない", () => {
    const saved: SavedBuildIntent = { ...baseSaved, mainPresetId: "__proto__", groupPriorities: { "not-a-group": "priority" as never } };
    expect(() => restoreBuildIntentFromSaved(saved, "b1", new Set(["b2"]))).not.toThrow();
  });
});

describe("isSavedIntentCurrent", () => {
  const saved: SavedBuildIntent = {
    intentSchemaVersion: BUILD_INTENT_SCHEMA_VERSION,
    mainPresetId: "dribble-to-shot",
    subPresetIds: ["hard-to-dispossess", "tight-space-possession"],
    primaryGoal: "dribbling",
    intendedPositions: ["CF"],
    groupPriorities: { shooting: "priority", passing: "low" },
    avoidOverinvestmentGroups: [],
    intentionallyIgnoredGroups: [],
    strengthsToPreserve: ["dribbling"],
    comparisonTargetBuildId: "b2",
    comparisonFocusGroups: [],
    source: "preset",
    userModified: false,
    updatedAt: NOW,
  };
  function currentFromSaved(overrides: Partial<BuildIntentInput> = {}) {
    return {
      intent: makeIntent({
        primaryGoal: saved.primaryGoal,
        intendedPositions: saved.intendedPositions,
        groupPriorities: saved.groupPriorities,
        strengthsToPreserve: saved.strengthsToPreserve,
        comparisonTargetBuildId: saved.comparisonTargetBuildId,
        ...overrides,
      }),
      mainPresetId: saved.mainPresetId,
      subPresetIds: saved.subPresetIds,
      source: saved.source,
      userModified: saved.userModified,
    };
  }

  it("保存済みと現在が同じなら true", () => {
    expect(isSavedIntentCurrent(saved, currentFromSaved())).toBe(true);
  });

  it("メイン目的(primaryGoal)が変わっていればfalse", () => {
    expect(isSavedIntentCurrent(saved, currentFromSaved({ primaryGoal: "scoring" }))).toBe(false);
  });

  it("優先度(groupPriorities)が変わっていればfalse", () => {
    expect(isSavedIntentCurrent(saved, currentFromSaved({ groupPriorities: { shooting: "priority" } }))).toBe(false);
  });

  it("使用予定ポジションが変わっていればfalse", () => {
    expect(isSavedIntentCurrent(saved, currentFromSaved({ intendedPositions: ["AMF"] }))).toBe(false);
  });

  it("比較対象が変わっていればfalse", () => {
    expect(isSavedIntentCurrent(saved, currentFromSaved({ comparisonTargetBuildId: "b3" }))).toBe(false);
  });

  it("維持する長所が変わっていればfalse", () => {
    expect(isSavedIntentCurrent(saved, currentFromSaved({ strengthsToPreserve: [] }))).toBe(false);
  });

  it("サブ目的の並び順だけが違う場合は同一とみなす(配列順序に意味がない)", () => {
    const current = currentFromSaved();
    current.subPresetIds = [...saved.subPresetIds].reverse();
    expect(isSavedIntentCurrent(saved, current)).toBe(true);
  });

  it("groupPrioritiesのキー順だけが違っても同一とみなす", () => {
    const current = currentFromSaved({ groupPriorities: { passing: "low", shooting: "priority" } });
    expect(isSavedIntentCurrent(saved, current)).toBe(true);
  });

  it("翻訳言語の違い(比較対象外のフィールド)では差分にならない: この関数はja/en等の言語情報を一切受け取らない", () => {
    // isSavedIntentCurrent のシグネチャに言語パラメータが存在しないこと自体が保証。
    const current = currentFromSaved();
    expect(isSavedIntentCurrent(saved, current)).toBe(true);
  });

  it("mainPresetIdが変わっていればfalse", () => {
    const current = currentFromSaved();
    current.mainPresetId = "other-preset";
    expect(isSavedIntentCurrent(saved, current)).toBe(false);
  });

  it("sourceが変わっていればfalse", () => {
    const current = currentFromSaved();
    current.source = "manual";
    expect(isSavedIntentCurrent(saved, current)).toBe(false);
  });

  it("userModifiedが変わっていればfalse", () => {
    const current = currentFromSaved();
    current.userModified = true;
    expect(isSavedIntentCurrent(saved, current)).toBe(false);
  });
});
