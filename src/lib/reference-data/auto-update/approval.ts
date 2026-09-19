import { createHash } from "node:crypto";
import type { GuardCheck } from "../real-import-guards";
import type { DiffReport } from "./diff";
import type { UpdateJob } from "./job";

/**
 * Phase 2: 人間の明示承認(approval artifact)の検証(純関数、副作用なし)。
 *
 * 単なる`--yes`フラグでの本番適用は許可しない、というタスクの明示的要求に基づき、
 * 承認artifactは対象データセットのchecksum・差分内容・期待件数と厳密に一致しなければ
 * 拒否する設計にしている。承認artifact自体の生成(署名・実ユーザー認証)は今回の範囲外
 * (第一段階はローカルCLIへ渡す明示的なJSONで足りるとタスクが明記している)。
 */
export interface ApprovalArtifact {
  jobId: string;
  datasetChecksum: string;
  diffChecksum: string;
  schemaVersion: string;
  approvedAt: string;
  approvedBy: string;
  nonce: string;
  expiresAt: string;
  expectedCounts: { added: number; updated: number; removedCandidate: number };
}

/** DiffReportから承認artifactと突き合わせるためのchecksumを計算する(安定した内容ベース)。 */
export function computeDiffChecksum(diff: DiffReport): string {
  const stable = {
    table: diff.table,
    addedIds: [...diff.addedIds].sort(),
    removedIds: [...diff.removedIds].sort(),
    updatedIds: [...diff.updatedIds].sort(),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function validateApproval(
  approval: ApprovalArtifact,
  job: UpdateJob,
  diff: DiffReport,
  now: Date,
): GuardCheck[] {
  const checks: GuardCheck[] = [];

  checks.push(
    approval.jobId === job.jobId
      ? { ok: true }
      : { ok: false, reason: `承認artifactのjobIdがジョブと一致しない(承認:${approval.jobId}, ジョブ:${job.jobId})` },
  );
  checks.push(
    approval.datasetChecksum === job.datasetChecksum
      ? { ok: true }
      : { ok: false, reason: "承認artifactのdatasetChecksumが現在のデータセットと一致しない(承認後にデータが変更された可能性)" },
  );
  checks.push(
    approval.schemaVersion === job.schemaVersion
      ? { ok: true }
      : { ok: false, reason: "承認artifactのschemaVersionが現在のジョブと一致しない" },
  );

  const actualDiffChecksum = computeDiffChecksum(diff);
  checks.push(
    approval.diffChecksum === actualDiffChecksum
      ? { ok: true }
      : { ok: false, reason: "承認artifactのdiffChecksumが現在の差分内容と一致しない(承認後に差分が変化した可能性)" },
  );

  checks.push(
    approval.expectedCounts.added === diff.addedCount &&
      approval.expectedCounts.updated === diff.updatedCount &&
      approval.expectedCounts.removedCandidate === diff.removedCount
      ? { ok: true }
      : {
          ok: false,
          reason: `承認artifactの期待件数が現在の差分件数と一致しない(承認: added=${approval.expectedCounts.added}/updated=${approval.expectedCounts.updated}/removed=${approval.expectedCounts.removedCandidate}, 実際: added=${diff.addedCount}/updated=${diff.updatedCount}/removed=${diff.removedCount})`,
        },
  );

  const expiresAt = new Date(approval.expiresAt).getTime();
  checks.push(
    Number.isFinite(expiresAt) && now.getTime() < expiresAt
      ? { ok: true }
      : { ok: false, reason: `承認artifactの有効期限が切れている(期限:${approval.expiresAt}, 現在:${now.toISOString()})` },
  );

  if (!approval.approvedBy || approval.approvedBy.trim().length === 0) {
    checks.push({ ok: false, reason: "承認artifactにapprovedByが設定されていない" });
  }
  if (!approval.nonce || approval.nonce.trim().length === 0) {
    checks.push({ ok: false, reason: "承認artifactにnonceが設定されていない(単なるフラグでの承認を防ぐための必須項目)" });
  }

  return checks;
}
