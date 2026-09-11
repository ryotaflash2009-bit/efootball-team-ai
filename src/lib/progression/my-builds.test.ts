import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SavedBuild } from "./types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import type { SquadUsage } from "@/lib/squad/usage";
import { PROGRESSION_RULES_VERSION, PROGRESSION_RULES_VERSION_V1 } from "./constants";
import {
  buildAllocationRows,
  buildPointSummary,
  resolveBuildRuleStatus,
  describeBuildPoM,
  buildHasExperimental,
  formatBuildTimestamp,
  buildTimeValue,
  validateBuildRename,
  nextDuplicateBuildName,
  normalizeBuildSearchQuery,
  matchesBuildSearch,
  filterBuilds,
  sortBuilds,
  buildFacets,
  buildUsageSummary,
  collectUsedBuildIds,
  resolveMyTeamBuildSelectionState,
  validateMyTeamBuildAssignment,
  validateMyTeamFavoriteBuildAssignment,
  validateMyTeamFavoriteBuildClear,
  describeMyTeamBuildChange,
  describeMyTeamFavoriteBuildChange,
  validateMyTeamRegistration,
  buildMyTeamRegistrationPreview,
  resolveMyTeamBuildRefs,
  resolveBuildRef,
  sortMyTeamBuildPanel,
  validateMyTeamBuildRefClear,
  validateSquadBuildAssignment,
  summarizeSquadBuilds,
  filterSquadBuildUsage,
  resolveSafeOwnershipDefault,
  resolveSafeUsageDefault,
  isOwnershipStatus,
  isUsageStatus,
  DEFAULT_BUILD_FILTER,
} from "./my-builds";
import { OWNERSHIP_STATUSES, USAGE_STATUSES } from "@/lib/user-cards/types";

function mkBuild(over: Partial<SavedBuild> = {}): SavedBuild {
  return {
    buildId: over.buildId ?? "b_1",
    worldCardId: over.worldCardId ?? "89138556575063",
    buildName: over.buildName ?? "攻撃ビルド",
    progressionAllocation: over.progressionAllocation ?? { shooting: 3, passing: 2 },
    selectedPlayerBooster: over.selectedPlayerBooster ?? null,
    conditionalBoosterSelections: over.conditionalBoosterSelections,
    calculatedStats: over.calculatedStats ?? { finishing: 90 },
    calculatedOvr: over.calculatedOvr ?? 91,
    calculationMode: over.calculationMode ?? "provisional",
    rulesVersion: over.rulesVersion ?? PROGRESSION_RULES_VERSION,
    createdAt: over.createdAt ?? "2026-08-20T10:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-08-25T10:00:00.000Z",
    schemaVersion: over.schemaVersion ?? 1,
  };
}

function mkCard(over: Partial<WorldPlayerListItem> = {}): WorldPlayerListItem {
  return {
    worldCardId: over.worldCardId ?? "89138556575063",
    nameEn: over.nameEn ?? "Lionel Messi",
    nameJa: over.nameJa ?? "リオネル・メッシ",
    cardType: over.cardType ?? "Epic",
    registeredPosition: over.registeredPosition ?? "RWF",
    ovrBase: over.ovrBase ?? 90,
    ovrMax: over.ovrMax ?? 108,
    maximumLevel: over.maximumLevel ?? 34,
    cardRating: null,
    playingStyle: null,
    playingStyleDefensive: null,
    nationality: "Argentina",
    region: null,
    league: null,
    team: "Inter Miami",
    preferredFoot: null,
    age: null,
    height: null,
    weight: null,
    boost1: null,
    boost2: null,
    appearanceUpdatedAt: null,
    imageUrlCandidate: null,
    mobileImageUrlCandidate: null,
    hasEfhubLink: false,
    efhubCardId: null,
  };
}

describe("buildAllocationRows", () => {
  it("10 カテゴリを PROGRESSION_GROUPS 順で・level 0 も含む", () => {
    const rows = buildAllocationRows({ shooting: 5, defending: 2 });
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ groupId: "shooting", label: "シュート", level: 5 });
    expect(rows.find((r) => r.groupId === "passing")?.level).toBe(0);
    expect(rows.find((r) => r.groupId === "defending")?.level).toBe(2);
  });
  it("不正値・0・負数は level 0（別カードの補完はしない）", () => {
    const rows = buildAllocationRows({ shooting: -1, passing: 0, dribbling: 2.5, dexterity: NaN as never });
    for (const r of rows) if (r.groupId !== "dribbling") expect(r.level).toBe(0);
    expect(rows.find((r) => r.groupId === "dribbling")?.level).toBe(2);
  });
  it("null / undefined でも落ちない", () => {
    expect(buildAllocationRows(null)).toHaveLength(10);
    expect(buildAllocationRows(undefined).every((r) => r.level === 0)).toBe(true);
  });
});

describe("buildPointSummary", () => {
  it("maximumLevel があると合計・残りを出す（現行規則）", () => {
    const s = buildPointSummary(mkBuild({ progressionAllocation: { shooting: 3 } }), 34);
    expect(s.totalPoints).toBe(66); // (34-1)*2
    expect(s.usedPoints).toBeGreaterThan(0);
    expect(s.remainingPoints).toBe(66 - s.usedPoints);
    expect(s.overAllocated).toBe(false);
  });
  it("maximumLevel 不明なら total / remaining は null（0 で代用しない）", () => {
    const s = buildPointSummary(mkBuild(), null);
    expect(s.totalPoints).toBeNull();
    expect(s.remainingPoints).toBeNull();
    expect(s.overAllocated).toBeNull();
    expect(s.usedPoints).toBeGreaterThanOrEqual(0);
  });
  it("旧規則ビルドは v1 ルールセットで used を算出（無条件変換しない）", () => {
    const v1 = buildPointSummary(mkBuild({ rulesVersion: PROGRESSION_RULES_VERSION_V1, progressionAllocation: { shooting: 3 } }), 34);
    const v2 = buildPointSummary(mkBuild({ rulesVersion: PROGRESSION_RULES_VERSION, progressionAllocation: { shooting: 3 } }), 34);
    // v1 は線形（cumulativeCost = level）、v2 は段階制で通常 used が異なる
    expect(v1.usedPoints).toBe(3);
    expect(v2.usedPoints).toBeGreaterThanOrEqual(3);
  });
  it("overAllocated を検出", () => {
    const s = buildPointSummary(mkBuild({ progressionAllocation: { shooting: 30, passing: 30, dribbling: 30 } }), 3);
    expect(s.totalPoints).toBe(4);
    expect(s.overAllocated).toBe(true);
  });
});

describe("resolveBuildRuleStatus", () => {
  it("現行 v2", () => {
    expect(resolveBuildRuleStatus(PROGRESSION_RULES_VERSION)).toMatchObject({ isV2: true, isLegacy: false, label: "現行規則" });
  });
  it("旧規則 v1", () => {
    expect(resolveBuildRuleStatus(PROGRESSION_RULES_VERSION_V1)).toMatchObject({ isV2: false, isLegacy: true, label: "旧規則" });
  });
  it("誤日付 v2 は現行扱い・正規化", () => {
    const r = resolveBuildRuleStatus("progression/2026-08-29.v2");
    expect(r.isV2).toBe(true);
    expect(r.normalized).toBe(PROGRESSION_RULES_VERSION);
  });
});

describe("describeBuildPoM", () => {
  it("指定なし", () => {
    expect(describeBuildPoM(mkBuild())).toEqual({ has: false, tierLabel: null, boosterKey: null });
  });
  it("none 指定は has:false", () => {
    expect(describeBuildPoM(mkBuild({ conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "none" }] })).has).toBe(false);
  });
  it("段階指定を +1 / +2 / +3 で表示", () => {
    expect(describeBuildPoM(mkBuild({ conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_1_13" }] })).tierLabel).toBe("+1");
    expect(describeBuildPoM(mkBuild({ conditionalBoosterSelections: [{ boosterKey: "ball-protection", selection: "league_20_plus" }] })).tierLabel).toBe("+3");
  });
});

describe("buildHasExperimental", () => {
  it("selectedPlayerBooster が数値なら true", () => {
    expect(buildHasExperimental(mkBuild({ selectedPlayerBooster: 73 }))).toBe(true);
    expect(buildHasExperimental(mkBuild({ selectedPlayerBooster: null }))).toBe(false);
  });
});

describe("日時", () => {
  it("正常な ISO を整形", () => {
    expect(formatBuildTimestamp("2026-08-25T10:00:00.000Z")).not.toBe("—");
  });
  it("不正な日時は — （現在時刻で代用しない）", () => {
    expect(formatBuildTimestamp("not-a-date")).toBe("—");
    expect(formatBuildTimestamp("")).toBe("—");
    expect(formatBuildTimestamp(null)).toBe("—");
    expect(buildTimeValue("not-a-date")).toBeNull();
    expect(buildTimeValue("2026-08-25T10:00:00.000Z")).toBeGreaterThan(0);
  });
});

describe("validateBuildRename", () => {
  it("正常", () => {
    expect(validateBuildRename("  新しい名前  ")).toEqual({ ok: true, name: "新しい名前" });
  });
  it("空文字は拒否", () => {
    expect(validateBuildRename("   ").ok).toBe(false);
    expect(validateBuildRename("").ok).toBe(false);
  });
  it("60文字は OK / 61文字は拒否", () => {
    expect(validateBuildRename("あ".repeat(60)).ok).toBe(true);
    expect(validateBuildRename("あ".repeat(61)).ok).toBe(false);
  });
  it("改行は拒否", () => {
    expect(validateBuildRename("a\nb").ok).toBe(false);
    expect(validateBuildRename("a\r\nb").ok).toBe(false);
  });
  it("制御文字は除去", () => {
    const r = validateBuildRename("ab c");
    expect(r).toEqual({ ok: true, name: "abc" });
  });
  it("非文字列は拒否", () => {
    expect(validateBuildRename(123 as never).ok).toBe(false);
  });
});

describe("nextDuplicateBuildName", () => {
  it("既定は「のコピー」", () => {
    expect(nextDuplicateBuildName("攻撃", [])).toBe("攻撃 のコピー");
  });
  it("同名があれば 2, 3 …", () => {
    expect(nextDuplicateBuildName("攻撃", ["攻撃 のコピー"])).toBe("攻撃 のコピー 2");
    expect(nextDuplicateBuildName("攻撃", ["攻撃 のコピー", "攻撃 のコピー 2"])).toBe("攻撃 のコピー 3");
  });
});

describe("検索", () => {
  it("正規化（trim・小文字・空白圧縮・制御文字除去）", () => {
    expect(normalizeBuildSearchQuery("  Messi  RWF  ")).toBe("messi rwf");
    expect(normalizeBuildSearchQuery(123 as never)).toBe("");
  });
  it("日本語選手名 / 英語選手名 / World ID / ビルド名 / buildId で部分一致", () => {
    const b = mkBuild({ buildName: "決定力型", buildId: "b_abc123", worldCardId: "89138556575063" });
    const c = mkCard();
    expect(matchesBuildSearch(b, c, normalizeBuildSearchQuery("メッシ"))).toBe(true);
    expect(matchesBuildSearch(b, c, normalizeBuildSearchQuery("messi"))).toBe(true);
    expect(matchesBuildSearch(b, c, normalizeBuildSearchQuery("891385"))).toBe(true);
    expect(matchesBuildSearch(b, c, normalizeBuildSearchQuery("決定力"))).toBe(true);
    expect(matchesBuildSearch(b, c, normalizeBuildSearchQuery("b_abc"))).toBe(true);
    expect(matchesBuildSearch(b, c, normalizeBuildSearchQuery("no-such"))).toBe(false);
  });
  it("空クエリは常に一致・カード未解決でも落ちない", () => {
    expect(matchesBuildSearch(mkBuild(), null, "")).toBe(true);
    expect(matchesBuildSearch(mkBuild(), null, normalizeBuildSearchQuery("<script>"))).toBe(false);
  });
  it("正規表現記号は文字通り扱う（評価しない）", () => {
    const b = mkBuild({ buildName: "a.b*c" });
    expect(matchesBuildSearch(b, null, normalizeBuildSearchQuery("a.b*c"))).toBe(true);
    expect(matchesBuildSearch(b, null, normalizeBuildSearchQuery(".*"))).toBe(false);
  });
});

describe("filterBuilds", () => {
  const cards = new Map<string, WorldPlayerListItem>([
    ["1", mkCard({ worldCardId: "1", nameJa: "A", cardType: "Epic", registeredPosition: "CF" })],
    ["2", mkCard({ worldCardId: "2", nameJa: "B", cardType: "Standard", registeredPosition: "CB" })],
  ]);
  const builds = [
    mkBuild({ buildId: "b1", worldCardId: "1", rulesVersion: PROGRESSION_RULES_VERSION }),
    mkBuild({ buildId: "b2", worldCardId: "2", rulesVersion: PROGRESSION_RULES_VERSION_V1, conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_1_13" }] }),
    mkBuild({ buildId: "b3", worldCardId: "1", selectedPlayerBooster: 73 }),
  ];
  const base = { cards, usedBuildIds: new Set(["b1"]) };

  it("カードタイプ絞り込み", () => {
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, cardType: "Epic" } }).map((b) => b.buildId)).toEqual(["b1", "b3"]);
  });
  it("ポジション絞り込み", () => {
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, position: "CB" } }).map((b) => b.buildId)).toEqual(["b2"]);
  });
  it("現行 / 旧規則", () => {
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, rules: "legacy" } }).map((b) => b.buildId)).toEqual(["b2"]);
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, rules: "current" } }).map((b) => b.buildId)).toEqual(["b1", "b3"]);
  });
  it("Power of Many 指定あり / 実験設定あり", () => {
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, pom: "with" } }).map((b) => b.buildId)).toEqual(["b2"]);
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, experimental: "with" } }).map((b) => b.buildId)).toEqual(["b3"]);
  });
  it("使用中 / 未使用", () => {
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, usage: "used" } }).map((b) => b.buildId)).toEqual(["b1"]);
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, usage: "unused" } }).map((b) => b.buildId)).toEqual(["b2", "b3"]);
  });
  it("複数条件 AND", () => {
    expect(filterBuilds(builds, { ...base, filter: { ...DEFAULT_BUILD_FILTER, cardType: "Epic", rules: "current" } }).map((b) => b.buildId)).toEqual(["b1", "b3"]);
  });
});

describe("sortBuilds", () => {
  const cards = new Map<string, WorldPlayerListItem>([
    ["1", mkCard({ worldCardId: "1", nameJa: "あ選手" })],
    ["2", mkCard({ worldCardId: "2", nameJa: "ん選手" })],
  ]);
  const builds = [
    mkBuild({ buildId: "b1", worldCardId: "1", buildName: "Z", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" }),
    mkBuild({ buildId: "b2", worldCardId: "2", buildName: "A", createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z" }),
    mkBuild({ buildId: "b3", worldCardId: "1", buildName: "A", createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z" }),
  ];
  it("更新日時 新しい順 / 古い順", () => {
    expect(sortBuilds(builds, cards, "updated_desc").map((b) => b.buildId)).toEqual(["b3", "b1", "b2"]);
    expect(sortBuilds(builds, cards, "updated_asc").map((b) => b.buildId)).toEqual(["b2", "b1", "b3"]);
  });
  it("作成日時 新しい順", () => {
    expect(sortBuilds(builds, cards, "created_desc").map((b) => b.buildId)).toEqual(["b2", "b3", "b1"]);
  });
  it("ビルド名順（同名は buildId 安定）", () => {
    expect(sortBuilds(builds, cards, "name_asc").map((b) => b.buildId)).toEqual(["b2", "b3", "b1"]);
  });
  it("選手名順", () => {
    expect(sortBuilds(builds, cards, "player_asc").map((b) => b.worldCardId)).toEqual(["1", "1", "2"]);
  });
  it("不正日時は末尾・クラッシュしない", () => {
    const bad = [...builds, mkBuild({ buildId: "b4", updatedAt: "broken" })];
    expect(sortBuilds(bad, cards, "updated_desc").map((b) => b.buildId).at(-1)).toBe("b4");
  });
  it("元配列を変更しない", () => {
    const snapshot = builds.map((b) => b.buildId);
    sortBuilds(builds, cards, "name_asc");
    expect(builds.map((b) => b.buildId)).toEqual(snapshot);
  });
});

describe("buildFacets", () => {
  it("今あるビルドとカードから既知値だけ生成", () => {
    const cards = new Map<string, WorldPlayerListItem>([
      ["1", mkCard({ worldCardId: "1", cardType: "Epic", registeredPosition: "CF" })],
      ["2", mkCard({ worldCardId: "2", cardType: "Standard", registeredPosition: "CB" })],
    ]);
    const f = buildFacets([mkBuild({ worldCardId: "1" }), mkBuild({ worldCardId: "2", buildId: "b_2" })], cards);
    expect(f.cardTypes).toEqual(["Epic", "Standard"]);
    expect(f.positions).toEqual(["CB", "CF"]);
  });
});

describe("buildUsageSummary / collectUsedBuildIds", () => {
  const myTeam: MyTeamRecord[] = [
    {
      localRecordId: "myt_x", teamCardId: "tc_x", worldCardId: "1",
      ownershipStatus: "owned", usageStatus: "main",
      selectedBuildId: "b1", favoriteBuildId: "b9",
      note: "", tags: [], addedAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
      deletedAt: null, source: "local", syncStatus: "local_only",
    },
  ];
  const squadUsage: SquadUsage[] = [
    { squadId: "sq_1", squadName: "メイン", formationId: "f", formationName: "F", hasCustomPositioning: false, area: "starter", slotId: "s1", benchIndex: null, x: 50, y: 50, placementRole: "CF", isCaptain: false, setPieceRoles: [], savedBuildId: "b1", updatedAt: "2026-08-02T00:00:00.000Z" },
    { squadId: "sq_1", squadName: "メイン", formationId: "f", formationName: "F", hasCustomPositioning: false, area: "bench", slotId: null, benchIndex: 0, x: null, y: null, placementRole: null, isCaptain: false, setPieceRoles: [], savedBuildId: "b1", updatedAt: "2026-08-02T00:00:00.000Z" },
    { squadId: "sq_2", squadName: "対人用", formationId: "f", formationName: "F", hasCustomPositioning: false, area: "starter", slotId: "s2", benchIndex: null, x: 50, y: 50, placementRole: "CB", isCaptain: false, setPieceRoles: [], savedBuildId: "bX", updatedAt: "2026-08-02T00:00:00.000Z" },
  ];

  it("My Team 選択中 / お気に入り / スカッド（同一スカッドは重複しない）", () => {
    const u = buildUsageSummary(mkBuild({ buildId: "b1", worldCardId: "1" }), { myTeam, squadUsage });
    expect(u.myTeamSelected).toBe(true);
    expect(u.myTeamFavorite).toBe(false);
    expect(u.squads).toHaveLength(1);
    expect(u.squads[0].squadName).toBe("メイン");
    expect(u.squads[0].areas.sort()).toEqual(["ベンチ", "先発（CF）"].sort());
    expect(u.anyUsage).toBe(true);
  });
  it("お気に入りビルド参照を検出", () => {
    const u = buildUsageSummary(mkBuild({ buildId: "b9", worldCardId: "1" }), { myTeam, squadUsage: [] });
    expect(u.myTeamFavorite).toBe(true);
    expect(u.anyUsage).toBe(true);
  });
  it("未使用", () => {
    const u = buildUsageSummary(mkBuild({ buildId: "b_unused", worldCardId: "1" }), { myTeam, squadUsage });
    expect(u.anyUsage).toBe(false);
    expect(u.squads).toEqual([]);
  });
  it("collectUsedBuildIds は全ビルド分をまとめて判定", () => {
    const builds = [mkBuild({ buildId: "b1", worldCardId: "1" }), mkBuild({ buildId: "bX", worldCardId: "2" }), mkBuild({ buildId: "b_free", worldCardId: "1" })];
    const map = new Map<string, SquadUsage[]>([
      ["1", squadUsage.filter((u) => u.savedBuildId === "b1")],
      ["2", squadUsage.filter((u) => u.savedBuildId === "bX")],
    ]);
    const used = collectUsedBuildIds(builds, myTeam, map);
    expect([...used].sort()).toEqual(["b1", "bX"]);
  });
});

function mkRecord(over: Partial<MyTeamRecord> = {}): MyTeamRecord {
  return {
    localRecordId: over.localRecordId ?? "myt_1",
    teamCardId: over.teamCardId ?? "tc_1",
    worldCardId: over.worldCardId ?? "89138556575063",
    ownershipStatus: over.ownershipStatus ?? "owned",
    usageStatus: over.usageStatus ?? "main",
    selectedBuildId: over.selectedBuildId ?? null,
    favoriteBuildId: over.favoriteBuildId ?? null,
    note: over.note ?? "メモは残る",
    tags: over.tags ?? ["tag1"],
    addedAt: over.addedAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-08-01T00:00:00.000Z",
    deletedAt: over.deletedAt ?? null,
    source: "local",
    syncStatus: "local_only",
  };
}

describe("resolveMyTeamBuildSelectionState", () => {
  const build = mkBuild({ buildId: "b1", worldCardId: "89138556575063" });

  it("My Team レコードが無い → not-in-team", () => {
    expect(resolveMyTeamBuildSelectionState(build, null).state).toBe("not-in-team");
    expect(resolveMyTeamBuildSelectionState(build, undefined).state).toBe("not-in-team");
  });
  it("別 worldCardId のレコードは not-in-team（同一人物の別カードを統合しない）", () => {
    expect(resolveMyTeamBuildSelectionState(build, mkRecord({ worldCardId: "99999999999999" })).state).toBe("not-in-team");
  });
  it("selectedBuildId が一致 → selected", () => {
    const s = resolveMyTeamBuildSelectionState(build, mkRecord({ selectedBuildId: "b1" }));
    expect(s.state).toBe("selected");
    expect(s.currentSelectedBuildId).toBe("b1");
    expect(s.teamCardId).toBe("tc_1");
  });
  it("selectedBuildId が別 / 未選択 → assignable", () => {
    expect(resolveMyTeamBuildSelectionState(build, mkRecord({ selectedBuildId: "b_other" })).state).toBe("assignable");
    expect(resolveMyTeamBuildSelectionState(build, mkRecord({ selectedBuildId: null })).state).toBe("assignable");
  });
  it("favoriteBuildId 一致は isFavorite で別に返す（selected とは独立）", () => {
    const s = resolveMyTeamBuildSelectionState(build, mkRecord({ selectedBuildId: "b_other", favoriteBuildId: "b1" }));
    expect(s.state).toBe("assignable");
    expect(s.isFavorite).toBe(true);
  });
  it("selectedBuildId と favoriteBuildId の両方一致", () => {
    const s = resolveMyTeamBuildSelectionState(build, mkRecord({ selectedBuildId: "b1", favoriteBuildId: "b1" }));
    expect(s.state).toBe("selected");
    expect(s.isSelected).toBe(true);
    expect(s.isFavorite).toBe(true);
  });
  it("currentFavoriteBuildId / currentSelectedBuildId を返す（未登録は null）", () => {
    const s = resolveMyTeamBuildSelectionState(build, mkRecord({ selectedBuildId: "b_sel", favoriteBuildId: "b_fav" }));
    expect(s.currentSelectedBuildId).toBe("b_sel");
    expect(s.currentFavoriteBuildId).toBe("b_fav");
    expect(s.isSelected).toBe(false);
    expect(s.isFavorite).toBe(false);
    const n = resolveMyTeamBuildSelectionState(build, null);
    expect(n.currentFavoriteBuildId).toBeNull();
    expect(n.isSelected).toBe(false);
  });
});

describe("validateMyTeamBuildAssignment", () => {
  const build = mkBuild({ buildId: "b1", worldCardId: "89138556575063" });
  const record = mkRecord({ worldCardId: "89138556575063", teamCardId: "tc_1", selectedBuildId: "b_other" });
  const stored = build;
  const ok = { build, record, storedBuild: stored, storageAvailable: true };

  it("正常 → ok + teamCardId", () => {
    expect(validateMyTeamBuildAssignment(ok)).toEqual({ ok: true, teamCardId: "tc_1" });
  });
  it("localStorage 不可 → 失敗", () => {
    expect(validateMyTeamBuildAssignment({ ...ok, storageAvailable: false }).ok).toBe(false);
  });
  it("My Team 未登録（record null）→ 失敗", () => {
    expect(validateMyTeamBuildAssignment({ ...ok, record: null }).ok).toBe(false);
  });
  it("record の worldCardId が別（別タブで変化）→ 失敗", () => {
    expect(validateMyTeamBuildAssignment({ ...ok, record: mkRecord({ worldCardId: "11111111111111" }) }).ok).toBe(false);
  });
  it("保存ビルドが見つからない（削除済み）→ 失敗", () => {
    expect(validateMyTeamBuildAssignment({ ...ok, storedBuild: null }).ok).toBe(false);
    expect(validateMyTeamBuildAssignment({ ...ok, storedBuild: mkBuild({ buildId: "b_diff" }) }).ok).toBe(false);
  });
  it("worldCardId が数字文字列でない / buildId 形式不正 → 失敗（Number 変換しない）", () => {
    expect(validateMyTeamBuildAssignment({ ...ok, build: mkBuild({ worldCardId: "abc" as never, buildId: "b1" }) }).ok).toBe(false);
    expect(validateMyTeamBuildAssignment({ ...ok, build: mkBuild({ buildId: "" as never }) }).ok).toBe(false);
    expect(validateMyTeamBuildAssignment({ ...ok, build: mkBuild({ buildId: "bad id!" as never }) }).ok).toBe(false);
  });
  it("teamCardId が空 → 失敗", () => {
    expect(validateMyTeamBuildAssignment({ ...ok, record: mkRecord({ teamCardId: "" }) }).ok).toBe(false);
  });
  it("大きな worldCardId（20桁）を許容", () => {
    const big = "12345678901234567890";
    expect(
      validateMyTeamBuildAssignment({
        build: mkBuild({ worldCardId: big, buildId: "b1" }),
        record: mkRecord({ worldCardId: big }),
        storedBuild: mkBuild({ worldCardId: big, buildId: "b1" }),
        storageAvailable: true,
      }).ok,
    ).toBe(true);
  });
});

describe("describeMyTeamBuildChange", () => {
  const build = mkBuild({ buildId: "b1", buildName: "決定力型", worldCardId: "89138556575063" });

  it("選択なし → from は null・alreadySelected false", () => {
    const d = describeMyTeamBuildChange(build, mkRecord({ selectedBuildId: null }), null);
    expect(d).toMatchObject({ toBuildId: "b1", toBuildName: "決定力型", fromBuildId: null, fromBuildName: null, fromMissing: false, alreadySelected: false });
  });
  it("別ビルド選択中 → from を表示", () => {
    const cur = mkBuild({ buildId: "b_old", buildName: "守備型" });
    const d = describeMyTeamBuildChange(build, mkRecord({ selectedBuildId: "b_old" }), cur);
    expect(d.fromBuildId).toBe("b_old");
    expect(d.fromBuildName).toBe("守備型");
    expect(d.fromMissing).toBe(false);
  });
  it("現在の選択中ビルドが見つからない → fromMissing true（元 ID は消さない）", () => {
    const d = describeMyTeamBuildChange(build, mkRecord({ selectedBuildId: "b_gone" }), null);
    expect(d.fromBuildId).toBe("b_gone");
    expect(d.fromMissing).toBe(true);
  });
  it("既に選択中 → alreadySelected true", () => {
    const d = describeMyTeamBuildChange(build, mkRecord({ selectedBuildId: "b1" }), build);
    expect(d.alreadySelected).toBe(true);
  });
});

describe("validateMyTeamFavoriteBuildAssignment / Clear", () => {
  const build = mkBuild({ buildId: "b1", worldCardId: "89138556575063" });
  const stored = build;

  it("設定: 検証は selectedBuildId 設定と同じ（正常 → ok + teamCardId）", () => {
    const record = mkRecord({ teamCardId: "tc_1", favoriteBuildId: "b_other" });
    expect(validateMyTeamFavoriteBuildAssignment({ build, record, storedBuild: stored, storageAvailable: true })).toEqual({
      ok: true,
      teamCardId: "tc_1",
    });
  });
  it("設定: My Team 未登録 / 別 worldCardId / 削除済みビルド / localStorage 不可 は失敗", () => {
    expect(validateMyTeamFavoriteBuildAssignment({ build, record: null, storedBuild: stored, storageAvailable: true }).ok).toBe(false);
    expect(validateMyTeamFavoriteBuildAssignment({ build, record: mkRecord({ worldCardId: "11111111111111" }), storedBuild: stored, storageAvailable: true }).ok).toBe(false);
    expect(validateMyTeamFavoriteBuildAssignment({ build, record: mkRecord(), storedBuild: null, storageAvailable: true }).ok).toBe(false);
    expect(validateMyTeamFavoriteBuildAssignment({ build, record: mkRecord(), storedBuild: stored, storageAvailable: false }).ok).toBe(false);
  });
  it("設定: Number 型 worldCardId / 空 buildId は失敗（Number 変換しない）", () => {
    expect(validateMyTeamFavoriteBuildAssignment({ build: mkBuild({ worldCardId: "abc" as never }), record: mkRecord({ worldCardId: "abc" }), storedBuild: stored, storageAvailable: true }).ok).toBe(false);
    expect(validateMyTeamFavoriteBuildAssignment({ build: mkBuild({ buildId: "" as never }), record: mkRecord(), storedBuild: stored, storageAvailable: true }).ok).toBe(false);
  });
  it("解除: favoriteBuildId が現在このビルドを指しているときだけ ok", () => {
    const match = mkRecord({ teamCardId: "tc_1", favoriteBuildId: "b1" });
    expect(validateMyTeamFavoriteBuildClear({ build, record: match, storedBuild: stored, storageAvailable: true })).toEqual({
      ok: true,
      teamCardId: "tc_1",
    });
  });
  it("解除: favoriteBuildId が別ビルド / null なら失敗（競合扱い）", () => {
    expect(validateMyTeamFavoriteBuildClear({ build, record: mkRecord({ favoriteBuildId: "b_other" }), storedBuild: stored, storageAvailable: true }).ok).toBe(false);
    expect(validateMyTeamFavoriteBuildClear({ build, record: mkRecord({ favoriteBuildId: null }), storedBuild: stored, storageAvailable: true }).ok).toBe(false);
  });
});

describe("describeMyTeamFavoriteBuildChange", () => {
  const build = mkBuild({ buildId: "b1", buildName: "決定力型", worldCardId: "89138556575063" });

  it("お気に入りなし → from は null・selectedBuildId は併記（変更しない）", () => {
    const d = describeMyTeamFavoriteBuildChange(build, mkRecord({ favoriteBuildId: null, selectedBuildId: "b_sel" }), null);
    expect(d).toMatchObject({ toBuildId: "b1", fromBuildId: null, fromMissing: false, alreadyFavorite: false, selectedBuildId: "b_sel" });
  });
  it("別ビルドがお気に入り → from を表示", () => {
    const cur = mkBuild({ buildId: "b_old", buildName: "守備型" });
    const d = describeMyTeamFavoriteBuildChange(build, mkRecord({ favoriteBuildId: "b_old" }), cur);
    expect(d.fromBuildId).toBe("b_old");
    expect(d.fromBuildName).toBe("守備型");
  });
  it("現在のお気に入りが見つからない → fromMissing true（元 ID は消さない）", () => {
    const d = describeMyTeamFavoriteBuildChange(build, mkRecord({ favoriteBuildId: "b_gone" }), null);
    expect(d.fromBuildId).toBe("b_gone");
    expect(d.fromMissing).toBe(true);
  });
  it("既にお気に入り → alreadyFavorite true", () => {
    const d = describeMyTeamFavoriteBuildChange(build, mkRecord({ favoriteBuildId: "b1" }), build);
    expect(d.alreadyFavorite).toBe(true);
  });
});

describe("My Team 新規登録 純関数", () => {
  const build = mkBuild({ buildId: "b1", worldCardId: "89138556575063", buildName: "決定力型" });
  const stored = build;
  const base = {
    build,
    existingRecord: null as MyTeamRecord | null,
    storedBuild: stored as SavedBuild | null,
    storageAvailable: true,
    ownershipStatus: "owned",
    usageStatus: "unknown",
  };

  it("安全な初期値は既存 enum の値", () => {
    expect(isOwnershipStatus(resolveSafeOwnershipDefault())).toBe(true);
    expect(isUsageStatus(resolveSafeUsageDefault())).toBe(true);
    expect(resolveSafeOwnershipDefault()).toBe("owned");
    expect(resolveSafeUsageDefault()).toBe("unknown");
  });

  it("isOwnershipStatus / isUsageStatus は既存の選択肢だけ true", () => {
    for (const s of OWNERSHIP_STATUSES) expect(isOwnershipStatus(s)).toBe(true);
    for (const s of USAGE_STATUSES) expect(isUsageStatus(s)).toBe(true);
    expect(isOwnershipStatus("main")).toBe(false);
    expect(isUsageStatus("owned")).toBe(false);
    expect(isOwnershipStatus("")).toBe(false);
    expect(isOwnershipStatus(1 as never)).toBe(false);
  });

  it("正常 → ok（worldCardId は文字列のまま返る）", () => {
    const v = validateMyTeamRegistration(base);
    expect(v).toEqual({ ok: true, worldCardId: "89138556575063", ownershipStatus: "owned", usageStatus: "unknown" });
  });

  it("localStorage 不可 → storage", () => {
    expect(validateMyTeamRegistration({ ...base, storageAvailable: false })).toMatchObject({ ok: false, code: "storage" });
  });

  it("worldCardId が数字文字列でない / Number 変換しない → world-card-id", () => {
    expect(
      validateMyTeamRegistration({ ...base, build: mkBuild({ worldCardId: "abc" as never, buildId: "b1" }) }),
    ).toMatchObject({ ok: false, code: "world-card-id" });
    expect(
      validateMyTeamRegistration({ ...base, build: mkBuild({ worldCardId: 891 as never, buildId: "b1" }) }),
    ).toMatchObject({ ok: false, code: "world-card-id" });
  });

  it("buildId 形式不正 → build-id", () => {
    expect(
      validateMyTeamRegistration({ ...base, build: mkBuild({ buildId: "bad id!" as never }) }),
    ).toMatchObject({ ok: false, code: "build-id" });
  });

  it("保存ビルドが削除済み / buildId・worldCardId 不一致 → build-missing", () => {
    expect(validateMyTeamRegistration({ ...base, storedBuild: null })).toMatchObject({ ok: false, code: "build-missing" });
    expect(
      validateMyTeamRegistration({ ...base, storedBuild: mkBuild({ buildId: "b_other" }) }),
    ).toMatchObject({ ok: false, code: "build-missing" });
  });

  it("同一 worldCardId が既に登録済み → duplicate", () => {
    expect(
      validateMyTeamRegistration({ ...base, existingRecord: mkRecord({ worldCardId: "89138556575063" }) }),
    ).toMatchObject({ ok: false, code: "duplicate" });
  });

  it("別 worldCardId のレコードは重複ではない（同一人物の別カードを統合しない）", () => {
    expect(
      validateMyTeamRegistration({ ...base, existingRecord: mkRecord({ worldCardId: "11111111111111" }) }).ok,
    ).toBe(true);
  });

  it("所有状態・使用状態が不正 → ownership / usage", () => {
    expect(validateMyTeamRegistration({ ...base, ownershipStatus: "main" })).toMatchObject({ ok: false, code: "ownership" });
    expect(validateMyTeamRegistration({ ...base, ownershipStatus: "" })).toMatchObject({ ok: false, code: "ownership" });
    expect(validateMyTeamRegistration({ ...base, usageStatus: "owned" })).toMatchObject({ ok: false, code: "usage" });
  });

  it("大きな worldCardId（20桁）を許容", () => {
    const big = "12345678901234567890";
    const b = mkBuild({ worldCardId: big, buildId: "b1" });
    expect(
      validateMyTeamRegistration({ ...base, build: b, storedBuild: b, existingRecord: null }).ok,
    ).toBe(true);
  });

  it("buildMyTeamRegistrationPreview: selected/favorite は独立（4 組み合わせ）", () => {
    const so = buildMyTeamRegistrationPreview(build, { ownershipStatus: "owned", usageStatus: "unknown", setSelected: true, setFavorite: false });
    expect(so).toMatchObject({ selectedBuildName: "決定力型", favoriteBuildName: null, twoStage: false, tags: [], note: "" });

    const of_ = buildMyTeamRegistrationPreview(build, { ownershipStatus: "owned", usageStatus: "unknown", setSelected: false, setFavorite: true });
    expect(of_).toMatchObject({ selectedBuildName: null, favoriteBuildName: "決定力型", twoStage: true });

    const both = buildMyTeamRegistrationPreview(build, { ownershipStatus: "wanted", usageStatus: "main", setSelected: true, setFavorite: true });
    expect(both).toMatchObject({ selectedBuildName: "決定力型", favoriteBuildName: "決定力型", twoStage: true, ownershipStatus: "wanted", usageStatus: "main" });

    const none = buildMyTeamRegistrationPreview(build, { ownershipStatus: "owned", usageStatus: "unknown", setSelected: false, setFavorite: false });
    expect(none).toMatchObject({ selectedBuildName: null, favoriteBuildName: null, twoStage: false });
  });
});

describe("My Team ビルド選択パネル 純関数", () => {
  const cardId = "89138556575063";
  const bSel = mkBuild({ buildId: "b_sel", worldCardId: cardId, buildName: "選択中", updatedAt: "2026-08-10T00:00:00.000Z" });
  const bFav = mkBuild({ buildId: "b_fav", worldCardId: cardId, buildName: "お気に入り", updatedAt: "2026-08-20T00:00:00.000Z" });
  const bNew = mkBuild({ buildId: "b_new", worldCardId: cardId, buildName: "新しい", updatedAt: "2026-08-30T00:00:00.000Z" });
  const bOld = mkBuild({ buildId: "b_old", worldCardId: cardId, buildName: "古い", updatedAt: "2026-08-01T00:00:00.000Z" });
  const builds = [bOld, bNew, bSel, bFav];

  describe("resolveMyTeamBuildRefs", () => {
    it("selected / favorite が一覧のどのビルドを指すか", () => {
      const r = resolveMyTeamBuildRefs(mkRecord({ worldCardId: cardId, selectedBuildId: "b_sel", favoriteBuildId: "b_fav" }), builds);
      expect(r.selected).toEqual({ buildId: "b_sel", build: bSel, missing: false });
      expect(r.favorite).toEqual({ buildId: "b_fav", build: bFav, missing: false });
    });
    it("未設定は buildId null・missing false", () => {
      const r = resolveMyTeamBuildRefs(mkRecord({ selectedBuildId: null, favoriteBuildId: null }), builds);
      expect(r.selected).toEqual({ buildId: null, build: null, missing: false });
      expect(r.favorite).toEqual({ buildId: null, build: null, missing: false });
    });
    it("削除済み参照は buildId 保持・missing true（元 ID を消さない）", () => {
      const r = resolveMyTeamBuildRefs(mkRecord({ selectedBuildId: "b_gone", favoriteBuildId: "b_also_gone" }), builds);
      expect(r.selected).toEqual({ buildId: "b_gone", build: null, missing: true });
      expect(r.favorite.missing).toBe(true);
    });
    it("record null / builds 空でも落ちない", () => {
      expect(resolveMyTeamBuildRefs(null, builds).selected.buildId).toBeNull();
      expect(resolveMyTeamBuildRefs(mkRecord({ selectedBuildId: "b_sel" }), []).selected.missing).toBe(true);
    });
    it("同じ buildId が selected かつ favorite", () => {
      const r = resolveMyTeamBuildRefs(mkRecord({ selectedBuildId: "b_sel", favoriteBuildId: "b_sel" }), builds);
      expect(r.selected.build).toBe(bSel);
      expect(r.favorite.build).toBe(bSel);
    });
  });

  describe("sortMyTeamBuildPanel", () => {
    it("選択中 → お気に入り → 更新日時降順 → buildId 安定", () => {
      const out = sortMyTeamBuildPanel(builds, { selectedBuildId: "b_sel", favoriteBuildId: "b_fav" });
      expect(out.map((b) => b.buildId)).toEqual(["b_sel", "b_fav", "b_new", "b_old"]);
    });
    it("selected == favorite でも 1 件だけ先頭", () => {
      const out = sortMyTeamBuildPanel(builds, { selectedBuildId: "b_sel", favoriteBuildId: "b_sel" });
      expect(out[0].buildId).toBe("b_sel");
      expect(out.filter((b) => b.buildId === "b_sel")).toHaveLength(1);
    });
    it("参照なしなら更新日時降順のみ", () => {
      const out = sortMyTeamBuildPanel(builds, { selectedBuildId: null, favoriteBuildId: null });
      expect(out.map((b) => b.buildId)).toEqual(["b_new", "b_fav", "b_sel", "b_old"]);
    });
    it("不正日時は末尾・元配列は不変", () => {
      const withBad = [...builds, mkBuild({ buildId: "b_bad", worldCardId: cardId, updatedAt: "broken" })];
      const snap = withBad.map((b) => b.buildId);
      const out = sortMyTeamBuildPanel(withBad, { selectedBuildId: null, favoriteBuildId: null });
      expect(out.at(-1)?.buildId).toBe("b_bad");
      expect(withBad.map((b) => b.buildId)).toEqual(snap);
    });
  });

  describe("validateMyTeamBuildRefClear", () => {
    const base = {
      teamCardId: "tc_1",
      field: "selectedBuildId" as const,
      currentBuildId: "b_sel",
      storageAvailable: true,
    };
    it("現在値が一致 → ok + teamCardId", () => {
      const rec = mkRecord({ teamCardId: "tc_1", selectedBuildId: "b_sel" });
      expect(validateMyTeamBuildRefClear({ ...base, record: rec })).toEqual({ ok: true, teamCardId: "tc_1" });
    });
    it("削除済み参照でも現在値が一致すれば解除できる（storedBuild 不要）", () => {
      const rec = mkRecord({ teamCardId: "tc_1", selectedBuildId: "b_gone" });
      expect(validateMyTeamBuildRefClear({ ...base, record: rec, currentBuildId: "b_gone" }).ok).toBe(true);
    });
    it("favoriteBuildId フィールドも同様", () => {
      const rec = mkRecord({ teamCardId: "tc_1", favoriteBuildId: "b_fav" });
      expect(
        validateMyTeamBuildRefClear({ ...base, record: rec, field: "favoriteBuildId", currentBuildId: "b_fav" }).ok,
      ).toBe(true);
    });
    it("localStorage 不可 / record null / teamCardId 不一致 → 失敗", () => {
      expect(validateMyTeamBuildRefClear({ ...base, record: mkRecord({ selectedBuildId: "b_sel" }), storageAvailable: false }).ok).toBe(false);
      expect(validateMyTeamBuildRefClear({ ...base, record: null }).ok).toBe(false);
      expect(validateMyTeamBuildRefClear({ ...base, record: mkRecord({ teamCardId: "tc_other", selectedBuildId: "b_sel" }) }).ok).toBe(false);
    });
    it("現在値が別タブで変わっている → 競合失敗（上書きしない）", () => {
      const rec = mkRecord({ teamCardId: "tc_1", selectedBuildId: "b_changed" });
      expect(validateMyTeamBuildRefClear({ ...base, record: rec, currentBuildId: "b_sel" }).ok).toBe(false);
    });
    it("既に null → 失敗（再読込案内）", () => {
      const rec = mkRecord({ teamCardId: "tc_1", selectedBuildId: null });
      expect(validateMyTeamBuildRefClear({ ...base, record: rec, currentBuildId: null }).ok).toBe(false);
    });
  });
});

describe("スカッド枠の保存ビルド選択 純関数", () => {
  const cardId = "89138556575063";
  const b1 = mkBuild({ buildId: "b_one", worldCardId: cardId, buildName: "先発ビルド" });
  const b2 = mkBuild({ buildId: "b_two", worldCardId: cardId, buildName: "別ビルド" });
  const builds = [b1, b2];

  describe("resolveBuildRef", () => {
    it("一致 / 未設定 / 削除済み", () => {
      expect(resolveBuildRef("b_one", builds)).toEqual({ buildId: "b_one", build: b1, missing: false });
      expect(resolveBuildRef(null, builds)).toEqual({ buildId: null, build: null, missing: false });
      expect(resolveBuildRef("", builds)).toEqual({ buildId: null, build: null, missing: false });
      expect(resolveBuildRef("b_gone", builds)).toEqual({ buildId: "b_gone", build: null, missing: true });
      expect(resolveBuildRef("b_one", null).missing).toBe(true);
    });
  });

  describe("validateSquadBuildAssignment", () => {
    const base = {
      storageAvailable: true,
      slotExists: true,
      slotWorldCardId: cardId,
      expectedWorldCardId: cardId,
      currentSavedBuildId: null as string | null,
      targetBuildId: "b_one" as string | null,
      storedBuild: b1 as SavedBuild | null,
    };

    it("設定: 正常 → ok・changed（現在値と違う）", () => {
      expect(validateSquadBuildAssignment(base)).toEqual({ ok: true, changed: true });
    });
    it("設定: 現在値と同じ → ok・changed=false", () => {
      expect(validateSquadBuildAssignment({ ...base, currentSavedBuildId: "b_one" })).toEqual({ ok: true, changed: false });
    });
    it("解除: targetBuildId null・現在値あり → ok・changed", () => {
      expect(validateSquadBuildAssignment({ ...base, targetBuildId: null, storedBuild: null, currentSavedBuildId: "b_one" })).toEqual({
        ok: true,
        changed: true,
      });
    });
    it("解除: 現在も未設定 → ok・changed=false", () => {
      expect(validateSquadBuildAssignment({ ...base, targetBuildId: null, storedBuild: null, currentSavedBuildId: null })).toEqual({
        ok: true,
        changed: false,
      });
    });
    it("localStorage 不可 → storage", () => {
      expect(validateSquadBuildAssignment({ ...base, storageAvailable: false })).toMatchObject({ ok: false, code: "storage" });
    });
    it("枠が存在しない（別タブで削除）→ slot-missing", () => {
      expect(validateSquadBuildAssignment({ ...base, slotExists: false })).toMatchObject({ ok: false, code: "slot-missing" });
    });
    it("枠のカードが入れ替わっている / 空 → card-mismatch（worldCardId 文字列完全一致・Number 変換しない）", () => {
      expect(validateSquadBuildAssignment({ ...base, slotWorldCardId: "88041460996837" })).toMatchObject({ ok: false, code: "card-mismatch" });
      expect(validateSquadBuildAssignment({ ...base, slotWorldCardId: null })).toMatchObject({ ok: false, code: "card-mismatch" });
      expect(validateSquadBuildAssignment({ ...base, expectedWorldCardId: "abc" as never, slotWorldCardId: "abc" as never })).toMatchObject({ ok: false, code: "card-mismatch" });
    });
    it("設定: 保存ビルドが削除済み / buildId 不一致 / worldCardId 不一致 → build-missing", () => {
      expect(validateSquadBuildAssignment({ ...base, storedBuild: null })).toMatchObject({ ok: false, code: "build-missing" });
      expect(validateSquadBuildAssignment({ ...base, storedBuild: mkBuild({ buildId: "b_x", worldCardId: cardId }) })).toMatchObject({ ok: false, code: "build-missing" });
      expect(validateSquadBuildAssignment({ ...base, storedBuild: mkBuild({ buildId: "b_one", worldCardId: "11111111111111" }) })).toMatchObject({ ok: false, code: "build-missing" });
    });
    it("設定: buildId 形式不正 → build-id", () => {
      expect(validateSquadBuildAssignment({ ...base, targetBuildId: "bad id!" })).toMatchObject({ ok: false, code: "build-id" });
    });
    it("大きな worldCardId（20桁）を許容", () => {
      const big = "12345678901234567890";
      const bb = mkBuild({ buildId: "b_one", worldCardId: big });
      expect(
        validateSquadBuildAssignment({ ...base, expectedWorldCardId: big, slotWorldCardId: big, storedBuild: bb }).ok,
      ).toBe(true);
    });
    it("解除時は storedBuild を要求しない（削除済み参照の明示解除）", () => {
      expect(
        validateSquadBuildAssignment({ ...base, targetBuildId: null, storedBuild: null, currentSavedBuildId: "b_deleted" }),
      ).toEqual({ ok: true, changed: true });
    });
  });
});

describe("スカッド ビルド使用状況サマリー 純関数", () => {
  const cardA = "89138556575063";
  const cardB = "88041460996837";
  const bV2 = mkBuild({ buildId: "b_v2", worldCardId: cardA, buildName: "現行", rulesVersion: PROGRESSION_RULES_VERSION });
  const bV1 = mkBuild({ buildId: "b_v1", worldCardId: cardB, buildName: "旧規則", rulesVersion: PROGRESSION_RULES_VERSION_V1 });
  const bPoM = mkBuild({
    buildId: "b_pom",
    worldCardId: cardA,
    buildName: "PoM",
    conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_14_19" }],
  });
  const bExp = mkBuild({ buildId: "b_exp", worldCardId: cardB, buildName: "試算", selectedPlayerBooster: 73 });
  const buildsByCard = { [cardA]: [bV2, bPoM], [cardB]: [bV1, bExp] };

  const rows = [
    { key: "gk", area: "starter" as const, slotLabel: "GK", worldCardId: cardA, playerName: "A選手", savedBuildId: "b_v2" },
    { key: "cf", area: "starter" as const, slotLabel: "CF", worldCardId: cardB, playerName: "B選手", savedBuildId: "b_v1" },
    { key: "lwf", area: "starter" as const, slotLabel: "LWF", worldCardId: cardA, playerName: "C選手", savedBuildId: null },
    { key: "sub_1", area: "bench" as const, slotLabel: "ベンチ 1", worldCardId: cardA, playerName: "D選手", savedBuildId: "b_gone" },
    { key: "sub_2", area: "bench" as const, slotLabel: "ベンチ 2", worldCardId: cardB, playerName: "E選手", savedBuildId: "b_exp" },
  ];

  it("件数集計（設定済み / 未設定 / 削除済み / 規則 / PoM / 実験）", () => {
    const s = summarizeSquadBuilds(rows, buildsByCard);
    expect(s.total).toBe(5);
    expect(s.starterCount).toBe(3);
    expect(s.benchCount).toBe(2);
    expect(s.setCount).toBe(3); // b_v2, b_v1, b_exp
    expect(s.unsetCount).toBe(1); // lwf
    expect(s.missingCount).toBe(1); // sub_1 → b_gone
    expect(s.currentRulesCount).toBe(2); // b_v2, b_exp（b_exp は現行 rulesVersion）
    expect(s.legacyRulesCount).toBe(1); // b_v1
    expect(s.unknownRulesCount).toBe(0);
    expect(s.pomCount).toBe(0); // 使用されているのは b_v2（PoM なし）
    expect(s.experimentalCount).toBe(1); // b_exp
  });

  it("削除済み参照は未設定へ変換しない（missing のまま・元 buildId 保持）", () => {
    const s = summarizeSquadBuilds(rows, buildsByCard);
    const sub1 = s.entries.find((e) => e.key === "sub_1")!;
    expect(sub1.status).toBe("missing");
    expect(sub1.savedBuildId).toBe("b_gone");
    expect(sub1.build).toBeNull();
    expect(sub1.ruleKind).toBeNull();
  });

  it("別 worldCardId のビルドを指す savedBuildId は missing 扱い（統合しない）", () => {
    const cross = [{ key: "x", area: "starter" as const, slotLabel: "X", worldCardId: cardA, playerName: "X", savedBuildId: "b_v1" }];
    // b_v1 は cardB のビルド → cardA の buildsByCard には無い
    expect(summarizeSquadBuilds(cross, buildsByCard).entries[0].status).toBe("missing");
  });

  it("PoM 指定のあるビルドが使われていれば pomCount に入る", () => {
    const r = [{ key: "gk", area: "starter" as const, slotLabel: "GK", worldCardId: cardA, playerName: "A", savedBuildId: "b_pom" }];
    expect(summarizeSquadBuilds(r, buildsByCard).pomCount).toBe(1);
  });

  it("空スカッド", () => {
    const s = summarizeSquadBuilds([], buildsByCard);
    expect(s).toMatchObject({ total: 0, setCount: 0, unsetCount: 0, missingCount: 0, entries: [] });
  });

  it("Map でも Record でも受け付ける", () => {
    const m = new Map<string, typeof bV2[]>([[cardA, [bV2]]]);
    const r = [{ key: "gk", area: "starter" as const, slotLabel: "GK", worldCardId: cardA, playerName: "A", savedBuildId: "b_v2" }];
    expect(summarizeSquadBuilds(r, m).setCount).toBe(1);
  });

  it("filterSquadBuildUsage: フィルターと検索（非破壊・正規表現評価なし）", () => {
    const s = summarizeSquadBuilds(rows, buildsByCard);
    expect(filterSquadBuildUsage(s.entries, "set", "").map((e) => e.key)).toEqual(["gk", "cf", "sub_2"]);
    expect(filterSquadBuildUsage(s.entries, "unset", "").map((e) => e.key)).toEqual(["lwf"]);
    expect(filterSquadBuildUsage(s.entries, "missing", "").map((e) => e.key)).toEqual(["sub_1"]);
    expect(filterSquadBuildUsage(s.entries, "starter", "").map((e) => e.key)).toEqual(["gk", "cf", "lwf"]);
    expect(filterSquadBuildUsage(s.entries, "bench", "").map((e) => e.key)).toEqual(["sub_1", "sub_2"]);
    expect(filterSquadBuildUsage(s.entries, "all", "B選手").map((e) => e.key)).toEqual(["cf"]);
    expect(filterSquadBuildUsage(s.entries, "all", "旧規則").map((e) => e.key)).toEqual(["cf"]);
    expect(filterSquadBuildUsage(s.entries, "all", ".*").map((e) => e.key)).toEqual([]);
    const before = s.entries.map((e) => e.key);
    filterSquadBuildUsage(s.entries, "set", "x");
    expect(s.entries.map((e) => e.key)).toEqual(before);
  });
});

// --- 既存 updateMyTeamRecord 経由の設定/解除（selectedBuildId 以外を失わないことの結合検証） ---

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
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return map;
}

describe("My Team 選択中ビルド設定（既存 updateMyTeamRecord 経由）", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  async function setup() {
    const team = await import("@/lib/user-cards/my-team-storage");
    team.__invalidateMyTeamSnapshotForTests();
    const a = team.addToMyTeam({ worldCardId: "89138556575063" });
    const b = team.addToMyTeam({ worldCardId: "88041460996837" });
    if (!a.ok || !b.ok) throw new Error("setup failed");
    // 選択中以外の情報を持たせる
    team.updateMyTeamRecord(a.record.teamCardId, {
      usageStatus: "main",
      tags: ["主力", "決勝用"],
      note: "大事なメモ",
      favoriteBuildId: "b_fav0000000",
    });
    team.__invalidateMyTeamSnapshotForTests();
    return { team, aTeamCardId: a.record.teamCardId, bTeamCardId: b.record.teamCardId };
  }

  it("selectedBuildId だけ設定され、favorite/tags/note/ownership/usage/addedAt/worldCardId は維持", async () => {
    const { team, aTeamCardId } = await setup();
    const before = team.getMyTeamRecord(aTeamCardId)!;
    const r = team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: "b_new0000001" });
    expect(r.ok).toBe(true);
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(aTeamCardId)!;
    expect(after.selectedBuildId).toBe("b_new0000001");
    expect(after.favoriteBuildId).toBe("b_fav0000000");
    expect(after.tags).toEqual(before.tags);
    expect(after.note).toBe(before.note);
    expect(after.ownershipStatus).toBe(before.ownershipStatus);
    expect(after.usageStatus).toBe(before.usageStatus);
    expect(after.addedAt).toBe(before.addedAt);
    expect(after.worldCardId).toBe(before.worldCardId);
    expect(after.teamCardId).toBe(before.teamCardId);
  });

  it("他の My Team レコードは変更されない", async () => {
    const { team, aTeamCardId, bTeamCardId } = await setup();
    const bBefore = team.getMyTeamRecord(bTeamCardId)!;
    team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: "b_new0000001" });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamRecord(bTeamCardId)).toEqual(bBefore);
  });

  it("選択解除（selectedBuildId: null）— favoriteBuildId と他フィールドは維持", async () => {
    const { team, aTeamCardId } = await setup();
    team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: "b_new0000001" });
    team.__invalidateMyTeamSnapshotForTests();
    team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: null });
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(aTeamCardId)!;
    expect(after.selectedBuildId).toBeNull();
    expect(after.favoriteBuildId).toBe("b_fav0000000");
    expect(after.tags).toEqual(["主力", "決勝用"]);
  });

  it("getMyTeamByWorldId で設定後の selectedBuildId を確認できる（worldCardId は文字列）", async () => {
    const { team, aTeamCardId } = await setup();
    team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: "b_new0000001" });
    team.__invalidateMyTeamSnapshotForTests();
    const rec = team.getMyTeamByWorldId("89138556575063");
    expect(rec?.selectedBuildId).toBe("b_new0000001");
  });

  it("不正な buildId は sanitize されて null になる（別カードへ漏れない）", async () => {
    const { team, aTeamCardId } = await setup();
    team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: "bad id!" });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamRecord(aTeamCardId)!.selectedBuildId).toBeNull();
  });
});

describe("My Team お気に入りビルド設定／解除（既存 updateMyTeamRecord 経由）", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  async function setup() {
    const team = await import("@/lib/user-cards/my-team-storage");
    team.__invalidateMyTeamSnapshotForTests();
    const a = team.addToMyTeam({ worldCardId: "89138556575063" });
    const b = team.addToMyTeam({ worldCardId: "88041460996837" });
    if (!a.ok || !b.ok) throw new Error("setup failed");
    team.updateMyTeamRecord(a.record.teamCardId, {
      usageStatus: "main",
      tags: ["主力"],
      note: "メモ",
      selectedBuildId: "b_sel0000001",
    });
    team.__invalidateMyTeamSnapshotForTests();
    return { team, aTeamCardId: a.record.teamCardId, bTeamCardId: b.record.teamCardId };
  }

  it("favoriteBuildId だけ設定され、selectedBuildId/tags/note/ownership/usage/addedAt/worldCardId は維持", async () => {
    const { team, aTeamCardId } = await setup();
    const before = team.getMyTeamRecord(aTeamCardId)!;
    const r = team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: "b_fav0000009" });
    expect(r.ok).toBe(true);
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(aTeamCardId)!;
    expect(after.favoriteBuildId).toBe("b_fav0000009");
    expect(after.selectedBuildId).toBe("b_sel0000001"); // 変更しない
    expect(after.tags).toEqual(before.tags);
    expect(after.note).toBe(before.note);
    expect(after.ownershipStatus).toBe(before.ownershipStatus);
    expect(after.usageStatus).toBe(before.usageStatus);
    expect(after.addedAt).toBe(before.addedAt);
    expect(after.worldCardId).toBe(before.worldCardId);
    expect(after.teamCardId).toBe(before.teamCardId);
  });

  it("他の My Team レコードは変更されない", async () => {
    const { team, aTeamCardId, bTeamCardId } = await setup();
    const bBefore = team.getMyTeamRecord(bTeamCardId)!;
    team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: "b_fav0000009" });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamRecord(bTeamCardId)).toEqual(bBefore);
  });

  it("お気に入り解除（favoriteBuildId: null）— selectedBuildId は維持", async () => {
    const { team, aTeamCardId } = await setup();
    team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: "b_fav0000009" });
    team.__invalidateMyTeamSnapshotForTests();
    team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: null });
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(aTeamCardId)!;
    expect(after.favoriteBuildId).toBeNull();
    expect(after.selectedBuildId).toBe("b_sel0000001");
    expect(after.tags).toEqual(["主力"]);
  });

  it("selectedBuildId と favoriteBuildId が同じビルドでも独立に解除できる", async () => {
    const { team, aTeamCardId } = await setup();
    team.updateMyTeamRecord(aTeamCardId, { selectedBuildId: "b_same0000001", favoriteBuildId: "b_same0000001" });
    team.__invalidateMyTeamSnapshotForTests();
    // お気に入りだけ解除 → selectedBuildId は残る
    team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: null });
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(aTeamCardId)!;
    expect(after.favoriteBuildId).toBeNull();
    expect(after.selectedBuildId).toBe("b_same0000001");
  });

  it("getMyTeamByWorldId で設定後の favoriteBuildId を確認できる", async () => {
    const { team, aTeamCardId } = await setup();
    team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: "b_fav0000009" });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamByWorldId("89138556575063")?.favoriteBuildId).toBe("b_fav0000009");
  });

  it("お気に入り設定はカードのお気に入り（favorites ストレージ）を変更しない", async () => {
    const { team, aTeamCardId } = await setup();
    const fav = await import("@/lib/user-cards/favorites-storage");
    const before = fav.getFavorites().map((f) => f.worldCardId);
    team.updateMyTeamRecord(aTeamCardId, { favoriteBuildId: "b_fav0000009" });
    team.__invalidateMyTeamSnapshotForTests();
    expect(fav.getFavorites().map((f) => f.worldCardId)).toEqual(before);
  });
});

describe("My Team 新規登録（既存 addToMyTeam 経由の結合）", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  const NEW_CARD = "89138556575063";
  const OTHER_CARD = "88041460996837";

  async function setup() {
    const team = await import("@/lib/user-cards/my-team-storage");
    team.__invalidateMyTeamSnapshotForTests();
    // 別カードを 1 件だけ先に登録（他レコード不変の検証用）
    const other = team.addToMyTeam({ worldCardId: OTHER_CARD, usageStatus: "main", tags: ["既存"] });
    if (!other.ok) throw new Error("setup failed");
    team.__invalidateMyTeamSnapshotForTests();
    return { team, otherTeamCardId: other.record.teamCardId };
  }

  /** UI ハンドラ相当（1 段階 + favorite 時のみ 2 段階目）。 */
  async function register(
    team: typeof import("@/lib/user-cards/my-team-storage"),
    buildId: string,
    opts: { ownershipStatus: "owned" | "wanted" | "released" | "unknown"; usageStatus: "main" | "rotation" | "reserve" | "unused" | "unknown"; setSelected: boolean; setFavorite: boolean },
  ) {
    const r = team.addToMyTeam({
      worldCardId: NEW_CARD,
      ownershipStatus: opts.ownershipStatus,
      usageStatus: opts.usageStatus,
      selectedBuildId: opts.setSelected ? buildId : null,
      note: "",
      tags: [],
    });
    if (!r.ok) return r;
    if (opts.setFavorite) team.updateMyTeamRecord(r.record.teamCardId, { favoriteBuildId: buildId });
    team.__invalidateMyTeamSnapshotForTests();
    return r;
  }

  it("selected ON / favorite OFF → selectedBuildId のみ設定・favoriteBuildId は null", async () => {
    const { team } = await setup();
    const r = await register(team, "b_new0000001", { ownershipStatus: "owned", usageStatus: "unknown", setSelected: true, setFavorite: false });
    expect(r.ok).toBe(true);
    const rec = team.getMyTeamByWorldId(NEW_CARD)!;
    expect(rec.worldCardId).toBe(NEW_CARD); // 文字列のまま
    expect(rec.selectedBuildId).toBe("b_new0000001");
    expect(rec.favoriteBuildId).toBeNull();
    expect(rec.ownershipStatus).toBe("owned");
    expect(rec.usageStatus).toBe("unknown");
    expect(rec.tags).toEqual([]);
    expect(rec.note).toBe("");
    expect(rec.teamCardId).toMatch(/^tc_/);
    expect(Number.isFinite(Date.parse(rec.addedAt))).toBe(true);
    expect(Number.isFinite(Date.parse(rec.updatedAt))).toBe(true);
  });

  it("selected OFF / favorite ON → favoriteBuildId のみ設定・selectedBuildId は null", async () => {
    const { team } = await setup();
    await register(team, "b_fav0000002", { ownershipStatus: "wanted", usageStatus: "reserve", setSelected: false, setFavorite: true });
    const rec = team.getMyTeamByWorldId(NEW_CARD)!;
    expect(rec.selectedBuildId).toBeNull();
    expect(rec.favoriteBuildId).toBe("b_fav0000002");
    expect(rec.ownershipStatus).toBe("wanted");
    expect(rec.usageStatus).toBe("reserve");
  });

  it("selected ON / favorite ON → 別々の 2 フィールドとして保存", async () => {
    const { team } = await setup();
    await register(team, "b_both0000003", { ownershipStatus: "owned", usageStatus: "main", setSelected: true, setFavorite: true });
    const rec = team.getMyTeamByWorldId(NEW_CARD)!;
    expect(rec.selectedBuildId).toBe("b_both0000003");
    expect(rec.favoriteBuildId).toBe("b_both0000003");
  });

  it("selected OFF / favorite OFF → どちらも null（登録自体は成功）", async () => {
    const { team } = await setup();
    const r = await register(team, "b_none0000004", { ownershipStatus: "unknown", usageStatus: "unknown", setSelected: false, setFavorite: false });
    expect(r.ok).toBe(true);
    const rec = team.getMyTeamByWorldId(NEW_CARD)!;
    expect(rec.selectedBuildId).toBeNull();
    expect(rec.favoriteBuildId).toBeNull();
  });

  it("重複登録は addToMyTeam が拒否（既存レコードを上書きしない）", async () => {
    const { team } = await setup();
    await register(team, "b_first0000005", { ownershipStatus: "owned", usageStatus: "unknown", setSelected: true, setFavorite: false });
    const before = team.getMyTeamByWorldId(NEW_CARD)!;
    const dup = team.addToMyTeam({ worldCardId: NEW_CARD, ownershipStatus: "released", usageStatus: "unused" });
    expect(dup.ok).toBe(false);
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamByWorldId(NEW_CARD)).toEqual(before);
  });

  it("他の My Team レコードは変更されない", async () => {
    const { team, otherTeamCardId } = await setup();
    const otherBefore = team.getMyTeamRecord(otherTeamCardId)!;
    await register(team, "b_x0000006", { ownershipStatus: "owned", usageStatus: "main", setSelected: true, setFavorite: true });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamRecord(otherTeamCardId)).toEqual(otherBefore);
  });

  it("登録はカード自体のお気に入り（favorites ストレージ）を変更しない", async () => {
    const { team } = await setup();
    const fav = await import("@/lib/user-cards/favorites-storage");
    const before = fav.getFavorites().map((f) => f.worldCardId);
    await register(team, "b_y0000007", { ownershipStatus: "owned", usageStatus: "unknown", setSelected: true, setFavorite: true });
    expect(fav.getFavorites().map((f) => f.worldCardId)).toEqual(before);
  });
});

describe("My Team ビルド選択パネル（既存 updateMyTeamRecord 経由の結合）", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  const CARD = "89138556575063";
  const OTHER = "88041460996837";

  async function setup() {
    const team = await import("@/lib/user-cards/my-team-storage");
    team.__invalidateMyTeamSnapshotForTests();
    const a = team.addToMyTeam({ worldCardId: CARD, ownershipStatus: "owned", usageStatus: "main", tags: ["主力"], note: "メモ" });
    const b = team.addToMyTeam({ worldCardId: OTHER });
    if (!a.ok || !b.ok) throw new Error("setup failed");
    team.__invalidateMyTeamSnapshotForTests();
    return { team, tc: a.record.teamCardId, otherTc: b.record.teamCardId };
  }

  it("選択中ビルドに設定 → selectedBuildId のみ・favoriteBuildId/所有/使用/タグ/メモ/addedAt 維持", async () => {
    const { team, tc } = await setup();
    const before = team.getMyTeamRecord(tc)!;
    team.updateMyTeamRecord(tc, { selectedBuildId: "b_panel00001" });
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(tc)!;
    expect(after.selectedBuildId).toBe("b_panel00001");
    expect(after.favoriteBuildId).toBeNull();
    expect(after.ownershipStatus).toBe("owned");
    expect(after.usageStatus).toBe("main");
    expect(after.tags).toEqual(before.tags);
    expect(after.note).toBe(before.note);
    expect(after.addedAt).toBe(before.addedAt);
    expect(after.worldCardId).toBe(CARD);
  });

  it("お気に入りビルドに設定 → favoriteBuildId のみ・selectedBuildId 維持", async () => {
    const { team, tc } = await setup();
    team.updateMyTeamRecord(tc, { selectedBuildId: "b_panel00001" });
    team.__invalidateMyTeamSnapshotForTests();
    team.updateMyTeamRecord(tc, { favoriteBuildId: "b_panel00002" });
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(tc)!;
    expect(after.favoriteBuildId).toBe("b_panel00002");
    expect(after.selectedBuildId).toBe("b_panel00001");
  });

  it("削除済み参照の解除: selectedBuildId が存在しない buildId を指していても null 化できる", async () => {
    const { team, tc } = await setup();
    team.updateMyTeamRecord(tc, { selectedBuildId: "b_deleted0001" });
    team.__invalidateMyTeamSnapshotForTests();
    const rec = team.getMyTeamRecord(tc);
    const v = validateMyTeamBuildRefClear({
      record: rec,
      teamCardId: tc,
      field: "selectedBuildId",
      currentBuildId: "b_deleted0001",
      storageAvailable: true,
    });
    expect(v.ok).toBe(true);
    team.updateMyTeamRecord(tc, { selectedBuildId: null });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamRecord(tc)!.selectedBuildId).toBeNull();
    expect(team.getMyTeamRecord(tc)!.favoriteBuildId).toBeNull();
  });

  it("selected == favorite でも独立に解除（favorite 解除で selected 維持）", async () => {
    const { team, tc } = await setup();
    team.updateMyTeamRecord(tc, { selectedBuildId: "b_same00001", favoriteBuildId: "b_same00001" });
    team.__invalidateMyTeamSnapshotForTests();
    team.updateMyTeamRecord(tc, { favoriteBuildId: null });
    team.__invalidateMyTeamSnapshotForTests();
    const after = team.getMyTeamRecord(tc)!;
    expect(after.favoriteBuildId).toBeNull();
    expect(after.selectedBuildId).toBe("b_same00001");
  });

  it("他の My Team レコード・カードお気に入り（favorites ストレージ）は不変", async () => {
    const { team, tc, otherTc } = await setup();
    const otherBefore = team.getMyTeamRecord(otherTc)!;
    const fav = await import("@/lib/user-cards/favorites-storage");
    const favBefore = fav.getFavorites().map((f) => f.worldCardId);
    team.updateMyTeamRecord(tc, { selectedBuildId: "b_panel00001", favoriteBuildId: "b_panel00002" });
    team.__invalidateMyTeamSnapshotForTests();
    expect(team.getMyTeamRecord(otherTc)).toEqual(otherBefore);
    expect(fav.getFavorites().map((f) => f.worldCardId)).toEqual(favBefore);
  });
});
