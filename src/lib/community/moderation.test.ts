import { describe, expect, it } from "vitest";
import { AUTO_HIDE_DISTINCT_REPORTERS, appeal, decideAppeal, decideCase, isVisibleToOthers, ownerNotice, REPORTS_PER_REPORTER_PER_HOUR, retentionExpiresAt, submitReport, type Report } from "./moderation";

const target = { kind: "photo" as const, id: "p1", ownerId: "owner" };
const rep = (reporterId: string, reason: Report["reason"], at = "2026-10-07T00:00:00Z", note: string | null = null): Report => ({ reporterId, target, reason, note, at });

describe("コミュニティの安全の契約", () => {
  it("緊急の理由（個人情報・未成年・連絡先・位置）は 1 件で一時的に非表示・自動で削除しない", () => {
    const r = submitReport(null, rep("a", "personal_info"), []);
    expect(r.ok && r.case.state).toBe("hidden_pending_review");
    expect(r.ok && r.audit.map((x) => x.action)).toEqual(["report_received", "auto_hidden"]);
    expect(r.ok && isVisibleToOthers(r.case)).toBe(false);
  });

  it("緊急でない理由は、別々の通報者が一定数に達するまで表示のまま", () => {
    let c = null;
    for (let i = 0; i < AUTO_HIDE_DISTINCT_REPORTERS - 1; i++) {
      const r = submitReport(c, rep(`u${i}`, "spam"), []);
      if (!r.ok) throw new Error("unexpected");
      c = r.case;
    }
    expect(c!.state).toBe("open");
    const r = submitReport(c, rep("uX", "harassment"), []);
    expect(r.ok && r.case.state).toBe("hidden_pending_review");
  });

  it("同じ人の同じ理由の通報は重複として数えない（通報者の数は増えない）", () => {
    const a = submitReport(null, rep("a", "spam"), []);
    if (!a.ok) throw new Error();
    const b = submitReport(a.case, rep("a", "spam"), []);
    expect(b.ok && b.duplicate).toBe(true);
    expect(b.ok && b.case.reporterIds).toEqual(["a"]);
  });

  it("自分の投稿の通報・長すぎるメモ・1 時間の上限を超えた通報・不明な理由は受け付けない", () => {
    expect(submitReport(null, { ...rep("owner", "spam") }, [])).toEqual({ ok: false, problem: "self_report" });
    expect(submitReport(null, rep("a", "spam", undefined, "x".repeat(501)), [])).toEqual({ ok: false, problem: "note_too_long" });
    const recent = Array.from({ length: REPORTS_PER_REPORTER_PER_HOUR }, () => "2026-10-06T23:30:00Z");
    expect(submitReport(null, rep("a", "spam"), recent)).toEqual({ ok: false, problem: "rate_limited" });
    expect(submitReport(null, rep("a", "spam"), ["2026-10-06T22:00:00Z", "2026-10-06T22:01:00Z", "2026-10-06T22:02:00Z", "2026-10-06T22:03:00Z", "2026-10-06T22:04:00Z"]).ok).toBe(true);
    expect(submitReport(null, { ...rep("a", "spam"), reason: "bogus" as Report["reason"] }, [])).toEqual({ ok: false, problem: "invalid_reason" });
  });

  it("監査ログに本文・メモを残さない（理由の種類だけ）", () => {
    const r = submitReport(null, rep("a", "personal_info", undefined, "住所は東京都…"), []);
    expect(JSON.stringify(r.ok && r.audit)).not.toContain("東京都");
  });

  it("判断 → 異議は 1 回だけ → 異議の判断・投稿者へは理由の種類だけ（通報者は伝えない）", () => {
    const r = submitReport(null, rep("a", "contact_info"), []);
    if (!r.ok) throw new Error();
    const d = decideCase(r.case, "keep_hidden", "2026-10-08T00:00:00Z");
    if (!d.ok) throw new Error();
    const notice = ownerNotice(d.case);
    expect(notice).toEqual({ state: "kept_hidden", reasonKinds: ["contact_info"], canAppeal: true });
    expect(JSON.stringify(notice)).not.toContain('"a"');
    expect(appeal(d.case, "someone_else", "2026-10-09T00:00:00Z")).toEqual({ ok: false, problem: "not_owner" });
    const ap = appeal(d.case, "owner", "2026-10-09T00:00:00Z");
    if (!ap.ok) throw new Error();
    expect(appeal(ap.case, "owner", "2026-10-09T00:00:01Z")).toEqual({ ok: false, problem: "already_appealed" });
    const fin = decideAppeal(ap.case, false, "2026-10-10T00:00:00Z");
    expect(fin.ok && fin.case.state).toBe("appeal_restored");
    expect(fin.ok && isVisibleToOthers(fin.case)).toBe(true);
    expect(fin.ok && submitReport(fin.case, rep("b", "spam"), [])).toEqual({ ok: false, problem: "case_closed" });
  });

  it("再表示の後に新しい緊急の通報が来たら、もう一度一時的に非表示", () => {
    const r = submitReport(null, rep("a", "spam"), []);
    if (!r.ok) throw new Error();
    const d = decideCase(r.case, "restore", "2026-10-08T00:00:00Z");
    if (!d.ok) throw new Error();
    const again = submitReport(d.case, rep("b", "minor_safety", "2026-10-09T00:00:00Z"), []);
    expect(again.ok && again.case.state).toBe("hidden_pending_review");
  });

  it("保持期間の期限（解決から 365 日）", () => {
    expect(retentionExpiresAt("2026-10-07T00:00:00Z")).toBe("2027-10-07T00:00:00.000Z");
  });
});
