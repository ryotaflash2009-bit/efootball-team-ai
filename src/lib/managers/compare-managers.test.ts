import { describe, expect, it } from "vitest";
import { compareManagers, MAX_COMPARED_MANAGERS, parseManagerIds } from "./compare-managers";
import type { ManagerDetail } from "./types";

const mgr = (id: number, prof: Partial<ManagerDetail["proficiencies"]>, boosters: ManagerDetail["boosters"] = [], extra: Partial<ManagerDetail> = {}): ManagerDetail => ({
  internalManagerId: id, source: "s", sourceManagerId: String(id), nameEn: `M${id}`, nameJa: null, teamName: null, nationality: null, age: null, releasedAt: "2026-09-01",
  proficiencies: { possessionGame: null, quickCounter: null, longBallCounter: null, outWide: null, longBall: null, overload: null, ...prof },
  managerRating: null, coachingAffinity: null, formation: "4-3-3", boosters, linkUpPlays: [], sourceUrl: "https://example.invalid", fetchedAt: null, ...extra,
} as ManagerDetail);
const boost = (statKey: string | null, delta: number, confirmed = true) => ({ statNameEn: statKey ?? "Unknown Stat", statKey, delta, rawValue: `+${delta}`, applicationCondition: null, confirmationStatus: confirmed ? "confirmed" : "provisional" }) as ManagerDetail["boosters"][number];

describe("監督の比較", () => {
  it("戦術の適性: 値を並べ、最も高い監督（同点は全員）を示す", () => {
    const r = compareManagers([mgr(1, { possessionGame: 88, quickCounter: 70 }), mgr(2, { possessionGame: 88, quickCounter: 85 }), mgr(3, { possessionGame: 60 })]);
    const pos = r.tactics.find((x) => x.key === "possessionGame")!;
    expect(pos.values).toEqual([88, 88, 60]);
    expect(pos.best).toEqual([0, 1]);
    const qc = r.tactics.find((x) => x.key === "quickCounter")!;
    expect(qc.values).toEqual([70, 85, null]);
    expect(qc.best).toEqual([1]);
    expect(r.tactics.find((x) => x.key === "overload")!.best).toEqual([]);
  });

  it("ブースター: 能力ごとに監督の上昇量と確認の状態・変換できない効果は名前のまま", () => {
    const r = compareManagers([mgr(1, {}, [boost("speed", 1), boost("speed", 1)]), mgr(2, {}, [boost("speed", 2, false), boost(null, 1)])]);
    expect(r.boosters.map((b) => b.key)).toEqual(["speed", "Unknown Stat"]);
    const speed = r.boosters.find((b) => b.key === "speed")!;
    expect(speed.cells).toEqual([{ delta: 2, confirmed: true }, { delta: 2, confirmed: false }]);
    expect(r.boosters.find((b) => b.key === "Unknown Stat")!.mapped).toBe(false);
  });

  it("そのほかの事実・最大 4 人", () => {
    const five = [1, 2, 3, 4, 5].map((i) => mgr(i, {}, [], { formation: i % 2 ? "4-3-3" : "3-5-2", linkUpPlays: Array.from({ length: i }, () => ({}) as never) }));
    const r = compareManagers(five);
    expect(r.managerIds).toHaveLength(MAX_COMPARED_MANAGERS);
    expect(r.formation).toEqual(["4-3-3", "3-5-2", "4-3-3", "3-5-2"]);
    expect(r.linkUpPlays).toEqual([1, 2, 3, 4]);
  });

  it("URL の ID: 数値だけ・重複なし・最大 4 件", () => {
    expect(parseManagerIds("65, 3,65,abc,-1,0,7,9,11")).toEqual([65, 3, 7, 9]);
    expect(parseManagerIds(null)).toEqual([]);
    expect(parseManagerIds("1.5,2")).toEqual([2]);
  });
});
