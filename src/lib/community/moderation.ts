/**
 * コミュニティの安全の最小の契約（2026-10-07・Production 前・純関数・保存も通信もしない）。
 * 運営者 1 人でも扱える規則（`docs/product/community-safety-operations.md`）。草案 `community-guidelines-draft.md` §3〜§5 を実装する。
 *
 * - 自動で削除しない。緊急の理由（個人情報・未成年の安全・連絡先・正確な位置）または、別々の通報者が一定数を超えたものだけ、
 *   管理者の確認まで一時的に非表示にする。
 * - 同じ人の同じ対象への通報は 1 件として数える。1 人の短い時間の大量の通報は受け付けない（悪意のある通報の抑制）。
 * - 投稿者へは理由の種類だけを伝え、通報者は伝えない。監査ログに本文・画像・メモを残さない。
 * - 異議は 1 件の事案に 1 回だけ。
 * - 保証しないもの: 24 時間以内の対応・即時の削除・法的な判断・専門のモデレーション・緊急の通報先（警察等）の代わり。
 */
export const MODERATION_RULES_VERSION = "community-moderation/2026-10-07.v1";

export type ReportTarget = { kind: "post" | "photo" | "comment" | "profile"; id: string; ownerId: string };
export type ReportReason =
  | "personal_info"
  | "minor_safety"
  | "contact_info"
  | "exact_location"
  | "impersonation"
  | "harassment"
  | "inappropriate_image"
  | "spam"
  | "copyright"
  | "other";

/** 一時的に非表示にする緊急の理由。 */
export const EMERGENCY_REASONS: ReadonlySet<ReportReason> = new Set(["personal_info", "minor_safety", "contact_info", "exact_location"]);
/** 緊急でない理由で、一時的に非表示にする別々の通報者の数。 */
export const AUTO_HIDE_DISTINCT_REPORTERS = 3;
/** 1 人が 1 時間に送れる通報の数。 */
export const REPORTS_PER_REPORTER_PER_HOUR = 5;
export const REPORT_NOTE_MAX = 500;

export interface Report {
  reporterId: string;
  target: ReportTarget;
  reason: ReportReason;
  /** 任意のメモ（監査ログには残さない）。 */
  note: string | null;
  at: string;
}

export type CaseState = "open" | "hidden_pending_review" | "kept_hidden" | "restored" | "deletion_requested" | "appealed" | "appeal_kept_hidden" | "appeal_restored";

export interface ModerationCase {
  target: ReportTarget;
  state: CaseState;
  reasons: ReportReason[];
  reporterIds: string[];
  emergency: boolean;
  appealUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  at: string;
  actor: "system" | "admin" | "owner";
  action: "report_received" | "auto_hidden" | "decided" | "appeal_received" | "appeal_decided";
  targetKind: ReportTarget["kind"];
  targetId: string;
  /** 理由の種類だけ（本文・画像・メモは残さない）。 */
  reasonKinds: ReportReason[];
  result: CaseState;
}

export type SubmitResult =
  | { ok: true; case: ModerationCase; audit: AuditEntry[]; duplicate: boolean }
  | { ok: false; problem: "self_report" | "rate_limited" | "note_too_long" | "invalid_reason" | "case_closed" };

const REASONS: ReadonlySet<string> = new Set(["personal_info", "minor_safety", "contact_info", "exact_location", "impersonation", "harassment", "inappropriate_image", "spam", "copyright", "other"]);
const CLOSED: ReadonlySet<CaseState> = new Set(["kept_hidden", "deletion_requested", "appeal_kept_hidden", "appeal_restored"]);

/** 通報を受け付ける。`recentByReporter` は、その通報者の直近 1 時間の通報の時刻（rate limit 用）。 */
export function submitReport(existing: ModerationCase | null, report: Report, recentByReporter: readonly string[]): SubmitResult {
  if (!REASONS.has(report.reason)) return { ok: false, problem: "invalid_reason" };
  if (report.reporterId === report.target.ownerId) return { ok: false, problem: "self_report" };
  if (report.note !== null && [...report.note].length > REPORT_NOTE_MAX) return { ok: false, problem: "note_too_long" };
  const hourAgo = Date.parse(report.at) - 3_600_000;
  if (recentByReporter.filter((t) => Date.parse(t) > hourAgo).length >= REPORTS_PER_REPORTER_PER_HOUR) return { ok: false, problem: "rate_limited" };
  if (existing && CLOSED.has(existing.state)) return { ok: false, problem: "case_closed" };

  const base: ModerationCase = existing ?? { target: report.target, state: "open", reasons: [], reporterIds: [], emergency: false, appealUsed: false, createdAt: report.at, updatedAt: report.at };
  const duplicate = base.reporterIds.includes(report.reporterId) && base.reasons.includes(report.reason);
  const reporterIds = base.reporterIds.includes(report.reporterId) ? base.reporterIds : [...base.reporterIds, report.reporterId];
  const reasons = base.reasons.includes(report.reason) ? base.reasons : [...base.reasons, report.reason].sort();
  const emergency = base.emergency || EMERGENCY_REASONS.has(report.reason);
  const shouldHide = emergency || reporterIds.length >= AUTO_HIDE_DISTINCT_REPORTERS;
  const state: CaseState = base.state === "open" && shouldHide ? "hidden_pending_review" : base.state === "restored" && shouldHide && emergency && !base.emergency ? "hidden_pending_review" : base.state;
  const next: ModerationCase = { ...base, reporterIds, reasons, emergency, state, updatedAt: report.at };
  const audit: AuditEntry[] = [{ at: report.at, actor: "system", action: "report_received", targetKind: report.target.kind, targetId: report.target.id, reasonKinds: [report.reason], result: next.state }];
  if (next.state === "hidden_pending_review" && base.state !== "hidden_pending_review") audit.push({ at: report.at, actor: "system", action: "auto_hidden", targetKind: report.target.kind, targetId: report.target.id, reasonKinds: reasons, result: next.state });
  return { ok: true, case: next, audit, duplicate };
}

export type Decision = "keep_hidden" | "restore" | "request_deletion";

/** 管理者の判断（open または一時的な非表示の事案だけ）。 */
export function decideCase(c: ModerationCase, decision: Decision, at: string): { ok: true; case: ModerationCase; audit: AuditEntry } | { ok: false; problem: "not_decidable" } {
  if (c.state !== "open" && c.state !== "hidden_pending_review") return { ok: false, problem: "not_decidable" };
  const state: CaseState = decision === "keep_hidden" ? "kept_hidden" : decision === "restore" ? "restored" : "deletion_requested";
  return { ok: true, case: { ...c, state, updatedAt: at }, audit: { at, actor: "admin", action: "decided", targetKind: c.target.kind, targetId: c.target.id, reasonKinds: c.reasons, result: state } };
}

/** 投稿者の異議（1 件の事案に 1 回だけ・非表示の継続か削除の依頼の後だけ）。 */
export function appeal(c: ModerationCase, byUserId: string, at: string): { ok: true; case: ModerationCase; audit: AuditEntry } | { ok: false; problem: "not_owner" | "already_appealed" | "not_appealable" } {
  if (byUserId !== c.target.ownerId) return { ok: false, problem: "not_owner" };
  if (c.appealUsed) return { ok: false, problem: "already_appealed" };
  if (c.state !== "kept_hidden" && c.state !== "deletion_requested") return { ok: false, problem: "not_appealable" };
  return { ok: true, case: { ...c, state: "appealed", appealUsed: true, updatedAt: at }, audit: { at, actor: "owner", action: "appeal_received", targetKind: c.target.kind, targetId: c.target.id, reasonKinds: c.reasons, result: "appealed" } };
}

export function decideAppeal(c: ModerationCase, keepHidden: boolean, at: string): { ok: true; case: ModerationCase; audit: AuditEntry } | { ok: false; problem: "not_appealed" } {
  if (c.state !== "appealed") return { ok: false, problem: "not_appealed" };
  const state: CaseState = keepHidden ? "appeal_kept_hidden" : "appeal_restored";
  return { ok: true, case: { ...c, state, updatedAt: at }, audit: { at, actor: "admin", action: "appeal_decided", targetKind: c.target.kind, targetId: c.target.id, reasonKinds: c.reasons, result: state } };
}

/** 投稿者へ伝える内容（理由の種類だけ・通報者は伝えない）。 */
export function ownerNotice(c: ModerationCase): { state: CaseState; reasonKinds: ReportReason[]; canAppeal: boolean } {
  return { state: c.state, reasonKinds: [...c.reasons], canAppeal: !c.appealUsed && (c.state === "kept_hidden" || c.state === "deletion_requested") };
}

/** 対象が他の利用者に見えるか（一時的な非表示・非表示の継続・削除の依頼の間は見えない）。 */
export function isVisibleToOthers(c: ModerationCase | null): boolean {
  if (!c) return true;
  return c.state === "open" || c.state === "restored" || c.state === "appeal_restored";
}

/** 保持期間（案）: 通報・監査ログは解決から 1 年。日数は本人の判断で変える。 */
export const RETENTION_DAYS = { reportsAfterResolution: 365, auditLog: 365 } as const;
export function retentionExpiresAt(resolvedAt: string, days: number = RETENTION_DAYS.reportsAfterResolution): string {
  return new Date(Date.parse(resolvedAt) + days * 86_400_000).toISOString();
}
