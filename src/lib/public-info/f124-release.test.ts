import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateF124, F124_CHECKS, F124_RELEASE_VERDICT, F124_REQUIRED_PROHIBITIONS } from "../../../scripts/lib/f124-release.mjs";

const all = () => Object.fromEntries(Object.values(F124_CHECKS).flat().map((k) => [k, true]));
const ev = { planRunId: "1", backupRunId: "2", dryRunRunId: "3", applyRunId: "4" };

describe("F-124 Release Validator", () => {
  it("A・B・C と run id の根拠がそろったときだけ本人の判断へ進める（自動では開かない）", () => {
    expect(evaluateF124({ checks: all(), evidence: ev })).toMatchObject({ verdict: "F124_READY_FOR_OWNER_DECISION", parts: { A: { ok: true }, B: { ok: true }, C: { ok: true } } });
  });

  it("どれか 1 つ欠ければ HOLD で、欠けた項目を部分ごとに返す", () => {
    const r = evaluateF124({ checks: { ...all(), automationSecretNames9: false }, evidence: ev });
    expect(r).toMatchObject({ verdict: "F124_HOLD", parts: { A: { ok: true }, B: { ok: false, missing: ["automationSecretNames9"] }, C: { ok: true } } });
  });

  it("C は申告だけでは足りない（run id が無ければ HOLD）", () => {
    expect(evaluateF124({ checks: all(), evidence: { applyRunId: "4" } })).toMatchObject({ verdict: "F124_HOLD", parts: { C: { ok: false, missing: ["evidence.planRunId", "evidence.backupRunId", "evidence.dryRunRunId"] } } });
  });

  it("Secret・接続文字列・メールアドレスらしき値や未知の項目は BLOCKED", () => {
    expect(evaluateF124({ checks: all(), evidence: { ...ev, note: "postgres://u:p@h/db" } }).verdict).toBe("F124_BLOCKED");
    expect(evaluateF124({ checks: all(), evidence: { ...ev, who: "a@example.com" } }).verdict).toBe("F124_BLOCKED");
    expect(evaluateF124({ checks: { ...all(), openSignup: true }, evidence: ev }).problems).toContain("unknown_check:openSignup");
    expect(evaluateF124(null).verdict).toBe("F124_BLOCKED");
  });

  it("本人の判断の記録は、A・B・C が揃い、禁止の範囲がすべて残っているときだけ有効（このコードは判断を作らない）", () => {
    const decision = { verdict: F124_RELEASE_VERDICT, decidedBy: "owner", date: "2026-10-03", stillProhibited: [...F124_REQUIRED_PROHIBITIONS] };
    expect(evaluateF124({ checks: all(), evidence: ev, ownerDecision: decision }).verdict).toBe(F124_RELEASE_VERDICT);
    expect(evaluateF124({ checks: { ...all(), applyVerified: false }, evidence: ev, ownerDecision: decision })).toMatchObject({ verdict: "F124_BLOCKED", problems: ["owner_decision_without_verified_checks"] });
    expect(evaluateF124({ checks: all(), evidence: ev, ownerDecision: { ...decision, stillProhibited: decision.stillProhibited.filter((x) => x !== "noindex_removal") } }).problems).toEqual(["owner_decision_missing_prohibitions:noindex_removal"]);
    expect(evaluateF124({ checks: all(), evidence: ev, ownerDecision: { ...decision, decidedBy: "claude" } }).problems).toEqual(["owner_decision_invalid"]);
    expect(evaluateF124({ checks: all(), evidence: ev, ownerDecision: { ...decision, verdict: "F124_RELEASED_FOR_PUBLIC" } }).verdict).toBe("F124_BLOCKED");
  });

  it("リポジトリのチェックリスト（2026-10-03 本人の判断）は招待制の少人数ベータとして解除済み", () => {
    const input = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "f124-release-checklist.json"), "utf8"));
    const r = evaluateF124(input);
    expect(r.verdict).toBe(F124_RELEASE_VERDICT);
    expect(r.parts.A.ok && r.parts.B.ok && r.parts.C.ok).toBe(true);
    expect(input.ownerDecision.stillProhibited).toEqual(expect.arrayContaining(["public_signup", "community_public", "noindex_removal", "search_engine_listing", "billing"]));
  });
});
