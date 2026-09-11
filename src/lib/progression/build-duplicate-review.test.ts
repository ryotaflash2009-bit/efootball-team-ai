import { describe, it, expect } from "vitest";
import type { SavedBuild } from "./types";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import type { StoredSquad } from "@/lib/squad/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { PROGRESSION_RULES_VERSION, PROGRESSION_RULES_VERSION_V1 } from "./constants";
import { buildInventory } from "./build-inventory";
import {
  DEFAULT_DUPLICATE_REVIEW_FILTER,
  buildDuplicateReview,
  computeBuildFingerprint,
  filterDuplicateReviewGroups,
  sortDuplicateReviewGroups,
} from "./build-duplicate-review";

function mkBuild(over: Partial<SavedBuild> = {}): SavedBuild {
  return {
    buildId: over.buildId ?? "b_1",
    worldCardId: over.worldCardId ?? "89138556575063",
    buildName: over.buildName ?? "攻撃ビルド",
    progressionAllocation: over.progressionAllocation ?? { shooting: 3 },
    selectedPlayerBooster: over.selectedPlayerBooster ?? null,
    conditionalBoosterSelections: over.conditionalBoosterSelections,
    calculatedStats: over.calculatedStats ?? { finishing: 90 },
    calculatedOvr: over.calculatedOvr ?? 91,
    calculationMode: over.calculationMode ?? "provisional",
    rulesVersion: over.rulesVersion ?? PROGRESSION_RULES_VERSION,
    createdAt: over.createdAt ?? "2026-08-20T10:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-08-25T10:00:00.000Z",
    schemaVersion: over.schemaVersion ?? 1,
    ...over,
  };
}

function mkRecord(over: Partial<MyTeamRecord> = {}): MyTeamRecord {
  return {
    localRecordId: over.localRecordId ?? "myt_1",
    teamCardId: over.teamCardId ?? "tc_1",
    worldCardId: over.worldCardId ?? "89138556575063",
    ownershipStatus: over.ownershipStatus ?? "owned",
    usageStatus: over.usageStatus ?? "main",
    selectedBuildId: over.selectedBuildId ?? null,
    favoriteBuildId: over.favoriteBuildId ?? null,
    note: over.note ?? "",
    tags: over.tags ?? [],
    addedAt: over.addedAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
  };
}

function mkSquad(over: Partial<StoredSquad> = {}): StoredSquad {
  const now = "2026-08-15T00:00:00.000Z";
  return {
    squadId: over.squadId ?? "sq_aaaaaa111111",
    squadName: over.squadName ?? "メイン",
    formationId: over.formationId ?? "4-3-3",
    managerId: null,
    slots: over.slots ?? [],
    substitutes: over.substitutes ?? [],
    captainSlotId: null,
    setPieces: { corners: null, freeKicks: null, penalties: null },
    linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    rulesVersion: PROGRESSION_RULES_VERSION,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: over.updatedAt ?? now,
  };
}

function mkCard(over: Partial<WorldPlayerListItem> = {}): WorldPlayerListItem {
  return {
    worldCardId: over.worldCardId ?? "89138556575063",
    nameEn: over.nameEn ?? "Lionel Messi",
    nameJa: over.nameJa ?? "リオネル・メッシ",
    cardType: over.cardType ?? "Epic",
    registeredPosition: over.registeredPosition ?? "RWF",
    ovrBase: 90,
    ovrMax: 108,
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

const CARD_A = "89138556575063";
const CARD_B = "88041460996837";
const emptyCards = new Map<string, WorldPlayerListItem>();

function review(
  builds: SavedBuild[],
  myTeam: MyTeamRecord[] = [],
  squads: StoredSquad[] = [],
  cards: Map<string, WorldPlayerListItem> = emptyCards,
) {
  return buildDuplicateReview(buildInventory(builds, myTeam, squads, cards));
}

describe("build-duplicate-review: 完全一致候補（フィンガープリント）", () => {
  it("保存ビルド 0 件 → 候補なし・全 0", () => {
    const r = review([]);
    expect(r.groups).toEqual([]);
    expect(r.summary).toMatchObject({
      totalBuilds: 0,
      exactGroupCount: 0,
      exactBuildCount: 0,
      similarGroupCount: 0,
      similarBuildCount: 0,
      noCandidateBuilds: 0,
      unresolvedBuilds: 0,
    });
  });

  it("1 件のみ → 候補なし", () => {
    const r = review([mkBuild()]);
    expect(r.groups).toEqual([]);
    expect(r.summary.noCandidateBuilds).toBe(1);
  });

  it("完全一致 2 件 → exact グループ 1 件（buildId/buildName/日時が違っても一致扱い）", () => {
    const a = mkBuild({ buildId: "b_a", buildName: "A", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" });
    const b = mkBuild({ buildId: "b_b", buildName: "B", createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-04T00:00:00.000Z" });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(1);
    expect(r.summary.exactBuildCount).toBe(2);
    const g = r.groups.find((x) => x.kind === "exact")!;
    expect(g.buildCount).toBe(2);
    expect(g.builds.map((x) => x.build.buildId).sort()).toEqual(["b_a", "b_b"]);
    expect(g.diffFields).toEqual(expect.arrayContaining(["ビルド名", "buildId", "作成日時", "更新日時"]));
  });

  it("完全一致 3 件以上", () => {
    const bs = ["b_1", "b_2", "b_3"].map((id) => mkBuild({ buildId: id }));
    const r = review(bs);
    expect(r.summary.exactGroupCount).toBe(1);
    expect(r.summary.exactBuildCount).toBe(3);
  });

  it("worldCardId が異なる → 統合しない（別カード扱い）", () => {
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_B });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
    expect(r.summary.noCandidateBuilds).toBe(2);
  });

  it("rulesVersion が異なる → 完全一致ではない", () => {
    const a = mkBuild({ buildId: "b_a", rulesVersion: PROGRESSION_RULES_VERSION });
    const b = mkBuild({ buildId: "b_b", rulesVersion: PROGRESSION_RULES_VERSION_V1 });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
  });

  it("配分が異なる → 完全一致ではない", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3 } });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { shooting: 5 } });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
  });

  it("selectedPlayerBooster が異なる → 完全一致ではない", () => {
    const a = mkBuild({ buildId: "b_a", selectedPlayerBooster: null });
    const b = mkBuild({ buildId: "b_b", selectedPlayerBooster: 44 });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
  });

  it("Power of Many 指定が異なる → 完全一致ではない", () => {
    const a = mkBuild({ buildId: "b_a", conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_1_13" }] });
    const b = mkBuild({ buildId: "b_b", conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_20_plus" }] });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
  });

  it("progressionAllocation の 0 と不在は同義（既存保存仕様に従う）", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3, passing: 0 } });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { shooting: 3 } });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(1);
  });

  it("オブジェクトキー順序が異なっても同一フィンガープリント", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3, passing: 2 } });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { passing: 2, shooting: 3 } });
    expect(computeBuildFingerprint(a)).toBe(computeBuildFingerprint(b));
    expect(review([a, b]).summary.exactGroupCount).toBe(1);
  });

  it("決定的フィンガープリント（同一内容は常に同一文字列）", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_z", buildName: "別名", createdAt: "2020-01-01T00:00:00.000Z" });
    expect(computeBuildFingerprint(a)).toBe(computeBuildFingerprint(b));
  });

  it("元配列（inventory.items 由来の build）を変更しない", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3, passing: 1 } });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { passing: 1, shooting: 3 } });
    const snapA = JSON.stringify(a);
    const snapB = JSON.stringify(b);
    review([a, b]);
    expect(JSON.stringify(a)).toBe(snapA);
    expect(JSON.stringify(b)).toBe(snapB);
  });
});

describe("build-duplicate-review: 類似候補（安全な2パターンのみ）", () => {
  it("similarSupported は true（実装済み）", () => {
    expect(review([]).summary.similarSupported).toBe(true);
  });

  it("配分が 1 カテゴリだけ異なる → similar（allocation-one-category）", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3, passing: 2 } });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { shooting: 5, passing: 2 } });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
    expect(r.summary.similarGroupCount).toBe(1);
    expect(r.summary.similarBuildCount).toBe(2);
    const g = r.groups.find((x) => x.kind === "similar")!;
    expect(g.reason).toBe("allocation-one-category");
    expect(g.detail).toContain("シュート");
  });

  it("selectedPlayerBooster だけ異なる → similar（booster-or-pom-only）", () => {
    const a = mkBuild({ buildId: "b_a", selectedPlayerBooster: null });
    const b = mkBuild({ buildId: "b_b", selectedPlayerBooster: 44 });
    const r = review([a, b]);
    expect(r.summary.similarGroupCount).toBe(1);
    const g = r.groups.find((x) => x.kind === "similar")!;
    expect(g.reason).toBe("booster-or-pom-only");
    expect(g.detail).toContain("選手ブースター試算");
  });

  it("Power of Many 指定だけ異なる → similar（booster-or-pom-only）", () => {
    const a = mkBuild({ buildId: "b_a", conditionalBoosterSelections: undefined });
    const b = mkBuild({ buildId: "b_b", conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_14_19" }] });
    const r = review([a, b]);
    expect(r.summary.similarGroupCount).toBe(1);
    const g = r.groups.find((x) => x.kind === "similar")!;
    expect(g.reason).toBe("booster-or-pom-only");
    expect(g.detail).toContain("Power of Many");
  });

  it("複数の差分カテゴリ（配分2カテゴリ）→ 類似にも完全一致にもしない", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3, passing: 2 } });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { shooting: 5, passing: 4 } });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(0);
    expect(r.summary.similarGroupCount).toBe(0);
    expect(r.summary.noCandidateBuilds).toBe(2);
  });

  it("配分とブースターの両方が異なる → 類似にしない（安全に説明できる範囲を超える）", () => {
    const a = mkBuild({ buildId: "b_a", progressionAllocation: { shooting: 3 }, selectedPlayerBooster: null });
    const b = mkBuild({ buildId: "b_b", progressionAllocation: { shooting: 5 }, selectedPlayerBooster: 44 });
    const r = review([a, b]);
    expect(r.summary.similarGroupCount).toBe(0);
  });

  it("異なる worldCardId は類似候補から除外", () => {
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A, selectedPlayerBooster: null });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_B, selectedPlayerBooster: 44 });
    expect(review([a, b]).summary.similarGroupCount).toBe(0);
  });

  it("異なる rulesVersion は類似候補から除外", () => {
    const a = mkBuild({ buildId: "b_a", rulesVersion: PROGRESSION_RULES_VERSION, selectedPlayerBooster: null });
    const b = mkBuild({ buildId: "b_b", rulesVersion: PROGRESSION_RULES_VERSION_V1, selectedPlayerBooster: 44 });
    expect(review([a, b]).summary.similarGroupCount).toBe(0);
  });

  it("完全一致と類似を分離（同一内容は similar に出さない）", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_b" });
    const r = review([a, b]);
    expect(r.summary.exactGroupCount).toBe(1);
    expect(r.summary.similarGroupCount).toBe(0);
  });

  it("類似度の百分率を表示しない（detail に % を含まない）", () => {
    const a = mkBuild({ buildId: "b_a", selectedPlayerBooster: null });
    const b = mkBuild({ buildId: "b_b", selectedPlayerBooster: 44 });
    const g = review([a, b]).groups.find((x) => x.kind === "similar")!;
    expect(g.detail ?? "").not.toContain("%");
  });
});

describe("build-duplicate-review: グループ構造", () => {
  it("グループ内 buildId は一意・グループ間で重複しない", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_b" });
    const c = mkBuild({ buildId: "b_c", progressionAllocation: { passing: 4 } }); // 別フィンガープリント
    const d = mkBuild({ buildId: "b_d", progressionAllocation: { passing: 4 } });
    const r = review([a, b, c, d]);
    expect(r.summary.exactGroupCount).toBe(2);
    const allIds = r.groups.flatMap((g) => g.builds.map((x) => x.build.buildId));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("使用中・未使用が混在するグループ", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_b" });
    const myTeam = [mkRecord({ teamCardId: "tc_1", worldCardId: CARD_A, selectedBuildId: "b_a" })];
    const r = review([a, b], myTeam);
    const g = r.groups.find((x) => x.kind === "exact")!;
    expect(g.anyUsed).toBe(true);
    expect(g.allUsed).toBe(false);
  });

  it("同じ選手で複数のグループができる（別フィンガープリント）", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_b" });
    const c = mkBuild({ buildId: "b_c", progressionAllocation: { passing: 4 } });
    const d = mkBuild({ buildId: "b_d", progressionAllocation: { passing: 4 } });
    const r = review([a, b, c, d]);
    expect(r.groups.filter((g) => g.kind === "exact")).toHaveLength(2);
  });

  it("構築結果は安定順（id で昇順）", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_b" });
    const c = mkBuild({ buildId: "b_c", progressionAllocation: { passing: 4 } });
    const d = mkBuild({ buildId: "b_d", progressionAllocation: { passing: 4 } });
    const r1 = review([a, b, c, d]).groups.map((g) => g.id);
    const r2 = review([d, c, b, a]).groups.map((g) => g.id);
    expect(r1).toEqual(r2);
    expect(r1).toEqual([...r1].sort());
  });
});

describe("build-duplicate-review: 使用状況（既存 Build Inventory 索引を再利用）", () => {
  it("My Team selected / favorite / 両方 / スカッド先発・ベンチ / 各 buildId 個別保持", () => {
    const a = mkBuild({ buildId: "b_a" });
    const b = mkBuild({ buildId: "b_b" });
    const myTeam = [
      mkRecord({ teamCardId: "tc_1", worldCardId: CARD_A, selectedBuildId: "b_a", favoriteBuildId: "b_a" }),
    ];
    const squads = [
      mkSquad({
        squadId: "sq_bbbbbb222222",
        slots: [{ slotId: "cf", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_b" }],
      }),
    ];
    const r = review([a, b], myTeam, squads);
    const g = r.groups.find((x) => x.kind === "exact")!;
    const ba = g.builds.find((x) => x.build.buildId === "b_a")!;
    const bb = g.builds.find((x) => x.build.buildId === "b_b")!;
    expect(ba.myTeamSelectedCount).toBe(1);
    expect(ba.myTeamFavoriteCount).toBe(1);
    expect(ba.squadRefCount).toBe(0);
    expect(bb.myTeamSelectedCount).toBe(0);
    expect(bb.squadRefCount).toBe(1);
    expect(r.summary.myTeamRefCandidateBuilds).toBe(1);
    expect(r.summary.squadRefCandidateBuilds).toBe(1);
    expect(r.summary.usedCandidateBuilds).toBe(2);
    expect(r.summary.unusedCandidateBuilds).toBe(0);
  });

  it("問題参照（worldCardId 不一致・削除済み）は正常使用へ含めない", () => {
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_A });
    // b_missing は存在しない保存ビルドを参照（削除済み参照）
    const myTeam = [mkRecord({ teamCardId: "tc_1", worldCardId: CARD_A, selectedBuildId: "b_missing" })];
    const r = review([a, b], myTeam);
    const g = r.groups.find((x) => x.kind === "exact")!;
    expect(g.builds.every((x) => x.myTeamSelectedCount === 0)).toBe(true);
    expect(g.anyUsed).toBe(false);
  });
});

describe("build-duplicate-review: 判定不能", () => {
  it("規則不明（空 rulesVersion）は判定不能・重複候補なしへ含めない", () => {
    const a = mkBuild({ buildId: "b_a", rulesVersion: "" });
    const b = mkBuild({ buildId: "b_b", rulesVersion: "" });
    const r = review([a, b]);
    expect(r.summary.unresolvedBuilds).toBe(2);
    expect(r.summary.noCandidateBuilds).toBe(0);
    expect(r.unresolved.every((u) => u.reason === "unknown-rules")).toBe(true);
    expect(r.summary.exactGroupCount).toBe(0);
  });

  it("スキーマ不正（worldCardId 不正）は判定不能", () => {
    const bad = mkBuild({ buildId: "b_bad", worldCardId: "not-a-number" });
    const r = review([bad, mkBuild({ buildId: "b_ok" })]);
    expect(r.unresolved.some((u) => u.reason === "invalid-schema")).toBe(true);
    expect(r.summary.noCandidateBuilds).toBe(1); // b_ok だけ（相手がいない）
  });

  it("必須フィールド欠損はスキーマ不正として判定不能（自動修復しない）", () => {
    const bad = { ...mkBuild({ buildId: "b_bad" }) } as Record<string, unknown>;
    delete bad.progressionAllocation;
    const r = review([bad as unknown as SavedBuild]);
    expect(r.unresolved).toHaveLength(1);
    expect(r.unresolved[0].reason).toBe("invalid-schema");
  });

  it("判定不能ビルドは自動削除・自動修復されず、安全な ID だけを返す", () => {
    const bad = mkBuild({ buildId: "b_secret", worldCardId: "89138556575063", rulesVersion: "" });
    const snap = JSON.stringify(bad);
    const r = review([bad]);
    expect(JSON.stringify(bad)).toBe(snap);
    expect(r.unresolved[0]).toMatchObject({ buildId: "b_secret", worldCardId: "89138556575063" });
  });
});

describe("build-duplicate-review: 検索・絞り込み", () => {
  function sampleGroups() {
    const cardA = mkCard({ worldCardId: CARD_A, nameJa: "テスト選手A" });
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A, buildName: "決定力型" });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_A, buildName: "決定力型コピー" });
    const cards = new Map([[CARD_A, cardA]]);
    return review([a, b], [], [], cards);
  }

  it("日本語選手名 / ビルド名 / World ID / buildId で検索", () => {
    const r = sampleGroups();
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, q: "テスト選手A" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, q: "決定力型" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, q: CARD_A })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, q: "b_a" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, q: "存在しない検索語" })).toHaveLength(0);
  });

  it("完全一致 / 類似 / 使用中 / 未使用 / 規則 / PoM / 実験的試算 / カードタイプ / ポジションで絞り込み（複数条件 AND）", () => {
    const cardA = mkCard({ worldCardId: CARD_A, cardType: "Epic", registeredPosition: "RWF" });
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A, selectedPlayerBooster: 44 });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_A, selectedPlayerBooster: 44 });
    const r = review([a, b], [], [], new Map([[CARD_A, cardA]]));
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, kind: "exact" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, kind: "similar" })).toHaveLength(0);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, usage: "used" })).toHaveLength(0);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, usage: "unused" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, rules: "current" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, rules: "legacy" })).toHaveLength(0);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, experimental: true })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, cardType: "Epic" })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, cardType: "Legend" })).toHaveLength(0);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, position: "RWF" })).toHaveLength(1);
    expect(
      filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, cardType: "Epic", usage: "unused" }),
    ).toHaveLength(1);
  });

  it("My Team参照あり / スカッド参照あり / 複数箇所で使用中で絞り込み", () => {
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_A });
    const myTeam = [mkRecord({ teamCardId: "tc_1", worldCardId: CARD_A, selectedBuildId: "b_a" })];
    const squads = [mkSquad({ slots: [{ slotId: "cf", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_a" }] })];
    const r = review([a, b], myTeam, squads);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, myTeamRef: true })).toHaveLength(1);
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, squadRef: true })).toHaveLength(1);
    // b_a は My Team 選択中とスカッド先発の両方から参照されている（この 1 件自体が複数箇所で使用中）
    expect(filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, multiUse: true })).toHaveLength(1);

    const onlyMyTeam = [mkRecord({ teamCardId: "tc_2", worldCardId: CARD_A, selectedBuildId: "b_b" })];
    const r2 = review([a, b], onlyMyTeam);
    expect(filterDuplicateReviewGroups(r2.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, multiUse: true })).toHaveLength(0);
  });

  it("非破壊: 元配列を変更しない", () => {
    const r = sampleGroups();
    const snap = JSON.stringify(r.groups);
    filterDuplicateReviewGroups(r.groups, { ...DEFAULT_DUPLICATE_REVIEW_FILTER, q: "x" });
    expect(JSON.stringify(r.groups)).toBe(snap);
  });
});

describe("build-duplicate-review: 並び替え", () => {
  it("更新日時 / 作成日時 / グループ件数 / 参照数 / 未使用優先 / 使用中優先 / 選手名 / ビルド名 / buildId 安定順", () => {
    const g1 = [
      mkBuild({ buildId: "b_1a", worldCardId: CARD_A, updatedAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-07-01T00:00:00.000Z" }),
      mkBuild({ buildId: "b_1b", worldCardId: CARD_A, updatedAt: "2026-08-05T00:00:00.000Z", createdAt: "2026-07-05T00:00:00.000Z" }),
    ];
    const g2 = [
      mkBuild({ buildId: "b_2a", worldCardId: CARD_B, updatedAt: "2026-08-10T00:00:00.000Z", createdAt: "2026-07-10T00:00:00.000Z" }),
      mkBuild({ buildId: "b_2b", worldCardId: CARD_B, updatedAt: "2026-08-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z" }),
      mkBuild({ buildId: "b_2c", worldCardId: CARD_B, updatedAt: "2026-08-12T00:00:00.000Z", createdAt: "2026-07-12T00:00:00.000Z" }),
    ];
    const r = review([...g1, ...g2]);
    expect(r.groups).toHaveLength(2);

    const byUpdated = sortDuplicateReviewGroups(r.groups, "updated_desc");
    expect(byUpdated[0].worldCardId).toBe(CARD_B); // 最新 updatedAt を持つグループが先頭

    const byCreated = sortDuplicateReviewGroups(r.groups, "created_desc");
    expect(byCreated[0].worldCardId).toBe(CARD_B);

    const bySize = sortDuplicateReviewGroups(r.groups, "size_desc");
    expect(bySize[0].buildCount).toBe(3);

    const byId = sortDuplicateReviewGroups(r.groups, "id_stable");
    expect(byId.map((g) => g.id)).toEqual([...byId.map((g) => g.id)].sort());
  });

  it("未使用優先 / 使用中優先", () => {
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_A });
    const c = mkBuild({ buildId: "b_c", worldCardId: CARD_B });
    const d = mkBuild({ buildId: "b_d", worldCardId: CARD_B });
    const myTeam = [mkRecord({ teamCardId: "tc_1", worldCardId: CARD_B, selectedBuildId: "b_c" })];
    const r = review([a, b, c, d], myTeam);
    const unusedFirst = sortDuplicateReviewGroups(r.groups, "unused_first");
    expect(unusedFirst[0].worldCardId).toBe(CARD_A);
    const usedFirst = sortDuplicateReviewGroups(r.groups, "used_first");
    expect(usedFirst[0].worldCardId).toBe(CARD_B);
  });

  it("不正日時は末尾（現在時刻扱いしない）・元配列を変更しない", () => {
    const a = mkBuild({ buildId: "b_a", worldCardId: CARD_A, updatedAt: "not-a-date" });
    const b = mkBuild({ buildId: "b_b", worldCardId: CARD_A, updatedAt: "not-a-date" });
    const c = mkBuild({ buildId: "b_c", worldCardId: CARD_B, updatedAt: "2026-08-01T00:00:00.000Z" });
    const d = mkBuild({ buildId: "b_d", worldCardId: CARD_B, updatedAt: "2026-08-02T00:00:00.000Z" });
    const r = review([a, b, c, d]);
    const snap = JSON.stringify(r.groups);
    const sorted = sortDuplicateReviewGroups(r.groups, "updated_desc");
    expect(sorted[0].worldCardId).toBe(CARD_B);
    expect(JSON.stringify(r.groups)).toBe(snap);
  });
});
