import { describe, it, expect } from "vitest";
import { applySquadMove, reorderBench, removeSquadPlayer, type SquadLoc } from "./moves";
import { emptySquad } from "./squad-storage";
import { assignWorldCardToSlot, addWorldCardToBench } from "./assign";
import type { StoredSquad } from "./types";

const A = "10000000000001";
const B = "10000000000002";
const C = "10000000000003";
const D = "10000000000004";

let subN = 0;
const mkSub = () => `sub_${(subN++).toString().padStart(8, "0")}`;

/** A=cf, B=lwf 先発 / C,D ベンチ のスカッドを作る。 */
function seed(): StoredSquad {
  let sq = emptySquad("t", "4-3-3");
  sq = must(assignWorldCardToSlot(sq, "cf", A));
  sq = must(assignWorldCardToSlot(sq, "lwf", B));
  sq = must(addWorldCardToBench(sq, C, mkSub));
  sq = must(addWorldCardToBench(sq, D, mkSub));
  return sq;
}
function must(r: { ok: boolean; squad?: StoredSquad }): StoredSquad {
  if (!r.ok || !r.squad) throw new Error("seed failed: " + JSON.stringify(r));
  return r.squad;
}
const starter = (slotId: string): SquadLoc => ({ area: "starter", slotId });
const bench = (index: number): SquadLoc => ({ area: "bench", index });
const wid = (sq: StoredSquad, slotId: string) => sq.slots.find((s) => s.slotId === slotId)?.worldCardId ?? null;
const subIds = (sq: StoredSquad) => sq.substitutes.map((s) => s.worldCardId);
const starterCount = (sq: StoredSquad) => sq.slots.filter((s) => s.worldCardId).length;

describe("applySquadMove", () => {
  it("先発 → 空き先発枠: 移動（人数不変・元枠は空・重複なし）", () => {
    const r = applySquadMove(seed(), starter("cf"), starter("rwf"), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "cf")).toBeNull();
    expect(wid(r.squad, "rwf")).toBe(A);
    expect(starterCount(r.squad)).toBe(2);
  });

  it("先発 → 先発（占有）: 入れ替え（両者保持・消失なし）", () => {
    const r = applySquadMove(seed(), starter("cf"), starter("lwf"), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "cf")).toBe(B);
    expect(wid(r.squad, "lwf")).toBe(A);
    expect(starterCount(r.squad)).toBe(2);
  });

  it("先発 → ベンチ末尾: 先発人数 -1 / ベンチ +1、カード設定を保持", () => {
    let sq = seed();
    // ビルド設定を付けてから移動
    sq = { ...sq, slots: sq.slots.map((s) => (s.slotId === "cf" ? { ...s, buildMode: "attack" as const, savedBuildId: "b_keep1" } : s)) };
    const r = applySquadMove(sq, starter("cf"), bench(sq.substitutes.length), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "cf")).toBeNull();
    expect(starterCount(r.squad)).toBe(1);
    expect(r.squad.substitutes).toHaveLength(3);
    const moved = r.squad.substitutes.at(-1)!;
    expect(moved.worldCardId).toBe(A);
    expect(moved.buildMode).toBe("attack");
    expect(moved.savedBuildId).toBe("b_keep1");
  });

  it("先発 → ベンチ（占有）: 交代（先発枠にベンチ選手・ベンチに元先発・消失なし）", () => {
    const sq = seed();
    const r = applySquadMove(sq, starter("cf"), bench(0), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "cf")).toBe(C); // bench[0] was C
    expect(r.squad.substitutes[0].worldCardId).toBe(A);
    expect(subIds(r.squad).sort()).toEqual([A, D].sort());
    expect(starterCount(r.squad)).toBe(2);
  });

  it("ベンチ → 空き先発枠: 昇格（ベンチから消え先発 +1）", () => {
    const r = applySquadMove(seed(), bench(0), starter("rwf"), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "rwf")).toBe(C);
    expect(subIds(r.squad)).toEqual([D]);
    expect(starterCount(r.squad)).toBe(3);
  });

  it("ベンチ → 先発（占有）: 交代", () => {
    const r = applySquadMove(seed(), bench(1), starter("cf"), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "cf")).toBe(D);
    expect(subIds(r.squad).sort()).toEqual([A, C].sort());
    expect(starterCount(r.squad)).toBe(2);
  });

  it("ベンチ → ベンチ: 並び替え", () => {
    const r = applySquadMove(seed(), bench(0), bench(1), mkSub);
    expect(r.ok).toBe(true);
    if (r.ok) expect(subIds(r.squad)).toEqual([D, C]);
  });

  it("同じ位置は same_location", () => {
    const r = applySquadMove(seed(), starter("cf"), starter("cf"), mkSub);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("same_location");
  });

  it("空の移動元は source_empty", () => {
    const r = applySquadMove(seed(), starter("rwf"), starter("rcmf"), mkSub);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("source_empty");
  });

  it("不正な移動先スロットは target_not_found", () => {
    const r = applySquadMove(seed(), starter("cf"), starter("nope"), mkSub);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("target_not_found");
  });

  it("ベンチ満員で 先発→ベンチ末尾 は bench_full", () => {
    let sq = emptySquad("full", "4-3-3");
    sq = must(assignWorldCardToSlot(sq, "cf", A));
    for (let i = 0; i < 12; i++) sq = must(addWorldCardToBench(sq, String(20_000_000 + i), mkSub));
    const r = applySquadMove(sq, starter("cf"), bench(sq.substitutes.length), mkSub);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("bench_full");
  });

  it("managerId / formation / squadId / name / 他スロットを保持", () => {
    let sq = seed();
    sq = { ...sq, managerId: 7 };
    const r = applySquadMove(sq, starter("cf"), starter("rwf"), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.squad.managerId).toBe(7);
    expect(r.squad.formationId).toBe("4-3-3");
    expect(r.squad.squadId).toBe(sq.squadId);
    expect(wid(r.squad, "lwf")).toBe(B);
  });

  it("キャプテンは先発移動に追従し、ベンチへ出ると解除＋警告", () => {
    let sq = seed();
    sq = { ...sq, captainSlotId: "cf" };
    const moved = applySquadMove(sq, starter("cf"), starter("rwf"), mkSub);
    expect(moved.ok && moved.squad.captainSlotId).toBe("rwf");

    const benched = applySquadMove(sq, starter("cf"), bench(sq.substitutes.length), mkSub);
    expect(benched.ok).toBe(true);
    if (!benched.ok) return;
    expect(benched.squad.captainSlotId).toBeNull();
    expect(benched.warnings.join()).toMatch(/キャプテン/);
  });

  it("入れ替えでキャプテンは相手スロットへ入れ替わる", () => {
    let sq = seed();
    sq = { ...sq, captainSlotId: "cf" };
    const r = applySquadMove(sq, starter("cf"), starter("lwf"), mkSub);
    expect(r.ok && r.squad.captainSlotId).toBe("lwf");
  });

  it("セットプレー担当がベンチへ出ると解除される", () => {
    let sq = seed();
    sq = { ...sq, setPieces: { corners: "cf", freeKicks: null, penalties: "cf" } };
    const r = applySquadMove(sq, starter("cf"), bench(0), mkSub);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.squad.setPieces.corners).toBeNull();
    expect(r.squad.setPieces.penalties).toBeNull();
  });
});

describe("reorderBench", () => {
  it("上へ / 下へ", () => {
    const sq = seed(); // bench [C, D]
    const up = reorderBench(sq, 1, 0);
    expect(up.ok && up.squad.substitutes.map((s) => s.worldCardId)).toEqual([D, C]);
    const down = reorderBench(sq, 0, 1);
    expect(down.ok && down.squad.substitutes.map((s) => s.worldCardId)).toEqual([D, C]);
  });
});

describe("removeSquadPlayer", () => {
  it("先発から外す（枠が空・人数 -1・キャプテン解除）", () => {
    let sq = seed();
    sq = { ...sq, captainSlotId: "cf" };
    const r = removeSquadPlayer(sq, starter("cf"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wid(r.squad, "cf")).toBeNull();
    expect(starterCount(r.squad)).toBe(1);
    expect(r.squad.captainSlotId).toBeNull();
  });

  it("ベンチから外す", () => {
    const r = removeSquadPlayer(seed(), bench(0));
    expect(r.ok && r.squad.substitutes.map((s) => s.worldCardId)).toEqual([D]);
  });

  it("空きスロットを外そうとすると source_empty", () => {
    const r = removeSquadPlayer(seed(), starter("rwf"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("source_empty");
  });

  it("お気に入り / My Team / 比較の情報はこの関数の対象外（squad 以外を返さない）", () => {
    const r = removeSquadPlayer(seed(), starter("cf"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r)).toEqual(expect.arrayContaining(["ok", "squad", "operation", "warnings"]));
  });
});
