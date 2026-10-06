import { describe, it, expect } from "vitest";
import { buildGrowthProfile, MAX_GROWTH_SQUADS } from "./growth-profile";
import type { DiagnosisHistoryEntry } from "./diagnosis-history";
import type { SquadDiagnosisSharePayloadV1 } from "./squad-diagnosis-share-url";

const C0: SquadDiagnosisSharePayloadV1["c"] = { attack: [40, "C"], defense: [47, "C"], aerial: [54, "C"], speed: [61, "B"], passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"] };

function entry(id: string, squadId: string, savedAt: string, overall: number | null, patch: Partial<SquadDiagnosisSharePayloadV1> = {}): DiagnosisHistoryEntry {
  return {
    id,
    savedAt,
    squadId,
    squadLabel: `Label ${squadId}`,
    payload: { v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: savedAt.slice(0, 10), o: [overall, overall == null ? null : "B"], c: C0, s: null, w: null, ...patch },
  };
}

describe("F-061 成長プロフィール", () => {
  it("同じスカッドの履歴を日付順に並べ、最初→最新の差・最も伸びたカテゴリ・克服した弱点", () => {
    const later = { ...C0, attack: [81, "A"] as const, aerial: [60, "B"] as const };
    const r = buildGrowthProfile([
      entry("2", "sq", "2026-09-20T00:00:00.000Z", 70, { c: later }),
      entry("1", "sq", "2026-09-10T00:00:00.000Z", 62),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ squadId: "sq", first: 62, latest: 70, delta: 8, excludedOtherRules: 0 });
    expect(r[0].points.map((p) => p.overall)).toEqual([62, 70]);
    expect(r[0].mostImproved).toEqual({ categoryId: "attack", from: 40, to: 81, delta: 41 });
    expect(r[0].overcameWeaknesses).toEqual(["attack"]);
  });

  it("最新と違う規則の版の履歴は比べない（件数だけ数える）。点数が無い履歴は除く。2件未満は出さない", () => {
    const r = buildGrowthProfile([
      entry("1", "sq", "2026-09-01T00:00:00.000Z", 50, { r: "squad-diagnosis/2026-08-01.v0" }),
      entry("2", "sq", "2026-09-10T00:00:00.000Z", null),
      entry("3", "sq", "2026-09-11T00:00:00.000Z", 60),
      entry("4", "sq", "2026-09-12T00:00:00.000Z", 58),
      entry("5", "solo", "2026-09-12T00:00:00.000Z", 90),
    ]);
    expect(r.map((s) => s.squadId)).toEqual(["sq"]);
    expect(r[0]).toMatchObject({ first: 60, latest: 58, delta: -2, excludedOtherRules: 1, mostImproved: null });
  });

  it("最近更新したスカッドから最大5つ。決定的", () => {
    const list: DiagnosisHistoryEntry[] = [];
    for (let i = 0; i < 7; i++) {
      list.push(entry(`a${i}`, `sq${i}`, `2026-09-0${i + 1}T00:00:00.000Z`, 50));
      list.push(entry(`b${i}`, `sq${i}`, `2026-09-1${i}T00:00:00.000Z`, 55));
    }
    const r = buildGrowthProfile(list);
    expect(r).toHaveLength(MAX_GROWTH_SQUADS);
    expect(r[0].squadId).toBe("sq6");
    expect(buildGrowthProfile(list)).toEqual(r);
  });
});

describe("F-061 成長プロフィール v2", () => {
  it("最高点とその日・最も下がったカテゴリ・新しい弱点・連続で上がった回数", () => {
    const worse = { ...C0, counterAttack: [55, "C"] as const, pressResistance: [70, "B"] as const };
    const r = buildGrowthProfile([
      entry("1", "sq1", "2026-10-01T00:00:00Z", 60),
      entry("2", "sq1", "2026-10-02T00:00:00Z", 75),
      entry("3", "sq1", "2026-10-03T00:00:00Z", 70),
      entry("4", "sq1", "2026-10-04T00:00:00Z", 72),
      entry("5", "sq1", "2026-10-05T00:00:00Z", 74, { c: worse }),
    ]);
    const g = r[0];
    expect(g.peak).toEqual({ overall: 75, date: "2026-10-02" });
    expect(g.mostDeclined).toEqual({ categoryId: "counterAttack", from: 89, to: 55, delta: -34 });
    expect(g.newWeaknesses).toEqual(["counterAttack"]);
    expect(g.improvingStreak).toBe(2);
  });

  it("下がったカテゴリが無ければ null・最新が前回より低ければ連続 0・同点の最高は早い日", () => {
    const r = buildGrowthProfile([entry("1", "sq1", "2026-10-01T00:00:00Z", 70), entry("2", "sq1", "2026-10-02T00:00:00Z", 70), entry("3", "sq1", "2026-10-03T00:00:00Z", 65)]);
    expect(r[0].mostDeclined).toBeNull();
    expect(r[0].newWeaknesses).toEqual([]);
    expect(r[0].improvingStreak).toBe(0);
    expect(r[0].peak).toEqual({ overall: 70, date: "2026-10-01" });
  });
});
