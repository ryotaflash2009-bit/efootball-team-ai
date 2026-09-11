import { describe, it, expect } from "vitest";
import {
  BUILD_INTENT_PRESETS,
  PRESET_CATEGORIES,
  PRESET_CATEGORY_IDS,
  RECOMMENDED_PRESET_IDS,
  MAX_SUB_PRESETS,
  getPresetById,
  getPresetsByCategory,
  normalizeSearchText,
  searchPresets,
  presetDerivedGroupPriorities,
  buildPresetPreviewIntent,
  composeDraftIntent,
  classifyGroupPrioritySource,
  detectPresetConflicts,
} from "./build-intent-presets";
import { PRIMARY_GOAL_IDS, emptyBuildIntent } from "./build-intent-analysis";
import { PROGRESSION_GROUPS } from "./stat-groups";
import ja from "@/lib/i18n/dictionaries/ja";
import en from "@/lib/i18n/dictionaries/en";

/**
 * 育成目的プリセット(標準UIのメイン入力方式)の検証。
 * - プリセットは言語非依存の構造化データであり、表示文言は ja/en 辞書キー経由で解決する
 *   (ここではキーが両言語辞書に実在することだけを確認し、文言そのものはUIテストの対象とする)。
 * - 能力値・育成ポイントを一切含まない、既存 PrimaryGoalId・既存 groupId・既存ポジションだけを
 *   使用していることを確認する。
 */

const VALID_GROUP_IDS = new Set(PROGRESSION_GROUPS.map((g) => g.groupId));
const VALID_POSITIONS = new Set(["GK", "CB", "LB", "RB", "DMF", "CMF", "LMF", "RMF", "AMF", "LWF", "RWF", "SS", "CF"]);

function hasKey(dict: Record<string, unknown>, namespace: string, key: string): boolean {
  const ns = dict[namespace] as Record<string, unknown> | undefined;
  return !!ns && Object.prototype.hasOwnProperty.call(ns, key) && typeof ns[key] === "string";
}

describe("BuildIntentPreset: プリセット定義の健全性", () => {
  it("presetIdが一意である", () => {
    const ids = BUILD_INTENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("想定件数が30〜50件程度である", () => {
    expect(BUILD_INTENT_PRESETS.length).toBeGreaterThanOrEqual(30);
    expect(BUILD_INTENT_PRESETS.length).toBeLessThanOrEqual(50);
  });

  it("すべてのプリセットが有効なcategoryIdを持つ", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      expect(PRESET_CATEGORY_IDS).toContain(p.categoryId);
    }
  });

  it("すべてのプリセットが有効なprimaryGoalを持つ(既存PrimaryGoalIdのみ)", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      expect(PRIMARY_GOAL_IDS).toContain(p.primaryGoal);
    }
  });

  it("すべてのプリセットが有効なgroupIdだけをpriorityGroups/secondaryGroupsに持つ", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      for (const g of p.priorityGroups) expect(VALID_GROUP_IDS.has(g)).toBe(true);
      for (const g of p.secondaryGroups) expect(VALID_GROUP_IDS.has(g)).toBe(true);
      for (const g of p.defaultLowPriorityGroups) expect(VALID_GROUP_IDS.has(g)).toBe(true);
      for (const g of p.defaultAvoidOverinvestmentGroups) expect(VALID_GROUP_IDS.has(g)).toBe(true);
      for (const g of p.defaultIgnoredGroups) expect(VALID_GROUP_IDS.has(g)).toBe(true);
      for (const g of p.comparisonFocusGroups) expect(VALID_GROUP_IDS.has(g)).toBe(true);
      for (const g of p.strengthsToPreserveCandidates) expect(VALID_GROUP_IDS.has(g)).toBe(true);
    }
  });

  it("priorityGroupsとsecondaryGroupsが同一プリセット内で重複しない", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      const overlap = p.priorityGroups.filter((g) => p.secondaryGroups.includes(g));
      expect(overlap).toEqual([]);
    }
  });

  it("suggestedPositionsが既存の使用予定ポジションだけを含む", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      for (const pos of p.suggestedPositions) expect(VALID_POSITIONS.has(pos)).toBe(true);
    }
  });

  it("sortOrderが決定的(重複なし)", () => {
    const orders = BUILD_INTENT_PRESETS.map((p) => p.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("titleKey/shortDescriptionKey/detailDescriptionKeyがja/en両方の辞書に存在する", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      expect(hasKey(ja as unknown as Record<string, unknown>, "buildAnalysis", p.titleKey)).toBe(true);
      expect(hasKey(en as unknown as Record<string, unknown>, "buildAnalysis", p.titleKey)).toBe(true);
      expect(hasKey(ja as unknown as Record<string, unknown>, "buildAnalysis", p.shortDescriptionKey)).toBe(true);
      expect(hasKey(en as unknown as Record<string, unknown>, "buildAnalysis", p.shortDescriptionKey)).toBe(true);
      expect(hasKey(ja as unknown as Record<string, unknown>, "buildAnalysis", p.detailDescriptionKey)).toBe(true);
      expect(hasKey(en as unknown as Record<string, unknown>, "buildAnalysis", p.detailDescriptionKey)).toBe(true);
    }
  });

  it("titleKeyが日本語や英語の表示名そのものではない(識別子らしいキー形式)", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      expect(p.titleKey).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
      expect(p.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("能力値・育成ポイントに相当するフィールドを一切持たない(型として存在しない)", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      const serialized = JSON.stringify(p);
      expect(serialized).not.toMatch(/calculatedOvr|trainingPoint|abilityValue/i);
    }
  });

  it("同じ id を重複定義していない(登録数と一意集合の要素数が一致)", () => {
    const seen = new Set<string>();
    for (const p of BUILD_INTENT_PRESETS) {
      expect(seen.has(p.id)).toBe(false);
      seen.add(p.id);
    }
  });
});

describe("BuildIntentPreset: カテゴリ", () => {
  it("すべてのプリセットが1つのカテゴリに属する(カテゴリ横断の重複がない)", () => {
    for (const p of BUILD_INTENT_PRESETS) {
      expect(PRESET_CATEGORIES.some((c) => c.categoryId === p.categoryId)).toBe(true);
    }
  });

  it("カテゴリ順(sortOrder)が決定的", () => {
    const orders = PRESET_CATEGORIES.map((c) => c.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("getPresetsByCategoryが正しいプリセットだけを返す", () => {
    for (const cat of PRESET_CATEGORY_IDS) {
      const presets = getPresetsByCategory(cat);
      expect(presets.every((p) => p.categoryId === cat)).toBe(true);
      expect(presets.length).toBe(BUILD_INTENT_PRESETS.filter((p) => p.categoryId === cat).length);
    }
  });

  it("カテゴリの見出しキーがja/en両方の辞書に存在する", () => {
    for (const c of PRESET_CATEGORIES) {
      expect(hasKey(ja as unknown as Record<string, unknown>, "buildAnalysis", c.titleKey)).toBe(true);
      expect(hasKey(en as unknown as Record<string, unknown>, "buildAnalysis", c.titleKey)).toBe(true);
    }
  });
});

describe("BuildIntentPreset: おすすめ目的", () => {
  it("おすすめ目的IDがすべて実在するプリセットを指す", () => {
    for (const id of RECOMMENDED_PRESET_IDS) {
      expect(getPresetById(id)).toBeDefined();
    }
  });
  it("おすすめ目的の順序が固定配列として決定的である", () => {
    expect(RECOMMENDED_PRESET_IDS).toEqual([...RECOMMENDED_PRESET_IDS]);
  });
});

describe("BuildIntentPreset: 検索", () => {
  const resolve = (key: string) => (ja.buildAnalysis as Record<string, string>)[key] ?? key;

  it("「クロス」でクロス関連プリセットが見つかる", () => {
    const results = searchPresets("クロス", BUILD_INTENT_PRESETS, resolve);
    expect(results.some((p) => p.id === "cross-supply")).toBe(true);
    expect(results.some((p) => p.id === "cross-receive-scoring")).toBe(true);
  });

  it("「ドリブル」でドリブル関連プリセットが見つかる", () => {
    const results = searchPresets("ドリブル", BUILD_INTENT_PRESETS, resolve);
    expect(results.some((p) => p.id === "dribble-breakthrough")).toBe(true);
  });

  it("「守備」で守備関連プリセットが見つかる", () => {
    const results = searchPresets("守備", BUILD_INTENT_PRESETS, resolve);
    expect(results.some((p) => p.id === "ball-winning-specialist")).toBe(true);
  });

  it("英語辞書に対しても検索できる", () => {
    const resolveEn = (key: string) => (en.buildAnalysis as Record<string, string>)[key] ?? key;
    const results = searchPresets("cross", BUILD_INTENT_PRESETS, resolveEn);
    expect(results.some((p) => p.id === "cross-supply")).toBe(true);
  });

  it("大文字小文字を区別しない", () => {
    const resolveEn = (key: string) => (en.buildAnalysis as Record<string, string>)[key] ?? key;
    const lower = searchPresets("cross", BUILD_INTENT_PRESETS, resolveEn);
    const upper = searchPresets("CROSS", BUILD_INTENT_PRESETS, resolveEn);
    expect(upper.map((p) => p.id).sort()).toEqual(lower.map((p) => p.id).sort());
  });

  it("空白差を安全に正規化する", () => {
    expect(normalizeSearchText("  a   b  ")).toBe("a b");
    expect(normalizeSearchText("ＡＢＣ")).toBe("abc");
  });

  it("空文字クエリはすべてのプリセットを返す", () => {
    expect(searchPresets("", BUILD_INTENT_PRESETS, resolve).length).toBe(BUILD_INTENT_PRESETS.length);
  });

  it("該当なしの場合は空配列を返す(外部通信なし・純粋なローカル検索)", () => {
    expect(searchPresets("存在しないはずのクエリ12345", BUILD_INTENT_PRESETS, resolve)).toEqual([]);
  });
});

describe("BuildIntentPreset: メイン・サブ目的の適用", () => {
  it("メイン目的からprimaryGoalとpriorityGroupsが設定される", () => {
    const intent = buildPresetPreviewIntent("cross-supply", []);
    expect(intent.primaryGoal).toBe("passing");
    expect(intent.groupPriorities.passing).toBe("priority");
  });

  it("サブ目的の領域は補助的優先(secondary)として設定される", () => {
    const intent = buildPresetPreviewIntent("dribble-breakthrough", ["dribble-to-shot"]);
    expect(intent.groupPriorities.dribbling).toBe("priority"); // メインのpriorityが優先
    expect(intent.groupPriorities.shooting).toBe("secondary");
  });

  it("メインとサブが同じ領域を要求する場合、二重登録せず最優先を優先する", () => {
    const intent = buildPresetPreviewIntent("dribble-breakthrough", ["beat-one-on-wing"]);
    // beat-one-on-wing の priorityGroups=[dribbling] はサブとしてはsecondary相当だが、
    // メインのdribble-breakthroughが既にpriorityなので、dribblingは1つのpriorityとしてのみ存在する。
    expect(intent.groupPriorities.dribbling).toBe("priority");
  });

  it("最大2件までしかサブ目的を反映しない", () => {
    const groups = presetDerivedGroupPriorities("balanced-type", ["scoring-specialist", "ball-winning-specialist", "aerial-specialist"]);
    // MAX_SUB_PRESETS=2 のため、3件目(aerial-specialist)のaerialStrengthは反映されない。
    expect(MAX_SUB_PRESETS).toBe(2);
    expect(groups.shooting).toBe("secondary");
    expect(groups.defending).toBe("secondary");
    expect(groups.aerialStrength).toBeUndefined();
  });

  it("無関係なポジションを自動確定しない(suggestedPositionsはintendedPositionsへ反映されない)", () => {
    const intent = buildPresetPreviewIntent("cross-supply", []);
    expect(intent.intendedPositions).toEqual([]);
  });

  it("同じ選択からは常に同じBuildIntentを生成する(決定的)", () => {
    const a = buildPresetPreviewIntent("cross-supply", ["dribble-then-cross"]);
    const b = buildPresetPreviewIntent("cross-supply", ["dribble-then-cross"]);
    expect(a).toEqual(b);
  });

  it("メイン目的が未選択でも例外を投げない(空の結果を返す)", () => {
    const intent = buildPresetPreviewIntent(null, []);
    expect(intent.primaryGoal).toBe("unspecified");
    expect(Object.keys(intent.groupPriorities)).toEqual([]);
  });

  it("育成ポイント・能力値を一切変更しない(BuildIntentInputに該当フィールドが存在しない)", () => {
    const intent = buildPresetPreviewIntent("scoring-specialist", []);
    expect((intent as unknown as Record<string, unknown>).calculatedOvr).toBeUndefined();
  });
});

describe("BuildIntentPreset: composeDraftIntent(手動修正の合成)", () => {
  const manualFieldsBase = { ...emptyBuildIntent() };

  it("手動修正がない場合はプリセット既定値のみを反映する", () => {
    const draft = composeDraftIntent("cross-supply", [], {}, null, manualFieldsBase);
    expect(draft.groupPriorities.passing).toBe("priority");
  });

  it("手動修正はプリセット既定値を上書きする", () => {
    const draft = composeDraftIntent("cross-supply", [], { passing: "secondary" }, null, manualFieldsBase);
    expect(draft.groupPriorities.passing).toBe("secondary");
  });

  it("手動修正で明示的に'normal'へ戻すと、プリセット既定値も解除される", () => {
    const draft = composeDraftIntent("cross-supply", [], { passing: "normal" }, null, manualFieldsBase);
    expect(draft.groupPriorities.passing).toBeUndefined();
  });

  it("primaryGoalの手動上書きが優先される", () => {
    const draft = composeDraftIntent("cross-supply", [], {}, "scoring", manualFieldsBase);
    expect(draft.primaryGoal).toBe("scoring");
  });

  it("メイン目的を変更しても、手動修正(他領域)はそのまま維持される(合成が非破壊)", () => {
    const manualOverrides = { defending: "priority" as const };
    const before = composeDraftIntent("cross-supply", [], manualOverrides, null, manualFieldsBase);
    const after = composeDraftIntent("dribble-breakthrough", [], manualOverrides, null, manualFieldsBase);
    expect(before.groupPriorities.defending).toBe("priority");
    expect(after.groupPriorities.defending).toBe("priority");
    expect(after.groupPriorities.dribbling).toBe("priority");
    expect(after.groupPriorities.passing).toBeUndefined();
  });

  it("intendedPositions等、プリセットが既定値を持たないフィールドはmanualFieldsをそのまま使う", () => {
    const draft = composeDraftIntent("cross-supply", [], {}, null, { ...manualFieldsBase, intendedPositions: ["RWF"] });
    expect(draft.intendedPositions).toEqual(["RWF"]);
  });
});

describe("BuildIntentPreset: プリセット値とユーザー修正の判別", () => {
  it("プリセット由来のまま変更していない場合はpresetと判定する", () => {
    const derived = presetDerivedGroupPriorities("cross-supply", []);
    expect(classifyGroupPrioritySource("passing", "priority", derived)).toBe("preset");
  });
  it("プリセットと異なる値の場合はuserと判定する", () => {
    const derived = presetDerivedGroupPriorities("cross-supply", []);
    expect(classifyGroupPrioritySource("passing", "secondary", derived)).toBe("user");
  });
  it("プリセットにもユーザー指定にも含まれない場合はunspecifiedと判定する", () => {
    const derived = presetDerivedGroupPriorities("cross-supply", []);
    expect(classifyGroupPrioritySource("defending", "normal", derived)).toBe("unspecified");
  });
  it("プリセットが要求していない領域をユーザーが手動でpriorityにした場合はuserと判定する", () => {
    const derived = presetDerivedGroupPriorities("cross-supply", []);
    expect(classifyGroupPrioritySource("defending", "priority", derived)).toBe("user");
  });
});

describe("BuildIntentPreset: 競合検出", () => {
  it("メイン目的の最優先領域を手動で低優先にすると競合として検出する", () => {
    const intent = { ...emptyBuildIntent(), groupPriorities: { shooting: "low" as const } };
    const conflicts = detectPresetConflicts("scoring-specialist", [], intent);
    expect(conflicts.some((c) => c.groupId === "shooting")).toBe(true);
  });

  it("メイン目的の最優先領域を手動で意図的に捨てると競合として検出する", () => {
    const intent = { ...emptyBuildIntent(), intentionallyIgnoredGroups: ["aerialStrength"] };
    const conflicts = detectPresetConflicts("aerial-specialist", [], intent);
    expect(conflicts.some((c) => c.groupId === "aerialStrength")).toBe(true);
  });

  it("守備特化のプリセットでディフェンスを意図的に捨てると競合になる", () => {
    const intent = { ...emptyBuildIntent(), intentionallyIgnoredGroups: ["defending"] };
    const conflicts = detectPresetConflicts("ball-winning-specialist", [], intent);
    expect(conflicts.some((c) => c.groupId === "defending")).toBe(true);
  });

  it("メインとサブの自然な重複(同じ領域を両方が要求)は競合ではない", () => {
    const intent = { ...emptyBuildIntent(), groupPriorities: { dribbling: "priority" as const } };
    const conflicts = detectPresetConflicts("dribble-breakthrough", ["beat-one-on-wing"], intent);
    expect(conflicts).toEqual([]);
  });

  it("手動設定が競合を勝手に解消しない(検出するだけで値を変更しない)", () => {
    const intent = { ...emptyBuildIntent(), groupPriorities: { shooting: "low" as const } };
    detectPresetConflicts("scoring-specialist", [], intent);
    expect(intent.groupPriorities.shooting).toBe("low");
  });

  it("競合がない場合は空配列を返す", () => {
    const intent = { ...emptyBuildIntent() };
    expect(detectPresetConflicts("scoring-specialist", [], intent)).toEqual([]);
  });
});
