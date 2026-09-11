import { describe, it, expect } from "vitest";
import { toProgressionCard } from "@/lib/progression/from-world";
import { MESSI_BIGTIME, CANNAVARO_EPIC } from "@/lib/progression/fixtures";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import type { ProgressionCard, SavedBuild } from "@/lib/progression/types";
import { buildBestXiCandidates } from "./candidates";

function myTeamRecord(overrides: Partial<MyTeamRecord> & { worldCardId: string }): MyTeamRecord {
  const now = "2026-09-10T00:00:00.000Z";
  return {
    localRecordId: `mt_${overrides.worldCardId}`,
    teamCardId: `tc_${overrides.worldCardId}`,
    ownershipStatus: "owned",
    usageStatus: "unused",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: now,
    updatedAt: now,
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
    ...overrides,
  };
}

function savedBuild(overrides: Partial<SavedBuild> & { buildId: string; worldCardId: string }): SavedBuild {
  const now = "2026-09-10T00:00:00.000Z";
  return {
    buildName: "テストビルド",
    progressionAllocation: {},
    selectedPlayerBooster: null,
    calculatedStats: {},
    calculatedOvr: null,
    calculationMode: "confirmed",
    rulesVersion: PROGRESSION_RULES_VERSION,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}

function progressionCardsMap(...cards: ProgressionCard[]): Map<string, ProgressionCard> {
  return new Map(cards.map((c) => [c.worldCardId, c]));
}

describe("buildBestXiCandidates", () => {
  it("My Teamに登録された所有中カードから候補を作る", () => {
    const myTeam = [myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId })];
    const { candidates } = buildBestXiCandidates({
      myTeam,
      progressionCards: progressionCardsMap(MESSI_BIGTIME),
      buildsByWorldCardId: new Map(),
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].source).toBe("base");
    expect(candidates[0].abilityStatus).toBe("available");
  });

  it("所有中でないカード(欲しい/手放した/不明)は候補にしない", () => {
    const myTeam = [
      myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId, ownershipStatus: "wanted" }),
      myTeamRecord({ worldCardId: CANNAVARO_EPIC.worldCardId, ownershipStatus: "released" }),
    ];
    const { candidates } = buildBestXiCandidates({
      myTeam,
      progressionCards: progressionCardsMap(MESSI_BIGTIME, CANNAVARO_EPIC),
      buildsByWorldCardId: new Map(),
    });
    expect(candidates).toHaveLength(0);
  });

  it("保存ビルドがあるカードは各保存ビルドを個別の候補として評価する(base候補は作らない)", () => {
    const myTeam = [myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId })];
    const builds = [
      savedBuild({ buildId: "b1", worldCardId: MESSI_BIGTIME.worldCardId, buildName: "ドリブル型" }),
      savedBuild({ buildId: "b2", worldCardId: MESSI_BIGTIME.worldCardId, buildName: "シュート型" }),
    ];
    const { candidates } = buildBestXiCandidates({
      myTeam,
      progressionCards: progressionCardsMap(MESSI_BIGTIME),
      buildsByWorldCardId: new Map([[MESSI_BIGTIME.worldCardId, builds]]),
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.source === "build")).toBe(true);
    expect(candidates.map((c) => c.buildId).sort()).toEqual(["b1", "b2"]);
  });

  it("保存ビルドがないカードは育成配分ゼロの候補を1件だけ作る", () => {
    const myTeam = [myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId })];
    const { candidates } = buildBestXiCandidates({
      myTeam,
      progressionCards: progressionCardsMap(MESSI_BIGTIME),
      buildsByWorldCardId: new Map(),
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].source).toBe("base");
    expect(candidates[0].buildId).toBeNull();
    // 育成配分ゼロなので base 値そのまま(ベース能力値からの上昇なし)
    const finishing = candidates[0].stats?.find((s) => s.key === "finishing");
    expect(finishing?.progressionDelta).toBe(0);
  });

  it("カード情報を解決できないMy Teamレコードは候補にせず、理由を記録する", () => {
    const myTeam = [myTeamRecord({ worldCardId: "99999999999999" })];
    const { candidates, unavailableCards } = buildBestXiCandidates({
      myTeam,
      progressionCards: new Map(),
      buildsByWorldCardId: new Map(),
    });
    expect(candidates).toHaveLength(0);
    expect(unavailableCards).toEqual([{ worldCardId: "99999999999999", reason: "noWorldCardData" }]);
  });

  it("同じworldCardIdが複数回登録されていても重複評価しない(My Teamは1カード1レコードの前提)", () => {
    const myTeam = [
      myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId }),
      myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId, localRecordId: "dup" }),
    ];
    const { candidates } = buildBestXiCandidates({
      myTeam,
      progressionCards: progressionCardsMap(MESSI_BIGTIME),
      buildsByWorldCardId: new Map(),
    });
    expect(candidates).toHaveLength(1);
  });

  it("入力(myTeam配列・buildsByWorldCardId)を変更しない", () => {
    const myTeam = [myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId })];
    const builds = [savedBuild({ buildId: "b1", worldCardId: MESSI_BIGTIME.worldCardId })];
    const buildsMap = new Map([[MESSI_BIGTIME.worldCardId, builds]]);
    const myTeamCopy = JSON.parse(JSON.stringify(myTeam));
    const buildsCopy = JSON.parse(JSON.stringify(builds));
    buildBestXiCandidates({ myTeam, progressionCards: progressionCardsMap(MESSI_BIGTIME), buildsByWorldCardId: buildsMap });
    expect(myTeam).toEqual(myTeamCopy);
    expect(buildsMap.get(MESSI_BIGTIME.worldCardId)).toEqual(buildsCopy);
  });

  it("同じ入力からは常に同じ候補一覧を返す(決定性)", () => {
    const myTeam = [myTeamRecord({ worldCardId: MESSI_BIGTIME.worldCardId }), myTeamRecord({ worldCardId: CANNAVARO_EPIC.worldCardId })];
    const cards = progressionCardsMap(MESSI_BIGTIME, CANNAVARO_EPIC);
    const r1 = buildBestXiCandidates({ myTeam, progressionCards: cards, buildsByWorldCardId: new Map() });
    const r2 = buildBestXiCandidates({ myTeam, progressionCards: cards, buildsByWorldCardId: new Map() });
    expect(r1.candidates.map((c) => c.candidateKey)).toEqual(r2.candidates.map((c) => c.candidateKey));
  });

  it("toProgressionCardで構築したカードでも問題なく候補化できる(World詳細からの実経路)", () => {
    const detail = {
      worldCardId: "12345678901234",
      nameEn: "Test Player",
      nameJa: "テスト選手",
      registeredPosition: "CF",
      cardType: "BASE",
      ovrBase: 80,
      ovrMax: 90,
      maximumLevel: 20,
      boost1: 0,
      boost2: 0,
      stats: [{ key: "finishing", value: 70 }] as { key: string; value: number }[],
    };
    const card = toProgressionCard(detail as Parameters<typeof toProgressionCard>[0]);
    const myTeam = [myTeamRecord({ worldCardId: detail.worldCardId })];
    const { candidates } = buildBestXiCandidates({
      myTeam,
      progressionCards: progressionCardsMap(card),
      buildsByWorldCardId: new Map(),
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].abilityStatus).toBe("available");
  });
});
