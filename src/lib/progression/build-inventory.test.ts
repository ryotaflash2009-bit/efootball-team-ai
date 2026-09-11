import { describe, it, expect } from "vitest";
import type { SavedBuild } from "./types";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import type { StoredSquad } from "@/lib/squad/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { PROGRESSION_RULES_VERSION, PROGRESSION_RULES_VERSION_V1 } from "./constants";
import {
  DEFAULT_BUILD_INVENTORY_FILTER,
  buildInventory,
  classifyBuildReference,
  collectBuildReferences,
  filterBuildInventory,
  filterBuildInventoryIssues,
  legacyOnlyFilter,
  resolveAnalyzingBuildId,
  sortBuildInventory,
  summarizeLegacyBuilds,
  type BuildInventoryFilter,
} from "./build-inventory";

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

/** 4-3-3 の実在 slotId を使った最小スカッド。 */
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

describe("collectBuildReferences", () => {
  it("null / 未設定は含めない・My Team とスカッドの両方を集める", () => {
    const myTeam = [
      mkRecord({ teamCardId: "tc_a", worldCardId: CARD_A, selectedBuildId: "b_a", favoriteBuildId: null }),
      mkRecord({ teamCardId: "tc_b", worldCardId: CARD_B, selectedBuildId: null, favoriteBuildId: "b_b" }),
    ];
    const squads = [
      mkSquad({
        slots: [{ slotId: "cf", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_a" }],
        substitutes: [{ subId: "sub_1", worldCardId: CARD_B, buildMode: "none", savedBuildId: "b_b" }],
      }),
    ];
    const refs = collectBuildReferences(myTeam, squads);
    expect(refs.map((r) => r.source.kind).sort()).toEqual(
      ["my-team-favorite", "my-team-selected", "squad-bench", "squad-starter"].sort(),
    );
    expect(refs.filter((r) => r.buildId === "b_a")).toHaveLength(2);
  });

  it("worldCardId なしの枠 / savedBuildId なしの枠は無視", () => {
    const squads = [
      mkSquad({
        slots: [
          { slotId: "cf", worldCardId: null, buildMode: "none", savedBuildId: "b_x" },
          { slotId: "gk", worldCardId: CARD_A, buildMode: "none", savedBuildId: null },
        ],
      }),
    ];
    expect(collectBuildReferences([], squads)).toEqual([]);
  });
});

describe("classifyBuildReference", () => {
  const b = mkBuild({ buildId: "b_a", worldCardId: CARD_A });
  const byId = new Map([["b_a", b]]);

  it("正常参照", () => {
    const r = classifyBuildReference(
      { buildId: "b_a", refWorldCardId: CARD_A, source: { kind: "my-team-selected", teamCardId: "tc", worldCardId: CARD_A } },
      byId,
    );
    expect(r.status).toBe("ok");
    expect(r.build).toBe(b);
  });
  it("削除済み参照（build なし）", () => {
    const r = classifyBuildReference(
      { buildId: "b_gone", refWorldCardId: CARD_A, source: { kind: "my-team-favorite", teamCardId: "tc", worldCardId: CARD_A } },
      byId,
    );
    expect(r.status).toBe("missing");
    expect(r.build).toBeNull();
  });
  it("worldCardId 不一致（build は存在するが別カード）", () => {
    const r = classifyBuildReference(
      { buildId: "b_a", refWorldCardId: CARD_B, source: { kind: "my-team-selected", teamCardId: "tc", worldCardId: CARD_B } },
      byId,
    );
    expect(r.status).toBe("world-card-mismatch");
    expect(r.build).toBeNull();
  });
  it("不正 buildId（形式違反）", () => {
    const r = classifyBuildReference(
      { buildId: "bad id!", refWorldCardId: CARD_A, source: { kind: "my-team-selected", teamCardId: "tc", worldCardId: CARD_A } },
      byId,
    );
    expect(r.status).toBe("invalid-build-id");
  });
  it("参照元 worldCardId が不正 → unknown（Number 変換しない）", () => {
    const r = classifyBuildReference(
      { buildId: "b_a", refWorldCardId: "abc", source: { kind: "my-team-selected", teamCardId: "tc", worldCardId: "abc" } },
      byId,
    );
    expect(r.status).toBe("unknown");
  });
  it("20 桁 worldCardId を許容", () => {
    const big = "12345678901234567890";
    const bb = mkBuild({ buildId: "b_big", worldCardId: big });
    const r = classifyBuildReference(
      { buildId: "b_big", refWorldCardId: big, source: { kind: "my-team-selected", teamCardId: "tc", worldCardId: big } },
      new Map([["b_big", bb]]),
    );
    expect(r.status).toBe("ok");
  });
});

describe("buildInventory: 使用中・未使用・参照集計", () => {
  const bUsed = mkBuild({ buildId: "b_used", worldCardId: CARD_A, buildName: "使用中", updatedAt: "2026-08-30T00:00:00.000Z" });
  const bUnused = mkBuild({ buildId: "b_unused", worldCardId: CARD_A, buildName: "未使用", updatedAt: "2026-08-10T00:00:00.000Z" });
  const bLegacy = mkBuild({ buildId: "b_legacy", worldCardId: CARD_A, buildName: "旧規則", rulesVersion: PROGRESSION_RULES_VERSION_V1 });
  const bMulti = mkBuild({ buildId: "b_multi", worldCardId: CARD_B, buildName: "複数箇所" });

  const myTeam = [
    mkRecord({ teamCardId: "tc_a", worldCardId: CARD_A, selectedBuildId: "b_used", favoriteBuildId: "b_used" }),
    mkRecord({ teamCardId: "tc_b", worldCardId: CARD_B, selectedBuildId: "b_multi", favoriteBuildId: null }),
  ];
  const squads = [
    mkSquad({
      squadId: "sq_one000000001",
      squadName: "メイン",
      slots: [
        { slotId: "cf", worldCardId: CARD_B, buildMode: "none", savedBuildId: "b_multi" },
        { slotId: "lwf", worldCardId: CARD_B, buildMode: "none", savedBuildId: "b_multi" },
      ],
      substitutes: [{ subId: "sub_1", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_legacy" }],
    }),
  ];

  it("使用中 / 未使用 / 複数箇所", () => {
    const inv = buildInventory([bUsed, bUnused, bLegacy, bMulti], myTeam, squads, emptyCards);
    const s = inv.summary;
    expect(s.totalBuilds).toBe(4);
    expect(s.usedBuilds).toBe(3); // b_used, b_multi, b_legacy（ベンチ b_legacy は worldCardId 一致 CARD_A）
    expect(s.unusedBuilds).toBe(1); // b_unused
    expect(s.multiUseBuilds).toBe(2); // b_used(2), b_multi(3)
    const used = inv.items.find((i) => i.build.buildId === "b_used")!;
    expect(used.refCount).toBe(2);
    expect(used.myTeamSelectedCount).toBe(1);
    expect(used.myTeamFavoriteCount).toBe(1);
    const multi = inv.items.find((i) => i.build.buildId === "b_multi")!;
    expect(multi.refCount).toBe(3); // selected + 先発2枠
    expect(multi.squadRefCount).toBe(2);
    expect(multi.squads).toHaveLength(1);
    expect(multi.squads[0]).toMatchObject({ squadId: "sq_one000000001", starterSlots: 2, benchSlots: 0 });
  });

  it("selected == favorite が同じ buildId でも参照は別々に 2 件", () => {
    const inv = buildInventory([bUsed], myTeam, [], emptyCards);
    const it = inv.items[0];
    expect(it.refCount).toBe(2);
    expect(it.myTeamSelectedCount).toBe(1);
    expect(it.myTeamFavoriteCount).toBe(1);
  });

  it("規則種別・件数単位（ビルド / 件 / 枠）", () => {
    const inv = buildInventory([bUsed, bUnused, bLegacy, bMulti], myTeam, squads, emptyCards);
    const s = inv.summary;
    expect(s.currentRulesBuilds).toBe(3);
    expect(s.legacyRulesBuilds).toBe(1);
    expect(s.myTeamSelectedRefs).toBe(2); // tc_a→b_used, tc_b→b_multi
    expect(s.myTeamFavoriteRefs).toBe(1); // tc_a→b_used
    expect(s.squadRefs).toBe(3); // 先発2 + ベンチ1
  });
});

describe("buildInventory: 問題参照", () => {
  const b = mkBuild({ buildId: "b_ok", worldCardId: CARD_A });
  const myTeam = [
    mkRecord({ teamCardId: "tc_1", worldCardId: CARD_A, selectedBuildId: "b_deleted", favoriteBuildId: "b_ok" }),
    mkRecord({ teamCardId: "tc_2", worldCardId: CARD_B, selectedBuildId: "b_ok" }), // b_ok は CARD_A → 不一致
  ];
  const squads = [
    mkSquad({
      squadId: "sq_x000000000001",
      squadName: "対人用",
      slots: [{ slotId: "cf", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_squadgone" }],
      substitutes: [{ subId: "sub_1", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_benchgone" }],
    }),
  ];

  it("削除済み / worldCardId 不一致を検出し、正常使用に数えない", () => {
    const inv = buildInventory([b], myTeam, squads, emptyCards);
    const s = inv.summary;
    expect(s.missingMyTeamRefs).toBe(1); // b_deleted
    expect(s.missingSquadRefs).toBe(2); // b_squadgone, b_benchgone
    expect(s.worldCardMismatchRefs).toBe(1); // tc_2 → b_ok
    // b_ok は favorite(tc_1・CARD_A 一致) だけが正常 → refCount 1
    const item = inv.items.find((i) => i.build.buildId === "b_ok")!;
    expect(item.refCount).toBe(1);
    expect(item.myTeamFavoriteCount).toBe(1);
    expect(item.myTeamSelectedCount).toBe(0);
    expect(item.mismatchRefCount).toBe(1);
    expect(item.used).toBe(true);
  });

  it("issues に種類・参照元・buildId・説明が入る（自動修復しない）", () => {
    const inv = buildInventory([b], myTeam, squads, emptyCards);
    const missing = inv.issues.find((x) => x.kind === "missing" && x.buildId === "b_deleted")!;
    expect(missing.source.kind).toBe("my-team-selected");
    expect(missing.description).toContain("存在しない保存ビルド");
    const squadGone = inv.issues.find((x) => x.buildId === "b_squadgone")!;
    expect(squadGone.source.kind).toBe("squad-starter");
    if (squadGone.source.kind === "squad-starter") expect(squadGone.source.squadName).toBe("対人用");
    // 元の保存ビルド・My Team・スカッドは buildInventory では触れない（純関数）
    expect(b.buildId).toBe("b_ok");
  });

  it("問題がゼロなら issues は空", () => {
    const inv = buildInventory([b], [mkRecord({ worldCardId: CARD_A, favoriteBuildId: "b_ok" })], [], emptyCards);
    expect(inv.issues).toEqual([]);
    expect(inv.summary.worldCardMismatchRefs).toBe(0);
  });
});

describe("buildInventory: 空・大きな worldCardId・カード解決", () => {
  it("保存ビルド 0 件", () => {
    const inv = buildInventory([], [], [], emptyCards);
    expect(inv.summary).toMatchObject({ totalBuilds: 0, usedBuilds: 0, unusedBuilds: 0 });
    expect(inv.items).toEqual([]);
    expect(inv.issues).toEqual([]);
  });
  it("My Team / スカッドなしでも全ビルド未使用として集計", () => {
    const inv = buildInventory([mkBuild({ buildId: "b_1" }), mkBuild({ buildId: "b_2" })], [], [], emptyCards);
    expect(inv.summary.unusedBuilds).toBe(2);
  });
  it("大きな worldCardId・カード解決で cardType/position ファセット", () => {
    const big = "12345678901234567890";
    const b = mkBuild({ buildId: "b_big", worldCardId: big });
    const cards = new Map([[big, mkCard({ worldCardId: big, cardType: "Standard", registeredPosition: "CB" })]]);
    const inv = buildInventory([b], [], [], cards);
    expect(inv.items[0].card?.worldCardId).toBe(big);
    expect(inv.cardTypes).toEqual(["Standard"]);
    expect(inv.positions).toEqual(["CB"]);
  });
});

describe("filterBuildInventory / sortBuildInventory", () => {
  const cards = new Map<string, WorldPlayerListItem>([
    [CARD_A, mkCard({ worldCardId: CARD_A, nameJa: "あ選手", cardType: "Epic", registeredPosition: "CF" })],
    [CARD_B, mkCard({ worldCardId: CARD_B, nameJa: "ん選手", cardType: "Standard", registeredPosition: "CB" })],
  ]);
  const builds = [
    mkBuild({ buildId: "b_used", worldCardId: CARD_A, buildName: "使用中", updatedAt: "2026-08-30T00:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" }),
    mkBuild({ buildId: "b_unused", worldCardId: CARD_A, buildName: "未使用", updatedAt: "2026-08-10T00:00:00.000Z", createdAt: "2026-08-20T00:00:00.000Z" }),
    mkBuild({ buildId: "b_legacy", worldCardId: CARD_B, buildName: "旧規則ビルド", rulesVersion: PROGRESSION_RULES_VERSION_V1, updatedAt: "2026-08-20T00:00:00.000Z", createdAt: "2026-08-05T00:00:00.000Z" }),
  ];
  const myTeam = [mkRecord({ worldCardId: CARD_A, selectedBuildId: "b_used", favoriteBuildId: "b_used" })];
  const inv = buildInventory(builds, myTeam, [], cards);

  const f = (over: Partial<BuildInventoryFilter>): BuildInventoryFilter => ({ ...DEFAULT_BUILD_INVENTORY_FILTER, ...over });

  it("使用状況 / 規則 / カードタイプ / チェック絞り込み（AND）", () => {
    expect(filterBuildInventory(inv.items, f({ usage: "used" })).map((i) => i.build.buildId)).toEqual(["b_used"]);
    expect(filterBuildInventory(inv.items, f({ usage: "unused" })).map((i) => i.build.buildId).sort()).toEqual(["b_legacy", "b_unused"]);
    expect(filterBuildInventory(inv.items, f({ rules: "legacy" })).map((i) => i.build.buildId)).toEqual(["b_legacy"]);
    expect(filterBuildInventory(inv.items, f({ cardType: "Standard" })).map((i) => i.build.buildId)).toEqual(["b_legacy"]);
    expect(filterBuildInventory(inv.items, f({ myTeamSelected: true })).map((i) => i.build.buildId)).toEqual(["b_used"]);
    expect(filterBuildInventory(inv.items, f({ multiUse: true })).map((i) => i.build.buildId)).toEqual(["b_used"]);
    expect(filterBuildInventory(inv.items, f({ usage: "unused", rules: "legacy" })).map((i) => i.build.buildId)).toEqual(["b_legacy"]);
  });

  it("検索（選手名・ビルド名・World ID・正規表現記号は文字通り）", () => {
    expect(filterBuildInventory(inv.items, f({ q: "ん選手" })).map((i) => i.build.buildId)).toEqual(["b_legacy"]);
    expect(filterBuildInventory(inv.items, f({ q: "旧規則" })).map((i) => i.build.buildId)).toEqual(["b_legacy"]);
    expect(filterBuildInventory(inv.items, f({ q: "891385" })).map((i) => i.build.buildId).sort()).toEqual(["b_unused", "b_used"]);
    expect(filterBuildInventory(inv.items, f({ q: ".*" }))).toEqual([]);
  });

  it("並び替え（更新・参照数・未使用優先・buildId 安定・非破壊）", () => {
    expect(sortBuildInventory(inv.items, "updated_desc").map((i) => i.build.buildId)).toEqual(["b_used", "b_legacy", "b_unused"]);
    expect(sortBuildInventory(inv.items, "refs_desc").map((i) => i.build.buildId)).toEqual(["b_used", "b_legacy", "b_unused"]);
    expect(sortBuildInventory(inv.items, "unused_first").map((i) => i.build.buildId).slice(-1)).toEqual(["b_used"]);
    const snap = inv.items.map((i) => i.build.buildId);
    sortBuildInventory(inv.items, "name_asc");
    expect(inv.items.map((i) => i.build.buildId)).toEqual(snap);
  });

  it("不正日時は末尾", () => {
    const withBad = buildInventory([...builds, mkBuild({ buildId: "b_bad", updatedAt: "broken" })], myTeam, [], cards);
    expect(sortBuildInventory(withBad.items, "updated_desc").at(-1)?.build.buildId).toBe("b_bad");
  });
});

describe("filterBuildInventoryIssues", () => {
  const b = mkBuild({ buildId: "b_ok", worldCardId: CARD_A });
  const myTeam = [mkRecord({ teamCardId: "tc_1", worldCardId: CARD_A, selectedBuildId: "b_deleted" })];
  const squads = [
    mkSquad({
      squadId: "sq_z000000000001",
      squadName: "サブ",
      slots: [{ slotId: "cf", worldCardId: CARD_A, buildMode: "none", savedBuildId: "bad id!" }],
    }),
  ];
  const inv = buildInventory([b], myTeam, squads, emptyCards);

  it("種類フィルターと検索", () => {
    expect(filterBuildInventoryIssues(inv.issues, "all", "").length).toBe(2);
    expect(filterBuildInventoryIssues(inv.issues, "missing", "").length).toBe(1);
    expect(filterBuildInventoryIssues(inv.issues, "invalid-build-id", "").length).toBe(1);
    expect(filterBuildInventoryIssues(inv.issues, "all", "サブ").length).toBe(1);
    expect(filterBuildInventoryIssues(inv.issues, "all", "b_deleted").length).toBe(1);
  });
});

describe("summarizeLegacyBuilds（旧規則ビルド確認ガイド）", () => {
  const V1 = PROGRESSION_RULES_VERSION_V1;
  const V2 = PROGRESSION_RULES_VERSION;
  // resolveBuildRuleStatus: 空 rulesVersion のみ "規則不明"。非空・非 v2 は既存仕様どおり "旧規則"。
  const UNKNOWN = "";

  it("旧規則 0 件", () => {
    const inv = buildInventory([mkBuild({ buildId: "b1", rulesVersion: V2 })], [], [], emptyCards);
    expect(summarizeLegacyBuilds(inv.items)).toEqual({
      total: 0, used: 0, unused: 0, myTeamSelectedRefs: 0, myTeamFavoriteRefs: 0,
      squadRefs: 0, multiUse: 0, pom: 0, experimental: 0, withProblemRef: 0,
    });
  });

  it("現行規則・規則不明を除外し旧規則だけを数える（rulesVersion は判定のみ・変更しない）", () => {
    const bV1 = mkBuild({ buildId: "b_v1", worldCardId: CARD_A, rulesVersion: V1 });
    const bV2 = mkBuild({ buildId: "b_v2", worldCardId: CARD_A, rulesVersion: V2 });
    const bUnknown = mkBuild({ buildId: "b_uk", worldCardId: CARD_A, rulesVersion: UNKNOWN });
    const inv = buildInventory([bV1, bV2, bUnknown], [], [], emptyCards);
    const s = summarizeLegacyBuilds(inv.items);
    expect(s.total).toBe(1);
    // 規則不明は unknownRulesBuilds へ・legacy には含めない
    expect(inv.summary.legacyRulesBuilds).toBe(1);
    expect(inv.summary.unknownRulesBuilds).toBe(1);
    // 元の rulesVersion は不変
    expect(bV1.rulesVersion).toBe(V1);
    expect(bUnknown.rulesVersion).toBe("");
  });

  it("使用中・未使用・My Team selected/favorite・スカッド枠・複数箇所・PoM・実験・問題参照", () => {
    const bUsed = mkBuild({ buildId: "b_lu", worldCardId: CARD_A, rulesVersion: V1 });
    const bUnused = mkBuild({ buildId: "b_ln", worldCardId: CARD_A, rulesVersion: V1 });
    const bPoM = mkBuild({
      buildId: "b_lp", worldCardId: CARD_B, rulesVersion: V1,
      conditionalBoosterSelections: [{ boosterKey: "total-package", selection: "league_1_13" }],
    });
    const bExp = mkBuild({ buildId: "b_le", worldCardId: CARD_B, rulesVersion: V1, selectedPlayerBooster: 73 });
    const bMismatch = mkBuild({ buildId: "b_lm", worldCardId: CARD_A, rulesVersion: V1 });

    const myTeam = [
      mkRecord({ teamCardId: "tc_a", worldCardId: CARD_A, selectedBuildId: "b_lu", favoriteBuildId: "b_lu" }),
      mkRecord({ teamCardId: "tc_b", worldCardId: CARD_B, selectedBuildId: "b_lp" }),
      // b_lm は CARD_A のビルドだが CARD_B の枠から参照 → worldCardId 不一致（正常使用に数えない）
      mkRecord({ teamCardId: "tc_c", worldCardId: CARD_B, favoriteBuildId: "b_lm" }),
    ];
    const squads = [
      mkSquad({
        squadId: "sq_leg000000001", squadName: "旧",
        slots: [
          { slotId: "cf", worldCardId: CARD_B, buildMode: "none", savedBuildId: "b_le" },
          { slotId: "lwf", worldCardId: CARD_B, buildMode: "none", savedBuildId: "b_le" },
        ],
      }),
    ];
    const inv = buildInventory([bUsed, bUnused, bPoM, bExp, bMismatch], myTeam, squads, emptyCards);
    const s = summarizeLegacyBuilds(inv.items);
    expect(s.total).toBe(5);
    expect(s.used).toBe(3); // b_lu, b_lp, b_le
    expect(s.unused).toBe(2); // b_ln, b_lm（不一致参照のみ）
    expect(s.myTeamSelectedRefs).toBe(2); // tc_a→b_lu, tc_b→b_lp
    expect(s.myTeamFavoriteRefs).toBe(1); // tc_a→b_lu（tc_c は不一致なので数えない）
    expect(s.squadRefs).toBe(2); // 先発 2 枠 → b_le
    expect(s.multiUse).toBe(2); // b_lu(2), b_le(2)
    expect(s.pom).toBe(1); // b_lp
    expect(s.experimental).toBe(1); // b_le
    expect(s.withProblemRef).toBe(1); // b_lm（worldCardId 不一致で参照されている）
  });

  it("同一スカッドの複数枠は squadRefs に各枠を含める", () => {
    const b = mkBuild({ buildId: "b_multi", worldCardId: CARD_A, rulesVersion: PROGRESSION_RULES_VERSION_V1 });
    const squads = [
      mkSquad({
        squadId: "sq_m0000000001",
        slots: [{ slotId: "cf", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_multi" }],
        substitutes: [{ subId: "sub_1", worldCardId: CARD_A, buildMode: "none", savedBuildId: "b_multi" }],
      }),
    ];
    const inv = buildInventory([b], [], squads, emptyCards);
    expect(summarizeLegacyBuilds(inv.items).squadRefs).toBe(2);
  });

  it("非破壊: 元の items 配列を変更しない", () => {
    const inv = buildInventory([mkBuild({ buildId: "b1", rulesVersion: PROGRESSION_RULES_VERSION_V1 })], [], [], emptyCards);
    const snap = inv.items.map((i) => i.build.buildId);
    summarizeLegacyBuilds(inv.items);
    expect(inv.items.map((i) => i.build.buildId)).toEqual(snap);
  });

  it("legacyOnlyFilter は既存フィルターを破棄して rules=legacy のみ", () => {
    expect(legacyOnlyFilter()).toEqual({ ...DEFAULT_BUILD_INVENTORY_FILTER, rules: "legacy" });
    // それを filterBuildInventory へ渡すと legacy だけが残る
    const inv = buildInventory(
      [
        mkBuild({ buildId: "b_v1", worldCardId: CARD_A, rulesVersion: PROGRESSION_RULES_VERSION_V1 }),
        mkBuild({ buildId: "b_v2", worldCardId: CARD_A, rulesVersion: PROGRESSION_RULES_VERSION }),
      ],
      [], [], emptyCards,
    );
    expect(filterBuildInventory(inv.items, legacyOnlyFilter()).map((i) => i.build.buildId)).toEqual(["b_v1"]);
  });
});

describe("resolveAnalyzingBuildId（「このビルドを分析」の選択状態）", () => {
  const inv = buildInventory(
    [mkBuild({ buildId: "b_a", worldCardId: CARD_A }), mkBuild({ buildId: "b_b", worldCardId: CARD_A })],
    [],
    [],
    emptyCards,
  );

  it("選択なし（null）は null のまま", () => {
    expect(resolveAnalyzingBuildId(null, inv.items)).toBeNull();
  });

  it("選択中のビルドが一覧に含まれていれば維持する", () => {
    expect(resolveAnalyzingBuildId("b_a", inv.items)).toBe("b_a");
  });

  it("選択中のビルドが検索・フィルターで一覧から外れたら null にする", () => {
    const filtered = inv.items.filter((i) => i.build.buildId === "b_b");
    expect(resolveAnalyzingBuildId("b_a", filtered)).toBeNull();
  });

  it("一覧が空になった場合も null にする", () => {
    expect(resolveAnalyzingBuildId("b_a", [])).toBeNull();
  });

  it("非破壊: items配列を変更しない", () => {
    const snap = inv.items.map((i) => i.build.buildId);
    resolveAnalyzingBuildId("b_a", inv.items);
    expect(inv.items.map((i) => i.build.buildId)).toEqual(snap);
  });
});
