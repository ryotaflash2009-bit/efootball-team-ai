import { describe, it, expect } from "vitest";
import { copyPlacement, parsePlacementClipboard, pastePlacement, canPastePlacement, PLACEMENT_CLIPBOARD_VERSION } from "./placement-clipboard";
import { emptySquad } from "./squad-storage";
import { assignWorldCardToSlot } from "./assign";
import type { StoredSquad } from "./types";

function must(r: { ok: boolean; squad?: StoredSquad }): StoredSquad {
  if (!r.ok || !r.squad) throw new Error(JSON.stringify(r));
  return r.squad;
}
const at = (sq: StoredSquad, id: string) => sq.slots.find((s) => s.slotId === id)!;

function source(): StoredSquad {
  let sq = must(assignWorldCardToSlot(emptySquad("A", "4-3-3"), "lwf", "10000000000001"));
  sq = must(assignWorldCardToSlot(sq, "cf", "10000000000002"));
  return {
    ...sq,
    slots: sq.slots.map((s) =>
      s.slotId === "lwf" ? { ...s, x: 12.34, y: 20, roleOverride: "LMF" } : s.slotId === "gk" ? { ...s, x: 50, y: 95 } : s,
    ),
  };
}

describe("配置のコピー／貼り付け（同じフォーメーションの間だけ）", () => {
  it("コピーは枠の座標と配置ロールの上書きだけ（選手は含めない）・小数 1 桁", () => {
    const clip = copyPlacement(source())!;
    expect(clip.version).toBe(PLACEMENT_CLIPBOARD_VERSION);
    expect(clip.formationId).toBe("4-3-3");
    expect(clip.slots).toHaveLength(11);
    expect(clip.slots.find((s) => s.slotId === "lwf")).toEqual({ slotId: "lwf", x: 12.3, y: 20, roleOverride: "LMF" });
    expect(JSON.stringify(clip)).not.toContain("10000000000001");
  });

  it("同じフォーメーションの別スカッドへ貼り付けると、座標と上書きが写り、選手・設定は変わらない", () => {
    const clip = copyPlacement(source())!;
    let target = must(assignWorldCardToSlot(emptySquad("B", "4-3-3"), "lwf", "10000000000009"));
    target = { ...target, captainSlotId: "lwf" };
    const r = pastePlacement(target, clip);
    if (!r.ok) throw new Error(r.reason);
    expect(at(r.squad, "lwf")).toMatchObject({ x: 12.3, y: 20, roleOverride: "LMF", worldCardId: "10000000000009" });
    expect(at(r.squad, "gk")).toMatchObject({ x: 50, y: 95, roleOverride: null });
    expect(r.squad.captainSlotId).toBe("lwf");
    expect(r.squad.squadName).toBe("B");
  });

  it("選手がいない枠には配置ロールの上書きを写さない（保存時の正規化と同じ）", () => {
    const clip = copyPlacement(source())!;
    const r = pastePlacement(emptySquad("C", "4-3-3"), clip);
    if (!r.ok) throw new Error(r.reason);
    expect(at(r.squad, "lwf")).toMatchObject({ x: 12.3, y: 20, roleOverride: null });
  });

  it("違うフォーメーションへは貼り付けない（枠を推測で対応させない）", () => {
    const clip = copyPlacement(source())!;
    const other = emptySquad("D", "4-4-2");
    expect(canPastePlacement(other, clip)).toBe(false);
    expect(pastePlacement(other, clip)).toEqual({ ok: false, reason: "formation_mismatch" });
  });

  it("同じ配置なら no_change・壊れた／改ざんされた値は invalid_clipboard", () => {
    const clip = copyPlacement(source())!;
    const once = pastePlacement(emptySquad("E", "4-3-3"), clip);
    if (!once.ok) throw new Error(once.reason);
    const twice = pastePlacement(once.squad, clip); // 2 回目は変化なし（Undo の段を増やさない）
    expect(twice.ok ? "changed" : twice.reason).toBe("no_change");
    const sq = once.squad;
    const bad = (mut: (c: Record<string, unknown>) => void) => {
      const c = JSON.parse(JSON.stringify(clip));
      mut(c);
      return parsePlacementClipboard(c);
    };
    expect(bad((c) => (c.version = "x"))).toBeNull();
    expect(bad((c) => ((c.slots as { x: number }[])[0].x = 120))).toBeNull();
    expect(bad((c) => ((c.slots as { slotId: string }[])[1].slotId = (c.slots as { slotId: string }[])[0].slotId))).toBeNull();
    expect(bad((c) => (c.slots as unknown[]).pop())).toBeNull();
    expect(bad((c) => ((c.slots as { roleOverride: string }[])[0].roleOverride = "<script>"))).toBeNull();
    expect(bad((c) => (c.formationId = "9-9-9"))).toBeNull();
    expect(parsePlacementClipboard(null)).toBeNull();
    expect(pastePlacement(sq, null)).toEqual({ ok: false, reason: "invalid_clipboard" });
  });
});
