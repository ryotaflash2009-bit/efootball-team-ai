import { describe, it, expect } from "vitest";
import {
  calculateSnapCandidate,
  mirrorRole,
  DEFAULT_SNAP_SETTINGS,
  SNAP_DIST_X,
  SNAP_DIST_Y,
  type PlacementRef,
  type SnapSettings,
} from "./position-snapping";
import { mirrorSquadPositions } from "./moves";
import { emptySquad } from "./squad-storage";
import { assignWorldCardToSlot } from "./assign";
import type { StoredSquad } from "./types";

const OFF: SnapSettings = { enabled: false, snapToLines: true, snapToCenter: true, snapToSymmetry: true };
const call = (
  x: number,
  y: number,
  others: PlacementRef[] = [],
  settings = DEFAULT_SNAP_SETTINGS,
  disableSnap = false,
) =>
  calculateSnapCandidate({
    movingSlotId: "m",
    proposedX: x,
    proposedY: y,
    existingPlacements: others,
    settings,
    disableSnap,
  });

describe("calculateSnapCandidate", () => {
  it("スナップ無効なら生座標を維持", () => {
    const r = call(48, 20, [{ slotId: "a", x: 50, y: 20 }], OFF);
    expect(r.x).toBe(48);
    expect(r.snapApplied).toBe(false);
  });

  it("修飾キーで一時無効化しても生座標", () => {
    const r = call(48, 20, [], DEFAULT_SNAP_SETTINGS, true);
    expect(r.x).toBe(48);
    expect(r.snapApplied).toBe(false);
  });

  it("中央線: x=50 付近はスナップ、離れていればしない", () => {
    expect(call(48, 30).x).toBe(50);
    expect(call(48, 30).snapTypes).toContain("center");
    expect(call(50 - SNAP_DIST_X - 3, 30).x).toBeCloseTo(50 - SNAP_DIST_X - 3);
  });

  it("水平ライン: 近くの選手と同じ y へ（横に十分離れていれば）", () => {
    const others: PlacementRef[] = [
      { slotId: "cbL", x: 38, y: 77 },
      { slotId: "cbR", x: 62, y: 77 },
    ];
    const r = call(20, 75, others);
    expect(r.y).toBeCloseTo(77, 1);
    expect(r.snapTypes).toContain("horizontal");
    expect(r.guides.some((g) => g.kind === "horizontal")).toBe(true);
  });

  it("水平ライン: 横に近すぎる相手には吸着しない", () => {
    const r = call(40, 75, [{ slotId: "x", x: 42, y: 77 }]);
    // x 差 2 < SNAP_MIN_X_SEPARATION → ライン扱いにしない
    expect(r.snapTypes).not.toContain("horizontal");
  });

  it("水平ライン: y が閾値外ならスナップしない", () => {
    const r = call(20, 60, [{ slotId: "a", x: 50, y: 77 }]);
    expect(r.snapTypes).not.toContain("horizontal");
  });

  it("左右対称: 参照選手の鏡像付近へスナップ（y は参照に一致）", () => {
    const others: PlacementRef[] = [{ slotId: "lwf", x: 16, y: 22 }];
    const r = call(100 - 16 + 1, 23, others); // 鏡像 (84,22) の近く
    expect(r.x).toBeCloseTo(84, 1);
    expect(r.y).toBeCloseTo(22, 1);
    expect(r.snapTypes).toContain("symmetry");
  });

  it("左右対称: 中央線上の選手は対称候補にしない", () => {
    const r = call(52, 30, [{ slotId: "cf", x: 50, y: 15 }]);
    expect(r.snapTypes).not.toContain("symmetry");
  });

  it("不正入力（NaN / Infinity / 範囲外）でも安全に clamp", () => {
    expect(call(NaN, 20).x).toBe(50);
    expect(call(20, Infinity).y).toBe(50);
    expect(call(-30, 200).x).toBe(0);
    expect(call(-30, 200).y).toBe(100);
  });

  it("0 / 100 端でもクラッシュしない", () => {
    expect(() => call(0, 0)).not.toThrow();
    expect(() => call(100, 100)).not.toThrow();
  });

  it("移動中の選手自身は参照から除外", () => {
    const r = calculateSnapCandidate({
      movingSlotId: "m",
      proposedX: 20,
      proposedY: 75,
      existingPlacements: [{ slotId: "m", x: 20, y: 77 }],
      settings: DEFAULT_SNAP_SETTINGS,
    });
    expect(r.snapTypes).not.toContain("horizontal");
  });

  it("生座標 rawX/rawY を保持（表示用）", () => {
    const r = call(48, 20, [{ slotId: "a", x: 50, y: 20 }]);
    expect(r.rawX).toBe(48);
    expect(r.rawY).toBe(20);
  });

  it("guides は SNAP_DIST_Y を超えても「近い」範囲では返る（表示は呼び出し側が判断）", () => {
    const r = call(20, 77 + SNAP_DIST_Y + 1, [{ slotId: "a", x: 50, y: 77 }]); // 差 4.5 > 3.5, < 6
    expect(r.snapTypes).not.toContain("horizontal");
    expect(r.guides.some((g) => g.kind === "horizontal")).toBe(true);
  });
});

describe("mirrorRole", () => {
  it("左右ロールは反対側・中央ロールは維持", () => {
    expect(mirrorRole("LWF")).toBe("RWF");
    expect(mirrorRole("RMF")).toBe("LMF");
    expect(mirrorRole("LB")).toBe("RB");
    for (const c of ["CF", "SS", "AMF", "CMF", "DMF", "CB", "GK"]) expect(mirrorRole(c)).toBe(c);
    expect(mirrorRole(null)).toBeNull();
  });
});

function must(r: { ok: boolean; squad?: StoredSquad }): StoredSquad {
  if (!r.ok || !r.squad) throw new Error(JSON.stringify(r));
  return r.squad;
}

describe("mirrorSquadPositions", () => {
  it("x → 100-x・y 維持・左右ロール変換・その他は不変", () => {
    let sq = emptySquad("m", "4-3-3");
    sq = must(assignWorldCardToSlot(sq, "lwf", "10000000000001"));
    sq = must(assignWorldCardToSlot(sq, "cf", "10000000000002"));
    sq = {
      ...sq,
      slots: sq.slots.map((s) =>
        s.slotId === "lwf"
          ? { ...s, x: 16, y: 22, roleOverride: "LWF" }
          : s.slotId === "cf"
            ? { ...s, x: 50, y: 15, roleOverride: "SS" }
            : s,
      ),
      captainSlotId: "cf",
      setPieces: { corners: "lwf", freeKicks: null, penalties: "cf" },
    };
    const r = mirrorSquadPositions(sq);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lwf = r.squad.slots.find((s) => s.slotId === "lwf")!;
    expect(lwf.x).toBe(84);
    expect(lwf.y).toBe(22);
    expect(lwf.roleOverride).toBe("RWF");
    expect(lwf.worldCardId).toBe("10000000000001"); // 選手は動かない
    const cf = r.squad.slots.find((s) => s.slotId === "cf")!;
    expect(cf.x).toBe(50);
    expect(cf.roleOverride).toBe("SS"); // 中央ロールは維持
    expect(r.squad.captainSlotId).toBe("cf");
    expect(r.squad.setPieces.corners).toBe("lwf"); // slotId 参照のまま
  });

  it("2 回反転で元へ戻る", () => {
    let sq = emptySquad("m2", "4-3-3");
    sq = must(assignWorldCardToSlot(sq, "rb", "10000000000003"));
    sq = { ...sq, slots: sq.slots.map((s) => (s.slotId === "rb" ? { ...s, x: 85, y: 72 } : s)) };
    const once = must(mirrorSquadPositions(sq));
    const twice = must(mirrorSquadPositions(once));
    const rb = twice.slots.find((s) => s.slotId === "rb")!;
    expect(rb.x).toBe(85);
    expect(rb.y).toBe(72);
  });
});
