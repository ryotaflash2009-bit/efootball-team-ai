import { describe, it, expect } from "vitest";
import { checkRelationChange, checkReport, decideVisibility, reportSchema, type Report, type SafetyRelations } from "./safety-model";

const none: SafetyRelations = { blocked: new Set(), muted: new Set(), blockedBy: new Set() };
const item = (owner: string, over: Partial<{ deleted: boolean; moderation: "visible" | "under_review" | "hidden_by_admin" }> = {}) => ({ id: "post_1", owner, deleted: false, moderation: "visible" as const, ...over });
const T = Date.parse("2026-10-02T00:00:00Z");
const report = (over: Partial<Report> = {}): Report => ({ id: "rep_1", reporter: "me_local", targetKind: "post", targetId: "post_1", targetOwner: "sample_a", reason: "spam", note: "", status: "open", createdAt: new Date(T).toISOString(), updatedAt: new Date(T).toISOString(), ...over });

describe("F-056 表示の関係（ブロック・ミュート・削除・管理者の非表示）", () => {
  it("ブロックは双方向、ミュートは自分の画面だけ、自分の投稿は常に見える", () => {
    expect(decideVisibility(item("sample_a"), "me_local", { ...none, blocked: new Set(["sample_a"]) })).toBe("hidden_blocked");
    expect(decideVisibility(item("sample_a"), "me_local", { ...none, blockedBy: new Set(["sample_a"]) })).toBe("hidden_blocked");
    expect(decideVisibility(item("sample_a"), "me_local", { ...none, muted: new Set(["sample_a"]) })).toBe("hidden_muted");
    expect(decideVisibility(item("me_local"), "me_local", { ...none, blocked: new Set(["me_local"]), muted: new Set(["me_local"]) })).toBe("show");
    expect(decideVisibility(item("sample_a"), "me_local", none)).toBe("show");
  });

  it("削除済み・管理者の非表示は投稿者本人にも本文を見せない", () => {
    expect(decideVisibility(item("me_local", { deleted: true }), "me_local", none)).toBe("hidden_deleted");
    expect(decideVisibility(item("me_local", { moderation: "hidden_by_admin" }), "me_local", none)).toBe("hidden_by_admin");
    expect(decideVisibility(item("sample_a", { moderation: "under_review" }), "me_local", none)).toBe("show");
  });
});

describe("F-056 通報", () => {
  const base = { reporter: "me_local", targetKind: "post" as const, targetId: "post_1", targetOwner: "sample_a", reason: "spam" as const, note: "" };
  it("自分の投稿は通報できない（削除を案内）・重複は 1 件・1 日 20 件まで・説明は 500 文字まで", () => {
    expect(checkReport({ ...base, targetOwner: "me_local" }, [], T)).toEqual({ ok: false, reason: "own_content" });
    expect(checkReport(base, [report()], T)).toEqual({ ok: false, reason: "duplicate" });
    expect(checkReport(base, [report({ status: "dismissed" })], T)).toEqual({ ok: true });
    expect(checkReport(base, [report({ status: "withdrawn" })], T)).toEqual({ ok: true });
    const many = Array.from({ length: 20 }, (_, i) => report({ id: `rep_${i + 10}`, targetId: `post_${i + 10}` }));
    expect(checkReport(base, many, T)).toEqual({ ok: false, reason: "rate_limited" });
    expect(checkReport({ ...base, note: "x".repeat(501) }, [], T)).toEqual({ ok: false, reason: "note_too_long" });
    expect(checkReport({ ...base, targetId: "<script>" }, [], T)).toEqual({ ok: false, reason: "invalid" });
    expect(checkReport(base, [], T)).toEqual({ ok: true });
  });

  it("通報の記録の形（理由・状態は決まった値だけ）", () => {
    expect(reportSchema.safeParse(report()).success).toBe(true);
    expect(reportSchema.safeParse({ ...report(), reason: "free text" }).success).toBe(false);
  });
});

describe("F-056 ブロック・ミュートの変更", () => {
  it("自分自身は不可・ブロックは 1 日 100 件まで", () => {
    expect(checkRelationChange("block", "me_local", "me_local", 0)).toEqual({ ok: false, reason: "self" });
    expect(checkRelationChange("block", "me_local", "sample_a", 100)).toEqual({ ok: false, reason: "rate_limited" });
    expect(checkRelationChange("mute", "me_local", "sample_a", 1000)).toEqual({ ok: true });
    expect(checkRelationChange("mute", "me_local", "<x>", 0)).toEqual({ ok: false, reason: "invalid" });
  });
});
