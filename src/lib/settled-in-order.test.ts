import { describe, it, expect } from "vitest";
import { settledInOrder } from "./settled-in-order";

const ok = <T,>(value: T): PromiseSettledResult<T> => ({ status: "fulfilled", value });
const ng = (reason: unknown): PromiseSettledResult<never> => ({ status: "rejected", reason });

describe("settledInOrder(並列照会を直列と同じ規則で解釈)", () => {
  it("すべて成功ならfailureなし・全結果を使える", () => {
    const s = settledInOrder([ok(1), ok(2), ok(3)]);
    expect(s.failure).toBeNull();
    expect([0, 1, 2].map(s.usable)).toEqual([true, true, true]);
  });

  it("照会順で最初の失敗を返す(時間的に先に失敗したものではない)", () => {
    const first = new Error("first");
    const s = settledInOrder([ok(1), ng(first), ng(new Error("second"))]);
    expect(s.failure?.reason).toBe(first);
  });

  it("最初の失敗より後の結果は、成功していても使わない(直列なら取得していない)", () => {
    const s = settledInOrder([ok(1), ng(new Error("x")), ok(3)]);
    expect([0, 1, 2].map(s.usable)).toEqual([true, false, false]);
  });

  it("先頭が失敗なら何も使わない", () => {
    const s = settledInOrder([ng("x"), ok(2)]);
    expect([0, 1].map(s.usable)).toEqual([false, false]);
  });
});
