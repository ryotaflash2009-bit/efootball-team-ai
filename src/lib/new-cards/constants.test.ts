import { describe, expect, it } from "vitest";
import { isRecentlyAdded, officialStaleDays } from "./constants";

describe("新しいカードの期間と、正式なデータの取り込みの遅れ（2026-10-24）", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  it("最近 7 日に追加されたか", () => {
    expect(isRecentlyAdded("2026-10-18T12:00:01Z", now)).toBe(true);
    expect(isRecentlyAdded("2026-10-17T12:00:00Z", now)).toBe(false);
    expect(isRecentlyAdded(null, now)).toBe(false);
  });
  it("最後の取り込みから 7 日以上・その後に暫定のカードがあるときだけ日数を返す", () => {
    expect(officialStaleDays("2026-10-16T10:13:29Z", "2026-10-23T21:35:00Z", now)).toBe(8);
    expect(officialStaleDays("2026-10-17T10:00:00Z", "2026-10-23T21:35:00Z", now)).toBe(7);
    expect(officialStaleDays("2026-10-18T13:00:00Z", "2026-10-23T21:35:00Z", now)).toBeNull();
    // 静かな週（暫定のカードが無い・または取り込みより前）は止まっていない
    expect(officialStaleDays("2026-10-16T10:13:29Z", null, now)).toBeNull();
    expect(officialStaleDays("2026-10-16T10:13:29Z", "2026-10-15T00:00:00Z", now)).toBeNull();
    expect(officialStaleDays(null, "2026-10-23T21:35:00Z", now)).toBeNull();
  });
});
