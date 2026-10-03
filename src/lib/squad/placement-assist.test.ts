import { describe, it, expect } from "vitest";
import { applyPlacementAssist, selectablePlacementIds, PLACEMENT_ASSIST_MIN_SELECTION } from "./placement-assist";
import { emptySquad } from "./squad-storage";
import { assignWorldCardToSlot } from "./assign";
import type { StoredSquad } from "./types";

function must(r: { ok: boolean; squad?: StoredSquad }): StoredSquad {
  if (!r.ok || !r.squad) throw new Error(JSON.stringify(r));
  return r.squad;
}

/** 4-3-3 に選手を入れ、座標を指定する。 */
function squadWith(pos: Record<string, [number, number, string?]>): StoredSquad {
  let sq = emptySquad("m", "4-3-3");
  let n = 1;
  for (const id of Object.keys(pos)) sq = must(assignWorldCardToSlot(sq, id, String(10000000000000 + n++)));
  return {
    ...sq,
    slots: sq.slots.map((s) => (pos[s.slotId] ? { ...s, x: pos[s.slotId][0], y: pos[s.slotId][1], roleOverride: pos[s.slotId][2] ?? null } : s)),
    captainSlotId: "cf",
    setPieces: { corners: "lwf", freeKicks: null, penalties: "cf" },
  };
}
const at = (sq: StoredSquad, id: string) => sq.slots.find((s) => s.slotId === id)!;

describe("applyPlacementAssist（F-036 配置補助の次候補）", () => {
  it("横一列に揃える: 選んだ選手の y を平均にそろえ、x は維持する", () => {
    const sq = squadWith({ lcb: [35, 80], rcb: [65, 84], lb: [12, 70] });
    const r = applyPlacementAssist(sq, ["lcb", "rcb"], "align_row");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(at(r.squad, "lcb")).toMatchObject({ x: 35, y: 82 });
    expect(at(r.squad, "rcb")).toMatchObject({ x: 65, y: 82 });
    expect(at(r.squad, "lb")).toMatchObject({ x: 12, y: 70 }); // 選んでいない選手は不変
    expect(r.changed).toBe(2);
  });

  it("縦一列に揃える: x を平均にそろえ、y は維持する", () => {
    const sq = squadWith({ dmf: [48, 60], cf: [53, 15] });
    const r = applyPlacementAssist(sq, ["dmf", "cf"], "align_column");
    if (!r.ok) throw new Error(r.reason);
    expect(at(r.squad, "dmf")).toMatchObject({ x: 50.5, y: 60 });
    expect(at(r.squad, "cf")).toMatchObject({ x: 50.5, y: 15 });
  });

  it("左右に均等: 両端を保ち、間を等間隔にする（入力の順に依存しない）", () => {
    const sq = squadWith({ lb: [10, 70], lcb: [40, 80], rcb: [45, 80], rb: [90, 70] });
    const a = applyPlacementAssist(sq, ["rb", "lcb", "lb", "rcb"], "distribute_x");
    const b = applyPlacementAssist(sq, ["lb", "lcb", "rcb", "rb"], "distribute_x");
    if (!a.ok || !b.ok) throw new Error("not ok");
    expect(["lb", "lcb", "rcb", "rb"].map((id) => at(a.squad, id).x)).toEqual([10, 36.7, 63.3, 90]);
    expect(["lb", "lcb", "rcb", "rb"].map((id) => at(a.squad, id).y)).toEqual([70, 80, 80, 70]);
    expect(a.squad.slots.map((s) => [s.x, s.y])).toEqual(b.squad.slots.map((s) => [s.x, s.y]));
  });

  it("上下に均等: y を等間隔にする", () => {
    const sq = squadWith({ cf: [50, 10], dmf: [50, 30], gk: [50, 90] });
    const r = applyPlacementAssist(sq, ["cf", "dmf", "gk"], "distribute_y");
    if (!r.ok) throw new Error(r.reason);
    expect(["cf", "dmf", "gk"].map((id) => at(r.squad, id).y)).toEqual([10, 50, 90]);
  });

  it("選択だけ左右反転: x → 100-x・左右ロールの上書きも反転・他の選手と設定は不変", () => {
    const sq = squadWith({ lwf: [16, 22, "LWF"], rwf: [84, 22, "RWF"], cf: [50, 15] });
    const r = applyPlacementAssist(sq, ["lwf"], "mirror_selected");
    if (!r.ok) throw new Error(r.reason);
    expect(at(r.squad, "lwf")).toMatchObject({ x: 84, y: 22, roleOverride: "RWF", worldCardId: at(sq, "lwf").worldCardId });
    expect(at(r.squad, "rwf")).toEqual(at(sq, "rwf"));
    expect(r.squad.captainSlotId).toBe("cf");
    expect(r.squad.setPieces).toEqual(sq.setPieces);
    expect(r.squad.substitutes).toEqual(sq.substitutes);
    // 2 回で元に戻る
    const back = applyPlacementAssist(r.squad, ["lwf"], "mirror_selected");
    if (!back.ok) throw new Error(back.reason);
    expect(at(back.squad, "lwf")).toMatchObject({ x: 16, y: 22, roleOverride: "LWF" });
  });

  it("空きスロット・存在しない ID・重複は対象外。選択が足りなければ too_few", () => {
    const sq = squadWith({ lcb: [35, 80], rcb: [65, 84] });
    expect(applyPlacementAssist(sq, ["lcb", "lcb", "nope", "gk"], "align_row")).toEqual({ ok: false, reason: "too_few" });
    expect(applyPlacementAssist(sq, ["lcb", "rcb"], "distribute_x")).toEqual({ ok: false, reason: "too_few" });
    expect(selectablePlacementIds(sq, ["rcb", "gk", "nope", "lcb"])).toEqual(["lcb", "rcb"]); // ピッチの表示順
    expect(PLACEMENT_ASSIST_MIN_SELECTION.mirror_selected).toBe(1);
  });

  it("すでに揃っていれば no_change（Undo の段を増やさない）", () => {
    const sq = squadWith({ lcb: [35, 80], rcb: [65, 80] });
    expect(applyPlacementAssist(sq, ["lcb", "rcb"], "align_row")).toEqual({ ok: false, reason: "no_change" });
  });

  it("座標は 0〜100 に収め、小数 1 桁に丸める。壊れた座標は既定へ", () => {
    const sq = squadWith({ lcb: [35, 80], rcb: [65, 81], lb: [12, 80] });
    const broken = { ...sq, slots: sq.slots.map((s) => (s.slotId === "lb" ? { ...s, y: Number.NaN } : s)) };
    const r = applyPlacementAssist(broken, ["lcb", "rcb", "lb"], "align_row");
    if (!r.ok) throw new Error(r.reason);
    for (const id of ["lcb", "rcb", "lb"]) {
      const y = at(r.squad, id).y!;
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      expect(Math.round(y * 10) / 10).toBe(y);
    }
    expect(applyPlacementAssist(null as unknown as StoredSquad, ["lcb"], "mirror_selected")).toEqual({ ok: false, reason: "invalid_squad" });
  });
});
