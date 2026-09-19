import { describe, it, expect } from "vitest";
import { InMemoryLockAdapter, lockKeyForTable } from "./lock";

describe("lockKeyForTable", () => {
  it("同じテーブル名なら同じkeyを返す(決定的)", () => {
    expect(lockKeyForTable("world_player_cards")).toBe(lockKeyForTable("world_player_cards"));
  });
  it("異なるテーブル名なら異なるkeyを返す(衝突しにくい)", () => {
    expect(lockKeyForTable("world_player_cards")).not.toBe(lockKeyForTable("managers"));
  });
  it("64bit符号なし整数の範囲内(pg_try_advisory_xact_lockのbigint引数に収まる)", () => {
    const key = lockKeyForTable("world_player_cards");
    expect(key).toBeGreaterThanOrEqual(0n);
    expect(key).toBeLessThan(2n ** 63n);
  });
});

describe("InMemoryLockAdapter", () => {
  it("未取得のkeyは取得できる", async () => {
    const lock = new InMemoryLockAdapter();
    expect(await lock.tryAcquire("k1")).toBe(true);
  });

  it("取得済みのkeyへの再取得は失敗する(待機しない、即座にfalse)", async () => {
    const lock = new InMemoryLockAdapter();
    await lock.tryAcquire("k1");
    expect(await lock.tryAcquire("k1")).toBe(false);
  });

  it("releaseすれば再取得できる", async () => {
    const lock = new InMemoryLockAdapter();
    await lock.tryAcquire("k1");
    await lock.release("k1");
    expect(await lock.tryAcquire("k1")).toBe(true);
  });

  it("異なるkeyは独立に取得できる", async () => {
    const lock = new InMemoryLockAdapter();
    expect(await lock.tryAcquire("k1")).toBe(true);
    expect(await lock.tryAcquire("k2")).toBe(true);
  });
});
