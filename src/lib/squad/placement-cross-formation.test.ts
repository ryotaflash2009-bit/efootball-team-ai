import { describe, it, expect } from "vitest";
import { copyPlacement, mapFormationSlots, pastePlacementAcrossFormations } from "./placement-clipboard";
import { FORMATION_IDS, getFormation } from "./formations";
import { emptySquad } from "./squad-storage";
import type { StoredSquad } from "./types";

const at = (sq: StoredSquad, id: string) => sq.slots.find((s) => s.slotId === id)!;
const def = (fid: string, id: string) => getFormation(fid).slots.find((s) => s.slotId === id)!;

describe("違うフォーメーション間の枠の対応（NEW-41）", () => {
  it("全ての組み合わせで: 同じ役割の区分の中だけ・1 対 1・決定的", () => {
    for (const a of FORMATION_IDS) {
      for (const b of FORMATION_IDS) {
        const m = mapFormationSlots(a, b);
        expect(mapFormationSlots(a, b)).toEqual(m);
        expect(new Set(m.map((x) => x.from)).size).toBe(m.length);
        expect(new Set(m.map((x) => x.to)).size).toBe(m.length);
        for (const { from, to } of m) expect(def(a, from).role).toBe(def(b, to).role);
        // 対応の数 = 区分ごとの少ない方の数の合計
        const expected = (["GK", "DF", "MF", "FW"] as const).reduce(
          (n, r) => n + Math.min(getFormation(a).slots.filter((s) => s.role === r).length, getFormation(b).slots.filter((s) => s.role === r).length),
          0,
        );
        expect(m).toHaveLength(expected);
        if (a === b) for (const { from, to } of m) expect(from).toBe(to);
      }
    }
  });

  it("4-3-3 → 4-4-2: GK・4 人の DF はそれぞれ同じ側の枠に対応する", () => {
    const m = new Map(mapFormationSlots("4-3-3", "4-4-2").map((x) => [x.from, x.to]));
    expect(m.get("gk")).toBe("gk");
    for (const id of ["lb", "lcb", "rcb", "rb"]) {
      const to = m.get(id)!;
      expect(Math.sign(def("4-4-2", to).x - 50)).toBe(Math.sign(def("4-3-3", id).x - 50));
    }
  });
});

describe("違うフォーメーションへの貼り付け（NEW-41）", () => {
  function shifted(): StoredSquad {
    const sq = emptySquad("A", "4-3-3");
    // 左サイドバックを前へ 10・GK を後ろへ 2 動かす。上書きのロールも付ける。
    return {
      ...sq,
      slots: sq.slots.map((s) =>
        s.slotId === "lb"
          ? { ...s, x: def("4-3-3", "lb").x, y: def("4-3-3", "lb").y - 10, roleOverride: "LMF" }
          : s.slotId === "gk"
            ? { ...s, x: 50, y: 95 }
            : s,
      ),
    };
  }

  it("既定の位置からのずれを対応する枠の既定に足す・ロールの上書きは写さない・他の枠は既定のまま", () => {
    const clip = copyPlacement(shifted())!;
    const target = emptySquad("B", "4-4-2");
    const r = pastePlacementAcrossFormations(target, clip);
    if (!r.ok) throw new Error(r.reason);
    const to = new Map(mapFormationSlots("4-3-3", "4-4-2").map((x) => [x.from, x.to])).get("lb")!;
    expect(at(r.squad, to)).toMatchObject({ x: def("4-4-2", to).x, y: def("4-4-2", to).y - 10 });
    expect(at(r.squad, to).roleOverride ?? null).toBeNull();
    expect(at(r.squad, "gk")).toMatchObject({ x: 50, y: 95 });
    expect(r.changed).toBe(2);
    expect(r.mapped + r.unmatched).toBe(11);
    expect(r.squad.formationId).toBe("4-4-2");
  });

  it("同じフォーメーション・ずれが無い・壊れたクリップは貼らない", () => {
    const clip = copyPlacement(shifted())!;
    expect(pastePlacementAcrossFormations(emptySquad("C", "4-3-3"), clip)).toEqual({ ok: false, reason: "same_formation" });
    expect(pastePlacementAcrossFormations(emptySquad("D", "4-4-2"), copyPlacement(emptySquad("E", "4-3-3")))).toEqual({ ok: false, reason: "no_change" });
    expect(pastePlacementAcrossFormations(emptySquad("F", "4-4-2"), { ...clip, slots: [] })).toEqual({ ok: false, reason: "invalid_clipboard" });
  });

  it("座標は 0〜100 に収まる", () => {
    const sq = emptySquad("G", "4-3-3");
    const edge = { ...sq, slots: sq.slots.map((s) => ({ ...s, x: s.x ?? 0, y: 0 })) };
    for (const fid of FORMATION_IDS.filter((f) => f !== "4-3-3")) {
      const r = pastePlacementAcrossFormations(emptySquad("H", fid), copyPlacement({ ...edge, slots: edge.slots.map((s) => ({ ...s, x: 0, y: 0 })) }));
      if (!r.ok) continue;
      for (const s of r.squad.slots) {
        expect(s.x ?? 50).toBeGreaterThanOrEqual(0);
        expect(s.x ?? 50).toBeLessThanOrEqual(100);
        expect(s.y ?? 50).toBeGreaterThanOrEqual(0);
        expect(s.y ?? 50).toBeLessThanOrEqual(100);
      }
    }
  });
});
