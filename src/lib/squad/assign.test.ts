import { describe, it, expect } from "vitest";
import { assignWorldCardToSlot, addWorldCardToBench } from "./assign";
import { emptySquad } from "./squad-storage";
import { getFormation } from "./formations";
import { MAX_SUBSTITUTES } from "./types";

const MESSI = "89138556575063";
const CANNAVARO = "88041460996837";
// 20 桁ちょうど（Number 化すると精度が壊れる大きさ）
const BIG_ID = "12345678901234567890";

function base() {
  return emptySquad("テスト", "4-3-3");
}
const CF = "cf";
const GK = "gk";

describe("assignWorldCardToSlot（純関数・単一実装）", () => {
  it("空きスロットへ配置できる・worldCardId は文字列のまま", () => {
    const r = assignWorldCardToSlot(base(), CF, MESSI);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const slot = r.squad.slots.find((s) => s.slotId === CF)!;
    expect(slot.worldCardId).toBe(MESSI);
    expect(typeof slot.worldCardId).toBe("string");
    expect(slot.buildMode).toBe("none");
    expect(slot.savedBuildId).toBeNull();
  });

  it("20 桁の worldCardId が精度欠落せずそのまま入る", () => {
    const r = assignWorldCardToSlot(base(), CF, BIG_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.squad.slots.find((s) => s.slotId === CF)!.worldCardId).toBe(BIG_ID);
  });

  it("追加対象以外のスロット・監督・比較・ベンチ・条件設定を保持する", () => {
    let sq = base();
    sq = { ...sq, managerId: 42, captainSlotId: null };
    const r1 = assignWorldCardToSlot(sq, GK, CANNAVARO);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = assignWorldCardToSlot(r1.squad, CF, MESSI);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.squad.managerId).toBe(42);
    expect(r2.squad.slots.find((s) => s.slotId === GK)!.worldCardId).toBe(CANNAVARO);
    expect(r2.squad.slots.find((s) => s.slotId === CF)!.worldCardId).toBe(MESSI);
    expect(r2.squad.squadId).toBe(sq.squadId);
  });

  it("同一 worldCardId の重複配置を拒否", () => {
    const r1 = assignWorldCardToSlot(base(), CF, MESSI);
    if (!r1.ok) throw new Error();
    const r2 = assignWorldCardToSlot(r1.squad, GK, MESSI);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errorCode).toBe("duplicate_not_allowed");
  });

  it("同一人物でも別 worldCardId は追加できる", () => {
    const r1 = assignWorldCardToSlot(base(), CF, MESSI);
    if (!r1.ok) throw new Error();
    const r2 = assignWorldCardToSlot(r1.squad, "lwf", CANNAVARO);
    expect(r2.ok).toBe(true);
  });

  it("埋まっているスロットは上書きしない", () => {
    const r1 = assignWorldCardToSlot(base(), CF, MESSI);
    if (!r1.ok) throw new Error();
    const r2 = assignWorldCardToSlot(r1.squad, CF, CANNAVARO);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errorCode).toBe("slot_occupied");
  });

  it("同じスロットへ同じカードを再配置は no-op で成功", () => {
    const r1 = assignWorldCardToSlot(base(), CF, MESSI);
    if (!r1.ok) throw new Error();
    const r2 = assignWorldCardToSlot(r1.squad, CF, MESSI);
    expect(r2.ok).toBe(true);
  });

  it("不正な worldCardId は拒否（英字・空・21桁・number）", () => {
    for (const bad of ["abc", "", "1".repeat(21), "1.5", "-1"]) {
      const r = assignWorldCardToSlot(base(), CF, bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errorCode).toBe("invalid_world_card_id");
    }
    // number として渡された異常入力
    const r = assignWorldCardToSlot(base(), CF, 89138556575063 as unknown as string);
    expect(r.ok).toBe(false);
  });

  it("存在しない slotId は拒否", () => {
    const r = assignWorldCardToSlot(base(), "not-a-slot", MESSI);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("invalid_slot_id");
  });

  it("現在フォーメーションの全スロット ID が受理される", () => {
    for (const fs of getFormation("4-3-3").slots) {
      const r = assignWorldCardToSlot(base(), fs.slotId, MESSI);
      expect(r.ok).toBe(true);
    }
  });
});

describe("addWorldCardToBench", () => {
  let n = 0;
  const mkId = () => `sub_${(n++).toString().padStart(6, "0")}aaaa`;

  it("ベンチへ追加できる", () => {
    const r = addWorldCardToBench(base(), MESSI, mkId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.squad.substitutes.at(-1)!.worldCardId).toBe(MESSI);
  });

  it("先発にいるカードはベンチへ追加しない", () => {
    const r1 = assignWorldCardToSlot(base(), CF, MESSI);
    if (!r1.ok) throw new Error();
    const r2 = addWorldCardToBench(r1.squad, MESSI, mkId);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errorCode).toBe("duplicate_not_allowed");
  });

  it("ベンチ満員なら拒否", () => {
    let sq = base();
    for (let i = 0; i < MAX_SUBSTITUTES; i++) {
      const r = addWorldCardToBench(sq, String(10_000_000 + i), mkId);
      if (!r.ok) throw new Error();
      sq = r.squad;
    }
    const r = addWorldCardToBench(sq, MESSI, mkId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("bench_full");
  });

  it("不正 worldCardId は拒否", () => {
    expect(addWorldCardToBench(base(), "nope", mkId).ok).toBe(false);
  });
});
