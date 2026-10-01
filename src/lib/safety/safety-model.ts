import { z } from "zod";

/**
 * F-056 安全機能（通報・ブロック・ミュート・非表示・監査）の型と規則（ローカル/モックの段階）。
 *
 * - 今の段階では実在の利用者・Production のデータを使わない。相手はローカルの投稿か、架空のサンプルだけ。
 * - 将来サーバーへ移すときも同じ契約（理由・状態・重複の扱い・表示の関係）を使う。
 * - 通報の内容は運営だけが読む前提（通報した人の名前を相手へ見せない）。
 */
export const SAFETY_SCHEMA_VERSION = "efb-safety/v1";

export const REPORT_REASONS = ["spam", "harassment", "personal_info", "impersonation", "inappropriate_image", "rights_violation", "minor_safety", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_TARGETS = ["post", "photo", "comment", "user"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed" | "withdrawn";
export type ModerationAction = "none" | "hide" | "delete" | "restrict_user";

const PUBLIC_ID_RE = /^[a-z0-9_-]{3,40}$/;
const TARGET_ID_RE = /^[a-z0-9_-]{3,64}$/;

export const reportSchema = z.object({
  id: z.string().regex(TARGET_ID_RE),
  reporter: z.string().regex(PUBLIC_ID_RE),
  targetKind: z.enum(REPORT_TARGETS),
  targetId: z.string().regex(TARGET_ID_RE),
  /** 対象の投稿者（公開 ID）。自分の投稿の通報を防ぐために使う。 */
  targetOwner: z.string().regex(PUBLIC_ID_RE),
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(500),
  status: z.enum(["open", "reviewing", "actioned", "dismissed", "withdrawn"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Report = z.infer<typeof reportSchema>;

/** 管理者の対応（将来のレビュー画面のための記録。誰が・何を・なぜ）。 */
export interface ModerationRecord {
  id: string;
  reportIds: string[];
  targetKind: ReportTarget;
  targetId: string;
  action: ModerationAction;
  /** 対応した運営者（公開しない内部の識別子）。 */
  moderator: string;
  reasonCode: ReportReason | "policy";
  decidedAt: string;
  /** 異議申し立て（投稿者からの再審査の依頼）。 */
  appeal: { requestedAt: string; message: string; status: "pending" | "upheld" | "reversed" } | null;
}

export interface SafetyRelations {
  blocked: ReadonlySet<string>;
  muted: ReadonlySet<string>;
  /** 相手から自分がブロックされているか（サーバーの段階で使う。ローカルでは常に空）。 */
  blockedBy: ReadonlySet<string>;
}

export interface Viewable {
  id: string;
  owner: string;
  deleted: boolean;
  moderation: "visible" | "under_review" | "hidden_by_admin";
}

export type VisibilityDecision = "show" | "hidden_deleted" | "hidden_by_admin" | "hidden_blocked" | "hidden_muted";

/**
 * 見せてよいか。
 * - 削除済み・管理者の非表示は誰にも見せない（投稿者本人にも本文は出さず、「非表示」とだけ示す）。
 * - ブロック: 双方向で見えない。ミュート: 自分の画面だけ見えない（相手は変わらない）。
 * - 自分の投稿は、ブロック・ミュートの対象にならない。
 */
export function decideVisibility(item: Viewable, viewer: string, rel: SafetyRelations): VisibilityDecision {
  if (item.deleted) return "hidden_deleted";
  if (item.moderation === "hidden_by_admin") return "hidden_by_admin";
  if (item.owner === viewer) return "show";
  if (rel.blocked.has(item.owner) || rel.blockedBy.has(item.owner)) return "hidden_blocked";
  if (rel.muted.has(item.owner)) return "hidden_muted";
  return "show";
}

export type ReportCheck = { ok: true } | { ok: false; reason: "own_content" | "duplicate" | "note_too_long" | "rate_limited" | "invalid" };

/** 通報してよいか（自分の投稿は不可＝削除を案内・同じ対象への重複は 1 件・1 日 20 件まで）。 */
export function checkReport(
  input: { reporter: string; targetKind: ReportTarget; targetId: string; targetOwner: string; reason: ReportReason; note: string },
  existing: readonly Report[],
  now: number,
): ReportCheck {
  if (input.note.length > 500) return { ok: false, reason: "note_too_long" };
  if (!PUBLIC_ID_RE.test(input.reporter) || !TARGET_ID_RE.test(input.targetId) || !PUBLIC_ID_RE.test(input.targetOwner) || !(REPORT_REASONS as readonly string[]).includes(input.reason)) return { ok: false, reason: "invalid" };
  if (input.targetOwner === input.reporter) return { ok: false, reason: "own_content" };
  const mine = existing.filter((r) => r.reporter === input.reporter && r.status !== "withdrawn");
  if (mine.some((r) => r.targetKind === input.targetKind && r.targetId === input.targetId && (r.status === "open" || r.status === "reviewing"))) return { ok: false, reason: "duplicate" };
  if (mine.filter((r) => now - Date.parse(r.createdAt) < 86_400_000).length >= 20) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}

/** ブロック・ミュートの上限（1 日 100 件のブロック。自分自身は不可）。 */
export function checkRelationChange(kind: "block" | "mute", self: string, target: string, recentChanges: number): { ok: true } | { ok: false; reason: "self" | "rate_limited" | "invalid" } {
  if (!PUBLIC_ID_RE.test(target)) return { ok: false, reason: "invalid" };
  if (target === self) return { ok: false, reason: "self" };
  if (kind === "block" && recentChanges >= 100) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}
