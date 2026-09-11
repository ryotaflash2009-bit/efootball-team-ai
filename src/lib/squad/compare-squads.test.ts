import { describe, it, expect } from "vitest";
import {
  compareSquads,
  findCommonWorldCardIds,
  findExclusiveWorldCardIds,
  toCompareUnits,
  type CompareSideInput,
  type ResolvedCompareCard,
} from "./compare-squads";
import { buildSquad } from "./build-squad";
import { assembleBuildSquadInput } from "./assemble-build-input";
import { emptySquad } from "./squad-storage";
import { assignWorldCardToSlot, addWorldCardToBench } from "./assign";
import type { StoredSquad } from "./types";
import type { ProgressionCard } from "@/lib/progression/types";
import type { WorldPlayerDetail } from "@/lib/world/types";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK, LEVEL1_TRENDING } from "@/lib/progression/fixtures";

// ---- テスト用ヘルパー ----

function cardToDetail(c: ProgressionCard, skills: string[] = []): WorldPlayerDetail {
  return {
    worldCardId: c.worldCardId,
    nameEn: c.nameEn,
    nameJa: c.nameJa,
    cardType: c.cardType,
    registeredPosition: c.registeredPosition,
    ovrBase: c.ovrBase,
    ovrMax: c.ovrMax,
    maximumLevel: c.maximumLevel,
    cardRating: null,
    playingStyle: null,
    playingStyleDefensive: null,
    nationality: null,
    region: null,
    league: null,
    team: null,
    preferredFoot: null,
    age: null,
    height: null,
    weight: null,
    boost1: c.boost1,
    boost2: c.boost2,
    appearanceUpdatedAt: null,
    imageUrlCandidate: null,
    mobileImageUrlCandidate: null,
    hasEfhubLink: false,
    efhubCardId: null,
    stats: Object.entries(c.baseStats).map(([key, value]) => ({
      key,
      nameEn: key,
      group: "offense" as const,
      value,
    })),
    playerSkills: skills,
    aiStyles: [],
    appearance: null,
    source: "world",
    sourceUrl: "x",
    fetchedAt: null,
    efhubConflicts: [],
  };
}

function must(r: { ok: boolean; squad?: StoredSquad }): StoredSquad {
  if (!r.ok || !r.squad) throw new Error(JSON.stringify(r));
  return r.squad;
}

function resolvedFromComputed(computed: ReturnType<typeof buildSquad>): Map<string, ResolvedCompareCard> {
  const m = new Map<string, ResolvedCompareCard>();
  for (const s of computed.slots) {
    if (!s.entry) continue;
    m.set(s.entry.display.worldCardId, {
      display: s.entry.display,
      baseOvr: s.entry.baseOvr,
      displayedOvr: s.entry.displayedOvr,
      playerSkills: s.entry.display.playerSkills,
      boosters: s.entry.result.playerBoosters,
      hasConditionalSelection: s.entry.result.booster.hasConditionalSelection,
      conditionalSelections: s.entry.result.booster.conditionalSelections,
      staleBuild: s.entry.staleBuild,
      savedBuildName: s.entry.savedBuildName,
    });
  }
  for (const s of computed.substitutes) {
    if (m.has(s.display.worldCardId)) continue;
    m.set(s.display.worldCardId, {
      display: s.display,
      baseOvr: s.baseOvr,
      displayedOvr: s.displayedOvr,
      playerSkills: s.display.playerSkills,
      boosters: s.result.playerBoosters,
      hasConditionalSelection: s.result.booster.hasConditionalSelection,
      conditionalSelections: s.result.booster.conditionalSelections,
      staleBuild: s.staleBuild,
      savedBuildName: s.savedBuildName,
    });
  }
  return m;
}

function side(squad: StoredSquad, cards: ProgressionCard[], skillsByCard: Record<string, string[]> = {}): CompareSideInput {
  const details = new Map<string, WorldPlayerDetail>();
  for (const c of cards) details.set(c.worldCardId, cardToDetail(c, skillsByCard[c.worldCardId] ?? []));
  const input = assembleBuildSquadInput({
    squad,
    details,
    savedBuildsByCard: new Map(),
    manager: null,
    managerLinkUpPlays: null,
  });
  const computed = buildSquad(input);
  return {
    squad,
    computed,
    managerDetail: null,
    resolved: resolvedFromComputed(computed),
    failedCardIds: [],
    savedBuildsByCard: new Map(),
  };
}

// 4-3-3 の 3 スロットにカードを置いた素朴なスカッド
function squadWith(name: string, placements: [string, string][], bench: string[] = []): StoredSquad {
  let s = emptySquad(name, "4-3-3");
  for (const [slotId, id] of placements) s = must(assignWorldCardToSlot(s, slotId, id));
  for (const id of bench) s = must(addWorldCardToBench(s, id, () => `sub_${id.slice(0, 6)}`));
  return s;
}

// ---- テスト ----

describe("findCommonWorldCardIds / findExclusiveWorldCardIds", () => {
  it("worldCardId の共通・排他を求める（重複排除・順序維持）", () => {
    expect(findCommonWorldCardIds(["1", "2", "3", "2"], ["3", "2", "9"])).toEqual(["2", "3"]);
    const ex = findExclusiveWorldCardIds(["1", "2", "3"], ["3", "2", "9"]);
    expect(ex.onlyA).toEqual(["1"]);
    expect(ex.onlyB).toEqual(["9"]);
  });
});

describe("toCompareUnits", () => {
  it("先発とベンチを配置単位へ正規化し、キャプテン・セットプレー・座標を持つ", () => {
    let s = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId], ["lwf", LEVEL1_TRENDING.worldCardId]], [NEUER_GK.worldCardId]);
    s = { ...s, captainSlotId: "cf", setPieces: { ...s.setPieces, freeKicks: "cf" } };
    const units = toCompareUnits(side(s, [MESSI_BIGTIME, LEVEL1_TRENDING, NEUER_GK]));
    const cf = units.find((u) => u.worldCardId === MESSI_BIGTIME.worldCardId)!;
    expect(cf.area).toBe("starter");
    expect(cf.isCaptain).toBe(true);
    expect(cf.setPieceRoles).toContain("FK");
    expect(cf.x).not.toBeNull();
    const gk = units.find((u) => u.worldCardId === NEUER_GK.worldCardId)!;
    expect(gk.area).toBe("bench");
    expect(gk.benchIndex).toBe(0);
  });
});

describe("compareSquads", () => {
  const cards = [MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK, LEVEL1_TRENDING];

  it("同一スカッド ID は sameSquad=true", () => {
    const s = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    const r = compareSquads(side(s, cards), side(s, cards));
    expect(r.sameSquad).toBe(true);
  });

  it("共通カード・Aだけ・Bだけを worldCardId で判定する", () => {
    const a = squadWith("攻撃", [["cf", MESSI_BIGTIME.worldCardId], ["lcb", CANNAVARO_EPIC.worldCardId]]);
    const b = squadWith("守備", [["cf", MESSI_BIGTIME.worldCardId], ["lwf", LEVEL1_TRENDING.worldCardId]]);
    const r = compareSquads(side(a, cards), side(b, cards));
    expect(r.summary.commonCardCount).toBe(1);
    expect(r.playerComparison.common[0].worldCardId).toBe(MESSI_BIGTIME.worldCardId);
    expect(r.playerComparison.onlyA.map((u) => u.worldCardId)).toEqual([CANNAVARO_EPIC.worldCardId]);
    expect(r.playerComparison.onlyB.map((u) => u.worldCardId)).toEqual([LEVEL1_TRENDING.worldCardId]);
  });

  it("同じカードで配置スロットが違えば配置差を出す", () => {
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    const b = squadWith("B", [["lwf", MESSI_BIGTIME.worldCardId]]);
    const r = compareSquads(side(a, cards), side(b, cards));
    const pc = r.shapeComparison.placementChanges.find((c) => c.worldCardId === MESSI_BIGTIME.worldCardId)!;
    expect(pc.moved).toBe(true);
    expect(pc.dx).not.toBe(0);
  });

  it("先発 → ベンチの変化を検出する", () => {
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    const b = squadWith("B", [], [MESSI_BIGTIME.worldCardId]);
    const r = compareSquads(side(a, cards), side(b, cards));
    const change = r.playerComparison.areaChanges.find((c) => c.worldCardId === MESSI_BIGTIME.worldCardId)!;
    expect(change.aArea).toBe("starter");
    expect(change.bArea).toBe("bench");
    expect(r.benchComparison.starterToBench.length).toBe(1);
  });

  it("フォーメーション差・役割構成の一致判定", () => {
    let a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    let b = { ...squadWith("B", [["cf", MESSI_BIGTIME.worldCardId]]), formationId: "4-3-3" };
    const r = compareSquads(side(a, cards), side(b, cards));
    expect(r.formationComparison.same).toBe(true);
  });

  it("平均・カテゴリ差は Aの値/Bの値/差 で並び、自動の勝者を付けない", () => {
    const a = squadWith("A", [["cf", LEVEL1_TRENDING.worldCardId]]);
    const b = squadWith("B", [["cf", CANNAVARO_EPIC.worldCardId]]);
    const r = compareSquads(side(a, cards), side(b, cards));
    const attack = r.categoryComparison.find((c) => c.label === "攻撃")!;
    expect(attack.a).not.toBeNull();
    expect(attack.b).not.toBeNull();
    expect(["a", "b", "equal", "na"]).toContain(attack.higher);
    expect(r).not.toHaveProperty("winner");
  });

  it("共通スキルの両方 / Aだけ / Bだけ", () => {
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    const b = squadWith("B", [["cf", LEVEL1_TRENDING.worldCardId]]);
    const r = compareSquads(
      side(a, cards, { [MESSI_BIGTIME.worldCardId]: ["Chip Shot", "Trickster"] }),
      side(b, cards, { [LEVEL1_TRENDING.worldCardId]: ["Chip Shot", "Acrobatic Finishing"] }),
    );
    expect(r.skillComparison.both).toContain("Chip Shot");
    expect(r.skillComparison.onlyA.map((s) => s.name)).toContain("Trickster");
    expect(r.skillComparison.onlyB.map((s) => s.name)).toContain("Acrobatic Finishing");
  });

  it("同名の別カード（worldCardId 違い）は共通扱いしない", () => {
    const messiAlt: ProgressionCard = { ...MESSI_BIGTIME, worldCardId: "99999999999999" };
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    const b = squadWith("B", [["cf", messiAlt.worldCardId]]);
    const r = compareSquads(side(a, [...cards]), side(b, [...cards, messiAlt]));
    expect(r.summary.commonCardCount).toBe(0);
    expect(r.playerComparison.sameNameDifferentCard.length).toBe(1);
    expect(r.playerComparison.sameNameDifferentCard[0].label).toBe("同名の別カード");
  });

  it("警告の両方 / Aだけ / Bだけ", () => {
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId]]);
    const b = squadWith("B", [["cf", MESSI_BIGTIME.worldCardId], ["gk", NEUER_GK.worldCardId]]);
    const r = compareSquads(side(a, cards), side(b, cards));
    expect(r.warningComparison.aCount).toBeGreaterThan(0);
    expect(Array.isArray(r.warningComparison.both)).toBe(true);
  });

  it("取得失敗カードは dataAvailability に載り、比較は続行する", () => {
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId], ["lwf", LEVEL1_TRENDING.worldCardId]]);
    const b = squadWith("B", [["cf", MESSI_BIGTIME.worldCardId]]);
    const sideA = side(a, [MESSI_BIGTIME]); // LEVEL1_TRENDING を渡さない = 未解決
    sideA.failedCardIds = [LEVEL1_TRENDING.worldCardId];
    const r = compareSquads(sideA, side(b, cards));
    expect(r.dataAvailability.aFailed.map((f) => f.worldCardId)).toContain(LEVEL1_TRENDING.worldCardId);
    expect(r.summary.a.startingCount).toBe(1); // 未解決先発は集計対象外
    expect(r.playerComparison.common.length).toBe(1);
  });

  it("複製直後は差分なし、片方を編集すると差分が出る", () => {
    const a = squadWith("A", [["cf", MESSI_BIGTIME.worldCardId], ["lcb", CANNAVARO_EPIC.worldCardId]]);
    const b: StoredSquad = { ...a, squadId: "sq_clone0000001", slots: a.slots.map((s) => ({ ...s })) };
    let r = compareSquads(side(a, cards), side(b, cards));
    expect(r.playerComparison.common.every((p) => !p.anyChange)).toBe(true);
    // b の CF をベンチへ動かす代わりに buildMode を変える
    const b2: StoredSquad = { ...b, slots: b.slots.map((s) => (s.slotId === "cf" ? { ...s, buildMode: "attack" } : s)) };
    r = compareSquads(side(a, cards), side(b2, cards));
    expect(r.playerComparison.common.find((p) => p.worldCardId === MESSI_BIGTIME.worldCardId)!.buildModeChanged).toBe(true);
  });
});
