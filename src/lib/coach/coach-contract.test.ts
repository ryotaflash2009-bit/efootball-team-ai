import { describe, expect, it } from "vitest";
import { askCoach, DEFAULT_COACH_LIMITS, minimizeContext, ruleBasedCoach, type CoachProvider } from "./coach-contract";

const raw = { rulesVersion: "v1", overall: 70, categories: { attack: 80, defense: 55, speed: 70, playerName: 99 }, weaknesses: ["defense"], formationId: "4-3-3", managerTactics: { quickCounter: 80 }, locale: "es", squadLabel: "Mi equipo", email: "x@example.test", note: "free text" };

describe("AI コーチの契約（提供元に依存しない）", () => {
  it("送る文脈は最小（名前・メール・自由記述・不明な項目を落とす）", () => {
    const ctx = minimizeContext(raw)!;
    const json = JSON.stringify(ctx);
    for (const leaked of ["Mi equipo", "x@example.test", "free text", "playerName"]) expect(json).not.toContain(leaked);
    expect(ctx.categories).toEqual({ attack: 80, defense: 55, speed: 70 });
    expect(ctx.locale).toBe("es");
  });

  it("大きすぎる文脈は送らない", () => {
    expect(minimizeContext(raw, { ...DEFAULT_COACH_LIMITS, maxContextBytes: 50 })).toBeNull();
  });

  it("規則の提供元: 事実・推測・提案を分け、出典（カテゴリ・規則の版）を付ける・決定的", async () => {
    const ctx = minimizeContext(raw)!;
    const a = await ruleBasedCoach.answer(ctx, "top_priority");
    expect(a.statements.map((s) => s.kind)).toEqual(["fact", "suggestion"]);
    expect(a.statements[0]).toEqual({ kind: "fact", text: "weakest:defense=55", sources: ["category:defense", "rules:v1"] });
    expect(await ruleBasedCoach.answer(ctx, "top_priority")).toEqual(a);
    const why = await ruleBasedCoach.answer(ctx, "why_weak");
    expect(why.statements[1]).toMatchObject({ kind: "inference", text: "gap_to_strongest:attack=25" });
  });

  it("上限: 1 日の回数・費用の上限を超えたら呼ばない", async () => {
    const ctx = minimizeContext(raw)!;
    expect(await askCoach(ruleBasedCoach, ctx, "next_step", { requestsToday: DEFAULT_COACH_LIMITS.dailyRequests })).toEqual({ ok: false, problem: "daily_limit" });
    const paid: CoachProvider = { id: "paid", estimateCostYen: () => 3, answer: async () => ({ provider: "paid", statements: [] }) };
    expect(await askCoach(paid, ctx, "next_step", { requestsToday: 0 })).toEqual({ ok: false, problem: "cost_limit" });
    expect((await askCoach(ruleBasedCoach, ctx, "next_step", { requestsToday: 0 })).ok).toBe(true);
  });

  it("時間切れ・失敗は再試行の回数まで・その後は理由つきで失敗", async () => {
    const ctx = minimizeContext(raw)!;
    let calls = 0;
    const flaky: CoachProvider = { id: "flaky", estimateCostYen: () => 0, answer: async () => { calls++; throw new Error("boom"); } };
    expect(await askCoach(flaky, ctx, "next_step", { requestsToday: 0 })).toEqual({ ok: false, problem: "provider_error" });
    expect(calls).toBe(DEFAULT_COACH_LIMITS.maxRetries + 1);
    const slow: CoachProvider = { id: "slow", estimateCostYen: () => 0, answer: () => new Promise((r) => setTimeout(() => r({ provider: "slow", statements: [] }), 50)) };
    expect(await askCoach(slow, ctx, "next_step", { requestsToday: 0 }, { ...DEFAULT_COACH_LIMITS, timeoutMs: 5, maxRetries: 0 })).toEqual({ ok: false, problem: "timeout" });
  });
});
