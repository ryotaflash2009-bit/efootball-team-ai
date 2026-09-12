import { describe, it, expect } from "vitest";
import { getRemainingCooldownSeconds, canResendNow, RESEND_COOLDOWN_SECONDS } from "./resend-cooldown";

describe("getRemainingCooldownSeconds", () => {
  it("一度も送信していない(null)場合は残り0秒", () => {
    expect(getRemainingCooldownSeconds(null, Date.now())).toBe(0);
  });

  it("送信直後は残りがRESEND_COOLDOWN_SECONDSに近い", () => {
    const now = 1_000_000;
    expect(getRemainingCooldownSeconds(now, now)).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it("30秒経過時点では残り30秒", () => {
    const sentAt = 1_000_000;
    const now = sentAt + 30_000;
    expect(getRemainingCooldownSeconds(sentAt, now)).toBe(RESEND_COOLDOWN_SECONDS - 30);
  });

  it(`${RESEND_COOLDOWN_SECONDS}秒以上経過したら残り0秒`, () => {
    const sentAt = 1_000_000;
    const now = sentAt + RESEND_COOLDOWN_SECONDS * 1000;
    expect(getRemainingCooldownSeconds(sentAt, now)).toBe(0);
  });

  it("経過時間が待機時間を大きく超えても負の値にならない", () => {
    const sentAt = 1_000_000;
    const now = sentAt + 10 * 60 * 1000;
    expect(getRemainingCooldownSeconds(sentAt, now)).toBe(0);
  });
});

describe("canResendNow", () => {
  it("一度も送信していない場合は送信可能", () => {
    expect(canResendNow(null, Date.now())).toBe(true);
  });

  it("待機時間中は送信不可", () => {
    const sentAt = 1_000_000;
    expect(canResendNow(sentAt, sentAt + 1000)).toBe(false);
  });

  it("待機時間経過後は送信可能", () => {
    const sentAt = 1_000_000;
    expect(canResendNow(sentAt, sentAt + RESEND_COOLDOWN_SECONDS * 1000)).toBe(true);
  });
});
