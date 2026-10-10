import { describe, expect, it } from "vitest";
import { assignWorldCardToSlot, addWorldCardToBench } from "./assign";
import { emptySquad } from "./squad-storage";
import { getFormation } from "./formations";
import { applySquadChanges, rankBenchSwaps } from "./improvement-simulation";
import type { SquadDiagnosisInput, SquadDiagnosisPlayerInput } from "./squad-diagnosis";
import { calculateBuild, emptyAllocation } from "@/lib/progression/engine";
import { MESSI_BIGTIME } from "@/lib/progression/fixtures";
import type { ProgressionCard } from "@/lib/progression/types";
import type { BestXiCandidate } from "@/lib/best-xi/types";
import { selectBestXi } from "@/lib/best-xi/select";
import { selectBestXiBench } from "@/lib/best-xi/bench";
import { duplicatePersons, isSamePerson } from "@/lib/world/person-identity";

/**
 * ゲームでは同じ選手の別のカードを同じスカッドに 2 枚編成できない（2026-10-10 本人のゲームの画面の確認）。
 * 同じ選手の判定はカード ID の下位 20 ビット（person-identity.ts・実データの監査で食い違い 0）。
 */
// 実データの同じ選手の別カード（Buongiorno）と、別の選手（Costacurta）
const B1 = "105869601784218";
const B2 = "105782628696474";
const C1 = "88036360587367";
let n = 0;
const newSubId = () => `sub_${String(++n).padStart(8, "0")}`;

describe("スカッドの編集: 同じ選手の別カードは入れられない", () => {
  it("先発 → 先発・先発 → 控え・控え → 先発のどれも拒否（same_player_not_allowed）・別の選手は入る", () => {
    const sq = emptySquad("t", "4-3-3");
    const [s1, s2] = getFormation("4-3-3").slots;
    const a = assignWorldCardToSlot(sq, s1.slotId, B1);
    expect(a.ok).toBe(true);
    expect(assignWorldCardToSlot(a.squad, s2.slotId, B2)).toMatchObject({ ok: false, errorCode: "same_player_not_allowed" });
    expect(addWorldCardToBench(a.squad, B2, newSubId)).toMatchObject({ ok: false, errorCode: "same_player_not_allowed" });
    const bench = addWorldCardToBench(sq, B2, newSubId);
    expect(assignWorldCardToSlot(bench.squad, s1.slotId, B1)).toMatchObject({ ok: false, errorCode: "same_player_not_allowed" });
    expect(assignWorldCardToSlot(a.squad, s2.slotId, C1).ok).toBe(true);
    // 同じカードは従来どおり duplicate_not_allowed
    expect(assignWorldCardToSlot(a.squad, s2.slotId, B1)).toMatchObject({ ok: false, errorCode: "duplicate_not_allowed" });
  });
  it("拒否しても元のスカッドは変えない", () => {
    const sq = assignWorldCardToSlot(emptySquad("t", "4-3-3"), "gk", B1).squad;
    const before = JSON.stringify(sq);
    const r = addWorldCardToBench(sq, B2, newSubId);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r.squad)).toBe(before);
  });
  it("既存の保存データの重複は見つけられる（消さずに知らせるため）", () => {
    expect(duplicatePersons([B1, C1, B2])).toEqual([{ personKey: expect.any(String), worldCardIds: [B1, B2] }]);
    expect(isSamePerson(B1, C1)).toBe(false);
  });
});

function card(worldCardId: string, registeredPosition: string, bump = 0): ProgressionCard {
  const baseStats = Object.fromEntries(Object.entries(MESSI_BIGTIME.baseStats).map(([k, v]) => [k, Math.min(99, v + bump)]));
  return { worldCardId, nameEn: `P${worldCardId}`, nameJa: `選手${worldCardId}`, registeredPosition, cardType: "BASE", ovrBase: 80, ovrMax: 90, maximumLevel: 20, boost1: 0, boost2: 0, baseStats };
}
function candidate(c: ProgressionCard): BestXiCandidate {
  return {
    candidateKey: `${c.worldCardId}:base`, worldCardId: c.worldCardId, buildId: null, buildName: null, source: "base", nameJa: c.nameJa, nameEn: c.nameEn,
    registeredPosition: c.registeredPosition, ruleKind: "current", abilityStatus: "available",
    stats: calculateBuild({ card: c, allocation: emptyAllocation(), selectedPlayerBoosters: [], selectedConditionalBoosters: [], manager: null }).stats,
    ownershipStatus: "owned", intendedPositions: null,
  };
}

describe("AI ベスト11・控え: 同じ選手は 1 枚だけ", () => {
  it("同じ選手の 2 枚（CF・CF）は先発に 1 枚だけ・強い方を選ぶ・控えにも入らない", () => {
    // 同じ人物の CF 2 枚（B2 が強い）と、別の選手の CF 1 枚
    const pool = [candidate(card(B1, "CF")), candidate(card(B2, "CF", 5)), candidate(card(C1, "CF"))];
    const sel = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: "2026-10-10T00:00:00.000Z" });
    const picked = sel.slots.map((s) => s.candidate.worldCardId);
    expect(picked.filter((id) => isSamePerson(id, B1))).toHaveLength(1);
    expect(picked).toContain(B2);
    const bench = selectBestXiBench({ formationId: "4-3-3", candidates: pool, selection: sel });
    const all = [...picked, ...bench.entries.map((e) => e.candidate.worldCardId)];
    expect(duplicatePersons(all)).toEqual([]);
    expect(sel.limitationCodes).not.toContain("personIdentityUnavailable");
  });
});

describe("改善シミュレーション: 入れ替えで同じ選手を 2 人にしない", () => {
  const p = (o: Partial<SquadDiagnosisPlayerInput>): SquadDiagnosisPlayerInput => ({
    key: "x", worldCardId: C1, nameJa: "a", nameEn: "a", registeredPosition: "CF", role: "FW", assignedPosition: "CF", compatibilityStatus: "exact", isCaptain: false,
    cardResolved: true, stats: candidate(card(C1, "CF")).stats, savedBuildId: null, savedBuildStatus: "none", ...o,
  });
  const f = getFormation("4-3-3");
  const starters = f.slots.map((s, i) => p({ key: s.slotId, worldCardId: i === 10 ? B1 : String(1000 + i), role: s.role, assignedPosition: s.position, registeredPosition: s.position }));
  const input: SquadDiagnosisInput = { squadId: "sq", squadName: "s", updatedAt: "", formationId: "4-3-3", starters, bench: [p({ key: "sub0", worldCardId: B2, role: null, assignedPosition: null, compatibilityStatus: null, stats: candidate(card(B2, "CF", 20)).stats })], managerId: null, managerResolved: true, managerApplied: false };
  it("別の先発と同じ選手の控えへの入れ替えは拒否・同じ枠の入れ替え（同じ選手どうし）は許す", () => {
    const other = starters[0].key;
    expect(applySquadChanges(input, [{ kind: "swap", starterKey: other, benchKey: "sub0" }]).rejected[0]).toMatch(/same player/);
    expect(applySquadChanges(input, [{ kind: "swap", starterKey: starters[10].key, benchKey: "sub0" }]).rejected).toEqual([]);
    for (const c of rankBenchSwaps(input, 20)) expect(c.starterKey === starters[10].key).toBe(true);
  });
});
