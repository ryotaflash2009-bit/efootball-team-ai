import { describe, it, expect } from "vitest";
import { bestXiToSquad } from "./to-squad";
import type { BestXiBenchResult } from "./bench";
import type { BestXiCandidate, BestXiSelectionResult } from "./types";
import { getFormation } from "@/lib/squad/formations";

const cand = (id: string, buildId: string | null = null) =>
  ({ worldCardId: id, candidateKey: `${id}:${buildId ?? "base"}`, buildId, source: buildId ? "build" : "base" }) as unknown as BestXiCandidate;

describe("AIベストイレブンの結果からスカッドを作る（2026-10-11）", () => {
  it("フォーメーション・先発の枠・保存ビルド・控え（先発と重複なし）を写し、空きの枠は空のまま", () => {
    const f = getFormation("3-5-2");
    const [gk, lcb, , , dmf] = f.slots;
    const result = {
      formationId: "3-5-2",
      slots: [
        { slotId: gk.slotId, candidate: cand("100") },
        { slotId: lcb.slotId, candidate: cand("200", "build_a") },
        { slotId: dmf.slotId, candidate: cand("300") },
      ],
      unfilledSlots: [],
    } as unknown as BestXiSelectionResult;
    const bench = { entries: [{ candidate: cand("400", "build_b") }, { candidate: cand("300") }, { candidate: cand("500") }, { candidate: cand("500") }] } as unknown as BestXiBenchResult;
    const sq = bestXiToSquad(result, bench, "  AI Best XI  ");
    expect(sq.formationId).toBe("3-5-2");
    expect(sq.squadName).toBe("AI Best XI");
    expect(sq.slots).toHaveLength(11);
    const by = new Map(sq.slots.map((s) => [s.slotId, s]));
    expect(by.get(gk.slotId)).toMatchObject({ worldCardId: "100", savedBuildId: null });
    expect(by.get(lcb.slotId)).toMatchObject({ worldCardId: "200", savedBuildId: "build_a" });
    expect(by.get(dmf.slotId)).toMatchObject({ worldCardId: "300" });
    expect(sq.slots.filter((s) => s.worldCardId).length).toBe(3);
    expect(sq.substitutes.map((s) => [s.worldCardId, s.savedBuildId])).toEqual([["400", "build_b"], ["500", null]]);
    expect(new Set(sq.substitutes.map((s) => s.subId)).size).toBe(2);
    expect(sq.managerId).toBeNull();
  });
  it("控えなし（null）でも作れる・控えは最大 12 枚", () => {
    const result = { formationId: "4-3-3", slots: [], unfilledSlots: [] } as unknown as BestXiSelectionResult;
    expect(bestXiToSquad(result, null, "x").substitutes).toEqual([]);
    const many = { entries: Array.from({ length: 20 }, (_, i) => ({ candidate: cand(String(1000 + i)) })) } as unknown as BestXiBenchResult;
    expect(bestXiToSquad(result, many, "x").substitutes).toHaveLength(12);
  });
});
