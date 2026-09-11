import { describe, it, expect } from "vitest";
import {
  inferFreshRole,
  inferPlacementRole,
  clampCoord,
  roleZone,
  isPlacementRole,
  HYSTERESIS_MARGIN,
} from "./role-inference";

describe("inferFreshRole（座標 → 配置ロール）", () => {
  const cases: [number, number, string][] = [
    [85, 12, "RWF"], // 右・高い
    [85, 45, "RMF"], // 右・中盤
    [85, 72, "RB"], //  右・低い
    [15, 12, "LWF"], // 左・高い
    [15, 45, "LMF"], // 左・中盤
    [15, 72, "LB"], //  左・低い
    [50, 10, "CF"], //  中央・最前線
    [50, 22, "SS"], //  中央・CF の少し下
    [50, 33, "AMF"], // 中央・攻撃的中盤
    [50, 45, "CMF"], // 中央・中盤
    [50, 56, "DMF"], // 中央・守備的中盤
    [50, 74, "CB"], //  中央・最終ライン
    [50, 92, "GK"], //  ゴール前
    [10, 92, "GK"], //  端でも GK ゾーン
  ];
  for (const [x, y, expected] of cases) {
    it(`(${x}, ${y}) → ${expected}`, () => {
      expect(inferFreshRole(x, y)).toBe(expected);
    });
  }

  it("四隅・範囲外でもクラッシュせずロールを返す", () => {
    for (const [x, y] of [
      [0, 0],
      [100, 0],
      [0, 100],
      [100, 100],
      [-50, -50],
      [999, 999],
      [NaN, 10],
      [10, Infinity],
    ]) {
      expect(isPlacementRole(inferFreshRole(x, y))).toBe(true);
    }
  });
});

describe("clampCoord", () => {
  it("範囲内はそのまま / 範囲外は clamp / 非数は 50", () => {
    expect(clampCoord(42.5)).toBe(42.5);
    expect(clampCoord(-10)).toBe(0);
    expect(clampCoord(150)).toBe(100);
    expect(clampCoord(NaN)).toBe(50);
    expect(clampCoord(Infinity)).toBe(50);
    expect(clampCoord("abc")).toBe(50);
    expect(clampCoord(null)).toBe(50);
    expect(clampCoord("30")).toBe(30);
  });
});

describe("inferPlacementRole（ヒステリシス）", () => {
  it("previousRole の領域内をわずかに外れても previousRole を維持", () => {
    // RWF ゾーンの下端 y≈28、そこから 3 だけ下（境界内 + margin）
    const r = inferPlacementRole(85, 28 + 3, "RWF");
    expect(r.role).toBe("RWF");
    expect(r.keptPrevious).toBe(true);
    expect(r.fresh).toBe("RMF"); // ヒステリシス無しなら RMF
  });

  it("境界を HYSTERESIS_MARGIN より大きく超えたら切り替える", () => {
    const r = inferPlacementRole(85, 28 + HYSTERESIS_MARGIN + 5, "RWF");
    expect(r.role).toBe("RMF");
    expect(r.keptPrevious).toBe(false);
  });

  it("previousRole が無ければ fresh をそのまま返す", () => {
    const r = inferPlacementRole(85, 45, null);
    expect(r.role).toBe("RMF");
    expect(r.keptPrevious).toBe(false);
  });

  it("反対サイドへ大きく動かしたら維持しない", () => {
    const r = inferPlacementRole(15, 12, "RWF");
    expect(r.role).toBe("LWF");
  });

  it("CB を少し下げただけでは GK にならない（previous=CB）", () => {
    const r = inferPlacementRole(50, 82, "CB"); // GK ゾーンは y>=86
    expect(r.role).toBe("CB");
  });

  it("GK から少し上げても GK を維持（previous=GK）", () => {
    const r = inferPlacementRole(50, 83, "GK");
    expect(r.role).toBe("GK");
  });

  it("RWF ⇄ RMF 境界を行き来してもヒステリシスで安定", () => {
    let role: string = "RWF";
    // 境界近傍を小刻みに動かす
    for (const y of [27, 29, 28, 30, 27, 31]) {
      role = inferPlacementRole(85, y, role).role;
    }
    expect(role).toBe("RWF"); // 小さな揺れでは変わらない
  });
});

describe("roleZone", () => {
  it("全ロールが有限の矩形を返す", () => {
    for (const role of [
      "GK",
      "LB",
      "CB",
      "RB",
      "LMF",
      "RMF",
      "DMF",
      "CMF",
      "AMF",
      "LWF",
      "RWF",
      "SS",
      "CF",
    ] as const) {
      const z = roleZone(role);
      expect(z.xMin).toBeLessThan(z.xMax);
      expect(z.yMin).toBeLessThan(z.yMax);
    }
  });
});
