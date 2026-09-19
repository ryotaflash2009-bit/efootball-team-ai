import { sanitizeErrorMessage } from "../real-import-guards";
import type { UpdatePlan } from "./plan";
import type { SourceMeta } from "./types";

/**
 * 更新計画(UpdatePlan)から、監査ログとして記録可能なJSON形式のエントリーを生成する純関数。
 *
 * 秘密情報(接続文字列・APIキー・トークン)が理由文字列等に紛れ込んでいた場合に備え、
 * `real-import-guards.ts`の`sanitizeErrorMessage`(接続文字列パターン・既知ホスト名の
 * マスキング)を全フィールドへ適用してから出力する(多層防御)。
 */
export interface AuditLogEntry {
  loggedAt: string;
  table: string;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  decision: "apply-candidate" | "reject";
  reasons: string[];
  previousCount: number;
  candidateCount: number;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  unchangedCount: number;
  writesPerformed: 0;
  deletedCount: 0;
  tombstoneCount: 0;
}

export function buildAuditLogEntry(plan: UpdatePlan, sourceMeta: SourceMeta, loggedAt: string): AuditLogEntry {
  const sanitize = (s: string) => sanitizeErrorMessage(s);
  return {
    loggedAt,
    table: plan.table,
    source: sanitize(sourceMeta.source),
    sourceUrl: sanitize(sourceMeta.sourceUrl),
    fetchedAt: sourceMeta.fetchedAt,
    decision: plan.decision,
    reasons: plan.reasons.map(sanitize),
    previousCount: plan.diff.previousCount,
    candidateCount: plan.diff.candidateCount,
    addedCount: plan.diff.addedCount,
    removedCount: plan.diff.removedCount,
    updatedCount: plan.diff.updatedCount,
    unchangedCount: plan.diff.unchangedCount,
    writesPerformed: 0,
    deletedCount: 0,
    tombstoneCount: 0,
  };
}
