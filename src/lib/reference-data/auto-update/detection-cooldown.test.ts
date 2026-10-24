import { describe, expect, it } from "vitest";
import { COOLDOWN_MS, inCooldown, nextCooldown, summaryHas429 } from "../../../../scripts/detection-cooldown.mjs";

describe("上流の 429 のあとの待つ時間（2026-10-24）", () => {
  const now = Date.parse("2026-10-24T00:00:00Z");

  it("待つ時間の中だけ待つ。壊れた値・未設定は待たない。本人の detect-force は待たない", () => {
    const state = nextCooldown(now);
    expect(Date.parse(state.until) - now).toBe(COOLDOWN_MS);
    expect(inCooldown(state, now + 1000)).toBe(true);
    expect(inCooldown(state, now + COOLDOWN_MS)).toBe(false);
    expect(inCooldown(state, now + 1000, "detect-force")).toBe(false);
    expect(inCooldown(null, now)).toBe(false);
    expect(inCooldown({ until: "broken" }, now)).toBe(false);
  });

  it("検出の要約に http_429 があるときだけ記録する", () => {
    expect(summaryHas429({ overall: "fetch_stopped", reasons: ["world_player_cards:source_fetch:http_429"] })).toBe(true);
    expect(summaryHas429({ overall: "fetch_stopped", reasons: ["world_player_cards:source_fetch:http_503"] })).toBe(false);
    expect(summaryHas429(null)).toBe(false);
  });
});
