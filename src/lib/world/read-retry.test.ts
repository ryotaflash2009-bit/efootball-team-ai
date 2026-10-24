import { describe, expect, it, vi } from "vitest";
import { readWithRetry } from "./repository";
import { WorldDataUnavailableError, WorldQueryError } from "./db";

describe("Supabase の読み取りの読み直し（2026-10-24）", () => {
  it("一時的な失敗（WorldQueryError）は 1 回だけ読み直す", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new WorldQueryError()).mockResolvedValueOnce("ok");
    await expect(readWithRetry(fn, 0)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("2 回とも失敗したら投げる・データが無い（WorldDataUnavailableError）は読み直さない", async () => {
    const twice = vi.fn().mockRejectedValue(new WorldQueryError());
    await expect(readWithRetry(twice, 0)).rejects.toBeInstanceOf(WorldQueryError);
    expect(twice).toHaveBeenCalledTimes(2);
    const unavailable = vi.fn().mockRejectedValue(new WorldDataUnavailableError());
    await expect(readWithRetry(unavailable, 0)).rejects.toBeInstanceOf(WorldDataUnavailableError);
    expect(unavailable).toHaveBeenCalledTimes(1);
  });
});
